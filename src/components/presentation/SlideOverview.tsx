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

// 🟢 Concentric Rings Component for visual progress tracking (Apple Watch Style)
function ConcentricRings({ ev, pv, ac, isDark }: { ev: number; pv: number; ac: number; isDark: boolean }) {
  const center = 100
  const rPV = 80
  const rEV = 62
  const rAC = 44
  
  const cPV = 2 * Math.PI * rPV
  const cEV = 2 * Math.PI * rEV
  const cAC = 2 * Math.PI * rAC
  
  const offsetPV = cPV * (1 - Math.min(100, Math.max(0, pv)) / 100)
  const offsetEV = cEV * (1 - Math.min(100, Math.max(0, ev)) / 100)
  const offsetAC = cAC * (1 - Math.min(100, Math.max(0, ac)) / 100)

  return (
    <div className="relative flex items-center justify-center w-48 h-48 flex-shrink-0">
      <svg width="200" height="200" className="transform -rotate-90">
        {/* Track Backdrops */}
        <circle cx={center} cy={center} r={rPV} fill="transparent" stroke={isDark ? '#3b82f615' : '#3b82f610'} strokeWidth="10" />
        <circle cx={center} cy={center} r={rEV} fill="transparent" stroke={isDark ? '#10b98115' : '#10b98110'} strokeWidth="10" />
        <circle cx={center} cy={center} r={rAC} fill="transparent" stroke={isDark ? '#f59e0b15' : '#f59e0b10'} strokeWidth="10" />

        {/* PV Ring (Blue) */}
        <circle 
          cx={center} cy={center} r={rPV} 
          fill="transparent" 
          stroke="#3b82f6" 
          strokeWidth="10" 
          strokeDasharray={cPV} 
          strokeDashoffset={offsetPV}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />

        {/* EV Ring (Emerald) */}
        <circle 
          cx={center} cy={center} r={rEV} 
          fill="transparent" 
          stroke="#10b981" 
          strokeWidth="10" 
          strokeDasharray={cEV} 
          strokeDashoffset={offsetEV}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />

        {/* AC Ring (Amber) */}
        <circle 
          cx={center} cy={center} r={rAC} 
          fill="transparent" 
          stroke="#f59e0b" 
          strokeWidth="10" 
          strokeDasharray={cAC} 
          strokeDashoffset={offsetAC}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      {/* Center Text Summary */}
      <div className="absolute flex flex-col items-center justify-center text-center pointer-events-none">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">EV จริง</span>
        <span className="text-3xl font-black text-emerald-500 leading-none">{ev.toFixed(1)}%</span>
        <span className="text-[9px] font-bold text-blue-500/90 dark:text-blue-400/90 mt-1">แผน PV: {pv.toFixed(1)}%</span>
      </div>
    </div>
  )
}

