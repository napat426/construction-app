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
function SlideGauge({ value, min = -50, max = 50, label, suffix = "%" }: { value: number; min?: number; max?: number; label: string; suffix?: string }) {
  const percent = ((value - min) / (max - min)) * 100
  const boundedPercent = Math.min(100, Math.max(0, percent))
  const isPositive = value >= 0

  return (
    <div className="w-full">
      <div className="flex justify-between items-end mb-1">
        <span className="text-[10px] font-bold opacity-60 uppercase tracking-wider">{label}</span>
        <span className={`text-xs font-black font-mono ${isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
          {isPositive ? '+' : ''}{value.toFixed(1)}{suffix}
        </span>
      </div>
      <div className="relative w-full h-2 bg-slate-100 dark:bg-white/10 rounded-full">
        {/* Center tick */}
        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-slate-300 dark:bg-white/20 z-10" />
        
        {/* Slider bar */}
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
        
        {/* Slider indicator dot */}
        <div 
          className={`absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border border-white dark:border-[#14142a] shadow transition-all z-20 ${isPositive ? 'bg-emerald-500' : 'bg-red-500'}`}
          style={{ left: `calc(${boundedPercent}% - 7px)` }}
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

    const totalMilestones = milestones.length
    const paidMilestones = milestones.filter(m => m.is_paid).length
    const remainingMilestones = totalMilestones - paidMilestones

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
    }
  }, [project, tasks, milestones, amendments])

  const fmt = (val: number) =>
    new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val)

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'

  // Premium glassmorphic styling
  const card = isDark 
    ? 'bg-[#14142a]/85 backdrop-blur-md border border-white/5 shadow-xl shadow-black/20' 
    : 'bg-white border border-slate-200 shadow-md shadow-slate-100/50'
  const muted = isDark ? 'text-white/45' : 'text-slate-500'
  const heading = isDark ? 'text-white' : 'text-slate-800'

  return (
    <div className="w-full h-full flex flex-col px-10 py-6 select-none" style={{ fontFamily: 'Inter, Noto Sans Thai, sans-serif' }}>

      {/* ── Premium Header ── */}
      <div className="flex justify-between items-start mb-4 gap-6">
        <div className="flex-1 min-w-0">
          <h1 className={`text-3xl font-extrabold leading-tight mb-1.5 tracking-tight ${isDark ? 'text-[#e87ae4] drop-shadow-[0_0_12px_rgba(232,122,228,0.25)]' : 'text-purple-700'}`}>
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
          <p className={`text-xs font-bold ${muted} mb-0.5 flex items-center gap-1.5`}>
            <Calendar size={12} />
            {fmtDate(project.start_date)} — {evm.isOverrun
              ? <span className="text-red-500 font-bold">เกินสัญญา {evm.daysRemaining} วัน</span>
              : fmtDate(project.end_date)}
          </p>
          <p className={`text-xl font-black ${evm.isOverrun ? 'text-red-500' : isDark ? 'text-blue-400' : 'text-blue-600'}`}>
            {evm.isOverrun ? `⚠ เกินกำหนด ${evm.daysRemaining} วัน` : `เหลือ ${evm.daysRemaining} วัน`}
          </p>
          {evm.totalPenalty > 0 && (
            <p className="text-[10px] font-bold text-red-500 mt-0.5 bg-red-500/10 px-2 py-0.5 rounded">ค่าปรับสะสม {fmt(evm.totalPenalty)}</p>
          )}
        </div>
      </div>

      {/* Suspension Banner */}
      {evm.isCurrentlySuspended && evm.currentSuspension && (
        <div className="flex items-center gap-2 px-3.5 py-1.5 mb-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-600 dark:text-amber-400 text-xs font-bold">
          <AlertTriangle size={14} />
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
            <h3 className={`text-xs font-black uppercase tracking-wider ${muted} mb-2`}>ความก้าวหน้าสะสม</h3>
            <div className="flex-1 flex flex-col justify-around py-1 gap-2">
              {/* PV */}
              <div>
                <div className="flex justify-between items-end mb-1 text-xs font-bold">
                  <span className="flex items-center gap-2 text-blue-500">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 flex-shrink-0" />
                    แผนงานสะสม (PV)
                  </span>
                  <span className={`${heading} font-mono`}>{evm.pvCumulative.toFixed(1)}%</span>
                </div>
                <div className={`w-full ${isDark ? 'bg-white/10' : 'bg-slate-100'} h-2.5 rounded-full overflow-hidden`}>
                  <div className="bg-blue-500 h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${evm.pvCumulative}%` }} />
                </div>
              </div>

              {/* EV */}
              <div>
                <div className="flex justify-between items-end mb-1 text-xs font-bold">
                  <span className="flex items-center gap-2 text-emerald-500">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0" />
                    ผลงานจริงสะสม (EV)
                  </span>
                  <span className={`${heading} font-mono`}>{evm.evCumulative.toFixed(1)}%</span>
                </div>
                <div className={`w-full ${isDark ? 'bg-white/10' : 'bg-slate-100'} h-2.5 rounded-full overflow-hidden`}>
                  <div className="bg-emerald-500 h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${evm.evCumulative}%` }} />
                </div>
              </div>

              {/* AC */}
              <div>
                <div className="flex justify-between items-end mb-1 text-xs font-bold">
                  <span className="flex items-center gap-2 text-amber-500">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 flex-shrink-0" />
                    เบิกจ่ายสะสม (AC)
                  </span>
                  <div className="text-right">
                    <span className={`${heading} font-mono`}>{evm.acPercent.toFixed(1)}%</span>
                    <span className={`${muted} text-[9px] font-mono block leading-tight`}>({fmt(evm.AC_Cost)})</span>
                  </div>
                </div>
                <div className={`w-full ${isDark ? 'bg-white/10' : 'bg-slate-100'} h-2.5 rounded-full overflow-hidden`}>
                  <div className="bg-amber-500 h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${evm.acPercent}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Box 2: การวิเคราะห์และดัชนีประสิทธิภาพ (Gauges & SPI/CPI) */}
          <div className={`${card} rounded-3xl p-5 flex flex-col justify-between flex-1`}>
            <h3 className={`text-xs font-black uppercase tracking-wider ${muted} mb-2`}>การวิเคราะห์และดัชนีประสิทธิภาพ</h3>
            
            <div className="flex-1 flex flex-col justify-around py-1 gap-4">
              {/* SV & SPI Row */}
              <div className="flex flex-col gap-1.5">
                <SlideGauge value={evm.svPercent} min={-40} max={40} label="เบี่ยงเบนแผนงาน (SV)" />
                <div className="flex justify-between items-center text-[10px] font-bold mt-0.5">
                  <span className={`${evm.svPercent < 0 ? 'text-red-500' : evm.svPercent > 0 ? 'text-emerald-500' : muted}`}>
                    {evm.svPercent < 0 ? `⚠️ ล่าช้ากว่าแผน ${Math.abs(evm.svDays)} วัน` :
                     evm.svPercent > 0 ? `✅ เร็วกว่าแผน ${evm.svDays} วัน` : '🎯 ดำเนินงานตรงแผน'}
                  </span>
                  <span className={`px-2 py-0.5 rounded font-black tracking-wide ${
                    evm.SPI >= 1.0 ? 'bg-emerald-500/10 text-emerald-500' :
                    evm.SPI >= 0.85 ? 'bg-amber-500/10 text-amber-500' :
                    'bg-red-500/10 text-red-500'
                  }`}>
                    SPI: {evm.SPI.toFixed(2)} ({evm.SPI >= 1.0 ? 'เร็วกว่าแผน' : evm.SPI >= 0.85 ? 'ล่าช้าเล็กน้อย' : 'วิกฤต'})
                  </span>
                </div>
              </div>

              <div className={`border-t ${isDark ? 'border-white/5' : 'border-slate-100'} w-full`} />

              {/* CV & CPI Row */}
              <div className="flex flex-col gap-1.5">
                <SlideGauge value={evm.cvPercent} min={-30} max={30} label="เบี่ยงเบนต้นทุน (CV)" />
                <div className="flex justify-between items-center text-[10px] font-bold mt-0.5">
                  <span className={`${evm.cvPercent < 0 ? 'text-red-500' : evm.cvPercent > 0 ? 'text-emerald-500' : muted}`}>
                    {evm.cvPercent < 0 ? `🔴 เกินงบสะสม ${fmt(Math.abs(evm.cvCost))}` :
                     evm.cvPercent > 0 ? `✅ ประหยัดงบสะสม ${fmt(evm.cvCost)}` : '🎯 จ่ายตรงตามงบ'}
                  </span>
                  <span className={`px-2 py-0.5 rounded font-black tracking-wide ${
                    evm.CPI >= 1.0 ? 'bg-emerald-500/10 text-emerald-500' :
                    evm.CPI >= 0.85 ? 'bg-amber-500/10 text-amber-500' :
                    'bg-red-500/10 text-red-500'
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
          
          {/* Box 3: สถานะหัวข้องาน (WBS segmented) */}
          <div className={`${card} rounded-3xl p-5 flex flex-col justify-between flex-1`}>
            <div>
              <h3 className={`text-xs font-black uppercase tracking-wider ${muted} mb-2`}>สถานะหัวข้องาน (WBS)</h3>
              <WBSSegmentBar done={evm.done} delayed={evm.delayed} inProgress={evm.inProgress} future={evm.future} />
            </div>

            <div className="grid grid-cols-2 gap-2 mt-4">
              <div className="flex items-center justify-between p-2 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-2xl border border-emerald-500/10">
                <span className={`text-[11px] font-bold ${muted} flex items-center gap-1.5`}><CheckCircle2 className="text-emerald-500" size={13} />เสร็จสิ้น</span>
                <span className="text-base font-black text-emerald-500 font-mono">{evm.done}</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-red-500/5 dark:bg-red-500/10 rounded-2xl border border-red-500/10">
                <span className={`text-[11px] font-bold ${muted} flex items-center gap-1.5`}><AlertCircle className="text-red-500" size={13} />ล่าช้า</span>
                <span className="text-base font-black text-red-500 font-mono">{evm.delayed}</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-blue-500/5 dark:bg-blue-500/10 rounded-2xl border border-blue-500/10">
                <span className={`text-[11px] font-bold ${muted} flex items-center gap-1.5`}><PlayCircle className="text-blue-500" size={13} />กำลังทำ</span>
                <span className="text-base font-black text-blue-500 font-mono">{evm.inProgress}</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-slate-500/5 dark:bg-slate-500/10 rounded-2xl border border-slate-500/10">
                <span className={`text-[11px] font-bold ${muted} flex items-center gap-1.5`}><Clock className="text-slate-400" size={13} />ยังไม่เริ่ม</span>
                <span className="text-base font-black text-slate-400 dark:text-slate-500 font-mono">{evm.future}</span>
              </div>
            </div>
          </div>

          {/* Box 4: ข้อมูลสัญญาและงบประมาณ (Financial & Contract Info) */}
          <div className={`${card} rounded-3xl p-5 flex flex-col justify-between flex-1`}>
            <div>
              <h3 className={`text-xs font-black uppercase tracking-wider ${muted} mb-2`}>การเงินและสัญญา</h3>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between font-bold">
                  <span className={muted}>งบประมาณมูลค่าสัญญา</span>
                  <span className={heading}>{fmt(evm.BAC)}</span>
                </div>
                <div className="flex justify-between font-bold text-emerald-500">
                  <span>เบิกจ่ายเงินสะสม (AC)</span>
                  <span>{fmt(evm.AC_Cost)}</span>
                </div>
                
                <div className="pt-2">
                  <div className={`w-full ${isDark ? 'bg-white/10' : 'bg-slate-100'} h-2 rounded-full overflow-hidden`}>
                    <div 
                      className="bg-purple-500 h-full rounded-full transition-all duration-700 ease-out"
                      style={{ width: `${Math.min(100, (evm.AC_Cost / evm.BAC) * 100)}%` }} 
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs font-bold pt-2 border-t border-slate-100 dark:border-white/5 mt-1.5">
                  <span className={muted}>การส่งมอบงวดงาน</span>
                  <span className={heading}>
                    ส่งแล้ว <span className="text-emerald-500 font-mono font-black">{evm.paidMilestones}</span> / เหลือ <span className="text-amber-500 font-mono font-black">{evm.remainingMilestones}</span> / ทั้งหมด <span className="font-mono font-black">{evm.totalMilestones}</span> งวด
                  </span>
                </div>
              </div>
            </div>

            {/* Committee members & details */}
            {(project.contractor || project.contract_no || evm.committeeList.length > 0) && (
              <div className={`border-t ${isDark ? 'border-white/5' : 'border-slate-100'} mt-3 pt-2.5 space-y-1 text-[11px]`}>
                {project.contract_no && (
                  <p className={muted}>สัญญา: <span className={`font-bold font-mono ${heading}`}>{project.contract_no}</span></p>
                )}
                {project.contractor && (
                  <p className={muted}>ผู้รับจ้าง: <span className={`font-bold ${heading}`}>{project.contractor}</span></p>
                )}
                {evm.committeeList.length > 0 && (
                  <div className="truncate">
                    <span className={`${muted} mr-1`}>กรรมการตรวจรับ:</span>
                    <span className={`font-semibold ${heading}`}>
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
      <div className={`mt-4 flex items-center justify-center py-2 rounded-2xl text-xs font-extrabold tracking-wide ${
        evm.SPI >= 1.0 && evm.CPI >= 1.0
          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
          : evm.SPI < 0.85 || evm.CPI < 0.85
          ? 'bg-red-500/10 text-red-500'
          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
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
