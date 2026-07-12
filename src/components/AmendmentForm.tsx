'use client'

import { useState, useTransition } from 'react'
import { Plus, Trash2, Calendar, FileText, Loader2, Save, FileClock, Clock, PauseCircle, FastForward, Pencil, X } from 'lucide-react'
import { saveAmendment, deleteAmendment } from '@/app/actions/amendments'
import type { Project, ContractAmendment, AmendmentType } from '@/lib/types'
import { computeProjectExtension } from '@/lib/scheduler'

interface FormState {
  id?: string
  amendment_no: string
  amendment_date: string
  amendment_type: AmendmentType
  suspend_date: string
  last_stop_date: string   // วันสุดท้ายที่หยุดงาน (resume_date ใน DB = last_stop_date + 1)
  extra_days: string
  reason: string
  note: string
}

const defaultForm = (nextNo: number): FormState => ({
  amendment_no: String(nextNo),
  amendment_date: '',
  amendment_type: 'direct',
  suspend_date: '',
  last_stop_date: '',
  extra_days: '',
  reason: '',
  note: '',
})

// Helper: resume_date (first working day back) → last_stop_date (last day stopped)
function resumeToLastStop(resumeDate: string): string {
  if (!resumeDate) return ''
  const d = new Date(resumeDate)
  d.setDate(d.getDate() - 1)
  return d.toISOString().split('T')[0]
}

// Helper: last_stop_date → resume_date (first working day back)
function lastStopToResume(lastStop: string): string {
  if (!lastStop) return ''
  const d = new Date(lastStop)
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

// Format date for display (th-TH locale)
function fmtDate(d: string | null | undefined, opts?: Intl.DateTimeFormatOptions) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('th-TH', opts ?? { day: 'numeric', month: 'short', year: '2-digit' })
}

