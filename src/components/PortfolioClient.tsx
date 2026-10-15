'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Folder, Printer, ArrowUpDown, TrendingUp, DollarSign, Calendar, AlertTriangle, CheckCircle, ExternalLink, ArrowUp, ArrowDown, ClipboardCheck, SlidersHorizontal, FileSpreadsheet, Layers, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react'
import type { Project, WBSTask, ProjectMilestone, PunchList, PunchItem, ContractAmendment } from '@/lib/types'
import * as XLSX from 'xlsx'

import { StatusDonutChart } from './portfolio/StatusDonutChart'
import { computeTaskDates, computeProjectExtension, countWorkingDays } from '@/lib/scheduler'
import type { UserSession } from '@/lib/auth'

interface Props {
  projects: Project[]
  tasks: WBSTask[]
  milestones: ProjectMilestone[]
  punchLists?: PunchList[]
  punchItems?: PunchItem[]
  
  amendments: ContractAmendment[]
  user?: UserSession | null
  workGroups?: string[]
  initialProjectOrder?: string[]
}

const ALL_STATUSES = [
  'ออกแบบ สำรวจ ประมาณการ',
  'จัดซื้อจัดจ้าง',
  'รอดำเนินการ',
  'กำลังดำเนินการ',
  'ระงับ',
  'เสร็จสิ้น',
] as const

type SortField = 'default' | 'name' | 'remaining' | 'ev' | 'sv'
type SortDir = 'asc' | 'desc'

