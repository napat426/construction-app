'use client'

import { useMemo } from 'react'
import type { Project, WBSTask } from '@/lib/types'
import { Calendar, DollarSign, Clock, CheckCircle2, AlertCircle, PlayCircle } from 'lucide-react'
import { computeTaskDates } from '@/lib/scheduler'

interface Props {
  project: Project
  tasks: WBSTask[]
  theme?: 'dark' | 'light'
}

export function SlideOverview({ project, tasks, theme = 'dark' }: Props) {
  const isDark = theme === 'dark'

  // Replicate EVM Logic from DashboardClient
  const evm = useMemo(() => {
    const today = new Date()
    const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    
    const start = project.start_date ? new Date(project.start_date) : null
    const end = project.end_date ? new Date(project.end_date) : null
    
    let totalDays = 0
    let daysUsed = 0
    let daysRemaining = 0
    let isOverrun = false

    if (start && end) {
      start.setHours(0, 0, 0, 0)
      end.setHours(0, 0, 0, 0)
      const diffTime = end.getTime() - start.getTime()
      totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      
      const diffUsed = todayDateOnly.getTime() - start.getTime()
      daysUsed = Math.ceil(diffUsed / (1000 * 60 * 60 * 24))
      
      daysRemaining = totalDays - daysUsed
      if (daysRemaining < 0) {
        isOverrun = true
      }
    }

    const scheduledTasks = computeTaskDates(tasks, project.start_date)

    const totalWbsCost = scheduledTasks.reduce((sum, t) => sum + (Number(t.cost) || 0), 0)
    let pvCumulative = 0
    let evCumulative = 0

    scheduledTasks.forEach(t => {
      const w = totalWbsCost > 0 ? (Number(t.cost) || 0) / totalWbsCost : 0
      
      const tStart = new Date(t.computedStartDate)
      const tEnd = new Date(t.computedEndDate)
      tStart.setHours(0,0,0,0)
      tEnd.setHours(0,0,0,0)
      
      let plannedProgress = 0
      if (todayDateOnly >= tEnd) plannedProgress = 100
      else if (todayDateOnly < tStart) plannedProgress = 0
      else {
        const totalTaskTime = Math.max(1, tEnd.getTime() - tStart.getTime())
        const elapsedTaskTime = todayDateOnly.getTime() - tStart.getTime()
        plannedProgress = (elapsedTaskTime / totalTaskTime) * 100
      }
      
      pvCumulative += plannedProgress * w
      evCumulative += (t.actual_progress || 0) * w
    })

    const BAC = project.budget || 1
    const AC_Cost = project.paid_amount || 0
    const EV_Cost = BAC * (evCumulative / 100)
    
    const svPercent = evCumulative - pvCumulative
    let svDays = 0
    if (totalDays > 0) svDays = Math.round((svPercent / 100) * totalDays)
    
    const cvCost = EV_Cost - AC_Cost
    const cvPercent = (cvCost / BAC) * 100

    let done = 0, delayed = 0, inProgress = 0
    scheduledTasks.forEach(t => {
      if (t.actual_progress === 100) done++
      else if (t.computedStartDate <= todayDateOnly) {
        const tStart = new Date(t.computedStartDate)
        const tEnd = new Date(t.computedEndDate)
        let pp = 0
        if (todayDateOnly >= tEnd) pp = 100
        else {
          pp = ((todayDateOnly.getTime() - tStart.getTime()) / Math.max(1, tEnd.getTime() - tStart.getTime())) * 100
        }
        if (pp - (t.actual_progress || 0) >= 5) delayed++
        else inProgress++
      }
    })

    return {
      pvCumulative, evCumulative, svPercent, svDays, cvPercent, cvCost, done, delayed, inProgress, totalDays, daysRemaining, isOverrun
    }
  }, [project, tasks])

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val)
  }
  
  const cardClasses = isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200 shadow-xl'
  const textMuted = isDark ? 'text-white/50' : 'text-slate-500'
  const textMutedStrong = isDark ? 'text-white/60' : 'text-slate-600'
  const textHeading = isDark ? 'text-white' : 'text-slate-800'

  return (
    <div className="w-full h-full flex flex-col pt-8">
      {/* Header */}
      <div className="flex justify-between items-start mb-12">
        <div>
          <h1 className={`text-6xl font-bold mb-4 ${isDark ? 'text-[#a13c9d]' : 'text-purple-700'}`}>{project.name}</h1>
          <div className="flex gap-4 items-center">
            <span className={`px-4 py-1.5 rounded-full text-lg font-bold ${
              project.status === 'กำลังดำเนินการ' ? 'bg-blue-500/20 text-blue-500' :
              project.status === 'เสร็จสิ้น' ? 'bg-emerald-500/20 text-emerald-500' :
              project.status === 'ระงับ' ? 'bg-red-500/20 text-red-500' :
              'bg-slate-500/20 text-slate-500'
            }`}>
              {project.status}
            </span>
            <span className={`text-xl ${textMutedStrong}`}>📍 {project.location || 'ไม่ระบุสถานที่'}</span>
          </div>
        </div>
        <div className="text-right">
          <p className={`text-2xl ${textMutedStrong} mb-2`}>สัญญา: {project.start_date ? new Date(project.start_date).toLocaleDateString('th-TH') : '-'} ถึง {project.end_date ? new Date(project.end_date).toLocaleDateString('th-TH') : '-'}</p>
          <p className="text-3xl font-bold">
            {evm.isOverrun ? <span className="text-red-500">เลยกำหนด {Math.abs(evm.daysRemaining)} วัน</span> : <span className="text-blue-500">เหลือเวลา {evm.daysRemaining} วัน</span>}
          </p>
        </div>
      </div>

      <div className="flex-1 flex gap-12">
        {/* Left: EVM 4-Grid */}
        <div className="w-2/3 grid grid-cols-2 gap-8">
          <div className={`${cardClasses} border rounded-3xl p-8 flex flex-col justify-center`}>
            <p className={`text-2xl ${textMuted} mb-2 font-medium`}>ความก้าวหน้าจริง (EV)</p>
            <p className="text-7xl font-bold text-emerald-500">{evm.evCumulative.toFixed(1)}%</p>
          </div>
          <div className={`${cardClasses} border rounded-3xl p-8 flex flex-col justify-center`}>
            <p className={`text-2xl ${textMuted} mb-2 font-medium`}>แผนงาน (PV)</p>
            <p className="text-7xl font-bold text-blue-500">{evm.pvCumulative.toFixed(1)}%</p>
          </div>
          
          <div className={`${cardClasses} border rounded-3xl p-8 flex flex-col justify-center`}>
            <div className="flex items-center gap-3 mb-2">
              <Calendar className={textMuted} size={28} />
              <p className={`text-2xl ${textMuted} font-medium`}>Schedule Variance (SV)</p>
            </div>
            <p className={`text-6xl font-bold mb-4 ${evm.svPercent > 0 ? 'text-emerald-500' : evm.svPercent < 0 ? 'text-red-500' : textHeading}`}>
              {evm.svPercent > 0 ? '+' : ''}{evm.svPercent.toFixed(1)}%
            </p>
            <div className="text-xl font-bold">
              {evm.svPercent < 0 ? <span className="text-red-500">⚠️ ล่าช้ากว่าแผน {Math.abs(evm.svDays)} วัน</span> : 
               evm.svPercent > 0 ? <span className="text-emerald-500">✅ เร็วกว่าแผน {evm.svDays} วัน</span> : 
               <span className={textHeading}>✔ ตรงตามแผน</span>}
            </div>
          </div>
          
          <div className={`${cardClasses} border rounded-3xl p-8 flex flex-col justify-center`}>
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className={textMuted} size={28} />
              <p className={`text-2xl ${textMuted} font-medium`}>Cost Variance (CV)</p>
            </div>
            <p className={`text-6xl font-bold mb-4 ${evm.cvPercent > 0 ? 'text-emerald-500' : evm.cvPercent < 0 ? 'text-red-500' : textHeading}`}>
              {evm.cvPercent > 0 ? '+' : ''}{evm.cvPercent.toFixed(1)}%
            </p>
            <div className="text-xl font-bold">
              {evm.cvPercent < 0 ? <span className="text-red-500">⚠️ เกินงบประมาณ ฿{formatCurrency(Math.abs(evm.cvCost)).replace('฿', '')}</span> : 
               evm.cvPercent > 0 ? <span className="text-emerald-500">✅ ต่ำกว่างบ ฿{formatCurrency(evm.cvCost).replace('฿', '')}</span> : 
               <span className={textHeading}>✔ ตรงงบประมาณ</span>}
            </div>
          </div>
        </div>

        {/* Right: Progress bars and Task summary */}
        <div className="w-1/3 flex flex-col gap-8">
          <div className={`${cardClasses} border rounded-3xl p-8 flex-1`}>
            <h3 className={`text-3xl font-bold mb-8 ${textHeading}`}>สถานะงาน (WBS)</h3>
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-emerald-500/10 rounded-2xl">
                <div className="flex items-center gap-4">
                  <CheckCircle2 className="text-emerald-500" size={36} />
                  <span className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>เสร็จสิ้น</span>
                </div>
                <span className="text-4xl font-black text-emerald-500">{evm.done}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-red-500/10 rounded-2xl">
                <div className="flex items-center gap-4">
                  <AlertCircle className="text-red-500" size={36} />
                  <span className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>ล่าช้า</span>
                </div>
                <span className="text-4xl font-black text-red-500">{evm.delayed}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-blue-500/10 rounded-2xl">
                <div className="flex items-center gap-4">
                  <PlayCircle className="text-blue-500" size={36} />
                  <span className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>กำลังทำ</span>
                </div>
                <span className="text-4xl font-black text-blue-500">{evm.inProgress}</span>
              </div>
            </div>
          </div>

          <div className={`${cardClasses} border rounded-3xl p-8`}>
            <h3 className={`text-2xl font-bold mb-6 ${textHeading}`}>งบประมาณโครงการ</h3>
            <div className="flex justify-between text-xl mb-2">
              <span className={textMutedStrong}>มูลค่าสัญญา</span>
              <span className={`font-bold ${textHeading}`}>{formatCurrency(project.budget || 0)}</span>
            </div>
            <div className="flex justify-between text-xl mb-4">
              <span className="text-emerald-500">เบิกจ่ายแล้ว</span>
              <span className="font-bold text-emerald-500">{formatCurrency(project.paid_amount || 0)}</span>
            </div>
            <div className={`w-full ${isDark ? 'bg-white/10' : 'bg-slate-200'} h-4 rounded-full overflow-hidden`}>
              <div 
                className="bg-[#a13c9d] h-full"
                style={{ width: `${Math.min(100, ((project.paid_amount || 0) / (project.budget || 1)) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
