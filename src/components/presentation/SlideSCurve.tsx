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

interface Props {
  project: Project
  tasks: WBSTask[]
}

export function SlideSCurve({ project, tasks }: Props) {
  // Generate S-Curve Data from current tasks (Linear approximation)
  const chartData = useMemo(() => {
    if (!project.start_date || !project.end_date || tasks.length === 0) return []

    const start = new Date(project.start_date)
    const end = new Date(project.end_date)
    start.setHours(0,0,0,0)
    end.setHours(0,0,0,0)
    
    const today = new Date()
    today.setHours(0,0,0,0)

    const totalWbsCost = tasks.reduce((sum, t) => sum + (Number(t.cost) || 0), 0)
    if (totalWbsCost === 0) return []

    const data = []
    
    // Generate roughly 12-20 data points from start to end
    const totalDays = Math.max(1, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    const intervalDays = Math.max(1, Math.floor(totalDays / 15))
    
    let currentDate = new Date(start)
    while (currentDate <= end) {
      let pvCumulative = 0
      let evCumulative = 0

      tasks.forEach(t => {
        const w = (Number(t.cost) || 0) / totalWbsCost
        const tStart = new Date(t.start_date)
        const tEnd = new Date(tStart.getTime() + (t.duration - 1) * 24 * 60 * 60 * 1000)
        tStart.setHours(0,0,0,0)
        tEnd.setHours(0,0,0,0)

        // PV at currentDate
        let pvProgress = 0
        if (currentDate >= tEnd) pvProgress = 100
        else if (currentDate > tStart) {
          pvProgress = ((currentDate.getTime() - tStart.getTime()) / Math.max(1, tEnd.getTime() - tStart.getTime())) * 100
        }
        pvCumulative += pvProgress * w

        // EV (Only up to today)
        if (currentDate <= today) {
          // If task is in past and we only have current snapshot, assume linear EV up to current actual progress
          let evProgress = 0
          if (today >= tEnd) {
             // If task is supposed to be done, actual progress is what it is
             if (currentDate.getTime() === today.getTime()) evProgress = t.actual_progress || 0
             else {
               // Interpolate historical EV linearly... this is a rough estimation since no historical data is provided
               evProgress = (pvProgress / 100) * (t.actual_progress || 0) 
             }
          } else {
             // Task is currently active
             if (currentDate > tStart) {
               const expectedRatio = (currentDate.getTime() - tStart.getTime()) / (today.getTime() - tStart.getTime())
               evProgress = Math.min(1, Math.max(0, expectedRatio)) * (t.actual_progress || 0)
             }
          }
          evCumulative += evProgress * w
        }
      })

      data.push({
        date: currentDate.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' }),
        timestamp: currentDate.getTime(),
        PV: pvCumulative,
        EV: currentDate <= today ? evCumulative : null
      })
      
      currentDate = new Date(currentDate.getTime() + intervalDays * 24 * 60 * 60 * 1000)
    }
    
    // Ensure final date is included
    if (data[data.length - 1].timestamp < end.getTime()) {
      data.push({
        date: end.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' }),
        timestamp: end.getTime(),
        PV: 100,
        EV: end <= today ? tasks.reduce((sum, t) => sum + ((t.actual_progress || 0) * ((Number(t.cost) || 0) / totalWbsCost)), 0) : null
      })
    }

    return data
  }, [project, tasks])

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
                  stroke="#60a5fa" 
                  strokeWidth={4} 
                  dot={false}
                />
                <Line 
                  name="ความก้าวหน้าจริง (EV)"
                  type="monotone" 
                  dataKey="EV" 
                  stroke="#34d399" 
                  strokeWidth={4} 
                  dot={{ r: 4 }}
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
