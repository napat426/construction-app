'use client'

import React, { useState } from 'react'
import { X, FolderPlus } from 'lucide-react'
import type { SupervisorTaskGroup } from '@/lib/types'

interface Props {
  initialGroup?: Partial<SupervisorTaskGroup> | null
  supervisor: string
  onClose: () => void
  onSave: (group: Partial<SupervisorTaskGroup> & { supervisor: string; name: string }) => Promise<void>
}

const COLOR_OPTIONS = [
  { id: 'emerald', name: 'เขียว', class: 'bg-emerald-500' },
  { id: 'blue', name: 'น้ำเงิน', class: 'bg-blue-500' },
  { id: 'amber', name: 'ส้ม/ทอง', class: 'bg-amber-500' },
  { id: 'purple', name: 'ม่วง', class: 'bg-purple-500' },
  { id: 'rose', name: 'แดง/ชมพู', class: 'bg-rose-500' },
  { id: 'sky', name: 'ฟ้า', class: 'bg-sky-500' },
]

export function SupervisorGroupModal({
  initialGroup,
  supervisor,
  onClose,
  onSave,
}: Props) {
  const [name, setName] = useState(initialGroup?.name || '')
  const [color, setColor] = useState(initialGroup?.color || 'blue')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('กรุณาระบุชื่อกลุ่มงาน')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      await onSave({
        id: initialGroup?.id,
        supervisor,
        name: name.trim(),
        color,
      })
      onClose()
    } catch (err: any) {
      setError(err.message || 'บันทึกไม่สำเร็จ')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-white dark:bg-[#121226] border border-slate-200 dark:border-[#252548] rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-[#202042] flex items-center justify-between bg-slate-50/70 dark:bg-[#16162e]">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FolderPlus size={16} className="text-primary-600 dark:text-primary-400" />
            {initialGroup?.id ? 'แก้ไขกลุ่มงาน' : 'เพิ่มกลุ่มงานใหม่'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-600 dark:text-red-400 font-semibold">
              ⚠️ {error}
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              ชื่อกลุ่มงาน / หมวดหมู่ภารกิจ <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="เช่น งานสำรวจรังวัด, งานออกแบบร่าง, งานตรวจการจ้าง..."
              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-[#252548] bg-white dark:bg-[#181834] text-slate-900 dark:text-white focus:outline-none focus:border-primary-500 font-medium"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
              สีประจำกลุ่มงาน
            </label>
            <div className="flex gap-2">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setColor(c.id)}
                  className={`w-7 h-7 rounded-full ${c.class} transition-all cursor-pointer flex items-center justify-center ${
                    color === c.id ? 'ring-3 ring-offset-2 ring-primary-500 scale-110' : 'opacity-70 hover:opacity-100'
                  }`}
                  title={c.name}
                >
                  {color === c.id && <span className="text-white text-xs">✓</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-[#202042] flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-[#252548] text-slate-600 dark:text-slate-300 hover:bg-slate-100 text-xs font-bold cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold cursor-pointer shadow-sm"
            >
              {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกกลุ่มงาน'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
