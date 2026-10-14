'use client'

import { useState, useMemo, useEffect } from 'react'
import { Plus, Edit2, Trash2, GripVertical, AlertTriangle, Printer, Calendar, Info, Eye } from 'lucide-react'
import type { Project, WBSTask, ConcretePour } from '@/lib/types'
import type { UserSession } from '@/lib/auth'
import { ConcretePourModal } from './ConcretePourModal'
import { deleteConcretePour, reorderConcretePours } from '@/app/actions/concrete'
import { ReportPresentationModal } from './ReportPresentationModal'

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
  const [selectedIds, setSelectedIds] = useState<string[]>(() => initialPours.map((p) => p.id))
  const [isPresentationOpen, setIsPresentationOpen] = useState(false)
  
  // Drag and Drop State
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null)
  
  // Always update local state when initialPours changes from DB
  useEffect(() => {
    // Sort by sequence or created_at
    const sorted = [...initialPours].sort((a, b) => a.sequence - b.sequence)
    setPours(sorted)
    setSelectedIds(sorted.map((p) => p.id))
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
    else if (diffDays === 0) status = 'critical' // 🔴
    else if (diffDays > 0 && diffDays <= 3) status = 'warning' // 🟡
    
    return { targetDate, diffDays, status }
  }

  return (
    <div className="space-y-6 print:m-0 print:space-y-0">
      <style type="text/css" media="print">{`
        @page {
          size: A4 portrait;
          margin: 8mm 6mm !important;
        }
        html, body {
          background-color: white !important;
          background: white !important;
          color: #0f172a !important;
          font-size: 10px !important;
          width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        header, nav, aside, footer, .print-hidden, .no-print {
          display: none !important;
        }
        .print\\:block {
          display: block !important;
        }
        .print\\:hidden {
          display: none !important;
        }
        table {
          width: 100% !important;
          border-collapse: collapse !important;
          font-size: 9px !important;
        }
        th, td {
          padding: 5px 4px !important;
          border: 1px solid #cbd5e1 !important;
          color: #0f172a !important;
        }
        th {
          background-color: #f8fafc !important;
          font-weight: bold !important;
          text-align: center !important;
        }
        .whitespace-nowrap {
          white-space: nowrap !important;
        }
        th.print-structure-col, td.print-structure-col {
          width: 140px !important;
          max-width: 140px !important;
          white-space: normal !important;
          word-wrap: break-word !important;
        }
        th.print-curing-col, td.print-curing-col {
          width: 260px !important;
          min-width: 260px !important;
        }
      `}</style>
      
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
          {user && (
            <button
              type="button"
              onClick={() => setIsPresentationOpen(true)}
              title="เปิดโหมดนำเสนอเต็มหน้าจอ ซูมเข้า-ออก สำหรับการประชุม"
              className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold text-white bg-slate-800 hover:bg-slate-900 dark:bg-purple-600 dark:hover:bg-purple-700 rounded-xl transition-colors shadow-sm cursor-pointer"
            >
              <Eye size={16} className="text-amber-400" />
              <span>โหมดนำเสนอ</span>
            </button>
          )}

          {user && (
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-[#13132a] border border-slate-200 dark:border-[#252548] rounded-xl hover:bg-slate-50 dark:hover:bg-[#1e1e38] transition-colors shadow-sm"
            >
              <Printer size={16} />
              <span className="hidden sm:inline">พิมพ์รายงาน</span>
            </button>
          )}
          
          {user && (user.role === 'admin' || user.role === 'editor') && (
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
          )}
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
                <th className="px-4 py-3 w-10 text-center print:hidden">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === pours.length && pours.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedIds(pours.map(p => p.id))
                      } else {
                        setSelectedIds([])
                      }
                    }}
                    className="w-4 h-4 rounded text-primary-600 border-slate-300 dark:border-slate-700 focus:ring-primary-500 cursor-pointer"
                  />
                </th>
                {user && (user.role === 'admin' || user.role === 'editor') && (
                  <th className="px-4 py-3 w-10 text-center print:hidden"></th>
                )}
                <th className="px-3 py-3 text-center whitespace-nowrap">เลขที่ / วันที่เท</th>
                <th className="px-3 py-3 text-center print-structure-col">ส่วนโครงสร้าง / กำลังอัด</th>
                <th className="px-3 py-3 text-center whitespace-nowrap">ปริมาณ (m³)</th>
                <th className="px-3 py-3 text-center whitespace-nowrap">สลัมป์ (จริง/สเปก)</th>
                <th className="px-3 py-3 text-center whitespace-nowrap min-w-[250px] print-curing-col">สถานะการบ่ม (28 วัน)</th>
                {user && (user.role === 'admin' || user.role === 'editor') && (
                  <th className="px-3 py-3 w-20 text-center print:hidden">จัดการ</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1e1e38]">
              {pours.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    <Info className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p>ยังไม่มีบันทึกการเทคอนกรีต</p>
                  </td>
                </tr>
              ) : pours.map((pour, idx) => {
                
                // Slump Warning Logic
                let slumpWarning = false
                if (pour.slump_actual != null && pour.slump_spec != null) {
                  const tolerance = pour.slump_tolerance ?? 2.5
                  if (Math.abs(pour.slump_actual - pour.slump_spec) > tolerance) {
                    slumpWarning = true
                  }
                }

                // Curing Logic (28 Days)
                const curing28 = calculateCuring(pour.pour_date, 28)
                const curing7 = calculateCuring(pour.pour_date, 7)
                const curing14 = calculateCuring(pour.pour_date, 14)
                const isSelected = selectedIds.includes(pour.id)

                return (
                  <tr 
                    key={pour.id}
                    draggable={!!(user && (user.role === 'admin' || user.role === 'editor'))}
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDrop={handleDrop}
                    className={`${draggedIdx === idx ? 'opacity-50 bg-slate-50 dark:bg-[#1e1e38]' : 'hover:bg-slate-50 dark:hover:bg-[#1e1e38]/50'} ${!isSelected ? 'print:hidden' : ''} transition-colors print:break-inside-avoid print:border-b print:border-slate-200`}
                  >
                    {/* Checkbox for Print Selection */}
                    <td className="px-4 py-3 text-center print:hidden">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds([...selectedIds, pour.id])
                          } else {
                            setSelectedIds(selectedIds.filter(id => id !== pour.id))
                          }
                        }}
                        className="w-4 h-4 rounded text-primary-600 border-slate-300 dark:border-slate-700 focus:ring-primary-500 cursor-pointer"
                      />
                    </td>
                    {user && (user.role === 'admin' || user.role === 'editor') && (
                      <td className="px-4 py-3 text-center print:hidden">
                        <div className="cursor-grab hover:text-primary-500 text-slate-300 dark:text-slate-600 flex justify-center">
                          <GripVertical size={16} />
                        </div>
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900 dark:text-white print:text-black">{pour.pour_no}</div>
                      <div className="text-xs mt-0.5 flex items-center gap-1 text-slate-500">
                        <Calendar size={12} />
                        {new Date(pour.pour_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
                      </div>
                    </td>
                    <td className="px-4 py-3 print-structure-col">
                      <div className="font-bold text-slate-900 dark:text-white print:text-black">{pour.structure_element || '-'}</div>
                      <div className="text-xs mt-0.5 text-slate-500">
                        {pour.concrete_grade || 'ไม่ระบุกำลังอัด'}
                        {pour.supplier && ` • ${pour.supplier}`}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center font-mono font-medium">
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
                            {pour.slump_spec != null && ` (±${pour.slump_tolerance ?? 2.5})`}
                          </span>
                        </div>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 print-curing-col">
                      <div className="flex flex-col gap-1.5 min-w-[240px]">
                        {/* 7 Days Curing */}
                        <div className="flex items-center justify-between text-xs gap-2">
                          <span className="font-bold text-[10px] text-slate-400 dark:text-slate-500 uppercase whitespace-nowrap">7 วัน</span>
                          <span className="font-mono text-[11px] text-slate-500 whitespace-nowrap">
                            {curing7.targetDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                          </span>
                          <span 
                            className="text-[10px] font-bold px-2.5 py-0.5 rounded-full min-w-[100px] text-center whitespace-nowrap"
                            style={{
                              backgroundColor: curing7.status === 'passed' ? '#f0fdf4' : curing7.status === 'critical' ? '#fef2f2' : curing7.status === 'warning' ? '#fefce8' : '#f8fafc',
                              color: curing7.status === 'passed' ? '#15803d' : curing7.status === 'critical' ? '#b91c1c' : curing7.status === 'warning' ? '#a16207' : '#475569',
                              WebkitPrintColorAdjust: 'exact',
                              printColorAdjust: 'exact'
                            }}
                          >
                            {curing7.status === 'passed' && '✓ ผ่านแล้ว'}
                            {curing7.status === 'critical' && '🔴 ครบกำหนด'}
                            {curing7.status === 'warning' && `🟡 เหลือ ${curing7.diffDays} วัน`}
                            {curing7.status === 'normal' && `เหลือ ${curing7.diffDays} วัน`}
                          </span>
                        </div>

                        {/* 14 Days Curing */}
                        <div className="flex items-center justify-between text-xs gap-2 border-t border-slate-100 dark:border-[#1e1e38]/50 pt-1">
                          <span className="font-bold text-[10px] text-slate-400 dark:text-slate-500 uppercase whitespace-nowrap">14 วัน</span>
                          <span className="font-mono text-[11px] text-slate-500 whitespace-nowrap">
                            {curing14.targetDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                          </span>
                          <span 
                            className="text-[10px] font-bold px-2.5 py-0.5 rounded-full min-w-[100px] text-center whitespace-nowrap"
                            style={{
                              backgroundColor: curing14.status === 'passed' ? '#f0fdf4' : curing14.status === 'critical' ? '#fef2f2' : curing14.status === 'warning' ? '#fefce8' : '#f8fafc',
                              color: curing14.status === 'passed' ? '#15803d' : curing14.status === 'critical' ? '#b91c1c' : curing14.status === 'warning' ? '#a16207' : '#475569',
                              WebkitPrintColorAdjust: 'exact',
                              printColorAdjust: 'exact'
                            }}
                          >
                            {curing14.status === 'passed' && '✓ ผ่านแล้ว'}
                            {curing14.status === 'critical' && '🔴 ครบกำหนด'}
                            {curing14.status === 'warning' && `🟡 เหลือ ${curing14.diffDays} วัน`}
                            {curing14.status === 'normal' && `เหลือ ${curing14.diffDays} วัน`}
                          </span>
                        </div>

                        {/* 28 Days Curing */}
                        <div className="flex items-center justify-between text-xs gap-2 border-t border-slate-100 dark:border-[#1e1e38]/50 pt-1">
                          <span className="font-bold text-[10px] text-slate-400 dark:text-slate-500 uppercase whitespace-nowrap">28 วัน</span>
                          <span className="font-mono text-[11px] text-slate-500 whitespace-nowrap">
                            {curing28.targetDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                          </span>
                          <span 
                            className="text-[10px] font-bold px-2.5 py-0.5 rounded-full min-w-[100px] text-center whitespace-nowrap"
                            style={{
                              backgroundColor: curing28.status === 'passed' ? '#f0fdf4' : curing28.status === 'critical' ? '#fef2f2' : curing28.status === 'warning' ? '#fefce8' : '#f8fafc',
                              color: curing28.status === 'passed' ? '#15803d' : curing28.status === 'critical' ? '#b91c1c' : curing28.status === 'warning' ? '#a16207' : '#475569',
                              WebkitPrintColorAdjust: 'exact',
                              printColorAdjust: 'exact'
                            }}
                          >
                            {curing28.status === 'passed' && '✓ ผ่านแล้ว'}
                            {curing28.status === 'critical' && '🔴 ครบกำหนด'}
                            {curing28.status === 'warning' && `🟡 เหลือ ${curing28.diffDays} วัน`}
                            {curing28.status === 'normal' && `เหลือ ${curing28.diffDays} วัน`}
                          </span>
                        </div>
                      </div>
                    </td>
                    {user && (user.role === 'admin' || user.role === 'editor') && (
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
                    )}
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
            const isSelected = selectedIds.includes(pour.id)
            if (!isSelected) return null
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

      {/* Modal */}
      {modalOpen && (
        <ConcretePourModal
          project_id={project.id}
          tasks={tasks}
          initialData={editData}
          existingPoursCount={pours.length}
          onClose={() => setModalOpen(false)}
        />
      )}

      {/* Presentation Mode Modal */}
      {isPresentationOpen && (
        <ReportPresentationModal
          title={`บันทึกการเทคอนกรีต (Concrete Pour Log) - ${project.name}`}
          subtitle={`ทั้งหมด ${pours.length} รายการ • ติดตามอายุบ่มและค่า Slump`}
          onPrint={() => window.print()}
          onClose={() => setIsPresentationOpen(false)}
        >
          <div className="w-[280mm] min-h-[200mm] bg-white p-8 shadow-2xl rounded-sm text-slate-900 font-sans">
            {/* Header */}
            <div className="text-center border-b-2 border-slate-900 pb-4 mb-5">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">บันทึกการเทคอนกรีต (Concrete Pour Log)</h1>
              <h2 className="text-sm font-bold text-slate-600 mt-1">โครงการ: {project.name}</h2>
              <p className="text-xs text-slate-500 mt-1">
                รายงานสถานะ ณ วันที่ {new Date().toLocaleDateString('th-TH', { dateStyle: 'long' })} • รวมทั้งหมด {pours.length} รายการ
              </p>
            </div>

            {/* Summary KPI Cards */}
            <div className="grid grid-cols-4 gap-3 mb-6">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                <span className="text-[11px] font-bold text-slate-500">จำนวนการเท</span>
                <p className="text-xl font-black text-slate-900 mt-0.5">{pours.length} รายการ</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                <span className="text-[11px] font-bold text-slate-500">ปริมาณคอนกรีตรวม</span>
                <p className="text-xl font-black text-blue-600 mt-0.5">
                  {pours.reduce((sum, p) => sum + (Number(p.volume) || 0), 0).toFixed(1)} คิว
                </p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                <span className="text-[11px] font-bold text-slate-500">บ่มครบกำหนด (28 วัน)</span>
                <p className="text-xl font-black text-emerald-600 mt-0.5">
                  {pours.filter(p => {
                    const age = Math.floor((new Date().getTime() - new Date(p.pour_date).getTime()) / (1000 * 60 * 60 * 24));
                    return age >= 28;
                  }).length} รายการ
                </p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                <span className="text-[11px] font-bold text-slate-500">อยู่ระหว่างการบ่ม</span>
                <p className="text-xl font-black text-amber-600 mt-0.5">
                  {pours.filter(p => {
                    const age = Math.floor((new Date().getTime() - new Date(p.pour_date).getTime()) / (1000 * 60 * 60 * 24));
                    return age < 28;
                  }).length} รายการ
                </p>
              </div>
            </div>

            {/* Table */}
            <div className="border border-slate-300 rounded-lg overflow-hidden mb-6">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-300">
                  <tr>
                    <th className="p-2.5 text-center">ลำดับ</th>
                    <th className="p-2.5 text-center">เลขที่ / วันที่เท</th>
                    <th className="p-2.5">ส่วนโครงสร้าง / กำลังอัด</th>
                    <th className="p-2.5 text-center">ปริมาณ (m³)</th>
                    <th className="p-2.5 text-center">สลัมป์ (จริง/สเปก)</th>
                    <th className="p-2.5 text-center min-w-[240px]">สถานะการบ่ม (28 วัน)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {pours.map((pour, idx) => {
                    const curing28 = calculateCuring(pour.pour_date, 28)
                    const curing7 = calculateCuring(pour.pour_date, 7)
                    let slumpWarning = false
                    if (pour.slump_actual != null && pour.slump_spec != null) {
                      const tolerance = pour.slump_tolerance ?? 2.5
                      if (Math.abs(pour.slump_actual - pour.slump_spec) > tolerance) {
                        slumpWarning = true
                      }
                    }

                    return (
                      <tr key={pour.id} className="hover:bg-slate-50/50">
                        <td className="p-2.5 text-center font-bold text-slate-500">{idx + 1}</td>
                        <td className="p-2.5 text-center">
                          <p className="font-mono font-bold text-slate-900">{pour.pour_no}</p>
                          <p className="text-[10px] text-slate-500">
                            {new Date(pour.pour_date).toLocaleDateString('th-TH', { dateStyle: 'medium' })}
                          </p>
                        </td>
                        <td className="p-2.5">
                          <p className="font-bold text-slate-900">{pour.structure_element}</p>
                          <p className="text-[10px] text-slate-500">
                            {pour.concrete_grade || '-'} • {pour.supplier || '-'}
                          </p>
                        </td>
                        <td className="p-2.5 text-center font-mono font-bold text-slate-900">
                          {pour.volume ? `${Number(pour.volume).toFixed(1)}` : '-'}
                        </td>
                        <td className="p-2.5 text-center">
                          {pour.slump_actual != null ? (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                              slumpWarning ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}>
                              {slumpWarning ? '⚠️ ' : ''}{pour.slump_actual} / {pour.slump_spec ?? '-'}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="p-2.5">
                          <div className="flex flex-col gap-1 min-w-[220px]">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="font-bold text-slate-500">7 วัน:</span>
                              <span className="font-mono text-slate-600">
                                {curing7.targetDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                              </span>
                              <span className={`font-bold px-1.5 py-0.5 rounded text-[9px] ${
                                curing7.status === 'passed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                              }`}>
                                {curing7.status === 'passed' ? '✓ ผ่านแล้ว' : `เหลือ ${curing7.diffDays} วัน`}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="font-bold text-slate-500">28 วัน:</span>
                              <span className="font-mono text-slate-600">
                                {curing28.targetDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                              </span>
                              <span className={`font-bold px-1.5 py-0.5 rounded text-[9px] ${
                                curing28.status === 'passed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                              }`}>
                                {curing28.status === 'passed' ? '✓ ผ่านแล้ว' : `เหลือ ${curing28.diffDays} วัน`}
                              </span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Attached Photos */}
            {pours.some(p => p.photos && p.photos.length > 0) && (
              <div className="mt-6 border-t border-slate-200 pt-4">
                <h4 className="text-xs font-bold text-slate-900 mb-3">รูปภาพประกอบการเทคอนกรีต</h4>
                <div className="grid grid-cols-4 gap-3">
                  {pours.flatMap(p => (p.photos || []).map((url, i) => ({ url, pour_no: p.pour_no, name: p.structure_element, idx: i }))).slice(0, 8).map((photo, pIdx) => (
                    <div key={pIdx} className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50 shadow-xs">
                      <div className="h-28 overflow-hidden bg-slate-100">
                        <img src={photo.url} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div className="p-1.5 text-[10px] text-slate-600 font-medium truncate bg-white border-t border-slate-100">
                        {photo.pour_no} - {photo.name}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Signature */}
            <div className="mt-8 flex justify-end text-center text-xs font-bold border-t border-slate-200 pt-4">
              <div className="w-[220px]">
                <p className="mb-8">ผู้ควบคุมงาน</p>
                <p className="text-slate-400">________________________</p>
                <p className="text-[10px] text-slate-600 mt-1.5">
                  ( {project.supervisor || '...........................................'} )
                </p>
              </div>
            </div>
          </div>
        </ReportPresentationModal>
      )}
    </div>
  )
}
