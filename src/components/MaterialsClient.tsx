'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Package,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  X,
  FileText,
  CalendarDays,
  Download,
  Upload,
  FileSpreadsheet,
  AlertCircle,
  Printer,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import type { Project, ProjectMaterial, MaterialStatus } from '@/lib/types'
import { createMaterial, updateMaterial, deleteMaterial, importMaterials } from '@/app/actions/materials'
import type { UserSession } from '@/lib/auth'

const labelCls = 'text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5'
const inputCls =
  'w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#252548] bg-white dark:bg-[#14142a] text-sm font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500/40 transition-all'

interface Props {
  project: Project
  materials: ProjectMaterial[]
  user?: UserSession | null
}

type FilterStatus = 'all' | MaterialStatus

/* ─── helpers ─── */
function formatDate(d: string | null) {
  if (!d) return '—'
  const dt = new Date(d)
  return dt.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
}

const STATUS_META: Record<MaterialStatus, { label: string; badgeCls: string; iconCls: string }> = {
  pending: {
    label: 'รออนุมัติ',
    badgeCls: 'bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-500/30',
    iconCls: 'text-amber-500',
  },
  approved: {
    label: 'อนุมัติแล้ว',
    badgeCls: 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/30',
    iconCls: 'text-emerald-500',
  },
  rejected: {
    label: 'ปฏิเสธ',
    badgeCls: 'bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-300 dark:border-red-500/30',
    iconCls: 'text-red-500',
  },
}

function StatusIcon({ status }: { status: MaterialStatus }) {
  if (status === 'approved') return <CheckCircle2 size={13} className="text-emerald-500" />
  if (status === 'rejected') return <XCircle size={13} className="text-red-500" />
  return <Clock size={13} className="text-amber-500" />
}

