'use client'

import { useState, useTransition } from 'react'
import {
  ClipboardCheck,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  XCircle,
  X,
  FileText,
  CalendarDays,
  Image as ImageIcon,
  ArrowUp,
  ArrowDown,
  UploadCloud,
  Send,
  Printer,
} from 'lucide-react'
import type { Project, Inspection, InspectionStatus, ReportPhoto } from '@/lib/types'
import { createInspection, updateInspection, deleteInspection, updateInspectionsOrder, uploadReportPhoto } from '@/app/actions/reports'

import type { UserSession } from '@/lib/auth'

interface Props {
  project: Project
  data: Inspection[]
  user?: UserSession | null
}

const STATUS_META: Record<InspectionStatus, { label: string; badgeCls: string; iconCls: string }> = {
  submitted: {
    label: 'ส่งขอตรวจ',
    badgeCls: 'bg-sky-100 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-300 dark:border-sky-500/30',
    iconCls: 'text-sky-500',
  },
  pending: {
    label: 'รอตรวจสอบ',
    badgeCls: 'bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-500/30',
    iconCls: 'text-amber-500',
  },
  approved: {
    label: 'ผ่าน',
    badgeCls: 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/30',
    iconCls: 'text-emerald-500',
  },
  rejected: {
    label: 'ไม่ผ่าน',
    badgeCls: 'bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-300 dark:border-red-500/30',
    iconCls: 'text-red-500',
  },
}

function StatusIcon({ status }: { status: InspectionStatus }) {
  if (status === 'approved') return <CheckCircle2 size={13} className="text-emerald-500" />
  if (status === 'rejected') return <XCircle size={13} className="text-red-500" />
  if (status === 'submitted') return <Send size={13} className="text-sky-500" />
  return <Clock size={13} className="text-amber-500" />
}

