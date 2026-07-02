'use client'

import { useMemo } from 'react'
import type { Project, WBSTask } from '@/lib/types'
import { Calendar, DollarSign, Clock, CheckCircle2, AlertCircle, PlayCircle } from 'lucide-react'

interface Props {
  project: Project
  tasks: WBSTask[]
}

export function SlideOverview({ project, tasks }: Props) {
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

    const scheduledTasks = tasks.map(t => {
      let sd = new Date(t.start_date)
      let ed = new Date(sd.getTime() + (t.duration - 1) * 24 * 60 * 60 * 1000)
      return { ...t, computedStartDate: sd, computedEndDate: ed }
    })

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

    const acPercent = ((project.paid_amount || 0) / (project.budget || 1)) * 100
    const totalWbsDenominator = totalWbsCost > 0 ? totalWbsCost : (project.budget || 1)
    const evCurrency = totalWbsDenominator * (evCumulative / 100)
    const pvCurrency = totalWbsDenominator * (pvCumulative / 100)
    
    const SV = evCumulative - pvCumulative
    let svDays = 0
    if (totalDays > 0) svDays = Math.round((SV / 100) * totalDays)
    
    const CV = evCurrency - (project.paid_amount || 0)

    let done = 0, delayed = 0, inProgress = 0
    scheduledTasks.forEach(t => {
      if (t.actual_progress === 100) done++
      else if (t.computedStartDate <= todayDateOnly) {
        // Find if delayed
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
      pvCumulative, evCumulative, SV, svDays, CV, done, delayed, inProgress, totalDays, daysRemaining, isOverrun
    }
  }, [project, tasks])

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val)
  }

  return (
    <div className="w-full h-full flex flex-col pt-8">
      {/* Header */}
      <div className="flex justify-between items-start mb-12">
        <div>
          <h1 className="text-6xl font-bold mb-4 text-[#a13c9d]">{project.name}</h1>
          <div className="flex gap-4 items-center">
            <span className={`px-4 py-1.5 rounded-full text-lg font-bold ${
              project.status === 'กำลังดำเนินการ' ? 'bg-blue-500/20 text-blue-400' :
              project.status === 'เสร็จสิ้น' ? 'bg-emerald-500/20 text-emerald-400' :
              project.status === 'ระงับ' ? 'bg-red-500/20 text-red-400' :
              'bg-slate-500/20 text-slate-400'
            }`}>
              {project.status}
            </span>
            <span className="text-xl text-white/60">📍 {project.location || 'ไม่ระบุสถานที่'}</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl text-white/60 mb-2">สัญญา: {project.start_date ? new Date(project.start_date).toLocaleDateString('th-TH') : '-'} ถึง {project.end_date ? new Date(project.end_date).toLocaleDateString('th-TH') : '-'}</p>
          <p className="text-3xl font-bold">
            {evm.isOverrun ? <span className="text-red-400">เลยกำหนด {Math.abs(evm.daysRemaining)} วัน</span> : <span className="text-blue-400">เหลือเวลา {evm.daysRemaining} วัน</span>}
          </p>
        </div>
      </div>

      <div className="flex-1 flex gap-12">
        {/* Left: EVM 4-Grid */}
        <div className="w-2/3 grid grid-cols-2 gap-8">
          <div className="bg-white/5 border border-white/10 rounded-3xl p-8 flex flex-col justify-center">
            <p className="text-2xl text-white/50 mb-2 font-medium">ความก้าวหน้าจริง (EV)</p>
            <p className="text-7xl font-bold text-emerald-400">{evm.evCumulative.toFixed(2)}%</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-3xl p-8 flex flex-col justify-center">
            <p className="text-2xl text-white/50 mb-2 font-medium">แผนงาน (PV)</p>
            <p className="text-7xl font-bold text-blue-400">{evm.pvCumulative.toFixed(2)}%</p>
          </div>
          
          <div className="bg-white/5 border border-white/10 rounded-3xl p-8 flex flex-col justify-center">
            <div className="flex items-center gap-3 mb-2">
              <Calendar className="text-white/50" size={28} />
              <p className="text-2xl text-white/50 font-medium">Schedule Variance (SV)</p>
            </div>
            <div className="flex items-baseline gap-4">
              <p className={`text-6xl font-bold ${evm.svDays > 0 ? 'text-emerald-400' : evm.svDays < 0 ? 'text-red-400' : 'text-white'}`}>
                {evm.svDays > 0 ? '+' : ''}{evm.svDays}
              </p>
              <p className="text-3xl text-white/50">วัน</p>
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-3xl p-8 flex flex-col justify-center">
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="text-white/50" size={28} />
              <p className="text-2xl text-white/50 font-medium">Cost Variance (CV)</p>
            </div>
            <p className={`text-6xl font-bold ${evm.CV >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {evm.CV > 0 ? '+' : ''}{formatCurrency(evm.CV)}
            </p>
          </div>
        </div>

        {/* Right: Progress bars and Task summary */}
        <div className="w-1/3 flex flex-col gap-8">
          <div className="bg-white/5 border border-white/10 rounded-3xl p-8 flex-1">
            <h3 className="text-3xl font-bold mb-8">สถานะงาน (WBS)</h3>
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-emerald-500/10 rounded-2xl">
                <div className="flex items-center gap-4">
                  <CheckCircle2 className="text-emerald-400" size={36} />
                  <span className="text-2xl font-bold">เสร็จสิ้น</span>
                </div>
                <span className="text-4xl font-black text-emerald-400">{evm.done}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-red-500/10 rounded-2xl">
                <div className="flex items-center gap-4">
                  <AlertCircle className="text-red-400" size={36} />
                  <span className="text-2xl font-bold">ล่าช้า</span>
                </div>
                <span className="text-4xl font-black text-red-400">{evm.delayed}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-blue-500/10 rounded-2xl">
                <div className="flex items-center gap-4">
                  <PlayCircle className="text-blue-400" size={36} />
                  <span className="text-2xl font-bold">กำลังทำ</span>
                </div>
                <span className="text-4xl font-black text-blue-400">{evm.inProgress}</span>
              </div>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-3xl p-8">
            <h3 className="text-2xl font-bold mb-6">งบประมาณโครงการ</h3>
            <div className="flex justify-between text-xl mb-2">
              <span className="text-white/60">มูลค่าสัญญา</span>
              <span className="font-bold">{formatCurrency(project.budget || 0)}</span>
            </div>
            <div className="flex justify-between text-xl mb-4">
              <span className="text-emerald-400">เบิกจ่ายแล้ว</span>
              <span className="font-bold text-emerald-400">{formatCurrency(project.paid_amount || 0)}</span>
            </div>
            <div className="w-full bg-white/10 h-4 rounded-full overflow-hidden">
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
