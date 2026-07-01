'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Folder, Printer, ArrowUpDown, TrendingUp, DollarSign, Calendar, AlertTriangle, CheckCircle, ExternalLink, ArrowUp, ArrowDown } from 'lucide-react'
import type { Project, WBSTask, ProjectMilestone } from '@/lib/types'
import { computeTaskDates } from '@/lib/scheduler'
import type { UserSession } from '@/lib/auth'

interface Props {
  projects: Project[]
  tasks: WBSTask[]
  milestones: ProjectMilestone[]
  user?: UserSession | null
}

type SortField = 'name' | 'remaining' | 'ev' | 'sv'
type SortDir = 'asc' | 'desc'

export function PortfolioClient({ projects, tasks, milestones, user }: Props) {
  // Checkbox status filter states
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([
    'กำลังดำเนินการ',
    'เสร็จสิ้น',
    'รอดำเนินการ',
    'ระงับ',
  ])

  // Sorting states
  const [sortBy, setBy] = useState<SortField>('sv')
  const [sortDir, setDir] = useState<SortDir>('asc') // Default SV ascending (most delayed first)

  // 1. Calculate project-level metrics for all projects (pre-filtering)
  const computedProjects = useMemo(() => {
    const today = new Date()
    const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate())

    return projects.map((p) => {
      const projectTasks = tasks.filter((t) => t.project_id === p.id)
      const projectMilestones = milestones.filter((m) => m.project_id === p.id)

      const start = p.start_date ? new Date(p.start_date) : null
      const end = p.end_date ? new Date(p.end_date) : null

      let totalDays = 0
      let remainingDays = 0
      if (start && end) {
        const startOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate())
        const endOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate())
        totalDays = Math.max(0, Math.ceil((endOnly.getTime() - startOnly.getTime()) / (1000 * 60 * 60 * 24)))
        remainingDays = Math.ceil((endOnly.getTime() - todayDateOnly.getTime()) / (1000 * 60 * 60 * 24))
      }

      // Calculate EV and PV
      let pvCumulative = 0
      let evCumulative = 0

      if (projectTasks.length > 0) {
        const scheduledTasks = computeTaskDates(projectTasks, p.start_date)
        const totalWbsCost = scheduledTasks.reduce((sum, t) => sum + (Number(t.cost) || 0), 0)

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
      } else {
        // Fallback: Use projects table progress and project dates for planning
        evCumulative = p.progress ?? 0

        if (start && end) {
          if (todayDateOnly >= end) {
            pvCumulative = 100
          } else if (todayDateOnly < start) {
            pvCumulative = 0
          } else {
            const elapsed = todayDateOnly.getTime() - start.getTime()
            const total = end.getTime() - start.getTime()
            pvCumulative = (elapsed / Math.max(1, total)) * 100
          }
        }
      }

      const SV = evCumulative - pvCumulative

      // Milestones paid progress
      const totalMilestones = projectMilestones.length
      const paidMilestones = projectMilestones.filter((m) => m.is_paid)
      const paidCount = paidMilestones.length
      const totalPaidMilestonesAmount = paidMilestones.reduce((sum, m) => sum + (Number(m.amount) || 0), 0)

      // AC (Actual Cost) as a percent of budget
      const acPercent = Number(p.budget) > 0 ? (totalPaidMilestonesAmount / Number(p.budget)) * 100 : 0
      const CV = evCumulative - acPercent

      // Traffic Light color:
      // 🟢 EV >= PV (SV >= 0) and CV >= 0
      // 🔴 Both SV < 0 and CV < 0 (critical)
      // 🟡 One is negative (warning)
      let trafficLight: 'green' | 'yellow' | 'red' = 'green'
      if (SV < 0 && CV < 0) {
        trafficLight = 'red'
      } else if (SV < 0 || CV < 0) {
        trafficLight = 'yellow'
      }

      return {
        ...p,
        pvCumulative,
        evCumulative,
        SV,
        CV,
        remainingDays,
        totalDays,
        totalMilestones,
        paidCount,
        acPercent,
        trafficLight,
      }
    })
  }, [projects, tasks, milestones])

  // Count badges for filters
  const filterCounts = useMemo(() => {
    return {
      active: computedProjects.filter((p) => p.status === 'กำลังดำเนินการ').length,
      done: computedProjects.filter((p) => p.status === 'เสร็จสิ้น').length,
      late: computedProjects.filter((p) => p.SV < 0).length,
      pending: computedProjects.filter((p) => p.status === 'รอดำเนินการ').length,
      paused: computedProjects.filter((p) => p.status === 'ระงับ').length,
    }
  }, [computedProjects])

  // 2. Filter projects
  const filteredProjects = useMemo(() => {
    return computedProjects.filter((p) => {
      return selectedStatuses.includes(p.status)
    })
  }, [computedProjects, selectedStatuses])

  // 3. Sort projects
  const sortedProjects = useMemo(() => {
    const sorted = [...filteredProjects]
    sorted.sort((a, b) => {
      let valA: any = 0
      let valB: any = 0

      if (sortBy === 'name') {
        return sortDir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
      } else if (sortBy === 'remaining') {
        valA = a.remainingDays
        valB = b.remainingDays
      } else if (sortBy === 'ev') {
        valA = a.evCumulative
        valB = b.evCumulative
      } else if (sortBy === 'sv') {
        valA = a.SV
        valB = b.SV
      }

      if (valA < valB) return sortDir === 'asc' ? -1 : 1
      if (valA > valB) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return sorted
  }, [filteredProjects, sortBy, sortDir])

  // 4. Calculate Portfolio Summary Cards KPIs
  const summaryKpis = useMemo(() => {
    const totalBudget = filteredProjects.reduce((sum, p) => sum + (p.budget || 0), 0)
    const totalEVWeighted = filteredProjects.reduce((sum, p) => sum + (p.evCumulative * (p.budget || 0)), 0)

    const averageEV = totalBudget > 0 ? totalEVWeighted / totalBudget : (filteredProjects.length > 0 ? filteredProjects.reduce((sum, p) => sum + p.evCumulative, 0) / filteredProjects.length : 0)

    const lateCount = filteredProjects.filter((p) => p.SV < 0).length
    const doneCount = filteredProjects.filter((p) => p.status === 'เสร็จสิ้น').length

    return {
      totalBudget,
      averageEV,
      lateCount,
      doneCount,
    }
  }, [filteredProjects])

  // Toggle single status checkbox filter
  const handleToggleStatus = (statusKey: string) => {
    setSelectedStatuses((prev) =>
      prev.includes(statusKey) ? prev.filter((s) => s !== statusKey) : [...prev, statusKey]
    )
  }

  // Format budget amount to millions (M)
  const formatBudget = (amount: number) => {
    if (amount >= 1000000) {
      return `฿${(amount / 1000000).toFixed(2)}M`
    }
    return `฿${amount.toLocaleString()}`
  }

  const handlePrint = () => {
    window.print()
  }

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setBy(field)
      setDir(field === 'sv' ? 'asc' : 'desc') // default ascending for SV, descending for others
    }
  }

  return (
    <div className="space-y-6">
      <style jsx global>{`
        @media print {
          @page {
            size: landscape;
            margin: 0.5cm;
          }
          header, nav, aside, footer, .no-print {
            display: none !important;
          }
          
          /* Force white background and dark slate text on all structural containers */
          html, body, main, table, tr, th, td, h2, h3, h4, p, span, a {
            background-color: white !important;
            background: white !important;
            color: #0f172a !important;
          }
          
          body {
            font-size: 9px !important;
            font-family: 'Inter', sans-serif !important;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-layout {
            display: block !important;
          }
          .print-w-full {
            width: 100% !important;
            max-width: 100% !important;
          }
          
          /* Cards should be white background with thin borders */
          .card {
            border: 1px solid #cbd5e1 !important;
            background-color: white !important;
            background: white !important;
            color: #0f172a !important;
            box-shadow: none !important;
            border-radius: 8px !important;
            padding: 10px !important;
          }
          
          table {
            width: 100% !important;
            min-width: 0 !important;
            table-layout: auto !important;
            border-collapse: collapse !important;
          }
          th, td {
            border: 1px solid #cbd5e1 !important;
            padding: 6px 4px !important;
            font-size: 8px !important;
            word-break: break-word !important;
          }
          .print-title {
            display: block !important;
            font-size: 14px !important;
            font-weight: bold !important;
            text-align: center !important;
            margin-bottom: 15px !important;
          }
          
          /* --- PRESERVE COLORED COMPONENT BACKGROUNDS --- */
          
          /* Progress bars containers (White background with border) */
          .relative.flex-1.h-3\\.5, .w-full.h-1\\.5,
          .bg-slate-200,
          .dark\\:bg-slate-800,
          .dark .dark\\:bg-slate-800 {
            background-color: #ffffff !important;
            background: #ffffff !important;
            border-color: #cbd5e1 !important;
          }
          
          /* PV bar (Light Gray so it's clean and not dark) */
          .bg-slate-400,
          .dark\\:bg-slate-500,
          .dark .dark\\:bg-slate-500,
          .dark\\:bg-slate-600,
          .dark .dark\\:bg-slate-600 {
            background-color: #cbd5e1 !important;
            background: #cbd5e1 !important;
          }
          
          /* EV bar (Solid bold Purple) */
          .bg-purple-600,
          .dark\\:bg-purple-500,
          .dark .dark\\:bg-purple-500 {
            background-color: #7e22ce !important;
            background: #7e22ce !important;
          }
          
          /* Paid milestones progress fill */
          .bg-emerald-500 {
            background-color: #10b981 !important;
          }
          
          /* Status Badges */
          .bg-blue-500\\/10 {
            background-color: #eff6ff !important;
            color: #2563eb !important;
          }
          .bg-emerald-500\\/10 {
            background-color: #ecfdf5 !important;
            color: #059669 !important;
          }
          .bg-amber-500\\/10 {
            background-color: #fffbeb !important;
            color: #d97706 !important;
          }
          .bg-slate-100 {
            background-color: #f1f5f9 !important;
            color: #475569 !important;
          }
          .text-red-600.bg-red-100 {
            background-color: #fee2e2 !important;
            color: #dc2626 !important;
          }
          
          /* Traffic Light Indicators */
          .w-3.h-3.rounded-full.bg-emerald-500 {
            background-color: #10b981 !important;
          }
          .w-3.h-3.rounded-full.bg-red-500 {
            background-color: #ef4444 !important;
          }
          .w-3.h-3.rounded-full.bg-amber-500 {
            background-color: #f59e0b !important;
          }
        }
      `}</style>

      {/* --- PRINT ONLY TITLE HEADER --- */}
      <div className="hidden print-title text-center pb-2 border-b border-slate-300 dark:border-[#252548] mb-4">
        <h2 className="text-base font-black">รายงานสรุปภาพรวมโครงการทั้งหมด</h2>
        <p className="text-[10px] text-slate-500 font-bold mt-1">
          ณ วันที่ {new Date().toLocaleDateString('th-TH', { dateStyle: 'long' })}
        </p>
      </div>

      {/* ── PART 1: FILTER BAR (Hidden in print) ── */}
      <div className="card rounded-2xl p-5 border border-slate-200 dark:border-[#1c1c34] flex flex-col md:flex-row md:items-center justify-between gap-4 no-print shadow-sm">
        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ตัวกรองสถานะโครงการ (เลือกดูพร้อมกันได้)</span>
          <div className="flex flex-wrap gap-2.5 items-center">
            {/* Active (กำลังดำเนินการ) */}
            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={selectedStatuses.includes('กำลังดำเนินการ')}
                onChange={() => handleToggleStatus('กำลังดำเนินการ')}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500/20"
              />
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                กำลังดำเนินการ ({filterCounts.active})
              </span>
            </label>

            {/* Completed (เสร็จสิ้น) */}
            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={selectedStatuses.includes('เสร็จสิ้น')}
                onChange={() => handleToggleStatus('เสร็จสิ้น')}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500/20"
              />
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                เสร็จสิ้น ({filterCounts.done})
              </span>
            </label>



            {/* Pending (รอดำเนินการ) */}
            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={selectedStatuses.includes('รอดำเนินการ')}
                onChange={() => handleToggleStatus('รอดำเนินการ')}
                className="w-4 h-4 rounded text-slate-600 focus:ring-slate-500/20"
              />
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                รอดำเนินการ ({filterCounts.pending})
              </span>
            </label>

            {/* Suspended (ระงับ) */}
            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={selectedStatuses.includes('ระงับ')}
                onChange={() => handleToggleStatus('ระงับ')}
                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500/20"
              />
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                ถูกระงับ ({filterCounts.paused})
              </span>
            </label>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSelectedStatuses(['กำลังดำเนินการ', 'เสร็จสิ้น', 'รอดำเนินการ', 'ระงับ'])}
            className="px-2.5 py-1.5 text-[10px] font-black rounded-lg border border-slate-200 dark:border-[#252548] text-slate-500 hover:bg-slate-50 dark:hover:bg-[#1e1e38] transition-colors cursor-pointer"
          >
            เลือกทั้งหมด
          </button>
          <button
            onClick={() => setSelectedStatuses([])}
            className="px-2.5 py-1.5 text-[10px] font-black rounded-lg border border-slate-200 dark:border-[#252548] text-slate-500 hover:bg-slate-50 dark:hover:bg-[#1e1e38] transition-colors cursor-pointer"
          >
            ล้างทั้งหมด
          </button>
          <button
            onClick={handlePrint}
            className="btn-secondary px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border-slate-200 cursor-pointer"
          >
            <Printer size={14} /> 🖨 พิมพ์ภาพรวม
          </button>
        </div>
      </div>

      {/* ── PART 2: SUMMARY CARDS (Consolidated KPIs) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 print:grid-cols-4 print:gap-3">
        {/* budget */}
        <div className="card rounded-2xl p-5 border border-slate-200 dark:border-[#1c1c34] flex items-center gap-4 bg-white dark:bg-[#14142a] print:card">
          <div className="w-10 h-10 rounded-xl bg-green-500/10 text-green-600 dark:text-green-400 flex items-center justify-center print:hidden flex-shrink-0">
            <DollarSign size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">งบรวมทุกโครงการ</p>
            <p className="text-lg font-black text-slate-900 dark:text-white mt-1">
              {summaryKpis.totalBudget.toLocaleString()} ฿
            </p>
          </div>
        </div>

        {/* average EV */}
        <div className="card rounded-2xl p-5 border border-slate-200 dark:border-[#1c1c34] flex items-center gap-4 bg-white dark:bg-[#14142a] print:card">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center print:hidden flex-shrink-0">
            <TrendingUp size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">EV เฉลี่ยความก้าวหน้าสะสม</p>
            <p className="text-lg font-black text-slate-900 dark:text-white mt-1">
              {summaryKpis.averageEV.toFixed(1)}%
            </p>
          </div>
        </div>

        {/* delayed projects */}
        <div className="card rounded-2xl p-5 border border-slate-200 dark:border-[#1c1c34] flex items-center gap-4 bg-white dark:bg-[#14142a] print:card">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center print:hidden flex-shrink-0">
            <AlertTriangle size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">โครงการล่าช้ากว่าแผน</p>
            <p className="text-lg font-black text-red-600 dark:text-red-400 mt-1">
              {summaryKpis.lateCount} โครงการ
            </p>
          </div>
        </div>

        {/* completed projects */}
        <div className="card rounded-2xl p-5 border border-slate-200 dark:border-[#1c1c34] flex items-center gap-4 bg-white dark:bg-[#14142a] print:card">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center print:hidden flex-shrink-0">
            <CheckCircle size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">โครงการเสร็จสิ้น</p>
            <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1">
              {summaryKpis.doneCount} โครงการ
            </p>
          </div>
        </div>
      </div>

      {/* ── PART 3: COMPARISON TABLE ── */}
      <div className="card rounded-2xl border border-slate-200 dark:border-[#1c1c34] bg-white dark:bg-[#14142a] overflow-hidden print:card shadow-sm">
        {filteredProjects.length === 0 ? (
          <div className="text-center py-20">
            <Folder size={40} className="mx-auto text-slate-300 dark:text-slate-700 mb-4" />
            <p className="text-sm font-bold text-slate-500">ไม่พบโครงการตรงตามเงื่อนไขตัวกรอง</p>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse min-w-[900px] md:min-w-0">
              <thead>
                <tr className="border-b border-slate-100 dark:border-[#1c1c34] bg-slate-50/50 dark:bg-[#1b1b36]/30 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider print:bg-transparent">
                  {/* traffic light indicator empty label */}
                  <th className="py-4 pl-5 pr-1 w-8"></th>
                  <th className="py-4 px-3 cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-300" onClick={() => handleSort('name')}>
                    ชื่อโครงการ {sortBy === 'name' ? (sortDir === 'asc' ? '▲' : '▼') : <ArrowUpDown size={10} className="inline ml-1" />}
                  </th>
                  <th className="py-4 px-3 w-32">สถานะ</th>
                  <th className="py-4 px-3 w-32 cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-300" onClick={() => handleSort('remaining')}>
                    วันคงเหลือ {sortBy === 'remaining' ? (sortDir === 'asc' ? '▲' : '▼') : <ArrowUpDown size={10} className="inline ml-1" />}
                  </th>
                  <th className="py-4 px-3 cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-300" onClick={() => handleSort('ev')}>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span>Progress</span>
                      <span className="text-[9px] font-normal text-slate-400 lowercase tracking-normal print:text-slate-600">
                        (
                        <span className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full inline-block align-middle mr-0.5"></span>
                        PV แผน / 
                        <span className="w-1.5 h-1.5 bg-purple-600 rounded-full inline-block align-middle ml-1 mr-0.5"></span>
                        EV จริง
                        )
                      </span>
                      {sortBy === 'ev' ? (sortDir === 'asc' ? '▲' : '▼') : <ArrowUpDown size={10} className="inline ml-1 flex-shrink-0" />}
                    </div>
                  </th>
                  <th className="py-4 px-3 w-20 cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-300" onClick={() => handleSort('sv')}>
                    SV {sortBy === 'sv' ? (sortDir === 'asc' ? '▲' : '▼') : <ArrowUpDown size={10} className="inline ml-1" />}
                  </th>
                  <th className="py-4 px-3 w-24 hidden md:table-cell">CV</th>
                  <th className="py-4 px-3 w-28 hidden md:table-cell">งบรวม</th>
                  <th className="py-4 px-3 w-32 hidden md:table-cell">การจ่ายเงิน (% Paid)</th>
                  <th className="py-4 px-5 pr-5 w-20 text-center no-print">เปิด</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#1c1c34] text-xs font-bold text-slate-700 dark:text-slate-300 print:divide-y print:divide-slate-300">
                {sortedProjects.map((p) => {
                  const svIcon = p.SV >= 0 ? <ArrowUp size={12} className="text-emerald-500 inline mr-0.5" /> : <ArrowDown size={12} className="text-red-500 inline mr-0.5" />
                  const cvColor = p.CV >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'

                  // Remaining days badge formatting
                  let remainingText = ''
                  let remainingCls = 'text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800'
                  if (p.start_date && p.end_date) {
                    if (p.remainingDays < 0) {
                      remainingText = `เกิน ${Math.abs(p.remainingDays)} วัน`
                      remainingCls = 'text-red-600 bg-red-100 dark:bg-red-950/20'
                    } else {
                      remainingText = `เหลือ ${p.remainingDays} วัน`
                    }
                  } else {
                    remainingText = '-'
                  }

                  // Status badge style
                  let statusCls = 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                  if (p.status === 'กำลังดำเนินการ') statusCls = 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                  if (p.status === 'เสร็จสิ้น') statusCls = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  if (p.status === 'ระงับ') statusCls = 'bg-amber-500/10 text-amber-600 dark:text-amber-400'

                  // Traffic light dot style
                  let trafficLightDot = 'bg-emerald-500'
                  if (p.trafficLight === 'red') trafficLightDot = 'bg-red-500 animate-pulse'
                  if (p.trafficLight === 'yellow') trafficLightDot = 'bg-amber-500'

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-[#1a1a36]/10 print:hover:bg-transparent">
                      {/* Traffic Light Dot Column */}
                      <td className="py-4 pl-5 pr-1 text-center">
                        <div className={`w-3 h-3 rounded-full ${trafficLightDot}`} title={
                          p.trafficLight === 'red' ? 'วิกฤต (ทั้ง SV และ CV ติดลบ)' :
                          p.trafficLight === 'yellow' ? 'เฝ้าระวัง (SV หรือ CV ติดลบ)' :
                          'ปกติ (แผนงานและงบประมาณราบรื่น)'
                        } />
                      </td>

                      {/* Project Name */}
                      <td className="py-4 px-3 truncate max-w-[200px]" title={p.name}>
                        <Link href={`/projects/${p.id}`} className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors flex items-center gap-1">
                          {p.name}
                          <ExternalLink size={10} className="text-slate-400 print:hidden" />
                        </Link>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${statusCls}`}>
                          {p.status}
                        </span>
                      </td>

                      {/* Remaining Days */}
                      <td className="py-4 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${remainingCls}`}>
                          {remainingText}
                        </span>
                      </td>

                      {/* Overlapping Progress Bar (PV and EV in single track) */}
                      <td className="py-4 px-3 pr-4">
                        <div className="flex items-center gap-3 w-full">
                          <div className="relative flex-1 h-3.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-300/50 dark:border-[#252548]">
                            {/* PV bar (gray) */}
                            <div
                              className="absolute top-0 bottom-0 left-0 bg-slate-400 dark:bg-slate-500 rounded-full"
                              style={{ width: `${Math.min(100, p.pvCumulative)}%` }}
                            />
                            {/* EV bar (purple) */}
                            <div
                              className="absolute top-0 bottom-0 left-0 bg-purple-600 dark:bg-purple-500 rounded-full"
                              style={{ width: `${Math.min(100, p.evCumulative)}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 flex-shrink-0">
                            PV {p.pvCumulative.toFixed(0)}% / EV {p.evCumulative.toFixed(0)}%
                          </span>
                        </div>
                      </td>

                      {/* SV */}
                      <td className="py-4 px-3 font-mono">
                        <span className={p.SV >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}>
                          {svIcon} {p.SV >= 0 ? '+' : ''}{p.SV.toFixed(1)}%
                        </span>
                      </td>

                      {/* CV */}
                      <td className={`py-4 px-3 font-mono hidden md:table-cell ${cvColor}`}>
                        {p.CV >= 0 ? '+' : ''}{p.CV.toFixed(1)}%
                      </td>

                      {/* Budget */}
                      <td className="py-4 px-3 hidden md:table-cell font-mono text-slate-600 dark:text-slate-400">
                        {formatBudget(p.budget || 0)}
                      </td>

                      {/* Milestones Paid Progress Bar */}
                      <td className="py-4 px-3 hidden md:table-cell">
                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-[10px] font-mono text-slate-400">
                            <span>จ่ายแล้ว {p.acPercent.toFixed(0)}%</span>
                            <span>{p.paidCount}/{p.totalMilestones} งวด</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200/50 dark:border-[#252548]">
                            <div
                              className="h-full bg-emerald-500 rounded-full"
                              style={{ width: `${Math.min(100, p.acPercent)}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Open dashboard link button */}
                      <td className="py-4 px-5 pr-5 text-center no-print">
                        <Link
                          href={`/projects/${p.id}`}
                          className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-[#1a1a36] dark:hover:bg-[#252548] text-slate-600 dark:text-slate-300 text-[10px] font-black uppercase tracking-wider transition-colors inline-block cursor-pointer"
                        >
                          เปิด
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── PART 4: HORIZONTAL COMPARISON BAR CHART (Hidden in print) ── */}
      {filteredProjects.length > 0 && (
        <div className="card rounded-2xl p-6 border border-slate-200 dark:border-[#1c1c34] bg-white dark:bg-[#14142a] no-print shadow-sm">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-6 flex items-center gap-1.5">
            <TrendingUp size={15} />
            เปรียบเทียบความก้าวหน้าจริงสะสม (EV%) ของแต่ละโครงการ
          </h4>

          <div className="space-y-4 max-w-4xl">
            {filteredProjects.map((p) => {
              // Bar color matches status
              let barColor = 'bg-slate-400 dark:bg-slate-600'
              if (p.status === 'กำลังดำเนินการ') {
                barColor = p.SV < 0 ? 'bg-red-500' : 'bg-blue-500'
              } else if (p.status === 'เสร็จสิ้น') {
                barColor = 'bg-emerald-500'
              } else if (p.status === 'ระงับ') {
                barColor = 'bg-amber-500'
              }

              return (
                <div key={p.id} className="flex items-center gap-4">
                  <div className="w-1/4 text-xs font-black truncate text-slate-700 dark:text-slate-300" title={p.name}>
                    {p.name}
                  </div>
                  <div className="flex-1 bg-slate-100 dark:bg-[#1e1e38] h-6 rounded-lg overflow-hidden relative border border-slate-200/50 dark:border-[#252548]">
                    <div
                      className={`h-full rounded-lg transition-all duration-500 opacity-90 ${barColor}`}
                      style={{ width: `${Math.min(100, p.evCumulative)}%` }}
                    />
                    <span className="absolute inset-y-0 right-3 flex items-center text-[10px] font-mono font-black text-slate-600 dark:text-slate-300">
                      {p.evCumulative.toFixed(1)}% EV
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
