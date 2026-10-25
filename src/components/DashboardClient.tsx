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
  FileText,
  Share2,
} from 'lucide-react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { EditBaselineModal } from './EditBaselineModal'
import { computeTaskDates, computeProjectExtension, countWorkingDays } from '@/lib/scheduler'

const DocumentManager = dynamic(() => import('./ai/DocumentManager').then(mod => mod.DocumentManager), { ssr: false })
import type { Project, WBSTask, ProjectMilestone, ContractAmendment, Inspection } from '@/lib/types'
import type { UserSession } from '@/lib/auth'
import { LineSummaryBannerModal } from './reports/LineSummaryBannerModal'

interface DashboardClientProps {
  project: Project
  tasks: WBSTask[]
  milestones: ProjectMilestone[]
  amendments?: ContractAmendment[]
  inspections?: Inspection[]
  user?: UserSession | null
  workGroups?: string[]
  supervisorsList?: string[]
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

export function DashboardClient({ project, tasks, milestones, amendments = [], inspections = [], user, workGroups = [], supervisorsList = [] }: DashboardClientProps) {
  const [showEditModal, setShowEditModal] = useState(false)
  const [isLineBannerOpen, setIsLineBannerOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [paymentDate, setPaymentDate] = useState('')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentDesc, setPaymentDesc] = useState('')
  const today = new Date()

  const metrics = useMemo(() => {
    const ext = computeProjectExtension(project, amendments)
    const totalDays = ext.totalDays
    const daysUsed = ext.daysUsed
    const daysRemaining = ext.daysRemaining
    const isOverrun = ext.isOverrun

    const scheduledTasks = computeTaskDates(tasks, project.start_date, amendments)
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
        tStart.setHours(0, 0, 0, 0)
        tEnd.setHours(0, 0, 0, 0)
        const tCost = Number(t.cost) || 0
        const weight = tCost / totalWbsCost

        let plannedProgress = 0
        if (todayDateOnly >= tEnd) {
          plannedProgress = 100
        } else if (todayDateOnly < tStart) {
          plannedProgress = 0
        } else {
          const totalTaskTime = Math.max(1, countWorkingDays(tStart, tEnd, amendments))
          const elapsedTaskTime = countWorkingDays(tStart, todayDateOnly, amendments)
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
        tStart.setHours(0, 0, 0, 0)
        tEnd.setHours(0, 0, 0, 0)
        
        let plannedProgress = 0
        if (todayDateOnly >= tEnd) {
          plannedProgress = 100
        } else if (todayDateOnly < tStart) {
          plannedProgress = 0
        } else {
          const totalTaskTime = Math.max(1, countWorkingDays(tStart, tEnd, amendments))
          const elapsedTaskTime = countWorkingDays(tStart, todayDateOnly, amendments)
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
    const acPercent = (paidAmountSum / (project.opening_pr || 1)) * 100

    const totalWbsDenominator = project.opening_pr || 1
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

    const budget = project.opening_pr || 0
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
        const totalTaskTime = Math.max(1, countWorkingDays(tStart, tEnd, amendments))
        const elapsedTaskTime = countWorkingDays(tStart, todayDateOnly, amendments)
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

    const SPI = pvCumulative > 0 ? evCumulative / pvCumulative : 1.0
    const CPI = acPercent > 0 ? evCumulative / acPercent : 1.0

    return {
      ext,
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
      SPI,
      CPI,
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
  }, [project, tasks, milestones, amendments, today])

  // Categorize tasks for Work Status Summary section
  const categorizedTasks = useMemo(() => {
    const civilKeywords = ['โครงสร้าง', 'คสล', 'ฐานราก', 'เสา', 'คาน', 'พื้น', 'อาคาร', 'หลังคา', 'ผนัง', 'ประตู', 'หน้าต่าง', 'ทาสี', 'ถนน', 'ลาน', 'รั้ว', 'ท่อ', 'ระบายน้ำ', 'ดิน', 'เตรียมพื้นที่']
    const elecKeywords = ['ไฟฟ้า', 'เคเบิล', 'สายไฟ', 'หม้อแปลง', 'rmu', 'ground', 'ล่อฟ้า', 'ตู้', 'mdb', 'ส่องสว่าง', 'โคมไฟ', 'วงจร', 'สื่อสาร', 'cctv', 'สุขาภิบาล', 'ประปา']

    const civil: WBSTask[] = []
    const elec: WBSTask[] = []
    const general: WBSTask[] = []

    tasks.forEach(t => {
      const name = (t.name || '').toLowerCase()
      if (elecKeywords.some(k => name.includes(k))) {
        elec.push(t)
      } else if (civilKeywords.some(k => name.includes(k))) {
        civil.push(t)
      } else {
        general.push(t)
      }
    })

    const groups: { icon: string; title: string; tasks: WBSTask[]; avgProgress: number }[] = []

    if (civil.length > 0) {
      const avg = civil.reduce((s, t) => s + (t.actual_progress || 0), 0) / civil.length
      groups.push({
        icon: '🛠️',
        title: 'งานโยธาและโครงสร้าง',
        tasks: civil,
        avgProgress: avg,
      })
    }

    if (elec.length > 0) {
      const avg = elec.reduce((s, t) => s + (t.actual_progress || 0), 0) / elec.length
      groups.push({
        icon: '⚡',
        title: 'งานระบบไฟฟ้าและสุขาภิบาล',
        tasks: elec,
        avgProgress: avg,
      })
    }

    if (general.length > 0 || groups.length === 0) {
      const tasksToShow = general.length > 0 ? general : tasks
      const avg = tasksToShow.reduce((s, t) => s + (t.actual_progress || 0), 0) / Math.max(1, tasksToShow.length)
      groups.push({
        icon: '🏢',
        title: groups.length > 0 ? 'งานสถาปัตยกรรมและทั่วไป' : 'ภาพรวมงานก่อสร้าง',
        tasks: tasksToShow,
        avgProgress: avg,
      })
    }

    return groups
  }, [tasks])

  const labelCls = 'text-[11px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-widest font-mono'

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-end gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => setIsLineBannerOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-teal-700 to-emerald-700 hover:from-teal-800 hover:to-emerald-800 shadow-xs transition-all cursor-pointer flex-shrink-0"
            title="เปิดหน้าต่างสร้างภาพสรุปสถานะโครงการ 16:9 สำหรับแชร์ลงกลุ่ม LINE"
          >
            <Share2 size={15} />
            <span>📱 สรุปภาพ 16:9 ส่ง LINE</span>
          </button>

          {user && (user.role === 'admin' || user.role === 'editor') && (
            <button
              id="open-baseline-btn"
              onClick={() => setShowEditModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white btn-primary flex-shrink-0 cursor-pointer shadow-xs"
            >
              <Settings size={15} />
              แก้ไข Baseline / ค่าเริ่มต้น
            </button>
          )}
        </div>

        {/* ── Estudio Bang Inspired Architectural Hero & Spec Layout ── */}
        <div className="card gallery-podium rounded-2xl p-6 sm:p-10 space-y-8 bg-[#FAF8F5]/90 dark:bg-[#121218]/90 border border-stone-200/90 dark:border-stone-800">
          {/* Top Row: Giant Architectural Title + Clean Header Action Links */}
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-stone-200/80 dark:border-stone-800/80 pb-6">
            <div className="space-y-2 max-w-3xl">
              <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.22em] text-stone-400 dark:text-stone-500">
                <span>ESTUDIO BANG // ATELIER SPEC</span>
                <span>•</span>
                <span>{project.status}</span>
              </div>
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-stone-950 dark:text-stone-50 leading-tight tracking-tight font-sans">
                {project.name}
              </h1>
            </div>

            {/* Quick Action Links (Estudio Bang style) */}
            <div className="flex items-center gap-4 text-xs font-bold tracking-wider uppercase font-mono flex-shrink-0 select-none">
              <button
                type="button"
                onClick={() => setIsLineBannerOpen(true)}
                className="hover:opacity-60 transition-opacity cursor-pointer text-stone-800 dark:text-stone-200"
              >
                SHARE
              </button>
              {user && (user.role === 'admin' || user.role === 'editor') && (
                <>
                  <span className="text-stone-300 dark:text-stone-700">•</span>
                  <button
                    type="button"
                    onClick={() => setShowEditModal(true)}
                    className="hover:opacity-60 transition-opacity cursor-pointer text-stone-800 dark:text-stone-200"
                  >
                    BASELINE
                  </button>
                </>
              )}
              <span className="text-stone-300 dark:text-stone-700">•</span>
              <Link
                href="/projects"
                className="text-stone-950 dark:text-stone-100 hover:opacity-60 transition-opacity"
              >
                PROJECTS
              </Link>
            </div>
          </div>

          {/* 2-Column Split: Hairline Spec Table + Editorial Scope Narrative */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Hairline Spec Table (5 cols) */}
            <div className="lg:col-span-5 divide-y divide-stone-200/80 dark:divide-stone-800/80 border-y border-stone-200/80 dark:border-stone-800/80 text-xs font-mono">
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-[10px] tracking-widest text-stone-400 uppercase">WBS CODE</span>
                <span className="font-bold text-stone-900 dark:text-stone-100">{project.wbs_no || '-'}</span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-[10px] tracking-widest text-stone-400 uppercase">STATUS</span>
                <span className="font-bold text-stone-900 dark:text-stone-100">{project.status}</span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-[10px] tracking-widest text-stone-400 uppercase">SUPERVISOR</span>
                <span className="font-bold text-stone-900 dark:text-stone-100">{project.supervisor || '-'}</span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-[10px] tracking-widest text-stone-400 uppercase">BUDGET</span>
                <span className="font-bold text-stone-900 dark:text-stone-100">฿{Number(project.budget || 0).toLocaleString()} บาท</span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-[10px] tracking-widest text-stone-400 uppercase">LOCATION</span>
                <span className="font-bold text-stone-900 dark:text-stone-100">{project.location || '-'}</span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-[10px] tracking-widest text-stone-400 uppercase">TIMELINE</span>
                <span className="font-bold text-stone-900 dark:text-stone-100">{formatDate(project.start_date)} — {formatDate(project.end_date)}</span>
              </div>
            </div>

            {/* Right Column: Editorial Narrative & Description (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              <p className="text-sm sm:text-base text-stone-600 dark:text-stone-300 leading-relaxed font-sans font-normal">
                {project.description || `${project.name} โครงการก่อสร้างและพัฒนาภายใต้ระบบควบคุมงานก่อสร้าง Estudio Bang Atelier เน้นการกำกับดูแลคุณภาพงานตามมาตรฐานวิศวกรรมและการวางแผนด้วย WBS และ S-Curve`}
              </p>

              {metrics.ext.isCurrentlySuspended && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 rounded-lg text-xs font-semibold">
                  <AlertTriangle size={15} />
                  ⏸ หยุดงาน — {metrics.ext.currentSuspension?.reason}
                  {' '}
                  ({' '}ตั้งแต่ {formatDate(metrics.ext.currentSuspension?.suspend_date || '')}
                  {metrics.ext.currentSuspension?.resume_date
                    ? (() => {
                        const lastStop = new Date(metrics.ext.currentSuspension!.resume_date!)
                        lastStop.setDate(lastStop.getDate() - 1)
                        return ` ถึง ${formatDate(lastStop.toISOString())}`
                      })()
                    : ' — ยังไม่กำหนดวันกลับ'
                  }
                  {' '})
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ══ ROW 1: เวลาสัญญา (4 col, 5 col if overrun) ══ */}
        <div className={`grid grid-cols-1 sm:grid-cols-2 ${metrics.isOverrun ? 'md:grid-cols-5' : 'md:grid-cols-4'} gap-4`}>

          {/* วันเริ่มต้น */}
          <div className="card gallery-podium rounded-2xl p-5 flex items-center gap-4 bg-[#FAF8F5]/85 dark:bg-[#14141c]/85 border border-stone-200/80 dark:border-stone-800">
            <div className="w-10 h-10 rounded-xl bg-stone-200/70 dark:bg-stone-800 flex items-center justify-center text-stone-700 dark:text-stone-300 flex-shrink-0">
              <Calendar size={18} />
            </div>
            <div>
              <p className={labelCls}>วันเริ่มสัญญา</p>
              <p className="text-base font-bold text-stone-900 dark:text-stone-100 mt-0.5">{formatDate(project.start_date)}</p>
            </div>
          </div>

          {/* วันสิ้นสุด */}
          <div className="card gallery-podium rounded-2xl p-5 flex items-center gap-4 bg-[#FAF8F5]/85 dark:bg-[#14141c]/85 border border-stone-200/80 dark:border-stone-800">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${metrics.isOverrun ? 'bg-red-500/10 text-red-500' : 'bg-stone-200/70 dark:bg-stone-800 text-stone-700 dark:text-stone-300'}`}>
              <Clock size={18} />
            </div>
            <div>
              <p className={labelCls}>วันสิ้นสุดสัญญา</p>
              <p className={`text-base font-bold mt-0.5 ${metrics.isOverrun ? 'text-red-500' : 'text-stone-900 dark:text-stone-100'}`}>
                {metrics.ext.newEndDate ? formatDate(metrics.ext.newEndDate.toISOString()) : formatDate(project.end_date)}
              </p>
            </div>
          </div>

          {/* วันคงเหลือ */}
          <div className="card gallery-podium rounded-2xl p-5 flex items-center gap-4 bg-[#FAF8F5]/85 dark:bg-[#14141c]/85 border border-stone-200/80 dark:border-stone-800">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${metrics.isOverrun ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'}`}>
              <Briefcase size={18} />
            </div>
            <div>
              <p className={labelCls}>{metrics.isOverrun ? 'เกินกำหนด' : 'วันคงเหลือ'}</p>
              <p className={`text-base font-bold mt-0.5 ${metrics.isOverrun ? 'text-red-500' : 'text-stone-900 dark:text-stone-100'}`}>
                {metrics.daysRemaining} วัน
                {metrics.isOverrun && <span className="ml-1.5 text-xs font-semibold">(เกินสัญญา)</span>}
              </p>
              <div className="mt-2 h-1.5 w-full rounded-full bg-stone-200/70 dark:bg-stone-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${metrics.isOverrun ? 'bg-red-500' : 'progress-fill'}`}
                  style={{ width: `${Math.min(100, metrics.totalDays > 0 ? (metrics.daysUsed / metrics.totalDays) * 100 : 0)}%` }}
                />
              </div>
            </div>
          </div>

          {/* วันทำงานทั้งหมด (สัญญารวม) */}
          <div className="card gallery-podium rounded-2xl p-5 flex items-center gap-4 bg-[#FAF8F5]/85 dark:bg-[#14141c]/85 border border-stone-200/80 dark:border-stone-800">
            <div className="w-10 h-10 rounded-xl bg-stone-200/70 dark:bg-stone-800 text-stone-700 dark:text-stone-300 flex items-center justify-center flex-shrink-0">
              <FileText size={18} />
            </div>
            <div>
              <p className={labelCls}>วันทำงานทั้งหมด</p>
              <p className="text-base font-bold text-stone-900 dark:text-stone-100 mt-0.5">
                {metrics.totalDays} วัน
              </p>
            </div>
          </div>

          {/* ค่าปรับ */}
          {metrics.isOverrun && (
            <div className="card gallery-podium rounded-2xl p-5 flex flex-col justify-center border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-500/5">
              <div className="flex items-center gap-2 mb-1 text-red-600 dark:text-red-400">
                <AlertOctagon size={16} />
                <p className="text-xs font-bold uppercase tracking-wider font-mono">ค่าปรับ (LD)</p>
              </div>
              <p className="text-lg font-black text-red-600 dark:text-red-400 mt-1 font-mono">
                {formatCurrency(metrics.totalPenalty)}
              </p>
              {metrics.ext.totalSuspendedDays > 0 && (
                <p className="text-[10px] text-red-500/80 dark:text-red-400/80 mt-1 font-semibold leading-tight font-mono">
                  *หัก {metrics.ext.totalSuspendedDays} วันจากช่วงหยุดงาน/แก้ไขสัญญา
                </p>
              )}
            </div>
          )}
        </div>

        {/* ══ ROW 2: ความก้าวหน้า (col-span-2) + EVM (col-span-1) ══ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* ความก้าวหน้างาน — 2 col */}
          <div className="card gallery-podium rounded-2xl p-6 lg:col-span-2 bg-[#FAF8F5]/85 dark:bg-[#14141c]/85 border border-stone-200/80 dark:border-stone-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-stone-950 dark:text-stone-50 flex items-center gap-2 font-sans tracking-tight">
                <TrendingUp size={16} className="text-stone-700 dark:text-stone-300" />
                ความก้าวหน้าโครงการ
              </h3>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                metrics.progressStatus === 'ahead' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' :
                metrics.progressStatus === 'behind' ? 'bg-red-500/10 text-red-600 dark:text-red-400' :
                'bg-stone-200/70 dark:bg-stone-800 text-stone-700 dark:text-stone-300'
              }`}>
                {metrics.progressStatus === 'ahead' ? '▲ เร็วกว่าแผน' : metrics.progressStatus === 'behind' ? '▼ ล่าช้า' : '● ตามแผน'}
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs text-stone-500 dark:text-stone-400 font-semibold font-mono">แผนงานสะสม (PV)</span>
                  <span className="text-sm font-bold text-stone-800 dark:text-stone-200 font-mono">{metrics.plannedProgress.toFixed(1)}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-stone-200/70 dark:bg-stone-800 overflow-hidden">
                  <div className="h-full rounded-full bg-stone-400 dark:bg-stone-600" style={{ width: `${metrics.plannedProgress}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs text-stone-500 dark:text-stone-400 font-semibold font-mono">ผลงานจริง (EV)</span>
                  <span className="text-sm font-bold text-stone-950 dark:text-stone-50 font-mono">{metrics.actualProgress.toFixed(1)}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-stone-200/70 dark:bg-stone-800 overflow-hidden">
                  <div className="h-full rounded-full progress-fill" style={{ width: `${metrics.actualProgress}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs text-stone-500 dark:text-stone-400 font-semibold font-mono">เบิกจ่ายสะสม (AC)</span>
                  <span className="text-sm font-bold text-amber-600 dark:text-amber-400 font-mono">{metrics.acCumulative.toFixed(1)}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-stone-200/70 dark:bg-stone-800 overflow-hidden">
                  <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.min(100, metrics.acCumulative)}%` }} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className={`p-3 rounded-xl border-l-4 flex items-center justify-between gap-2 ${
                metrics.sv > 0.005 ? 'border-emerald-600 bg-emerald-500/5 dark:bg-emerald-500/10' :
                metrics.sv < -0.005 ? 'border-red-500 bg-red-500/5 dark:bg-red-500/10' :
                'border-stone-400 bg-stone-100/60 dark:bg-[#1a1a24]/60'
              }`}>
                <div>
                  <p className="text-[10px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-widest font-mono">SV (EV−PV)</p>
                  <p className={`text-lg font-black font-mono mt-0.5 ${
                    metrics.sv > 0.005 ? 'text-emerald-700 dark:text-emerald-400' :
                    metrics.sv < -0.005 ? 'text-red-600 dark:text-red-400' :
                    'text-stone-600 dark:text-stone-400'
                  }`}>
                    {metrics.sv > 0.005 ? '+' : ''}{metrics.sv.toFixed(1)}%
                  </p>
                </div>
                <div className="text-right flex flex-col items-end justify-center min-w-0">
                  <p className={`text-[11px] font-bold ${
                    metrics.sv > 0.005 ? 'text-emerald-700 dark:text-emerald-400' :
                    metrics.sv < -0.005 ? 'text-red-600 dark:text-red-400' :
                    'text-stone-600 dark:text-stone-400'
                  }`}>
                    {metrics.sv > 0.005 ? '✅ เร็วกว่าแผน' :
                     metrics.sv < -0.005 ? '⚠️ ล่าช้ากว่าแผน' :
                     '🎯 ตรงตามแผน'}
                  </p>
                  {(metrics.sv > 0.005 || metrics.sv < -0.005) && (
                    <p className="text-[9px] text-stone-400 dark:text-stone-500 font-semibold mt-0.5 whitespace-nowrap font-mono">
                      {metrics.sv > 0.005 ? `+${Math.abs(metrics.svDays)} วัน เร็ว` : `−${Math.abs(metrics.svDays)} วัน ล่าช้า`}
                    </p>
                  )}
                </div>
              </div>
              <div className={`p-3 rounded-xl border-l-4 flex items-center justify-between gap-2 ${
                metrics.cv > 0.005 ? 'border-emerald-600 bg-emerald-500/5 dark:bg-emerald-500/10' :
                metrics.cv < -0.005 ? 'border-red-500 bg-red-500/5 dark:bg-red-500/10' :
                'border-stone-400 bg-stone-100/60 dark:bg-[#1a1a24]/60'
              }`}>
                <div>
                  <p className="text-[10px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-widest font-mono">CV (EV−AC)</p>
                  <p className={`text-lg font-black font-mono mt-0.5 ${
                    metrics.cv > 0.005 ? 'text-emerald-700 dark:text-emerald-400' :
                    metrics.cv < -0.005 ? 'text-red-600 dark:text-red-400' :
                    'text-stone-600 dark:text-stone-400'
                  }`}>
                    {metrics.cv > 0.005 ? '+' : ''}{metrics.cv.toFixed(1)}%
                  </p>
                </div>
                <div className="text-right flex flex-col items-end justify-center min-w-0">
                  {metrics.cv > 0.005 ? (
                    <>
                      <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">✅ ต่ำกว่าวงเงินจ้าง</span>
                      <span className="text-[9px] text-stone-500 dark:text-stone-400 font-semibold mt-0.5 whitespace-nowrap font-mono">ประหยัดได้ {formatCurrency((metrics.cv / 100) * (project.opening_pr || 0))}</span>
                    </>
                  ) : metrics.cv < -0.005 ? (
                    <>
                      <span className="text-[11px] font-bold text-red-600 dark:text-red-400">🔴 เกินวงเงินจ้าง</span>
                      <span className="text-[9px] text-stone-500 dark:text-stone-400 font-semibold mt-0.5 whitespace-nowrap font-mono">เกินงบ {formatCurrency(Math.abs((metrics.cv / 100) * (project.opening_pr || 0)))}</span>
                    </>
                  ) : (
                    <span className="text-[11px] font-bold text-stone-600 dark:text-stone-400">🎯 ตรงวงเงินจ้าง</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* EVM Key Numbers — 1 col */}
          <div className="card gallery-podium rounded-2xl p-6 lg:col-span-1 flex flex-col gap-3 bg-[#FAF8F5]/85 dark:bg-[#14141c]/85 border border-stone-200/80 dark:border-stone-800">
            <h3 className="text-sm font-bold text-stone-950 dark:text-stone-50 flex items-center gap-2 font-sans tracking-tight">
              <TrendingUp size={16} className="text-stone-700 dark:text-stone-300" />
              วิเคราะห์ EVM
            </h3>
            
            <div className="flex-1 space-y-3.5">
              {/* SPI Index */}
              <div className="p-3.5 rounded-xl bg-stone-100/70 dark:bg-[#1a1a24] border border-stone-200/80 dark:border-stone-800 flex flex-col gap-1 shadow-2xs">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider font-mono">SPI (ดัชนีแผนงาน)</span>
                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider font-mono ${
                    metrics.SPI >= 1.0 ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' :
                    metrics.SPI >= 0.9 ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400' :
                    'bg-red-500/10 text-red-600 dark:text-red-400'
                  }`}>
                    {metrics.SPI >= 1.0 ? 'เร็วกว่าแผน' : metrics.SPI >= 0.9 ? 'ล่าช้าเล็กน้อย' : 'ล่าช้าวิกฤต'}
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className={`text-2xl font-black font-mono leading-none ${
                    metrics.SPI >= 1.0 ? 'text-emerald-700 dark:text-emerald-400' :
                    metrics.SPI >= 0.9 ? 'text-amber-600 dark:text-amber-400' :
                    'text-red-600 dark:text-red-400'
                  }`}>
                    {metrics.SPI.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-stone-500 dark:text-stone-400 font-semibold font-mono">
                    (PV {metrics.pvCumulative.toFixed(0)}% vs EV {metrics.evCumulative.toFixed(0)}%)
                  </span>
                </div>
              </div>

              {/* CPI Index */}
              <div className="p-3.5 rounded-xl bg-stone-100/70 dark:bg-[#1a1a24] border border-stone-200/80 dark:border-stone-800 flex flex-col gap-1 shadow-2xs">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider font-mono">CPI (ดัชนีต้นทุน)</span>
                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider font-mono ${
                    metrics.CPI >= 1.0 ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' :
                    metrics.CPI >= 0.9 ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400' :
                    'bg-red-500/10 text-red-600 dark:text-red-400'
                  }`}>
                    {metrics.CPI >= 1.0 ? 'ประหยัดงบ' : metrics.CPI >= 0.9 ? 'เกินงบเล็กน้อย' : 'เกินงบวิกฤต'}
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className={`text-2xl font-black font-mono leading-none ${
                    metrics.CPI >= 1.0 ? 'text-emerald-700 dark:text-emerald-400' :
                    metrics.CPI >= 0.9 ? 'text-amber-600 dark:text-amber-400' :
                    'text-red-600 dark:text-red-400'
                  }`}>
                    {metrics.CPI.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-stone-500 dark:text-stone-400 font-semibold font-mono">
                    (EV {metrics.evCumulative.toFixed(0)}% vs AC {metrics.acCumulative.toFixed(0)}%)
                  </span>
                </div>
              </div>
            </div>

            {/* Overall Status Pill */}
            <div className={`text-center py-2.5 rounded-xl text-xs font-bold ${
              metrics.SPI >= 1.0 && metrics.CPI >= 1.0
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                : metrics.SPI < 0.9 || metrics.CPI < 0.9
                ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20'
            }`}>
              {metrics.SPI >= 1.0 && metrics.CPI >= 1.0 
                ? '● สุขภาพโครงการดี (Healthy)' 
                : metrics.SPI < 0.9 || metrics.CPI < 0.9 
                ? '⚠ วิกฤต (Critical Alert)' 
                : '⚠ เฝ้าระวัง (Warning)'}
            </div>
          </div>
        </div>

        {/* ══ ROW 3: การเงิน (2 col) + ตัวนับสถานะงาน (1 col) ══ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* วงเงินจ้าง & การเบิกจ่าย — 1 col */}
          <div className="card gallery-podium rounded-2xl p-6 bg-[#FAF8F5]/85 dark:bg-[#14141c]/85 border border-stone-200/80 dark:border-stone-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-stone-950 dark:text-stone-50 flex items-center gap-2 font-sans tracking-tight">
                <DollarSign size={16} className="text-stone-700 dark:text-stone-300" />
                วงเงินจ้าง & เบิกจ่าย
              </h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-stone-500 dark:text-stone-400 font-medium">จ่ายแล้ว</span>
                <span className="text-sm font-bold text-stone-950 dark:text-stone-50 font-mono">{metrics.paidPercent.toFixed(1)}%</span>
              </div>
              <div className="w-full rounded-full h-2 bg-stone-200/70 dark:bg-stone-800 overflow-hidden">
                <div className="h-full rounded-full progress-fill" style={{ width: `${Math.min(100, metrics.paidPercent)}%` }} />
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                <div className="bg-stone-100/70 dark:bg-[#181822] p-2.5 rounded-lg border border-stone-200/80 dark:border-stone-800">
                  <p className="text-[9px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-0.5 font-mono">วงเงินจ้างก่อสร้าง</p>
                  <p className="text-sm font-bold text-stone-950 dark:text-stone-50 mt-0.5 truncate font-mono">{formatCurrency(project.opening_pr || 0)}</p>
                </div>
                <div className="bg-stone-100/70 dark:bg-[#181822] p-2.5 rounded-lg border border-stone-200/80 dark:border-stone-800">
                  <p className={labelCls}>คงเหลือ</p>
                  <p className="text-sm font-bold text-stone-950 dark:text-stone-50 mt-0.5 truncate font-mono">{formatCurrency(metrics.remainingBudget)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* การส่งมอบงวดงาน — 1 col */}
          <div className="card gallery-podium rounded-2xl p-6 bg-[#FAF8F5]/85 dark:bg-[#14141c]/85 border border-stone-200/80 dark:border-stone-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-stone-950 dark:text-stone-50 flex items-center gap-2 font-sans tracking-tight">
                <CheckCircle size={16} className="text-stone-700 dark:text-stone-300" />
                การส่งมอบงวดงาน
              </h3>
            </div>
            <div className="flex items-baseline gap-1.5 mb-1">
              <span className="text-4xl font-black text-stone-950 dark:text-stone-50 font-mono">{milestones.filter(m => m.is_paid).length}</span>
              <span className="text-sm text-stone-500 dark:text-stone-400 font-medium">/ {milestones.length} งวด</span>
            </div>
            <p className="text-xs text-stone-500 font-medium mb-4">ส่งมอบและตรวจรับแล้ว</p>
            {milestones.length > 0 && (
              <div className="flex gap-1.5">
                {milestones.map((m, idx) => (
                  <div
                    key={idx}
                    title={m.name}
                    className={`h-3 flex-1 rounded-full transition-all ${m.is_paid ? 'bg-emerald-600 shadow-2xs' : 'bg-stone-200 dark:bg-stone-800'}`}
                  />
                ))}
              </div>
            )}
            
            {/* Payment Forecast (คาดการณ์เบิกจ่าย) */}
            {milestones.length > 0 && (
              <div className="mt-6 pt-4 border-t border-stone-200/80 dark:border-stone-800">
                <h4 className="text-[10px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-3 flex items-center gap-1.5 font-mono">
                  <Calendar size={12} />
                  คาดการณ์เบิกจ่าย (ยังไม่ส่งมอบ)
                </h4>
                <div className="space-y-2">
                  {milestones.filter(m => !m.is_paid).map((m, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs">
                      <span className="font-bold text-stone-800 dark:text-stone-200">{m.name}</span>
                      {m.expected_payment_date ? (
                        <span className="text-stone-800 dark:text-stone-200 font-medium bg-stone-100 dark:bg-stone-800 px-2 py-0.5 rounded font-mono">
                          {new Date(m.expected_payment_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
                        </span>
                      ) : (
                        <span className="text-amber-700 dark:text-amber-400 font-medium bg-amber-500/10 px-2 py-0.5 rounded">ยังไม่ระบุกำหนดการ</span>
                      )}
                    </div>
                  ))}
                  {milestones.filter(m => !m.is_paid).length === 0 && (
                    <div className="text-xs text-stone-400 italic text-center py-2 bg-stone-100/60 dark:bg-stone-800/60 rounded-lg">ไม่มีงวดที่รอเบิกจ่าย</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* สรุปสถานะงานย่อย — 1 col */}
          <div className="card gallery-podium rounded-2xl p-6 bg-[#FAF8F5]/85 dark:bg-[#14141c]/85 border border-stone-200/80 dark:border-stone-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-stone-950 dark:text-stone-50 flex items-center gap-2 font-sans tracking-tight">
                <Briefcase size={16} className="text-stone-700 dark:text-stone-300" />
                สรุปสถานะงานย่อย
              </h3>
              <span className="text-[10px] font-bold bg-stone-200/70 dark:bg-stone-800 text-stone-700 dark:text-stone-300 px-2 py-0.5 rounded font-mono">WBS</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-stone-100/70 dark:bg-[#181822] p-3 rounded-xl border border-stone-200/80 dark:border-stone-800 text-center">
                <p className="text-2xl font-black text-stone-950 dark:text-stone-50 font-mono">{metrics.taskStats.total}</p>
                <p className="text-[10px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider mt-0.5 font-mono">งานทั้งหมด</p>
              </div>
              <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20 text-center">
                <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400 font-mono">{metrics.taskStats.completed}</p>
                <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mt-0.5 font-mono">เสร็จแล้ว</p>
              </div>
              <div className="bg-red-500/10 p-3 rounded-xl border border-red-500/20 text-center">
                <p className="text-2xl font-black text-red-600 dark:text-red-400 font-mono">{metrics.taskStats.delayed}</p>
                <p className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider mt-0.5 font-mono">ล่าช้า</p>
              </div>
              <div className="bg-stone-200/60 dark:bg-[#181822] p-3 rounded-xl border border-stone-300/60 dark:border-stone-800 text-center">
                <p className="text-2xl font-black text-stone-600 dark:text-stone-400 font-mono">{metrics.taskStats.future}</p>
                <p className="text-[10px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider mt-0.5 font-mono">ในอนาคต</p>
              </div>
            </div>
          </div>
        </div>

        {/* ══ ROW 3.5: สรุปสถานะความก้าวหน้าตามหมวดงาน (Work Status Summary) ══ */}
        <div className="card gallery-podium rounded-2xl p-6 sm:p-7 space-y-4 bg-[#FAF8F5]/85 dark:bg-[#14141c]/85 border border-stone-200/80 dark:border-stone-800">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-stone-200/80 dark:border-stone-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-700 dark:text-teal-400 flex items-center justify-center font-bold">
                <Briefcase size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-stone-950 dark:text-stone-50 flex items-center gap-2 font-sans tracking-tight">
                  สรุปสถานะความก้าวหน้าตามหมวดงาน
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-stone-200/70 dark:bg-stone-800 text-stone-800 dark:text-stone-200 font-mono">
                    {tasks.length} รายการ
                  </span>
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  สรุปภาพรวมความคืบหน้ารายหมวดงานโยธา/โครงสร้าง/ไฟฟ้า และสร้างรูปภาพ 16:9 สรุปส่งกลุ่ม LINE ได้ทันที
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href={`/projects/${project.id}/planning`}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border border-stone-300 dark:border-stone-700 text-stone-800 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
              >
                <span>Gantt Chart ↗</span>
              </Link>
            </div>
          </div>

          {/* Key Highlights Strip (สถานะเทียบแผน, การส่งมอบงวดงาน, การเบิกจ่าย) */}
          <div className="flex flex-wrap items-center gap-2.5 p-3 rounded-xl bg-stone-100/80 dark:bg-[#181822]/80 border border-stone-200/80 dark:border-stone-800">
            {/* 1. Schedule Variance */}
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold ${
                metrics.progressStatus === 'delayed'
                  ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                  : metrics.progressStatus === 'ahead'
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                  : 'bg-stone-200/70 text-stone-800 dark:bg-stone-800 dark:text-stone-200 border border-stone-300 dark:border-stone-700'
              }`}
            >
              <span>{metrics.progressStatus === 'delayed' ? '⚠️' : metrics.progressStatus === 'ahead' ? '🚀' : '🟢'}</span>
              <span className="font-mono">
                {metrics.progressStatus === 'delayed'
                  ? `ล่าช้ากว่าแผน ${Math.abs(metrics.svDays)} วัน (${metrics.sv.toFixed(1)}%)`
                  : metrics.progressStatus === 'ahead'
                  ? `เร็วกว่าแผน +${Math.abs(metrics.svDays)} วัน (+${metrics.sv.toFixed(1)}%)`
                  : `ดำเนินงานตามแผน (${metrics.sv >= 0 ? '+' : ''}${metrics.sv.toFixed(1)}%)`}
              </span>
            </div>

            {/* 2. Milestones Delivery */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-[#1e1e2c] text-stone-800 dark:text-stone-200 border border-stone-200/90 dark:border-stone-800">
              <span>📦</span>
              <span>
                ส่งมอบแล้ว {milestones.filter(m => m.is_paid || m.status === 'Paid' || m.status === 'Approved').length}/{milestones.length} งวด
              </span>
            </div>

            {/* 3. Disbursement */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-[#1e1e2c] text-stone-800 dark:text-stone-200 border border-stone-200/90 dark:border-stone-800 font-mono">
              <span>💰</span>
              <span>
                เบิกจ่ายแล้ว {metrics.paidPercent.toFixed(1)}% ({((metrics.paid || 0) / 1_000_000).toFixed(2)} ลบ. / {((metrics.budget || 0) / 1_000_000).toFixed(2)} ลบ.)
              </span>
            </div>
          </div>

          {/* Categorized Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categorizedTasks.map((group, gIdx) => (
              <div
                key={gIdx}
                className="bg-white/80 dark:bg-[#181822] border border-stone-200/80 dark:border-stone-800 rounded-xl p-4 flex flex-col justify-between space-y-3 shadow-2xs"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                      <span>{group.icon}</span>
                      <span>{group.title}</span>
                    </span>
                    <span className="text-xs font-mono font-bold text-teal-700 dark:text-teal-400">
                      {group.avgProgress.toFixed(1)}%
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-stone-200/80 dark:bg-stone-800 rounded-full h-1.5 overflow-hidden mb-3">
                    <div
                      className="bg-teal-600 dark:bg-teal-500 h-1.5 rounded-full transition-all"
                      style={{ width: `${Math.min(100, Math.max(0, group.avgProgress))}%` }}
                    />
                  </div>

                  {/* Tasks List */}
                  <div className="space-y-1.5">
                    {group.tasks.slice(0, 6).map((t, tIdx) => {
                      const prog = t.actual_progress ?? 0
                      return (
                        <div key={tIdx} className="flex items-start justify-between text-xs gap-2 py-0.5">
                          <span className="text-stone-700 dark:text-stone-300 line-clamp-1 flex-1" title={t.name}>
                            • {t.name}
                          </span>
                          <span
                            className={`font-mono text-[11px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${
                              prog === 100
                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                                : prog > 0
                                ? 'bg-stone-200/80 text-stone-800 dark:bg-stone-800 dark:text-stone-200'
                                : 'bg-stone-100 text-stone-400 dark:bg-stone-850 dark:text-stone-500'
                            }`}
                          >
                            {prog === 100 ? 'เสร็จ 100%' : prog > 0 ? `${prog}%` : '0%'}
                          </span>
                        </div>
                      )
                    })}

                    {group.tasks.length > 6 && (
                      <div className="text-[11px] text-stone-400 dark:text-stone-500 pt-1 text-center font-medium font-mono">
                        + อีก {group.tasks.length - 6} รายการ
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-stone-200/80 dark:border-stone-800 flex items-center justify-between text-[11px] text-stone-500 font-mono">
                  <span>ทั้งหมด {group.tasks.length} รายการ</span>
                  <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                    เสร็จ {group.tasks.filter(t => (t.actual_progress ?? 0) === 100).length} รายการ
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ══ ROW 4: ข้อมูลสัญญา & กรรมการ (full width) ══ */}
        <div className="card gallery-podium rounded-2xl p-6 sm:p-7 bg-[#FAF8F5]/85 dark:bg-[#14141c]/85 border border-stone-200/80 dark:border-stone-800">
          <h3 className="text-sm font-bold text-stone-950 dark:text-stone-50 flex items-center gap-2 mb-4 font-sans tracking-tight">
            <User size={16} className="text-stone-700 dark:text-stone-300" />
            ข้อมูลสัญญา & คณะกรรมการตรวจรับ
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className={labelCls}>หมายเลขงาน (WBS)</p>
              <p className="text-sm font-bold text-stone-950 dark:text-stone-50 mt-1 font-mono">{project.wbs_no || '—'}</p>
            </div>
            <div>
              <p className={labelCls}>เลขที่สัญญา</p>
              <p className="text-sm font-bold text-stone-950 dark:text-stone-50 mt-1 font-mono">{project.contract_no || '—'}</p>
            </div>
            <div>
              <p className={labelCls}>ผู้รับจ้าง / คู่สัญญา</p>
              <p className="text-sm font-bold text-stone-950 dark:text-stone-50 mt-1">{project.contractor || '—'}</p>
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
                if (committeeList.length === 0) return <p className="text-sm text-stone-400 mt-1">—</p>
                return <ul className="mt-1 space-y-1">{committeeList.map((m, i) => (
                  <li key={i} className="text-sm font-semibold text-stone-800 dark:text-stone-200 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-stone-900 dark:bg-stone-100 flex-shrink-0" />
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
        <EditBaselineModal 
          project={project} 
          milestones={milestones} 
          amendments={amendments || []}
          onClose={() => setShowEditModal(false)} 
          workGroups={workGroups}
          supervisorsList={supervisorsList}
        />
      )}

      {/* ── Line Summary Banner Modal 16:9 ── */}
      {isLineBannerOpen && (
        <LineSummaryBannerModal
          isOpen={isLineBannerOpen}
          onClose={() => setIsLineBannerOpen(false)}
          project={project}
          tasks={tasks}
          milestones={milestones}
          amendments={amendments}
          inspections={inspections}
          actualProgress={metrics.evCumulative}
          plannedProgress={metrics.pvCumulative}
          initialPhotos={(() => {
            const list: { url: string; caption?: string }[] = []
            if (inspections && inspections.length > 0) {
              inspections.forEach(i => {
                (i.photo_urls || []).forEach(p => {
                  const u = p.split('|||')[0]?.trim()
                  if (u && !list.some(item => item.url === u)) {
                    list.push({ url: u, caption: i.title || i.inspection_no || 'ภาพความก้าวหน้า' })
                  }
                })
              })
            }
            return list.slice(0, 3)
          })()}
        />
      )}
    </>
  )
}
