'use client'

import { useEffect, useRef, useActionState } from 'react'
import { X, Plus, Loader2 } from 'lucide-react'
import { createProject } from '@/app/actions/projects'
import type { ActionState } from '@/lib/types'

interface CreateProjectModalProps {
  onClose: () => void
}

const INITIAL_STATE: ActionState = null

export function CreateProjectModal({ onClose }: CreateProjectModalProps) {
  const [state, formAction, pending] = useActionState(createProject, INITIAL_STATE)
  const formRef = useRef<HTMLFormElement>(null)

  // Close modal on success
  useEffect(() => {
    if (state?.success) {
      onClose()
    }
  }, [state, onClose])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !pending) onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose, pending])

  const inputCls = 'input-base font-medium'
  const labelCls = 'block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onClose()
      }}
    >
      <div className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl animate-scale-in bg-white dark:bg-[#13132a] border border-slate-200 dark:border-[#252548] shadow-2xl">

        {/* Modal header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-white dark:bg-[#13132a] border-b border-slate-100 dark:border-[#1e1e38]">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">สร้างโครงการใหม่</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">กรอกข้อมูลโครงการก่อสร้าง</p>
          </div>
          <button
            id="close-modal"
            onClick={onClose}
            disabled={pending}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1e1e38] transition-all duration-200 disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {/* Error banner */}
        {state?.error && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-600 dark:text-red-400">
            ⚠️ {state.error}
          </div>
        )}

        {/* Form */}
        <form ref={formRef} action={formAction} className="p-6 space-y-5">

          {/* ชื่อโครงการ */}
          <div>
            <label className={labelCls} htmlFor="name">
              ชื่อโครงการ <span className="text-red-500 normal-case tracking-normal">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              placeholder="เช่น โครงการก่อสร้างอาคารสำนักงาน A"
              className={inputCls}
            />
          </div>

          {/* รายละเอียด */}
          <div>
            <label className={labelCls} htmlFor="description">รายละเอียด</label>
            <textarea
              id="description"
              name="description"
              rows={3}
              placeholder="อธิบายรายละเอียดของโครงการ..."
              className={`${inputCls} resize-none`}
            />
          </div>

          {/* สถานที่ + ผู้ควบคุมงาน */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls} htmlFor="location">สถานที่ก่อสร้าง</label>
              <input
                id="location"
                name="location"
                type="text"
                placeholder="เช่น กรุงเทพมหานคร"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="supervisor">
                ผู้ควบคุมงาน <span className="text-red-500 normal-case tracking-normal">*</span>
              </label>
              <input
                id="supervisor"
                name="supervisor"
                type="text"
                required
                placeholder="ชื่อ-นามสกุล"
                className={inputCls}
              />
            </div>
          </div>

          {/* สถานะ + งบประมาณ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls} htmlFor="status">สถานะโครงการ</label>
              <select id="status" name="status" className={inputCls}>
                <option value="รอดำเนินการ">รอดำเนินการ</option>
                <option value="กำลังดำเนินการ">กำลังดำเนินการ</option>
                <option value="เสร็จสิ้น">เสร็จสิ้น</option>
                <option value="ระงับ">ระงับ</option>
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="budget">งบประมาณ (บาท)</label>
              <input
                id="budget"
                name="budget"
                type="number"
                min="0"
                step="10000"
                placeholder="0"
                className={inputCls}
              />
            </div>
          </div>

          {/* วันที่ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls} htmlFor="start_date">วันที่เริ่มต้น</label>
              <input id="start_date" name="start_date" type="date" className={inputCls} />
            </div>
            <div>
              <label className={labelCls} htmlFor="end_date">วันที่สิ้นสุด</label>
              <input id="end_date" name="end_date" type="date" className={inputCls} />
            </div>
          </div>



          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              id="cancel-create"
              type="button"
              onClick={onClose}
              disabled={pending}
              className="flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#252548] hover:bg-slate-50 dark:hover:bg-[#1e1e38] transition-all duration-200 disabled:opacity-50"
            >
              ยกเลิก
            </button>
            <button
              id="submit-create"
              type="submit"
              disabled={pending}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-bold text-white btn-primary disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {pending ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  กำลังบันทึก...
                </>
              ) : (
                <>
                  <Plus size={15} />
                  สร้างโครงการ
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
