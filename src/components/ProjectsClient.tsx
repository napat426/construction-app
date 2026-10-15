'use client'

import { useState, useMemo } from 'react'
import { Plus, Search, SlidersHorizontal, FolderOpen, Building2, TrendingUp, DollarSign, ChevronDown, ChevronUp, Download, ArrowUp, ArrowDown, ArrowUpDown, Layers, LayoutGrid, Check, Sparkles, FolderKanban, Settings, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { ProjectCard } from './ProjectCard'
import { CreateProjectModal } from './CreateProjectModal'
import { AIAssistantSection } from './ai/AIAssistantSection'
import { DisbursementsView } from './DisbursementsView'
import { updateWorkGroupsSetting, updateProjectOrderSetting } from '@/app/actions/settings'
import { computeProjectActualProgress } from '@/lib/scheduler'
import type { Project, WBSTask, ContractAmendment, ProjectMilestone } from '@/lib/types'
import type { UserSession } from '@/lib/auth'

interface ProjectsClientProps {
  initialProjects: Project[]
  initialTasks: WBSTask[]
  initialMilestones: ProjectMilestone[]
  amendments?: ContractAmendment[]
  user?: UserSession | null
  aiEnabled?: boolean
  aiOcrEnabled?: boolean
  workGroups?: string[]
  initialProjectOrder?: string[]
}

export function ProjectsClient({ 
  initialProjects, 
  initialTasks, 
  initialMilestones,
  amendments = [], 
  user, 
  aiEnabled = false, 
  aiOcrEnabled = false, 
  workGroups = [],
  initialProjectOrder = []
}: ProjectsClientProps) {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createModalWorkGroup, setCreateModalWorkGroup] = useState<string | undefined>(undefined)
  const [showDisbursements, setShowDisbursements] = useState(false)
  const [exVatEnabled, setExVatEnabled] = useState(true)
  const [expandedProjects, setExpandedProjects] = useState<string[]>([])
  const [selectedSupervisors, setSelectedSupervisors] = useState<string[]>([])
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([
    'ออกแบบ สำรวจ ประมาณการ',
    'จัดซื้อจัดจ้าง',
    'รอดำเนินการ',
    'กำลังดำเนินการ',
    'ระงับ',
  ])
  const [supervisorOpen, setSupervisorOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedWorkGroups, setSelectedWorkGroups] = useState<string[]>([])
  const [workGroupOpen, setWorkGroupOpen] = useState(false)

  // ── Work Groups & Project Reordering States ──
  const [currentWorkGroups, setCurrentWorkGroups] = useState<string[]>(workGroups)
  const [projectOrder, setProjectOrder] = useState<string[]>(initialProjectOrder)
  const [isReorderMode, setIsReorderMode] = useState(false)
  const [viewMode, setViewMode] = useState<'grouped' | 'flat'>('grouped')
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const [isSavingOrder, setIsSavingOrder] = useState(false)

  /* ── Derived data ── */
  const supervisors = useMemo(
    () => [...new Set(initialProjects.flatMap((p) => (p.supervisor || '').split(',').map(s => s.trim()).filter(Boolean)))].sort(),
    [initialProjects]
  )

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    return initialProjects.filter((p) => {
      const pSupervisors = (p.supervisor || '').split(',').map(s => s.trim()).filter(Boolean)
      const matchSupervisor =
        selectedSupervisors.length === 0 ||
        pSupervisors.some((s) => selectedSupervisors.includes(s))
      const matchStatus =
        selectedStatuses.length === 0 ||
        selectedStatuses.includes(p.status)
      const matchWorkGroup =
        selectedWorkGroups.length === 0 ||
        selectedWorkGroups.includes(p.work_group || '')
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.supervisor.toLowerCase().includes(q) ||
        p.location?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q)
      return matchSupervisor && matchStatus && matchWorkGroup && matchSearch
    })
  }, [initialProjects, selectedSupervisors, selectedStatuses, selectedWorkGroups, searchQuery])

  const stats = useMemo(
    () => ({
      total:   initialProjects.length,
      active:  initialProjects.filter((p) => p.status === 'กำลังดำเนินการ').length,
      done:    initialProjects.filter((p) => p.status === 'เสร็จสิ้น').length,
      paused:  initialProjects.filter((p) => p.status === 'ระงับ').length,
      pending: initialProjects.filter((p) => p.status === 'รอดำเนินการ').length,
    }),
    [initialProjects]
  )

  /* ── Reordering Handlers ── */
  const handleMoveGroup = async (groupIndex: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? groupIndex - 1 : groupIndex + 1
    if (targetIndex < 0 || targetIndex >= currentWorkGroups.length) return
    const updated = [...currentWorkGroups]
    const temp = updated[groupIndex]
    updated[groupIndex] = updated[targetIndex]
    updated[targetIndex] = temp
    setCurrentWorkGroups(updated)
    setIsSavingOrder(true)
    try {
      await updateWorkGroupsSetting(updated)
    } finally {
      setIsSavingOrder(false)
    }
  }

  const handleMoveProject = async (projectId: string, groupProjects: Project[], direction: 'left' | 'right') => {
    const currentIndex = groupProjects.findIndex(p => p.id === projectId)
    if (currentIndex === -1) return
    const targetIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1
    if (targetIndex < 0 || targetIndex >= groupProjects.length) return

    const newGroupProjects = [...groupProjects]
    const temp = newGroupProjects[currentIndex]
    newGroupProjects[currentIndex] = newGroupProjects[targetIndex]
    newGroupProjects[targetIndex] = temp

    const newGroupIds = newGroupProjects.map(p => p.id)
    const allKnownIds = [...new Set([...projectOrder, ...initialProjects.map(p => p.id)])]
    const remainingGroupIds = [...newGroupIds]
    const updatedFullOrder = allKnownIds.map(id => {
      if (groupProjects.some(p => p.id === id)) {
        return remainingGroupIds.shift()!
      }
      return id
    })

    setProjectOrder(updatedFullOrder)
    setIsSavingOrder(true)
    try {
      await updateProjectOrderSetting(updatedFullOrder)
    } finally {
      setIsSavingOrder(false)
    }
  }

  const toggleCollapseGroup = (groupName: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }))
  }

  /* ── Sorted & Grouped Projects ── */
  const sortedFilteredProjects = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const idxA = projectOrder.indexOf(a.id)
      const idxB = projectOrder.indexOf(b.id)
      if (idxA !== -1 && idxB !== -1) return idxA - idxB
      if (idxA !== -1) return -1
      if (idxB !== -1) return 1
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }, [filtered, projectOrder])

  const groupedSections = useMemo(() => {
    const sections: {
      groupName: string
      isSpecial?: boolean
      projects: Project[]
      totalBudget: number
      avgProgress: number
    }[] = []

    // Defined work groups in order
    currentWorkGroups.forEach((wg) => {
      const groupProjs = sortedFilteredProjects.filter(p => (p.work_group || '').trim() === wg.trim())
      const totalBudget = groupProjs.reduce((sum, p) => sum + (p.budget || 0), 0)
      const totalProgress = groupProjs.reduce((sum, p) => sum + computeProjectActualProgress(p, initialTasks), 0)
      const rawAvg = groupProjs.length > 0 ? totalProgress / groupProjs.length : 0
      const avgProgress = Math.round(rawAvg * 10) / 10

      // Only filter out empty if search/filters are active
      const isSearching = searchQuery.trim().length > 0 || selectedSupervisors.length > 0 || selectedStatuses.length > 0 || selectedWorkGroups.length > 0
      if (!isSearching || groupProjs.length > 0) {
        sections.push({
          groupName: wg,
          projects: groupProjs,
          totalBudget,
          avgProgress
        })
      }
    })

    // Unassigned or other work groups not in currentWorkGroups
    const unassignedProjs = sortedFilteredProjects.filter(
      p => !p.work_group || !currentWorkGroups.some(wg => wg.trim() === (p.work_group || '').trim())
    )
    if (unassignedProjs.length > 0) {
      const totalBudget = unassignedProjs.reduce((sum, p) => sum + (p.budget || 0), 0)
      const totalProgress = unassignedProjs.reduce((sum, p) => sum + computeProjectActualProgress(p, initialTasks), 0)
      const rawAvg = unassignedProjs.length > 0 ? totalProgress / unassignedProjs.length : 0
      const avgProgress = Math.round(rawAvg * 10) / 10
      sections.push({
        groupName: 'หมวดงานอื่นๆ / ไม่ระบุกลุ่มงาน',
        isSpecial: true,
        projects: unassignedProjs,
        totalBudget,
        avgProgress
      })
    }

    return sections
  }, [currentWorkGroups, sortedFilteredProjects, searchQuery, selectedSupervisors, selectedStatuses, selectedWorkGroups])

  return (
    <>
      {/* ── Summary Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6 print:hidden">
        {(
          [
            { label: 'ทั้งหมด',           value: stats.total,   color: 'text-primary-600 dark:text-primary-400',   dot: 'bg-primary-600' },
            { label: 'กำลังดำเนินการ',    value: stats.active,  color: 'text-amber-600   dark:text-amber-400',     dot: 'bg-amber-500'   },
            { label: 'เสร็จสิ้น',         value: stats.done,    color: 'text-emerald-600 dark:text-emerald-400',   dot: 'bg-emerald-500' },
            { label: 'รอดำเนินการ',      value: stats.pending, color: 'text-sky-600 dark:text-sky-400',           dot: 'bg-sky-500' },
            { label: 'ระงับ',           value: stats.paused,  color: 'text-red-600 dark:text-red-400',           dot: 'bg-red-500' },
          ] as const
        ).map((s) => (
          <div key={s.label} className="stat-card rounded-xl px-4 py-3.5">
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-2 h-2 rounded-full ${s.dot}`} />
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
                {s.label}
              </p>
            </div>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-3 mb-5 print:hidden">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search
            size={15}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-600 pointer-events-none"
          />
          <input
            id="search-projects"
            type="text"
            placeholder="ค้นหาโครงการ, ผู้ควบคุม, สถานที่..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-base font-medium"
            style={{ paddingLeft: "2.5rem" }}
          />
        </div>

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
              {selectedSupervisors.length === 0
                ? "ผู้ควบคุมทั้งหมด"
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
                  {selectedSupervisors.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedSupervisors([])}
                      className="text-[10px] font-bold text-red-500 hover:underline"
                    >
                      ล้างค่า
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {supervisors.map((s) => {
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
              {selectedStatuses.length === 0
                ? "สถานะทั้งหมด"
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
                  {selectedStatuses.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedStatuses([])}
                      className="text-[10px] font-bold text-red-500 hover:underline"
                    >
                      ล้างค่า
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {(
                    [
                      'ออกแบบ สำรวจ ประมาณการ',
                      'จัดซื้อจัดจ้าง',
                      'รอดำเนินการ',
                      'กำลังดำเนินการ',
                      'ระงับ',
                      'เสร็จสิ้น',
                    ] as const
                  ).map((st) => {
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
              {selectedWorkGroups.length === 0
                ? "กลุ่มงานทั้งหมด"
                : `กลุ่มงาน (${selectedWorkGroups.length})`}
            </span>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">▼</span>
          </button>
          
          {workGroupOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setWorkGroupOpen(false)} />
              <div className="absolute right-0 mt-1.5 w-56 bg-white dark:bg-[#13132a] border border-slate-200 dark:border-[#252548] rounded-xl shadow-xl z-20 p-3 max-h-60 overflow-y-auto animate-scale-in">
                <div className="flex justify-between items-center pb-2 mb-2 border-b border-slate-100 dark:border-[#1e1e38]">
                  <span className="text-[10px] font-black uppercase text-slate-400">เลือกกลุ่มงาน</span>
                  {selectedWorkGroups.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedWorkGroups([])}
                      className="text-[10px] font-bold text-red-500 hover:underline"
                    >
                      ล้างค่า
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

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* View Mode Toggle */}
          <div className="flex items-center p-1 bg-white dark:bg-[#13132a] border border-slate-200 dark:border-[#252548] rounded-xl shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode('grouped')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'grouped'
                  ? 'bg-primary-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="แสดงตามหมวดงาน"
            >
              <Layers size={14} />
              <span>แยกตามหมวดงาน</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('flat')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'flat'
                  ? 'bg-primary-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="แสดงโครงการทั้งหมด"
            >
              <LayoutGrid size={14} />
              <span>รวมทั้งหมด</span>
            </button>
          </div>

          {/* Admin Reorder Mode Toggle */}
          {user && user.role === 'admin' && (
            <button
              type="button"
              onClick={() => setIsReorderMode(!isReorderMode)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                isReorderMode
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm ring-2 ring-indigo-400/30'
                  : 'bg-white dark:bg-[#1a1a36] text-slate-700 dark:text-slate-200 border-slate-200 dark:border-[#252548] hover:bg-slate-50 dark:hover:bg-[#202042]'
              }`}
              title="เปิด/ปิดโหมดปรับลำดับโครงการและหมวดงาน"
            >
              <ArrowUpDown size={14} className={isReorderMode ? 'animate-bounce' : ''} />
              <span>{isReorderMode ? '✓ กำลังจัดลำดับ' : 'จัดลำดับงาน'}</span>
            </button>
          )}

          <button
            onClick={() => setShowDisbursements(!showDisbursements)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
              showDisbursements
                ? 'bg-amber-500 text-white border-amber-500 hover:bg-amber-600'
                : 'bg-white dark:bg-[#1a1a36] text-slate-700 dark:text-slate-200 border-slate-200 dark:border-[#252548] hover:bg-slate-50'
            }`}
          >
            <DollarSign size={14} className={showDisbursements ? 'text-white' : 'text-amber-500'} />
            การเบิกจ่าย
          </button>

          <Link
            href="/portfolio"
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-[#1a1a36] border border-slate-200 dark:border-[#252548] hover:bg-slate-50 dark:hover:bg-[#252548] transition-colors cursor-pointer"
          >
            <TrendingUp size={14} className="text-primary-600 dark:text-primary-400" />
            ภาพรวมทุกโครงการ
          </Link>

          {user && (user.role === 'admin' || user.role === 'editor') && (
            <button
              id="create-project-btn"
              onClick={() => {
                setCreateModalWorkGroup(undefined)
                setShowCreateModal(true)
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white btn-primary flex-shrink-0 cursor-pointer shadow-sm"
            >
              <Plus size={15} />
              สร้างโครงการใหม่
            </button>
          )}
        </div>
      </div>

      {/* ── Reorder Mode Tip Banner ── */}
      {isReorderMode && user && user.role === 'admin' && (
        <div className="mb-5 p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 flex items-center justify-between text-xs text-indigo-900 dark:text-indigo-200 animate-fade-in">
          <div className="flex items-center gap-2.5">
            <span className="text-base">💡</span>
            <div>
              <p className="font-bold">โหมดจัดลำดับโครงการ & หมวดงานกำลังทำงาน</p>
              <p className="text-[11px] opacity-80 mt-0.5">
                กดปุ่ม <strong>◀ ก่อน</strong> หรือ <strong>หลัง ▶</strong> บนการ์ดแต่ละโครงการ หรือกดปุ่ม <strong>▲ / ▼</strong> บนหัวข้อหมวดงานเพื่อเลื่อนสลับลำดับก่อน-หลังได้ทันที ระบบจะบันทึกอัตโนมัติ
              </p>
            </div>
          </div>
          {isSavingOrder && (
            <div className="flex items-center gap-1.5 font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
              <RefreshCw size={13} className="animate-spin" />
              <span>กำลังบันทึก...</span>
            </div>
          )}
        </div>
      )}

      {/* ── Filter result count ── */}
      {(searchQuery || selectedSupervisors.length > 0 || selectedStatuses.length > 0 || selectedWorkGroups.length > 0) && (
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 print:hidden">
          แสดง{' '}
          <span className="font-bold text-primary-600 dark:text-primary-400">
            {filtered.length}
          </span>{' '}
          จาก {initialProjects.length} โครงการ
        </p>
      )}

      {/* ── Projects grid or Disbursements ── */}
      {filtered.length > 0 ? (
        showDisbursements ? (
          <DisbursementsView
            projects={filtered}
            milestones={initialMilestones}
            tasks={initialTasks}
            exVatEnabled={exVatEnabled}
            setExVatEnabled={setExVatEnabled}
          />
        ) : viewMode === 'grouped' ? (
          /* ── Grouped by Work Category (ตามรูปวาด) ── */
          <div className="space-y-8">
            {groupedSections.map((section, sIdx) => {
              const isCollapsed = !!collapsedGroups[section.groupName]
              return (
                <section key={section.groupName} className="scroll-mt-6">
                  {/* Section Header Card */}
                  <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 sm:px-5 sm:py-3.5 rounded-2xl bg-white dark:bg-[#141428] border border-slate-200/90 dark:border-[#252548] shadow-xs mb-4">
                    {/* Left: Index badge, Title, and Stats */}
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
                            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40 hidden sm:inline-block">
                              งบรวม {(section.totalBudget / 1e6).toFixed(2)} ล้านบาท
                            </span>
                          )}
                          {section.projects.length > 0 && (
                            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/40 hidden md:inline-block">
                              {section.projects.length === 1 ? 'ความก้าวหน้า' : 'ความก้าวหน้าเฉลี่ย'} {section.avgProgress}%
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Reorder actions and collapse */}
                    <div className="flex items-center gap-1.5 ml-auto">
                      {/* Admin Reorder Move Up / Down for this group */}
                      {user && user.role === 'admin' && !section.isSpecial && (
                        <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-[#1e1e38] p-1 rounded-xl">
                          <button
                            type="button"
                            onClick={() => handleMoveGroup(sIdx, 'up')}
                            disabled={sIdx === 0 || isSavingOrder}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-primary-600 hover:bg-white dark:hover:bg-[#282848] disabled:opacity-20 disabled:cursor-not-allowed transition-all cursor-pointer"
                            title="เลื่อนหมวดงานขึ้น"
                          >
                            <ArrowUp size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveGroup(sIdx, 'down')}
                            disabled={sIdx === currentWorkGroups.length - 1 || isSavingOrder}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-primary-600 hover:bg-white dark:hover:bg-[#282848] disabled:opacity-20 disabled:cursor-not-allowed transition-all cursor-pointer"
                            title="เลื่อนหมวดงานลง"
                          >
                            <ArrowDown size={15} />
                          </button>
                        </div>
                      )}

                      {/* Add project in this specific group */}
                      {user && (user.role === 'admin' || user.role === 'editor') && !section.isSpecial && (
                        <button
                          type="button"
                          onClick={() => {
                            setCreateModalWorkGroup(section.groupName)
                            setShowCreateModal(true)
                          }}
                          className="px-3 py-1.5 text-xs font-bold text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-950/50 rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                          title={`เพิ่มโครงการในหมวด ${section.groupName}`}
                        >
                          <Plus size={14} />
                          <span className="hidden sm:inline">เพิ่มในหมวดนี้</span>
                        </button>
                      )}

                      {/* Collapse / Expand toggle */}
                      <button
                        type="button"
                        onClick={() => toggleCollapseGroup(section.groupName)}
                        className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-[#1e1e38] transition-colors cursor-pointer"
                        title={isCollapsed ? 'กางออก' : 'พับเก็บ'}
                      >
                        {isCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                      </button>
                    </div>
                  </div>

                  {/* Projects Grid for this section (3 columns according to sketch) */}
                  {!isCollapsed && (
                    section.projects.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {section.projects.map((project, pIdx) => (
                          <ProjectCard
                            key={project.id}
                            project={project}
                            tasks={initialTasks.filter((t) => t.project_id === project.id)}
                            amendments={amendments.filter((a) => a.project_id === project.id)}
                            user={user}
                            index={pIdx}
                            totalInGroup={section.projects.length}
                            isReorderMode={isReorderMode && user?.role === 'admin'}
                            canMoveLeft={pIdx > 0}
                            canMoveRight={pIdx < section.projects.length - 1}
                            onMoveLeft={() => handleMoveProject(project.id, section.projects, 'left')}
                            onMoveRight={() => handleMoveProject(project.id, section.projects, 'right')}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 rounded-2xl border border-dashed border-slate-200 dark:border-[#252548] text-center bg-slate-50/50 dark:bg-[#141428]/40">
                        <p className="text-sm font-semibold text-slate-400 dark:text-slate-500 mb-2">
                          ยังไม่มีโครงการในหมวดนี้
                        </p>
                        {user && (user.role === 'admin' || user.role === 'editor') && !section.isSpecial && (
                          <button
                            type="button"
                            onClick={() => {
                              setCreateModalWorkGroup(section.groupName)
                              setShowCreateModal(true)
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-primary-600 bg-primary-50 dark:bg-primary-950/50 hover:bg-primary-100 rounded-lg transition-colors cursor-pointer"
                          >
                            <Plus size={13} />
                            สร้างโครงการแรกในหมวดนี้
                          </button>
                        )}
                      </div>
                    )
                  )}
                </section>
              )
            })}
          </div>
        ) : (
          /* Flat grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {sortedFilteredProjects.map((project, pIdx) => (
              <ProjectCard
                key={project.id}
                project={project}
                tasks={initialTasks.filter((t) => t.project_id === project.id)}
                amendments={amendments.filter((a) => a.project_id === project.id)}
                user={user}
                index={pIdx}
                totalInGroup={sortedFilteredProjects.length}
                isReorderMode={isReorderMode && user?.role === 'admin'}
                canMoveLeft={pIdx > 0}
                canMoveRight={pIdx < sortedFilteredProjects.length - 1}
                onMoveLeft={() => handleMoveProject(project.id, sortedFilteredProjects, 'left')}
                onMoveRight={() => handleMoveProject(project.id, sortedFilteredProjects, 'right')}
              />
            ))}
          </div>
        )
      ) : (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-20 h-20 rounded-2xl bg-primary-600/10 dark:bg-primary-600/15 flex items-center justify-center mb-5">
            {searchQuery || selectedSupervisors.length > 0 || selectedStatuses.length > 0 || selectedWorkGroups.length > 0 ? (
              <Search size={36} className="text-primary-600 dark:text-primary-400 opacity-70" />
            ) : (
              <Building2 size={36} className="text-primary-600 dark:text-primary-400 opacity-70" />
            )}
          </div>
          <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-2">
            {searchQuery || selectedSupervisors.length > 0 || selectedStatuses.length > 0 || selectedWorkGroups.length > 0
              ? 'ไม่พบโครงการที่ตรงเงื่อนไข'
              : 'ยังไม่มีโครงการในระบบ'}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-6 leading-relaxed">
            {searchQuery || selectedSupervisors.length > 0 || selectedStatuses.length > 0 || selectedWorkGroups.length > 0
              ? 'ลองเปลี่ยนคำค้นหาหรือเลือกสถานะ/ผู้ควบคุมงาน/กลุ่มงานอื่น'
              : 'เริ่มต้นโดยการเพิ่มโครงการก่อสร้างโครงการแรกของคุณ'}
          </p>
          {!searchQuery && selectedSupervisors.length === 0 && selectedStatuses.length === 0 && selectedWorkGroups.length === 0 && user && (user.role === 'admin' || user.role === 'editor') && (
            <button
              onClick={() => {
                setCreateModalWorkGroup(undefined)
                setShowCreateModal(true)
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold text-white btn-primary cursor-pointer"
            >
              <Plus size={15} />
              สร้างโครงการแรก
            </button>
          )}
        </div>
      )}

      {/* ── Create modal ── */}
      {showCreateModal && (
        <CreateProjectModal 
          onClose={() => {
            setShowCreateModal(false)
            setCreateModalWorkGroup(undefined)
          }} 
          workGroups={currentWorkGroups} 
          defaultWorkGroup={createModalWorkGroup}
        />
      )}

      {/* ── AI Assistant Section ── */}
      {aiEnabled && (
        <div className="print:hidden">
          <AIAssistantSection projects={initialProjects} user={user} aiOcrEnabled={aiOcrEnabled} />
        </div>
      )}
    </>
  )
}
