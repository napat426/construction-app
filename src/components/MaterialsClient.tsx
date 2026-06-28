'use client'

import { useState, useTransition, useMemo } from 'react'
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
} from 'lucide-react'
import type { Project, ProjectMaterial, MaterialStatus } from '@/lib/types'
import { createMaterial, updateMaterial, deleteMaterial } from '@/app/actions/materials'

interface Props {
  project: Project
  materials: ProjectMaterial[]
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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await createMaterial(projectId, fd)
      if (result?.error) {
        setError(result.error)
      } else {
        onClose()
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

const labelCls = 'text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5'
const inputCls =
  'w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#252548] bg-white dark:bg-[#14142a] text-sm font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500/40 transition-all'

/* ─── Main Component ─── */
export function MaterialsClient({ project, materials }: Props) {
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [showAddModal, setShowAddModal] = useState(false)
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

  function handleDelete(id: string) {
    if (!confirm('ลบรายการนี้ออกจากระบบ?')) return
    startTransition(async () => {
      await deleteMaterial(id, project.id)
    })
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

          {/* Add button */}
          <button
            id="add-material-btn"
            onClick={() => setShowAddModal(true)}
            className="btn-primary flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold flex-shrink-0"
          >
            <Plus size={15} />
            เพิ่มรายการวัสดุ
          </button>
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
                          <div className="flex items-center justify-center gap-1">
                            <button
                              id={`edit-material-${mat.id}`}
                              onClick={() => setEditingMaterial(mat)}
                              className="w-7 h-7 rounded-lg border border-slate-200 dark:border-[#252548] bg-slate-50 dark:bg-[#14142a] flex items-center justify-center text-slate-500 hover:text-primary-600 dark:hover:text-primary-400 hover:border-primary-300 transition-all"
                            >
                              <Pencil size={11} />
                            </button>
                            <button
                              id={`delete-material-${mat.id}`}
                              onClick={() => handleDelete(mat.id)}
                              disabled={isPending}
                              className="w-7 h-7 rounded-lg border border-slate-200 dark:border-[#252548] bg-slate-50 dark:bg-[#14142a] flex items-center justify-center text-slate-400 hover:text-red-500 hover:border-red-300 transition-all"
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