export function InspectionsTab({ project, data, user }: Props) {
  const [items, setItems] = useState<Inspection[]>(data)
  const [selectedId, setSelectedId] = useState<string | null>(data.length > 0 ? data[0].id : null)
  const [selectedIds, setSelectedIds] = useState<string[]>(data.map(d => d.id))
  const [isPending, startTransition] = useTransition()
  const [isCreating, setIsCreating] = useState(false)

  // Sync state if props change (revalidation)
  if (JSON.stringify(data) !== JSON.stringify(items) && !isPending) {
    setItems(data)
    if (!selectedId && data.length > 0) setSelectedId(data[0].id)
    setSelectedIds(data.map(d => d.id))
  }

  const selectedItem = items.find((i) => i.id === selectedId) || null

  const handleMove = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === items.length - 1) return

    const newItems = [...items]
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    const temp = newItems[index]
    newItems[index] = newItems[swapIndex]
    newItems[swapIndex] = temp

    // Update sort_order based on new position
    const updates = newItems.map((item, idx) => ({ id: item.id, sort_order: idx + 1 }))

    setItems(newItems)
    startTransition(async () => {
      await updateInspectionsOrder(project.id, updates)
    })
  }

  const handleDelete = (id: string) => {
    if (!confirm('ลบใบขอตรวจงานนี้ออกจากระบบ?')) return
    startTransition(async () => {
      await deleteInspection(id, project.id)
      if (selectedId === id) setSelectedId(null)
    })
  }

  const handleCreateNew = () => {
    setIsCreating(true)
    setSelectedId(null)
  }

  const handlePrint = (singleItem?: Inspection) => {
    const originalSelected = [...selectedIds]
    if (singleItem) {
      setSelectedIds([singleItem.id])
    }
    setTimeout(() => {
      window.print()
      if (singleItem) {
        setSelectedIds(originalSelected)
      }
    }, 100)
  }

  const getNextInspectionNo = () => {
    if (items.length === 0) return 'INSP-001'
    let maxNum = 0
    let prefix = 'INSP-'
    let padding = 3

    for (const item of items) {
      if (item.inspection_no) {
        const match = item.inspection_no.match(/^(.*?)(\d+)$/)
        if (match) {
          const num = parseInt(match[2], 10)
          if (num > maxNum) {
            maxNum = num
            prefix = match[1]
            padding = Math.max(3, match[2].length)
          }
        }
      }
    }
    
    if (maxNum === 0) return 'INSP-001'
    return `${prefix}${String(maxNum + 1).padStart(padding, '0')}`
  }

  return (
    <>
      <div className="flex h-[calc(100vh-180px)] gap-4 print:hidden">
      {/* ── Left Sidebar (List of Inspections) ── */}
      <div className="w-1/3 min-w-[300px] flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-900 dark:text-white">ใบขอตรวจสอบคุณภาพ</h2>
          {user && (user.role === 'admin' || user.role === 'editor') && (
            <button
              onClick={handleCreateNew}
              className="w-8 h-8 rounded-lg bg-primary-600 text-white flex items-center justify-center hover:bg-primary-700 transition-colors shadow-sm shadow-primary-500/20 cursor-pointer"
            >
              <Plus size={16} />
            </button>
          )}
        </div>

        {items.length > 0 && (
          <div className="flex items-center justify-between py-1 px-2.5 bg-slate-50 dark:bg-[#1e1e38]/50 rounded-xl border border-slate-200 dark:border-[#252548] shadow-sm">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedIds.length === items.length && items.length > 0}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedIds(items.map(i => i.id))
                  } else {
                    setSelectedIds([])
                  }
                }}
                className="w-4 h-4 rounded text-primary-600 border-slate-300 dark:border-slate-700 focus:ring-primary-500 cursor-pointer"
              />
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                เลือกทั้งหมด ({items.length} รายการ)
              </span>
            </div>

            <button
              onClick={() => handlePrint()}
              disabled={selectedIds.length === 0}
              className="text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:text-primary-600 dark:hover:text-primary-400 flex items-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <Printer size={12} /> พิมพ์รายงาน
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto pr-2 space-y-2">
          {items.length === 0 && !isCreating ? (
            <div className="text-center py-10 bg-slate-50 dark:bg-[#14142a] rounded-2xl border border-slate-200 dark:border-[#252548]">
              <ClipboardCheck size={24} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-xs font-bold text-slate-500">ยังไม่มีรายการตรวจสอบ</p>
            </div>
          ) : (
            <>
              {isCreating && (
                <div className="p-3 rounded-xl border-2 border-primary-500 bg-primary-50 dark:bg-primary-500/10 cursor-pointer">
                  <p className="text-sm font-bold text-primary-700 dark:text-primary-400">📝 กำลังสร้างใบตรวจใหม่...</p>
                </div>
              )}
              {items.map((item, idx) => {
                const meta = STATUS_META[item.status]
                const isChecked = selectedIds.includes(item.id)
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      setSelectedId(item.id)
                      setIsCreating(false)
                    }}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center gap-3 ${
                      selectedId === item.id
                        ? 'border-primary-500 bg-white dark:bg-[#1e1e38] shadow-sm ring-1 ring-primary-500/20'
                        : 'border-slate-200 dark:border-[#252548] bg-slate-50 dark:bg-[#14142a] hover:border-slate-300'
                    }`}
                  >
                    <div onClick={(e) => e.stopPropagation()} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds([...selectedIds, item.id])
                          } else {
                            setSelectedIds(selectedIds.filter(id => id !== item.id))
                          }
                        }}
                        className="w-4 h-4 rounded text-primary-600 border-slate-300 dark:border-slate-700 focus:ring-primary-500 cursor-pointer"
                      />
                    </div>
                    <div className="flex flex-col items-center gap-0.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleMove(idx, 'up')
                        }}
                        disabled={idx === 0 || isPending}
                        className="p-1 text-slate-300 hover:text-primary-500 disabled:opacity-30"
                      >
                        <ArrowUp size={12} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleMove(idx, 'down')
                        }}
                        disabled={idx === items.length - 1 || isPending}
                        className="p-1 text-slate-300 hover:text-primary-500 disabled:opacity-30"
                      >
                        <ArrowDown size={12} />
                      </button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-1">
                        <p className="text-xs font-bold text-primary-600 dark:text-primary-400 truncate">
                          {item.inspection_no}
                        </p>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${meta.badgeCls}`}>
                          {meta.label}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate mt-1">
                        {item.title}
                      </p>
                      <p className="text-xs font-medium text-slate-500 truncate mt-0.5">
                        {item.work_type} • {item.request_date ? new Date(item.request_date).toLocaleDateString('th-TH') : '-'}
                      </p>
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </div>
      </div>

      {/* ── Right Content Panel (Form & Print Layout) ── */}
      <div className="flex-1 bg-white dark:bg-[#14142a] rounded-2xl border border-slate-200 dark:border-[#252548] overflow-hidden flex flex-col">
        {selectedItem || isCreating ? (
          <InspectionForm
            key={isCreating ? 'new' : selectedItem?.id}
            project={project}
            item={isCreating ? null : selectedItem}
            onClose={() => setIsCreating(false)}
            onDelete={handleDelete}
            onPrint={handlePrint}
            user={user}
            nextInspectionNo={getNextInspectionNo()}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <ClipboardCheck size={48} className="mb-4 opacity-20" />
            <p className="font-bold">เลือกรายการตรวจสอบเพื่อดูหรือแก้ไขข้อมูล</p>
          </div>
        )}
      </div>
    </div>

    {/* ── Batch Print Layout (Only visible during printing) ── */}
    <div className="hidden print:block space-y-6">
      <style type="text/css" media="print">{`
        @page {
          size: A4 portrait;
          margin: 8mm 6mm !important;
        }
        html, body {
          background-color: white !important;
          background: white !important;
          color: #0f172a !important;
          font-size: 10px !important;
          width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        header, nav, aside, footer, .print-hidden, .no-print {
          display: none !important;
        }
        .print-page {
          page-break-after: always !important;
          break-after: page !important;
          display: block !important;
        }
        .print-page:last-child {
          page-break-after: avoid !important;
          break-after: avoid !important;
        }
        table {
          width: 100% !important;
          border-collapse: collapse !important;
          font-size: 11px !important;
        }
        th, td {
          padding: 8px 6px !important;
          border: 1px solid black !important;
          color: black !important;
        }
        .print-photo-card {
          height: 185px !important;
          overflow: hidden !important;
          display: flex !important;
          flex-direction: column !important;
        }
        .print-photo-card img {
          flex: 1 !important;
          min-height: 0 !important;
          width: 100% !important;
          object-fit: cover !important;
        }
      `}</style>
      
      {items
        .filter((item) => selectedIds.includes(item.id))
        .map((item) => (
          <div key={item.id} className="insp-print-page pb-4">
            {/* --- PRINT HEADER --- */}
            <div className="text-center border-b-2 border-black pb-3 mb-4">
              <h1 className="text-lg font-black mb-1">ใบขอส่งตรวจสอบคุณภาพงาน (Inspection Report)</h1>
              <h2 className="text-xs font-bold text-slate-600">โครงการ: {project.name}</h2>
              <div className="flex justify-between mt-3 text-[10px] font-semibold text-slate-800">
                <span>เลขที่ใบตรวจ: {item.inspection_no}</span>
                <span>วันที่ขอตรวจ: {item.request_date ? new Date(item.request_date).toLocaleDateString('th-TH', { dateStyle: 'long' }) : '-'}</span>
              </div>
            </div>

            {/* --- PRINT TABLE --- */}
            <div className="mb-4">
              <table className="w-full text-left text-[11px] border-collapse border border-black">
                <tbody>
                  <tr>
                    <td className="border border-black p-2 font-bold w-1/4 bg-slate-100">เลขที่ใบขอตรวจ</td>
                    <td className="border border-black p-2 font-mono font-bold">{item.inspection_no}</td>
                  </tr>
                  <tr>
                    <td className="border border-black p-2 font-bold bg-slate-100">ประเภทงาน / หมวดงาน</td>
                    <td className="border border-black p-2">{item.work_type}</td>
                  </tr>
                  <tr>
                    <td className="border border-black p-2 font-bold bg-slate-100">หัวข้อที่ขอตรวจ</td>
                    <td className="border border-black p-2 font-semibold">{item.title}</td>
                  </tr>
                  <tr>
                    <td className="border border-black p-2 font-bold bg-slate-100">ผู้ตรวจสอบ / ผู้ควบคุม</td>
                    <td className="border border-black p-2">{item.inspector || '-'}</td>
                  </tr>
                  <tr>
                    <td className="border border-black p-2 font-bold bg-slate-100">สถานะการตรวจสอบ</td>
                    <td className="border border-black p-2 font-bold">
                      {STATUS_META[item.status].label}
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-black p-2 font-bold bg-slate-100">หมายเหตุ / ผลการตรวจ</td>
                    <td className="border border-black p-2 min-h-24 whitespace-pre-wrap leading-relaxed">{item.note || '-'}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* --- PHOTOS GRID --- */}
            {item.photo_urls && item.photo_urls.length > 0 && (
              <div className="insp-photo-section mt-2">
                <h4 className="text-[10px] font-bold text-black mb-1 flex-shrink-0">
                  รูปภาพประกอบการขอตรวจ (Photos)
                </h4>
                <div className="insp-photo-grid">
                  {item.photo_urls.map((pStr, idx) => {
                    const parts = pStr.split('|||')
                    const url = parts[0]
                    const caption = parts[1] || ''
                    return (
                      <div
                        key={idx}
                        className="insp-photo-card"
                      >
                        <img src={url} alt={`Inspection Photo ${idx + 1}`} />
                        {caption && (
                          <div className="insp-photo-caption">
                            {caption}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        ))}
    </div>
    </>
  )
}

/* ─── Inspection Form & Print Component ─── */
function InspectionForm({
  project,
  item,
  onClose,
  onDelete,
  onPrint,
  user,
  nextInspectionNo,
}: {
  project: Project
  item: Inspection | null
  onClose: () => void
  onDelete: (id: string) => void
  onPrint: (item: Inspection) => void
  user?: UserSession | null
  nextInspectionNo: string
}) {
  const [isPending, startTransition] = useTransition()
  const [status, setStatus] = useState<InspectionStatus>(item?.status || 'submitted')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  // Map database photo_urls (url|||caption) to ReportPhoto array
  const [photos, setPhotos] = useState<ReportPhoto[]>(() => {
    if (!item?.photo_urls) return []
    return item.photo_urls.map((pStr) => {
      const parts = pStr.split('|||')
      return {
        url: parts[0],
        caption: parts[1] || '',
      }
    })
  })

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    const rawFiles = Array.from(e.target.files)
    setUploading(true)
    setError('')
    try {
      const { compressImage } = await import('@/lib/image')
      const results = await Promise.all(
        rawFiles.map(async (rawFile) => {
          const file = await compressImage(rawFile)
          return uploadReportPhoto(file)
        })
      )
      const newPhotos = results
        .filter((res) => !res.error && res.url)
        .map((res) => ({ url: res.url!, caption: '' }))
      if (newPhotos.length > 0) setPhotos((prev) => [...prev, ...newPhotos])
      const errors = results.filter((res) => res.error).map((res) => res.error)
      if (errors.length > 0) setError(`อัปโหลดไม่สำเร็จ ${errors.length} รูป`)
    } catch (err: any) {
      setError(err.message || 'Upload failed')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    const fd = new FormData(e.currentTarget)
    fd.set('status', status)

    // Encode captions inside photo_urls array using ||| separator
    const photoUrlsToSave = photos.map((p) => `${p.url}|||${p.caption}`)

    startTransition(async () => {
      let result
      if (item) {
        result = await updateInspection(item.id, project.id, fd, photoUrlsToSave)
      } else {
        result = await createInspection(project.id, fd, photoUrlsToSave)
      }

      if (result?.error) {
        setError(result.error)
      } else {
        onClose()
      }
    })
  }

  const labelCls = 'text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5'
  const inputCls = 'w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#252548] bg-white dark:bg-[#1e1e38] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary-500/40 text-slate-800 dark:text-slate-200'

  return (
    <>
      <style type="text/css" media="print">{`
        @page { size: portrait; margin: 0.8cm; }
        
        /* Force paper white background and black text */
        html, body {
          background-color: white !important;
          background: white !important;
          color: #0f172a !important;
        }
        
        div, form, section, main, article, table, tr, td, th {
          background-color: white !important;
          background: white !important;
          color: #0f172a !important;
          border-color: #cbd5e1 !important;
        }

        p, span, label, input, textarea, h1, h2, h3, h4, th, td, select {
          font-size: 11px !important;
          color: #0f172a !important;
        }

        header, nav, aside, footer, button, .print-hidden { display: none !important; }
        .print-layout { display: block !important; }
      `}</style>

      <form onSubmit={handleSubmit} className="flex flex-col h-full print:block">
        {/* --- HEADER TOOLBAR (Hidden in Print) --- */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-[#1e1e38] print:hidden">
          <h3 className="text-base font-black text-slate-900 dark:text-white">
            {item ? 'แก้ไขใบตรวจสอบคุณภาพ' : 'สร้างใบตรวจสอบคุณภาพใหม่'}
          </h3>
          <div className="flex items-center gap-2">
            {item && (
              <button
                type="button"
                onClick={() => onPrint(item)}
                className="btn-secondary px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border-slate-200 cursor-pointer"
              >
                <Printer size={14} /> พิมพ์ใบตรวจสอบ
              </button>
            )}
            {item && user && (user.role === 'admin' || user.role === 'editor') && (
              <button
                type="button"
                onClick={() => onDelete(item.id)}
                disabled={isPending}
                className="btn-secondary px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 text-red-500 hover:bg-red-50 border-slate-200 cursor-pointer"
              >
                <Trash2 size={14} /> ลบ
              </button>
            )}
            {user && (user.role === 'admin' || user.role === 'editor') && (
              <button
                type="submit"
                disabled={isPending || uploading}
                className="btn-primary px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 size={14} /> บันทึก
              </button>
            )}
          </div>
        </div>

        {/* --- FORM CONTENT --- */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 print:overflow-visible print:p-0 print:space-y-4">
          {/* --- PRINT HEADER (Visible only in print) --- */}
          <div className="hidden print:block text-center border-b-2 border-black pb-3 mb-4">
            <h1 className="text-lg font-black mb-1">ใบขอส่งตรวจสอบคุณภาพงาน (Inspection Report)</h1>
            <h2 className="text-xs font-bold text-slate-600">โครงการ: {project.name}</h2>
            <div className="flex justify-between mt-3 text-[10px] font-semibold text-slate-800">
              <span>เลขที่ใบตรวจ: {item?.inspection_no || '-'}</span>
              <span>วันที่ขอตรวจ: {item?.request_date ? new Date(item.request_date).toLocaleDateString('th-TH', { dateStyle: 'long' }) : '-'}</span>
            </div>
          </div>

          {/* --- PRINT TABLE (Visible only in print) --- */}
          <div className="hidden print:block mb-4">
            <table className="w-full text-left text-[11px] border-collapse border border-black">
              <tbody>
                <tr>
                  <td className="border border-black p-2 font-bold w-1/4 bg-slate-100">เลขที่ใบขอตรวจ</td>
                  <td className="border border-black p-2 font-mono font-bold">{item?.inspection_no || '-'}</td>
                </tr>
                <tr>
                  <td className="border border-black p-2 font-bold bg-slate-100">ประเภทงาน / หมวดงาน</td>
                  <td className="border border-black p-2">{item?.work_type || '-'}</td>
                </tr>
                <tr>
                  <td className="border border-black p-2 font-bold bg-slate-100">หัวข้อที่ขอตรวจ</td>
                  <td className="border border-black p-2 font-semibold">{item?.title || '-'}</td>
                </tr>
                <tr>
                  <td className="border border-black p-2 font-bold bg-slate-100">ผู้ตรวจสอบ / ผู้ควบคุม</td>
                  <td className="border border-black p-2">{item?.inspector || '-'}</td>
                </tr>
                <tr>
                  <td className="border border-black p-2 font-bold bg-slate-100">สถานะการตรวจสอบ</td>
                  <td className="border border-black p-2 font-bold">
                    {item ? STATUS_META[item.status].label : '-'}
                  </td>
                </tr>
                <tr>
                  <td className="border border-black p-2 font-bold bg-slate-100">หมายเหตุ / ผลการตรวจ</td>
                  <td className="border border-black p-2 min-h-24 whitespace-pre-wrap leading-relaxed">{item?.note || '-'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* --- SCREEN INPUTS (Hidden in Print) --- */}
          <div className="space-y-4 print:hidden">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>เลขที่ใบขอตรวจ <span className="text-red-500">*</span></label>
                <input
                  name="inspection_no"
                  type="text"
                  defaultValue={item?.inspection_no || nextInspectionNo}
                  className={inputCls}
                  required
                  placeholder="เช่น INSP-001"
                />
              </div>
              <div>
                <label className={labelCls}>หมวดงาน <span className="text-red-500">*</span></label>
                <select name="work_type" defaultValue={item?.work_type || 'งานโครงสร้าง'} className={inputCls} required>
                  <option value="งานดิน/ฐานราก">งานดิน/ฐานราก</option>
                  <option value="งานโครงสร้าง">งานโครงสร้าง (เสา/คาน/พื้น)</option>
                  <option value="งานสถาปัตยกรรม">งานสถาปัตยกรรม</option>
                  <option value="งานระบบไฟฟ้า">งานระบบไฟฟ้า</option>
                  <option value="งานระบบประปา/สุขาภิบาล">งานระบบประปา/สุขาภิบาล</option>
                  <option value="อื่นๆ">อื่นๆ</option>
                </select>
              </div>
            </div>

            <div>
              <label className={labelCls}>หัวข้อที่ขอตรวจ <span className="text-red-500">*</span></label>
              <input
                name="title"
                type="text"
                defaultValue={item?.title || ''}
                className={inputCls}
                required
                placeholder="เช่น ตรวจสอบความถูกต้องของการผูกเหล็กคานคอดิน"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>วันที่ขอตรวจ</label>
                <input name="request_date" type="date" defaultValue={item?.request_date || ''} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>ชื่อผู้ควบคุมงาน / ผู้ตรวจสอบ</label>
                <input
                  name="inspector"
                  type="text"
                  defaultValue={item?.inspector || project.supervisor || ''}
                  className={inputCls}
                  placeholder="ระบุชื่อวิศวกรหรือผู้ตรวจ"
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>สถานะ</label>
              <div className="grid grid-cols-4 gap-2 mt-1.5">
                {(['submitted', 'pending', 'approved', 'rejected'] as InspectionStatus[]).map((s) => {
                  const meta = STATUS_META[s]
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatus(s)}
                      className={`py-2 rounded-xl border text-[11px] font-bold transition-all flex flex-col items-center justify-center gap-1 ${
                        status === s
                          ? meta.badgeCls + ' ring-2 ring-offset-1 ring-current'
                          : 'border-slate-200 dark:border-[#252548] text-slate-500 hover:border-slate-300 bg-slate-50 dark:bg-[#14142a]'
                      }`}
                    >
                      <StatusIcon status={s} />
                      {meta.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <label className={labelCls}>หมายเหตุ / ผลการตรวจ (Comment)</label>
              <textarea
                name="note"
                rows={3}
                defaultValue={item?.note || ''}
                className={`${inputCls} resize-none`}
                placeholder="ความคิดเห็นเพิ่มเติมจากผู้ตรวจ เช่น สิ่งที่ต้องแก้ไข..."
              />
            </div>

            {/* Photo Upload Trigger */}
            {user && (user.role === 'admin' || user.role === 'editor') && (
              <div className="border border-dashed border-slate-300 dark:border-[#252548] rounded-xl p-4 bg-slate-50 dark:bg-[#14142a]">
                <label className={labelCls}>รูปภาพประกอบ (อัปโหลดผ่าน Supabase Storage)</label>
                <label className="w-full h-20 rounded-lg border-2 border-dashed border-slate-300 dark:border-[#252548] flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 dark:hover:bg-[#1e1e38] transition-colors text-slate-400 hover:text-primary-500">
                  {uploading ? (
                    <span className="text-[10px] font-bold animate-pulse">กำลังอัปโหลด...</span>
                  ) : (
                    <>
                      <UploadCloud size={20} className="mb-1" />
                      <span className="text-[9px] font-bold">+ เพิ่มรูปภาพประกอบ (ไม่จำกัดจำนวน)</span>
                    </>
                  )}
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} disabled={uploading} />
                </label>
              </div>
            )}
          </div>

          {/* --- PHOTOS GRID (Visible on Screen & Print Layout) --- */}
          {photos.length > 0 && (
            <div className="mt-4 print:mt-2 print:page-break-inside-avoid">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-3 print:mb-2 print:text-[10px] print:text-black">
                รูปภาพประกอบการขอตรวจ (Photos)
              </h4>
              <div className="grid grid-cols-2 gap-4 print:gap-2">
                {photos.map((photo, idx) => (
                  <div
                    key={idx}
                    className="border border-slate-200 dark:border-[#252548] rounded-xl overflow-hidden print:border-black print:rounded-none flex flex-col aspect-video print:aspect-auto print:h-[185px] bg-slate-50 dark:bg-[#1a1a32]"
                  >
                    <div className="relative flex-1 min-h-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo.url} alt={`Inspection Photo ${idx + 1}`} className="w-full h-full object-cover" />
                      {user && (user.role === 'admin' || user.role === 'editor') && (
                        <button
                          type="button"
                          onClick={() => setPhotos((prev) => prev.filter((_, i) => i !== idx))}
                          className="absolute top-2 right-2 w-6 h-6 bg-black/60 text-white rounded-full flex items-center justify-center print:hidden hover:bg-red-500 transition-colors cursor-pointer"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                    <div className="p-1 bg-white dark:bg-[#1e1e38] print:bg-transparent border-t border-slate-200 dark:border-[#252548] print:border-black print:p-0.5">
                      <input
                        value={photo.caption}
                        disabled={!(user && (user.role === 'admin' || user.role === 'editor'))}
                        onChange={(e) => {
                          const newPhotos = [...photos]
                          newPhotos[idx].caption = e.target.value
                          setPhotos(newPhotos)
                        }}
                        placeholder="คำบรรยายภาพ..."
                        className="w-full text-xs outline-none bg-transparent dark:text-slate-200 placeholder:text-slate-400 print:text-[8px] print:text-black print:placeholder-transparent font-medium"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-red-500 text-xs font-semibold print:hidden">{error}</p>}
        </div>
      </form>
    </>
  )
}
