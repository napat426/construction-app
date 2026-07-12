'use client'

import { useState, useTransition } from 'react'
import { Plus, Trash2, Calendar, FileText, Loader2, Save, FileClock, Clock, PauseCircle, FastForward } from 'lucide-react'
import { saveAmendment, deleteAmendment } from '@/app/actions/amendments'
import type { Project, ContractAmendment, AmendmentType } from '@/lib/types'
import { computeProjectExtension } from '@/lib/scheduler'

export function AmendmentForm({ project, amendments, onUpdate }: { project: Project, amendments: ContractAmendment[], onUpdate?: () => void }) {
  const [isPending, startTransition] = useTransition()
  const [isAdding, setIsAdding] = useState(false)
  const [error, setError] = useState('')
  const [amendmentType, setAmendmentType] = useState<AmendmentType>('direct')

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    const formData = new FormData(e.currentTarget)
    
    const suspend_date = formData.get('suspend_date') as string
    const resume_date = formData.get('resume_date') as string
    
    let extra_days = 0
    if (amendmentType === 'direct') {
      extra_days = parseInt(formData.get('extra_days') as string, 10) || 0
    } else if (amendmentType === 'suspend_with_resume') {
      if (!suspend_date || !resume_date) {
        setError('กรุณาระบุวันที่เริ่มหยุดงานและวันที่กลับมาเริ่มงาน')
        return
      }
      if (new Date(resume_date) <= new Date(suspend_date)) {
        setError('วันที่กลับมาเริ่มงานต้องมากกว่าวันที่สั่งหยุด')
        return
      }
      // Calculate extra_days dynamically
      const diffTime = Math.abs(new Date(resume_date).getTime() - new Date(suspend_date).getTime())
      extra_days = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      formData.set('extra_days', extra_days.toString())
    } else if (amendmentType === 'suspend_open') {
      if (!suspend_date) {
        setError('กรุณาระบุวันที่เริ่มหยุดงาน')
        return
      }
      extra_days = 0
      formData.set('extra_days', '0')
    }

    if (amendmentType === 'direct' && extra_days < 0) {
      // Simulate adding this amendment
      const tempAmendments = [...amendments, { 
        project_id: project.id, 
        extra_days, 
        amendment_type: 'direct',
        amendment_no: 999,
        amendment_date: new Date().toISOString(),
        reason: 'temp'
      } as ContractAmendment]
      
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

    if (suspend_date && project.start_date && new Date(suspend_date) < new Date(project.start_date)) {
      setError('วันที่สั่งหยุดต้องไม่ก่อนวันเริ่มโครงการ')
      return
    }
    
    startTransition(async () => {
      const result = await saveAmendment(project.id, formData)
      if (result.error) {
        setError(result.error)
      } else {
        setIsAdding(false)
        setAmendmentType('direct')
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

  // Helper to render icon for type
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
            onClick={() => setIsAdding(true)}
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
          <form onSubmit={handleSave} className="bg-white dark:bg-[#1e1e38] p-4 rounded-xl border border-amber-200 dark:border-amber-900/30 space-y-4 shadow-sm">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 border-b border-slate-100 dark:border-[#2a2a4a] pb-2">
              <Plus size={14} className="text-amber-500" />
              เพิ่มรายการแก้ไขสัญญา / หยุดงาน
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">แก้ไขสัญญาครั้งที่ *</label>
                <input
                  name="amendment_no"
                  type="number"
                  min="1"
                  required
                  defaultValue={amendments.length + 1}
                  className="w-full bg-slate-50 dark:bg-[#14142a] border border-slate-200 dark:border-[#2a2a4a] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">วันที่แก้ไขสัญญา/อนุมัติ *</label>
                <input
                  name="amendment_date"
                  type="date"
                  required
                  className="w-full bg-slate-50 dark:bg-[#14142a] border border-slate-200 dark:border-[#2a2a4a] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">ประเภท *</label>
                <select
                  name="amendment_type"
                  value={amendmentType}
                  onChange={(e) => setAmendmentType(e.target.value as AmendmentType)}
                  className="w-full bg-slate-50 dark:bg-[#14142a] border border-slate-200 dark:border-[#2a2a4a] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                >
                  <option value="direct">ขยาย/ลดวันสัญญาโดยตรง (ไม่มีการหยุดงาน)</option>
                  <option value="suspend_with_resume">หยุดงาน (มีกำหนดวันกลับ)</option>
                  <option value="suspend_open">หยุดงาน (ยังไม่กำหนดวันกลับ)</option>
                </select>
              </div>
            </div>

            {/* Hidden field to always include extra_days in FormData */}
            <input type="hidden" name="extra_days" value="0" />

            <div className="p-3 bg-slate-50/50 dark:bg-[#14142a]/50 rounded-lg border border-slate-100 dark:border-[#2a2a4a]">
              {(amendmentType === 'suspend_with_resume' || amendmentType === 'suspend_open') && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">วันที่สั่งหยุด *</label>
                    <input
                      name="suspend_date"
                      type="date"
                      required
                      className="w-full bg-white dark:bg-[#1e1e38] border border-slate-200 dark:border-[#2a2a4a] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                    />
                  </div>
                  {amendmentType === 'suspend_with_resume' && (
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">วันที่กลับมาเริ่มงาน *</label>
                      <input
                        name="resume_date"
                        type="date"
                        required
                        className="w-full bg-white dark:bg-[#1e1e38] border border-slate-200 dark:border-[#2a2a4a] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                      />
                    </div>
                  )}
                  {amendmentType === 'suspend_open' && (
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">วันที่กลับมาเริ่มงาน</label>
                      <div className="w-full bg-slate-100 dark:bg-[#14142a] text-slate-400 border border-slate-200 dark:border-[#2a2a4a] rounded-lg px-3 py-2 text-sm cursor-not-allowed">
                        ยังไม่กำหนด
                      </div>
                    </div>
                  )}
                </div>
              )}

              {amendmentType === 'direct' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">จำนวนวันที่ขยายเพิ่ม (วัน) *</label>
                    <input
                      name="extra_days"
                      type="number"
                      required
                      className="w-full bg-white dark:bg-[#1e1e38] border border-slate-200 dark:border-[#2a2a4a] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                      placeholder="เช่น 30, 60 (ใส่ติดลบได้ถ้าลดวัน)"
                    />
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">เหตุผล *</label>
              <textarea
                name="reason"
                required
                rows={2}
                className="w-full bg-slate-50 dark:bg-[#14142a] border border-slate-200 dark:border-[#2a2a4a] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                placeholder="เช่น รอส่งมอบพื้นที่, ขยายเวลาตามมาตรการช่วยเหลือ..."
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">หมายเหตุ (ถ้ามี)</label>
              <input
                name="note"
                type="text"
                className="w-full bg-slate-50 dark:bg-[#14142a] border border-slate-200 dark:border-[#2a2a4a] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
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
                type="submit"
                disabled={isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold text-amber-900 bg-amber-400 hover:bg-amber-500 transition-colors disabled:opacity-50"
              >
                {isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                บันทึกรายการ
              </button>
            </div>
          </form>
        )}

        {amendments.length === 0 && !isAdding ? (
          <div className="text-center py-6 px-4 bg-white/50 dark:bg-[#14142a]/50 rounded-xl border border-dashed border-amber-200 dark:border-amber-900/30">
            <FileText size={24} className="mx-auto text-amber-300 dark:text-amber-700 mb-2" />
            <p className="text-xs text-amber-700/70 dark:text-amber-500/70">ยังไม่มีประวัติการแก้ไขสัญญา หรือการหยุดงาน</p>
          </div>
        ) : (
          <div className="space-y-3">
            {amendments.sort((a, b) => new Date(a.amendment_date).getTime() - new Date(b.amendment_date).getTime()).map((a) => (
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
                          <>
                            {a.extra_days > 0 ? `+${a.extra_days}` : a.extra_days} <span className="text-xs font-medium">วัน</span>
                          </>
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
