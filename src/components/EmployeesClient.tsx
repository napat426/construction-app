'use client'

import { useState, useMemo } from 'react'
import type { Employee } from '@/lib/types'
import { Plus, Search, Edit2, Trash2, Phone, Info } from 'lucide-react'
import EmployeeModal from './EmployeeModal'
import { deleteEmployee } from '@/app/actions/employees'

interface EmployeesClientProps {
  initialEmployees: Employee[]
}

export default function EmployeesClient({ initialEmployees }: EmployeesClientProps) {
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees)
  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const s = search.toLowerCase()
      return (
        emp.employee_id.toLowerCase().includes(s) ||
        emp.first_name.toLowerCase().includes(s) ||
        emp.last_name.toLowerCase().includes(s) ||
        emp.position.toLowerCase().includes(s) ||
        emp.department.toLowerCase().includes(s)
      )
    })
  }, [employees, search])

  const handleDelete = async (id: string) => {
    if (!window.confirm('คุณแน่ใจหรือไม่ที่จะลบพนักงานรายนี้?')) return

    setIsDeleting(id)
    const res = await deleteEmployee(id)
    if (res.success) {
      setEmployees(prev => prev.filter(e => e.id !== id))
    } else {
      alert('เกิดข้อผิดพลาดในการลบพนักงาน: ' + res.error)
    }
    setIsDeleting(null)
  }

  const handleSave = (savedEmployee: Employee) => {
    if (editingEmployee) {
      setEmployees(prev => prev.map(e => e.id === savedEmployee.id ? savedEmployee : e))
    } else {
      setEmployees(prev => [...prev, savedEmployee])
    }
  }

  return (
    <div className="flex flex-col h-full w-full">
      {/* Toolbar */}
      <div className="p-4 border-b border-slate-200 dark:border-[#1c1c34] flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-slate-50/50 dark:bg-[#0a0a14]/50">
        <div className="relative w-full sm:w-80">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหา ชื่อ, รหัส, ตำแหน่ง..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-[#14142a] border border-slate-200 dark:border-[#252548] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all dark:text-white"
          />
        </div>
        <button
          onClick={() => {
            setEditingEmployee(null)
            setIsModalOpen(true)
          }}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold rounded-xl shadow-md transition-colors whitespace-nowrap"
        >
          <Plus size={16} />
          เพิ่มพนักงาน
        </button>
      </div>

      {/* Table Content */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="sticky top-0 bg-slate-100 dark:bg-[#14142a] z-10 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider shadow-sm">
            <tr>
              <th className="px-6 py-4">#</th>
              <th className="px-6 py-4">รหัสพนักงาน</th>
              <th className="px-6 py-4">ชื่อ - นามสกุล</th>
              <th className="px-6 py-4">ตำแหน่ง</th>
              <th className="px-6 py-4">สังกัด</th>
              <th className="px-6 py-4">ปีเกษียณ</th>
              <th className="px-6 py-4">ข้อมูลติดต่อ</th>
              <th className="px-6 py-4 text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-[#1c1c34]">
            {filteredEmployees.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                  ไม่พบข้อมูลพนักงาน
                </td>
              </tr>
            ) : (
              filteredEmployees.map((emp, idx) => (
                <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-[#1a1a32] transition-colors group">
                  <td className="px-6 py-4 text-slate-400">{idx + 1}</td>
                  <td className="px-6 py-4 font-mono font-medium text-slate-700 dark:text-slate-300">
                    {emp.employee_id}
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-900 dark:text-white">
                      {emp.first_name} {emp.last_name}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                    {emp.position}
                  </td>
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-400 max-w-[200px] truncate" title={emp.department}>
                    {emp.department}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 bg-slate-100 dark:bg-[#252548] text-slate-600 dark:text-slate-300 rounded-lg font-medium text-xs">
                      {emp.retirement_year || '-'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      {emp.phone_number ? (
                        <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 text-xs">
                          <Phone size={12} /> {emp.phone_number}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">ไม่มีข้อมูลเบอร์โทร</span>
                      )}
                      {emp.other_info && (
                        <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-500 text-xs" title={emp.other_info}>
                          <Info size={12} /> ข้อมูลเพิ่มเติม
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => {
                          setEditingEmployee(emp)
                          setIsModalOpen(true)
                        }}
                        className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 hover:bg-amber-500 hover:text-white flex items-center justify-center transition-colors"
                        title="แก้ไขข้อมูล"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(emp.id)}
                        disabled={isDeleting === emp.id}
                        className="w-8 h-8 rounded-lg bg-red-500/10 text-red-600 hover:bg-red-500 hover:text-white flex items-center justify-center transition-colors disabled:opacity-50"
                        title="ลบพนักงาน"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer stat */}
      <div className="p-4 border-t border-slate-200 dark:border-[#1c1c34] bg-slate-50 dark:bg-[#0a0a14] text-xs font-medium text-slate-500 dark:text-slate-400 flex justify-between items-center">
        <span>แสดงข้อมูล {filteredEmployees.length} จาก {employees.length} รายการ</span>
      </div>

      {isModalOpen && (
        <EmployeeModal
          employee={editingEmployee}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
