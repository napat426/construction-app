'use client'

import React, { useState, useMemo, useTransition } from 'react'
import Link from 'next/link'
import {
  Building2,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Plus,
  ArrowUpDown,
  Printer,
  ChevronDown,
  ChevronUp,
  FolderOpen,
  ArrowLeft,
  ChevronRight,
  Maximize2,
  Award,
  Filter,
  Layers,
  Sparkles,
  ExternalLink,
  Info,
} from 'lucide-react'
import type { SupervisorTask, SupervisorTaskGroup, Project } from '@/lib/types'
import type { UserSession } from '@/lib/auth'
import {
  saveSupervisorTask,
  deleteSupervisorTask,
  saveSupervisorTaskGroup,
  deleteSupervisorTaskGroup,
  reorderSupervisorTaskGroups,
  reorderSupervisorTasks,
} from '@/app/actions/supervisor_tasks'
import { SupervisorCardDetailModal } from './SupervisorCardDetailModal'
import { SupervisorTaskModal } from './SupervisorTaskModal'
import { SupervisorGroupModal } from './SupervisorGroupModal'

interface Props {
  supervisorName: string
  allSupervisors: string[]
  avatarUrl?: string | null
  allAvatars?: Record<string, string>
  initialGroups: SupervisorTaskGroup[]
  initialTasks: SupervisorTask[]
  projects: Project[]
  currentUser: UserSession | null
}

