'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Link as LinkIcon, Trash2, ExternalLink, Cloud, Cpu, CheckCircle2, FileText } from 'lucide-react'
import { OCRProcessorModal } from './OCRProcessorModal'

interface DocumentManagerProps {
  scope: 'global' | 'project'
  selectedProjectId?: string
  onUpdate?: () => void
  readOnly?: boolean
}

export function DocumentManager({ scope, selectedProjectId, onUpdate, readOnly = false }: DocumentManagerProps) {
  const [docs, setDocs] = useState<any[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [activeOCRDoc, setActiveOCRDoc] = useState<{ doc: any, file: File | null } | null>(null)

  useEffect(() => {
    if (scope === 'project' && !selectedProjectId) {
      setDocs([])
      return
    }
    fetchDocs()
  }, [selectedProjectId, scope])

  const fetchDocs = async () => {
    let query = supabase.from('project_documents').select('*').eq('scope', scope).order('uploaded_at', { ascending: false })
    if (scope === 'project' && selectedProjectId) {
      query = query.eq('project_id', selectedProjectId)
    }
    const { data } = await query
    if (data) setDocs(data)
    if (onUpdate) onUpdate()
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return
    if (selectedFile.type !== 'application/pdf') {
      alert('กรุณาเลือกไฟล์ PDF เท่านั้น')
      return
    }
    setIsProcessing(true)
    try {
      const { data, error } = await supabase.from('project_documents').insert({
        project_id: scope === 'project' ? selectedProjectId : null,
        doc_type: 'PDF',
        source_type: 'file',
        external_url: '#',
        file_name: selectedFile.name,
        scope: scope,
        status: 'pending_ocr'
      }).select().single()

      if (error) throw error
      
      setActiveOCRDoc({ doc: data, file: selectedFile })
      fetchDocs()
    } catch (err: any) {
      alert('Error: ' + err.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDelete = async (docId: string) => {
    if (!confirm('ยืนยันการลบลิงก์เอกสารนี้?')) return
    await fetch('/api/documents/delete', { method: 'POST', body: JSON.stringify({ docId }) })
    fetchDocs()
  }

  const getIcon = (type: string) => {
    if (type === 'PDF' || type === 'Local File' || type === 'file') return <FileText size={14} className="text-red-500" />
    if (type === 'Google Drive') return <Cloud size={14} className="text-blue-500" />
    if (type === 'OneDrive') return <Cloud size={14} className="text-sky-500" />
    return <LinkIcon size={14} className="text-slate-500" />
  }

  return (
    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-[#252548]">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
          {scope === 'global' ? '📚 รายการประกอบแบบกลาง (ใช้ทุกโครงการ)' : '📁 เอกสารสัญญาโครงการ'}
        </span>
      </div>
      
      {!readOnly && (
        <div className="space-y-2 mb-4 bg-slate-50 dark:bg-[#14142a] p-3 rounded-lg border border-slate-200 dark:border-slate-700 text-center">
          <input 
            type="file" 
            id={`pdf-file-upload-${scope}`}
            accept="application/pdf" 
            onChange={handleFileSelect} 
            className="hidden" 
            disabled={isProcessing}
          />
          <label 
            htmlFor={`pdf-file-upload-${scope}`}
            className="cursor-pointer flex flex-col items-center gap-2 py-4 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
          >
            <div className="w-10 h-10 bg-primary-50 dark:bg-primary-900/20 text-primary-600 rounded-full flex items-center justify-center mx-auto">
              <FileText size={20} />
            </div>
            <div>
              <span className="text-xs font-bold text-primary-600 hover:underline">
                {scope === 'global' ? '📁 คลิกเพื่ออัปโหลดรายการประกอบแบบกลาง (PDF)' : '📁 คลิกเพื่ออัปโหลดเอกสารสัญญา (PDF)'}
              </span>
              <p className="text-[10px] text-slate-400 mt-1">ขนาดสูงสุดไม่เกิน 20MB (เฉพาะสกุลไฟล์ .pdf)</p>
            </div>
          </label>
        </div>
      )}

      {/* Document List */}
      <div className="space-y-1.5">
        {docs.map(doc => (
          <div key={doc.id} className="flex flex-col gap-1.5 p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-[#1a1a32]">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="flex-shrink-0 mt-0.5">{getIcon(doc.doc_type)}</div>
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate" title={doc.file_name}>{doc.file_name}</span>
                </div>
              </div>
              {!readOnly && (
                <button onClick={() => handleDelete(doc.id)} className="text-slate-400 hover:text-red-500 flex-shrink-0" title="ลบเอกสาร"><Trash2 size={12} /></button>
              )}
            </div>
            
            <div className="flex items-center justify-between mt-1">
              <div className="flex items-center gap-2">
                {doc.status === 'pending_ocr' || doc.status === 'processing' ? (
                  readOnly ? (
                    <span className="text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                      {doc.status === 'processing' ? `⚙️ กำลังสแกน (${doc.processed_pages || 0}/${doc.total_pages || '?'})` : '⏳ รอดำเนินการสแกน'}
                    </span>
                  ) : (
                    <button 
                      onClick={() => setActiveOCRDoc({ doc: doc, file: null })}
                      className="flex items-center gap-1 text-[9px] font-bold bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 px-1.5 py-0.5 rounded border border-primary-200 dark:border-primary-800 hover:bg-primary-200 dark:hover:bg-primary-900/50 transition-colors"
                    >
                      <Cpu size={10} /> 
                      {doc.status === 'processing' ? `กำลังประมวลผล (${doc.processed_pages || 0}/${doc.total_pages || '?'})` : '🔍 ประมวลผลให้ AI'}
                    </button>
                  )
                ) : doc.status === 'ready' ? (
                  <span className="flex items-center gap-1 text-[9px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded border border-green-200 dark:border-green-800" title={`อ่านไปแล้ว ${doc.total_pages} หน้า`}>
                    <CheckCircle2 size={10} /> AI พร้อมอ่านแล้ว
                  </span>
                ) : (
                  <span className="text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                    ไม่ทราบสถานะ
                  </span>
                )}
              </div>
              {doc.external_url && doc.external_url !== '#' && (
                <a href={doc.external_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-500 hover:underline flex items-center gap-1">
                  เปิด ↗
                </a>
              )}
            </div>
          </div>
        ))}
        {docs.length === 0 && <p className="text-[10px] text-center text-slate-400 py-2">ยังไม่มีเอกสาร</p>}
      </div>

      {activeOCRDoc && (
        <OCRProcessorModal 
          doc={activeOCRDoc.doc} 
          initialFile={activeOCRDoc.file}
          onClose={() => setActiveOCRDoc(null)} 
          onComplete={fetchDocs} 
        />
      )}
    </div>
  )
}
