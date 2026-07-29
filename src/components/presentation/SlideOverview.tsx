'use client'

import { useMemo } from 'react'
import type { Project, WBSTask, ProjectMilestone, ContractAmendment } from '@/lib/types'
import { Calendar, DollarSign, Clock, CheckCircle2, AlertCircle, PlayCircle, AlertTriangle, TrendingUp } from 'lucide-react'
import { computeTaskDates, computeProjectExtension, countWorkingDays } from '@/lib/scheduler'

interface Props {
  project: Project
  tasks: WBSTask[]
  milestones: ProjectMilestone[]
  amendments?: ContractAmendment[]
  inspections?: any[]
  theme: 'dark' | 'light'
}

// 📊 Horizontal Slide Gauge for SV & CV Deviations
function SlideGauge({ value, min = -50, max = 50, label, suffix = "%", isDark }: { value: number; min?: number; max?: number; label: string; suffix?: string; isDark: boolean }) {
  const percent = ((value - min) / (max - min)) * 100
  const boundedPercent = Math.min(100, Math.max(0, percent))
  const isPositive = value >= 0
  const headingColor = isDark ? 'text-white' : 'text-slate-900 font-extrabold'

  return (
    <div className="w-full">
      <div className="flex justify-between items-end mb-1">
        <span className="text-[11px] font-black uppercase tracking-wider text-slate-800 dark:text-white/60">{label}</span>
        <span className={`text-sm font-black font-mono ${isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
          {isPositive ? '+' : ''}{value.toFixed(1)}{suffix}
        </span>
      </div>
      <div className="relative w-full h-2.5 bg-slate-200 dark:bg-white/10 rounded-full">
        {/* Center tick */}
        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-slate-400 dark:bg-white/20 z-10" />
        
        {/* Slider bar */}
        {isPositive ? (
          <div 
            className="absolute left-1/2 top-0 bottom-0 bg-emerald-500 rounded-r-full" 
            style={{ right: `${100 - boundedPercent}%` }}
          />
        ) : (
          <div 
            className="absolute right-1/2 top-0 bottom-0 bg-red-500 rounded-l-full" 
            style={{ left: `${boundedPercent}%` }}
          />
        )}
        
        {/* Slider indicator dot */}
        <div 
          className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border border-white dark:border-[#14142a] shadow transition-all z-20 ${isPositive ? 'bg-emerald-500' : 'bg-red-500'}`}
          style={{ left: `calc(${boundedPercent}% - 8px)` }}
        />
      </div>
    </div>
  )
}

// 📦 Horizontal Stacked segmented WBS progress bar
function WBSSegmentBar({ done, delayed, inProgress, future }: { done: number; delayed: number; inProgress: number; future: number }) {
  const total = done + delayed + inProgress + future
  if (total === 0) return null
  
  const pctDone = (done / total) * 100
  const pctDelayed = (delayed / total) * 100
  const pctInProgress = (inProgress / total) * 100
  const pctFuture = (future / total) * 100

  return (
    <div className="w-full mt-2">
      <div className="w-full h-3.5 rounded-full flex overflow-hidden bg-slate-200 dark:bg-white/10 shadow-inner">
        {done > 0 && <div className="bg-emerald-500 h-full transition-all" style={{ width: `${pctDone}%` }} title={`เสร็จสิ้น: ${done}`} />}
        {delayed > 0 && <div className="bg-red-500 h-full transition-all" style={{ width: `${pctDelayed}%` }} title={`ล่าช้า: ${delayed}`} />}
        {inProgress > 0 && <div className="bg-blue-500 h-full transition-all" style={{ width: `${pctInProgress}%` }} title={`กำลังดำเนินการ: ${inProgress}`} />}
        {future > 0 && <div className="bg-slate-450 h-full transition-all" style={{ width: `${pctFuture}%` }} title={`ยังไม่เริ่ม: ${future}`} />}
      </div>
    </div>
  )
}

