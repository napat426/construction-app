'use client'

import { useState, useTransition } from 'react'
import { Plus, Trash2, Calendar, FileText, Loader2, Save, FileClock, Clock, PauseCircle, FastForward } from 'lucide-react'
import { saveAmendment, deleteAmendment } from '@/app/actions/amendments'
import type { Project, ContractAmendment, AmendmentType } from '@/lib/types'
import { computeProjectExtension } from '@/lib/scheduler'

interface FormState {
  amendment_no: number
  amendment_date: string
  amendment_type: AmendmentType
  suspend_date: string
  resume_date: string
  extra_days: string
  reason: string
  note: string
}

const defaultForm = (nextNo: number): FormState => ({
  amendment_no: nextNo,
  amendment_date: '',
  amendment_type: 'direct',
  suspend_date: '',
  resume_date: '',
  extra_days: '',
  reason: '',
  note: '',
})

export function AmendmentForm({ project, amendments, onUpdate }: { project: Project, amendments: ContractAmendment[], onUpdate?: () => void }) {
  const [isPending, startTransition] = useTransition()
  const [isAdding, setIsAdding] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState<FormState>(() => defaultForm(amendments.length + 1))

  const updateField = (key: keyof FormState, value: string | number) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const handleSave = () => {
    setError('')

    // Validation
    if (!form.amendment_date) { setError('กรุณาระบุวันที่แก้ไขสัญญา'); return }
    if (!form.reason.trim()) { setError('กรุณาระบุเหตุผล'); return }

    let extra_days = 0

    if (form.amendment_type === 'direct') {
      extra_days = parseInt(form.extra_days, 10)
      if (isNaN(extra_days)) { setError('กรุณาระบุจำนวนวัน'); return }
    } else if (form.amendment_type === 'suspend_with_resume') {
      if (!form.suspend_date) { setError('กรุณาระบุวันที่สั่งหยุด'); return }
      if (!form.resume_date) { setError('กรุณาระบุวันที่กลับมาเริ่มงาน'); return }
      if (new Date(form.resume_date) <= new Date(form.suspend_date)) {
        setError('วันที่กลับมาเริ่มงานต้องมากกว่าวันที่สั่งหยุด')
        return
      }
      const diffTime = Math.abs(new Date(form.resume_date).getTime() - new Date(form.suspend_date).getTime())
      extra_days = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    } else if (form.amendment_type === 'suspend_open') {
      if (!form.suspend_date) { setError('กรุณาระบุวันที่สั่งหยุด'); return }
      extra_days = 0
    }

    if (form.amendment_type === 'direct' && extra_days < 0) {
      const tempAmendments = [...amendments, {
        project_id: project.id,
        extra_days,
        amendment_type: 'direct' as AmendmentType,
        amendment_no: 999,
        amendment_date: new Date().toISOString(),
        reason: 'temp',
        note: null,
      }]
      const ext = computeProjectExtension(project, tempAmendments)
      if (ext.totalDays < 0) {
        setError(`ไม่สามารถลดวันได้ (${extra_days} วัน) เพราะจะทำให้จำนวนวันรวมของโครงการติดลบ`)
        return
      }
      if (ext.daysRemaining < 0) {
        setError(`ไม่สามารถลดวันได้ (${extra_days} วัน) เพราะจะทำให้จำนวนวันคงเหลือติดลบ`)
        return
      }
    }

    if (form.suspend_date && project.start_date && new Date(form.suspend_date) < new Date(project.start_date)) {
      setError('วันที่สั่งหยุดต้องไม่ก่อนวันเริ่มโครงการ')
      return
    }

    const formData = new FormData()
    formData.set('amendment_no', form.amendment_no.toString())
    formData.set('amendment_date', form.amendment_date)
    formData.set('amendment_type', form.amendment_type)
    formData.set('suspend_date', form.suspend_date)
    formData.set('resume_date', form.resume_date)
    formData.set('extra_days', extra_days.toString())
    formData.set('reason', form.reason)
    formData.set('note', form.note)

    startTransition(async () => {
      const result = await saveAmendment(project.id, formData)
      if (result.error) {
        setError(result.error)
      } else {
        setIsAdding(false)
        setForm(defaultForm(amendments.length + 2))
        if (onUpdate) onUpdate()
      }
    })
  }

  const handleDelete = async (id: string) => {
    if (!confirm('ยืนยันการลบรายการนี้?')) return
    startTransition(async () => {
      const result = await deleteAmendment(id)
      if (result?.error) {
        alert(result.error)
      } else {
        if (onUpdate) onUpdate()
      }
    })
  }

  const getTypeIcon = (type: AmendmentType) => {
    switch (type) {
      case 'suspend_with_resume': return <PauseCircle size={16} className="text-blue-500" />
      case 'suspend_open': return <Clock size={16} className="text-rose-500" />
      case 'direct': return <FastForward size={16} className="text-amber-500" />
    }
  }

  const getTypeName = (type: AmendmentType) => {
    switch (type) {
      case 'suspend_with_resume': return 'หยุดงาน (มีกำหนดวันกลับ)'
      case 'suspend_open': return 'หยุดงาน (ยังไม่กำหนดวันกลับ)'
      case 'direct': return 'ขยาย/ลดวันสัญญาโดยตรง (ไม่มีการหยุดงาน)'
    }
  }

  const inputCls = "w-full bg-white dark:bg-[#1e1e38] border border-slate-200 dark:border-[#2a2a4a] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
  const labelCls = "block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5"

  return (
    <div className="mt-6 border border-amber-200 dark:border-amber-900/30 rounded-xl overflow-hidden bg-amber-50/30 dark:bg-[#14142a]/30">
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
        {!isAdding && (
          <button
            type="button"
            onClick={() => { setForm(defaultForm(amendments.length + 1)); setError(''); setIsAdding(true) }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-200/50 dark:bg-amber-500/10 hover:bg-amber-200 dark:hover:bg-amber-500/20 transition-colors border border-amber-300/50 dark:border-amber-500/20"
          >
            <Plus size={13} />
            เพิ่มรายการ
          </button>
        )}
      </div>

      <div className="p-4 space-y-4">
        {error && (
          <div className="p-2.5 rounded bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 text-xs font-medium border border-red-200 dark:border-red-900/30 flex items-center gap-2">
            ⚠️ {error}
          </div>
        )}

        {isAdding && (
          <div className="bg-white dark:bg-[#1e1e38] p-4 rounded-xl border border-amber-200 dark:border-amber-900/30 space-y-4 shadow-sm">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 border-b border-slate-100 dark:border-[#2a2a4a] pb-2">
              <Plus size={14} className="text-amber-500" />
              เพิ่มรายการแก้ไขสัญญา / หยุดงาน
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>แก้ไขสัญญาครั้งที่ *</label>
                <input
                  type="number"
                  min="1"
                  value={form.amendment_no}
                  onChange={e => updateField('amendment_no', e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>วันที่แก้ไขสัญญา/อนุมัติ *</label>
                <input
                  type="date"
                  value={form.amendment_date}
                  onChange={e => updateField('amendment_date', e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>ประเภท *</label>
                <select
                  value={form.amendment_type}
                  onChange={e => updateField('amendment_type', e.target.value)}
                  className={inputCls}
                >
                  <option value="direct">ขยาย/ลดวันสัญญาโดยตรง (ไม่มีการหยุดงาน)</option>
                  <option value="suspend_with_resume">หยุดงาน (มีกำหนดวันกลับ)</option>
                  <option value="suspend_open">หยุดงาน (ยังไม่กำหนดวันกลับ)</option>
                </select>
              </div>
            </div>

            <div className="p-3 bg-slate-50/50 dark:bg-[#14142a]/50 rounded-lg border border-slate-100 dark:border-[#2a2a4a]">
              {(form.amendment_type === 'suspend_with_resume' || form.amendment_type === 'suspend_open') && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>วันที่สั่งหยุด *</label>
                    <input
                      type="date"
                      value={form.suspend_date}
                      onChange={e => updateField('suspend_date', e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  {form.amendment_type === 'suspend_with_resume' && (
                    <div>
                      <label className={labelCls}>วันที่กลับมาเริ่มงาน *</label>
                      <input
                        type="date"
                        value={form.resume_date}
                        onChange={e => updateField('resume_date', e.target.value)}
                        className={inputCls}
                      />
                    </div>
                  )}
                  {form.amendment_type === 'suspend_open' && (
                    <div>
                      <label className={labelCls}>วันที่กลับมาเริ่มงาน</label>
                      <div className="w-full bg-slate-100 dark:bg-[#14142a] text-slate-400 border border-slate-200 dark:border-[#2a2a4a] rounded-lg px-3 py-2 text-sm cursor-not-allowed">
                        ยังไม่กำหนด
                      </div>
                    </div>
                  )}
                </div>
              )}

              {form.amendment_type === 'direct' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>จำนวนวันที่ขยายเพิ่ม (วัน) *</label>
                    <input
                      type="number"
                      value={form.extra_days}
                      onChange={e => updateField('extra_days', e.target.value)}
                      className={inputCls}
                      placeholder="เช่น 30, 60 (ใส่ติดลบได้ถ้าลดวัน)"
                    />
                  </div>
                </div>
              )}

              {(form.amendment_type === 'suspend_with_resume' && form.suspend_date && form.resume_date) && (
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-400 font-medium">
                  📅 ระยะหยุดงาน: {Math.ceil(Math.abs(new Date(form.resume_date).getTime() - new Date(form.suspend_date).getTime()) / (1000 * 60 * 60 * 24))} วัน (คำนวณอัตโนมัติ)
                </p>
              )}
            </div>

            <div>
              <label className={labelCls}>เหตุผล *</label>
              <textarea
                value={form.reason}
                onChange={e => updateField('reason', e.target.value)}
                rows={2}
                className={inputCls}
                placeholder="เช่น รอส่งมอบพื้นที่, ขยายเวลาตามมาตรการช่วยเหลือ..."
              />
            </div>

            <div>
              <label className={labelCls}>หมายเหตุ (ถ้ามี)</label>
              <input
                type="text"
                value={form.note}
                onChange={e => updateField('note', e.target.value)}
                className={inputCls}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-[#2a2a4a]">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold text-amber-900 bg-amber-400 hover:bg-amber-500 transition-colors disabled:opacity-50"
              >
                {isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                บันทึกรายการ
              </button>
            </div>
          </div>
        )}

        {amendments.length === 0 && !isAdding ? (
          <div className="text-center py-6 px-4 bg-white/50 dark:bg-[#14142a]/50 rounded-xl border border-dashed border-amber-200 dark:border-amber-900/30">
            <FileText size={24} className="mx-auto text-amber-300 dark:text-amber-700 mb-2" />
            <p className="text-xs text-amber-700/70 dark:text-amber-500/70">ยังไม่มีประวัติการแก้ไขสัญญา หรือการหยุดงาน</p>
          </div>
        ) : (
          <div className="space-y-3">
            {[...amendments].sort((a, b) => new Date(a.amendment_date).getTime() - new Date(b.amendment_date).getTime()).map((a) => (
              <div key={a.id} className="bg-white dark:bg-[#1e1e38] p-4 rounded-xl border border-amber-100 dark:border-amber-900/20 shadow-sm relative group transition-all hover:border-amber-300 dark:hover:border-amber-700/50">
                <div className="flex flex-col sm:flex-row gap-4 justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800/50">
                        ครั้งที่ {a.amendment_no}
                      </span>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <Calendar size={12} className="text-amber-500" />
                        {new Date(a.amendment_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mb-1.5">
                      {getTypeIcon(a.amendment_type)}
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                        {getTypeName(a.amendment_type)}
                        {a.amendment_type === 'suspend_with_resume' && a.suspend_date && a.resume_date && (
                          <span className="ml-1 font-normal text-slate-500">
                            ({new Date(a.suspend_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })} - {new Date(a.resume_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })})
                          </span>
                        )}
                        {a.amendment_type === 'suspend_open' && a.suspend_date && (
                          <span className="ml-1 font-normal text-slate-500">
                            (ตั้งแต่ {new Date(a.suspend_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })})
                          </span>
                        )}
                      </span>
                    </div>

                    <p className="text-sm font-semibold text-slate-900 dark:text-white mb-1 leading-snug">
                      เหตุผล: {a.reason}
                    </p>
                    {a.note && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 italic before:content-['—_']">
                        {a.note}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-4 sm:flex-col sm:items-end sm:gap-2 pl-4 sm:pl-6 border-l border-slate-100 dark:border-[#2a2a4a] self-stretch justify-center">
                    <div className="text-center">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">ขยายเวลา</p>
                      <p className="text-lg font-black text-amber-600 dark:text-amber-400 font-mono">
                        {a.amendment_type === 'suspend_open' ? (
                          <span className="text-sm">รอประเมิน</span>
                        ) : (
                          <>{a.extra_days > 0 ? `+${a.extra_days}` : a.extra_days} <span className="text-xs font-medium">วัน</span></>
                        )}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => a.id && handleDelete(a.id)}
                      disabled={isPending}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md absolute top-3 right-3 sm:static"
                      title="ลบรายการนี้"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
