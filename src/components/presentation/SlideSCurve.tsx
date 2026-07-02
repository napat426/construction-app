'use client'

import { useMemo } from 'react'
import type { Project, WBSTask, ProjectPayment } from '@/lib/types'
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
  payments?: ProjectPayment[]
  theme?: 'dark' | 'light'
}

export function SlideSCurve({ project, tasks, payments = [], theme = 'dark' }: Props) {
  const isDark = theme === 'dark'

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

  const chartData = useMemo(() => {
    if (scheduledTasks.length === 0 || !project.start_date) return []

    const start = new Date(project.start_date)
    start.setHours(0, 0, 0, 0)
    
    let minDate = new Date(scheduledTasks[0].computedStartDate)
    let maxDate = new Date(scheduledTasks[0].computedEndDate)
    for (const t of scheduledTasks) {
      const sd = new Date(t.computedStartDate)
      const ed = new Date(t.computedEndDate)
      if (sd < minDate) minDate = sd
      if (ed > maxDate) maxDate = ed
    }
    
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

    // Prepare payments (AC calculation)
    const validPayments = payments.filter(p => p.payment_date).sort((a, b) => new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime())
    const paymentPoints: { date: Date, cumulative: number }[] = []
    let currentCumulative = 0
    validPayments.forEach(p => {
      currentCumulative += Number(p.amount) || 0
      paymentPoints.push({
        date: new Date(p.payment_date),
        cumulative: currentCumulative
      })
    })

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

      // AC Calculation
      let acVal: number | null = null
      if (showActual) {
        const pastPayments = paymentPoints.filter(p => p.date <= currDate)
        const cumulativeAc = pastPayments.length > 0 ? pastPayments[pastPayments.length - 1].cumulative : 0
        acVal = ((cumulativeAc) / (project.budget || 1)) * 100
      }

      data.push({
        date: currDate.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' }),
        PV: (plannedSum / totalWeightDenominator) * 100,
        EV: showActual ? (actualSum / totalWeightDenominator) * 100 : null,
        AC: showActual ? Math.min(100, Math.round(acVal || 0)) : null
      })
    }

    return data
  }, [scheduledTasks, project.start_date, payments, project.budget])

  const topWbs = useMemo(() => {
    return scheduledTasks
      .filter(t => !t.wbs_no.includes('.'))
      .slice(0, 10)
  }, [scheduledTasks])

  const gridColor = isDark ? '#ffffff10' : '#e0e3e9'
  const textColor = isDark ? '#94a3b8' : '#333333'

  return (
    <div className="w-full h-full flex flex-col pt-8">
      <div className="flex justify-between items-start mb-10">
        <div>
          <h1 className={`text-6xl font-bold mb-4 ${isDark ? 'text-[#a13c9d]' : 'text-purple-700'}`}>แผนงานรวม (S-Curve & WBS)</h1>
          <p className={`text-2xl ${isDark ? 'text-white/60' : 'text-slate-500'}`}>โครงการ: {project.name}</p>
        </div>
      </div>

      <div className="flex-1 flex gap-8 min-h-0">
        <div className={`w-1/3 flex flex-col rounded-3xl ${isDark ? 'bg-[#14142a] border-[#1c1c34]' : 'bg-white border-slate-200'} border shadow-xl p-6 overflow-hidden`}>
          <h3 className={`text-2xl font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-800'}`}>งานหลัก (WBS)</h3>
          <div className="flex-1 overflow-y-auto pr-2 space-y-4">
            {topWbs.map((wbs, idx) => (
              <div key={idx} className={`p-4 rounded-2xl ${isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'} border flex flex-col gap-2`}>
                <div className="flex justify-between items-start">
                  <span className={`font-bold text-lg leading-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>
                    <span className="text-primary-500 mr-2">{wbs.wbs_no}</span>
                    {wbs.name}
                  </span>
                  <span className={`text-sm whitespace-nowrap ml-4 ${isDark ? 'text-white/40' : 'text-slate-400'}`}>
                    {wbs.duration} วัน
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className={isDark ? 'text-emerald-400' : 'text-emerald-600'}>ทำได้: {wbs.actual_progress || 0}%</span>
                  <span className={isDark ? 'text-white/60' : 'text-slate-500'}>
                    {new Date(wbs.computedStartDate).toLocaleDateString('th-TH', {month:'short', year:'2-digit'})} 
                    {' - '}
                    {new Date(wbs.computedEndDate).toLocaleDateString('th-TH', {month:'short', year:'2-digit'})}
                  </span>
                </div>
                <div className={`w-full ${isDark ? 'bg-white/10' : 'bg-slate-200'} h-1.5 rounded-full mt-1 overflow-hidden`}>
                  <div className="bg-[#a13c9d] h-full" style={{width: `${wbs.actual_progress || 0}%`}} />
                </div>
              </div>
            ))}
            {tasks.length > topWbs.length && (
              <div className={`text-center text-sm py-2 ${isDark ? 'text-white/40' : 'text-slate-400'}`}>
                + อีก {tasks.length - topWbs.length} งานย่อย
              </div>
            )}
          </div>
        </div>

        <div className={`w-2/3 rounded-3xl ${isDark ? 'bg-[#14142a] border-[#1c1c34]' : 'bg-white border-slate-200'} border shadow-xl p-8 flex flex-col relative`}>
          <div className="absolute top-8 right-8 flex gap-6 text-sm font-bold bg-white/5 backdrop-blur px-4 py-2 rounded-full border border-white/10 z-10">
            <div className="flex items-center gap-2">
              <div className="w-4 h-1 border-t-2 border-dashed border-[#94a3b8]"></div>
              <span className={isDark ? 'text-white/60' : 'text-slate-500'}>PV (แผนงาน)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-1 bg-[#a13c9d]"></div>
              <span className={isDark ? 'text-white' : 'text-slate-800'}>EV (ความก้าวหน้า)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-1 bg-[#e08a2b]"></div>
              <span className={isDark ? 'text-white' : 'text-slate-800'}>AC (ค่าใช้จ่ายจริง)</span>
            </div>
          </div>
          
          <div className="flex-1 w-full h-full min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 40, right: 20, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke={textColor} 
                  tick={{ fill: textColor, fontSize: 14 }}
                  tickMargin={15}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  domain={[0, 100]} 
                  stroke={textColor} 
                  tick={{ fill: textColor, fontSize: 14 }}
                  tickFormatter={(val) => `${val}%`}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: isDark ? '#1a1a32' : '#ffffff', 
                    borderColor: isDark ? '#252548' : '#e2e8f0', 
                    borderRadius: '12px',
                    color: isDark ? '#fff' : '#000',
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
                  }}
                  itemStyle={{ fontSize: '16px', fontWeight: 'bold' }}
                  labelStyle={{ color: isDark ? '#94a3b8' : '#64748b', marginBottom: '8px' }}
                />
                
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
                <Line 
                  name="ค่าใช้จ่ายจริง (AC)"
                  type="monotone" 
                  dataKey="AC" 
                  stroke="#e08a2b" 
                  strokeWidth={4} 
                  dot={{ r: 6, fill: '#e08a2b' }}
                  activeDot={{ r: 8 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