export function SlideOverview({ project, tasks, milestones, amendments = [], inspections = [], theme }: Props) {
  const isDark = theme === 'dark'

  const evm = useMemo(() => {
    const today = new Date()
    const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate())

    const ext = computeProjectExtension(project, amendments)
    const { totalDays, daysUsed, daysRemaining, isOverrun, isCurrentlySuspended, currentSuspension, totalSuspendedDays } = ext

    const scheduledTasks = computeTaskDates(tasks, project.start_date, amendments)
    const totalWbsCost = scheduledTasks.reduce((sum, t) => sum + (Number(t.cost) || 0), 0)

    let pvCumulative = 0
    let evCumulative = 0

    if (totalWbsCost > 0) {
      for (const t of scheduledTasks) {
        const tStart = new Date(t.computedStartDate)
        const tEnd = new Date(t.computedEndDate)
        const weight = (Number(t.cost) || 0) / totalWbsCost

        let plannedProgress = 0
        if (todayDateOnly >= tEnd) plannedProgress = 100
        else if (todayDateOnly < tStart) plannedProgress = 0
        else {
          const elapsed = countWorkingDays(tStart, todayDateOnly, amendments)
          const total = Math.max(1, countWorkingDays(tStart, tEnd, amendments))
          plannedProgress = (elapsed / total) * 100
        }
        pvCumulative += weight * plannedProgress
        evCumulative += weight * (t.actual_progress || 0)
      }
    } else if (scheduledTasks.length > 0) {
      let totalPV = 0, totalEV = 0
      for (const t of scheduledTasks) {
        const tStart = new Date(t.computedStartDate)
        const tEnd = new Date(t.computedEndDate)
        let plannedProgress = 0
        if (todayDateOnly >= tEnd) plannedProgress = 100
        else if (todayDateOnly < tStart) plannedProgress = 0
        else {
          const elapsed = countWorkingDays(tStart, todayDateOnly, amendments)
          const total = Math.max(1, countWorkingDays(tStart, tEnd, amendments))
          plannedProgress = (elapsed / total) * 100
        }
        totalPV += plannedProgress
        totalEV += (t.actual_progress || 0)
      }
      pvCumulative = totalPV / scheduledTasks.length
      evCumulative = totalEV / scheduledTasks.length
    }

    const paidMilestonesAmount = milestones.filter(m => m.is_paid).reduce((sum, m) => sum + (Number(m.amount) || 0), 0)
    const AC_Cost = milestones.length > 0 ? paidMilestonesAmount : (project.paid_amount || 0)
    const BAC = project.budget || 1
    const acPercent = (AC_Cost / BAC) * 100

    const EV_Cost = BAC * (evCumulative / 100)
    const PV_Cost = BAC * (pvCumulative / 100)

    const svPercent = evCumulative - pvCumulative
    let svDays = 0
    if (totalDays > 0) svDays = Math.round((svPercent / 100) * totalDays)

    const cvCost = EV_Cost - AC_Cost
    const cvPercent = (cvCost / BAC) * 100

    const SPI = pvCumulative > 0 ? evCumulative / pvCumulative : 1.0
    const CPI = acPercent > 0 ? evCumulative / acPercent : 1.0

    let penaltyDays = 0
    let totalPenalty = 0
    if (isOverrun && (project.progress || 0) < 100) {
      penaltyDays = Math.abs(daysRemaining)
      totalPenalty = penaltyDays * (project.penalty_rate || 0)
    }

    let done = 0, delayed = 0, inProgress = 0, future = 0
    const activeAndDelayedTasksList: Array<{ name: string; progress: number; isDelayed: boolean }> = []

    scheduledTasks.forEach(t => {
      const tStart = new Date(t.computedStartDate)
      const tEnd = new Date(t.computedEndDate)
      tStart.setHours(0, 0, 0, 0)
      tEnd.setHours(0, 0, 0, 0)

      if (t.actual_progress === 100) {
        done++
      } else if (tStart > todayDateOnly) {
        future++
      } else {
        const totalDur = Math.max(1, countWorkingDays(tStart, tEnd, amendments))
        const elapsed = countWorkingDays(tStart, todayDateOnly, amendments)
        const plannedPct = Math.min(100, (elapsed / totalDur) * 100)
        const diff = plannedPct - (t.actual_progress || 0)
        
        const isDelayed = diff >= 5
        if (isDelayed) {
          delayed++
        } else {
          inProgress++
        }

        activeAndDelayedTasksList.push({
          name: t.name,
          progress: t.actual_progress || 0,
          isDelayed
        })
      }
    })

    const sortedActiveTasks = [...activeAndDelayedTasksList].sort((a, b) => {
      if (a.isDelayed && !b.isDelayed) return -1
      if (!a.isDelayed && b.isDelayed) return 1
      return b.progress - a.progress
    })

    let committeeList: string[] = []
    try {
      if (project.inspection_committee) {
        const parsed = JSON.parse(project.inspection_committee)
        if (Array.isArray(parsed)) committeeList = parsed.filter(Boolean)
        else committeeList = project.inspection_committee.split(',').map(s => s.trim()).filter(Boolean)
      }
    } catch {
      if (project.inspection_committee)
        committeeList = project.inspection_committee.split('\n').map(s => s.trim()).filter(Boolean)
    }

    const totalMilestones = milestones.length
    const paidMilestones = milestones.filter(m => m.is_paid).length
    const remainingMilestones = totalMilestones - paidMilestones

    const activeMilestone = [...milestones]
      .filter(m => !m.is_paid)
      .sort((a, b) => a.milestone_no - b.milestone_no)[0] || null

    return {
      pvCumulative, evCumulative, acPercent, AC_Cost, BAC,
      svPercent, svDays, cvPercent, cvCost,
      SPI, CPI,
      done, delayed, inProgress, future,
      totalDays, daysUsed, daysRemaining: Math.abs(daysRemaining), isOverrun,
      isCurrentlySuspended, currentSuspension, totalSuspendedDays,
      penaltyDays, totalPenalty,
      committeeList,
      totalMilestones, paidMilestones, remainingMilestones,
      activeMilestone, sortedActiveTasks,
    }
  }, [project, tasks, milestones, amendments])

  const fmt = (val: number) =>
    new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val)

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'

  // Premium, high-contrast typography and borders
  const card = isDark 
    ? 'bg-[#14142a]/90 backdrop-blur-md border border-white/10 shadow-2xl shadow-black/40' 
    : 'bg-white border-2 border-slate-300 shadow-lg shadow-slate-200/60'
  const muted = isDark ? 'text-white/70 font-bold' : 'text-slate-900 font-extrabold'
  const heading = isDark ? 'text-white' : 'text-slate-950 font-black'
  const bodyText = isDark ? 'text-slate-100' : 'text-slate-900 font-bold'

  return (
    <div className="w-full h-full flex flex-col px-10 py-6 select-none" style={{ fontFamily: 'Inter, Noto Sans Thai, sans-serif' }}>

      {/* ── Premium Header ── */}
      <div className="flex justify-between items-start mb-4 gap-6">
        <div className="flex-1 min-w-0">
          <h1 className={`text-4xl font-extrabold leading-tight mb-2 tracking-tight ${isDark ? 'text-[#e87ae4] drop-shadow-[0_0_12px_rgba(232,122,228,0.25)]' : 'text-purple-800'}`}>
            {project.name}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-sm font-extrabold">
            <span className={`px-3 py-0.5 rounded-full font-black text-[12px] ${
              project.status === 'กำลังดำเนินการ' ? 'bg-amber-500/20 text-amber-800 dark:text-amber-400' :
              project.status === 'ระงับ' ? 'bg-red-500/20 text-red-700 dark:text-red-450' :
              project.status === 'เสร็จสิ้น' ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-455' :
              project.status === 'รอดำเนินการ' ? 'bg-blue-500/20 text-blue-800 dark:text-blue-455' :
              project.status === 'จัดซื้อจัดจ้าง' ? 'bg-indigo-500/20 text-indigo-800 dark:text-indigo-455' :
              'bg-purple-500/20 text-purple-800'
            }`}>
              {project.status}
            </span>
            {project.location && <span className={`flex items-center gap-1 text-slate-950 dark:text-white/80`}>📍 {project.location}</span>}
            {project.contractor && (
              <span className={`flex items-center gap-1 text-slate-950 dark:text-white/80`}>
                🏗️ {project.contractor}
              </span>
            )}
            {project.contract_no && (
              <span className={`font-mono text-[12px] text-slate-950 dark:text-white/80`}>สัญญา: {project.contract_no}</span>
            )}
          </div>
        </div>

        {/* Dates, Timeline & Warning Status */}
        <div className="text-right flex-shrink-0 flex flex-col items-end">
          <p className="text-xs font-black text-slate-950 dark:text-white/80 mb-0.5 flex items-center gap-1.5">
            <Calendar size={13} />
            {fmtDate(project.start_date)} — {evm.isOverrun
              ? <span className="text-red-600 font-extrabold">เกินสัญญา {evm.daysRemaining} วัน</span>
              : fmtDate(project.end_date)}
          </p>
          <p className={`text-2xl font-black ${evm.isOverrun ? 'text-red-500' : isDark ? 'text-blue-400' : 'text-blue-700'}`}>
            {evm.isOverrun ? `⚠ เกินกำหนด ${evm.daysRemaining} วัน` : `เหลือ ${evm.daysRemaining} วัน`}
          </p>
          {evm.totalPenalty > 0 && (
            <p className="text-xs font-black text-red-600 mt-1 bg-red-500/10 px-2 py-0.5 rounded">ค่าปรับสะสม {fmt(evm.totalPenalty)}</p>
          )}
        </div>
      </div>

      {/* Suspension Banner */}
      {evm.isCurrentlySuspended && evm.currentSuspension && (
        <div className="flex items-center gap-2 px-3.5 py-1.5 mb-3 bg-amber-500/15 border-2 border-amber-500/40 rounded-xl text-amber-800 dark:text-amber-400 text-xs font-black">
          <AlertTriangle size={15} />
          ⏸ หยุดงานชั่วคราว: {evm.currentSuspension.reason || '—'}
          {evm.currentSuspension.suspend_date && ` (ตั้งแต่ ${fmtDate(evm.currentSuspension.suspend_date)})`}
          {evm.totalSuspendedDays > 0 && ` — สะสม ${evm.totalSuspendedDays} วัน`}
        </div>
      )}

      {/* ── Main 4-Quadrant Symmetric Grid ── */}
      <div className="flex-1 grid grid-cols-2 gap-4 min-h-0">

        {/* ── LEFT COLUMN (Box 1 & Box 2) ── */}
        <div className="flex flex-col gap-4">
          
          {/* Box 1: ความก้าวหน้าสะสม (Progress Bars) */}
          <div className={`${card} rounded-3xl p-5 flex flex-col justify-between flex-1`}>
            <h3 className={`text-sm font-black uppercase tracking-wider ${muted} mb-2`}>ความก้าวหน้าสะสม</h3>
            <div className="flex-1 flex flex-col justify-around py-1 gap-2">
              {/* PV */}
              <div>
                <div className="flex justify-between items-end mb-1 text-sm font-bold">
                  <span className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-extrabold">
                    <span className="w-3 h-3 rounded-full bg-blue-600 flex-shrink-0" />
                    แผนงานสะสม (PV)
                  </span>
                  <span className={`${heading} font-mono text-base`}>{evm.pvCumulative.toFixed(1)}%</span>
                </div>
                <div className={`w-full ${isDark ? 'bg-white/10' : 'bg-slate-200'} h-3 rounded-full overflow-hidden`}>
                  <div className="bg-blue-600 h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${evm.pvCumulative}%` }} />
                </div>
              </div>

              {/* EV */}
              <div>
                <div className="flex justify-between items-end mb-1 text-sm font-bold">
                  <span className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-extrabold">
                    <span className="w-3 h-3 rounded-full bg-emerald-600 flex-shrink-0" />
                    ผลงานจริงสะสม (EV)
                  </span>
                  <span className={`${heading} font-mono text-base`}>{evm.evCumulative.toFixed(1)}%</span>
                </div>
                <div className={`w-full ${isDark ? 'bg-white/10' : 'bg-slate-200'} h-3 rounded-full overflow-hidden`}>
                  <div className="bg-emerald-500 h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${evm.evCumulative}%` }} />
                </div>
              </div>

              {/* AC */}
              <div>
                <div className="flex justify-between items-end mb-1 text-sm font-bold">
                  <span className="flex items-center gap-2 text-amber-600 dark:text-amber-500 font-extrabold">
                    <span className="w-3 h-3 rounded-full bg-amber-500 flex-shrink-0" />
                    เบิกจ่ายสะสม (AC)
                  </span>
                  <div className="text-right flex items-baseline gap-2">
                    <span className={`${muted} text-xs font-mono`}>({fmt(evm.AC_Cost)})</span>
                    <span className={`${heading} font-mono text-base`}>{evm.acPercent.toFixed(1)}%</span>
                  </div>
                </div>
                <div className={`w-full ${isDark ? 'bg-white/10' : 'bg-slate-200'} h-3 rounded-full overflow-hidden`}>
                  <div className="bg-amber-500 h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${evm.acPercent}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Box 2: การวิเคราะห์และดัชนีประสิทธิภาพ (Gauges & SPI/CPI) */}
          <div className={`${card} rounded-3xl p-5 flex flex-col justify-between flex-1`}>
            <h3 className={`text-sm font-black uppercase tracking-wider ${muted} mb-2`}>การวิเคราะห์และดัชนีประสิทธิภาพ</h3>
            
            <div className="flex-1 flex flex-col justify-around py-1 gap-4">
              {/* SV & SPI Row */}
              <div className="flex flex-col gap-1.5">
                <SlideGauge value={evm.svPercent} min={-40} max={40} label="เบี่ยงเบนแผนงาน (SV)" isDark={isDark} />
                <div className="flex justify-between items-center text-xs font-black mt-1">
                  <span className={`${evm.svPercent < 0 ? 'text-red-600' : evm.svPercent > 0 ? 'text-emerald-600' : heading}`}>
                    {evm.svPercent < 0 ? `⚠️ ล่าช้ากว่าแผน ${Math.abs(evm.svDays)} วัน` :
                     evm.svPercent > 0 ? `✅ เร็วกว่าแผน ${evm.svDays} วัน` : '🎯 ดำเนินงานตรงแผน'}
                  </span>
                  <span className={`px-2 py-0.5 rounded font-black tracking-wide ${
                    evm.SPI >= 1.0 ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' :
                    evm.SPI >= 0.85 ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400' :
                    'bg-red-500/15 text-red-650'
                  }`}>
                    SPI: {evm.SPI.toFixed(2)} ({evm.SPI >= 1.0 ? 'เร็วกว่าแผน' : evm.SPI >= 0.85 ? 'ล่าช้าเล็กน้อย' : 'วิกฤต'})
                  </span>
                </div>
              </div>

              <div className={`border-t-2 ${isDark ? 'border-white/10' : 'border-slate-200'} w-full`} />

              {/* CV & CPI Row */}
              <div className="flex flex-col gap-1.5">
                <SlideGauge value={evm.cvPercent} min={-30} max={30} label="เบี่ยงเบนต้นทุน (CV)" isDark={isDark} />
                <div className="flex justify-between items-center text-xs font-black mt-1">
                  <span className={`${evm.cvPercent < 0 ? 'text-red-600' : evm.cvPercent > 0 ? 'text-emerald-600' : heading}`}>
                    {evm.cvPercent < 0 ? `🔴 เกินงบสะสม ${fmt(Math.abs(evm.cvCost))}` :
                     evm.cvPercent > 0 ? `✅ ประหยัดงบสะสม ${fmt(evm.cvCost)}` : '🎯 จ่ายตรงตามงบ'}
                  </span>
                  <span className={`px-2 py-0.5 rounded font-black tracking-wide ${
                    evm.CPI >= 1.0 ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' :
                    evm.CPI >= 0.85 ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400' :
                    'bg-red-500/15 text-red-650'
                  }`}>
                    CPI: {evm.CPI.toFixed(2)} ({evm.CPI >= 1.0 ? 'ประหยัดงบ' : evm.CPI >= 0.85 ? 'เกินงบเล็กน้อย' : 'วิกฤต'})
                  </span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* ── RIGHT COLUMN (Box 3 & Box 4) ── */}
        <div className="flex flex-col gap-4">
          
          {/* Box 3: สถานะหัวข้องาน (WBS segmented + active/delayed task lists) */}
          <div className={`${card} rounded-3xl p-5 flex flex-col justify-between flex-1`}>
            <div>
              <h3 className={`text-sm font-black uppercase tracking-wider ${muted} mb-2`}>สถานะหัวข้องาน (WBS)</h3>
              <WBSSegmentBar done={evm.done} delayed={evm.delayed} inProgress={evm.inProgress} future={evm.future} />
            </div>

            <div className="grid grid-cols-2 gap-2 mt-3">
              <div className="flex items-center justify-between p-2 bg-emerald-500/10 dark:bg-emerald-500/10 rounded-2xl border-2 border-emerald-500/25">
                <span className="text-xs font-black text-slate-900 dark:text-white/80 flex items-center gap-1.5"><CheckCircle2 className="text-emerald-500" size={14} />เสร็จสิ้น</span>
                <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">{evm.done}</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-red-500/10 dark:bg-red-500/10 rounded-2xl border-2 border-red-500/25">
                <span className="text-xs font-black text-slate-900 dark:text-white/80 flex items-center gap-1.5"><AlertCircle className="text-red-500" size={14} />ล่าช้า</span>
                <span className="text-lg font-black text-red-600 dark:text-red-400 font-mono">{evm.delayed}</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-blue-500/10 dark:bg-blue-500/10 rounded-2xl border-2 border-blue-500/25">
                <span className="text-xs font-black text-slate-900 dark:text-white/80 flex items-center gap-1.5"><PlayCircle className="text-blue-500" size={14} />กำลังทำ</span>
                <span className="text-lg font-black text-blue-600 dark:text-blue-400 font-mono">{evm.inProgress}</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-slate-100 dark:bg-white/5 rounded-2xl border-2 border-slate-300 dark:border-white/10">
                <span className="text-xs font-black text-slate-900 dark:text-white/85 flex items-center gap-1.5"><Clock className="text-slate-500" size={14} />ยังไม่เริ่ม</span>
                <span className="text-lg font-black text-slate-700 dark:text-slate-300 font-mono">{evm.future}</span>
              </div>
            </div>

            {/* List of active and delayed tasks (Fills vertical whitespace) */}
            <div className={`mt-3 pt-3 border-t-2 ${isDark ? 'border-white/10' : 'border-slate-200'} flex-1 flex flex-col justify-start`}>
              <h4 className={`text-xs font-black uppercase tracking-wider text-slate-950 dark:text-white/70 mb-1.5`}>รายการงานกำลังทำ & ล่าช้า ({evm.sortedActiveTasks.length})</h4>
              {evm.sortedActiveTasks.length > 0 ? (
                <div className="space-y-1 overflow-y-auto max-h-[85px] pr-1">
                  {evm.sortedActiveTasks.slice(0, 3).map((task, index) => (
                    <div key={index} className="flex justify-between items-center text-[12px] font-extrabold gap-4 py-0.5">
                      <span className={`truncate flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-950'}`}>
                        {task.isDelayed ? (
                          <span className="w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0" />
                        ) : (
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 flex-shrink-0" />
                        )}
                        {task.name}
                      </span>
                      <span className={`font-mono flex-shrink-0 ${task.isDelayed ? 'text-red-600' : 'text-blue-600 dark:text-blue-400'}`}>
                        {task.progress}% {task.isDelayed ? '(ล่าช้า)' : '(กำลังทำ)'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={`text-xs font-extrabold italic ${isDark ? 'text-white/50' : 'text-slate-700'}`}>ไม่มีงานกำลังดำเนินการในเวลานี้</p>
              )}
            </div>
          </div>

          {/* Box 4: ข้อมูลสัญญาและงบประมาณ + งวดงานที่กำลังทำ (Financial & Next Milestone details) */}
          <div className={`${card} rounded-3xl p-5 flex flex-col justify-between flex-1`}>
            <div>
              <h3 className={`text-sm font-black uppercase tracking-wider ${muted} mb-2`}>การเงินและสัญญา</h3>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between font-black text-sm text-slate-950 dark:text-white">
                  <span>งบประมาณมูลค่าสัญญา</span>
                  <span className="font-mono">{fmt(evm.BAC)}</span>
                </div>
                <div className="flex justify-between font-black text-sm text-emerald-600 dark:text-emerald-450">
                  <span>เบิกจ่ายเงินสะสม (AC)</span>
                  <span className="font-mono">{fmt(evm.AC_Cost)}</span>
                </div>
                
                <div className="pt-1.5">
                  <div className={`w-full ${isDark ? 'bg-white/10' : 'bg-slate-200'} h-2.5 rounded-full overflow-hidden`}>
                    <div 
                      className="bg-purple-600 h-full rounded-full transition-all duration-700 ease-out"
                      style={{ width: `${Math.min(100, (evm.AC_Cost / evm.BAC) * 100)}%` }} 
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs font-black pt-2 border-t-2 border-slate-200 dark:border-white/10 mt-2">
                  <span className="text-slate-900 dark:text-white/80">การส่งมอบงวดงาน</span>
                  <span>
                    ส่งแล้ว <span className="text-emerald-600 font-mono font-black">{evm.paidMilestones}</span> / เหลือ <span className="text-amber-600 font-mono font-black">{evm.remainingMilestones}</span> / ทั้งหมด <span className="font-mono font-black">{evm.totalMilestones}</span> งวด
                  </span>
                </div>
              </div>
            </div>

            {/* งวดงานถัดไป/งวดงานที่กำลังดำเนินการอยู่ตอนนี้ (Fills financial card whitespace) */}
            <div className={`border-t-2 ${isDark ? 'border-white/10' : 'border-slate-200'} mt-3 pt-3 flex-1 flex flex-col justify-start`}>
              <h4 className={`text-xs font-black uppercase tracking-wider text-slate-950 dark:text-white/70 mb-1.5`}>งวดงานที่ต้องดำเนินงานถัดไป</h4>
              {evm.activeMilestone ? (
                <div className="bg-slate-100 dark:bg-white/5 p-2.5 rounded-2xl border-2 border-slate-200 dark:border-white/10 text-xs font-extrabold space-y-1">
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-slate-950 dark:text-white truncate">งวดที่ {evm.activeMilestone.milestone_no}: {evm.activeMilestone.name}</span>
                    <span className="text-amber-600 dark:text-amber-400 font-mono flex-shrink-0">{fmt(evm.activeMilestone.amount)}</span>
                  </div>
                  {evm.activeMilestone.work_scope && (
                    <p className="text-slate-900 dark:text-white/80 font-bold text-[11px] leading-relaxed mt-0.5 line-clamp-2">
                      📝 งาน: {evm.activeMilestone.work_scope}
                    </p>
                  )}
                  {evm.activeMilestone.expected_payment_date && (
                    <p className="text-[10px] text-slate-950 dark:text-white/70 mt-1 flex items-center gap-1">
                      📅 กำหนดส่งงาน: {fmtDate(evm.activeMilestone.expected_payment_date)}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs font-black italic text-slate-950 dark:text-white/50">ส่งมอบงานและชำระเงินครบทุกงวดงานแล้ว</p>
              )}
            </div>

            {/* Committee members & details */}
            {(project.contractor || project.contract_no || evm.committeeList.length > 0) && (
              <div className={`border-t-2 ${isDark ? 'border-white/10' : 'border-slate-200'} mt-3 pt-2 space-y-0.5 text-[11px] font-extrabold`}>
                {project.contractor && (
                  <p className="text-slate-950 dark:text-white/85">ผู้รับจ้าง: <span className="font-black text-black dark:text-white">{project.contractor}</span></p>
                )}
                {evm.committeeList.length > 0 && (
                  <div className="truncate">
                    <span className="text-slate-950 dark:text-white/85 mr-1">กรรมการตรวจรับ:</span>
                    <span className="font-black text-black dark:text-white">
                      {evm.committeeList.slice(0, 3).join(' · ')}
                      {evm.committeeList.length > 3 && ` +${evm.committeeList.length - 3} คน`}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>

      </div>

      {/* ── Overall Health Footer ── */}
      <div className={`mt-4 flex items-center justify-center py-2.5 rounded-2xl text-xs font-extrabold tracking-wide ${
        evm.SPI >= 1.0 && evm.CPI >= 1.0
          ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-400'
          : evm.SPI < 0.85 || evm.CPI < 0.85
          ? 'bg-red-500/15 text-red-800'
          : 'bg-amber-500/15 text-amber-800 dark:text-amber-400'
      }`}>
        <TrendingUp size={14} className="mr-2" />
        {evm.SPI >= 1.0 && evm.CPI >= 1.0
          ? '● สุขภาพโครงการสมบูรณ์ (Healthy Project) - ความก้าวหน้าและดัชนีสะสมเป็นไปตามเกณฑ์ปกติ'
          : evm.SPI < 0.85 || evm.CPI < 0.85
          ? '⚠ วิกฤต (Critical Alert) - งานเกิดความล่าช้าสะสมหรือต้นทุนเกินเกณฑ์ ต้องวางแผนแก้ไขเร่งด่วน'
          : '⚠ เฝ้าระวัง (Warning) - ดัชนีแผนงานหรือต้นทุนเริ่มมีความเบี่ยงเบน ควรติดตามงานอย่างใกล้ชิด'}
      </div>
    </div>
  )
}
