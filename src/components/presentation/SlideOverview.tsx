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
      // Cost-weighted average (same as Dashboard)
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
      // Fallback: simple average (matches Dashboard fallback logic)
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

    // AC from milestones (same as Dashboard)
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

    // SPI and CPI (same as Dashboard)
    const SPI = pvCumulative > 0 ? evCumulative / pvCumulative : 1.0
    const CPI = acPercent > 0 ? evCumulative / acPercent : 1.0

    // LD Penalty
    let penaltyDays = 0
    let totalPenalty = 0
    if (isOverrun && (project.progress || 0) < 100) {
      penaltyDays = Math.abs(daysRemaining)
      totalPenalty = penaltyDays * (project.penalty_rate || 0)
    }

    // WBS task counts (same logic as Dashboard)
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

    // Parse committee
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
      pvCumulative, evCumulative, acPercent, AC_Cost,
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

  const card = isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200 shadow-sm'
  const muted = isDark ? 'text-white/50' : 'text-slate-500'
  const heading = isDark ? 'text-white' : 'text-slate-800'

  return (
    <div className="w-full h-full flex flex-col px-10 py-6" style={{ fontFamily: 'Inter, Noto Sans Thai, sans-serif' }}>

      {/* ── Header ── */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1 min-w-0 pr-6">
          <h1 className={`text-4xl font-black leading-tight mb-1.5 ${isDark ? 'text-[#c56bc1]' : 'text-purple-700'}`}>
            {project.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className={`px-3 py-1 rounded-full font-bold text-xs ${
              project.status === 'กำลังดำเนินการ' ? 'bg-amber-500/15 text-amber-600' :
              project.status === 'ระงับ' ? 'bg-red-500/15 text-red-500' :
              project.status === 'เสร็จสิ้น' ? 'bg-emerald-500/15 text-emerald-600' :
              project.status === 'รอดำเนินการ' ? 'bg-blue-500/15 text-blue-600' :
              project.status === 'จัดซื้อจัดจ้าง' ? 'bg-indigo-500/15 text-indigo-600' :
              'bg-purple-500/15 text-purple-600'
            }`}>
              {project.status}
            </span>
            {project.location && <span className={`text-xs ${muted}`}>📍 {project.location}</span>}
            {project.contractor && (
              <span className={`text-xs font-semibold ${isDark ? 'text-white/70' : 'text-slate-600'}`}>
                🏗 {project.contractor}
              </span>
            )}
            {project.contract_no && (
              <span className={`text-xs font-mono ${muted}`}>สัญญา: {project.contract_no}</span>
            )}
          </div>
        </div>

        {/* Dates & Days */}
        <div className="text-right flex-shrink-0">
          <p className={`text-xs ${muted} mb-0.5`}>
            {fmtDate(project.start_date)} — {evm.isOverrun
              ? <span className="text-red-500 font-bold">เลยกำหนด {evm.daysRemaining} วัน</span>
              : fmtDate(project.end_date)}
          </p>
          <p className={`text-2xl font-black ${evm.isOverrun ? 'text-red-500' : isDark ? 'text-blue-400' : 'text-blue-600'}`}>
            {evm.isOverrun ? `⚠ เกินสัญญา ${evm.daysRemaining} วัน` : `เหลือ ${evm.daysRemaining} วัน`}
          </p>
          {evm.totalPenalty > 0 && (
            <p className="text-xs font-bold text-red-500 mt-0.5">ค่าปรับสะสม {fmt(evm.totalPenalty)}</p>
          )}
        </div>
      </div>

      {/* Suspension Banner */}
      {evm.isCurrentlySuspended && evm.currentSuspension && (
        <div className="flex items-center gap-2 px-3 py-1.5 mb-2 bg-amber-50 border border-amber-300 rounded-lg text-amber-700 text-xs font-bold">
          <AlertTriangle size={14} />
          ⏸ หยุดงาน: {evm.currentSuspension.reason || '—'}
          {evm.currentSuspension.suspend_date && ` (ตั้งแต่ ${fmtDate(evm.currentSuspension.suspend_date)})`}
          {evm.totalSuspendedDays > 0 && ` — หยุดสะสม ${evm.totalSuspendedDays} วัน`}
        </div>
      )}

      {/* ── Main Content ── */}
      <div className="flex-1 flex gap-5 min-h-0">

        {/* Left: EVM Grid (6 metrics) */}
        <div className="w-3/5 flex flex-col gap-3">

          {/* Row 1: EV, PV, AC */}
          <div className="grid grid-cols-3 gap-3 flex-1">
            <div className={`${card} border rounded-2xl p-4 flex flex-col justify-center`}>
              <p className={`text-xs font-bold mb-1 ${muted}`}>ความก้าวหน้าจริง (EV)</p>
              <p className="text-5xl font-black text-emerald-500">{evm.evCumulative.toFixed(1)}<span className="text-2xl">%</span></p>
            </div>
            <div className={`${card} border rounded-2xl p-4 flex flex-col justify-center`}>
              <p className={`text-xs font-bold mb-1 ${muted}`}>แผนงานสะสม (PV)</p>
              <p className="text-5xl font-black text-blue-500">{evm.pvCumulative.toFixed(1)}<span className="text-2xl">%</span></p>
            </div>
            <div className={`${card} border rounded-2xl p-4 flex flex-col justify-center`}>
              <p className={`text-xs font-bold mb-1 ${muted}`}>เบิกจ่ายสะสม (AC)</p>
              <p className="text-5xl font-black text-amber-500">{evm.acPercent.toFixed(1)}<span className="text-2xl">%</span></p>
              <p className={`text-xs mt-1 ${muted}`}>{fmt(evm.AC_Cost)}</p>
            </div>
          </div>

          {/* Row 2: SV, CV, SPI+CPI */}
          <div className="grid grid-cols-3 gap-3 flex-1">
            {/* SV */}
            <div className={`${card} border rounded-2xl p-4 flex flex-col justify-center`}>
              <div className="flex items-center gap-1.5 mb-1">
                <Calendar size={13} className={muted} />
                <p className={`text-xs font-bold ${muted}`}>Schedule Variance (SV)</p>
              </div>
              <p className={`text-4xl font-black mb-1 ${evm.svPercent > 0 ? 'text-emerald-500' : evm.svPercent < 0 ? 'text-red-500' : heading}`}>
                {evm.svPercent > 0 ? '+' : ''}{evm.svPercent.toFixed(1)}%
              </p>
              <p className={`text-xs font-bold ${evm.svPercent < 0 ? 'text-red-500' : evm.svPercent > 0 ? 'text-emerald-500' : muted}`}>
                {evm.svPercent < 0 ? `⚠️ ล่าช้า ${Math.abs(evm.svDays)} วัน` :
                 evm.svPercent > 0 ? `✅ เร็ว ${evm.svDays} วัน` : '🎯 ตรงแผน'}
              </p>
            </div>

            {/* CV */}
            <div className={`${card} border rounded-2xl p-4 flex flex-col justify-center`}>
              <div className="flex items-center gap-1.5 mb-1">
                <DollarSign size={13} className={muted} />
                <p className={`text-xs font-bold ${muted}`}>Cost Variance (CV)</p>
              </div>
              <p className={`text-4xl font-black mb-1 ${evm.cvPercent > 0 ? 'text-emerald-500' : evm.cvPercent < 0 ? 'text-red-500' : heading}`}>
                {evm.cvPercent > 0 ? '+' : ''}{evm.cvPercent.toFixed(1)}%
              </p>
              <p className={`text-xs font-bold ${evm.cvPercent < 0 ? 'text-red-500' : evm.cvPercent > 0 ? 'text-emerald-500' : muted}`}>
                {evm.cvPercent < 0 ? `🔴 เกินงบ ${fmt(Math.abs(evm.cvCost))}` :
                 evm.cvPercent > 0 ? `✅ ประหยัด ${fmt(evm.cvCost)}` : '🎯 ตรงงบ'}
              </p>
            </div>

            {/* SPI + CPI */}
            <div className={`${card} border rounded-2xl p-4 flex flex-col justify-center gap-2`}>
              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <span className={`text-xs font-bold ${muted}`}>SPI (ดัชนีแผนงาน)</span>
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                    evm.SPI >= 1.0 ? 'bg-emerald-500/15 text-emerald-600' :
                    evm.SPI >= 0.9 ? 'bg-amber-500/15 text-amber-600' :
                    'bg-red-500/15 text-red-500'
                  }`}>
                    {evm.SPI >= 1.0 ? 'เร็วกว่าแผน' : evm.SPI >= 0.9 ? 'ล่าช้าเล็กน้อย' : 'วิกฤต'}
                  </span>
                </div>
                <p className={`text-3xl font-black font-mono ${
                  evm.SPI >= 1.0 ? 'text-emerald-500' : evm.SPI >= 0.9 ? 'text-amber-500' : 'text-red-500'
                }`}>{evm.SPI.toFixed(2)}</p>
              </div>
              <div className={`border-t ${isDark ? 'border-white/10' : 'border-slate-100'} pt-2`}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className={`text-xs font-bold ${muted}`}>CPI (ดัชนีต้นทุน)</span>
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                    evm.CPI >= 1.0 ? 'bg-emerald-500/15 text-emerald-600' :
                    evm.CPI >= 0.9 ? 'bg-amber-500/15 text-amber-600' :
                    'bg-red-500/15 text-red-500'
                  }`}>
                    {evm.CPI >= 1.0 ? 'ประหยัดงบ' : evm.CPI >= 0.9 ? 'เกินเล็กน้อย' : 'วิกฤต'}
                  </span>
                </div>
                <p className={`text-3xl font-black font-mono ${
                  evm.CPI >= 1.0 ? 'text-emerald-500' : evm.CPI >= 0.9 ? 'text-amber-500' : 'text-red-500'
                }`}>{evm.CPI.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: WBS Status + Budget + Contract */}
        <div className="w-2/5 flex flex-col gap-3">

          {/* WBS Status */}
          <div className={`${card} border rounded-2xl p-4 flex-1`}>
            <h3 className={`text-xs font-black uppercase tracking-wider mb-3 ${muted}`}>สถานะงาน (WBS)</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2.5 bg-emerald-500/10 rounded-xl">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="text-emerald-500" size={18} />
                  <span className={`text-sm font-bold ${heading}`}>เสร็จสิ้น</span>
                </div>
                <span className="text-2xl font-black text-emerald-500">{evm.done}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-red-500/10 rounded-xl">
                <div className="flex items-center gap-2">
                  <AlertCircle className="text-red-500" size={18} />
                  <span className={`text-sm font-bold ${heading}`}>ล่าช้า</span>
                </div>
                <span className="text-2xl font-black text-red-500">{evm.delayed}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-blue-500/10 rounded-xl">
                <div className="flex items-center gap-2">
                  <PlayCircle className="text-blue-500" size={18} />
                  <span className={`text-sm font-bold ${heading}`}>กำลังดำเนินการ</span>
                </div>
                <span className="text-2xl font-black text-blue-500">{evm.inProgress}</span>
              </div>
              {evm.future > 0 && (
                <div className="flex items-center justify-between p-2.5 bg-slate-500/10 rounded-xl">
                  <div className="flex items-center gap-2">
                    <Clock className={`${muted}`} size={18} />
                    <span className={`text-sm font-bold ${heading}`}>ยังไม่เริ่ม</span>
                  </div>
                  <span className={`text-2xl font-black ${muted}`}>{evm.future}</span>
                </div>
              )}
            </div>
          </div>

          {/* Budget + LD */}
          <div className={`${card} border rounded-2xl p-4`}>
            <h3 className={`text-xs font-black uppercase tracking-wider mb-2 ${muted}`}>งบประมาณโครงการ</h3>
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className={muted}>มูลค่าสัญญา</span>
                <span className={`font-bold ${heading}`}>{fmt(project.budget || 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-emerald-500">เบิกจ่ายแล้ว</span>
                <span className="font-bold text-emerald-500">{fmt(evm.AC_Cost)}</span>
              </div>
              {evm.totalPenalty > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-red-500">ค่าปรับ LD ({evm.penaltyDays} วัน)</span>
                  <span className="font-bold text-red-500">{fmt(evm.totalPenalty)}</span>
                </div>
              )}
              <div className={`w-full ${isDark ? 'bg-white/10' : 'bg-slate-200'} h-2 rounded-full overflow-hidden mt-1`}>
                <div className="bg-[#a13c9d] h-full rounded-full"
                  style={{ width: `${Math.min(100, (evm.AC_Cost / (project.budget || 1)) * 100)}%` }} />
              </div>
            </div>

            {/* Contract info */}
            {(project.contractor || project.contract_no || evm.committeeList.length > 0) && (
              <div className={`border-t ${isDark ? 'border-white/10' : 'border-slate-100'} mt-3 pt-3 space-y-1`}>
                {project.contract_no && (
                  <p className={`text-xs ${muted}`}>สัญญา: <span className={`font-bold font-mono ${heading}`}>{project.contract_no}</span></p>
                )}
                {project.contractor && (
                  <p className={`text-xs ${muted}`}>ผู้รับจ้าง: <span className={`font-bold ${heading}`}>{project.contractor}</span></p>
                )}
                {evm.committeeList.length > 0 && (
                  <div>
                    <p className={`text-xs ${muted} mb-0.5`}>คณะกรรมการตรวจรับ:</p>
                    <p className={`text-xs font-semibold ${heading} leading-relaxed`}>
                      {evm.committeeList.slice(0, 3).join(' · ')}
                      {evm.committeeList.length > 3 && ` +${evm.committeeList.length - 3} คน`}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ── Overall Health Footer ── */}
      <div className={`mt-3 flex items-center justify-center py-2 rounded-xl text-xs font-black tracking-wide ${
        evm.SPI >= 1.0 && evm.CPI >= 1.0
          ? 'bg-emerald-500/10 text-emerald-600'
          : evm.SPI < 0.9 || evm.CPI < 0.9
          ? 'bg-red-500/10 text-red-500'
          : 'bg-amber-500/10 text-amber-600'
      }`}>
        <TrendingUp size={12} className="mr-1.5" />
        {evm.SPI >= 1.0 && evm.CPI >= 1.0
          ? '● สุขภาพโครงการดี (Healthy Project)'
          : evm.SPI < 0.9 || evm.CPI < 0.9
          ? '⚠ วิกฤต — ต้องดำเนินการแก้ไขทันที (Critical Alert)'
          : '⚠ เฝ้าระวัง — ควรติดตามอย่างใกล้ชิด (Warning)'}
      </div>
    </div>
  )
}
