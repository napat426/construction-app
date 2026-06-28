'use client'

import { useEffect, useRef, useActionState, useState } from 'react'
import { X, Save, Plus, Loader2 } from 'lucide-react'
import { createTask, updateTask } from '@/app/actions/tasks'
import type { WBSTask, ActionState } from '@/lib/types'

interface TaskModalProps {
  projectId: string
  task?: WBSTask // If present, we are editing
  onClose: () => void
}

const INITIAL_STATE: ActionState = null

export function TaskModal({ projectId, task, onClose }: TaskModalProps) {
  const isEdit = !!task
  
  // Bind action based on edit or create mode
  const boundAction = isEdit 
    ? updateTask.bind(null, projectId, task.id)
    : createTask.bind(null, projectId)

  const [state, formAction, pending] = useActionState(boundAction, INITIAL_STATE)
  const formRef = useRef<HTMLFormElement>(null)

  const [duration, setDuration] = useState<string | number>(() => {
    if (task) return task.duration ?? ''
    return ''
  })
  
  const [cost, setCost] = useState<string | number>(() => {
    if (task) return task.cost ?? ''
    return ''
  })

  const [actualProgress, setActualProgress] = useState<string | number>(() => {
    if (task) return task.actual_progress ?? ''
    return ''
  })

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
      <div className="relative w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-2xl animate-scale-in bg-white dark:bg-[#13132a] border border-slate-200 dark:border-[#252548] shadow-2xl">
        
        {/* Modal header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-white dark:bg-[#13132a] border-b border-slate-100 dark:border-[#1e1e38]">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {isEdit ? 'แก้ไขกิจกรรม WBS' : 'เพิ่มกิจกรรมย่อย WBS'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isEdit ? 'ปรับปรุงแผนงานและความคืบหน้างานย่อย' : 'กำหนดแผนงาน ความยาว และน้ำหนักสำหรับโครงการ'}
            </p>
          </div>
          <button
            id="close-task-modal"
            onClick={onClose}
            disabled={pending}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1e1e38] transition-all duration-200"
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
        <form ref={formRef} action={formAction} className="p-6 space-y-4">
          
          <div className="grid grid-cols-3 gap-4">
            {/* รหัส WBS */}
            <div className="col-span-1">
              <label className={labelCls} htmlFor="wbs_no">
                รหัส WBS <span className="text-red-500">*</span>
              </label>
              <input
                id="wbs_no"
                name="wbs_no"
                type="text"
                required
                defaultValue={task?.wbs_no || ''}
                placeholder="เช่น 1.1 หรือ 2"
                className={inputCls}
              />
            </div>
            
            {/* ชื่อกิจกรรม */}
            <div className="col-span-2">
              <label className={labelCls} htmlFor="name">
                ชื่อกิจกรรม/งานย่อย <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                defaultValue={task?.name || ''}
                placeholder="เช่น งานตอกเสาเข็มเจาะ"
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* วันเริ่มงาน */}
            <div>
              <label className={labelCls} htmlFor="start_date">
                วันที่เริ่มงาน
              </label>
              <input
                id="start_date"
                name="start_date"
                type="date"
                defaultValue={task?.start_date || ''}
                className={inputCls}
              />
              <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 block">
                ไม่ต้องระบุหากมี "งานก่อนหน้า" (คำนวณอัตโนมัติ)
              </span>
            </div>
            
            {/* ระยะเวลาทำงาน */}
            <div>
              <label className={labelCls} htmlFor="duration">
                ระยะเวลา (วัน) <span className="text-red-500">*</span>
              </label>
              <input
                id="duration"
                name="duration"
                type="number"
                min="1"
                required
                value={duration || ''}
                onChange={(e) => setDuration(e.target.value.replace(/^0+(?=\d)/, ''))}
                placeholder="0"
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* มูลค่างาน (Cost) */}
            <div>
              <label className={labelCls} htmlFor="cost">
                มูลค่างาน (บาท)
              </label>
              <input
                id="cost"
                name="cost"
                type="number"
                min="0"
                step="1000"
                value={cost || ''}
                onChange={(e) => setCost(e.target.value.replace(/^0+(?=\d)/, ''))}
                placeholder="0"
                className={inputCls}
              />
            </div>
            
            {/* ความคืบหน้าปัจจุบัน */}
            <div>
              <label className={labelCls} htmlFor="actual_progress">
                ความคืบหน้าจริง (%)
              </label>
              <input
                id="actual_progress"
                name="actual_progress"
                type="number"
                min="0"
                max="100"
                value={actualProgress || ''}
                onChange={(e) => setActualProgress(e.target.value.replace(/^0+(?=\d)/, ''))}
                placeholder="0"
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 items-center pt-2">
            {/* งานก่อนหน้า (Predecessors) */}
            <div>
              <label className={labelCls} htmlFor="predecessors">
                งานก่อนหน้า (WBS No.)
              </label>
              <input
                id="predecessors"
                name="predecessors"
                type="text"
                defaultValue={task?.predecessors || ''}
                placeholder="เช่น 1.1 หรือ 1.2, 2.1"
                className={inputCls}
              />
            </div>
            
            {/* Milestone Checkbox */}
            <div className="flex items-center gap-2 mt-4 select-none">
              <input
                id="is_milestone"
                name="is_milestone"
                type="checkbox"
                value="true"
                defaultChecked={task?.is_milestone || false}
                className="w-4.5 h-4.5 text-primary-600 border-slate-200 dark:border-[#252548] rounded focus:ring-primary-500"
              />
              <label htmlFor="is_milestone" className="text-xs font-bold text-slate-600 dark:text-slate-400 cursor-pointer">
                เป็นกิจกรรมสำคัญ (Milestone)
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-[#1e1e38] mt-6">
            <button
              id="cancel-task-btn"
              type="button"
              onClick={onClose}
              disabled={pending}
              className="flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#252548] hover:bg-slate-50 dark:hover:bg-[#1e1e38] transition-all duration-200 disabled:opacity-50"
            >
              ยกเลิก
            </button>
            <button
              id="submit-task-btn"
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
                  {isEdit ? <Save size={15} /> : <Plus size={15} />}
                  {isEdit ? 'บันทึกการแก้ไข' : 'เพิ่มกิจกรรม'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
