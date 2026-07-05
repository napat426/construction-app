'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Paperclip, Link as LinkIcon, Trash2, FileText, CheckCircle2, AlertCircle, XCircle } from 'lucide-react'
import * as pdfjsLib from 'pdfjs-dist'
// Set worker for pdf.js
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`
}

interface DocumentManagerProps {
  selectedProjectId: string
}

export function DocumentManager({ selectedProjectId }: DocumentManagerProps) {
  const [docs, setDocs] = useState<any[]>([])
  const [tab, setTab] = useState<'upload' | 'link'>('upload')
  const [keepOriginal, setKeepOriginal] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0, status: '' })
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (selectedProjectId) {
      fetchDocs()
    } else {
      setDocs([])
    }
  }, [selectedProjectId])

  const fetchDocs = async () => {
    const { data } = await supabase.from('project_documents').select('*').eq('project_id', selectedProjectId).order('uploaded_at', { ascending: false })
    if (data) setDocs(data)
  }

  const handleLinkSubmit = async () => {
    if (!linkUrl) return
    setIsProcessing(true)
    try {
      await supabase.from('project_documents').insert({
        project_id: selectedProjectId,
        doc_type: 'spec_sheet',
        source_type: 'gdrive',
        external_url: linkUrl,
        status: 'ready',
        file_name: 'Google Drive Link'
      })
      setLinkUrl('')
      fetchDocs()
    } catch (e: any) {
      alert('Error: ' + e.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate size (50MB)
    if (file.size > 50 * 1024 * 1024) {
      alert('ขนาดไฟล์เกิน 50MB')
      return
    }
    // Validate type
    if (file.type !== 'application/pdf') {
      alert('รองรับเฉพาะไฟล์ PDF เท่านั้น')
      return
    }

    // Duplicate check
    const isDup = docs.some(d => d.file_name === file.name && d.source_type === 'upload')
    if (isDup) {
      if (!confirm('ไฟล์ชื่อนี้มีอยู่แล้วในระบบ ต้องการอัปโหลดซ้ำหรือไม่?')) return
    }

    setIsProcessing(true)
    setProgress({ current: 0, total: 0, status: 'กำลังเตรียมไฟล์...' })
    abortControllerRef.current = new AbortController()

    let docId = ''
    try {
      // 1. Upload to Storage if keep_original is true
      let publicUrl = ''
      if (keepOriginal) {
        setProgress(p => ({ ...p, status: 'กำลังอัปโหลดไฟล์...' }))
        const fileName = `${Date.now()}_${file.name}`
        const { error: uploadError } = await supabase.storage.from('project-docs').upload(fileName, file)
        if (uploadError) throw uploadError
        const { data: urlData } = supabase.storage.from('project-docs').getPublicUrl(fileName)
        publicUrl = urlData.publicUrl
      }

      // 2. Create DB Record
      const { data: docData, error: dbError } = await supabase.from('project_documents').insert({
        project_id: selectedProjectId,
        doc_type: 'spec_sheet',
        source_type: 'upload',
        file_name: file.name,
        file_url: publicUrl,
        keep_original: keepOriginal,
        status: 'processing'
      }).select().single()
      if (dbError) throw dbError
      docId = docData.id
      fetchDocs()

      // 3. Process PDF locally
      setProgress(p => ({ ...p, status: 'กำลังอ่านไฟล์ PDF...' }))
      const arrayBuffer = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
      const totalPages = pdf.numPages
      setProgress({ current: 0, total: totalPages, status: 'กำลังสกัดข้อความ...' })

      // Update total pages in DB
      await supabase.from('project_documents').update({ page_count: totalPages }).eq('id', docId)

      let totalExtractedLength = 0
      const batchSize = 10
      let currentBatch = []
      let chunkCounter = 0

      for (let i = 1; i <= totalPages; i++) {
        if (abortControllerRef.current.signal.aborted) throw new Error('ยกเลิกโดยผู้ใช้')

        const page = await pdf.getPage(i)
        const textContent = await page.getTextContent()
        const text = textContent.items.map((item: any) => item.str).join(' ')
        totalExtractedLength += text.length

        // Simple Chunking (split by ~500 words, but here we just chunk per page for simplicity, or split page if too long)
        // If text is short, it might be scanned.
        
        // Split by 500 words
        const words = text.split(/\s+/)
        let currentChunk = []
        for (let w of words) {
          currentChunk.push(w)
          if (currentChunk.length >= 500) {
            currentBatch.push({
              chunk_index: chunkCounter++,
              page_number: i,
              content: currentChunk.join(' '),
              section_title: extractSectionTitle(currentChunk.join(' '))
            })
            currentChunk = []
          }
        }
        if (currentChunk.length > 0) {
           currentBatch.push({
             chunk_index: chunkCounter++,
             page_number: i,
             content: currentChunk.join(' '),
             section_title: extractSectionTitle(currentChunk.join(' '))
           })
        }

        setProgress(p => ({ ...p, current: i }))

        if (currentBatch.length >= batchSize || i === totalPages) {
          // Send batch to server
          const res = await fetch('/api/documents/save-chunks', {
            method: 'POST',
            body: JSON.stringify({
              docId,
              projectId: selectedProjectId,
              chunks: currentBatch,
              pageCount: i,
              status: i === totalPages ? 'ready' : 'processing'
            })
          })
          if (!res.ok) throw new Error('บันทึกข้อมูลล้มเหลว')
          currentBatch = []
        }
      }

      // 4. Check for scanned document (Very few characters extracted per page on average)
      if (totalExtractedLength / totalPages < 50) {
         await supabase.from('project_documents').update({ status: 'scanned_pdf' }).eq('id', docId)
         alert('แจ้งเตือน: ไฟล์นี้อาจเป็นภาพสแกน ระบบไม่สามารถสกัดข้อความได้สมบูรณ์ (ต้องใช้ OCR ในเฟส 2B)')
      }

      fetchDocs()
    } catch (e: any) {
      if (e.message === 'ยกเลิกโดยผู้ใช้') {
         if (docId) await fetch('/api/documents/delete', { method: 'POST', body: JSON.stringify({ docId }) })
      } else {
         if (docId) await supabase.from('project_documents').update({ status: 'error' }).eq('id', docId)
         alert('Error: ' + e.message)
      }
      fetchDocs()
    } finally {
      setIsProcessing(false)
      if (e?.target) (e.target as HTMLInputElement).value = ''
    }
  }

  const extractSectionTitle = (text: string) => {
    // Simple heuristic: look for "หมวด..." at the start of a chunk
    const match = text.match(/^(หมวด[^\s]+)\s/)
    return match ? match[1] : null
  }

  const cancelProcessing = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }

  const handleDelete = async (docId: string) => {
    if (!confirm('ยืนยันการลบเอกสารนี้?')) return
    await fetch('/api/documents/delete', { method: 'POST', body: JSON.stringify({ docId }) })
    fetchDocs()
  }

  return (
    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-[#252548]">
      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">รายการประกอบแบบ / สัญญา</span>
      
      {/* Tabs */}
      <div className="flex gap-2 mb-3">
        <button onClick={() => setTab('upload')} className={`text-xs px-2 py-1 rounded ${tab === 'upload' ? 'bg-primary-100 text-primary-700 font-bold' : 'text-slate-500 hover:bg-slate-100'}`}>อัปโหลด PDF</button>
        <button onClick={() => setTab('link')} className={`text-xs px-2 py-1 rounded ${tab === 'link' ? 'bg-primary-100 text-primary-700 font-bold' : 'text-slate-500 hover:bg-slate-100'}`}>ลิงก์ Google Drive</button>
      </div>

      {tab === 'upload' ? (
        <div className="space-y-2">
          <label className={`flex items-center justify-center gap-2 w-full py-2 bg-white dark:bg-[#252548] border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-50 transition-colors relative ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}>
            <Paperclip size={14} />
            เพิ่มไฟล์ PDF
            <input type="file" accept="application/pdf" className="hidden" onChange={handleUpload} disabled={isProcessing} />
          </label>
          <label className="flex items-center gap-2 text-[10px] text-slate-500 cursor-pointer">
            <input type="checkbox" checked={keepOriginal} onChange={e => setKeepOriginal(e.target.checked)} disabled={isProcessing} />
            เก็บไฟล์ต้นฉบับไว้บนระบบ (ใช้พื้นที่ Storage)
          </label>
        </div>
      ) : (
        <div className="flex gap-2">
          <input type="url" placeholder="วางลิงก์ Google Drive" value={linkUrl} onChange={e => setLinkUrl(e.target.value)} className="flex-1 text-xs px-2 py-1.5 border rounded-lg dark:bg-[#14142a]" disabled={isProcessing} />
          <button onClick={handleLinkSubmit} disabled={isProcessing || !linkUrl} className="px-3 bg-primary-600 text-white rounded-lg text-xs font-bold disabled:opacity-50">บันทึก</button>
        </div>
      )}

      {/* Processing State */}
      {isProcessing && progress.total > 0 && (
        <div className="mt-3 p-3 bg-slate-100 dark:bg-[#252548] rounded-lg">
          <div className="flex justify-between text-[10px] font-bold mb-1 text-slate-600 dark:text-slate-300">
            <span>{progress.status}</span>
            <span>{progress.current} / {progress.total}</span>
          </div>
          <div className="w-full bg-slate-300 dark:bg-slate-700 rounded-full h-1.5 mb-2">
            <div className="bg-primary-500 h-1.5 rounded-full transition-all duration-300" style={{ width: `${(progress.current / progress.total) * 100}%` }}></div>
          </div>
          <button onClick={cancelProcessing} className="text-[10px] text-red-500 hover:underline w-full text-center">ยกเลิก</button>
        </div>
      )}

      {/* Document List */}
      <div className="mt-3 space-y-1.5">
        {docs.map(doc => (
          <div key={doc.id} className="flex items-center justify-between p-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-[#1a1a32]">
            <div className="flex items-center gap-2 overflow-hidden">
              {doc.source_type === 'gdrive' ? <LinkIcon size={12} className="text-blue-500 flex-shrink-0" /> : <FileText size={12} className="text-slate-400 flex-shrink-0" />}
              <span className="text-xs truncate" title={doc.file_name}>{doc.file_name}</span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {doc.status === 'ready' && <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded flex items-center gap-1"><CheckCircle2 size={10}/> {doc.page_count ? `${doc.page_count} หน้า` : 'Ready'}</span>}
              {doc.status === 'processing' && <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded flex items-center gap-1"><AlertCircle size={10}/> กำลังทำ</span>}
              {doc.status === 'error' && <span className="text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded flex items-center gap-1"><XCircle size={10}/> Error</span>}
              {doc.status === 'scanned_pdf' && <span className="text-[9px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded flex items-center gap-1"><AlertCircle size={10}/> Scanned</span>}
              
              <button onClick={() => handleDelete(doc.id)} className="text-slate-400 hover:text-red-500 p-0.5"><Trash2 size={12} /></button>
            </div>
          </div>
        ))}
        {docs.length === 0 && <p className="text-[10px] text-center text-slate-400 py-2">ยังไม่มีเอกสารอ้างอิง</p>}
      </div>
    </div>
  )
}
