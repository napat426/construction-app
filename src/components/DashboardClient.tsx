'use client'

import { useState, useMemo, useTransition } from 'react'
import {
  Calendar,
  DollarSign,
  TrendingUp,
  AlertOctagon,
  Clock,
  Briefcase,
  User,
  MapPin,
  Settings,
  ArrowLeft,
  AlertTriangle,
  CheckCircle,
  Plus,
  Trash2,
} from 'lucide-react'
import Link from 'next/link'
import { EditBaselineModal } from './EditBaselineModal'
import { computeTaskDates } from '@/lib/scheduler'
import type { Project, WBSTask, ProjectPayment, ProjectMilestone } from '@/lib/types'
import { addPayment, deletePayment } from '@/app/actions/payments'

interface DashboardClientProps {
  project: Project
  tasks: WBSTask[]
  payments: ProjectPayment[]
  milestones: ProjectMilestone[]
}

function formatCurrency(amount: number | null): string {
  if (amount == null) return '—'
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function DashboardClient({ project, tasks, payments, milestones }: DashboardClientProps) {
  const [showEditModal, setShowEditModal] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [paymentDate, setPaymentDate] = useState('')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentDesc, setPaymentDesc] = useState('')
  const today = new Date()

  const metrics = useMemo(() => {
    const start = project.start_date ? new Date(project.start_date) : null
    const end = project.end_date ? new Date(project.end_date) : null

    let totalDays = 0
    let daysUsed = 0
    let daysRemaining = 0
    let isOverrun = false

    if (start && end) {
      const startDateOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate())
      const endDateOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate())
      const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate())

      totalDays = Math.ceil((endDateOnly.getTime() - startDateOnly.getTime()) / (1000 * 60 * 60 * 24))
      totalDays = Math.max(0, totalDays)

      daysUsed = Math.ceil((todayDateOnly.getTime() - startDateOnly.getTime()) / (1000 * 60 * 60 * 24))
      daysUsed = Math.max(0, daysUsed)

      daysRemaining = Math.ceil((endDateOnly.getTime() - todayDateOnly.getTime()) / (1000 * 60 * 60 * 24))
      
      if (daysRemaining < 0) {
        isOverrun = true
      }
    }

    const scheduledTasks = computeTaskDates(tasks, project.start_date)
    const totalWbsCost = scheduledTasks.reduce((sum, t) => sum + (Number(t.cost) || 0), 0)
    
    let pvCumulative = 0
    let evCumulative = 0

    const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate())

    if (totalWbsCost > 0) {
      let totalWeightedPlanned = 0
      let totalWeightedActual = 0

      for (const t of scheduledTasks) {
        const tStart = new Date(t.computedStartDate)
        const tEnd = new Date(t.computedEndDate)
        const tCost = Number(t.cost) || 0
        const weight = tCost / totalWbsCost

        let plannedProgress = 0
        if (todayDateOnly >= tEnd) {
          plannedProgress = 100
        } else if (todayDateOnly < tStart) {
          plannedProgress = 0
        } else {
          const totalTaskTime = Math.max(1, tEnd.getTime() - tStart.getTime())
          const elapsedTaskTime = todayDateOnly.getTime() - tStart.getTime()
          plannedProgress = (elapsedTaskTime / totalTaskTime) * 100
        }

        totalWeightedPlanned += weight * plannedProgress
        totalWeightedActual += weight * (t.actual_progress || 0)
      }

      pvCumulative = totalWeightedPlanned
      evCumulative = totalWeightedActual
    } else {
      let totalPlanned = 0
      let totalActual = 0
      for (const t of scheduledTasks) {
        const tStart = new Date(t.computedStartDate)
        const tEnd = new Date(t.computedEndDate)
        
        let plannedProgress = 0
        if (todayDateOnly >= tEnd) {
          plannedProgress = 100
        } else if (todayDateOnly < tStart) {
          plannedProgress = 0
        } else {
          const totalTaskTime = Math.max(1, tEnd.getTime() - tStart.getTime())
          const elapsedTaskTime = todayDateOnly.getTime() - tStart.getTime()
          plannedProgress = (elapsedTaskTime / totalTaskTime) * 100
        }
        totalPlanned += plannedProgress
        totalActual += t.actual_progress || 0
      }
      if (scheduledTasks.length > 0) {
        pvCumulative = totalPlanned / scheduledTasks.length
        evCumulative = totalActual / scheduledTasks.length
      }
    }

    const paidAmountSum = milestones
      .filter((m) => m.is_paid)
      .reduce((sum, m) => sum + (Number(m.amount) || 0), 0)
    const acPercent = (paidAmountSum / (project.budget || 1)) * 100

    const totalWbsDenominator = totalWbsCost > 0 ? totalWbsCost : (project.budget || 1)
    const pvCurrency = totalWbsDenominator * (pvCumulative / 100)
    const evCurrency = totalWbsDenominator * (evCumulative / 100)
    const acCurrency = paidAmountSum

    const svCurrency = evCurrency - pvCurrency
    const cvCurrency = evCurrency - acCurrency

    const SV = evCumulative - pvCumulative
    const CV = evCumulative - acPercent

    let svDays = 0
    if (totalDays > 0) {
      svDays = Math.round((SV / 100) * totalDays)
    }

    const progressDiff = Math.abs(SV)
    const progressDaysDiff = Math.abs(svDays)
    const progressStatus = SV > 0.005 ? 'ahead' : SV < -0.005 ? 'behind' : 'ontrack'

    const budget = project.budget || 0
    const paid = paidAmountSum
    const paidPercent = budget > 0 ? (paid / budget) * 100 : 0
    const remainingBudget = Math.max(0, budget - paid)
    
    let penaltyDays = 0
    let totalPenalty = 0
    
    if (isOverrun && project.progress < 100) {
      penaltyDays = Math.abs(daysRemaining)
      totalPenalty = penaltyDays * (project.penalty_rate || 0)
    }

    // Calculate WBS task statuses count
    let totalTasksCount = scheduledTasks.length
    let completedTasksCount = 0
    let delayedTasksCount = 0
    let futureTasksCount = 0

    for (const t of scheduledTasks) {
      const tStart = new Date(t.computedStartDate)
      const tEnd = new Date(t.computedEndDate)
      // Normalize to local midnight (same as todayDateOnly) to avoid timezone off-by-one
      tStart.setHours(0, 0, 0, 0)
      tEnd.setHours(0, 0, 0, 0)

      let plannedProgress = 0
      if (todayDateOnly >= tEnd) {
        plannedProgress = 100
      } else if (todayDateOnly < tStart) {
        plannedProgress = 0
      } else {
        const totalTaskTime = Math.max(1, tEnd.getTime() - tStart.getTime())
        const elapsedTaskTime = todayDateOnly.getTime() - tStart.getTime()
        plannedProgress = (elapsedTaskTime / totalTaskTime) * 100
      }

      if (t.actual_progress === 100) {
        completedTasksCount++
      } else if (tStart > todayDateOnly) {
        futureTasksCount++
      } else if (plannedProgress - (t.actual_progress || 0) >= 5) {
        // delayed: plan is 5+ % ahead of actual
        delayedTasksCount++
      }
      // otherwise: in-progress (on track) — not counted in any special bucket
    }

    const taskStats = {
      total: totalTasksCount,
      completed: completedTasksCount,
      delayed: delayedTasksCount,
      future: futureTasksCount,
    }

    return {
      totalDays,
      daysUsed,
      daysRemaining: Math.abs(daysRemaining),
      isOverrun,
      actualProgress: evCumulative,
      plannedProgress: pvCumulative,
      budget,
      paid,
      paidPercent,
      remainingBudget,
      penaltyDays,
      totalPenalty,
      pvCumulative,
      evCumulative,
      acCumulative: acPercent,
      sv: SV,
      cv: CV,
      svDays,
      progressDiff,
      progressDaysDiff,
      progressStatus,
      pvCurrency,
      evCurrency,
      acCurrency,
      svCurrency,
      cvCurrency,
      taskStats,
    }
  }, [project, tasks, payments, milestones, today])

  const labelCls = 'text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider'

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/projects"
            className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
          >
            <ArrowLeft size={16} />
            กลับไปหน้าโครงการทั้งหมด
          </Link>

          <button
            id="open-baseline-btn"
            onClick={() => setShowEditModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold text-white btn-primary flex-shrink-0"
          >
            <Settings size={15} />
            แก้ไข Baseline / ค่าเริ่มต้น
          </button>
        </div>

        <div className="card rounded-2xl p-6 flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider bg-primary-600/10 dark:bg-primary-600/20 text-primary-700 dark:text-primary-400 px-2.5 py-1 rounded-md">
                {project.status}
              </span>
              {project.location && (
                <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 font-medium">
                  <MapPin size={12} /> {project.location}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white leading-tight">
              {project.name}
            </h1>
            {project.description && (
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
                {project.description}
              </p>
            )}
          </div>

          <div className="flex items-center gap-4 bg-slate-50 dark:bg-[#1a1a32] border border-slate-100 dark:border-[#252548] p-4 rounded-xl w-full md:w-auto">
            <div className="w-10 h-10 rounded-lg bg-primary-600/10 dark:bg-primary-600/20 flex items-center justify-center text-primary-600 dark:text-primary-400">
              <User size={20} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                ผู้ควบคุมโครงการ
              </p>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                {project.supervisor}
              </p>
            </div>
          </div>
        </div>

        {/* ══ ROW 1: เวลาสัญญา (3 col) ══ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* วันเริ่มต้น */}
          <div className="card rounded-2xl p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary-600/10 dark:bg-primary-600/20 flex items-center justify-center text-primary-600 dark:text-primary-400 flex-shrink-0">
              <Calendar size={18} />
            </div>
            <div>
              <p className={labelCls}>วันเริ่มสัญญา</p>
              <p className="text-base font-bold text-slate-800 dark:text-slate-200 mt-0.5">{formatDate(project.start_date)}</p>
            </div>
          </div>

          {/* วันสิ้นสุด */}
          <div className="card rounded-2xl p-5 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${metrics.isOverrun ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>
              <Clock size={18} />
            </div>
            <div>
              <p className={labelCls}>วันสิ้นสุดสัญญา</p>
              <p className={`text-base font-bold mt-0.5 ${metrics.isOverrun ? 'text-red-500' : 'text-slate-800 dark:text-slate-200'}`}>{formatDate(project.end_date)}</p>
            </div>
          </div>

          {/* วันคงเหลือ */}
          <div className="card rounded-2xl p-5 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${metrics.isOverrun ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'}`}>
              <Briefcase size={18} />
            </div>
            <div>
              <p className={labelCls}>{metrics.isOverrun ? 'เกินกำหนด' : 'วันคงเหลือ'}</p>
              <p className={`text-base font-bold mt-0.5 ${metrics.isOverrun ? 'text-red-500' : 'text-slate-800 dark:text-slate-200'}`}>
                {metrics.daysRemaining} วัน
                {metrics.isOverrun && <span className="ml-1.5 text-xs font-semibold">(เกินสัญญา)</span>}
              </p>
              <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 dark:bg-[#1e1e38] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${metrics.isOverrun ? 'bg-red-500' : 'bg-primary-500'}`}
                  style={{ width: `${Math.min(100, metrics.totalDays > 0 ? (metrics.daysUsed / metrics.totalDays) * 100 : 0)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ══ ROW 2: ความก้าวหน้า (col-span-2) + EVM (col-span-1) ══ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* ความก้าวหน้างาน — 2 col */}
          <div className="card rounded-2xl p-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingUp size={16} className="text-primary-600 dark:text-primary-400" />
                ความก้าวหน้าโครงการ
              </h3>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                metrics.progressStatus === 'ahead' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                metrics.progressStatus === 'behind' ? 'bg-red-500/10 text-red-500' :
                'bg-slate-100 dark:bg-[#1e1e38] text-slate-500'
              }`}>
                {metrics.progressStatus === 'ahead' ? '▲ เร็วกว่าแผน' : metrics.progressStatus === 'behind' ? '▼ ล่าช้า' : '● ตามแผน'}
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">แผนงานสะสม (PV)</span>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{metrics.plannedProgress.toFixed(1)}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-[#1e1e38] overflow-hidden">
                  <div className="h-full rounded-full bg-slate-400 dark:bg-slate-600" style={{ width: `${metrics.plannedProgress}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">ผลงานจริง (EV)</span>
                  <span className="text-sm font-bold text-primary-600 dark:text-primary-400">{metrics.actualProgress.toFixed(1)}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-[#1e1e38] overflow-hidden">
                  <div className="h-full rounded-full progress-fill" style={{ width: `${metrics.actualProgress}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">เบิกจ่ายสะสม (AC)</span>
                  <span className="text-sm font-bold text-amber-500 dark:text-amber-400">{metrics.acCumulative.toFixed(1)}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-[#1e1e38] overflow-hidden">
                  <div className="h-full rounded-full bg-amber-400 dark:bg-amber-500" style={{ width: `${Math.min(100, metrics.acCumulative)}%` }} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className={`p-3 rounded-xl border-l-4 flex items-center justify-between gap-2 ${
                metrics.sv > 0.005 ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-500/5' :
                metrics.sv < -0.005 ? 'border-red-500 bg-red-50/50 dark:bg-red-500/5' :
                'border-slate-300 bg-slate-50/50 dark:bg-[#1a1a32]/50'
              }`}>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">SV (EV−PV)</p>
                  <p className={`text-lg font-black font-mono mt-0.5 ${
                    metrics.sv > 0.005 ? 'text-emerald-600 dark:text-emerald-400' :
                    metrics.sv < -0.005 ? 'text-red-500' :
                    'text-slate-500 dark:text-slate-400'
                  }`}>
                    {metrics.sv > 0.005 ? '+' : ''}{metrics.sv.toFixed(1)}%
                  </p>
                </div>
                <div className="text-right flex flex-col items-end justify-center min-w-0">
                  <p className={`text-[11px] font-bold ${
                    metrics.sv > 0.005 ? 'text-emerald-600 dark:text-emerald-400' :
                    metrics.sv < -0.005 ? 'text-red-500' :
                    'text-slate-500 dark:text-slate-400'
                  }`}>
                    {metrics.sv > 0.005 ? '✅ เร็วกว่าแผน' :
                     metrics.sv < -0.005 ? '⚠️ ล่าช้ากว่าแผน' :
                     '🎯 ตรงตามแผน'}
                  </p>
                  {(metrics.sv > 0.005 || metrics.sv < -0.005) && (
                    <p className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold mt-0.5 whitespace-nowrap">
                      {metrics.sv > 0.005 ? `+${Math.abs(metrics.svDays)} วัน เร็ว` : `−${Math.abs(metrics.svDays)} วัน ล่าช้า`}
                    </p>
                  )}
                </div>
              </div>
              <div className={`p-3 rounded-xl border-l-4 flex items-center justify-between gap-2 ${
                metrics.cv > 0.005 ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-500/5' :
                metrics.cv < -0.005 ? 'border-red-500 bg-red-50/50 dark:bg-red-500/5' :
                'border-slate-300 bg-slate-50/50 dark:bg-[#1a1a32]/50'
              }`}>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">CV (EV−AC)</p>
                  <p className={`text-lg font-black font-mono mt-0.5 ${
                    metrics.cv > 0.005 ? 'text-emerald-600 dark:text-emerald-400' :
                    metrics.cv < -0.005 ? 'text-red-500' :
                    'text-slate-500 dark:text-slate-400'
                  }`}>
                    {metrics.cv > 0.005 ? '+' : ''}{metrics.cv.toFixed(1)}%
                  </p>
                </div>
                <div className="text-right flex flex-col items-end justify-center min-w-0">
                  {metrics.cv > 0.005 ? (
                    <>
                      <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">✅ ต่ำกว่างบประมาณ</span>
                      <span className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold mt-0.5 whitespace-nowrap">ประหยัดได้ {formatCurrency((metrics.cv / 100) * (project.budget || 0))}</span>
                    </>
                  ) : metrics.cv < -0.005 ? (
                    <>
                      <span className="text-[11px] font-bold text-red-500">🔴 เกินงบประมาณ</span>
                      <span className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold mt-0.5 whitespace-nowrap font-mono">เกินงบ {formatCurrency(Math.abs((metrics.cv / 100) * (project.budget || 0)))}</span>
                    </>
                  ) : (
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">🎯 ตรงงบประมาณ</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* EVM Key Numbers — 1 col */}
          <div className="card rounded-2xl p-5 lg:col-span-1 flex flex-col gap-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp size={16} className="text-primary-600 dark:text-primary-400" />
              วิเคราะห์ EVM
            </h3>
            <div className="flex-1 space-y-3">
              {[
                { label: 'PV แผนสะสม', value: `${metrics.pvCumulative.toFixed(1)}%`, color: 'text-slate-500 dark:text-slate-400' },
                { label: 'EV ผลงานจริง', value: `${metrics.evCumulative.toFixed(1)}%`, color: 'text-primary-600 dark:text-primary-400' },
                { label: 'AC ต้นทุนจริง', value: `${metrics.acCumulative.toFixed(1)}%`, color: 'text-amber-500 dark:text-amber-400' },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-center justify-between py-2.5 border-b border-slate-100 dark:border-[#1e1e38] last:border-0">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{label}</span>
                  <span className={`text-base font-black font-mono ${color}`}>{value}</span>
                </div>
              ))}
            </div>
            <div className={`text-center py-2 rounded-xl text-xs font-bold ${
              metrics.progressStatus === 'ahead'
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : metrics.progressStatus === 'behind'
                ? 'bg-red-500/10 text-red-500'
                : 'bg-slate-100 dark:bg-[#1e1e38] text-slate-500'
            }`}>
              {metrics.progressStatus === 'ahead' ? '✓ เร็วกว่าแผน' : metrics.progressStatus === 'behind' ? '⚠ ล่าช้ากว่าแผน' : '● ตรงตามแผน'}
            </div>
          </div>
        </div>

        {/* ══ ROW 3: การเงิน (2 col) + ตัวนับสถานะงาน (1 col) ══ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* งบประมาณ & การเบิกจ่าย — 1 col */}
          <div className="card rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <DollarSign size={16} className="text-primary-600 dark:text-primary-400" />
                งบประมาณ & เบิกจ่าย
              </h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">จ่ายแล้ว</span>
                <span className="text-sm font-bold text-slate-900 dark:text-white font-mono">{metrics.paidPercent.toFixed(1)}%</span>
              </div>
              <div className="w-full rounded-full h-2 bg-slate-100 dark:bg-[#1e1e38] overflow-hidden">
                <div className="h-full rounded-full progress-fill" style={{ width: `${Math.min(100, metrics.paidPercent)}%` }} />
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                <div className="bg-slate-50 dark:bg-[#14142a]/50 p-2.5 rounded-lg border border-slate-100 dark:border-[#1e1e38]">
                  <p className={labelCls}>งบรวม</p>
                  <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5 truncate">{formatCurrency(project.budget)}</p>
                </div>
                <div className="bg-slate-50 dark:bg-[#14142a]/50 p-2.5 rounded-lg border border-slate-100 dark:border-[#1e1e38]">
                  <p className={labelCls}>คงเหลือ</p>
                  <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5 truncate">{formatCurrency(metrics.remainingBudget)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* การส่งมอบงวดงาน — 1 col */}
          <div className="card rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CheckCircle size={16} className="text-primary-600 dark:text-primary-400" />
                การส่งมอบงวดงาน
              </h3>
            </div>
            <div className="flex items-baseline gap-1.5 mb-1">
              <span className="text-4xl font-black text-slate-900 dark:text-white font-mono">{milestones.filter(m => m.is_paid).length}</span>
              <span className="text-sm text-slate-400 dark:text-slate-500 font-medium">/ {milestones.length} งวด</span>
            </div>
            <p className="text-xs text-slate-400 font-medium mb-4">ส่งมอบและตรวจรับแล้ว</p>
            {milestones.length > 0 && (
              <div className="flex gap-1.5">
                {milestones.map((m, idx) => (
                  <div
                    key={idx}
                    title={m.name}
                    className={`h-3 flex-1 rounded-full transition-all ${m.is_paid ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-slate-200 dark:bg-[#1e1e38]'}`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* สรุปสถานะงานย่อย — 1 col */}
          <div className="card rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Briefcase size={16} className="text-primary-600 dark:text-primary-400" />
                สรุปสถานะงานย่อย
              </h3>
              <span className="text-[10px] font-bold bg-slate-100 dark:bg-[#1e1e38] text-slate-500 px-2 py-0.5 rounded">WBS</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-50 dark:bg-[#14142a]/50 p-3 rounded-xl border border-slate-100 dark:border-[#1e1e38] text-center">
                <p className="text-2xl font-black text-slate-900 dark:text-white font-mono">{metrics.taskStats.total}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">งานทั้งหมด</p>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-500/5 p-3 rounded-xl border border-emerald-200 dark:border-emerald-500/20 text-center">
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">{metrics.taskStats.completed}</p>
                <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider mt-0.5">เสร็จแล้ว</p>
              </div>
              <div className="bg-red-50 dark:bg-red-500/5 p-3 rounded-xl border border-red-200 dark:border-red-500/20 text-center">
                <p className="text-2xl font-black text-red-500 font-mono">{metrics.taskStats.delayed}</p>
                <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider mt-0.5">ล่าช้า</p>
              </div>
              <div className="bg-slate-100 dark:bg-[#14142a]/50 p-3 rounded-xl border border-slate-200 dark:border-[#1e1e38] text-center">
                <p className="text-2xl font-black text-slate-500 dark:text-slate-400 font-mono">{metrics.taskStats.future}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">ในอนาคต</p>
              </div>
            </div>
          </div>

        </div>

        {/* ══ ROW 4: ข้อมูลสัญญา & กรรมการ (full width) ══ */}
        <div className="card rounded-2xl p-5">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
            <User size={16} className="text-primary-600 dark:text-primary-400" />
            ข้อมูลสัญญา & คณะกรรมการตรวจรับ
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className={labelCls}>เลขที่สัญญา</p>
              <p className="text-sm font-bold text-slate-900 dark:text-white mt-1 font-mono">{project.contract_no || '—'}</p>
            </div>
            <div>
              <p className={labelCls}>ผู้รับจ้าง / คู่สัญญา</p>
              <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">{project.contractor || '—'}</p>
            </div>
            <div>
              <p className={labelCls}>คณะกรรมการตรวจรับพัสดุ</p>
              {(() => {
                let committeeList: string[] = []
                try {
                  if (project.inspection_committee) {
                    const parsed = JSON.parse(project.inspection_committee)
                    if (Array.isArray(parsed)) committeeList = parsed.filter(Boolean)
                    else committeeList = project.inspection_committee.split(',').map(s => s.trim()).filter(Boolean)
                  }
                } catch { if (project.inspection_committee) committeeList = project.inspection_committee.split('\n').map(s => s.trim()).filter(Boolean) }
                if (committeeList.length === 0) return <p className="text-sm text-slate-400 mt-1">—</p>
                return <ul className="mt-1 space-y-1">{committeeList.map((m, i) => (
                  <li key={i} className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary-500 flex-shrink-0" />
                    {m}
                  </li>
                ))}</ul>
              })()}
            </div>
          </div>
        </div>

      </div>

      {/* ── Edit baseline modal ── */}
      {showEditModal && (
        <EditBaselineModal project={project} milestones={milestones} onClose={() => setShowEditModal(false)} />
      )}
    </>
  )
}