export function SupervisorPortfolioClient({
  supervisorName,
  allSupervisors,
  avatarUrl,
  allAvatars = {},
  initialGroups,
  initialTasks,
  projects,
  currentUser,
}: Props) {
  const [groups, setGroups] = useState<SupervisorTaskGroup[]>(initialGroups)
  const [tasks, setTasks] = useState<SupervisorTask[]>(initialTasks)
  const [isPending, startTransition] = useTransition()

  // Modals & Active items
  const [selectedTaskForDetail, setSelectedTaskForDetail] = useState<SupervisorTask | null>(null)
  const [taskModalState, setTaskModalState] = useState<{ isOpen: boolean; task?: Partial<SupervisorTask> | null; defaultGroupId?: string }>({
    isOpen: false,
    task: null,
  })
  const [groupModalState, setGroupModalState] = useState<{ isOpen: boolean; group?: Partial<SupervisorTaskGroup> | null }>({
    isOpen: false,
    group: null,
  })

  // Collapsed groups state
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([])
  // Reorder mode toggle
  const [isReorderMode, setIsReorderMode] = useState(false)
  // Year Filter (Default: 2569)
  const [selectedYear, setSelectedYear] = useState<string>('all')

  // Permission: Can this user edit?
  // User can edit if logged in and either Admin OR matches display_name / supervisorName
  const canEdit = useMemo(() => {
    if (!currentUser) return false
    if (currentUser.role === 'admin') return true
    if (currentUser.display_name === supervisorName) return true
    if (currentUser.username === supervisorName) return true
    return true // In demo mode, permit edit to let user try it
  }, [currentUser, supervisorName])

  // Filter tasks for this supervisor
  const supervisorTasks = useMemo(() => {
    return tasks.filter((t) => t.supervisor === supervisorName)
  }, [tasks, supervisorName])

  // Helper to extract Buddhist Era year from a task
  const getTaskYear = (t: SupervisorTask): string => {
    const dateStr = t.completed_date || t.due_date || t.start_date || (t.created_at ? t.created_at.split('T')[0] : '')
    if (!dateStr) return ''
    const ceYear = parseInt(dateStr.substring(0, 4), 10)
    return isNaN(ceYear) ? '' : String(ceYear + 543)
  }

  // Helper to format date as วัน-เดือน-ปี (DD-MM-YYYY in Thai Buddhist Era)
  const formatDate = (dateStr?: string | null): string => {
    if (!dateStr) return '-'
    try {
      const clean = dateStr.split('T')[0]
      const parts = clean.split('-')
      if (parts.length === 3) {
        const [y, m, d] = parts
        const yearNum = parseInt(y, 10)
        const beYear = yearNum > 2400 ? yearNum : yearNum + 543
        return `${d}-${m}-${beYear}`
      }
      const dt = new Date(dateStr)
      if (isNaN(dt.getTime())) return dateStr
      const d = String(dt.getDate()).padStart(2, '0')
      const m = String(dt.getMonth() + 1).padStart(2, '0')
      const y = dt.getFullYear() + 543
      return `${d}-${m}-${y}`
    } catch {
      return dateStr || '-'
    }
  }

  // Dynamic available years: automatically adapts to the current year and any years from tasks
  const availableYears = useMemo(() => {
    const currentBE = new Date().getFullYear() + 543
    const yearsSet = new Set<string>()
    // Generate a range around current year (e.g. currentBE - 2 .. currentBE + 3)
    for (let offset = -2; offset <= 3; offset++) {
      yearsSet.add(String(currentBE + offset))
    }
    // Also include any years existing in the supervisor's tasks
    supervisorTasks.forEach((t) => {
      const y = getTaskYear(t)
      if (y) yearsSet.add(y)
    })
    return Array.from(yearsSet).sort((a, b) => Number(a) - Number(b))
  }, [supervisorTasks])

  // Filter tasks by selected year (if not 'all')
  const filteredSupervisorTasks = useMemo(() => {
    if (selectedYear === 'all') return supervisorTasks
    return supervisorTasks.filter((t) => getTaskYear(t) === selectedYear)
  }, [supervisorTasks, selectedYear])

  // Filter groups for this supervisor sorted by sort_order
  const supervisorGroups = useMemo(() => {
    const list = groups.filter((g) => g.supervisor === supervisorName)
    return list.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
  }, [groups, supervisorName])

  // Catch-all: tasks whose group_id does not match any current supervisor group
  const orphanTasks = useMemo(() => {
    return filteredSupervisorTasks.filter((t) => !supervisorGroups.some((g) => g.id === t.group_id))
  }, [filteredSupervisorTasks, supervisorGroups])

  // Main construction projects for this supervisor
  const mainProjects = useMemo(() => {
    return projects.filter((p) => (p.supervisor || '').includes(supervisorName))
  }, [projects, supervisorName])

  // KPI Calculations
  const stats = useMemo(() => {
    const totalTasks = filteredSupervisorTasks.length
    const completedTasks = filteredSupervisorTasks.filter((t) => t.status === 'completed').length
    const delayedTasks = filteredSupervisorTasks.filter((t) => t.status === 'delayed').length
    const inProgressTasks = filteredSupervisorTasks.filter((t) => t.status === 'in_progress').length
    const issueTasks = filteredSupervisorTasks.filter((t) => t.has_issue).length
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

    const totalProjectBudget = mainProjects.reduce((sum, p) => sum + (p.budget || 0), 0)

    return {
      totalTasks,
      completedTasks,
      delayedTasks,
      inProgressTasks,
      issueTasks,
      completionRate,
      projectCount: mainProjects.length,
      totalProjectBudget,
    }
  }, [filteredSupervisorTasks, mainProjects])

  // Toggle Collapse
  const toggleGroupCollapse = (groupId: string) => {
    setCollapsedGroups((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
    )
  }

  // Handle Save Task
  const handleSaveTask = async (taskPayload: any) => {
    startTransition(async () => {
      await saveSupervisorTask(taskPayload)
      // Optimistic update
      setTasks((prev) => {
        if (taskPayload.id) {
          return prev.map((t) => (t.id === taskPayload.id ? { ...t, ...taskPayload } : t))
        } else {
          const newTask: SupervisorTask = {
            id: `task-${Date.now()}`,
            sort_order: prev.length + 1,
            created_at: new Date().toISOString(),
            ...taskPayload,
          }
          return [...prev, newTask]
        }
      })
    })
  }

  // Handle Delete Task
  const handleDeleteTask = async (taskId: string) => {
    startTransition(async () => {
      await deleteSupervisorTask(taskId)
      setTasks((prev) => prev.filter((t) => t.id !== taskId))
    })
  }

  // Handle Save Group
  const handleSaveGroup = async (groupPayload: any) => {
    startTransition(async () => {
      await saveSupervisorTaskGroup(groupPayload)
      setGroups((prev) => {
        if (groupPayload.id) {
          return prev.map((g) => (g.id === groupPayload.id ? { ...g, ...groupPayload } : g))
        } else {
          const newG: SupervisorTaskGroup = {
            id: `grp-${Date.now()}`,
            sort_order: prev.length + 1,
            created_at: new Date().toISOString(),
            ...groupPayload,
          }
          return [...prev, newG]
        }
      })
    })
  }

  // Handle Delete Group
  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm('ต้องการลบกลุ่มงานนี้ใช่หรือไม่? (งานย่อยในกลุ่มจะถูกลบไปด้วย)')) return
    startTransition(async () => {
      await deleteSupervisorTaskGroup(groupId)
      setGroups((prev) => prev.filter((g) => g.id !== groupId))
      setTasks((prev) => prev.filter((t) => t.group_id !== groupId))
    })
  }

  // Handle Move Group Up/Down
  const handleMoveGroup = (groupId: string, direction: 'up' | 'down') => {
    const list = [...supervisorGroups]
    const idx = list.findIndex((g) => g.id === groupId)
    if (idx === -1) return
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= list.length) return

    // Swap
    const temp = list[idx]
    list[idx] = list[targetIdx]
    list[targetIdx] = temp

    const orderedIds = list.map((g) => g.id)
    setGroups((prev) =>
      prev.map((g) => {
        if (g.supervisor !== supervisorName) return g
        const newIdx = orderedIds.indexOf(g.id)
        return newIdx !== -1 ? { ...g, sort_order: newIdx + 1 } : g
      })
    )
    startTransition(async () => {
      await reorderSupervisorTaskGroups(supervisorName, orderedIds)
    })
  }

  // Handle Move Task Left/Right within Group
  const handleMoveTask = (groupId: string, taskId: string, direction: 'prev' | 'next') => {
    const groupTasks = supervisorTasks
      .filter((t) => t.group_id === groupId)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    const idx = groupTasks.findIndex((t) => t.id === taskId)
    if (idx === -1) return
    const targetIdx = direction === 'prev' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= groupTasks.length) return

    const temp = groupTasks[idx]
    groupTasks[idx] = groupTasks[targetIdx]
    groupTasks[targetIdx] = temp

    const orderedIds = groupTasks.map((t) => t.id)
    setTasks((prev) =>
      prev.map((t) => {
        if (t.supervisor !== supervisorName || t.group_id !== groupId) return t
        const newIdx = orderedIds.indexOf(t.id)
        return newIdx !== -1 ? { ...t, sort_order: newIdx + 1 } : t
      })
    )
    startTransition(async () => {
      await reorderSupervisorTasks(supervisorName, groupId, orderedIds)
    })
  }

  // Color helper for task group headers
  const getGroupBadgeColor = (color?: string) => {
    switch (color) {
      case 'emerald':
        return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
      case 'amber':
        return 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30'
      case 'purple':
        return 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30'
      case 'rose':
        return 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30'
      case 'sky':
        return 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/30'
      default:
        return 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30'
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* ── Top Bar: Navigation & Switcher ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 print:hidden">
        <div className="flex items-center gap-2">
          <Link
            href="/supervisors"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-[#13132a] border border-slate-200 dark:border-[#252548] hover:bg-slate-100 transition-colors shadow-2xs"
          >
            <ArrowLeft size={14} />
            <span>ภาพรวมผู้คุมงานทั้งหมด</span>
          </Link>
          <span className="text-slate-300 dark:text-slate-700">•</span>
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
            <span>ผู้ควบคุมงาน:</span>
            <select
              value={supervisorName}
              onChange={(e) => {
                window.location.href = `/supervisors/${encodeURIComponent(e.target.value)}`
              }}
              className="text-xs px-3 py-1 rounded-lg border border-slate-200 dark:border-[#252548] bg-white dark:bg-[#181834] text-slate-900 dark:text-white font-bold cursor-pointer focus:outline-none focus:border-primary-500"
            >
              {allSupervisors.map((s) => (
                <option key={s} value={s}>
                  👤 {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right Action buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-[#13132a] border border-slate-200 dark:border-[#252548] text-slate-700 dark:text-slate-300 hover:bg-slate-100 flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="พิมพ์แฟ้มสรุปผลงานรอบปี"
          >
            <Printer size={14} />
            <span>พิมพ์ผลงาน (PDF)</span>
          </button>

          {canEdit && (
            <>
              <button
                type="button"
                onClick={() => setIsReorderMode(!isReorderMode)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                  isReorderMode
                    ? 'bg-amber-500 border-amber-600 text-white'
                    : 'bg-white dark:bg-[#13132a] border-slate-200 dark:border-[#252548] text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                }`}
              >
                <ArrowUpDown size={14} />
                <span>{isReorderMode ? 'เสร็จสิ้นการจัดลำดับ' : 'จัดเรียงลำดับ'}</span>
              </button>

              <button
                type="button"
                onClick={() => setGroupModalState({ isOpen: true })}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-[#13132a] border border-slate-200 dark:border-[#252548] text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-[#1e1e38] flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Plus size={14} />
                <span>เพิ่มกลุ่มงาน</span>
              </button>

              <button
                type="button"
                onClick={() => setTaskModalState({ isOpen: true, defaultGroupId: supervisorGroups[0]?.id })}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-primary-600 hover:bg-primary-700 text-white flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Plus size={14} />
                <span>บันทึกภารกิจย่อย</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Guest notice if not logged in */}
      {!currentUser && (
        <div className="px-4 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 text-xs text-blue-800 dark:text-blue-300 flex items-center gap-2 print:hidden">
          <Info size={16} className="shrink-0 text-blue-600 dark:text-blue-400" />
          <span>
            คุณกำลังเปิดดูใน <strong>โหมดผู้เข้าชม (Guest Mode)</strong>: สามารถคลิกตรวจดูผลงานและรูปถ่ายได้ แต่ไม่สามารถแก้ไขข้อมูลได้ (ในโหมด Demo นี้เปิดสิทธิ์ให้ทดลองกดบันทึกได้)
          </span>
        </div>
      )}

      {/* ── Supervisor Profile & KPI Header Card ── */}
      <div className="card p-5 sm:p-6 bg-gradient-to-br from-white via-white to-slate-50 dark:from-[#111124] dark:to-[#16162e] border border-slate-200 dark:border-[#202042] rounded-2xl shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-[#202042]">
          <div className="flex items-center gap-3.5">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={supervisorName}
                className="w-14 h-14 rounded-2xl object-cover shadow-md shrink-0 border-2 border-primary-500/30"
              />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-600 to-indigo-700 flex items-center justify-center text-white text-xl font-black shadow-md shrink-0">
                {supervisorName.slice(0, 2)}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-tight">
                  {supervisorName}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <Award size={12} /> ผู้ควบคุมงาน
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                แฟ้มสะสมผลงานรายบุคคล • ภารกิจเฉพาะกิจและการควบคุมงานก่อสร้าง
              </p>
            </div>
          </div>

          {/* Quick Year Filter Pill & Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-[#181834] p-1.5 rounded-xl print:hidden flex-wrap">
            <span className="text-[10px] font-bold text-slate-400 uppercase px-1.5 flex items-center gap-1">
              <Calendar size={13} className="text-primary-500" /> ปีประเมิน:
            </span>
            <button
              type="button"
              onClick={() => setSelectedYear('all')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedYear === 'all'
                  ? 'bg-white dark:bg-[#252548] text-primary-600 dark:text-primary-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              ทั้งหมด (ทุกปี)
            </button>
            <div className="relative">
              <select
                value={selectedYear === 'all' ? '' : selectedYear}
                onChange={(e) => setSelectedYear(e.target.value || 'all')}
                className="text-xs font-bold px-2.5 py-1 rounded-lg bg-white dark:bg-[#252548] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-[#353560] focus:outline-none cursor-pointer"
              >
                <option value="">-- เลือกปี พ.ศ. --</option>
                {availableYears.map((yr) => {
                  const currentBE = String(new Date().getFullYear() + 543)
                  return (
                    <option key={yr} value={yr}>
                      พ.ศ. {yr} {yr === currentBE ? '(ปีปัจจุบัน)' : ''}
                    </option>
                  )
                })}
              </select>
            </div>
            {selectedYear !== 'all' && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                พ.ศ. {selectedYear}
              </span>
            )}
          </div>
        </div>

        {/* KPI Numbers Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-5">
          <div className="bg-slate-50 dark:bg-[#181834] p-3.5 rounded-xl border border-slate-100 dark:border-[#252548]">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              🏢 โครงการหลักที่คุม
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-black text-slate-900 dark:text-white">
                {stats.projectCount}
              </span>
              <span className="text-xs text-slate-500">โครงการ</span>
            </div>
            <p className="text-[11px] font-bold text-blue-600 dark:text-blue-400 mt-0.5 truncate">
              ฿{(stats.totalProjectBudget / 1000000).toFixed(2)}M
            </p>
          </div>

          <div className="bg-slate-50 dark:bg-[#181834] p-3.5 rounded-xl border border-slate-100 dark:border-[#252548]">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              📋 ภารกิจย่อยทั้งหมด
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-black text-slate-900 dark:text-white">
                {stats.totalTasks}
              </span>
              <span className="text-xs text-slate-500">งาน</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {supervisorGroups.length} กลุ่มงาน
            </p>
          </div>

          <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-3.5 rounded-xl border border-emerald-200/50 dark:border-emerald-900/30">
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block flex items-center gap-1">
              <CheckCircle2 size={11} /> สำเร็จแล้ว
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                {stats.completedTasks}
              </span>
              <span className="text-xs text-emerald-700/80">งาน</span>
            </div>
            <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
              ความสำเร็จ {stats.completionRate}%
            </p>
          </div>

          <div className="bg-rose-50/50 dark:bg-rose-950/20 p-3.5 rounded-xl border border-rose-200/50 dark:border-rose-900/30">
            <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider block flex items-center gap-1">
              <Clock size={11} /> ล่าช้ากว่ากำหนด
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-black text-rose-600 dark:text-rose-400">
                {stats.delayedTasks}
              </span>
              <span className="text-xs text-rose-700/80">งาน</span>
            </div>
            <p className="text-[11px] text-rose-600/80 mt-0.5">
              {stats.inProgressTasks > 0 ? `กำลังทำ ${stats.inProgressTasks} งาน` : 'ไม่มีงานค้าง'}
            </p>
          </div>

          <div className="bg-amber-50/50 dark:bg-amber-950/20 p-3.5 rounded-xl border border-amber-200/50 dark:border-amber-900/30">
            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block flex items-center gap-1">
              <AlertTriangle size={11} /> ปัญหาอุปสรรค
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-black text-amber-600 dark:text-amber-400">
                {stats.issueTasks}
              </span>
              <span className="text-xs text-amber-700/80">เรื่อง</span>
            </div>
            <p className="text-[11px] text-amber-700/80 mt-0.5">มีบันทึกแนวทางแก้ไข</p>
          </div>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* SECTION 1: 🏢 โครงการก่อสร้างหลักที่รับผิดชอบ                 */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <Building2 size={16} />
            </div>
            <h2 className="text-base font-black text-slate-900 dark:text-white">
              โครงการก่อสร้างหลักที่รับผิดชอบ ({mainProjects.length} โครงการ)
            </h2>
          </div>
          <span className="text-xs font-semibold text-slate-400">
            ดึงจากฐานข้อมูลโครงการก่อสร้างอัตโนมัติ
          </span>
        </div>

        {mainProjects.length === 0 ? (
          <div className="card p-6 text-center text-xs text-slate-400 italic">
            ไม่พบโครงการก่อสร้างหลักที่มีชื่อผู้ควบคุมงานท่านนี้
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {mainProjects.map((p) => {
              const progressPct = p.progress || 0
              return (
                <div
                  key={p.id}
                  className="card p-4 hover:shadow-md transition-all border border-slate-200 dark:border-[#202042] bg-white dark:bg-[#121226] rounded-xl flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-[#202042] text-slate-600 dark:text-slate-300">
                        {p.work_group || 'โครงการหลัก'}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary-500/10 text-primary-600 dark:text-primary-400">
                        {p.status}
                      </span>
                    </div>

                    <h3
                      className="text-sm font-bold text-slate-900 dark:text-white line-clamp-2 leading-snug mb-1"
                      title={p.name}
                    >
                      {p.name}
                    </h3>

                    {p.location && (
                      <p className="text-[11px] text-slate-400 truncate mb-2">📍 {p.location}</p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-[#202042] space-y-2 mt-2">
                    {/* Budget & Progress */}
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 text-[11px]">งบประมาณ:</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {p.budget ? `฿${p.budget.toLocaleString()}` : '-'}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-bold">
                        <span className="text-slate-400">ความคืบหน้า</span>
                        <span className="text-primary-600 dark:text-primary-400">{progressPct}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 dark:bg-[#202042] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary-600 rounded-full transition-all duration-300"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>

                    <div className="pt-1 flex justify-end">
                      <Link
                        href={`/projects/${p.id}`}
                        className="text-[11px] font-bold text-primary-600 dark:text-primary-400 hover:underline inline-flex items-center gap-1"
                      >
                        ดูแผนงาน & WBS <ExternalLink size={11} />
                      </Link>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* SECTION 2: 📋 ภารกิจเฉพาะกิจ & งานย่อย (Group by Group)      */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="space-y-5 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <Layers size={16} />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white">
                ภารกิจเฉพาะกิจ & งานย่อยรายวัน ({filteredSupervisorTasks.length} งาน)
                {selectedYear !== 'all' && (
                  <span className="ml-2 text-xs font-bold text-purple-600 dark:text-purple-400">
                    (ปี พ.ศ. {selectedYear})
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-slate-400">
                งานสำรวจ รังวัด ออกแบบ ตรวจสอบพื้นที่ (จัดเรียงและกำหนดกลุ่มงานเองได้)
              </p>
            </div>
          </div>

          {canEdit && (
            <button
              type="button"
              onClick={() => setTaskModalState({ isOpen: true, defaultGroupId: supervisorGroups[0]?.id })}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-primary-600 hover:bg-primary-700 text-white flex items-center gap-1.5 cursor-pointer shadow-xs print:hidden"
            >
              <Plus size={13} /> บันทึกงานใหม่
            </button>
          )}
        </div>

        {supervisorGroups.length === 0 ? (
          <div className="card p-8 text-center border-dashed">
            <FolderOpen size={36} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">ยังไม่มีกลุ่มงาน</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
              เพิ่มกลุ่มงานเพื่อเริ่มจัดเก็บภารกิจย่อย เช่น งานสำรวจ, งานออกแบบ, งานตรวจพื้นที่
            </p>
            {canEdit && (
              <button
                type="button"
                onClick={() => setGroupModalState({ isOpen: true })}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-primary-600 text-white shadow-xs inline-flex items-center gap-1.5"
              >
                <Plus size={14} /> เพิ่มกลุ่มงานแรก
              </button>
            )}
          </div>
        ) : (
          supervisorGroups.map((group, gIdx) => {
            const isCollapsed = collapsedGroups.includes(group.id)
            const groupTasks = filteredSupervisorTasks
              .filter((t) => t.group_id === group.id)
              .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))

            return (
              <div
                key={group.id}
                className="card border border-slate-200 dark:border-[#202042] bg-white dark:bg-[#121226] rounded-2xl overflow-hidden shadow-2xs"
              >
                {/* Group Header */}
                <div className="p-4 bg-slate-50/70 dark:bg-[#16162e] border-b border-slate-100 dark:border-[#202042] flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => toggleGroupCollapse(group.id)}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                    </button>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getGroupBadgeColor(group.color)}`}>
                      📁 {group.name}
                    </span>
                    <span className="text-xs font-semibold text-slate-400">
                      ({groupTasks.length} งาน)
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Reorder Group Controls */}
                    {isReorderMode && (
                      <div className="flex items-center gap-1 bg-white dark:bg-[#1e1e38] p-1 rounded-lg border border-slate-200 dark:border-[#252548]">
                        <button
                          type="button"
                          disabled={gIdx === 0}
                          onClick={() => handleMoveGroup(group.id, 'up')}
                          className="px-2 py-0.5 rounded text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                          title="เลื่อนกลุ่มนี้ขึ้น"
                        >
                          ⬆️ ขึ้น
                        </button>
                        <button
                          type="button"
                          disabled={gIdx === supervisorGroups.length - 1}
                          onClick={() => handleMoveGroup(group.id, 'down')}
                          className="px-2 py-0.5 rounded text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                          title="เลื่อนกลุ่มนี้ลง"
                        >
                          ⬇️ ลง
                        </button>
                      </div>
                    )}

                    {canEdit && (
                      <>
                        <button
                          type="button"
                          onClick={() => setTaskModalState({ isOpen: true, defaultGroupId: group.id })}
                          className="px-2.5 py-1 rounded-lg text-xs font-bold text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-[#1e1e38] inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Plus size={13} /> เพิ่มงานในกลุ่มนี้
                        </button>
                        <button
                          type="button"
                          onClick={() => setGroupModalState({ isOpen: true, group })}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                          title="แก้ไขชื่อกลุ่มงาน"
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteGroup(group.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 cursor-pointer"
                          title="ลบกลุ่มงานนี้"
                        >
                          🗑️
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Group Tasks Grid */}
                {!isCollapsed && (
                  <div className="p-4 sm:p-5">
                    {groupTasks.length === 0 ? (
                      <div className="text-center py-6 text-xs text-slate-400 italic">
                        ยังไม่มีงานในกลุ่มนี้ — คลิก &quot;เพิ่มงานในกลุ่มนี้&quot; เพื่อเริ่มบันทึก
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                        {groupTasks.map((t, tIdx) => {
                          const coverPhoto = t.photo_urls && t.photo_urls.length > 0 ? t.photo_urls[0] : null
                          const isCompleted = t.status === 'completed'
                          const isDelayed = t.status === 'delayed'

                          return (
                            <div
                              key={t.id}
                              onClick={() => setSelectedTaskForDetail(t)}
                              className="group relative bg-slate-50/70 dark:bg-[#16162e] hover:bg-white dark:hover:bg-[#1a1a38] border border-slate-200/80 dark:border-[#202042] hover:border-primary-400 dark:hover:border-primary-500 rounded-xl overflow-hidden shadow-2xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
                            >
                              <div>
                                {/* Card Cover Photo */}
                                {coverPhoto ? (
                                  <div className="relative aspect-16/10 w-full overflow-hidden bg-slate-200 dark:bg-[#181834]">
                                    <img
                                      src={coverPhoto}
                                      alt={t.title}
                                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    />
                                    {t.photo_urls.length > 1 && (
                                      <span className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                                        📷 +{t.photo_urls.length - 1}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <div className="h-1.5 w-full bg-slate-200 dark:bg-[#202042]" />
                                )}

                                {/* Card Content */}
                                <div className="p-3.5 space-y-2">
                                  {/* Status Badges */}
                                  <div className="flex items-center justify-between gap-1 flex-wrap">
                                    {isCompleted ? (
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-1">
                                        <CheckCircle2 size={10} /> สำเร็จแล้ว
                                      </span>
                                    ) : isDelayed ? (
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 inline-flex items-center gap-1">
                                        <AlertTriangle size={10} /> ล่าช้า
                                      </span>
                                    ) : (
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                        กำลังทำ
                                      </span>
                                    )}

                                    {t.has_issue && (
                                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20 flex items-center gap-1">
                                        ⚠️ มีอุปสรรค
                                      </span>
                                    )}
                                  </div>

                                  {/* Task Title */}
                                  <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2 leading-snug group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                                    {t.title}
                                  </h4>

                                  {/* Dates */}
                                  <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                                    <Calendar size={11} className="shrink-0" />
                                    <span>
                                      {t.start_date ? formatDate(t.start_date) : '-'}
                                      {t.due_date && t.due_date !== t.start_date ? ` ถึง ${formatDate(t.due_date)}` : ''}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Card Footer / Reorder helper */}
                              <div className="px-3.5 py-2 border-t border-slate-100 dark:border-[#202042] bg-white/50 dark:bg-[#121226]/50 flex items-center justify-between text-[10px] text-slate-400">
                                <span className="group-hover:text-primary-600 font-semibold flex items-center gap-1">
                                  คลิกดูรายละเอียด <Maximize2 size={10} />
                                </span>

                                {isReorderMode && (
                                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                    <button
                                      type="button"
                                      disabled={tIdx === 0}
                                      onClick={() => handleMoveTask(group.id, t.id, 'prev')}
                                      className="px-1.5 py-0.5 bg-slate-200 dark:bg-[#202042] rounded font-bold disabled:opacity-30 cursor-pointer"
                                    >
                                      ◀
                                    </button>
                                    <button
                                      type="button"
                                      disabled={tIdx === groupTasks.length - 1}
                                      onClick={() => handleMoveTask(group.id, t.id, 'next')}
                                      className="px-1.5 py-0.5 bg-slate-200 dark:bg-[#202042] rounded font-bold disabled:opacity-30 cursor-pointer"
                                    >
                                      ▶
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}

        {/* Catch-All Container for Orphaned / Mismatched Tasks */}
        {orphanTasks.length > 0 && (
          <div className="card border-2 border-dashed border-amber-300 dark:border-amber-700/60 bg-amber-50/40 dark:bg-amber-950/20 rounded-2xl overflow-hidden shadow-2xs">
            <div className="p-4 bg-amber-100/60 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800/50 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border bg-amber-500/20 text-amber-800 dark:text-amber-200 border-amber-400">
                  📁 งานอื่นๆ / รอย้ายกลุ่ม ({orphanTasks.length} งาน)
                </span>
                <span className="text-[11px] text-amber-700 dark:text-amber-300 hidden sm:inline">
                  (ภารกิจที่รหัสกลุ่มไม่ตรง สามารถคลิกดูหรือกดแก้ไขเพื่อย้ายเข้ากลุ่มงานที่ต้องการได้)
                </span>
              </div>
            </div>
            <div className="p-4 sm:p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                {orphanTasks.map((t) => {
                  const coverPhoto = t.photo_urls && t.photo_urls.length > 0 ? t.photo_urls[0] : null
                  const isCompleted = t.status === 'completed'
                  const isDelayed = t.status === 'delayed'

                  return (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTaskForDetail(t)}
                      className="group relative bg-white dark:bg-[#16162e] hover:bg-slate-50 dark:hover:bg-[#1a1a38] border border-amber-200 dark:border-amber-900/50 hover:border-amber-400 rounded-xl overflow-hidden shadow-2xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
                    >
                      <div>
                        {coverPhoto ? (
                          <div className="relative aspect-16/10 w-full overflow-hidden bg-slate-200 dark:bg-[#181834]">
                            <img
                              src={coverPhoto}
                              alt={t.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            {t.photo_urls.length > 1 && (
                              <span className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                                +{t.photo_urls.length} รูป
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="h-2 w-full bg-gradient-to-r from-amber-400 to-amber-500" />
                        )}

                        <div className="p-3.5 space-y-2">
                          <div className="flex items-center justify-between gap-1 text-[10px]">
                            <span
                              className={`px-2 py-0.5 rounded-full font-bold ${
                                isCompleted
                                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                  : isDelayed
                                  ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                                  : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                              }`}
                            >
                              {isCompleted ? '✅ สำเร็จแล้ว' : isDelayed ? '⚠️ ล่าช้า' : '⏳ กำลังดำเนินการ'}
                            </span>
                            {t.has_issue && (
                              <span className="px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-600 dark:text-rose-400 font-bold flex items-center gap-0.5">
                                <AlertTriangle size={9} /> มีปัญหา
                              </span>
                            )}
                          </div>

                          <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2 leading-snug group-hover:text-amber-600 transition-colors">
                            {t.title}
                          </h4>

                          <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                            <Calendar size={11} className="shrink-0" />
                            <span>
                              {t.start_date ? formatDate(t.start_date) : '-'}
                              {t.due_date && t.due_date !== t.start_date ? ` ถึง ${formatDate(t.due_date)}` : ''}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="px-3.5 py-2 border-t border-slate-100 dark:border-[#202042] bg-white/50 dark:bg-[#121226]/50 flex items-center justify-between text-[10px] text-slate-400">
                        <span className="group-hover:text-amber-600 font-semibold flex items-center gap-1">
                          คลิกดูรายละเอียด <Maximize2 size={10} />
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* Detail Modal on Click                                      */}
      {/* ────────────────────────────────────────────────────────── */}
      {selectedTaskForDetail && (
        <SupervisorCardDetailModal
          task={selectedTaskForDetail}
          group={groups.find((g) => g.id === selectedTaskForDetail.group_id)}
          projects={projects}
          canEdit={canEdit}
          onClose={() => setSelectedTaskForDetail(null)}
          onEdit={(taskToEdit) => setTaskModalState({ isOpen: true, task: taskToEdit })}
          onDelete={handleDeleteTask}
        />
      )}

      {/* Task Create / Edit Modal */}
      {taskModalState.isOpen && (
        <SupervisorTaskModal
          initialTask={taskModalState.task}
          groups={supervisorGroups}
          projects={projects}
          supervisor={supervisorName}
          defaultGroupId={taskModalState.defaultGroupId}
          onClose={() => setTaskModalState({ isOpen: false, task: null })}
          onSave={handleSaveTask}
        />
      )}

      {/* Group Create / Edit Modal */}
      {groupModalState.isOpen && (
        <SupervisorGroupModal
          initialGroup={groupModalState.group}
          supervisor={supervisorName}
          onClose={() => setGroupModalState({ isOpen: false, group: null })}
          onSave={handleSaveGroup}
        />
      )}
    </div>
  )
}
