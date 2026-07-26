'use client'

import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { X, FileText, Loader2, AlertTriangle, CheckCircle2, Play, Pause } from 'lucide-react'
import * as pdfjsLib from 'pdfjs-dist'

// Set worker path to standard CDN (same version as installed)
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

interface Props {
  doc: any
  initialFile?: File | null
  onClose: () => void
  onComplete: () => void
}

export function OCRProcessorModal({ doc, initialFile, onClose, onComplete }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [totalPages, setTotalPages] = useState(0)
  const [processedPages, setProcessedPages] = useState(doc.processed_pages || 0)
  const [status, setStatus] = useState<'idle' | 'analyzing' | 'ready' | 'processing' | 'paused' | 'error' | 'done'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [isResuming, setIsResuming] = useState(doc.processed_pages > 0 && doc.status === 'processing')
  const [countdown, setCountdown] = useState(0)
  const [isWaiting, setIsWaiting] = useState(false)
  
  const isProcessingRef = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (initialFile) {
      processFile(initialFile)
    }
  }, [initialFile])

  useEffect(() => {
    return () => {
      isProcessingRef.current = false
      if (abortControllerRef.current) abortControllerRef.current.abort()
    }
  }, [])

  const calculateHash = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer()
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  const processFile = async (selected: File) => {
    if (selected.type !== 'application/pdf') {
      setErrorMsg('กรุณาเลือกไฟล์ PDF เท่านั้น')
      return
    }
    
    setFile(selected)
    setStatus('analyzing')
    setErrorMsg('')

    try {
      // 1. Calculate Hash
      const hash = await calculateHash(selected)
      
      // 2. Check if hash exists in other ready documents
      const { data: existing } = await supabase
        .from('project_documents')
        .select('id, file_name')
        .eq('file_hash', hash)
        .eq('status', 'ready')
        .neq('id', doc.id)
        .limit(1)
        
      if (existing && existing.length > 0) {
        if (!confirm(`ไฟล์นี้เหมือนกับเอกสาร "${existing[0].file_name}" ที่เคยประมวลผลไปแล้ว คุณแน่ใจหรือไม่ที่จะทำซ้ำ? (เปลืองโควตา)`)) {
          setFile(null)
          setStatus('idle')
          return
        }
      }

      // 3. Load PDF
      const arrayBuffer = await selected.arrayBuffer()
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
      const pdfDoc = await loadingTask.promise
      
      setPdf(pdfDoc)
      setTotalPages(pdfDoc.numPages)
      
      // Update doc info
      await supabase.from('project_documents').update({
        file_hash: hash,
        total_pages: pdfDoc.numPages
      }).eq('id', doc.id)
      
      setStatus('ready')
    } catch (err: any) {
      console.error(err)
      setErrorMsg('เกิดข้อผิดพลาดในการอ่าน PDF: ' + err.message)
      setStatus('error')
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return
    await processFile(selected)
  }


  const getPageBase64 = async (pageNumber: number): Promise<string> => {
    if (!pdf) throw new Error('PDF not loaded')
    const page = await pdf.getPage(pageNumber)
    const viewport = page.getViewport({ scale: 1.0 }) // Reduced scale to 1.0 to prevent payload too large
    
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas context not available')
    
    canvas.height = viewport.height
    canvas.width = viewport.width
    
    await page.render({ canvasContext: context, viewport }).promise
    
    return canvas.toDataURL('image/jpeg', 0.8)
  }

  const getPageText = async (pageNumber: number): Promise<string> => {
    if (!pdf) return ''
    try {
      const page = await pdf.getPage(pageNumber)
      const textContent = await page.getTextContent()
      const items = textContent.items as any[]
      const pageText = items.map(item => item.str).join(' ').trim()
      return pageText
    } catch (err) {
      console.error('Failed to extract text layer:', err)
      return ''
    }
  }

  const startProcessing = async () => {
    if (!pdf || totalPages === 0) return
    setStatus('processing')
    isProcessingRef.current = true
    setErrorMsg('')
    
    await supabase.from('project_documents').update({ status: 'processing' }).eq('id', doc.id)

    let current = processedPages
    
    while (current < totalPages && isProcessingRef.current) {
      const pageNum = current + 1
      abortControllerRef.current = new AbortController()
      
      try {
        // 1. Try to read text directly from PDF layer first (Hybrid Mode)
        const pageText = await getPageText(pageNum)
        let base64 = ''
        
        if (!pageText) {
          // Fallback to rendering canvas and OCR
          base64 = await getPageBase64(pageNum)
        }

        let success = false
        
        while (!success && isProcessingRef.current) {
          try {
            const res = await fetch('/api/documents/process-page', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                documentId: doc.id,
                projectId: doc.project_id,
                pageNumber: pageNum,
                text: pageText || undefined,
                imageBase64: pageText ? undefined : base64
              }),
              signal: abortControllerRef.current.signal
            })
            
            const data = await res.json()
            
            if (res.status === 429) {
              console.log('Rate limit hit, waiting 30 seconds before retry...')
              setIsWaiting(true)
              for (let sec = 30; sec > 0; sec--) {
                if (!isProcessingRef.current) break
                setCountdown(sec)
                await new Promise(r => setTimeout(r, 1000))
              }
              setIsWaiting(false)
              continue // Retry the page again
            }
            
            if (res.status === 504) {
              throw new Error('เซิร์ฟเวอร์ใช้เวลาประมวลผลนานเกินไป (Timeout) อาจเป็นเพราะไฟล์ภาพมีรายละเอียดมากเกินไป')
            }
            
            if (!res.ok) throw new Error(data.error || 'Failed to process page')
            
            success = true
          } catch (fetchErr: any) {
            if (fetchErr.name === 'AbortError') throw fetchErr
            if (fetchErr.message.includes('Unexpected token')) {
               throw new Error('เซิร์ฟเวอร์ไม่ตอบสนอง (Timeout) กรุณาลองใหม่')
            }
            throw fetchErr
          }
        }
        
        if (success) {
          current++
          setProcessedPages(current)
          
          // Hybrid delay: 200ms for text layer (fast), 2000ms for scanned OCR to prevent quota hits
          const delay = pageText ? 200 : 2000
          await new Promise(r => setTimeout(r, delay))
        }
        
      } catch (err: any) {
        if (err.name === 'AbortError') break
        console.error(err)
        setErrorMsg(`เกิดข้อผิดพลาดหน้าที่ ${pageNum}: ${err.message}`)
        setStatus('error')
        isProcessingRef.current = false
        break
      }
    }
    
    if (current === totalPages) {
      await supabase.from('project_documents').update({ status: 'ready' }).eq('id', doc.id)
      setStatus('done')
      if (onComplete) onComplete()
    }
  }

  const pauseProcessing = () => {
    isProcessingRef.current = false
    if (abortControllerRef.current) abortControllerRef.current.abort()
    setStatus('paused')
  }

  const progressPercent = totalPages > 0 ? Math.round((processedPages / totalPages) * 100) : 0

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#14142a] rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-[#252548]">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-[#252548] bg-slate-50 dark:bg-[#1a1a32]">
          <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <FileText size={18} className="text-primary-500" />
            ประมวลผลเอกสารให้ AI (OCR)
          </h3>
          <button onClick={onClose} disabled={status === 'processing'} className="text-slate-400 hover:text-slate-600 disabled:opacity-50">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-5 space-y-5">
          <div>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{doc.file_name}</p>
            <p className="text-xs text-slate-500">
              ระบบต้องการไฟล์ต้นฉบับเพื่อทำการสกัดข้อความ (OCR) ไฟล์ที่อัปโหลดจะถูกประมวลผลทีละหน้าผ่าน Gemini API
            </p>
          </div>

          {status === 'idle' || status === 'analyzing' ? (
            <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-6 text-center">
              {status === 'analyzing' ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 size={24} className="text-primary-500 animate-spin" />
                  <p className="text-sm text-slate-600">กำลังตรวจสอบไฟล์...</p>
                </div>
              ) : (
                <>
                  <input type="file" accept="application/pdf" id="pdf-upload" className="hidden" onChange={handleFileChange} />
                  <label htmlFor="pdf-upload" className="cursor-pointer flex flex-col items-center gap-2">
                    <div className="w-10 h-10 bg-primary-50 dark:bg-primary-900/20 text-primary-600 rounded-full flex items-center justify-center">
                      <FileText size={20} />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-primary-600 hover:underline">เลือกไฟล์ PDF จากเครื่อง</span>
                      <p className="text-xs text-slate-500 mt-1">ไฟล์นี้จะถูกใช้ประมวลผลชั่วคราวและไม่ถูกเก็บบนเซิร์ฟเวอร์</p>
                    </div>
                  </label>
                </>
              )}
            </div>
          ) : (
            <div className="bg-slate-50 dark:bg-[#1a1a32] rounded-lg p-4 border border-slate-200 dark:border-slate-700 space-y-4">
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">จำนวนหน้าทั้งหมด: {totalPages} หน้า</p>
                  <p className="text-xs text-slate-500 mt-1">ใช้โควตา Gemini ประมาณ {totalPages} requests</p>
                </div>
                {status === 'ready' && (
                  <button onClick={startProcessing} className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold transition-colors">
                    <Play size={14} /> เริ่มประมวลผล
                  </button>
                )}
                {status === 'processing' && (
                  <button onClick={pauseProcessing} className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold transition-colors">
                    <Pause size={14} /> พักการทำงาน
                  </button>
                )}
                {status === 'paused' && (
                  <button onClick={startProcessing} className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold transition-colors">
                    <Play size={14} /> ทำต่อ
                  </button>
                )}
              </div>
              
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 font-medium">
                  <span>ความคืบหน้า</span>
                  <span>{processedPages} / {totalPages} ({progressPercent}%)</span>
                </div>
                <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-300 ${status === 'error' ? 'bg-red-500' : status === 'done' ? 'bg-green-500' : 'bg-primary-500'}`} 
                    style={{ width: `${progressPercent}%` }}
                  ></div>
                </div>
                {status === 'processing' && (
                  <p className="text-[10px] text-slate-500 animate-pulse">กำลังส่งข้อมูลทีละหน้าไปยัง Gemini API... (มีการหน่วงเวลาเพื่อป้องกัน Rate Limit)</p>
                )}
              </div>
            </div>
          )}

          {isWaiting && (
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-lg text-xs flex items-center gap-2 animate-pulse">
              <AlertTriangle size={14} className="flex-shrink-0" />
              <p className="font-bold">⚠️ ติดข้อจำกัดโควตาฟรีชั่วคราว ระบบกำลังรอ {countdown} วินาทีเพื่อทำต่อ...</p>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-xs flex items-start gap-2">
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
              <p>{errorMsg}</p>
            </div>
          )}
          
          {status === 'done' && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg text-xs flex items-center gap-2">
              <CheckCircle2 size={16} />
              <p className="font-bold">ประมวลผลเสร็จสิ้น! AI สามารถอ่านเอกสารนี้ได้แล้ว</p>
            </div>
          )}
        </div>
        
        <div className="p-4 border-t border-slate-200 dark:border-[#252548] bg-slate-50 dark:bg-[#1a1a32] flex justify-end">
          {status === 'done' ? (
            <button onClick={() => { onComplete(); onClose() }} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-bold">
              ปิด
            </button>
          ) : (
            <button onClick={onClose} disabled={status === 'processing'} className="px-4 py-2 text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-sm font-bold disabled:opacity-50">
              ยกเลิก
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
