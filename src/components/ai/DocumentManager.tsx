'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Link as LinkIcon, Trash2, ExternalLink, Cloud } from 'lucide-react'

interface DocumentManagerProps {
  scope: 'global' | 'project'
  selectedProjectId?: string
  onUpdate?: () => void
}

export function DocumentManager({ scope, selectedProjectId, onUpdate }: DocumentManagerProps) {
  const [docs, setDocs] = useState<any[]>([])
  const [linkUrl, setLinkUrl] = useState('')
  const [docName, setDocName] = useState('')
  const [docType, setDocType] = useState('Google Drive')
  const [isProcessing, setIsProcessing] = useState(false)

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

  const handleLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!linkUrl || !docName) return
    setIsProcessing(true)
    try {
      await supabase.from('project_documents').insert({
        project_id: scope === 'project' ? selectedProjectId : null,
        doc_type: docType,
        source_type: 'link',
        external_url: linkUrl,
        file_name: docName,
        scope: scope,
        status: 'pending_ocr'
      })
      setLinkUrl('')
      setDocName('')
      fetchDocs()
    } catch (e: any) {
      alert('Error: ' + e.message)
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
    if (type === 'Google Drive') return <Cloud size={14} className="text-blue-500" />
    if (type === 'OneDrive') return <Cloud size={14} className="text-sky-500" />
    return <LinkIcon size={14} className="text-slate-500" />
  }

  return (
    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-[#252548]">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
          {scope === 'global' ? '📚 เอกสารกลาง (ใช้ทุกโครงการ)' : '📁 เอกสารเฉพาะโครงการ'}
        </span>
      </div>
      
      <form onSubmit={handleLinkSubmit} className="space-y-2 mb-4 bg-slate-50 dark:bg-[#14142a] p-3 rounded-lg border border-slate-200 dark:border-slate-700">
        <div className="text-[10px] font-bold text-slate-500 mb-1">
          {scope === 'global' ? '+ เพิ่มลิงก์เอกสารกลาง' : '+ เพิ่มลิงก์เอกสารโครงการนี้'}
        </div>
        <input 
          type="text" 
          placeholder="ชื่อเอกสาร (เช่น รายการประกอบแบบ กฟภ.)" 
          value={docName} 
          onChange={e => setDocName(e.target.value)} 
          className="w-full text-xs px-2 py-1.5 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-[#1a1a32]" 
          disabled={isProcessing} 
          required 
        />
        <div className="flex gap-2">
          <select 
            value={docType} 
            onChange={e => setDocType(e.target.value)} 
            className="text-xs px-2 py-1.5 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-[#1a1a32] text-slate-700 dark:text-slate-300 w-1/3"
            disabled={isProcessing}
          >
            <option value="Google Drive">Google Drive</option>
            <option value="OneDrive">OneDrive</option>
            <option value="Other">อื่นๆ</option>
          </select>
          <input 
            type="url" 
            placeholder="วาง URL ที่นี่" 
            value={linkUrl} 
            onChange={e => setLinkUrl(e.target.value)} 
            className="flex-1 text-xs px-2 py-1.5 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-[#1a1a32]" 
            disabled={isProcessing} 
            required 
          />
        </div>
        <button type="submit" disabled={isProcessing || !linkUrl || !docName} className="w-full py-1.5 mt-1 bg-primary-600 text-white rounded text-xs font-bold disabled:opacity-50 hover:bg-primary-700 transition-colors">
          บันทึกลิงก์
        </button>
      </form>

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
              <button onClick={() => handleDelete(doc.id)} className="text-slate-400 hover:text-red-500 flex-shrink-0" title="ลบเอกสาร"><Trash2 size={12} /></button>
            </div>
            
            <div className="flex items-center justify-between mt-1">
              <span className="text-[9px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                🔗 ลิงก์ (รอ OCR เฟส 2B)
              </span>
              <a href={doc.external_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-500 hover:underline flex items-center gap-1">
                เปิด ↗
              </a>
            </div>
          </div>
        ))}
        {docs.length === 0 && <p className="text-[10px] text-center text-slate-400 py-2">ยังไม่มีเอกสาร</p>}
      </div>
    </div>
  )
}
