'use client'

import { useState, useTransition } from 'react'
import {
  ClipboardCheck,
  Plus,
  Pencil,
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
} from 'lucide-react'
import type { Project, Inspection, InspectionStatus } from '@/lib/types'
import { createInspection, updateInspection, deleteInspection, updateInspectionsOrder, uploadReportPhoto } from '@/app/actions/reports'

interface Props {
  project: Project
  data: Inspection[]
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

export function InspectionsTab({ project, data }: Props) {
  const [items, setItems] = useState<Inspection[]>(data)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingItem, setEditingItem] = useState<Inspection | null>(null)
  const [isPending, startTransition] = useTransition()

  // Sync state if props change (revalidation)
  if (JSON.stringify(data) !== JSON.stringify(items) && !isPending) {
    setItems(data)
  }

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
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white">รายการตรวจสอบคุณภาพงาน (Inspections)</h2>
          <p className="text-sm font-medium text-slate-500">จัดการใบขอตรวจงานและบันทึกผลการตรวจสอบจากที่ปรึกษา/ผู้ควบคุมงาน</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold flex-shrink-0"
        >
          <Plus size={15} />
          สร้างใบขอตรวจงาน
        </button>
      </div>

      <div className="card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-[#14142a] text-slate-400 dark:text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-200 dark:border-[#1c1c34]">
                <th className="py-3 px-4 w-20 text-center">ลำดับ</th>
                <th className="py-3 px-4 w-32">เลขที่ใบขอตรวจ</th>
                <th className="py-3 px-4 min-w-40">หมวดงาน</th>
                <th className="py-3 px-4 min-w-64">หัวข้อที่ขอตรวจ</th>
                <th className="py-3 px-4 w-32">วันที่ขอตรวจ</th>
                <th className="py-3 px-4 w-36">ผู้ควบคุมงาน / ผู้ตรวจ</th>
                <th className="py-3 px-4 w-32 text-center">สถานะ</th>
                <th className="py-3 px-4 w-16 text-center">รูปภาพ</th>
                <th className="py-3 px-4 w-28 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1e1e38] text-slate-700 dark:text-slate-300">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <ClipboardCheck size={32} className="text-slate-300 dark:text-slate-600" />
                      <p className="text-sm font-bold text-slate-500 dark:text-slate-400">ยังไม่มีประวัติการขอตรวจงาน</p>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((item, idx) => {
                  const meta = STATUS_META[item.status]
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-[#14142a]/40 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1">
                          <button 
                            onClick={() => handleMove(idx, 'up')} 
                            disabled={idx === 0 || isPending}
                            className="p-1 text-slate-300 hover:text-primary-500 disabled:opacity-30 disabled:hover:text-slate-300 transition-colors"
                          >
                            <ArrowUp size={14} />
                          </button>
                          <span className="w-4 text-center font-mono text-xs text-slate-400">{idx + 1}</span>
                          <button 
                            onClick={() => handleMove(idx, 'down')} 
                            disabled={idx === items.length - 1 || isPending}
                            className="p-1 text-slate-300 hover:text-primary-500 disabled:opacity-30 disabled:hover:text-slate-300 transition-colors"
                          >
                            <ArrowDown size={14} />
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-800 dark:text-slate-300 text-xs">
                        {item.inspection_no}
                      </td>
                      <td className="py-3 px-4 text-xs font-semibold text-primary-600 dark:text-primary-400">
                        {item.work_type}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-800 dark:text-slate-200">{item.title}</p>
                        {item.note && <p className="text-xs text-slate-500 mt-0.5 truncate max-w-xs">{item.note}</p>}
                      </td>
                      <td className="py-3 px-4 text-xs font-medium text-slate-500">
                        {item.request_date ? new Date(item.request_date).toLocaleDateString('th-TH') : '—'}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        {item.inspector || '—'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border ${meta.badgeCls}`}>
                          <StatusIcon status={item.status} />
                          {meta.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {item.photo_urls && item.photo_urls.length > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 dark:bg-[#1e1e38] text-slate-500 rounded text-[10px] font-bold">
                            <ImageIcon size={10} /> {item.photo_urls.length}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setEditingItem(item)}
                            className="w-7 h-7 rounded-lg border border-slate-200 dark:border-[#252548] bg-slate-50 dark:bg-[#14142a] flex items-center justify-center text-slate-500 hover:text-primary-600 transition-all"
                          >
                            <Pencil size={11} />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            disabled={isPending}
                            className="w-7 h-7 rounded-lg border border-slate-200 dark:border-[#252548] bg-slate-50 dark:bg-[#14142a] flex items-center justify-center text-slate-400 hover:text-red-500 transition-all"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <InspectionModal 
          projectId={project.id} 
          onClose={() => setShowAddModal(false)} 
        />
      )}
      {editingItem && (
        <InspectionModal 
          projectId={project.id} 
          item={editingItem} 
          onClose={() => setEditingItem(null)} 
        />
      )}
    </div>
  )
}

/* ─── Add/Edit Modal ─── */
function InspectionModal({
  projectId,
  item,
  onClose,
}: {
  projectId: string
  item?: Inspection
  onClose: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [status, setStatus] = useState<InspectionStatus>(item?.status || 'submitted')
  const [uploading, setUploading] = useState(false)
  const [photos, setPhotos] = useState<string[]>(item?.photo_urls || [])

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    const file = e.target.files[0]
    
    setUploading(true)
    setError('')
    try {
      const res = await uploadReportPhoto(file)
      if (res.error) {
        setError(res.error)
      } else if (res.url) {
        setPhotos(prev => [...prev, res.url!])
      }
    } catch (err: any) {
      setError(err.message || 'Upload failed')
    } finally {
      setUploading(false)
      // Reset input
      e.target.value = ''
    }
  }

  const removePhoto = (idx: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== idx))
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    const fd = new FormData(e.currentTarget)
    fd.set('status', status)
    
    startTransition(async () => {
      let result
      if (item) {
        result = await updateInspection(item.id, projectId, fd, photos)
      } else {
        result = await createInspection(projectId, fd, photos)
      }

      if (result?.error) {
        setError(result.error)
      } else {
        onClose()
      }
    })
  }

  const labelCls = 'text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5'
  const inputCls = 'w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#252548] bg-white dark:bg-[#14142a] text-sm font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500/40'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="card rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-[#1e1e38]">
          <h2 className="text-base font-black text-slate-900 dark:text-white">
            {item ? 'แก้ไขใบขอตรวจงาน' : 'สร้างใบขอตรวจงาน'}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-[#1e1e38] transition-all"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>เลขที่ใบขอตรวจ <span className="text-red-500">*</span></label>
              <input name="inspection_no" type="text" defaultValue={item?.inspection_no || ''} className={inputCls} required placeholder="เช่น INSP-001" />
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
            <input name="title" type="text" defaultValue={item?.title || ''} className={inputCls} required placeholder="เช่น ตรวจสอบความถูกต้องของการผูกเหล็กคานคอดิน" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>วันที่ขอตรวจ</label>
              <input name="request_date" type="date" defaultValue={item?.request_date || ''} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>ชื่อผู้ควบคุมงาน / ผู้ตรวจสอบ</label>
              <input name="inspector" type="text" defaultValue={item?.inspector || ''} className={inputCls} placeholder="ระบุชื่อวิศวกรหรือผู้ตรวจ" />
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

          <div>
            <label className={labelCls}>หมายเหตุ (Comment)</label>
            <textarea name="note" rows={2} defaultValue={item?.note || ''} className={`${inputCls} resize-none`} placeholder="ความคิดเห็นเพิ่มเติมจากผู้ตรวจ เช่น สิ่งที่ต้องแก้ไข..." />
          </div>

          {/* Photo Upload Section */}
          <div className="border border-dashed border-slate-300 dark:border-[#252548] rounded-xl p-4 bg-slate-50 dark:bg-[#14142a]">
            <label className={labelCls}>รูปภาพประกอบ (อัปโหลดผ่าน Supabase Storage)</label>
            
            <div className="flex flex-wrap gap-3 mt-3">
              {photos.map((url, idx) => (
                <div key={idx} className="relative group w-20 h-20 rounded-lg overflow-hidden border border-slate-200 dark:border-[#252548]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`Photo ${idx+1}`} className="w-full h-full object-cover" />
                  <button 
                    type="button"
                    onClick={() => removePhoto(idx)}
                    className="absolute top-1 right-1 w-5 h-5 bg-black/60 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}

              <label className="w-20 h-20 rounded-lg border-2 border-dashed border-slate-300 dark:border-[#252548] flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 dark:hover:bg-[#1e1e38] transition-colors text-slate-400 hover:text-primary-500">
                {uploading ? (
                  <span className="text-[10px] font-bold animate-pulse">กำลังอัปโหลด...</span>
                ) : (
                  <>
                    <UploadCloud size={20} className="mb-1" />
                    <span className="text-[9px] font-bold">เพิ่มรูป</span>
                  </>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploading} />
              </label>
            </div>
          </div>

          {error && <p className="text-red-500 text-xs font-semibold">{error}</p>}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-[#1e1e38]">
            <button type="button" onClick={onClose} className="btn-secondary px-4 py-2 text-sm rounded-lg font-bold">
              ยกเลิก
            </button>
            <button type="submit" disabled={isPending || uploading} className="btn-primary px-4 py-2 text-sm rounded-lg font-bold flex items-center gap-1.5">
              <CheckCircle2 size={14} />
              {isPending ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
