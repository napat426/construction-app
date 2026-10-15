'use client'

import React, { useMemo, useState, useEffect, useRef } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
} from 'recharts'
import type { ProjectMilestone, Project } from '@/lib/types'
import {
  Calendar,
  Filter,
  EyeOff,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock,
  LayoutGrid,
  BarChart3,
  CalendarDays,
  FileCheck2,
  Search,
} from 'lucide-react'

interface PaymentForecastChartProps {
  milestones: ProjectMilestone[]
  projects: Project[]
  exVatEnabled?: boolean
}

// Clean and reusable dropdown component for metadata filtering
function FilterDropdown({
  label,
  options,
  selected,
  onChange,
}: {
  label: string
  options: string[]
  selected: string[]
  onChange: (value: string[]) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: any) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleToggle = (opt: string) => {
    const next = selected.includes(opt)
      ? selected.filter((x) => x !== opt)
      : [...selected, opt]
    onChange(next)
  }

  const isAllSelected = selected.length === options.length

  const handleToggleAll = () => {
    if (isAllSelected) {
      onChange([])
    } else {
      onChange(options)
    }
  }

  return (
    <div className="relative flex flex-col gap-1.5" ref={dropdownRef}>
      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</span>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#252548] bg-white dark:bg-[#1e1e38] text-slate-700 dark:text-slate-300 flex items-center justify-between min-w-[130px] md:min-w-[155px] hover:border-slate-300 dark:hover:border-slate-600 transition-colors cursor-pointer select-none font-bold"
      >
        <span>
          {selected.length === 0
            ? 'ปิดทั้งหมด'
            : selected.length === options.length
            ? 'ทั้งหมด'
            : `${selected.length} รายการ`}
        </span>
        <span className="ml-1 text-[8px] text-slate-400">▼</span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white dark:bg-[#121228] border border-slate-200 dark:border-[#252548] rounded-xl shadow-xl z-30 py-2 min-w-[200px] max-h-60 overflow-y-auto">
          <div className="px-3 py-1.5 border-b border-slate-100 dark:border-[#252548] flex justify-between items-center mb-1">
            <button
              type="button"
              onClick={handleToggleAll}
              className="text-[10px] font-bold text-blue-500 hover:underline cursor-pointer"
            >
              {isAllSelected ? 'เคลียร์ทั้งหมด' : 'เลือกทั้งหมด'}
            </button>
          </div>
          {options.map((opt) => {
            const isChecked = selected.includes(opt)
            return (
              <label
                key={opt}
                className="px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-[#1e1e38] flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => handleToggle(opt)}
                  className="rounded border-slate-300 dark:border-[#252548] text-primary-600 focus:ring-primary-500 w-3.5 h-3.5"
                />
                <span className="truncate">{opt}</span>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Specialized Project Filter Dropdown with wide layout, search input, and full name visibility
function ProjectFilterDropdown({
  options,
  selected,
  onChange,
}: {
  options: string[]
  selected: string[]
  onChange: (value: string[]) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: any) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleToggle = (opt: string) => {
    const next = selected.includes(opt)
      ? selected.filter((x) => x !== opt)
      : [...selected, opt]
    onChange(next)
  }

  const isAllSelected = selected.length === options.length && options.length > 0

  const handleSelectAll = () => onChange(options)
  const handleClearAll = () => onChange([])

  const filteredOptions = options.filter((opt) =>
    opt.toLowerCase().includes(search.toLowerCase())
  )

  const buttonText = useMemo(() => {
    if (options.length === 0) return 'ไม่มีโครงการ'
    if (selected.length === 0) return 'ไม่ได้เลือกโครงการ (0)'
    if (selected.length === options.length) return `ทั้งหมด (${options.length} โครงการ)`
    if (selected.length === 1) return selected[0]
    return `เลือก ${selected.length} จาก ${options.length} โครงการ`
  }, [selected, options])

  return (
    <div className="relative flex flex-col gap-1.5" ref={dropdownRef}>
      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
        โครงการ
        <span className="text-[9px] font-semibold text-primary-600 dark:text-primary-400">
          ({selected.length}/{options.length})
        </span>
      </span>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title={buttonText}
        className={`text-xs px-3.5 py-1.5 rounded-lg border transition-colors cursor-pointer select-none font-bold flex items-center justify-between min-w-[200px] sm:min-w-[240px] md:min-w-[280px] max-w-[340px] shadow-2xs ${
          selected.length === 0
            ? 'border-rose-300 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400'
            : 'border-slate-200 dark:border-[#252548] bg-white dark:bg-[#1e1e38] text-slate-700 dark:text-slate-200 hover:border-primary-400 dark:hover:border-primary-500'
        }`}
      >
        <span className="truncate pr-2 text-left">{buttonText}</span>
        <span className="ml-1 text-[8px] text-slate-400 shrink-0">▼</span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white dark:bg-[#121228] border border-slate-200 dark:border-[#252548] rounded-xl shadow-2xl z-40 py-2.5 w-[330px] sm:w-[440px] md:w-[500px] max-w-[92vw]">
          {/* Header & Quick Action Buttons */}
          <div className="px-3.5 pb-2 border-b border-slate-100 dark:border-[#252548] flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              เลือกโครงการ ({selected.length}/{options.length})
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-[11px] font-bold text-primary-600 hover:underline cursor-pointer"
              >
                เลือกทั้งหมด
              </button>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <button
                type="button"
                onClick={handleClearAll}
                className="text-[11px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:underline cursor-pointer"
              >
                ล้างทั้งหมด
              </button>
            </div>
          </div>

          {/* Search box if options > 2 */}
          {options.length > 2 && (
            <div className="p-2 border-b border-slate-100 dark:border-[#252548]">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ค้นหาชื่อโครงการ..."
                  className="w-full text-xs pl-8 pr-7 py-1.5 rounded-lg border border-slate-200 dark:border-[#252548] bg-slate-50 dark:bg-[#1a1a36] text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-primary-500 font-medium"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Options List with Checkboxes and Full Project Names */}
          <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-[#1c1c38] py-1">
            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400 italic">
                ไม่พบชื่อโครงการที่ตรงกับคำค้นหา
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isChecked = selected.includes(opt)
                return (
                  <label
                    key={opt}
                    className={`px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-[#1c1c36] flex items-start gap-2.5 cursor-pointer transition-colors ${
                      isChecked
                        ? 'bg-primary-500/[0.04] dark:bg-primary-500/[0.08]'
                        : 'opacity-70'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggle(opt)}
                      className="mt-0.5 rounded border-slate-300 dark:border-[#252548] text-primary-600 focus:ring-primary-500 w-3.5 h-3.5 shrink-0"
                    />
                    <span
                      className={`text-xs leading-relaxed break-words flex-1 ${
                        isChecked
                          ? 'font-bold text-slate-800 dark:text-slate-100'
                          : 'font-normal text-slate-400 dark:text-slate-500 line-through'
                      }`}
                    >
                      {opt}
                    </span>
                  </label>
                )
              })
            )}
          </div>

          {/* Footer note */}
          <div className="px-3.5 pt-2 border-t border-slate-100 dark:border-[#252548] text-[10px] text-slate-400 flex justify-between items-center">
            <span>ติ๊กถูกเพื่อเลือก / ติ๊กออกเพื่อไม่นำมาคำนวณ</span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-[#1e1e38] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#252548] text-[10px] font-bold cursor-pointer"
            >
              ปิดหน้าต่าง
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

interface MonthlyMilestoneDetail {
  id: string
  projectId: string
  projectName: string
  milestoneNo: number
  workScope: string | null
  amount: number
  status: string
  isPaid: boolean
  isPlan: boolean
  isActual: boolean
}

export function PaymentForecastChart({
  milestones,
  projects,
  exVatEnabled = false,
}: PaymentForecastChartProps) {
  const allMilestones = useMemo(() => milestones, [milestones])

  // View Mode: 'cards' (Grid Cards - Option 1) or 'chart' (Bar Chart)
  const [viewMode, setViewMode] = useState<'cards' | 'chart'>('cards')

  // Expanded state for cards that have > 5 items
  const [expandedCards, setExpandedCards] = useState<string[]>([])

  const toggleCardExpand = (sortKey: string) => {
    setExpandedCards((prev) =>
      prev.includes(sortKey) ? prev.filter((k) => k !== sortKey) : [...prev, sortKey]
    )
  }

  // Extract unique metadata options from all projects
  const allSupervisors = useMemo(() => {
    const list = new Set<string>()
    projects.forEach((p) => {
      if (p.supervisor) list.add(p.supervisor)
    })
    return Array.from(list).sort()
  }, [projects])

  const allStatuses = useMemo(() => {
    const list = new Set<string>()
    projects.forEach((p) => {
      if (p.status) list.add(p.status)
    })
    return Array.from(list).sort()
  }, [projects])

  const allWorkGroups = useMemo(() => {
    const list = new Set<string>()
    projects.forEach((p) => {
      const g = p.work_group || 'ไม่ระบุกลุ่มงาน'
      list.add(g)
    })
    return Array.from(list).sort()
  }, [projects])

  // Independent filter states
  const [selectedSupervisors, setSelectedSupervisors] = useState<string[]>([])
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
  const [selectedWorkGroups, setSelectedWorkGroups] = useState<string[]>([])
  const [selectedProjects, setSelectedProjects] = useState<string[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  // Initialize filters
  useEffect(() => {
    if (projects.length > 0) {
      setSelectedSupervisors(allSupervisors)
      setSelectedStatuses(allStatuses)
      setSelectedWorkGroups(allWorkGroups)
    }
  }, [projects, allSupervisors, allStatuses, allWorkGroups])

  // Filter projects by current independent metadata filter selections
  const filteredProjectsByMetaData = useMemo(() => {
    return projects.filter((p) => {
      if (selectedSupervisors.length > 0 && !selectedSupervisors.includes(p.supervisor)) return false
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(p.status)) return false
      const g = p.work_group || 'ไม่ระบุกลุ่มงาน'
      if (selectedWorkGroups.length > 0 && !selectedWorkGroups.includes(g)) return false
      return true
    })
  }, [projects, selectedSupervisors, selectedStatuses, selectedWorkGroups])

  // Active project names matching metadata filters
  const allProjectNames = useMemo(() => {
    const names: string[] = []
    filteredProjectsByMetaData.forEach((p) => {
      if (allMilestones.some((m) => m.project_id === p.id) && !names.includes(p.name)) {
        names.push(p.name)
      }
    })
    return names
  }, [allMilestones, filteredProjectsByMetaData])

  // Initialize and synchronize selected project checkboxes
  useEffect(() => {
    setSelectedProjects(allProjectNames)
    setIsLoaded(true)
  }, [allProjectNames])

  const handleSelectAllProjects = () => setSelectedProjects(allProjectNames)

  // Helper to adjust VAT
  const adjustVal = (num: number) => {
    const adjusted = exVatEnabled ? num / 1.07 : num
    return Math.round(adjusted)
  }

  // Process raw monthly data with rich milestone details
  const rawGroupedData = useMemo(() => {
    const grouped: Record<
      string,
      {
        dateObj: Date
        sortKey: string
        name: string
        fullMonthName: string
        yearCE: number
        yearBE: number
        yearShort: string
        planTotal: number
        actualTotal: number
        planProjects: Record<string, number>
        actualProjects: Record<string, number>
        items: MonthlyMilestoneDetail[]
      }
    > = {}

    let planUnassigned = 0
    let actualUnassigned = 0

    allMilestones.forEach((m) => {
      const p = projects.find((proj) => proj.id === m.project_id)
      const pName = p ? p.name : 'Unknown Project'

      // Skip if project is not matching the metadata filters
      const isProjectMatched = filteredProjectsByMetaData.some((proj) => proj.id === m.project_id)
      if (!isProjectMatched) return

      const amt = adjustVal(Number(m.amount) || 0)
      const isPaid = m.status === 'Paid' || m.is_paid
      const statusLabel = m.status || (isPaid ? 'Paid' : 'Pending')

      // 3.1. Process Plan (using expected_payment_date)
      if (!m.expected_payment_date) {
        if (selectedProjects.includes(pName)) {
          planUnassigned += amt
        }
      } else {
        const dateObj = new Date(m.expected_payment_date)
        if (!isNaN(dateObj.getTime())) {
          const sortKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`

          if (!grouped[sortKey]) {
            const yearCE = dateObj.getFullYear()
            const yearBE = yearCE + 543
            grouped[sortKey] = {
              dateObj,
              sortKey,
              name: dateObj.toLocaleDateString('th-TH', { month: 'short', year: '2-digit' }),
              fullMonthName: dateObj.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' }),
              yearCE,
              yearBE,
              yearShort: String(yearBE).slice(-2),
              planTotal: 0,
              actualTotal: 0,
              planProjects: {},
              actualProjects: {},
              items: [],
            }
          }

          if (selectedProjects.includes(pName)) {
            grouped[sortKey].planTotal += amt
            grouped[sortKey].planProjects[pName] = (grouped[sortKey].planProjects[pName] || 0) + amt

            grouped[sortKey].items.push({
              id: m.id || `${m.project_id}-${m.milestone_no}-plan`,
              projectId: m.project_id || '',
              projectName: pName,
              milestoneNo: m.milestone_no,
              workScope: m.work_scope,
              amount: amt,
              status: statusLabel,
              isPaid,
              isPlan: true,
              isActual: false,
            })
          }
        }
      }

      // 3.2. Process Actual (using payment_date if paid)
      if (isPaid) {
        if (!m.payment_date) {
          if (selectedProjects.includes(pName)) {
            actualUnassigned += amt
          }
        } else {
          const dateObj = new Date(m.payment_date)
          if (!isNaN(dateObj.getTime())) {
            const sortKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`

            if (!grouped[sortKey]) {
              const yearCE = dateObj.getFullYear()
              const yearBE = yearCE + 543
              grouped[sortKey] = {
                dateObj,
                sortKey,
                name: dateObj.toLocaleDateString('th-TH', { month: 'short', year: '2-digit' }),
                fullMonthName: dateObj.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' }),
                yearCE,
                yearBE,
                yearShort: String(yearBE).slice(-2),
                planTotal: 0,
                actualTotal: 0,
                planProjects: {},
                actualProjects: {},
                items: [],
              }
            }

            if (selectedProjects.includes(pName)) {
              grouped[sortKey].actualTotal += amt
              grouped[sortKey].actualProjects[pName] = (grouped[sortKey].actualProjects[pName] || 0) + amt

              // Check if item was already added by plan
              const existingItem = grouped[sortKey].items.find(
                (item) => item.projectId === m.project_id && item.milestoneNo === m.milestone_no
              )
              if (existingItem) {
                existingItem.isActual = true
              } else {
                grouped[sortKey].items.push({
                  id: m.id || `${m.project_id}-${m.milestone_no}-actual`,
                  projectId: m.project_id || '',
                  projectName: pName,
                  milestoneNo: m.milestone_no,
                  workScope: m.work_scope,
                  amount: amt,
                  status: statusLabel,
                  isPaid: true,
                  isPlan: false,
                  isActual: true,
                })
              }
            }
          }
        }
      }
    })

    return {
      grouped,
      planUnassigned,
      actualUnassigned,
    }
  }, [allMilestones, projects, selectedProjects, filteredProjectsByMetaData, exVatEnabled])

  const allMonthsSorted = useMemo(() => {
    return Object.values(rawGroupedData.grouped).sort((a, b) => a.sortKey.localeCompare(b.sortKey))
  }, [rawGroupedData])

  // Date Range Filters
  const [startMonthKey, setStartMonthKey] = useState<string>('')
  const [endMonthKey, setEndMonthKey] = useState<string>('')

  useEffect(() => {
    if (allMonthsSorted.length > 0 && !startMonthKey && !endMonthKey) {
      setStartMonthKey(allMonthsSorted[0].sortKey)
      setEndMonthKey(allMonthsSorted[allMonthsSorted.length - 1].sortKey)
    }
  }, [allMonthsSorted, startMonthKey, endMonthKey])

  // Quick Select Presets
  const handleQuickSelectMonths = (count: number) => {
    if (allMonthsSorted.length === 0) return
    const now = new Date()
    const startKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const futureDate = new Date(now.getFullYear(), now.getMonth() + count, 1)
    const endKey = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, '0')}`

    setStartMonthKey(startKey)
    setEndMonthKey(endKey)
  }

  const handleSelectYear = (yearBE: number) => {
    const yearCE = yearBE - 543
    setStartMonthKey(`${yearCE}-01`)
    setEndMonthKey(`${yearCE}-12`)
  }

  const handleSelectAllMonths = () => {
    if (allMonthsSorted.length > 0) {
      setStartMonthKey(allMonthsSorted[0].sortKey)
      setEndMonthKey(allMonthsSorted[allMonthsSorted.length - 1].sortKey)
    }
  }

  // Filtered Data capped at max 12 months as requested
  const { allFilteredMonths, displayedMonths, isCappedAt12, finalPlanTotal, finalActualTotal } = useMemo(() => {
    let planTotalSum = 0
    let actualTotalSum = 0

    const matched = allMonthsSorted
      .filter((m) => {
        if (startMonthKey && m.sortKey < startMonthKey) return false
        if (endMonthKey && m.sortKey > endMonthKey) return false
        return true
      })
      .filter((m) => m.planTotal > 0 || m.actualTotal > 0)

    matched.forEach((m) => {
      planTotalSum += m.planTotal
      actualTotalSum += m.actualTotal
    })

    // Cap at 12 months
    const displayed = matched.slice(0, 12)
    const isCapped = matched.length > 12

    return {
      allFilteredMonths: matched,
      displayedMonths: displayed,
      isCappedAt12: isCapped,
      finalPlanTotal: planTotalSum,
      finalActualTotal: actualTotalSum,
    }
  }, [allMonthsSorted, startMonthKey, endMonthKey])

  // Year theme color helper
  const getYearTheme = (yearShort: string) => {
    if (yearShort === '69') {
      return {
        key: '69',
        name: 'ปี 2569 (ปี 69)',
        gradientTop: 'from-emerald-500 via-teal-500 to-emerald-600',
        badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30',
        cardBorder: 'border-emerald-300/70 dark:border-emerald-900/40 hover:border-emerald-500/60',
        cardBgHeader: 'bg-emerald-500/[0.04] dark:bg-emerald-950/[0.15]',
        progressActual: 'bg-emerald-500',
        progressRemain: 'bg-emerald-100 dark:bg-emerald-950/40',
        accentText: 'text-emerald-600 dark:text-emerald-400',
        pillHighlight: 'border-emerald-500/20 text-emerald-700 dark:text-emerald-400 bg-emerald-500/5',
      }
    }
    if (yearShort === '70') {
      return {
        key: '70',
        name: 'ปี 2570 (ปี 70)',
        gradientTop: 'from-rose-500 via-red-500 to-rose-600',
        badge: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/30',
        cardBorder: 'border-rose-300/70 dark:border-rose-900/40 hover:border-rose-500/60',
        cardBgHeader: 'bg-rose-500/[0.04] dark:bg-rose-950/[0.15]',
        progressActual: 'bg-rose-500',
        progressRemain: 'bg-rose-100 dark:bg-rose-950/40',
        accentText: 'text-rose-600 dark:text-rose-400',
        pillHighlight: 'border-rose-500/20 text-rose-700 dark:text-rose-400 bg-rose-500/5',
      }
    }
    // Other years: Indigo / Sky
    return {
      key: yearShort,
      name: `ปี 25${yearShort}`,
      gradientTop: 'from-sky-500 via-blue-500 to-indigo-600',
      badge: 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/30',
      cardBorder: 'border-sky-300/70 dark:border-sky-900/40 hover:border-sky-500/60',
      cardBgHeader: 'bg-sky-500/[0.04] dark:bg-sky-950/[0.15]',
      progressActual: 'bg-sky-500',
      progressRemain: 'bg-sky-100 dark:bg-sky-950/40',
      accentText: 'text-sky-600 dark:text-sky-400',
      pillHighlight: 'border-sky-500/20 text-sky-700 dark:text-sky-400 bg-sky-500/5',
    }
  }

  // Status Badge Helper
  const renderStatusBadge = (status: string, isPaid: boolean) => {
    if (isPaid || status === 'Paid') {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 size={10} /> จ่ายแล้ว
        </span>
      )
    }
    if (status === 'IR') {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
          <Clock size={10} /> รอเบิกเงิน (IR)
        </span>
      )
    }
    if (status === 'GR') {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
          <FileCheck2 size={10} /> รอตรวจรับ (GR)
        </span>
      )
    }
    if (status === 'PO') {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
          สัญญา PO
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500">
        {status}
      </span>
    )
  }

  if (!isLoaded) {
    return <div className="animate-pulse h-[400px] bg-slate-100 dark:bg-[#1c1c34] rounded-2xl mb-6"></div>
  }

  // Empty State
  if (displayedMonths.length === 0 && rawGroupedData.planUnassigned === 0 && rawGroupedData.actualUnassigned === 0) {
    return (
      <div className="card p-6 flex flex-col items-center justify-center min-h-[350px] text-center border-dashed mb-6">
        <div className="w-16 h-16 bg-slate-50 dark:bg-[#14142a] rounded-full flex items-center justify-center mb-4 text-slate-400">
          <EyeOff size={32} />
        </div>
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">ไม่มีข้อมูลในเงื่อนไขที่เลือก</h3>
        <p className="text-xs text-slate-500 max-w-sm mb-4">ลองเปลี่ยนตัวกรองโครงการหรือช่วงเดือน เพื่อดูข้อมูลคาดการณ์เบิกจ่าย</p>
        <div className="flex gap-2">
          <button
            onClick={handleSelectAllProjects}
            className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-[#252548] text-slate-600 hover:bg-slate-50 cursor-pointer"
          >
            เลือกทุกโครงการ
          </button>
          <button
            onClick={handleSelectAllMonths}
            className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-[#252548] text-slate-600 hover:bg-slate-50 cursor-pointer"
          >
            เลือกทุกเดือน
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="card p-5 sm:p-6 flex flex-col print-exact-colors mb-6 shadow-sm border border-slate-200 dark:border-[#1e1e38] rounded-2xl bg-white dark:bg-[#13132a]">
      {/* ── Section Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 dark:border-[#1c1c34] pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400">
              <CalendarDays size={20} />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                ประมาณการเบิกจ่ายรายเดือน
              </h2>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                การ์ดไทม์ไลน์รายเดือน แสดงเฉพาะงวดงานที่ยังไม่ได้ส่งมอบและงวดงานที่จ่ายแล้ว
              </p>
            </div>
          </div>
        </div>

        {/* View Switcher & Totals */}
        <div className="flex flex-wrap items-center gap-4 sm:gap-6 ml-auto">
          {/* View Mode Toggle Button */}
          <div className="flex items-center bg-slate-100 dark:bg-[#1a1a36] p-1 rounded-xl border border-slate-200 dark:border-[#252548]">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-white dark:bg-[#13132a] text-primary-600 dark:text-primary-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <LayoutGrid size={14} />
              <span>การ์ดรายเดือน</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('chart')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'chart'
                  ? 'bg-white dark:bg-[#13132a] text-primary-600 dark:text-primary-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <BarChart3 size={14} />
              <span>กราฟแท่ง</span>
            </button>
          </div>

          {/* Grand Totals */}
          <div className="flex gap-4 sm:gap-6 text-right">
            <div>
              <div className="flex items-center justify-end gap-1.5 mb-0.5">
                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">แผนเบิกจ่ายรวม</p>
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                    exVatEnabled
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                      : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                  }`}
                >
                  {exVatEnabled ? 'ถอด VAT' : 'รวม VAT'}
                </span>
              </div>
              <p className="text-lg sm:text-xl font-black text-blue-600 dark:text-blue-400 font-mono">
                ฿ {(finalPlanTotal + rawGroupedData.planUnassigned).toLocaleString()}
              </p>
            </div>
            <div className="border-l border-slate-100 dark:border-[#252548] pl-4 sm:pl-6">
              <div className="flex items-center justify-end gap-1.5 mb-0.5">
                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">เบิกจ่ายจริงรวม</p>
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                    exVatEnabled
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                      : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                  }`}
                >
                  {exVatEnabled ? 'ถอด VAT' : 'รวม VAT'}
                </span>
              </div>
              <p className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                ฿ {(finalActualTotal + rawGroupedData.actualUnassigned).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Filters Section ── */}
      <div className="flex flex-col gap-4 my-5 no-print bg-slate-50 dark:bg-[#15152c] p-4 rounded-xl border border-slate-100 dark:border-[#1e1e38]">
        {/* Dropdowns and Date Filters Row */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <FilterDropdown
            label="ผู้ควบคุมงาน"
            options={allSupervisors}
            selected={selectedSupervisors}
            onChange={setSelectedSupervisors}
          />
          <FilterDropdown
            label="สถานะโครงการ"
            options={allStatuses}
            selected={selectedStatuses}
            onChange={setSelectedStatuses}
          />
          <FilterDropdown
            label="กลุ่มงาน"
            options={allWorkGroups}
            selected={selectedWorkGroups}
            onChange={setSelectedWorkGroups}
          />
          <ProjectFilterDropdown
            options={allProjectNames}
            selected={selectedProjects}
            onChange={setSelectedProjects}
          />

          <div className="h-8 w-px bg-slate-200 dark:bg-[#252548] hidden xl:block" />

          {/* Month Pickers */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">จากเดือน</label>
              <input
                type="month"
                value={startMonthKey}
                onChange={(e) => setStartMonthKey(e.target.value)}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-[#252548] bg-white dark:bg-[#1e1e38] text-slate-700 dark:text-slate-300 focus:outline-none focus:border-primary-500 font-semibold"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">ถึงเดือน</label>
              <input
                type="month"
                value={endMonthKey}
                onChange={(e) => setEndMonthKey(e.target.value)}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-[#252548] bg-white dark:bg-[#1e1e38] text-slate-700 dark:text-slate-300 focus:outline-none focus:border-primary-500 font-semibold"
              />
            </div>
          </div>

          {/* Quick Filter Buttons */}
          <div className="flex items-center gap-1.5 pt-4 flex-wrap">
            <button
              type="button"
              onClick={() => handleQuickSelectMonths(3)}
              className="px-2.5 py-1.5 text-[10px] font-bold rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-[#252548] dark:hover:bg-[#2e2e58] text-slate-700 dark:text-slate-200 transition-colors cursor-pointer select-none"
            >
              3 ด. ข้างหน้า
            </button>
            <button
              type="button"
              onClick={() => handleQuickSelectMonths(6)}
              className="px-2.5 py-1.5 text-[10px] font-bold rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-[#252548] dark:hover:bg-[#2e2e58] text-slate-700 dark:text-slate-200 transition-colors cursor-pointer select-none"
            >
              6 ด. ข้างหน้า
            </button>
            <button
              type="button"
              onClick={() => handleQuickSelectMonths(12)}
              className="px-2.5 py-1.5 text-[10px] font-bold rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-[#252548] dark:hover:bg-[#2e2e58] text-slate-700 dark:text-slate-200 transition-colors cursor-pointer select-none"
            >
              12 เดือน
            </button>
            {/* Year preset buttons */}
            <button
              type="button"
              onClick={() => handleSelectYear(2569)}
              className="px-2.5 py-1.5 text-[10px] font-bold rounded-lg bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950/60 dark:hover:bg-emerald-900 text-emerald-800 dark:text-emerald-300 transition-colors cursor-pointer select-none"
            >
              🌱 ปี 69
            </button>
            <button
              type="button"
              onClick={() => handleSelectYear(2570)}
              className="px-2.5 py-1.5 text-[10px] font-bold rounded-lg bg-rose-100 hover:bg-rose-200 dark:bg-rose-950/60 dark:hover:bg-rose-900 text-rose-800 dark:text-rose-300 transition-colors cursor-pointer select-none"
            >
              🔥 ปี 70
            </button>
            <button
              type="button"
              onClick={handleSelectAllMonths}
              className="px-2.5 py-1.5 text-[10px] font-bold rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-[#252548] dark:hover:bg-[#2e2e58] text-slate-700 dark:text-slate-200 transition-colors cursor-pointer select-none"
            >
              ทั้งหมด
            </button>
          </div>
        </div>
      </div>

      {/* ── Notification if capped at 12 months ── */}
      {isCappedAt12 && (
        <div className="mb-4 px-3.5 py-2 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/40 rounded-xl text-xs text-blue-700 dark:text-blue-300 flex items-center justify-between">
          <span>ℹ️ แสดงมากสุด 12 เดือนแรกตามที่กำหนด (จากที่เลือกทั้งหมด {allFilteredMonths.length} เดือน)</span>
          <span className="text-[10px] opacity-75">ปรับช่วงเดือนได้ที่ตัวกรองด้านบน</span>
        </div>
      )}

      {/* ── VIEW 1: MONTHLY TIMELINE CARDS GRID (OPTION 1) ── */}
      {viewMode === 'cards' && (
        <div className="space-y-6">
          {displayedMonths.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm font-semibold border border-dashed border-slate-200 dark:border-[#252548] rounded-2xl">
              ไม่พบข้อมูลการเบิกจ่ายตามเงื่อนไขที่เลือก
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4.5">
              {displayedMonths.map((month) => {
                const theme = getYearTheme(month.yearShort)
                const isExpanded = expandedCards.includes(month.sortKey)
                const totalItems = month.items.length
                const displayedItems = isExpanded ? month.items : month.items.slice(0, 5)
                const hasMore = totalItems > 5

                // Calculate progress %
                const progressPct =
                  month.planTotal > 0
                    ? Math.min(100, Math.round((month.actualTotal / month.planTotal) * 100))
                    : month.actualTotal > 0
                    ? 100
                    : 0

                return (
                  <div
                    key={month.sortKey}
                    className={`rounded-2xl border bg-white dark:bg-[#15152e] flex flex-col justify-between overflow-hidden shadow-xs hover:shadow-md transition-all duration-200 ${theme.cardBorder}`}
                  >
                    {/* Top Year Color Stripe */}
                    <div className={`h-1.5 w-full bg-gradient-to-r ${theme.gradientTop}`} />

                    {/* Card Header */}
                    <div className={`p-4 border-b border-slate-100 dark:border-[#202042] ${theme.cardBgHeader}`}>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-full ${theme.badge}`}>
                          {theme.key === '69' ? '🌱' : theme.key === '70' ? '🔥' : '📅'} {theme.name}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                          {totalItems} รายการ
                        </span>
                      </div>

                      <h3 className="text-base font-black text-slate-900 dark:text-white flex items-baseline justify-between">
                        <span>{month.fullMonthName}</span>
                        <span className="text-xs font-mono font-bold text-slate-400">{month.name}</span>
                      </h3>

                      {/* Financial KPI Numbers */}
                      <div className="grid grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-slate-200/50 dark:border-[#252548]/50">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            แผนเบิกจ่าย
                          </span>
                          <span className="text-sm font-black text-blue-600 dark:text-blue-400 font-mono">
                            ฿{month.planTotal.toLocaleString()}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            เบิกจ่ายจริง
                          </span>
                          <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono">
                            ฿{month.actualTotal.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="mt-2.5 space-y-1">
                        <div className="flex justify-between text-[10px] font-bold">
                          <span className="text-slate-400">ความคืบหน้าการเบิก</span>
                          <span className={theme.accentText}>{progressPct}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 dark:bg-[#202042] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${theme.progressActual}`}
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Card Body: Milestone Items (5 items + expand button) */}
                    <div className="p-3.5 flex-1 flex flex-col justify-between">
                      <div className="space-y-2">
                        {displayedItems.length === 0 ? (
                          <div className="text-center py-4 text-xs text-slate-400 italic">
                            ไม่มียอดเบิกจ่ายในเดือนนี้
                          </div>
                        ) : (
                          displayedItems.map((item, idx) => (
                            <div
                              key={`${item.id}-${idx}`}
                              className="p-2.5 rounded-xl border border-slate-100 dark:border-[#202042] bg-slate-50/60 dark:bg-[#121226]/60 hover:bg-slate-100/70 dark:hover:bg-[#1a1a36]/60 transition-colors"
                            >
                              <div className="flex items-start justify-between gap-1.5">
                                <span
                                  className="text-xs font-bold text-slate-800 dark:text-slate-200 line-clamp-1 flex-1"
                                  title={item.projectName}
                                >
                                  {item.projectName}
                                </span>
                                {renderStatusBadge(item.status, item.isPaid)}
                              </div>

                              <div className="flex items-center justify-between text-[11px] mt-1 pt-1 border-t border-slate-100 dark:border-[#202042]/50 text-slate-500 dark:text-slate-400">
                                <span className="font-semibold text-slate-600 dark:text-slate-300">
                                  งวดที่ {item.milestoneNo}
                                </span>
                                <span className="font-mono font-bold text-slate-900 dark:text-white">
                                  ฿{item.amount.toLocaleString()}
                                </span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Expand / Collapse Button if > 5 items */}
                      {hasMore && (
                        <button
                          type="button"
                          onClick={() => toggleCardExpand(month.sortKey)}
                          className={`mt-3 w-full py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
                            isExpanded
                              ? 'bg-slate-100 dark:bg-[#1e1e38] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#252548]'
                              : `${theme.pillHighlight} hover:opacity-90`
                          }`}
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp size={14} /> ย่อรายการ (แสดง 5 รายการ)
                            </>
                          ) : (
                            <>
                              <ChevronDown size={14} /> ดูเพิ่มอีก {totalItems - 5} รายการ
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── VIEW 2: ORIGINAL BAR CHART & SUMMARY TABLE ── */}
      {viewMode === 'chart' && (
        <div className="space-y-6">
          <div className="h-[380px] w-full mt-2 print-chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={displayedMonths}
                margin={{ top: 35, right: 25, left: 10, bottom: 5 }}
                barGap={16}
                barCategoryGap="20%"
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  tickFormatter={(val) => `฿${(val / 1000000).toFixed(1)}M`}
                />
                <Tooltip
                  content={({ active, payload, label }: any) => {
                    if (active && payload && payload.length) {
                      const dataPoint = payload[0].payload
                      return (
                        <div className="bg-white dark:bg-[#121228] border border-slate-200 dark:border-[#252548] p-3 rounded-xl shadow-xl text-xs font-semibold space-y-1.5 min-w-[200px]">
                          <p className="font-bold text-sm text-slate-800 dark:text-slate-200">{label}</p>
                          <p className="text-blue-500 font-bold flex justify-between">
                            <span>📋 แผนเบิกจ่าย:</span>
                            <span className="font-mono">฿{Number(dataPoint.planTotal).toLocaleString()}</span>
                          </p>
                          <p className="text-emerald-500 font-bold flex justify-between">
                            <span>✅ เบิกจ่ายจริง:</span>
                            <span className="font-mono">฿{Number(dataPoint.actualTotal).toLocaleString()}</span>
                          </p>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} />
                <Bar dataKey="planTotal" name="แผนเบิกจ่าย" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={26}>
                  <LabelList
                    dataKey="planTotal"
                    content={(props: any) => {
                      const { x, y, width, value } = props
                      if (!value || value <= 0) return null
                      return (
                        <text
                          x={x + width / 2}
                          y={y - 8}
                          fill="#2563eb"
                          textAnchor="middle"
                          fontSize={10}
                          fontWeight="bold"
                          stroke="#ffffff"
                          strokeWidth={3}
                          paintOrder="stroke fill"
                          className="dark:fill-blue-400 dark:stroke-[#15152a]"
                        >
                          ฿{Number(value).toLocaleString()}
                        </text>
                      )
                    }}
                  />
                </Bar>
                <Bar dataKey="actualTotal" name="เบิกจ่ายจริง" fill="#10b981" radius={[4, 4, 0, 0]} barSize={26}>
                  <LabelList
                    dataKey="actualTotal"
                    content={(props: any) => {
                      const { x, y, width, value } = props
                      if (!value || value <= 0) return null
                      return (
                        <text
                          x={x + width / 2}
                          y={y - 8}
                          fill="#059669"
                          textAnchor="middle"
                          fontSize={10}
                          fontWeight="bold"
                          stroke="#ffffff"
                          strokeWidth={3}
                          paintOrder="stroke fill"
                          className="dark:fill-emerald-400 dark:stroke-[#15152a]"
                        >
                          ฿{Number(value).toLocaleString()}
                        </text>
                      )
                    }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Clean Summary Table */}
          <div className="border border-slate-200 dark:border-[#252548] rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-[#14142a] border-b border-slate-200 dark:border-[#252548] text-slate-500 font-bold uppercase tracking-wider">
                  <th className="p-3 w-32">เดือน</th>
                  <th className="p-3 text-right w-40 bg-blue-500/5">ยอดรวมแผน (บาท)</th>
                  <th className="p-3 text-right w-40 bg-emerald-500/5">ยอดรวมจริง (บาท)</th>
                  <th className="p-3">รายการโครงการในเดือน</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#1c1c34] text-slate-700 dark:text-slate-300 font-medium">
                {displayedMonths.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-[#14142a]/50 transition-colors">
                    <td className="p-3 font-bold whitespace-nowrap">{row.fullMonthName}</td>
                    <td className="p-3 text-right font-black text-blue-600 dark:text-blue-400 font-mono bg-blue-500/5">
                      {row.planTotal > 0 ? row.planTotal.toLocaleString() : '—'}
                    </td>
                    <td className="p-3 text-right font-black text-emerald-600 dark:text-emerald-400 font-mono bg-emerald-500/5">
                      {row.actualTotal > 0 ? row.actualTotal.toLocaleString() : '—'}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1.5">
                        {row.items.map((it, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-slate-100 dark:bg-[#1e1e38] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#252548]"
                          >
                            <span className="font-semibold">{it.projectName}</span>
                            <span className="text-slate-400">(งวด {it.milestoneNo}: ฿{it.amount.toLocaleString()})</span>
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Unassigned Milestones Notices */}
      {rawGroupedData.planUnassigned > 0 && (
        <div className="mt-5 p-3.5 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-xl flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
            <span className="text-xs font-bold text-amber-800 dark:text-amber-400">
              ยอดแผนเบิกจ่ายที่ยังไม่ได้วางกำหนดการเบิกจ่าย
            </span>
          </div>
          <span className="text-sm font-black text-amber-800 dark:text-amber-400 font-mono">
            ฿ {rawGroupedData.planUnassigned.toLocaleString()}
          </span>
        </div>
      )}

      {rawGroupedData.actualUnassigned > 0 && (
        <div className="mt-2.5 p-3.5 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-900/30 rounded-xl flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-400">
              ยอดเบิกจ่ายจริงที่ไม่ได้ระบุวันที่ชำระเงิน
            </span>
          </div>
          <span className="text-sm font-black text-emerald-800 dark:text-emerald-400 font-mono">
            ฿ {rawGroupedData.actualUnassigned.toLocaleString()}
          </span>
        </div>
      )}
    </div>
  )
}
