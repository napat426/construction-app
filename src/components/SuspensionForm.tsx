'use client'

import { useState, useTransition } from 'react'
import { Plus, Trash2, Loader2, Save } from 'lucide-react'
import { saveSuspension, deleteSuspension } from '@/app/actions/suspensions'
import type { ContractSuspension } from '@/lib/types'

interface Props {
  projectId: string
  suspensions: ContractSuspension[]
  onSuccess?: () => void
}

export function SuspensionForm({ projectId, suspensions, onSuccess }: Props) {
  const [isPending, startTransition] = useTransition()
  const [items, setItems] = useState<Partial<ContractSuspension>[]>(
    suspensions.length > 0 ? [...suspensions] : []
  )
  const [error, setError] = useState<string>('')

  const handleAdd = () => {
    setItems([
      ...items,
      {
        project_id: projectId,
        reason: 'หยุดงานกรณีพิเศษ',
        suspend_date: new Date().toISOString().split('T')[0],
        resume_date: null,
        note: '',
      }
    ])
  }

  const handleUpdate = (index: number, key: keyof ContractSuspension, value: any) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [key]: value }
    setItems(newItems)
  }

  const handleSave = (item: Partial<ContractSuspension>, index: number) => {
    setError('')

    // Validation
    if (!item.suspend_date) {
      setError(`รายการที่ ${index + 1}: กรุณาระบุวันที่เริ่มหยุดงาน`)
      return
    }

    if (item.resume_date) {
      const s = new Date(item.suspend_date)
      const r = new Date(item.resume_date)
      if (r <= s) {
        setError(`รายการที่ ${index + 1}: วันที่กลับมาเริ่มงาน ต้องมาหลังวันที่สั่งหยุด`)
        return
      }
    }

    // Check overlaps
    for (let i = 0; i < items.length; i++) {
      if (i === index) continue
      const other = items[i]
      if (other.suspend_date) {
        const os = new Date(other.suspend_date).getTime()
        const or = other.resume_date ? new Date(other.resume_date).getTime() : Infinity
        
        const cs = new Date(item.suspend_date).getTime()
        const cr = item.resume_date ? new Date(item.resume_date).getTime() : Infinity

        if (Math.max(os, cs) < Math.min(or, cr)) {
          setError(`รายการที่ ${index + 1}: วันที่หยุดงานทับซ้อนกับรายการอื่น`)
          return
        }
      }
    }

    startTransition(async () => {
      const formData = new FormData()
      if (item.id) formData.append('id', item.id)
      formData.append('reason', item.reason || '')
      formData.append('suspend_date', item.suspend_date!)
      if (item.resume_date) formData.append('resume_date', item.resume_date)
      if (item.note) formData.append('note', item.note)

      const res = await saveSuspension(projectId, formData)
      if (res?.error) {
        setError(res.error)
      } else {
        if (onSuccess) onSuccess()
      }
    })
  }

  const handleDelete = (id: string | undefined, index: number) => {
    if (id) {
      startTransition(async () => {
        const res = await deleteSuspension(id)
        if (res?.error) {
          setError(res.error)
        } else {
          setItems(items.filter((_, i) => i !== index))
          if (onSuccess) onSuccess()
        }
      })
    } else {
      setItems(items.filter((_, i) => i !== index))
    }
  }

  const inputCls = 'w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#14142a] border-slate-200 dark:border-[#252548] text-slate-900 dark:text-white'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-primary-600 dark:text-primary-400">การหยุดงาน/แก้ไขสัญญา (Suspension)</h3>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">
            ระบุช่วงเวลาที่หยุดงาน วันที่หยุดงานจะไม่ถูกนำมาคำนวณเป็นระยะเวลาดำเนินการของสัญญา
          </p>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 transition-colors"
        >
          <Plus size={13} />
          เพิ่มรายการ
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 text-xs text-red-600 dark:text-red-400 font-medium">
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <div className="p-6 text-center border-2 border-dashed border-slate-200 dark:border-[#252548] rounded-xl text-slate-400 text-sm">
          ไม่มีประวัติการหยุดงาน/แก้ไขสัญญา
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item, idx) => {
            const isSaved = !!item.id
            const statusText = item.resume_date 
              ? `หยุดงาน ${new Date(item.suspend_date!).toLocaleDateString('th-TH')} ถึง ${new Date(item.resume_date).toLocaleDateString('th-TH')}` 
              : `หยุดงานตั้งแต่ ${new Date(item.suspend_date!).toLocaleDateString('th-TH')} (ยังไม่กำหนด)`

            return (
              <div key={item.id || `new-${idx}`} className="p-4 border border-slate-200 dark:border-[#252548] rounded-xl bg-slate-50 dark:bg-[#14142a]/50 flex flex-col gap-3">
                
                {isSaved && (
                  <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-200 dark:border-[#252548]">
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-500/10 px-2 py-1 rounded-md">
                      {statusText}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">เหตุผล</label>
                    <select
                      value={item.reason || ''}
                      onChange={e => handleUpdate(idx, 'reason', e.target.value)}
                      className={inputCls}
                    >
                      <option value="หยุดงานกรณีพิเศษ">หยุดงานกรณีพิเศษ</option>
                      <option value="แก้ไขสัญญา">แก้ไขสัญญา</option>
                      <option value="ส่งมอบพื้นที่ล่าช้า">ส่งมอบพื้นที่ล่าช้า</option>
                      <option value="อื่นๆ">อื่นๆ</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">วันที่สั่งหยุด *</label>
                    <input
                      type="date"
                      value={item.suspend_date || ''}
                      onChange={e => handleUpdate(idx, 'suspend_date', e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">วันที่กลับมาเริ่มงาน</label>
                    <input
                      type="date"
                      value={item.resume_date || ''}
                      onChange={e => handleUpdate(idx, 'resume_date', e.target.value || null)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">หมายเหตุ</label>
                    <input
                      type="text"
                      placeholder="อธิบายเพิ่มเติม..."
                      value={item.note || ''}
                      onChange={e => handleUpdate(idx, 'note', e.target.value)}
                      className={inputCls}
                    />
                  </div>
                </div>
                
                <div className="flex justify-end gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id, idx)}
                    className="px-3 py-1.5 text-xs font-bold text-red-500 hover:text-red-700 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 rounded-lg flex items-center gap-1 transition-colors"
                  >
                    <Trash2 size={13} /> ลบ
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSave(item, idx)}
                    disabled={isPending}
                    className="px-3 py-1.5 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg flex items-center gap-1 transition-colors disabled:opacity-50"
                  >
                    {isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                    {item.id ? 'อัปเดต' : 'บันทึก'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