// 📊 Horizontal Slide Gauge for SV & CV Deviations
function SlideGauge({ value, min = -50, max = 50, label, suffix = "%", isCurrency = false }: { value: number; min?: number; max?: number; label: string; suffix?: string; isCurrency?: boolean }) {
  const percent = ((value - min) / (max - min)) * 100
  const boundedPercent = Math.min(100, Math.max(0, percent))
  
  const displayVal = isCurrency 
    ? (value >= 0 ? '+' : '') + new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(value)
    : (value >= 0 ? '+' : '') + value.toFixed(1) + suffix

  const isPositive = value >= 0

  return (
    <div className="w-full">
      <div className="flex justify-between items-end mb-1">
        <span className="text-[10px] font-bold opacity-50 uppercase tracking-wider">{label}</span>
        <span className={`text-sm font-black font-mono ${isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
          {displayVal}
        </span>
      </div>
      <div className="relative w-full h-2.5 bg-slate-100 dark:bg-white/10 rounded-full">
        {/* Center alignment tick */}
        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-slate-300 dark:bg-white/20 z-10" />
        
        {/* Slider filling */}
        {isPositive ? (
          <div 
            className="absolute left-1/2 top-0 bottom-0 bg-emerald-500/80 dark:bg-emerald-500/60 rounded-r-full" 
            style={{ right: `${100 - boundedPercent}%` }}
          />
        ) : (
          <div 
            className="absolute right-1/2 top-0 bottom-0 bg-red-500/80 dark:bg-red-500/60 rounded-l-full" 
            style={{ left: `${boundedPercent}%` }}
          />
        )}
        
        {/* Slider dot indicator */}
        <div 
          className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border border-white dark:border-[#14142a] shadow-md transition-all z-20 ${isPositive ? 'bg-emerald-500' : 'bg-red-500'}`}
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
      <div className="w-full h-3 rounded-full flex overflow-hidden bg-slate-100 dark:bg-white/10 shadow-inner">
        {done > 0 && <div className="bg-emerald-500 h-full transition-all" style={{ width: `${pctDone}%` }} title={`เสร็จสิ้น: ${done}`} />}
        {delayed > 0 && <div className="bg-red-500 h-full transition-all" style={{ width: `${pctDelayed}%` }} title={`ล่าช้า: ${delayed}`} />}
        {inProgress > 0 && <div className="bg-blue-500 h-full transition-all" style={{ width: `${pctInProgress}%` }} title={`กำลังดำเนินการ: ${inProgress}`} />}
        {future > 0 && <div className="bg-slate-400 h-full transition-all" style={{ width: `${pctFuture}%` }} title={`ยังไม่เริ่ม: ${future}`} />}
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
        if (plannedPct - (t.actual_progress || 0) >= 5) delayed++
        else inProgress++
      }
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

    return {
      pvCumulative, evCumulative, acPercent, AC_Cost, BAC,
      svPercent, svDays, cvPercent, cvCost,
      SPI, CPI,
      done, delayed, inProgress, future,
      totalDays, daysUsed, daysRemaining: Math.abs(daysRemaining), isOverrun,
      isCurrentlySuspended, currentSuspension, totalSuspendedDays,
      penaltyDays, totalPenalty,
      committeeList,
    }
  }, [project, tasks, milestones, amendments])

  const fmt = (val: number) =>
    new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val)

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'

  // Premium glassmorphic styling
  const card = isDark 
    ? 'bg-[#14142a]/80 backdrop-blur-md border border-white/5 shadow-2xl shadow-black/30' 
    : 'bg-white border border-slate-200/80 shadow-md shadow-slate-100'
  const muted = isDark ? 'text-white/45' : 'text-slate-500'
  const heading = isDark ? 'text-white' : 'text-slate-800'

  return (
    <div className="w-full h-full flex flex-col px-10 py-6 select-none" style={{ fontFamily: 'Inter, Noto Sans Thai, sans-serif' }}>

      {/* ── Premium Header ── */}
      <div className="flex justify-between items-start mb-4 gap-6">
        <div className="flex-1 min-w-0">
          <h1 className={`text-4xl font-extrabold leading-tight mb-2 tracking-tight ${isDark ? 'text-[#e87ae4] drop-shadow-[0_0_15px_rgba(232,122,228,0.2)]' : 'text-purple-700'}`}>
            {project.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
              project.status === 'กำลังดำเนินการ' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' :
              project.status === 'ระงับ' ? 'bg-red-500/15 text-red-500' :
              project.status === 'เสร็จสิ้น' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' :
              project.status === 'รอดำเนินการ' ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400' :
              project.status === 'จัดซื้อจัดจ้าง' ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400' :
              'bg-purple-500/15 text-purple-600'
            }`}>
              {project.status}
            </span>
            {project.location && <span className={`flex items-center gap-1 ${muted}`}>📍 {project.location}</span>}
            {project.contractor && (
              <span className={`flex items-center gap-1 ${isDark ? 'text-white/60' : 'text-slate-600'}`}>
                🏗️ {project.contractor}
              </span>
            )}
            {project.contract_no && (
              <span className={`font-mono text-[11px] ${muted}`}>สัญญา: {project.contract_no}</span>
            )}
          </div>
        </div>

        {/* Dates, Timeline & Warning Status */}
        <div className="text-right flex-shrink-0 flex flex-col items-end">
          <p className={`text-xs font-bold ${muted} mb-1 flex items-center gap-1.5`}>
            <Calendar size={12} />
            {fmtDate(project.start_date)} — {evm.isOverrun
              ? <span className="text-red-500 font-bold">เกินสัญญา {evm.daysRemaining} วัน</span>
              : fmtDate(project.end_date)}
          </p>
          <p className={`text-2xl font-black ${evm.isOverrun ? 'text-red-500' : isDark ? 'text-blue-400' : 'text-blue-600'}`}>
            {evm.isOverrun ? `⚠ เลยกำหนดมา ${evm.daysRemaining} วัน` : `เหลือ ${evm.daysRemaining} วัน`}
          </p>
          {evm.totalPenalty > 0 && (
            <p className="text-xs font-bold text-red-500 mt-1 bg-red-500/10 px-2 py-0.5 rounded">ค่าปรับสะสม {fmt(evm.totalPenalty)}</p>
          )}
        </div>
      </div>

      {/* Suspension Banner */}
      {evm.isCurrentlySuspended && evm.currentSuspension && (
        <div className="flex items-center gap-2 px-3.5 py-2 mb-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-600 dark:text-amber-400 text-xs font-bold">
          <AlertTriangle size={15} />
          ⏸ หยุดงานชั่วคราว: {evm.currentSuspension.reason || '—'}
          {evm.currentSuspension.suspend_date && ` (ตั้งแต่ ${fmtDate(evm.currentSuspension.suspend_date)})`}
          {evm.totalSuspendedDays > 0 && ` — สะสม ${evm.totalSuspendedDays} วัน`}
        </div>
      )}

      {/* ── Main Layout Grid ── */}
      <div className="flex-1 flex gap-5 min-h-0">

        {/* Left Area: Visual Progress & Earned Value Indicators */}
        <div className="w-[58%] flex flex-col gap-4">

          {/* Row 1: Triple Concentric Circles Overview */}
          <div className={`${card} rounded-3xl p-5 flex items-center justify-between gap-6 flex-1`}>
            {/* Concentric rings graph visualizer */}
            <ConcentricRings ev={evm.evCumulative} pv={evm.pvCumulative} ac={evm.acPercent} isDark={isDark} />

            {/* Custom Interactive Legend */}
            <div className="flex-1 flex flex-col gap-3 justify-center">
              <h3 className={`text-xs font-bold uppercase tracking-wider mb-1 ${muted}`}>ความคืบหน้าสะสม</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="flex items-center gap-2 text-blue-500">
                    <span className="w-3 h-3 rounded-full bg-blue-500 flex-shrink-0" />
                    แผนงานสะสม (PV)
                  </span>
                  <span className={`${heading} font-mono text-sm`}>{evm.pvCumulative.toFixed(1)}%</span>
                </div>
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="flex items-center gap-2 text-emerald-500">
                    <span className="w-3 h-3 rounded-full bg-emerald-500 flex-shrink-0" />
                    ผลงานจริงสะสม (EV)
                  </span>
                  <span className={`${heading} font-mono text-sm`}>{evm.evCumulative.toFixed(1)}%</span>
                </div>
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="flex items-center gap-2 text-amber-500">
                    <span className="w-3 h-3 rounded-full bg-amber-500 flex-shrink-0" />
                    เบิกจ่ายสะสม (AC)
                  </span>
                  <div className="text-right">
                    <span className={`${heading} font-mono text-sm block`}>{evm.acPercent.toFixed(1)}%</span>
                    <span className={`${muted} text-[9px] font-mono block leading-tight`}>{fmt(evm.AC_Cost)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Deviations Speedometer Slider Gauges & Indices */}
          <div className="grid grid-cols-2 gap-4 flex-1">
            {/* Schedule Variance Slider */}
            <div className={`${card} rounded-3xl p-5 flex flex-col justify-between`}>
              <div className="flex items-center gap-2">
                <Calendar size={15} className="text-blue-500" />
                <h4 className={`text-xs font-bold ${heading}`}>เบี่ยงเบนแผนงาน (SV)</h4>
              </div>
              <SlideGauge value={evm.svPercent} min={-40} max={40} label="Schedule Variance" />
              <p className={`text-xs font-bold mt-2 ${evm.svPercent < 0 ? 'text-red-500' : evm.svPercent > 0 ? 'text-emerald-500' : muted}`}>
                {evm.svPercent < 0 ? `⚠️ ล่าช้ากว่าแผน ${Math.abs(evm.svDays)} วัน` :
                 evm.svPercent > 0 ? `✅ เร็วกว่าแผน ${evm.svDays} วัน` : '🎯 ดำเนินงานตรงตามแผนที่กำหนด'}
              </p>
            </div>

            {/* Cost Variance Slider */}
            <div className={`${card} rounded-3xl p-5 flex flex-col justify-between`}>
              <div className="flex items-center gap-2">
                <DollarSign size={15} className="text-amber-500" />
                <h4 className={`text-xs font-bold ${heading}`}>เบี่ยงเบนต้นทุน (CV)</h4>
              </div>
              {/* Scale CV based on percentage of BAC */}
              <SlideGauge value={evm.cvPercent} min={-30} max={30} label="Cost Variance" />
              <p className={`text-xs font-bold mt-2 ${evm.cvPercent < 0 ? 'text-red-500' : evm.cvPercent > 0 ? 'text-emerald-500' : muted}`}>
                {evm.cvPercent < 0 ? `🔴 ใช้จ่ายเงินเกินงบ ${fmt(Math.abs(evm.cvCost))}` :
                 evm.cvPercent > 0 ? `✅ ใช้จ่ายเงินประหยัด ${fmt(evm.cvCost)}` : '🎯 อัตราการจ่ายเงินตรงตามงบ'}
              </p>
            </div>
          </div>

        </div>

        {/* Right Area: WBS segmented breakdown & Financial budget */}
        <div className="w-[42%] flex flex-col gap-4">

          {/* Card 1: WBS Segmented Status breakdown */}
          <div className={`${card} rounded-3xl p-5 flex flex-col justify-between flex-1`}>
            <div>
              <div className="flex justify-between items-center mb-1">
                <h3 className={`text-xs font-bold uppercase tracking-wider ${muted}`}>สถานะหัวข้องาน (WBS)</h3>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                  evm.SPI >= 1.0 ? 'bg-emerald-500/10 text-emerald-500' :
                  evm.SPI >= 0.85 ? 'bg-amber-500/10 text-amber-500' :
                  'bg-red-500/10 text-red-500'
                }`}>
                  SPI: {evm.SPI.toFixed(2)}
                </span>
              </div>
              <WBSSegmentBar done={evm.done} delayed={evm.delayed} inProgress={evm.inProgress} future={evm.future} />
            </div>

            <div className="grid grid-cols-2 gap-2 mt-4">
              <div className="flex items-center justify-between p-2.5 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-2xl border border-emerald-500/10">
                <span className={`text-xs font-bold ${muted} flex items-center gap-1.5`}><CheckCircle2 className="text-emerald-500" size={14} />เสร็จสิ้น</span>
                <span className="text-lg font-black text-emerald-500 font-mono">{evm.done}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-red-500/5 dark:bg-red-500/10 rounded-2xl border border-red-500/10">
                <span className={`text-xs font-bold ${muted} flex items-center gap-1.5`}><AlertCircle className="text-red-500" size={14} />ล่าช้า</span>
                <span className="text-lg font-black text-red-500 font-mono">{evm.delayed}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-blue-500/5 dark:bg-blue-500/10 rounded-2xl border border-blue-500/10">
                <span className={`text-xs font-bold ${muted} flex items-center gap-1.5`}><PlayCircle className="text-blue-500" size={14} />กำลังทำ</span>
                <span className="text-lg font-black text-blue-500 font-mono">{evm.inProgress}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-slate-500/5 dark:bg-slate-500/10 rounded-2xl border border-slate-500/10">
                <span className={`text-xs font-bold ${muted} flex items-center gap-1.5`}><Clock className="text-slate-400" size={14} />ยังไม่เริ่ม</span>
                <span className="text-lg font-black text-slate-400 dark:text-slate-500 font-mono">{evm.future}</span>
              </div>
            </div>
          </div>

          {/* Card 2: Financial budget progress and Committee list */}
          <div className={`${card} rounded-3xl p-5 flex flex-col justify-between`}>
            <div>
              <div className="flex justify-between items-center mb-2">
                <h3 className={`text-xs font-bold uppercase tracking-wider ${muted}`}>สถานะการเงินโครงการ</h3>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                  evm.CPI >= 1.0 ? 'bg-emerald-500/10 text-emerald-500' :
                  evm.CPI >= 0.85 ? 'bg-amber-500/10 text-amber-500' :
                  'bg-red-500/10 text-red-500'
                }`}>
                  CPI: {evm.CPI.toFixed(2)}
                </span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between font-bold">
                  <span className={muted}>งบประมาณมูลค่าสัญญา</span>
                  <span className={heading}>{fmt(evm.BAC)}</span>
                </div>
                <div className="flex justify-between font-bold text-emerald-500">
                  <span>เบิกจ่ายเงินสะสมจริง (AC)</span>
                  <span>{fmt(evm.AC_Cost)}</span>
                </div>
                
                {/* Budget progress bar */}
                <div className="pt-2">
                  <div className={`w-full ${isDark ? 'bg-white/10' : 'bg-slate-100'} h-2 rounded-full overflow-hidden`}>
                    <div 
                      className="bg-purple-500 h-full rounded-full transition-all duration-700 ease-out"
                      style={{ width: `${Math.min(100, (evm.AC_Cost / evm.BAC) * 100)}%` }} 
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Committee members list */}
            {evm.committeeList.length > 0 && (
              <div className={`border-t ${isDark ? 'border-white/5' : 'border-slate-100'} mt-4 pt-3`}>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${muted} block mb-1`}>คณะกรรมการตรวจรับงาน</span>
                <p className={`text-xs font-semibold ${heading} leading-relaxed truncate`}>
                  {evm.committeeList.slice(0, 3).join(' · ')}
                  {evm.committeeList.length > 3 && ` +${evm.committeeList.length - 3} คน`}
                </p>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* ── Overrun Warning & Overall Health Status footer ── */}
      <div className={`mt-4 flex items-center justify-center py-2.5 rounded-2xl text-xs font-extrabold tracking-wide ${
        evm.SPI >= 1.0 && evm.CPI >= 1.0
          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.05)]'
          : evm.SPI < 0.85 || evm.CPI < 0.85
          ? 'bg-red-500/10 text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.05)]'
          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.05)]'
      }`}>
        <TrendingUp size={14} className="mr-2" />
        {evm.SPI >= 1.0 && evm.CPI >= 1.0
          ? '● สุขภาพโครงการสมบูรณ์ (Healthy Project) - ความก้าวหน้าและดัชนีเป็นไปตามเกณฑ์ควบคุม'
          : evm.SPI < 0.85 || evm.CPI < 0.85
          ? '⚠ วิกฤต (Critical Alert) - งานเกิดความล่าช้าสะสมหรือต้นทุนเกินเกณฑ์ควบคุม ต้องวางแผนแก้ไขเร่งด่วน'
          : '⚠ เฝ้าระวัง (Warning) - ดัชนีแผนงานหรือต้นทุนเริ่มมีความเบี่ยงเบน ควรติดตามงานอย่างใกล้ชิด'}
      </div>
    </div>
  )
}
