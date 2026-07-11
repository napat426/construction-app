'use client'

import { useState, useTransition } from 'react'
import { Plus, Trash2, Calendar, FileText, Loader2, Save, FileClock } from 'lucide-react'
import { saveAmendment, deleteAmendment } from '@/app/actions/amendments'
import type { Project, ContractAmendment, ContractSuspension } from '@/lib/types'
import { computeProjectExtension } from '@/lib/scheduler'

export function AmendmentForm({ project, suspensions, amendments, onUpdate }: { project: Project, suspensions: ContractSuspension[], amendments: ContractAmendment[], onUpdate?: () => void }) {
  const [isPending, startTransition] = useTransition()
  const [isAdding, setIsAdding] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    const formData = new FormData(e.currentTarget)
    const extra_days = parseInt(formData.get('extra_days') as string, 10)
    
    if (extra_days < 0) {
      // Simulate adding this amendment
      const tempAmendments = [...amendments, { 
        project_id: project.id, 
        extra_days, 
        amendment_no: 999,
        amendment_date: new Date().toISOString(),
        reason: 'temp'
      } as ContractAmendment]
      
      const ext = computeProjectExtension(project, suspensions, tempAmendments)
      if (ext.totalDays < 0) {
        setError(`ไม่สามารถลดวันได้ (${extra_days} วัน) เพราะจะทำให้จำนวนวันรวมของโครงการติดลบ`)
        return
      }
      if (ext.daysRemaining < 0) {
        setError(`ไม่สามารถลดวันได้ (${extra_days} วัน) เพราะจะทำให้จำนวนวันคงเหลือติดลบ`)
        return
      }
    }
    
    startTransition(async () => {
      const result = await saveAmendment(project.id, formData)
      if (result.error) {
        setError(result.error)
      } else {
        setIsAdding(false)
        if (onUpdate) onUpdate()
      }
    })
  }

  const handleDelete = async (id: string) => {
    if (!confirm('ยืนยันการลบการแก้ไขสัญญานี้?')) return
    startTransition(async () => {
      const result = await deleteAmendment(id)
      if (result?.error) {
        alert(result.error)
      } else {
        if (onUpdate) onUpdate()
      }
    })
  }

  return (
    <div className="mt-6 border border-amber-200 dark:border-amber-900/30 rounded-xl overflow-hidden bg-amber-50/30 dark:bg-[#14142a]/30">
      <div className="bg-amber-100/50 dark:bg-amber-900/20 px-4 py-3 flex items-center justify-between border-b border-amber-200 dark:border-amber-900/30">
        <div>
          <h3 className="text-sm font-bold text-amber-800 dark:text-amber-400 flex items-center gap-2">
            <FileClock size={16} />
            ประวัติการแก้ไขสัญญา / ขยายเวลา
          </h3>
          <p className="text-[10px] text-amber-600/80 dark:text-amber-500/80 mt-0.5">
            ส่งผลต่อจำนวนวันของโครงการโดยรวม (เพิ่ม extra_days เข้าไปใน totalDays)
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
              เพิ่มรายการแก้ไขสัญญา
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">วันที่แก้ไขสัญญา *</label>
                <input
                  name="amendment_date"
                  type="date"
                  required
                  className="w-full bg-slate-50 dark:bg-[#14142a] border border-slate-200 dark:border-[#2a2a4a] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">จำนวนวันที่ขยายเพิ่ม (วัน) *</label>
                <input
                  name="extra_days"
                  type="number"
                  required
                  className="w-full bg-slate-50 dark:bg-[#14142a] border border-slate-200 dark:border-[#2a2a4a] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                  placeholder="เช่น 30, 60 (ใส่ติดลบได้ถ้าลดวัน)"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">เหตุผล *</label>
              <textarea
                name="reason"
                required
                rows={2}
                className="w-full bg-slate-50 dark:bg-[#14142a] border border-slate-200 dark:border-[#2a2a4a] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                placeholder="เช่น ขยายเวลาตามมาตรการช่วยเหลือ..."
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
            <p className="text-xs text-amber-700/70 dark:text-amber-500/70">ยังไม่มีประวัติการแก้ไขสัญญา</p>
          </div>
        ) : (
          <div className="space-y-3">
            {amendments.map((a) => (
              <div key={a.id} className="bg-white dark:bg-[#1e1e38] p-4 rounded-xl border border-amber-100 dark:border-amber-900/20 shadow-sm relative group transition-all hover:border-amber-300 dark:hover:border-amber-700/50">
                <div className="flex flex-col sm:flex-row gap-4 justify-between items-start">
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800/50">
                        แก้ไขครั้งที่ {a.amendment_no}
                      </span>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <Calendar size={12} className="text-amber-500" />
                        {new Date(a.amendment_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                    
                    <p className="text-sm font-semibold text-slate-900 dark:text-white mb-1 leading-snug">
                      {a.reason}
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
                        {a.extra_days > 0 ? `+${a.extra_days}` : a.extra_days} <span className="text-xs font-medium">วัน</span>
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
