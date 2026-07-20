'use client'

import { useState } from 'react'
import type { Employee } from '@/lib/types'
import { X, Save, User } from 'lucide-react'
import { createEmployee, updateEmployee } from '@/app/actions/employees'

interface EmployeeModalProps {
  employee: Employee | null
  onClose: () => void
  onSave: (employee: Employee) => void
}

export default function EmployeeModal({ employee, onClose, onSave }: EmployeeModalProps) {
  const isEditing = !!employee
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    employee_id: employee?.employee_id || '',
    first_name: employee?.first_name || '',
    last_name: employee?.last_name || '',
    position: employee?.position || '',
    department: employee?.department || 'กรย.(ก3)',
    retirement_year: employee?.retirement_year || '',
    phone_number: employee?.phone_number || '',
    other_info: employee?.other_info || '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const payload = {
        employee_id: formData.employee_id,
        first_name: formData.first_name,
        last_name: formData.last_name,
        position: formData.position,
        department: formData.department,
        retirement_year: formData.retirement_year ? parseInt(formData.retirement_year.toString(), 10) : null,
        phone_number: formData.phone_number || null,
        other_info: formData.other_info || null,
      }

      let res
      if (isEditing && employee) {
        res = await updateEmployee(employee.id, payload)
      } else {
        res = await createEmployee(payload)
      }

      if (res.success && res.data) {
        onSave(res.data)
        onClose()
      } else {
        setError(res.error || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล')
      }
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div
        className="w-full max-w-2xl bg-white dark:bg-[#14142a] rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-200 dark:border-[#252548] animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-[#252548]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-500/10 flex items-center justify-center text-primary-600 dark:text-primary-400">
              <User size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                {isEditing ? 'แก้ไขข้อมูลพนักงาน' : 'เพิ่มพนักงานใหม่'}
              </h2>
              <p className="text-xs text-slate-500 font-medium">กรอกรายละเอียดให้ครบถ้วน</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-500/10 text-sm text-red-600 dark:text-red-400 font-medium border border-red-200 dark:border-red-500/20">
              {error}
            </div>
          )}

          <form id="employeeForm" onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">รหัสพนักงาน <span className="text-red-500">*</span></label>
                <input
                  required
                  name="employee_id"
                  value={formData.employee_id}
                  onChange={handleChange}
                  placeholder="เช่น 466858"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#0a0a14] border border-slate-200 dark:border-[#252548] rounded-xl text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all dark:text-white font-mono"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">ปีเกษียณอายุ (พ.ศ.)</label>
                <input
                  name="retirement_year"
                  type="number"
                  value={formData.retirement_year}
                  onChange={handleChange}
                  placeholder="เช่น 2582"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#0a0a14] border border-slate-200 dark:border-[#252548] rounded-xl text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all dark:text-white font-mono"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">ชื่อ <span className="text-red-500">*</span></label>
                <input
                  required
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  placeholder="ชื่อจริง (ไม่ต้องใส่คำนำหน้าถ้าไม่มี)"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#0a0a14] border border-slate-200 dark:border-[#252548] rounded-xl text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all dark:text-white"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">นามสกุล <span className="text-red-500">*</span></label>
                <input
                  required
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleChange}
                  placeholder="นามสกุล"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#0a0a14] border border-slate-200 dark:border-[#252548] rounded-xl text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all dark:text-white"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">ตำแหน่ง <span className="text-red-500">*</span></label>
                <input
                  required
                  name="position"
                  value={formData.position}
                  onChange={handleChange}
                  placeholder="เช่น อก., รก., พชง.7"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#0a0a14] border border-slate-200 dark:border-[#252548] rounded-xl text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all dark:text-white"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">สังกัด <span className="text-red-500">*</span></label>
                <input
                  required
                  name="department"
                  value={formData.department}
                  onChange={handleChange}
                  placeholder="สังกัดหน่วยงาน"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#0a0a14] border border-slate-200 dark:border-[#252548] rounded-xl text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all dark:text-white"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">เบอร์โทรศัพท์ (ถ้ามี)</label>
                <input
                  name="phone_number"
                  value={formData.phone_number}
                  onChange={handleChange}
                  placeholder="เช่น 0812345678"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#0a0a14] border border-slate-200 dark:border-[#252548] rounded-xl text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all dark:text-white"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">ข้อมูลอื่นๆ (เพิ่มเติม)</label>
                <textarea
                  name="other_info"
                  value={formData.other_info}
                  onChange={handleChange}
                  rows={3}
                  placeholder="หมายเหตุ หรือ ข้อมูลอื่นๆ ของพนักงาน"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#0a0a14] border border-slate-200 dark:border-[#252548] rounded-xl text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all dark:text-white resize-none"
                />
              </div>
            </div>
          </form>
        </div>

        <div className="p-6 border-t border-slate-200 dark:border-[#252548] bg-slate-50 dark:bg-[#0d0d1c] flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl font-bold text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            form="employeeForm"
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-xl font-bold text-sm text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md flex items-center gap-2"
          >
            {isSubmitting ? 'กำลังบันทึก...' : (
              <>
                <Save size={16} /> บันทึกข้อมูล
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
