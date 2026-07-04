'use client'

import { useState, useMemo, useEffect } from 'react'
import { Plus, Edit2, Trash2, GripVertical, AlertTriangle, Printer, Calendar, Info } from 'lucide-react'
import type { Project, WBSTask, ConcretePour } from '@/lib/types'
import type { UserSession } from '@/lib/auth'
import { ConcretePourModal } from './ConcretePourModal'
import { deleteConcretePour, reorderConcretePours } from '@/app/actions/concrete'

interface Props {
  project: Project
  tasks: WBSTask[]
  pours: ConcretePour[]
  user?: UserSession | null
}

export function ConcretePoursTab({ project, tasks, pours: initialPours, user }: Props) {
  const [pours, setPours] = useState<ConcretePour[]>(initialPours)
  const [modalOpen, setModalOpen] = useState(false)
  const [editData, setEditData] = useState<ConcretePour | null>(null)
  
  // Drag and Drop State
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null)
  
  // Always update local state when initialPours changes from DB
  useEffect(() => {
    // Sort by sequence or created_at
    const sorted = [...initialPours].sort((a, b) => a.sequence - b.sequence)
    setPours(sorted)
  }, [initialPours])

  const handleDragStart = (e: React.DragEvent, idx: number) => {
    setDraggedIdx(idx)
    e.dataTransfer.effectAllowed = 'move'
    // For ghost image
    const target = e.target as HTMLElement
    e.dataTransfer.setDragImage(target, 20, 20)
  }

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    
    if (draggedIdx === null || draggedIdx === idx) return
    
    const newPours = [...pours]
    const item = newPours.splice(draggedIdx, 1)[0]
    newPours.splice(idx, 0, item)
    
    setDraggedIdx(idx)
    setPours(newPours)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setDraggedIdx(null)
    
    // Save to DB
    const updates = pours.map((p, i) => ({ id: p.id, sequence: i }))
    await reorderConcretePours(project.id, updates)
  }

  const handleDelete = async (id: string) => {
    if (confirm('คุณต้องการลบรายการนี้ใช่หรือไม่?')) {
      await deleteConcretePour(id, project.id)
    }
  }

  const today = new Date()
  today.setHours(0,0,0,0)

  const calculateCuring = (pourDateStr: string, days: number) => {
    const pourDate = new Date(pourDateStr)
    pourDate.setHours(0,0,0,0)
    
    const targetDate = new Date(pourDate.getTime() + days * 24 * 60 * 60 * 1000)
    const diffTime = targetDate.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    let status = 'normal' // 🟢
    if (diffDays < 0) status = 'passed' // ✓
    else if (diffDays === 0 || diffDays === 1) status = 'critical' // 🔴
    else if (diffDays <= 3) status = 'warning' // 🟡
    
    return { targetDate, diffDays, status }
  }

  return (
    <div className="space-y-6 print:m-0 print:space-y-0">
      
      {/* ── Control Bar ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            บันทึกการเทคอนกรีต
            <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs px-2 py-0.5 rounded-full font-bold">
              {pours.length} รายการ
            </span>
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            บันทึกประวัติการเทคอนกรีต, ค่า Slump และคำนวณอายุบ่มอัตโนมัติ
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-[#13132a] border border-slate-200 dark:border-[#252548] rounded-xl hover:bg-slate-50 dark:hover:bg-[#1e1e38] transition-colors shadow-sm"
          >
            <Printer size={16} />
            <span className="hidden sm:inline">พิมพ์รายงาน</span>
          </button>
          
          <button
            onClick={() => {
              setEditData(null)
              setModalOpen(true)
            }}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white rounded-xl btn-primary cursor-pointer hover:shadow-lg transition-all"
          >
            <Plus size={18} />
            <span>เพิ่มการเท</span>
          </button>
        </div>
      </div>

      {/* ── Print Header (Only visible when printing) ── */}
      <div className="hidden print:block text-center mb-6">
        <h1 className="text-2xl font-bold mb-2">บันทึกการเทคอนกรีต (Concrete Pour Log)</h1>
        <h2 className="text-lg">โครงการ: {project.name}</h2>
      </div>

      {/* ── Table ── */}
      <div className="bg-white dark:bg-[#13132a] border border-slate-200 dark:border-[#252548] rounded-xl overflow-hidden shadow-sm print:border-none print:shadow-none print:bg-transparent">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-[#1e1e38] text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-[#252548] print:bg-transparent print:text-black">
              <tr>
                <th className="px-4 py-3 w-10 text-center print:hidden"></th>
                <th className="px-4 py-3 whitespace-nowrap">เลขที่ / วันที่เท</th>
                <th className="px-4 py-3">ส่วนโครงสร้าง / กำลังอัด</th>
                <th className="px-4 py-3 text-right">ปริมาณ (m³)</th>
                <th className="px-4 py-3 text-center">สลัมป์ (จริง/สเปก)</th>
                <th className="px-4 py-3 w-64">สถานะการบ่ม (28 วัน)</th>
                <th className="px-4 py-3 w-20 text-center print:hidden">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1e1e38]">
              {pours.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    <Info className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p>ยังไม่มีบันทึกการเทคอนกรีต</p>
                  </td>
                </tr>
              ) : pours.map((pour, idx) => {
                
                // Slump Warning Logic
                let slumpWarning = false
                if (pour.slump_actual != null && pour.slump_spec != null) {
                  if (Math.abs(pour.slump_actual - pour.slump_spec) > 2.5) {
                    slumpWarning = true
                  }
                }

                // Curing Logic (28 Days)
                const curing28 = calculateCuring(pour.pour_date, 28)
                const curing7 = calculateCuring(pour.pour_date, 7)
                const curing14 = calculateCuring(pour.pour_date, 14)

                return (
                  <tr 
                    key={pour.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDrop={handleDrop}
                    className={`${draggedIdx === idx ? 'opacity-50 bg-slate-50 dark:bg-[#1e1e38]' : 'hover:bg-slate-50 dark:hover:bg-[#1e1e38]/50'} transition-colors print:break-inside-avoid print:border-b print:border-slate-200`}
                  >
                    <td className="px-4 py-3 text-center print:hidden">
                      <div className="cursor-grab hover:text-primary-500 text-slate-300 dark:text-slate-600 flex justify-center">
                        <GripVertical size={16} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900 dark:text-white print:text-black">{pour.pour_no}</div>
                      <div className="text-xs mt-0.5 flex items-center gap-1 text-slate-500">
                        <Calendar size={12} />
                        {new Date(pour.pour_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900 dark:text-white print:text-black">{pour.structure_element || '-'}</div>
                      <div className="text-xs mt-0.5 text-slate-500">
                        {pour.concrete_grade || 'ไม่ระบุกำลังอัด'}
                        {pour.supplier && ` • ${pour.supplier}`}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium">
                      {pour.volume ? pour.volume.toFixed(2) : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {(pour.slump_actual != null || pour.slump_spec != null) ? (
                        <div className="inline-flex items-center justify-center gap-1.5 px-2 py-1 rounded border print:border-slate-300" 
                             style={{ 
                               borderColor: slumpWarning ? '#fca5a5' : '#86efac',
                               backgroundColor: slumpWarning ? '#fef2f2' : '#f0fdf4',
                               color: slumpWarning ? '#991b1b' : '#166534',
                               WebkitPrintColorAdjust: 'exact',
                               printColorAdjust: 'exact'
                             }}>
                          {slumpWarning ? <AlertTriangle size={12} /> : null}
                          <span className="font-mono font-bold text-xs">
                            {pour.slump_actual ?? '-'} / {pour.slump_spec ?? '-'}
                          </span>
                        </div>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold w-10">28 วัน</span>
                          <div 
                            className="text-xs font-medium px-2 py-0.5 rounded-full"
                            style={{
                              backgroundColor: curing28.status === 'passed' ? '#f0fdf4' : curing28.status === 'critical' ? '#fef2f2' : curing28.status === 'warning' ? '#fefce8' : '#f8fafc',
                              color: curing28.status === 'passed' ? '#166534' : curing28.status === 'critical' ? '#991b1b' : curing28.status === 'warning' ? '#854d0e' : '#475569',
                              WebkitPrintColorAdjust: 'exact',
                              printColorAdjust: 'exact'
                            }}
                          >
                            {curing28.targetDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
                            {curing28.status !== 'passed' && curing28.diffDays > 0 && ` (เหลือ ${curing28.diffDays} วัน)`}
                            {curing28.status === 'passed' && ' (ผ่านแล้ว)'}
                            {curing28.status === 'critical' && ' (ครบกำหนด)'}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500">
                          <span className="w-10 text-right">7 วัน:</span>
                          <span>{curing7.targetDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</span>
                          <span className="mx-1">|</span>
                          <span>14 วัน:</span>
                          <span>{curing14.targetDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center print:hidden">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => {
                            setEditData(pour)
                            setModalOpen(true)
                          }}
                          className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded transition-colors"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(pour.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Print Photos ── */}
      <div className="hidden print:block mt-8">
        <h3 className="text-lg font-bold mb-4">รูปภาพและบิลอ้างอิง</h3>
        <div className="grid grid-cols-2 gap-4">
          {pours.map(pour => {
            if (!pour.photos || pour.photos.length === 0) return null
            return (
              <div key={`photo-${pour.id}`} className="print:break-inside-avoid mb-6">
                <p className="font-bold mb-2">{pour.pour_no} - {pour.structure_element}</p>
                <div className="flex flex-wrap gap-2">
                  {pour.photos.map((url, i) => (
                    <img key={i} src={url} alt="Photo" className="w-48 h-48 object-cover rounded border border-slate-300" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Print Signatures ── */}
      <div className="hidden print:block mt-16 pt-8 text-right print:break-inside-avoid">
        <div className="inline-block text-center pr-8">
          <p className="mb-12">ลงชื่อผู้ควบคุมงาน</p>
          <p>...........................................................</p>
          <p className="mt-2">( {project.supervisor || '                                   '} )</p>
        </div>
      </div>

      {/* ── Modal ── */}
      {modalOpen && (
        <ConcretePourModal
          project_id={project.id}
          tasks={tasks}
          initialData={editData}
          existingPoursCount={pours.length}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  )
}