export function PortfolioClient({ projects, tasks, milestones, amendments = [], punchLists = [], punchItems = [], user, workGroups = [], initialProjectOrder = [] }: Props) {
  const supervisorsList = useMemo(
    () => [...new Set(projects.flatMap((p) => (p.supervisor || '').split(',').map(s => s.trim()).filter(Boolean)))].sort(),
    [projects]
  )

  const allWorkGroupKeys = useMemo(() => ['', ...workGroups], [workGroups])

  // Checkbox status filter states - default to ALL checked
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([...ALL_STATUSES])
  const [selectedSupervisors, setSelectedSupervisors] = useState<string[]>(() =>
    [...new Set(projects.flatMap((p) => (p.supervisor || '').split(',').map(s => s.trim()).filter(Boolean)))].sort()
  )
  const [selectedWorkGroups, setSelectedWorkGroups] = useState<string[]>(() => ['', ...workGroups])

  const [supervisorOpen, setSupervisorOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [workGroupOpen, setWorkGroupOpen] = useState(false)

  // Sorting states: default to matching the main page order
  const [sortBy, setBy] = useState<SortField>('default')
  const [sortDir, setDir] = useState<SortDir>('asc')

  // Group collapse states
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})




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
      
      const projectAmendments = amendments.filter(a => a.project_id === p.id)
      const ext = computeProjectExtension(p, projectAmendments)
      
      if (start && end) {
        totalDays = ext.totalDays
        remainingDays = ext.daysRemaining
      }

      // Calculate EV and PV
      let pvCumulative = 0
      let evCumulative = 0

      if (projectTasks.length > 0) {
        const scheduledTasks = computeTaskDates(projectTasks, p.start_date, projectAmendments)
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
              const totalTaskTime = Math.max(1, countWorkingDays(tStart, tEnd, projectAmendments))
              const elapsedTaskTime = countWorkingDays(tStart, todayDateOnly, projectAmendments)
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
              const totalTaskTime = Math.max(1, countWorkingDays(tStart, tEnd, projectAmendments))
              const elapsedTaskTime = countWorkingDays(tStart, todayDateOnly, projectAmendments)
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
            const totalTaskTime = Math.max(1, countWorkingDays(start, end, projectAmendments))
            const elapsedTaskTime = countWorkingDays(start, todayDateOnly, projectAmendments)
            pvCumulative = (elapsedTaskTime / totalTaskTime) * 100
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

      // SPI and CPI calculation
      const SPI = pvCumulative > 0 ? evCumulative / pvCumulative : 1.0
      const CPI = acPercent > 0 ? evCumulative / acPercent : 1.0

      // EVM Traffic Light color:
      // 🟢 Green: SPI >= 1.0 and CPI >= 1.0 (on track or ahead)
      // 🔴 Red: SPI < 0.9 or CPI < 0.9 (critical delay or budget overrun)
      // 🟡 Yellow: Warning (one or both index is between 0.9 and 1.0)
      let trafficLight: 'green' | 'yellow' | 'red' = 'green'
      if (SPI < 0.9 || CPI < 0.9) {
        trafficLight = 'red'
      } else if (SPI < 1.0 || CPI < 1.0) {
        trafficLight = 'yellow'
      }

      return {
        ...p,
        pvCumulative,
        evCumulative,
        SV,
        CV,
        SPI,
        CPI,
        remainingDays,
        totalDays,
        totalMilestones,
        paidCount,
        acPercent,
        trafficLight,
      }
    })
  }, [projects, tasks, milestones, amendments])

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
    const allSupervisorsSelected = supervisorsList.length === 0 || selectedSupervisors.length === supervisorsList.length
    const allStatusesSelected = selectedStatuses.length === ALL_STATUSES.length
    const allWorkGroupsSelected = selectedWorkGroups.length === allWorkGroupKeys.length

    return computedProjects.filter((p) => {
      const pSupervisors = (p.supervisor || '').split(',').map(s => s.trim()).filter(Boolean)
      const matchSupervisor =
        allSupervisorsSelected ||
        (selectedSupervisors.length > 0 && pSupervisors.some((s) => selectedSupervisors.includes(s)))
      const matchStatus =
        allStatusesSelected ||
        selectedStatuses.includes(p.status)
      const pGroup = (p.work_group || '').trim()
      const isUnassigned = !pGroup || !workGroups.includes(pGroup)
      const matchWorkGroup =
        allWorkGroupsSelected ||
        (isUnassigned ? selectedWorkGroups.includes('') : selectedWorkGroups.includes(pGroup))
      return matchSupervisor && matchStatus && matchWorkGroup
    })
  }, [computedProjects, supervisorsList, selectedSupervisors, selectedStatuses, selectedWorkGroups, allWorkGroupKeys, workGroups])

  // Helper to sort a list of projects based on current sort settings
  const sortProjectList = (list: typeof computedProjects) => {
    return [...list].sort((a, b) => {
      if (sortBy === 'default') {
        const idxA = (initialProjectOrder || []).indexOf(a.id)
        const idxB = (initialProjectOrder || []).indexOf(b.id)
        if (idxA !== -1 && idxB !== -1) return idxA - idxB
        if (idxA !== -1) return -1
        if (idxB !== -1) return 1
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }

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
  }

  // 3. Group projects by work groups matching the main page order
  const groupedSections = useMemo(() => {
    const sections: {
      groupName: string
      isSpecial?: boolean
      projects: typeof computedProjects
      totalBudget: number
      totalEVWeighted: number
      totalPVWeighted: number
      avgProgress: number
      totalAC: number
    }[] = []

    // Defined work groups in order from system_settings
    workGroups.forEach((wg) => {
      const groupProjs = filteredProjects.filter(p => (p.work_group || '').trim() === wg.trim())
      if (groupProjs.length > 0) {
        const sorted = sortProjectList(groupProjs)
        const totalBudget = sorted.reduce((sum, p) => sum + (p.budget || 0), 0)
        const totalEVWeighted = sorted.reduce((sum, p) => sum + (p.evCumulative * (p.budget || 0)), 0)
        const totalPVWeighted = sorted.reduce((sum, p) => sum + (p.pvCumulative * (p.budget || 0)), 0)
        const totalAC = sorted.reduce((sum, p) => sum + ((p.acPercent / 100) * (p.budget || 0)), 0)
        const avgProgress = totalBudget > 0 ? Math.round((totalEVWeighted / totalBudget) * 10) / 10 : 0

        sections.push({
          groupName: wg,
          projects: sorted,
          totalBudget,
          totalEVWeighted,
          totalPVWeighted,
          avgProgress,
          totalAC,
        })
      }
    })

    // Unassigned or other work groups not in workGroups
    const unassignedProjs = filteredProjects.filter(
      p => !p.work_group || !workGroups.some(wg => wg.trim() === (p.work_group || '').trim())
    )
    if (unassignedProjs.length > 0) {
      const sorted = sortProjectList(unassignedProjs)
      const totalBudget = sorted.reduce((sum, p) => sum + (p.budget || 0), 0)
      const totalEVWeighted = sorted.reduce((sum, p) => sum + (p.evCumulative * (p.budget || 0)), 0)
      const totalPVWeighted = sorted.reduce((sum, p) => sum + (p.pvCumulative * (p.budget || 0)), 0)
      const totalAC = sorted.reduce((sum, p) => sum + ((p.acPercent / 100) * (p.budget || 0)), 0)
      const avgProgress = totalBudget > 0 ? Math.round((totalEVWeighted / totalBudget) * 10) / 10 : 0

      sections.push({
        groupName: 'หมวดงานอื่นๆ / ไม่ระบุกลุ่มงาน',
        isSpecial: true,
        projects: sorted,
        totalBudget,
        totalEVWeighted,
        totalPVWeighted,
        avgProgress,
        totalAC,
      })
    }

    return sections
  }, [filteredProjects, workGroups, sortBy, sortDir, initialProjectOrder])

  // Flat list of sorted projects across all groups for easy export / stats
  const allGroupedProjects = useMemo(() => {
    return groupedSections.flatMap(s => s.projects)
  }, [groupedSections])

  // 4. Calculate Portfolio Summary Cards KPIs
  const summaryKpis = useMemo(() => {
    const totalBudget = filteredProjects.reduce((sum, p) => sum + (p.budget || 0), 0)
    const totalEVWeighted = filteredProjects.reduce((sum, p) => sum + (p.evCumulative * (p.budget || 0)), 0)
    const totalPVWeighted = filteredProjects.reduce((sum, p) => sum + (p.pvCumulative * (p.budget || 0)), 0)
    const totalAC = filteredProjects.reduce((sum, p) => sum + ((p.acPercent / 100) * (p.budget || 0)), 0)

    const averageEV = totalBudget > 0 ? totalEVWeighted / totalBudget : 0
    const averagePV = totalBudget > 0 ? totalPVWeighted / totalBudget : 0

    const totalEV = totalEVWeighted / 100
    const totalPV = totalPVWeighted / 100

    const lateCount = filteredProjects.filter((p) => p.SV < 0).length
    const doneCount = filteredProjects.filter((p) => p.status === 'เสร็จสิ้น').length

    return {
      totalBudget,
      averageEV,
      averagePV,
      totalPV,
      totalEV,
      totalAC,
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

  const handleExportExcel = () => {
    const dataForExcel = allGroupedProjects.map((p) => {
      let statusText = 'ปกติ'
      let statusRemark = ''
      if (p.SV < 0 && p.SV >= -5) {
        statusText = 'เฝ้าระวัง'
        statusRemark = `ล่าช้า ${Math.abs(p.SV).toFixed(2)}%`
      } else if (p.SV < -5) {
        statusText = 'วิกฤต'
        statusRemark = `ล่าช้า ${Math.abs(p.SV).toFixed(2)}%`
      }

      const budget = p.budget || 0
      
      return {
        'กลุ่มงาน': p.work_group || 'ไม่ระบุกลุ่มงาน',
        'ชื่อโครงการ': p.name,
        'สถานะ': statusText,
        'หมายเหตุ': statusRemark,
        'วันคงเหลือ (วัน)': p.remainingDays,
        'แผนงาน (%)': Number(p.pvCumulative.toFixed(2)),
        'ผลงาน (%)': Number(p.evCumulative.toFixed(2)),
        'SV (%)': Number(p.SV.toFixed(2)),
        'SPI': Number(p.SPI.toFixed(2)),
        'CV (%)': Number(p.CV.toFixed(2)),
        'CPI': Number(p.CPI.toFixed(2)),
        'งบรวม (บาท)': budget,
        'การเบิกจ่าย (บาท)': p.paid_amount || 0
      }
    })

    const worksheet = XLSX.utils.json_to_sheet(dataForExcel)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Projects')
    XLSX.writeFile(workbook, `ภาพรวมโครงการ_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      if (sortDir === 'asc') {
        setDir('desc')
      } else {
        setBy('default')
        setDir('asc')
      }
    } else {
      setBy(field)
      setDir(field === 'sv' || field === 'name' ? 'asc' : 'desc')
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
          
          /* --- PRESERVE COLORED COMPONENT BACKGROUNDS (USING TAG NESTING FOR SPECIFFICITY) --- */
          
          /* Progress track container - Force White background */
          td div > div.relative,
          td div > div.w-full {
            background-color: #ffffff !important;
            background: #ffffff !important;
            border: 1px solid #cbd5e1 !important;
          }
          
          /* PV bar (Planned Value) - light gray */
          td div > div.relative > div:first-child {
            background-color: #cbd5e1 !important;
            background: #cbd5e1 !important;
          }
          
          /* EV bar (Earned Value) - solid purple */
          td div > div.relative > div:last-child {
            background-color: #7e22ce !important;
            background: #7e22ce !important;
          }
          
          /* Payment progress fill */
          td div > div.w-full > div {
            background-color: #10b981 !important;
            background: #10b981 !important;
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
          .bg-red-500\\/10 {
            background-color: #fef2f2 !important;
            color: #dc2626 !important;
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
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Supervisor Multi-Select */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setSupervisorOpen(!supervisorOpen)
                setStatusOpen(false)
                setWorkGroupOpen(false)
              }}
              className="input-base font-semibold text-xs min-w-56 text-left flex items-center justify-between pr-8 cursor-pointer relative"
              style={{ paddingLeft: "2.5rem" }}
            >
              <SlidersHorizontal
                size={14}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-600 pointer-events-none"
              />
              <span className="truncate">
                {selectedSupervisors.length === supervisorsList.length
                  ? "ผู้ควบคุมทั้งหมด"
                  : selectedSupervisors.length === 0
                  ? "ไม่ได้เลือกผู้ควบคุม"
                  : `ผู้ควบคุม (${selectedSupervisors.length} คน)`}
              </span>
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">▼</span>
            </button>
            
            {supervisorOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setSupervisorOpen(false)} />
                <div className="absolute left-0 mt-1.5 w-64 bg-white dark:bg-[#13132a] border border-slate-200 dark:border-[#252548] rounded-xl shadow-xl z-20 p-3 max-h-60 overflow-y-auto animate-scale-in">
                  <div className="flex justify-between items-center pb-2 mb-2 border-b border-slate-100 dark:border-[#1e1e38]">
                    <span className="text-[10px] font-black uppercase text-slate-400">เลือกผู้ควบคุม</span>
                    {selectedSupervisors.length === supervisorsList.length ? (
                      <button
                        type="button"
                        onClick={() => setSelectedSupervisors([])}
                        className="text-[10px] font-bold text-red-500 hover:underline cursor-pointer"
                      >
                        ล้างค่า
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSelectedSupervisors([...supervisorsList])}
                        className="text-[10px] font-bold text-primary-600 dark:text-primary-400 hover:underline cursor-pointer"
                      >
                        เลือกทั้งหมด
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {supervisorsList.map((s) => {
                      const checked = selectedSupervisors.includes(s)
                      return (
                        <label key={s} className="flex items-center gap-2 text-xs font-semibold cursor-pointer select-none text-slate-700 dark:text-slate-300">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedSupervisors([...selectedSupervisors, s])
                              } else {
                                setSelectedSupervisors(selectedSupervisors.filter(x => x !== s))
                              }
                            }}
                            className="w-4 h-4 rounded text-primary-600 border-slate-300 dark:border-slate-700 focus:ring-primary-500 cursor-pointer"
                          />
                          <span className="truncate">{s}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Status Multi-Select */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setStatusOpen(!statusOpen)
                setSupervisorOpen(false)
                setWorkGroupOpen(false)
              }}
              className="input-base font-semibold text-xs min-w-48 text-left flex items-center justify-between pr-8 cursor-pointer relative"
              style={{ paddingLeft: "2.5rem" }}
            >
              <SlidersHorizontal
                size={14}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-600 pointer-events-none"
              />
              <span className="truncate">
                {selectedStatuses.length === ALL_STATUSES.length
                  ? "สถานะทั้งหมด"
                  : selectedStatuses.length === 0
                  ? "ไม่ได้เลือกสถานะ"
                  : `สถานะ (${selectedStatuses.length})`}
              </span>
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">▼</span>
            </button>
            
            {statusOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setStatusOpen(false)} />
                <div className="absolute left-0 mt-1.5 w-56 bg-white dark:bg-[#13132a] border border-slate-200 dark:border-[#252548] rounded-xl shadow-xl z-20 p-3 max-h-60 overflow-y-auto animate-scale-in">
                  <div className="flex justify-between items-center pb-2 mb-2 border-b border-slate-100 dark:border-[#1e1e38]">
                    <span className="text-[10px] font-black uppercase text-slate-400">เลือกสถานะ</span>
                    {selectedStatuses.length === ALL_STATUSES.length ? (
                      <button
                        type="button"
                        onClick={() => setSelectedStatuses([])}
                        className="text-[10px] font-bold text-red-500 hover:underline cursor-pointer"
                      >
                        ล้างค่า
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSelectedStatuses([...ALL_STATUSES])}
                        className="text-[10px] font-bold text-primary-600 dark:text-primary-400 hover:underline cursor-pointer"
                      >
                        เลือกทั้งหมด
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {ALL_STATUSES.map((st) => {
                      const checked = selectedStatuses.includes(st)
                      return (
                        <label key={st} className="flex items-center gap-2 text-xs font-semibold cursor-pointer select-none text-slate-700 dark:text-slate-300">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedStatuses([...selectedStatuses, st])
                              } else {
                                setSelectedStatuses(selectedStatuses.filter(x => x !== st))
                              }
                            }}
                            className="w-4 h-4 rounded text-primary-600 border-slate-300 dark:border-slate-700 focus:ring-primary-500 cursor-pointer"
                          />
                          <span>{st}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Work Group Multi-Select */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setWorkGroupOpen(!workGroupOpen)
                setSupervisorOpen(false)
                setStatusOpen(false)
              }}
              className="input-base font-semibold text-xs min-w-48 text-left flex items-center justify-between pr-8 cursor-pointer relative"
              style={{ paddingLeft: "2.5rem" }}
            >
              <SlidersHorizontal
                size={14}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-600 pointer-events-none"
              />
              <span className="truncate">
                {selectedWorkGroups.length === allWorkGroupKeys.length
                  ? "กลุ่มงานทั้งหมด"
                  : selectedWorkGroups.length === 0
                  ? "ไม่ได้เลือกกลุ่มงาน"
                  : `กลุ่มงาน (${selectedWorkGroups.length})`}
              </span>
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">▼</span>
            </button>
            
            {workGroupOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setWorkGroupOpen(false)} />
                <div className="absolute left-0 mt-1.5 w-56 bg-white dark:bg-[#13132a] border border-slate-200 dark:border-[#252548] rounded-xl shadow-xl z-20 p-3 max-h-60 overflow-y-auto animate-scale-in">
                  <div className="flex justify-between items-center pb-2 mb-2 border-b border-slate-100 dark:border-[#1e1e38]">
                    <span className="text-[10px] font-black uppercase text-slate-400">เลือกกลุ่มงาน</span>
                    {selectedWorkGroups.length === allWorkGroupKeys.length ? (
                      <button
                        type="button"
                        onClick={() => setSelectedWorkGroups([])}
                        className="text-[10px] font-bold text-red-500 hover:underline cursor-pointer"
                      >
                        ล้างค่า
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSelectedWorkGroups([...allWorkGroupKeys])}
                        className="text-[10px] font-bold text-primary-600 dark:text-primary-400 hover:underline cursor-pointer"
                      >
                        เลือกทั้งหมด
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {/* Unassigned Work Group */}
                    <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer select-none text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={selectedWorkGroups.includes('')}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedWorkGroups([...selectedWorkGroups, ''])
                          } else {
                            setSelectedWorkGroups(selectedWorkGroups.filter(x => x !== ''))
                          }
                        }}
                        className="w-4 h-4 rounded text-primary-600 border-slate-300 dark:border-slate-700 focus:ring-primary-500 cursor-pointer"
                      />
                      <span className="italic">ไม่ระบุกลุ่มงาน</span>
                    </label>

                    {workGroups.map((wg) => {
                      const checked = selectedWorkGroups.includes(wg)
                      return (
                        <label key={wg} className="flex items-center gap-2 text-xs font-semibold cursor-pointer select-none text-slate-700 dark:text-slate-300">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedWorkGroups([...selectedWorkGroups, wg])
                              } else {
                                setSelectedWorkGroups(selectedWorkGroups.filter(x => x !== wg))
                              }
                            }}
                            className="w-4 h-4 rounded text-primary-600 border-slate-300 dark:border-slate-700 focus:ring-primary-500 cursor-pointer"
                          />
                          <span>{wg}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="btn-secondary px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border-slate-200 cursor-pointer text-emerald-600 dark:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 hover:border-emerald-200 dark:hover:border-emerald-500/30"
            >
              <FileSpreadsheet size={14} /> 📊 ส่งออก Excel
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

        {/* average Progress */}
        <div className="card rounded-2xl p-5 border border-slate-200 dark:border-[#1c1c34] flex items-center gap-4 bg-white dark:bg-[#14142a] print:card">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center print:hidden flex-shrink-0">
            <TrendingUp size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">เฉลี่ยความก้าวหน้าโครงการ</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-lg font-black text-purple-600 dark:text-purple-400">
                EV {summaryKpis.averageEV.toFixed(1)}%
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500 font-bold">
                (แผน PV {summaryKpis.averagePV.toFixed(1)}%)
              </span>
            </div>
            <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 mt-1">
              ดัชนีแผนงานเฉลี่ย (SPI) = {(summaryKpis.averagePV > 0 ? summaryKpis.averageEV / summaryKpis.averagePV : 1).toFixed(2)}
            </p>
          </div>
        </div>

        {/* EVM values */}
        <div className="card rounded-2xl p-5 border border-slate-200 dark:border-[#1c1c34] flex items-center gap-4 bg-white dark:bg-[#14142a] print:card col-span-1">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center print:hidden flex-shrink-0">
            <ClipboardCheck size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">วิเคราะห์มูลค่าสะสม (EVM)</p>
            <div className="grid grid-cols-3 gap-1.5 mt-1.5 text-[9px] font-bold">
              <div className="bg-slate-50 dark:bg-[#1a1a32] p-1.5 rounded border border-slate-100 dark:border-[#252548] min-w-0">
                <span className="text-slate-400 truncate block">PV แผน</span>
                <p className="font-black text-slate-700 dark:text-slate-300 font-mono mt-0.5 truncate">{formatBudget(summaryKpis.totalPV)}</p>
              </div>
              <div className="bg-slate-50 dark:bg-[#1a1a32] p-1.5 rounded border border-slate-100 dark:border-[#252548] min-w-0">
                <span className="text-purple-600 truncate block">EV ผลงาน</span>
                <p className="font-black text-purple-600 font-mono mt-0.5 truncate">{formatBudget(summaryKpis.totalEV)}</p>
              </div>
              <div className="bg-slate-50 dark:bg-[#1a1a32] p-1.5 rounded border border-slate-100 dark:border-[#252548] min-w-0">
                <span className="text-amber-600 truncate block">AC จ่ายจริง</span>
                <p className="font-black text-amber-500 font-mono mt-0.5 truncate">{formatBudget(summaryKpis.totalAC)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Project Status Summary */}
        <div className="card rounded-2xl p-5 border border-slate-200 dark:border-[#1c1c34] flex items-center gap-4 bg-white dark:bg-[#14142a] print:card">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center print:hidden flex-shrink-0">
            <AlertTriangle size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">สถานะสุขภาพโครงการ</p>
            <div className="flex items-center gap-4 mt-2">
              <div>
                <span className="text-[10px] text-slate-400">เสร็จสิ้น</span>
                <p className="text-base font-black text-emerald-600">{summaryKpis.doneCount} โครงการ</p>
              </div>
              <div className="w-px h-6 bg-slate-200 dark:bg-[#252548]" />
              <div>
                <span className="text-[10px] text-slate-400">ล่าช้ากว่าแผน</span>
                <p className="text-base font-black text-red-500">{summaryKpis.lateCount} โครงการ</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── PART 2.2: PORTFOLIO CHARTS (Hidden in print) ── */}
      <div className="no-print">
        <StatusDonutChart data={filteredProjects} workGroups={workGroups} />
      </div>



      {/* ── PART 3: COMPARISON TABLES (GROUPED BY WORK GROUPS) ── */}
      <div className="space-y-6">
        {/* Section Header Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-[#14142a] border border-slate-200 dark:border-[#1c1c34] shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary-50 dark:bg-primary-950/50 text-primary-600 dark:text-primary-400 flex items-center justify-center">
              <Layers size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  ตารางเปรียบเทียบทุกโครงการ
                </h3>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-primary-100/70 dark:bg-primary-950/70 text-primary-700 dark:text-primary-300">
                  แยกตามกลุ่มงาน ({groupedSections.length} กลุ่ม, {filteredProjects.length} โครงการ)
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                จัดหมวดหมู่และลำดับโครงการตามหน้าหลัก
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap no-print">
            {/* Sorting indicator / Reset button */}
            {sortBy !== 'default' && (
              <button
                type="button"
                onClick={() => {
                  setBy('default')
                  setDir('asc')
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60 hover:bg-amber-100 transition-colors cursor-pointer"
                title="คลิกเพื่อคืนค่าการจัดเรียงตามลำดับหน้าหลัก"
              >
                <RotateCcw size={12} />
                <span>
                  เรียงตาม: {sortBy === 'name' ? 'ชื่อโครงการ' : sortBy === 'remaining' ? 'วันคงเหลือ' : sortBy === 'ev' ? 'ผลงาน' : 'SV'} ({sortDir === 'asc' ? 'น้อยไปมาก' : 'มากไปน้อย'}) — <u>คืนค่าหน้าหลัก</u>
                </span>
              </button>
            )}

            {/* Expand / Collapse All buttons */}
            {groupedSections.length > 1 && (
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#1a1a36] p-1 rounded-xl border border-slate-200 dark:border-[#252548]">
                <button
                  type="button"
                  onClick={() => setCollapsedGroups({})}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-[#252548] transition-colors cursor-pointer"
                >
                  ขยายทั้งหมด
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const allCol: Record<string, boolean> = {}
                    groupedSections.forEach(s => { allCol[s.groupName] = true })
                    setCollapsedGroups(allCol)
                  }}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-[#252548] transition-colors cursor-pointer"
                >
                  ยุบทั้งหมด
                </button>
              </div>
            )}
          </div>
        </div>

        {groupedSections.length === 0 ? (
          <div className="card rounded-2xl border border-slate-200 dark:border-[#1c1c34] bg-white dark:bg-[#14142a] p-12 text-center shadow-sm">
            <Folder size={40} className="mx-auto text-slate-300 dark:text-slate-700 mb-4" />
            <p className="text-sm font-bold text-slate-500">ไม่พบโครงการตรงตามเงื่อนไขตัวกรอง</p>
          </div>
        ) : (
          groupedSections.map((section, sIdx) => {
            const isCollapsed = !!collapsedGroups[section.groupName]
            return (
              <div key={section.groupName} className="space-y-2.5 [page-break-inside:avoid]">
                {/* Group Header Card */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 sm:px-5 sm:py-3.5 rounded-2xl bg-white dark:bg-[#141428] border border-slate-200/90 dark:border-[#252548] shadow-xs">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="w-8 h-8 rounded-xl bg-primary-600 text-white font-black text-sm flex items-center justify-center shadow-xs">
                      {section.isSpecial ? '★' : sIdx + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                          {section.groupName}
                        </h2>
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-primary-50 dark:bg-primary-950/50 text-primary-700 dark:text-primary-300 border border-primary-200/60 dark:border-primary-800/40">
                          {section.projects.length} โครงการ
                        </span>
                        {section.totalBudget > 0 && (
                          <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40">
                            งบรวม {formatBudget(section.totalBudget)}
                          </span>
                        )}
                        {section.projects.length > 0 && (
                          <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/40">
                            ความก้าวหน้าเฉลี่ย {section.avgProgress}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setCollapsedGroups(prev => ({ ...prev, [section.groupName]: !isCollapsed }))}
                    className="p-1.5 px-3 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1f1f3a] transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold no-print"
                    title={isCollapsed ? 'แสดงตาราง' : 'ซ่อนตาราง'}
                  >
                    <span className="text-[11px]">{isCollapsed ? 'แสดงตาราง' : 'ซ่อนตาราง'}</span>
                    {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                  </button>
                </div>

                {/* Group Table Card */}
                {!isCollapsed && (
                  <div className="card rounded-2xl border border-slate-200 dark:border-[#1c1c34] bg-white dark:bg-[#14142a] overflow-hidden print:overflow-visible print:border-none print:shadow-none print:card shadow-sm">
                    <div className="overflow-x-auto w-full print:overflow-visible pb-1">
                      <table className="w-full table-fixed text-left border-collapse min-w-[1280px] print:min-w-0 print:text-[10px] print-safe-table">
                        <PortfolioTableHeader sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                        <tbody className="text-xs font-bold text-slate-700 dark:text-slate-300 print:border-slate-300">
                          {section.projects.map((p) => (
                            <PortfolioTableRow key={p.id} p={p} formatBudget={formatBudget} />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>




    </div>
  )
}

function PortfolioTableHeader({
  sortBy,
  sortDir,
  onSort,
}: {
  sortBy: SortField
  sortDir: SortDir
  onSort: (field: SortField) => void
}) {
  return (
    <thead>
      <tr className="border-b border-slate-100 dark:border-[#1c1c34] bg-slate-50/50 dark:bg-[#1b1b36]/30 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider print:bg-transparent print:text-[9px]">
        {/* traffic light indicator empty label */}
        <th className="py-4 pl-4 pr-1 w-8 text-center"></th>
        <th className="py-4 px-3 w-[460px] min-w-[420px] cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-300" onClick={() => onSort('name')}>
          ชื่อโครงการ {sortBy === 'name' ? (sortDir === 'asc' ? '▲' : '▼') : <ArrowUpDown size={10} className="inline ml-1" />}
        </th>
        <th className="py-4 px-3 w-36 min-w-[140px] whitespace-nowrap">สถานะ</th>
        <th className="py-4 px-3 w-24 min-w-[85px] whitespace-nowrap cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-300" onClick={() => onSort('remaining')}>
          วันคงเหลือ {sortBy === 'remaining' ? (sortDir === 'asc' ? '▲' : '▼') : <ArrowUpDown size={10} className="inline ml-1" />}
        </th>
        <th className="py-4 px-3 w-32 min-w-[115px] cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-300" onClick={() => onSort('ev')}>
          <div className="flex flex-wrap items-center gap-1.5">
            <span>ความก้าวหน้า {sortBy === 'ev' ? (sortDir === 'asc' ? '▲' : '▼') : <ArrowUpDown size={10} className="inline ml-1 flex-shrink-0" />}</span>
          </div>
        </th>
        <th className="py-4 px-3 w-20 min-w-[75px] whitespace-nowrap cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-300" onClick={() => onSort('sv')}>
          SV {sortBy === 'sv' ? (sortDir === 'asc' ? '▲' : '▼') : <ArrowUpDown size={10} className="inline ml-1" />}
        </th>
        <th className="py-4 px-3 w-14 min-w-[50px] whitespace-nowrap">SPI</th>
        <th className="py-4 px-3 w-14 min-w-[55px] hidden md:table-cell print:table-cell whitespace-nowrap">CV</th>
        <th className="py-4 px-3 w-14 min-w-[50px] hidden md:table-cell print:table-cell whitespace-nowrap">CPI</th>
        <th className="py-4 px-3 w-20 min-w-[75px] hidden md:table-cell print:table-cell whitespace-nowrap">งบรวม</th>
        <th className="py-4 px-3 w-28 min-w-[110px] hidden md:table-cell print:table-cell">การจ่ายเงิน (% Paid)</th>
        <th className="py-4 px-3 w-14 min-w-[50px] text-center no-print">เปิด</th>
      </tr>
    </thead>
  )
}

function PortfolioTableRow({
  p,
  formatBudget,
}: {
  p: any
  formatBudget: (amount: number) => string
}) {
  const svIcon = p.SV >= 0 ? <ArrowUp size={12} className="text-emerald-500 inline mr-0.5 flex-shrink-0" /> : <ArrowDown size={12} className="text-red-500 inline mr-0.5 flex-shrink-0" />
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
    <tr className="border-b border-slate-100 dark:border-[#1c1c34] print:border-slate-300 hover:bg-slate-50/50 dark:hover:bg-[#1a1a36]/10 print:hover:bg-transparent [page-break-inside:avoid]">
      {/* Traffic Light Dot Column */}
      <td className="py-4 pl-4 pr-1 text-center">
        <div className={`w-3 h-3 rounded-full ${trafficLightDot}`} title={
          p.trafficLight === 'red' ? 'วิกฤต (SPI หรือ CPI ต่ำกว่า 0.90)' :
          p.trafficLight === 'yellow' ? 'เฝ้าระวัง (SPI หรือ CPI ต่ำกว่า 1.00)' :
          'ปกติ (ดัชนีชี้วัดแผนงานและงบประมาณราบรื่น >= 1.00)'
        } />
      </td>

      {/* Project Name - Full display, guaranteed no truncation or awkward wrapping */}
      <td className="py-4 px-3 whitespace-nowrap" title={p.name}>
        <Link href={`/projects/${p.id}`} className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors inline-flex items-center gap-1.5 font-bold whitespace-nowrap">
          <span>{p.name}</span>
          <ExternalLink size={10} className="text-slate-400 print:hidden flex-shrink-0" />
        </Link>
      </td>

      {/* Status */}
      <td className="py-4 px-3 whitespace-nowrap">
        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider whitespace-nowrap ${statusCls}`}>
          {p.status}
        </span>
      </td>

      {/* Remaining Days */}
      <td className="py-4 px-3 whitespace-nowrap">
        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider whitespace-nowrap ${remainingCls}`}>
          {remainingText}
        </span>
      </td>

      {/* Stacked Progress Bar (PV and EV in separate tracks) */}
      <td className="py-3 px-3 pr-4">
        <div className="flex flex-col gap-1 w-full min-w-[100px]">
          {/* PV Bar (Planned) */}
          <div className="flex items-center gap-1.5">
            <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 w-4 tracking-wider">PV</span>
            <div className="relative flex-1 h-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-full overflow-hidden border border-slate-200/50 dark:border-[#252548]/30">
              <div
                className="absolute top-0 bottom-0 left-0 bg-slate-400 dark:bg-slate-500 rounded-full"
                style={{ width: `${Math.min(100, p.pvCumulative)}%` }}
              />
            </div>
            <span className="text-[9px] font-mono text-slate-500 dark:text-slate-400 w-7 text-right">{p.pvCumulative.toFixed(0)}%</span>
          </div>
          {/* EV Bar (Actual) */}
          <div className="flex items-center gap-1.5">
            <span className="text-[8px] font-bold text-purple-600 dark:text-purple-400 w-4 tracking-wider">EV</span>
            <div className="relative flex-1 h-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-full overflow-hidden border border-slate-200/50 dark:border-[#252548]/30">
              <div
                className="absolute top-0 bottom-0 left-0 bg-purple-600 dark:bg-purple-500 rounded-full"
                style={{ width: `${Math.min(100, p.evCumulative)}%` }}
              />
            </div>
            <span className="text-[9px] font-mono text-purple-600 dark:text-purple-400 w-7 text-right">{p.evCumulative.toFixed(0)}%</span>
          </div>
        </div>
      </td>

      {/* SV */}
      <td className="py-4 px-3 font-mono whitespace-nowrap">
        <span className={`inline-flex items-center whitespace-nowrap ${p.SV >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
          {svIcon}
          <span>{p.SV >= 0 ? '+' : ''}{p.SV.toFixed(1)}%</span>
        </span>
      </td>

      {/* SPI */}
      <td className="py-4 px-3 font-mono whitespace-nowrap">
        <span className={`px-2 py-0.5 rounded text-[10px] font-black tracking-wider whitespace-nowrap ${
          p.SPI >= 1.0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' :
          p.SPI >= 0.9 ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20' :
          'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
        }`}>
          {p.SPI.toFixed(2)}
        </span>
      </td>

      {/* CV */}
      <td className={`py-4 px-3 font-mono whitespace-nowrap hidden md:table-cell print:table-cell ${cvColor}`}>
        {p.CV >= 0 ? '+' : ''}{p.CV.toFixed(1)}%
      </td>

      {/* CPI */}
      <td className="py-4 px-3 font-mono whitespace-nowrap hidden md:table-cell print:table-cell">
        <span className={`px-2 py-0.5 rounded text-[10px] font-black tracking-wider whitespace-nowrap ${
          p.CPI >= 1.0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' :
          p.CPI >= 0.9 ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20' :
          'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
        }`}>
          {p.CPI.toFixed(2)}
        </span>
      </td>

      {/* Budget */}
      <td className="py-4 px-3 hidden md:table-cell print:table-cell font-mono whitespace-nowrap text-slate-600 dark:text-slate-400">
        {formatBudget(p.budget || 0)}
      </td>

      {/* Milestones Paid Progress Bar */}
      <td className="py-4 px-3 hidden md:table-cell print:table-cell">
        <div className="space-y-1 w-full min-w-[100px]">
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
      <td className="py-4 px-3 text-center no-print">
        <Link
          href={`/projects/${p.id}`}
          className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-[#1a1a36] dark:hover:bg-[#252548] text-slate-600 dark:text-slate-300 text-[10px] font-black uppercase tracking-wider transition-colors inline-block cursor-pointer"
        >
          เปิด
        </Link>
      </td>
    </tr>
  )
}