export function AmendmentForm({ project, amendments, onUpdate }: {
  project: Project
  amendments: ContractAmendment[]
  onUpdate?: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState<FormState | null>(null) // null = not editing
  const [error, setError] = useState('')

  const updateField = (key: keyof FormState, value: string) => {
    setForm(prev => prev ? { ...prev, [key]: value } : prev)
  }

  const openAdd = () => {
    setError('')
    setForm(defaultForm(amendments.length + 1))
  }

  const openEdit = (a: ContractAmendment) => {
    setError('')
    setForm({
      id: a.id,
      amendment_no: String(a.amendment_no),
      amendment_date: a.amendment_date?.split('T')[0] ?? '',
      amendment_type: a.amendment_type,
      suspend_date: a.suspend_date?.split('T')[0] ?? '',
      last_stop_date: resumeToLastStop(a.resume_date ?? ''),
      extra_days: String(a.extra_days ?? 0),
      reason: a.reason ?? '',
      note: a.note ?? '',
    })
  }

  const handleCancel = () => {
    setForm(null)
    setError('')
  }

  const handleSave = () => {
    if (!form) return
    setError('')

    if (!form.amendment_date) { setError('กรุณาระบุวันที่แก้ไขสัญญา'); return }
    if (!form.reason.trim()) { setError('กรุณาระบุเหตุผล'); return }

    let extra_days = form.extra_days ? parseInt(form.extra_days, 10) : 0
    if (isNaN(extra_days)) { setError('จำนวนวันที่ขยาย/ลดไม่ถูกต้อง'); return }
    let resume_date_to_save = ''

    if (form.amendment_type === 'suspend_with_resume') {
      if (!form.suspend_date) { setError('กรุณาระบุวันที่เริ่มหยุดงาน'); return }
      if (!form.last_stop_date) { setError('กรุณาระบุวันสุดท้ายที่หยุดงาน'); return }
      if (new Date(form.last_stop_date) < new Date(form.suspend_date)) {
        setError('วันสุดท้ายที่หยุดต้องไม่ก่อนวันที่เริ่มหยุดงาน')
        return
      }
      resume_date_to_save = lastStopToResume(form.last_stop_date)
    } else if (form.amendment_type === 'suspend_open') {
      if (!form.suspend_date) { setError('กรุณาระบุวันที่เริ่มหยุดงาน'); return }
      resume_date_to_save = ''
    }

    if (extra_days < 0) {
      const tempAmendments = amendments.filter(a => a.id !== form.id).concat([{
        project_id: project.id,
        extra_days,
        amendment_type: form.amendment_type,
        amendment_no: 999,
        amendment_date: new Date().toISOString(),
        reason: 'temp',
        note: null,
      }])
      const ext = computeProjectExtension(project, tempAmendments)
      if (ext.totalDays < 0) {
        setError(`ไม่สามารถลดวันได้ (${extra_days} วัน) เพราะจะทำให้จำนวนวันรวมของโครงการติดลบ`)
        return
      }
    }

    if (form.suspend_date && project.start_date && new Date(form.suspend_date) < new Date(project.start_date)) {
      setError('วันที่เริ่มหยุดต้องไม่ก่อนวันเริ่มโครงการ')
      return
    }

    const formData = new FormData()
    if (form.id) formData.set('id', form.id)
    formData.set('amendment_no', form.amendment_no)
    formData.set('amendment_date', form.amendment_date)
    formData.set('amendment_type', form.amendment_type)
    formData.set('suspend_date', form.suspend_date)
    formData.set('resume_date', resume_date_to_save)
    formData.set('extra_days', extra_days.toString())
    formData.set('reason', form.reason)
    formData.set('note', form.note)

    startTransition(async () => {
      const result = await saveAmendment(project.id, formData)
      if (result.error) {
        setError(result.error)
      } else {
        setForm(null)
        if (onUpdate) onUpdate()
      }
    })
  }

  const handleDelete = (id: string) => {
    if (!confirm('ยืนยันการลบรายการนี้?')) return
    startTransition(async () => {
      const result = await deleteAmendment(id)
      if (result?.error) alert(result.error)
      else if (onUpdate) onUpdate()
    })
  }

  const getTypeIcon = (type: AmendmentType) => {
    switch (type) {
      case 'suspend_with_resume': return <PauseCircle size={15} className="text-blue-500 shrink-0" />
      case 'suspend_open': return <Clock size={15} className="text-rose-500 shrink-0" />
      case 'direct': return <FastForward size={15} className="text-amber-500 shrink-0" />
    }
  }

  const getTypeName = (type: AmendmentType) => {
    switch (type) {
      case 'suspend_with_resume': return 'หยุดงาน (มีกำหนดวัน)'
      case 'suspend_open': return 'หยุดงาน (ยังไม่กำหนดวันกลับ)'
      case 'direct': return 'ขยาย/ลดวันสัญญาโดยตรง'
    }
  }

  // Computed preview for suspension duration
  const suspensionDaysPreview = (() => {
    if (!form || form.amendment_type !== 'suspend_with_resume') return null
    if (!form.suspend_date || !form.last_stop_date) return null
    if (new Date(form.last_stop_date) < new Date(form.suspend_date)) return null
    const msPerDay = 1000 * 60 * 60 * 24
    const diff = new Date(form.last_stop_date).getTime() - new Date(form.suspend_date).getTime()
    return Math.round(diff / msPerDay) + 1
  })()

  const inputCls = "w-full bg-white dark:bg-[#1e1e38] border border-slate-200 dark:border-[#2a2a4a] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
  const labelCls = "block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5"
  const isEditing = !!form?.id

  return (
    <div className="mt-6 border border-amber-200 dark:border-amber-900/30 rounded-xl overflow-hidden bg-amber-50/30 dark:bg-[#14142a]/30">
      {/* Header */}
      <div className="bg-amber-100/50 dark:bg-amber-900/20 px-4 py-3 flex items-center justify-between border-b border-amber-200 dark:border-amber-900/30">
        <div>
          <h3 className="text-sm font-bold text-amber-800 dark:text-amber-400 flex items-center gap-2">
            <FileClock size={16} />
            ประวัติการแก้ไขสัญญา / หยุดงาน
          </h3>
          <p className="text-[10px] text-amber-600/80 dark:text-amber-500/80 mt-0.5">
            รวมรายการขยายเวลาและหยุดงานทั้งหมด ส่งผลต่อแผนงานและจำนวนวันของโครงการ
          </p>
        </div>
        {!form && (
          <button
            type="button"
            onClick={openAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-200/50 dark:bg-amber-500/10 hover:bg-amber-200 dark:hover:bg-amber-500/20 transition-colors border border-amber-300/50 dark:border-amber-500/20"
          >
            <Plus size={13} />
            เพิ่มรายการ
          </button>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Error */}
        {error && (
          <div className="p-2.5 rounded bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 text-xs font-medium border border-red-200 dark:border-red-900/30 flex items-center gap-2">
            ⚠️ {error}
          </div>
        )}

        {/* Add / Edit Form */}
        {form && (
          <div className="bg-white dark:bg-[#1e1e38] p-4 rounded-xl border border-amber-200 dark:border-amber-900/30 space-y-4 shadow-sm">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 border-b border-slate-100 dark:border-[#2a2a4a] pb-2">
              {isEditing ? <Pencil size={14} className="text-amber-500" /> : <Plus size={14} className="text-amber-500" />}
              {isEditing ? 'แก้ไขรายการ' : 'เพิ่มรายการแก้ไขสัญญา / หยุดงาน'}
            </h4>

            {/* Row 1: No., Date, Type */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>แก้ไขสัญญาครั้งที่ *</label>
                <input type="number" min="1" value={form.amendment_no}
                  onChange={e => updateField('amendment_no', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>วันที่แก้ไขสัญญา/อนุมัติ *</label>
                <input type="date" value={form.amendment_date}
                  onChange={e => updateField('amendment_date', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>ประเภท *</label>
                <select value={form.amendment_type}
                  onChange={e => updateField('amendment_type', e.target.value)} className={inputCls}>
                  <option value="direct">ขยาย/ลดวันสัญญาโดยตรง (ไม่มีการหยุดงาน)</option>
                  <option value="suspend_with_resume">หยุดงาน (มีกำหนดวันสุดท้ายที่หยุด)</option>
                  <option value="suspend_open">หยุดงาน (ยังไม่กำหนดวันกลับ)</option>
                </select>
              </div>
            </div>

            {/* Row 2: Type-specific fields */}
            <div className="p-3 bg-slate-50/50 dark:bg-[#14142a]/50 rounded-lg border border-slate-100 dark:border-[#2a2a4a] space-y-3">
              {/* Suspension fields */}
              {(form.amendment_type === 'suspend_with_resume' || form.amendment_type === 'suspend_open') && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>วันแรกที่หยุดงาน *</label>
                    <input type="date" value={form.suspend_date}
                      onChange={e => updateField('suspend_date', e.target.value)} className={inputCls} />
                  </div>
                  {form.amendment_type === 'suspend_with_resume' ? (
                    <div>
                      <label className={labelCls}>วันสุดท้ายที่หยุดงาน *</label>
                      <input type="date" value={form.last_stop_date}
                        onChange={e => updateField('last_stop_date', e.target.value)} className={inputCls} />
                      <p className="text-[10px] text-slate-400 mt-1">
                        วันกลับมาทำงาน = {form.last_stop_date ? fmtDate(lastStopToResume(form.last_stop_date)) : '—'}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <label className={labelCls}>วันสุดท้ายที่หยุดงาน</label>
                      <div className="w-full bg-slate-100 dark:bg-[#14142a] text-slate-400 border border-slate-200 dark:border-[#2a2a4a] rounded-lg px-3 py-2 text-sm cursor-not-allowed">
                        ยังไม่กำหนด (หยุดจนกว่าจะแก้ไข)
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Duration preview */}
              {suspensionDaysPreview !== null && (
                <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/10 rounded-lg px-3 py-2 border border-amber-200 dark:border-amber-800/30">
                  <Calendar size={13} className="text-amber-500" />
                  <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
                    ระยะเวลาที่หยุดงานจริง: <span className="text-base">{suspensionDaysPreview}</span> วัน
                  </span>
                  <span className="text-[10px] text-slate-400 ml-1">(ข้อมูลอ้างอิง)</span>
                </div>
              )}

              {/* Universal extra_days */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-200 dark:border-slate-700/50 pt-3 mt-1">
                <div>
                  <label className={labelCls}>จำนวนวันที่ขยาย/ลดวันสัญญา (วัน)</label>
                  <input type="number" value={form.extra_days}
                    onChange={e => updateField('extra_days', e.target.value)}
                    className={inputCls} placeholder="เช่น 30 หรือ -5 (ไม่ต้องใส่หากไม่มี)" />
                </div>
              </div>
            </div>

            {/* Reason & Note */}
            <div>
              <label className={labelCls}>เหตุผล *</label>
              <textarea value={form.reason} onChange={e => updateField('reason', e.target.value)}
                rows={2} className={inputCls}
                placeholder="เช่น รอส่งมอบพื้นที่, ขยายเวลาตามมาตรการช่วยเหลือ..." />
            </div>
            <div>
              <label className={labelCls}>หมายเหตุ (ถ้ามี)</label>
              <input type="text" value={form.note}
                onChange={e => updateField('note', e.target.value)} className={inputCls} />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-[#2a2a4a]">
              <button type="button" onClick={handleCancel}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300">
                <X size={13} /> ยกเลิก
              </button>
              <button type="button" onClick={handleSave} disabled={isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold text-amber-900 bg-amber-400 hover:bg-amber-500 transition-colors disabled:opacity-50">
                {isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {isEditing ? 'บันทึกการแก้ไข' : 'บันทึกรายการ'}
              </button>
            </div>
          </div>
        )}

        {/* History List */}
        {amendments.length === 0 && !form ? (
          <div className="text-center py-6 px-4 bg-white/50 dark:bg-[#14142a]/50 rounded-xl border border-dashed border-amber-200 dark:border-amber-900/30">
            <FileText size={24} className="mx-auto text-amber-300 dark:text-amber-700 mb-2" />
            <p className="text-xs text-amber-700/70 dark:text-amber-500/70">ยังไม่มีประวัติการแก้ไขสัญญา หรือการหยุดงาน</p>
          </div>
        ) : (
          <div className="space-y-2">
            {[...amendments]
              .sort((a, b) => new Date(a.amendment_date).getTime() - new Date(b.amendment_date).getTime())
              .map((a) => {
                // Display: "วันสุดท้ายที่หยุด" = resume_date - 1
                const lastStopDisplay = a.resume_date ? resumeToLastStop(a.resume_date) : null
                return (
                  <div key={a.id}
                    className="bg-white dark:bg-[#1e1e38] p-3.5 rounded-xl border border-amber-100 dark:border-amber-900/20 shadow-sm group transition-all hover:border-amber-300 dark:hover:border-amber-700/50">
                    <div className="flex gap-3 justify-between items-start">
                      <div className="flex-1 min-w-0">
                        {/* Badges row */}
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <span className="bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800/50 shrink-0">
                            ครั้งที่ {a.amendment_no}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <Calendar size={11} className="text-amber-400" />
                            {fmtDate(a.amendment_date, { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                          <span className="flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                            {getTypeIcon(a.amendment_type)}
                            {getTypeName(a.amendment_type)}
                          </span>
                        </div>

                        {/* Suspension date range */}
                        {a.amendment_type === 'suspend_with_resume' && a.suspend_date && lastStopDisplay && (
                          <div className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/10 rounded px-2 py-1 inline-flex items-center gap-1.5 mb-1.5 border border-blue-100 dark:border-blue-800/30">
                            <PauseCircle size={11} />
                            หยุดงาน {fmtDate(a.suspend_date)} – {fmtDate(lastStopDisplay)}
                            <span className="font-bold">({Math.round((new Date(lastStopDisplay).getTime() - new Date(a.suspend_date).getTime()) / (1000 * 60 * 60 * 24)) + 1} วัน)</span>
                            → กลับงานวันที่ {fmtDate(a.resume_date)}
                          </div>
                        )}
                        {a.amendment_type === 'suspend_open' && a.suspend_date && (
                          <div className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/10 rounded px-2 py-1 inline-flex items-center gap-1.5 mb-1.5 border border-rose-100 dark:border-rose-800/30">
                            <Clock size={11} />
                            หยุดงานตั้งแต่ {fmtDate(a.suspend_date)} — ยังไม่กำหนดวันกลับ
                          </div>
                        )}
                        {a.amendment_type !== 'direct' && (a.extra_days ?? 0) !== 0 && (
                          <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/10 rounded px-2 py-1 inline-flex items-center gap-1.5 mb-1.5 ml-1.5 border border-amber-100 dark:border-amber-800/30">
                            <FastForward size={11} />
                            {a.extra_days > 0 ? `ขยาย +${a.extra_days} วัน` : `ลด ${a.extra_days} วัน`}
                          </div>
                        )}
                        {a.amendment_type === 'direct' && (
                          <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/10 rounded px-2 py-1 inline-flex items-center gap-1.5 mb-1.5 border border-amber-100 dark:border-amber-800/30">
                            <FastForward size={11} />
                            {a.extra_days > 0 ? `ขยาย +${a.extra_days} วัน` : `ลด ${a.extra_days} วัน`}
                          </div>
                        )}

                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">เหตุผล: {a.reason}</p>
                        {a.note && <p className="text-[10px] text-slate-400 italic mt-0.5">— {a.note}</p>}
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 pt-0.5">
                        <button type="button" onClick={() => openEdit(a)} disabled={isPending}
                          title="แก้ไข"
                          className="p-1.5 text-amber-500 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-md transition-colors">
                          <Pencil size={13} />
                        </button>
                        <button type="button" onClick={() => a.id && handleDelete(a.id)} disabled={isPending}
                          title="ลบ"
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
          </div>
        )}
      </div>
    </div>
  )
}
