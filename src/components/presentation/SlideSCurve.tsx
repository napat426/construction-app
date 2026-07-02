'use client'

import { useMemo } from 'react'
import type { Project, WBSTask } from '@/lib/types'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts'
import { computeTaskDates } from '@/lib/scheduler'

interface Props {
  project: Project
  tasks: WBSTask[]
}

export function SlideSCurve({ project, tasks }: Props) {
  // 1. Sort and Compute schedule exactly like PlanningClient
  const scheduledTasks = useMemo(() => {
    const sorted = [...tasks].sort((a, b) => {
      const aParts = a.wbs_no.split('.').map(Number)
      const bParts = b.wbs_no.split('.').map(Number)
      for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const aVal = aParts[i] || 0
        const bVal = bParts[i] || 0
        if (aVal !== bVal) return aVal - bVal
      }
      return 0
    })
    return computeTaskDates(sorted, project.start_date)
  }, [tasks, project.start_date])

  // 2. Generate S-Curve Data perfectly matching PlanningClient
  const chartData = useMemo(() => {
    if (scheduledTasks.length === 0 || !project.start_date) return []

    const start = new Date(project.start_date)
    start.setHours(0, 0, 0, 0)
    
    // Find min and max computed dates for accurate timeline length
    let minDate = new Date(scheduledTasks[0].computedStartDate)
    let maxDate = new Date(scheduledTasks[0].computedEndDate)
    for (const t of scheduledTasks) {
      const sd = new Date(t.computedStartDate)
      const ed = new Date(t.computedEndDate)
      if (sd < minDate) minDate = sd
      if (ed > maxDate) maxDate = ed
    }
    
    // Make sure timeline starts at least at project.start_date
    if (start < minDate) minDate = start
    
    const durationDays = Math.max(0, Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)))
    if (durationDays === 0) return []
    
    let intervalDays = 7
    if (durationDays <= 30) intervalDays = 3
    else if (durationDays <= 90) intervalDays = 7
    else if (durationDays <= 180) intervalDays = 10
    else if (durationDays <= 365) intervalDays = 15
    else intervalDays = 30
    
    const pointsCount = Math.max(4, Math.ceil(durationDays / intervalDays))

    const todayDateOnly = new Date()
    todayDateOnly.setHours(0, 0, 0, 0)

    const totalCost = scheduledTasks.reduce((sum, t) => sum + (Number(t.cost) || 0), 0)
    const totalWeightDenominator = totalCost > 0 ? totalCost : (scheduledTasks.length || 1)

    const data = []

    for (let i = 0; i <= pointsCount; i++) {
      const fraction = i / pointsCount
      const currTime = minDate.getTime() + fraction * durationDays * 24 * 60 * 60 * 1000
      const currDate = new Date(currTime)
      currDate.setHours(0, 0, 0, 0)

      let plannedSum = 0
      for (const t of scheduledTasks) {
        const tStart = new Date(t.computedStartDate)
        const tEnd = new Date(t.computedEndDate)
        const taskWeightValue = totalCost > 0 ? (Number(t.cost) || 0) : 1
        
        if (currDate >= tEnd) {
          plannedSum += taskWeightValue
        } else if (currDate >= tStart) {
          const elapsed = (currDate.getTime() - tStart.getTime()) / (24 * 60 * 60 * 1000)
          plannedSum += taskWeightValue * (elapsed / t.duration)
        }
      }

      let actualSum = 0
      const showActual = currDate <= todayDateOnly || i === 0

      if (showActual) {
        for (const t of scheduledTasks) {
          const tStart = new Date(t.computedStartDate)
          const tEnd = new Date(t.computedEndDate)
          const taskWeightValue = totalCost > 0 ? (Number(t.cost) || 0) : 1

          let progressStart = tStart
          let progressEnd = tEnd < todayDateOnly ? tEnd : todayDateOnly
          if (tStart >= todayDateOnly && (t.actual_progress || 0) > 0) {
            progressStart = minDate
            progressEnd = todayDateOnly
          }

          if (currDate >= progressEnd) {
            actualSum += taskWeightValue * ((t.actual_progress || 0) / 100)
          } else if (currDate <= progressStart) {
            // zero
          } else {
            const totalDur = progressEnd.getTime() - progressStart.getTime()
            if (totalDur > 0) {
              const elapsed = currDate.getTime() - progressStart.getTime()
              const progressAtPoint = (t.actual_progress || 0) * (elapsed / totalDur)
              actualSum += taskWeightValue * (progressAtPoint / 100)
            } else {
              actualSum += taskWeightValue * ((t.actual_progress || 0) / 100)
            }
          }
        }
      }

      data.push({
        date: currDate.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' }),
        PV: (plannedSum / totalWeightDenominator) * 100,
        EV: showActual ? (actualSum / totalWeightDenominator) * 100 : null
      })
    }

    return data
  }, [scheduledTasks, project.start_date])

  const topWbs = useMemo(() => {
    // Level 1 WBS (no dot or single digit/letter usually, or just top 6 by cost)
    // Here we just take top 6 by cost for the summary
    return [...tasks].sort((a, b) => Number(b.cost) - Number(a.cost)).slice(0, 6)
  }, [tasks])

  const totalCost = tasks.reduce((sum, t) => sum + Number(t.cost || 0), 0)

  return (
    <div className="w-full h-full flex flex-col pt-4">
      <div className="mb-8">
        <h2 className="text-4xl font-bold text-[#a13c9d]">S-Curve & แผนงานโครงการ</h2>
        <p className="text-xl text-white/60">โครงการ: {project.name}</p>
      </div>

      <div className="flex-1 flex gap-8">
        {/* Left: Chart */}
        <div className="w-[60%] bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col">
          <div className="flex justify-between items-center mb-6">
             <h3 className="text-2xl font-bold">กราฟ S-Curve</h3>
             <span className="text-sm px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full">ประมาณการจากแผนงานปัจจุบัน</span>
          </div>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                <XAxis 
                  dataKey="date" 
                  stroke="#ffffff60" 
                  tick={{ fill: '#ffffff60', fontSize: 14 }}
                  tickMargin={10}
                />
                <YAxis 
                  stroke="#ffffff60" 
                  tick={{ fill: '#ffffff60', fontSize: 14 }}
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1a1a32', borderColor: '#252548', color: '#fff', borderRadius: '12px' }}
                  itemStyle={{ fontSize: 16 }}
                />
                <Legend wrapperStyle={{ paddingTop: '20px', fontSize: 16 }} />
                
                <Line 
                  name="แผนงาน (PV)"
                  type="monotone" 
                  dataKey="PV" 
                  stroke="#94a3b8" 
                  strokeWidth={4} 
                  strokeDasharray="8 8"
                  dot={{ r: 6, fill: '#94a3b8' }}
                  activeDot={{ r: 8 }}
                />
                <Line 
                  name="ความก้าวหน้าจริง (EV)"
                  type="monotone" 
                  dataKey="EV" 
                  stroke="#a13c9d" 
                  strokeWidth={4} 
                  dot={{ r: 6, fill: '#a13c9d' }}
                  activeDot={{ r: 8 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: Table */}
        <div className="w-[40%] bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col">
          <h3 className="text-2xl font-bold mb-6">งานหลัก (Top WBS)</h3>
          <div className="flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-white/50 text-lg">
                  <th className="py-3 px-2 font-medium">ชื่องาน</th>
                  <th className="py-3 px-2 font-medium text-right">Weight</th>
                  <th className="py-3 px-2 font-medium text-right">Actual</th>
                  <th className="py-3 px-2 font-medium text-center">สถานะ</th>
                </tr>
              </thead>
              <tbody className="text-xl">
                {topWbs.map((t) => {
                  const weight = totalCost > 0 ? (Number(t.cost) / totalCost) * 100 : 0
                  const isDone = t.actual_progress === 100
                  const statusColor = isDone ? 'text-emerald-400 bg-emerald-500/10' : t.actual_progress > 0 ? 'text-blue-400 bg-blue-500/10' : 'text-slate-400 bg-white/5'
                  const statusText = isDone ? 'Done' : t.actual_progress > 0 ? 'In Prog' : 'Wait'
                  
                  return (
                    <tr key={t.id} className="border-b border-white/5 last:border-0">
                      <td className="py-4 px-2 line-clamp-2 leading-tight">{t.name}</td>
                      <td className="py-4 px-2 text-right text-white/70">{weight.toFixed(1)}%</td>
                      <td className="py-4 px-2 text-right font-bold">{t.actual_progress.toFixed(1)}%</td>
                      <td className="py-4 px-2 text-center">
                        <span className={`px-3 py-1 rounded-lg text-sm font-bold ${statusColor}`}>{statusText}</span>
                      </td>
                    </tr>
                  )
                })}
                {topWbs.length === 0 && (
                   <tr>
                     <td colSpan={4} className="py-8 text-center text-white/40">ไม่มีข้อมูลงานในระบบ</td>
                   </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
