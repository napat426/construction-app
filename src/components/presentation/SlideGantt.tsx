'use client'

import { useMemo } from 'react'
import type { Project, WBSTask } from '@/lib/types'
import { computeTaskDates } from '@/lib/scheduler'

interface Props {
  project?: Project
  tasks: WBSTask[]
  
  amendments?: import('@/lib/types').ContractAmendment[]
  theme: 'light' | 'dark'
}

export function SlideGantt({ project, tasks, amendments = [], theme }: Props) {
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
    return computeTaskDates(sorted, project?.start_date || new Date().toISOString(), amendments)
  }, [tasks, project?.start_date, amendments])

  const hasHiddenTasks = tasks.length > displayTasks.length

  // Calculate grid and bounds
  const { minDate, maxDate, totalDays } = useMemo(() => {
    if (displayTasks.length === 0 || !project?.start_date) return { minDate: new Date(), maxDate: new Date(), totalDays: 1 }

    let min = new Date(project.start_date)
    min.setHours(0,0,0,0)
    let max = new Date(min)

    if (project?.end_date) {
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
  }, [displayTasks, project?.start_date, project?.end_date])

  const today = new Date()
  today.setHours(0,0,0,0)

  return (
    <div className={`h-full flex flex-col p-8 rounded-3xl ${isDark ? 'bg-[#14142a] border-[#1c1c34]' : 'bg-white border-slate-200'} border shadow-xl`}>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>แผนการดำเนินงาน (Gantt Chart)</h2>
          <p className={`text-lg mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>โครงการ: {project?.name}</p>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded ${isDark ? 'bg-white/20' : 'bg-slate-300'}`}></div>
            <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>แผนงาน</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded ${isDark ? 'bg-[#a13c9d]/85' : 'bg-purple-600/85'}`}></div>
            <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>ความคืบหน้า</span>
          </div>
          {amendments && amendments.filter(a => a.amendment_type === 'suspend_with_resume' || a.amendment_type === 'suspend_open').length > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSJ0cmFuc3BhcmVudCI+PC9yZWN0Pgo8cGF0aCBkPSJNMCA4TDggMFpNOCAxNkwxNiA4Wk0tOCAwTDAgLThaIiBzdHJva2U9InJnYmEoMjM5LCA2OCwgNjgsIDAuMikiIHN0cm9rZS13aWR0aD0iMSI+PC9wYXRoPgo8L3N2Zz4=')] border border-red-500/30 bg-red-50/10"></div>
              <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>ช่วงหยุดงาน</span>
            </div>
          )}
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
          <div className={`flex-1 relative border-l ml-4 ${isDark ? 'border-white/10' : 'border-black/10'}`}>
            <div className="absolute inset-0 flex px-2 text-xs text-center justify-between">
              {Array.from({ length: 11 }).map((_, i) => {
                const ratio = i / 10
                const date = new Date(minDate.getTime() + ratio * (maxDate.getTime() - minDate.getTime()))
                return (
                  <div 
                    key={i} 
                    className={`absolute whitespace-nowrap ${i === 0 ? 'translate-x-0' : i === 10 ? '-translate-x-full' : '-translate-x-1/2'}`} 
                    style={{ left: `${ratio * 100}%` }}
                  >
                    {date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
                  </div>
                )
              })}
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

          {/* Suspension Bands */}
          {amendments?.filter(a => (a.amendment_type === 'suspend_with_resume' || a.amendment_type === 'suspend_open') && !!a.suspend_date).map((suspension, idx) => {
            const suspDate = new Date(suspension.suspend_date!)
            suspDate.setHours(0,0,0,0)
            const resumeDate = suspension.resume_date ? new Date(suspension.resume_date) : new Date(today)
            resumeDate.setHours(0,0,0,0)
            
            if (resumeDate < minDate || suspDate > maxDate) return null
            
            const startRatio = Math.max(0, (suspDate.getTime() - minDate.getTime()) / (totalDays * 24 * 60 * 60 * 1000))
            const endRatio = Math.min(1, (resumeDate.getTime() - minDate.getTime()) / (totalDays * 24 * 60 * 60 * 1000))
            const widthRatio = endRatio - startRatio

            return (
              <div 
                key={idx}
                className="absolute top-0 bottom-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPjxyZWN0IHdpZHRoPSI4IiBoZWlnaHQ9IjgiIGZpbGw9InRyYW5zcGFyZW50Ij48L3JlY3Q+PHBhdGggZD0iTTAgOEw4IDBaTTggMTZMMTYgOFpNLTggMEwwIC04WiIgc3Ryb2tlPSJyZ2JhKDIzOSwgNjgsIDY4LCAwLjgpIiBzdHJva2Utd2lkdGg9IjIuNSI+PC9wYXRoPjwvc3ZnPg==')] bg-red-500/20 dark:bg-red-500/40 z-0 border-x-2 border-red-500/80 group/susp cursor-help"
                style={{
                  left: `calc(516px + ((100% - 516px) * ${startRatio}))`,
                  width: `calc((100% - 516px) * ${widthRatio})`,
                }}
              />
            )
          })}

          {/* Today Line */}
          {today >= minDate && today <= maxDate && (
            <div 
              className="absolute inset-y-0 border-l-2 border-yellow-500 border-dashed z-20 pointer-events-none"
              style={{
                left: `calc(516px + ((100% - 516px) * ${(today.getTime() - minDate.getTime()) / (totalDays * 24 * 60 * 60 * 1000)}))`
              }}
            />
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
                      {/* Segment Render */}
                      {(() => {
                        const workedDaysTotal = ((task.actual_progress || 0) / 100) * (task.duration || 1)
                        let remainingWorkedDays = workedDaysTotal
                        const segments = (task as any).segments || []

                        return segments.map((seg: any, sIdx: number) => {
                          const segStart = new Date(seg.start)
                          const segEnd = new Date(seg.end)
                          
                          if (segEnd < minDate || segStart > maxDate) return null
                          
                          const visibleStart = new Date(Math.max(segStart.getTime(), minDate.getTime()))
                          const visibleEnd = new Date(Math.min(segEnd.getTime(), maxDate.getTime()))

                          const segLeftRatio = Math.max(0, (visibleStart.getTime() - minDate.getTime()) / (totalDays * 24 * 60 * 60 * 1000))
                          const segWidthRatio = Math.max(0, (visibleEnd.getTime() - visibleStart.getTime()) / (totalDays * 24 * 60 * 60 * 1000))
                            
                          const segCapDays = seg.durationDays
                          const fillDays = Math.min(segCapDays, Math.max(0, remainingWorkedDays))
                          const fillPct = segCapDays > 0 ? (fillDays / segCapDays) : (task.actual_progress === 100 ? 1 : 0)
                          
                          remainingWorkedDays -= fillDays

                          return (
                            <div key={sIdx}>
                              {/* Plan Bar */}
                              <div 
                                className={`absolute top-2 h-4 ${isDark ? 'bg-white/20' : 'bg-slate-300'} transition-all ${sIdx === 0 ? 'rounded-l-sm' : ''} ${sIdx === segments.length - 1 ? 'rounded-r-sm' : ''}`}
                                style={{
                                  left: `${segLeftRatio * 100}%`,
                                  width: `${segWidthRatio * 100}%`
                                }}
                              />
                              {/* Actual Progress Bar */}
                              {fillPct > 0 && (
                                <div 
                                  className={`absolute top-3 h-2 bg-[#a13c9d]/85 z-10 ${sIdx === 0 ? 'rounded-l-sm' : ''} ${fillPct === 1 && sIdx === segments.length - 1 ? 'rounded-r-sm' : ''}`}
                                  style={{
                                    left: `${segLeftRatio * 100}%`,
                                    width: `${segWidthRatio * fillPct * 100}%`
                                  }}
                                />
                              )}
                            </div>
                          )
                        })
                      })()}
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
