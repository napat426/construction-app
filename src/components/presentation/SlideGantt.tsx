'use client'

import { useMemo } from 'react'
import type { Project, WBSTask } from '@/lib/types'
import { computeTaskDates } from '@/lib/scheduler'

interface Props {
  project: Project
  tasks: WBSTask[]
  theme: 'dark' | 'light'
}

export function SlideGantt({ project, tasks, theme }: Props) {
  const isDark = theme === 'dark'

  // Sort and filter tasks (max 15 tasks to prevent overflow, filter level 1 WBS if too many)
  const displayTasks = useMemo(() => {
    let sorted = [...tasks].sort((a, b) => {
      const aParts = a.wbs_no.split('.').map(Number)
      const bParts = b.wbs_no.split('.').map(Number)
      for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const aVal = aParts[i] || 0
        const bVal = bParts[i] || 0
        if (aVal !== bVal) return aVal - bVal
      }
      return 0
    })

    if (sorted.length > 15) {
      // Filter level 1 WBS (no dot)
      sorted = sorted.filter(t => !t.wbs_no.includes('.'))
      // If still too many, just slice it
      if (sorted.length > 15) sorted = sorted.slice(0, 15)
    }

    // compute dates
    return computeTaskDates(sorted, project.start_date)
  }, [tasks, project.start_date])

  const hasHiddenTasks = tasks.length > displayTasks.length

  // Calculate grid and bounds
  const { minDate, maxDate, totalDays } = useMemo(() => {
    if (displayTasks.length === 0 || !project.start_date) return { minDate: new Date(), maxDate: new Date(), totalDays: 1 }

    let min = new Date(project.start_date)
    min.setHours(0,0,0,0)
    let max = new Date(min)

    if (project.end_date) {
      const e = new Date(project.end_date)
      e.setHours(0,0,0,0)
      if (e > max) max = e
    }

    displayTasks.forEach(t => {
      const sd = new Date(t.computedStartDate)
      const ed = new Date(t.computedEndDate)
      if (sd < min) min = sd
      if (ed > max) max = ed
    })

    const today = new Date()
    today.setHours(0,0,0,0)
    if (today > max) max = today

    // Add padding
    max = new Date(max.getTime() + 15 * 24 * 60 * 60 * 1000)
    min = new Date(min.getTime() - 5 * 24 * 60 * 60 * 1000)

    const totalDays = Math.ceil((max.getTime() - min.getTime()) / (1000 * 60 * 60 * 24))

    return { minDate: min, maxDate: max, totalDays: totalDays > 0 ? totalDays : 1 }
  }, [displayTasks, project.start_date, project.end_date])

  const today = new Date()
  today.setHours(0,0,0,0)

  return (
    <div className={`h-full flex flex-col p-8 rounded-3xl ${isDark ? 'bg-[#14142a] border-[#1c1c34]' : 'bg-white border-slate-200'} border shadow-xl`}>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>แผนการดำเนินงาน (Gantt Chart)</h2>
          <p className={`text-lg mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>โครงการ: {project.name}</p>
        </div>
        {hasHiddenTasks && (
          <div className={`px-4 py-2 rounded-full text-sm font-bold ${isDark ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-100 text-indigo-700'}`}>
            *แสดงเฉพาะงานหลัก (Level 1) {displayTasks.length} รายการ
          </div>
        )}
      </div>

      <div className="flex-1 overflow-hidden flex flex-col mt-4">
        <div className={`flex font-bold text-sm py-3 border-b ${isDark ? 'border-white/10 text-slate-400' : 'border-black/10 text-slate-600'}`}>
          <div className="w-[120px] flex-shrink-0 px-2">WBS No.</div>
          <div className="w-[300px] flex-shrink-0 px-2">ชื่องาน</div>
          <div className="w-[80px] flex-shrink-0 text-center">% จริง</div>
          <div className="flex-1 relative border-l border-white/10 ml-4">
            <div className="absolute inset-0 flex justify-between px-2 text-xs">
              <span>{minDate.toLocaleDateString('th-TH', { month: 'short', year: '2-digit' })}</span>
              <span>{maxDate.toLocaleDateString('th-TH', { month: 'short', year: '2-digit' })}</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto mt-2 relative">
          {/* Vertical Grid Lines */}
          <div className="absolute inset-y-0 left-[516px] right-0 pointer-events-none flex">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className={`flex-1 border-r ${isDark ? 'border-white/5' : 'border-black/5'} h-full`} />
            ))}
          </div>

          {/* Today Line */}
          {today >= minDate && today <= maxDate && (
            <div 
              className="absolute inset-y-0 border-l-2 border-yellow-500 border-dashed z-10 pointer-events-none"
              style={{
                left: `calc(516px + ((100% - 516px) * ${(today.getTime() - minDate.getTime()) / (totalDays * 24 * 60 * 60 * 1000)}))`
              }}
            >
              <div className="bg-yellow-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded -translate-x-1/2 -top-2 absolute">
                วันนี้
              </div>
            </div>
          )}

          {displayTasks.map((task, idx) => {
            const sd = new Date(task.computedStartDate)
            const ed = new Date(task.computedEndDate)
            
            const startRatio = (sd.getTime() - minDate.getTime()) / (totalDays * 24 * 60 * 60 * 1000)
            const widthRatio = Math.max(0, (ed.getTime() - sd.getTime()) / (totalDays * 24 * 60 * 60 * 1000))
            const actualRatio = Math.min(1, Math.max(0, (task.actual_progress || 0) / 100))

            const isMilestone = task.duration === 0

            return (
              <div key={task.id} className={`flex items-center py-4 ${idx !== displayTasks.length - 1 ? (isDark ? 'border-b border-white/5' : 'border-b border-black/5') : ''}`}>
                <div className={`w-[120px] flex-shrink-0 px-2 font-mono text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{task.wbs_no}</div>
                <div className={`w-[300px] flex-shrink-0 px-2 text-sm font-bold truncate ${isDark ? 'text-white' : 'text-slate-800'}`} title={task.name}>{task.name}</div>
                <div className={`w-[80px] flex-shrink-0 text-center font-bold text-sm ${isDark ? 'text-[#a13c9d]' : 'text-purple-600'}`}>
                  {task.actual_progress || 0}%
                </div>
                
                <div className="flex-1 relative h-8 ml-4">
                  {isMilestone ? (
                    <div 
                      className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-[#a13c9d] rotate-45 z-10"
                      style={{ left: `calc(${startRatio * 100}% - 8px)` }}
                    />
                  ) : (
                    <>
                      {/* Plan Bar */}
                      <div 
                        className={`absolute top-2 h-4 rounded-sm ${isDark ? 'bg-white/20' : 'bg-slate-300'} transition-all`}
                        style={{
                          left: `${startRatio * 100}%`,
                          width: `${widthRatio * 100}%`
                        }}
                      />
                      {/* Actual Progress Bar */}
                      {task.actual_progress > 0 && (
                        <div 
                          className="absolute top-3 h-2 rounded-sm bg-[#a13c9d]/85 z-10"
                          style={{
                            left: `${startRatio * 100}%`,
                            width: `${widthRatio * actualRatio * 100}%`
                          }}
                        />
                      )}
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