/* ─── Add Modal ─── */
function AddMaterialModal({
  projectId,
  onClose,
}: {
  projectId: string
  onClose: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const router = useRouter()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    startTransition(async () => {
      const result = await createMaterial(projectId, new FormData(e.currentTarget))
      if (result?.error) {
        setError(result.error)
      } else {
        onClose()
        router.refresh()
      }
    })
  }

  return (
    <ModalShell title="เพิ่มรายการวัสดุ" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelCls}>ชื่อวัสดุ / สเปก <span className="text-red-500">*</span></label>
          <textarea
            name="name"
            rows={2}
            placeholder="เช่น เหล็กเส้น SD40 ขนาด 16 มม. (ตาม มอก.24-2548)"
            className={`${inputCls} resize-none`}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>เลขที่เอกสาร</label>
            <input name="submission_no" type="text" placeholder="MAT-2026-001" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>วันที่ยื่น</label>
            <input name="submitted_date" type="date" className={inputCls} />
          </div>
        </div>
        {error && <p className="text-red-500 text-xs font-semibold">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary px-4 py-2 text-sm rounded-lg font-bold">
            ยกเลิก
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="btn-primary px-4 py-2 text-sm rounded-lg font-bold flex items-center gap-1.5"
          >
            <Plus size={14} />
            {isPending ? 'กำลังบันทึก...' : 'เพิ่มรายการ'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

/* ─── Edit Modal ─── */
function EditMaterialModal({
  material,
  projectId,
  onClose,
}: {
  material: ProjectMaterial
  projectId: string
  onClose: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [status, setStatus] = useState<MaterialStatus>(material.status)

  const router = useRouter()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const fd = new FormData(e.currentTarget)
    fd.set('status', status)
    startTransition(async () => {
      const result = await updateMaterial(material.id, projectId, fd)
      if (result?.error) {
        setError(result.error)
      } else {
        onClose()
        router.refresh()
      }
    })
  }

  return (
    <ModalShell title="แก้ไขรายการวัสดุ" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelCls}>ชื่อวัสดุ / สเปก <span className="text-red-500">*</span></label>
          <textarea
            name="name"
            rows={2}
            defaultValue={material.name}
            className={`${inputCls} resize-none`}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>เลขที่เอกสาร</label>
            <input name="submission_no" type="text" defaultValue={material.submission_no || ''} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>วันที่ยื่น</label>
            <input name="submitted_date" type="date" defaultValue={material.submitted_date || ''} className={inputCls} />
          </div>
        </div>

        {/* Status selector */}
        <div>
          <label className={labelCls}>สถานะ</label>
          <div className="grid grid-cols-3 gap-2 mt-1.5">
            {(['pending', 'approved', 'rejected'] as MaterialStatus[]).map((s) => {
              const meta = STATUS_META[s]
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`py-2 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    status === s
                      ? meta.badgeCls + ' ring-2 ring-offset-1 ring-current'
                      : 'border-slate-200 dark:border-[#252548] text-slate-500 hover:border-slate-300'
                  }`}
                >
                  <StatusIcon status={s} />
                  {meta.label}
                </button>
              )
            })}
          </div>
        </div>

        {status === 'approved' && (
          <div>
            <label className={labelCls}>วันที่อนุมัติ</label>
            <input
              name="approved_date"
              type="date"
              defaultValue={material.approved_date || ''}
              className={inputCls}
            />
          </div>
        )}

        <div>
          <label className={labelCls}>หมายเหตุ</label>
          <textarea
            name="note"
            rows={2}
            defaultValue={material.note || ''}
            placeholder="บันทึกเพิ่มเติม เช่น ยี่ห้อที่อนุมัติ / เหตุผลที่ปฏิเสธ"
            className={`${inputCls} resize-none`}
          />
        </div>

        {error && <p className="text-red-500 text-xs font-semibold">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary px-4 py-2 text-sm rounded-lg font-bold">
            ยกเลิก
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="btn-primary px-4 py-2 text-sm rounded-lg font-bold flex items-center gap-1.5"
          >
            <CheckCircle2 size={14} />
            {isPending ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

/* ─── Modal Shell ─── */
function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="card rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-[#1e1e38]">
          <h2 className="text-base font-black text-slate-900 dark:text-white">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-[#1e1e38] transition-all"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

/* ─── Import Excel Modal ─── */
function ImportExcelModal({
  projectId,
  onClose,
}: {
  projectId: string
  onClose: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [parsedRows, setParsedRows] = useState<Array<{ name: string; submission_no: string; submitted_date: string; error?: string }>>([])
  const [dragActive, setDragActive] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // 1. Download template utility
  const handleDownloadTemplate = () => {
    const wb = XLSX.utils.book_new()
    const data = [
      {
        'ชื่อวัสดุ / รายการ (ห้ามเว้นว่าง)': 'เหล็กเส้น SD40 ขนาด 16 มม. (ตัวอย่าง)',
        'เลขที่เอกสาร': 'MAT-2026-001 (ตัวอย่าง)',
        'วันที่ยื่น (ปี-เดือน-วัน)': '2026-07-29',
      },
      {
        'ชื่อวัสดุ / รายการ (ห้ามเว้นว่าง)': 'คอนกรีตผสมเสร็จ 320 ksc (ตัวอย่าง)',
        'เลขที่เอกสาร': 'MAT-2026-002 (ตัวอย่าง)',
        'วันที่ยื่น (ปี-เดือน-วัน)': '2026-08-01',
      }
    ]
    const ws = XLSX.utils.json_to_sheet(data)
    
    ws['!cols'] = [
      { wch: 45 },
      { wch: 25 },
      { wch: 25 }
    ]

    XLSX.utils.book_append_sheet(wb, ws, 'Materials Template')
    XLSX.writeFile(wb, 'material_import_template.xlsx')
  }

  // 2. Parse uploaded file
  const processFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const bstr = e.target?.result
        const wb = XLSX.read(bstr, { type: 'binary' })
        const wsName = wb.SheetNames[0]
        const ws = wb.Sheets[wsName]
        const rawJson = XLSX.utils.sheet_to_json<any>(ws, { defval: '' })

        if (!rawJson || rawJson.length === 0) {
          setErrorMessage('ไม่พบข้อมูลรายการวัสดุในไฟล์ Excel')
          return
        }

        const validated = rawJson.map((row: any) => {
          const keys = Object.keys(row)
          const nameKey = keys.find(k => k.includes('ชื่อ') || k.includes('รายการ') || k.toLowerCase().includes('name')) || keys[0]
          const subNoKey = keys.find(k => k.includes('เลขที่') || k.toLowerCase().includes('submission') || k.toLowerCase().includes('no')) || keys[1]
          const dateKey = keys.find(k => k.includes('วัน') || k.toLowerCase().includes('date')) || keys[2]

          const name = String(row[nameKey] || '').trim()
          const submission_no = String(row[subNoKey] || '').trim()
          let submitted_date = String(row[dateKey] || '').trim()

          if (submitted_date && !isNaN(Number(submitted_date))) {
            const dateObj = new Date((Number(submitted_date) - 25569) * 86400 * 1000)
            if (!isNaN(dateObj.getTime())) {
              submitted_date = dateObj.toISOString().split('T')[0]
            }
          }

          let rowError = ''
          if (!name) {
            rowError = 'กรุณาระบุชื่อวัสดุ'
          }

          return {
            name,
            submission_no: submission_no.includes('(ตัวอย่าง)') ? '' : submission_no,
            submitted_date: submitted_date.includes('(ตัวอย่าง)') ? '' : submitted_date,
            error: rowError
          }
        }).filter(r => !r.name.includes('(ตัวอย่าง)'))

        setParsedRows(validated)
        setErrorMessage('')
      } catch (err: any) {
        setErrorMessage('เกิดข้อผิดพลาดในการวิเคราะห์ไฟล์ Excel: ' + err.message)
      }
    }
    reader.readAsBinaryString(file)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }

  // 3. Edit cells inline
  const handleCellChange = (index: number, field: 'name' | 'submission_no' | 'submitted_date', value: string) => {
    setParsedRows(prev => {
      const updated = [...prev]
      updated[index] = {
        ...updated[index],
        [field]: value,
        error: field === 'name' && !value.trim() ? 'กรุณาระบุชื่อวัสดุ' : ''
      }
      return updated
    })
  }

  const handleDeleteRow = (index: number) => {
    setParsedRows(prev => prev.filter((_, idx) => idx !== index))
  }

  const handleAddRow = () => {
    setParsedRows(prev => [...prev, { name: '', submission_no: '', submitted_date: '', error: 'กรุณาระบุชื่อวัสดุ' }])
  }

  const router = useRouter()

  // 4. Save
  const handleSave = () => {
    if (parsedRows.length === 0) return
    const hasErrors = parsedRows.some(r => !!r.error)
    if (hasErrors) return

    startTransition(async () => {
      const res = await importMaterials(projectId, parsedRows)
      if (res?.error) {
        setErrorMessage(res.error)
      } else {
        onClose()
        router.refresh()
      }
    })
  }

  const hasAnyErrors = parsedRows.some(r => !!r.error)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="card rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-[#1e1e38]">
          <div className="flex items-center gap-2">
            <Upload size={18} className="text-primary-500" />
            <h2 className="text-base font-black text-slate-900 dark:text-white">นำเข้าข้อมูลวัสดุจาก Excel</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-[#1e1e38] transition-all"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Container */}
        <div className="p-6 flex-1 overflow-y-auto space-y-5">
          {/* Download Template Banner */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5">
            <div className="flex items-center gap-3">
              <Download className="text-slate-450 dark:text-slate-300" size={20} />
              <div>
                <p className="text-xs font-black text-slate-800 dark:text-slate-200">แบบฟอร์มบันทึกข้อมูลมาตรฐาน</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">ใช้กรอกข้อมูลวัสดุเพื่อให้ระบบดึงข้อมูลรายข้อได้โดยอัตโนมัติ</p>
              </div>
            </div>
            <button
              onClick={handleDownloadTemplate}
              className="btn-secondary px-3.5 py-1.5 text-xs rounded-lg font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Download size={13} />
              ดาวน์โหลดฟอร์ม Excel
            </button>
          </div>

          {/* Drag & Drop Upload Zone */}
          {parsedRows.length === 0 && (
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                dragActive
                  ? 'border-primary-500 bg-primary-500/5'
                  : 'border-slate-300 dark:border-white/10 hover:border-slate-400 dark:hover:border-white/20'
              }`}
              onClick={() => document.getElementById('excel-file-input')?.click()}
            >
              <input
                id="excel-file-input"
                type="file"
                accept=".xlsx, .xls"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center mb-3">
                <Upload className="text-slate-400 dark:text-slate-300" size={22} />
              </div>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">ลากและวางไฟล์ Excel (.xlsx) ที่นี่</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">หรือคลิกเพื่อเลือกไฟล์จากคอมพิวเตอร์ของคุณ</p>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-xs font-semibold">
              <AlertCircle size={14} />
              {errorMessage}
            </div>
          )}

          {/* Preview Table Section */}
          {parsedRows.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  รายการวิเคราะห์พบ ({parsedRows.length} รายการ)
                </p>
                <button
                  onClick={handleAddRow}
                  className="btn-secondary px-3 py-1.5 text-xs rounded-lg font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus size={13} />
                  เพิ่มแถวใหม่
                </button>
              </div>

              <div className="border border-slate-200 dark:border-[#1e1e38] rounded-xl overflow-hidden shadow-inner">
                <div className="overflow-x-auto max-h-[40vh]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-[#14142a] text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-[#1c1c34]">
                        <th className="py-2.5 px-3 w-10 text-center">#</th>
                        <th className="py-2.5 px-3 min-w-[250px]">ชื่อวัสดุ / รายการสเปค <span className="text-red-500">*</span></th>
                        <th className="py-2.5 px-3 w-40">เลขที่เอกสาร</th>
                        <th className="py-2.5 px-3 w-36">วันที่ยื่น</th>
                        <th className="py-2.5 px-3 w-12 text-center">ลบ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-[#1e1e38]">
                      {parsedRows.map((row, index) => (
                        <tr
                          key={index}
                          className={`hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors ${
                            row.error ? 'bg-red-500/5 dark:bg-red-500/10' : ''
                          }`}
                        >
                          <td className="py-2 px-3 text-center text-slate-400 font-mono">{index + 1}</td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={row.name}
                              onChange={(e) => handleCellChange(index, 'name', e.target.value)}
                              className={`w-full px-2.5 py-1.5 rounded-lg border text-xs bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary-500 ${
                                row.error ? 'border-red-400 focus:ring-red-400' : 'border-slate-200 dark:border-[#252548]'
                              }`}
                              placeholder="กรอกชื่อวัสดุ..."
                            />
                            {row.error && <p className="text-[10px] text-red-500 font-semibold mt-0.5 pl-1">{row.error}</p>}
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={row.submission_no}
                              onChange={(e) => handleCellChange(index, 'submission_no', e.target.value)}
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-[#252548] text-xs bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
                              placeholder="เช่น MAT-001"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="date"
                              value={row.submitted_date}
                              onChange={(e) => handleCellChange(index, 'submitted_date', e.target.value)}
                              className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-[#252548] text-xs bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary-500 font-mono"
                            />
                          </td>
                          <td className="py-2 px-3 text-center">
                            <button
                              onClick={() => handleDeleteRow(index)}
                              className="text-slate-450 hover:text-red-500 p-1.5 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-100 dark:border-[#1e1e38] flex justify-end gap-2 bg-slate-50 dark:bg-[#14142a]">
          {parsedRows.length > 0 && (
            <button
              onClick={() => setParsedRows([])}
              className="btn-secondary px-4 py-2 text-sm rounded-lg font-bold flex items-center gap-1.5 cursor-pointer mr-auto"
            >
              เคลียร์ข้อมูล
            </button>
          )}
          <button
            onClick={onClose}
            className="btn-secondary px-4 py-2 text-sm rounded-lg font-bold flex items-center gap-1.5 cursor-pointer"
          >
            ยกเลิก
          </button>
          <button
            onClick={handleSave}
            disabled={isPending || parsedRows.length === 0 || hasAnyErrors}
            className={`btn-primary px-4 py-2 text-sm rounded-lg font-bold flex items-center gap-1.5 cursor-pointer ${
              hasAnyErrors || parsedRows.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <CheckCircle2 size={14} />
            {isPending ? 'กำลังนำเข้า...' : `นำเข้า ${parsedRows.length} รายการ`}
          </button>
        </div>

      </div>
    </div>
  )
}

/* ─── Main Component ─── */
export function MaterialsClient({ project, materials, user }: Props) {
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [editingMaterial, setEditingMaterial] = useState<ProjectMaterial | null>(null)
  const [isPending, startTransition] = useTransition()

  const counts = useMemo(
    () => ({
      all: materials.length,
      pending: materials.filter((m) => m.status === 'pending').length,
      approved: materials.filter((m) => m.status === 'approved').length,
      rejected: materials.filter((m) => m.status === 'rejected').length,
    }),
    [materials]
  )

  const filtered = useMemo(() => {
    if (filterStatus === 'all') return materials
    return materials.filter((m) => m.status === filterStatus)
  }, [materials, filterStatus])

  const router = useRouter()

  function handleDelete(id: string) {
    if (!confirm('ลบรายการนี้ออกจากระบบ?')) return
    startTransition(async () => {
      await deleteMaterial(id, project.id)
      router.refresh()
    })
  }

  function handlePrintMaterials() {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const rowsHtml = filtered.map((mat, idx) => {
      const meta = STATUS_META[mat.status]
      
      let statusStyle = ''
      if (mat.status === 'pending') statusStyle = 'background-color: #fef3c7; color: #b45309; border: 1px solid #fcd34d;'
      else if (mat.status === 'approved') statusStyle = 'background-color: #d1fae5; color: #047857; border: 1px solid #6ee7b7;'
      else if (mat.status === 'rejected') statusStyle = 'background-color: #fee2e2; color: #dc2626; border: 1px solid #fca5a5;'

      return `
        <tr class="mat-row">
          <td class="col-num">${idx + 1}</td>
          <td class="col-name">${mat.name}</td>
          <td class="col-sub">${mat.submission_no || '—'}</td>
          <td class="col-date">${formatDate(mat.submitted_date)}</td>
          <td class="col-date">${formatDate(mat.approved_date)}</td>
          <td class="col-status">
            <span class="status-badge" style="${statusStyle}">
              ${meta.label}
            </span>
          </td>
          <td class="col-note">${mat.note || '—'}</td>
        </tr>
      `
    }).join('')

    const html = `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<title>รายการวัสดุ - ${project.name}</title>
<style>
  @page { size: A4 portrait; margin: 15mm; }
  @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Sarabun', sans-serif; font-size: 12px; color: #1e293b; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  
  .page-header { margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #6366f1; }
  .proj-name { font-size: 18px; font-weight: 700; color: #1e293b; }
  .proj-sub { font-size: 13px; color: #64748b; margin-top: 4px; }
  
  .mat-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .mat-table thead { display: table-header-group; }
  .mat-table tr { page-break-inside: avoid; }
  .mat-table th { font-size: 12px; font-weight: 700; color: #64748b; background: #f8fafc; border-bottom: 2px solid #e2e8f0; padding: 8px 6px; text-align: left; }
  .mat-table th:first-child, .col-num { text-align: center; }
  
  .mat-row td { border-bottom: 1px solid #f1f5f9; padding: 8px 6px; font-size: 12px; vertical-align: top; word-break: break-word; }
  .col-name { font-weight: 600; color: #0f172a; }
  .status-badge { display: inline-block; padding: 3px 8px; border-radius: 9999px; font-size: 11px; font-weight: 700; }
  
  @media print {
    body { background: white; }
  }
</style>
</head>
<body>
  <div class="page-header">
    <div class="proj-name">${project.name || 'โครงการ'}</div>
    <div class="proj-sub">รายการจัดการวัสดุและการอนุมัติ ${filterStatus !== 'all' ? '(กรอง: ' + STATUS_META[filterStatus as MaterialStatus].label + ')' : ''}</div>
  </div>
  <table class="mat-table">
    <thead>
      <tr>
        <th style="width: 5%;">#</th>
        <th style="width: 30%;">ชื่อวัสดุ / สเปค</th>
        <th style="width: 15%;">เลขที่เอกสาร</th>
        <th style="width: 10%;">วันที่ยื่น</th>
        <th style="width: 10%;">วันที่อนุมัติ</th>
        <th style="width: 12%;">สถานะ</th>
        <th style="width: 18%;">หมายเหตุ</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <script>
    window.onload = () => { setTimeout(() => { window.print(); window.close(); }, 500); }
  </script>
</body>
</html>`

    printWindow.document.write(html)
    printWindow.document.close()
  }

  return (
    <>
      <div className="space-y-5">

        {/* ── Summary Banner ── */}
        {counts.pending > 0 ? (
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={20} className="text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-base font-black text-amber-700 dark:text-amber-400">
                มีวัสดุที่รออนุมัติอีก {counts.pending} รายการ
              </p>
              <p className="text-xs text-amber-600/80 dark:text-amber-400/70 font-medium mt-0.5">
                กรุณาติดตามและเร่งรัดการอนุมัติเพื่อไม่ให้งานล่าช้า
              </p>
            </div>
          </div>
        ) : materials.length > 0 ? (
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/25">
            <CheckCircle2 size={22} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <p className="text-base font-black text-emerald-700 dark:text-emerald-400">
              วัสดุทุกรายการได้รับการพิจารณาครบแล้ว ✅
            </p>
          </div>
        ) : null}

        {/* ── Top Controls ── */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {/* Filter tabs */}
          <div className="flex gap-1.5 flex-wrap">
            {(
              [
                { key: 'all', label: 'ทั้งหมด', count: counts.all, cls: 'bg-slate-100 dark:bg-[#1e1e38] text-slate-600 dark:text-slate-300' },
                { key: 'pending', label: 'รออนุมัติ', count: counts.pending, cls: 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-500/30' },
                { key: 'approved', label: 'อนุมัติแล้ว', count: counts.approved, cls: 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20' },
                { key: 'rejected', label: 'ปฏิเสธ', count: counts.rejected, cls: 'bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20' },
              ] as const
            ).map(({ key, label, count, cls }) => (
              <button
                key={key}
                onClick={() => setFilterStatus(key)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  filterStatus === key
                    ? cls + ' ring-2 ring-offset-1 ring-current shadow-sm'
                    : 'bg-slate-100 dark:bg-[#1e1e38] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                {label}
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                  filterStatus === key ? 'bg-white/40' : 'bg-slate-200 dark:bg-[#252548] text-slate-600 dark:text-slate-400'
                }`}>
                  {count}
                </span>
              </button>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handlePrintMaterials}
              className="btn-secondary flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold flex-shrink-0 cursor-pointer bg-white dark:bg-[#14142a] border border-slate-200 dark:border-[#252548]"
            >
              <Printer size={15} className="text-primary-600 dark:text-primary-500" />
              พิมพ์รายการวัสดุ
            </button>
            {user && (user.role === 'admin' || user.role === 'editor') && (
              <>
                <button
                  id="import-excel-btn"
                  onClick={() => setShowImportModal(true)}
                  className="btn-secondary flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold flex-shrink-0 cursor-pointer"
                >
                  <FileSpreadsheet size={15} className="text-emerald-600 dark:text-emerald-500" />
                  นำเข้าจาก Excel
                </button>
                <button
                  id="add-material-btn"
                  onClick={() => setShowAddModal(true)}
                  className="btn-primary flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold flex-shrink-0 cursor-pointer"
                >
                  <Plus size={15} />
                  เพิ่มรายการวัสดุ
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── Table ── */}
        <div className="card rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-[#14142a] text-slate-400 dark:text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-200 dark:border-[#1c1c34]">
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4 min-w-64">ชื่อวัสดุ / สเปค</th>
                  <th className="py-3 px-4 w-36">เลขที่เอกสาร</th>
                  <th className="py-3 px-4 w-28">วันที่ยื่น</th>
                  <th className="py-3 px-4 w-28">วันที่อนุมัติ</th>
                  <th className="py-3 px-4 w-32 text-center">สถานะ</th>
                  <th className="py-3 px-4 min-w-40">หมายเหตุ</th>
                  <th className="py-3 px-4 w-24 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#1e1e38] text-slate-700 dark:text-slate-300">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Package size={32} className="text-slate-300 dark:text-slate-600" />
                        <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
                          {filterStatus === 'all' ? 'ยังไม่มีรายการวัสดุ' : `ไม่มีรายการที่ "${STATUS_META[filterStatus as MaterialStatus]?.label ?? filterStatus}"`}
                        </p>
                        {filterStatus === 'all' && (
                          <p className="text-xs text-slate-400">กดปุ่ม "+ เพิ่มรายการวัสดุ" เพื่อเริ่มต้น</p>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((mat, idx) => {
                    const meta = STATUS_META[mat.status]
                    return (
                      <tr
                        key={mat.id}
                        className={`hover:bg-slate-50/60 dark:hover:bg-[#14142a]/40 transition-colors ${
                          mat.status === 'pending' ? 'bg-amber-50/30 dark:bg-amber-500/5' : ''
                        }`}
                      >
                        <td className="py-3 px-4 text-center text-slate-400 font-mono text-xs">{idx + 1}</td>
                        <td className="py-3 px-4">
                          <p className="font-semibold text-slate-800 dark:text-slate-200 leading-snug">{mat.name}</p>
                        </td>
                        <td className="py-3 px-4">
                          {mat.submission_no ? (
                            <span className="flex items-center gap-1.5 text-xs font-mono text-primary-600 dark:text-primary-400">
                              <FileText size={11} />
                              {mat.submission_no}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs font-medium text-slate-500">
                          {mat.submitted_date ? (
                            <span className="flex items-center gap-1">
                              <CalendarDays size={11} className="text-slate-400" />
                              {formatDate(mat.submitted_date)}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="py-3 px-4 text-xs font-medium text-slate-500">
                          {mat.approved_date ? (
                            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                              <CalendarDays size={11} />
                              {formatDate(mat.approved_date)}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border ${meta.badgeCls}`}>
                            <StatusIcon status={mat.status} />
                            {meta.label}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-500 dark:text-slate-400 max-w-xs">
                          {mat.note || '—'}
                        </td>
                        <td className="py-3 px-4">
                          {user && (user.role === 'admin' || user.role === 'editor') ? (
                            <div className="flex items-center justify-center gap-1">
                              <button
                                id={`edit-material-${mat.id}`}
                                onClick={() => setEditingMaterial(mat)}
                                className="w-7 h-7 rounded-lg border border-slate-200 dark:border-[#252548] bg-slate-50 dark:bg-[#14142a] flex items-center justify-center text-slate-500 hover:text-primary-600 dark:hover:text-primary-400 hover:border-primary-300 transition-all cursor-pointer"
                              >
                                <Pencil size={11} />
                              </button>
                              <button
                                id={`delete-material-${mat.id}`}
                                onClick={() => handleDelete(mat.id)}
                                disabled={isPending}
                                className="w-7 h-7 rounded-lg border border-slate-200 dark:border-[#252548] bg-slate-50 dark:bg-[#14142a] flex items-center justify-center text-slate-400 hover:text-red-500 hover:border-red-300 transition-all cursor-pointer"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          ) : (
                            <div className="text-center text-slate-400 font-bold">—</div>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {filtered.length > 0 && (
            <div className="px-4 py-3 border-t border-slate-100 dark:border-[#1e1e38] flex items-center justify-between text-xs text-slate-400">
              <span>แสดง {filtered.length} จาก {materials.length} รายการ</span>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1"><Clock size={11} className="text-amber-500" /> รออนุมัติ {counts.pending}</span>
                <span className="flex items-center gap-1"><CheckCircle2 size={11} className="text-emerald-500" /> อนุมัติ {counts.approved}</span>
                <span className="flex items-center gap-1"><XCircle size={11} className="text-red-500" /> ปฏิเสธ {counts.rejected}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      {showAddModal && (
        <AddMaterialModal projectId={project.id} onClose={() => setShowAddModal(false)} />
      )}
      {showImportModal && (
        <ImportExcelModal projectId={project.id} onClose={() => setShowImportModal(false)} />
      )}
      {editingMaterial && (
        <EditMaterialModal
          material={editingMaterial}
          projectId={project.id}
          onClose={() => setEditingMaterial(null)}
        />
      )}
    </>
  )
}
