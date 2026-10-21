'use client'

import React, { useState, useMemo, useTransition, useEffect } from 'react'
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
  ChevronLeft,
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
  GripVertical,
  ArrowUp,
  ArrowDown,
  Check,
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

  useEffect(() => {
    setGroups(initialGroups)
  }, [initialGroups])

  useEffect(() => {
    setTasks(initialTasks)
  }, [initialTasks])

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

  // Drag & drop and reorder state
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null)
  const [isDraggingState, setIsDraggingState] = useState(false)
  const [reorderSuccessMsg, setReorderSuccessMsg] = useState<string | null>(null)

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
    const isEdit = Boolean(taskPayload.id)
    const payloadWithId = {
      ...taskPayload,
      id: taskPayload.id || `task-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    }

    startTransition(async () => {
      // Optimistic update
      setTasks((prev) => {
        if (isEdit) {
          return prev.map((t) => (t.id === payloadWithId.id ? { ...t, ...payloadWithId } : t))
        } else {
          const newTask: SupervisorTask = {
            sort_order: prev.length + 1,
            created_at: new Date().toISOString(),
            ...payloadWithId,
          }
          return [...prev, newTask]
        }
      })
      await saveSupervisorTask(payloadWithId)
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

  // Toast feedback helper
  const showReorderFeedback = (msg: string) => {
    setReorderSuccessMsg(msg)
    setTimeout(() => {
      setReorderSuccessMsg((cur) => (cur === msg ? null : cur))
    }, 2500)
  }

  // Handle reorder tasks within a group
  const handleReorderTasks = (groupId: string, newGroupTasks: SupervisorTask[]) => {
    // Preserve any tasks in this group that might not be in the current filtered view
    const otherTasksInGroup = tasks.filter(
      (t) => t.supervisor === supervisorName && t.group_id === groupId && !newGroupTasks.some((nt) => nt.id === t.id)
    )
    const allOrderedInGroup = [...newGroupTasks, ...otherTasksInGroup]
    const orderedIds = allOrderedInGroup.map((t) => t.id)

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
    showReorderFeedback('บันทึกการจัดเรียงลำดับผลงานแล้ว')
  }

  // Handle Move Task Left/Right (Previous/Next) within Group
  const handleMoveTask = (groupId: string, taskId: string, direction: 'prev' | 'next') => {
    const currentGroupTasks = filteredSupervisorTasks
      .filter((t) => t.group_id === groupId)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    const idx = currentGroupTasks.findIndex((t) => t.id === taskId)
    if (idx === -1) return
    const targetIdx = direction === 'prev' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= currentGroupTasks.length) return

    const reordered = [...currentGroupTasks]
    const [moved] = reordered.splice(idx, 1)
    reordered.splice(targetIdx, 0, moved)

    handleReorderTasks(groupId, reordered)
  }

  // Handle Drop Task within Group (Drag & Drop)
  const handleDropTask = (groupId: string, draggedId: string, targetId: string) => {
    if (draggedId === targetId) return
    const currentGroupTasks = filteredSupervisorTasks
      .filter((t) => t.group_id === groupId)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    const fromIdx = currentGroupTasks.findIndex((t) => t.id === draggedId)
    const toIdx = currentGroupTasks.findIndex((t) => t.id === targetId)
    if (fromIdx === -1 || toIdx === -1) return

    const reordered = [...currentGroupTasks]
    const [moved] = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, moved)

    handleReorderTasks(groupId, reordered)
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
    <div className="space-y-6 max-w-7xl mx-auto pb-16 print:space-y-4 print:pb-0 print:max-w-none print:w-full">
      {/* ── Print Styles for A4 Portrait ── */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm 10mm 12mm 10mm;
          }

          html, body {
            background-color: #ffffff !important;
            background: #ffffff !important;
            color: #0f172a !important;
            font-size: 9.5pt !important;
            font-family: 'Inter', system-ui, -apple-system, sans-serif !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            line-height: 1.4 !important;
          }

          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            box-shadow: none !important;
            text-shadow: none !important;
          }

          header, nav, aside, footer,
          .print\\:hidden,
          [class*="print:hidden"],
          button,
          select {
            display: none !important;
          }

          main {
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
          }

          .card,
          .print-card {
            background-color: #ffffff !important;
            background: #ffffff !important;
            border: 1px solid #cbd5e1 !important;
            border-radius: 8px !important;
            box-shadow: none !important;
            color: #0f172a !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          .print-profile-card {
            background: #f8fafc !important;
            border: 1.5px solid #cbd5e1 !important;
            padding: 12px 14px !important;
            border-radius: 10px !important;
            margin-bottom: 12px !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          .print-grid-2 {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 10px !important;
          }

          .print-grid-5 {
            display: grid !important;
            grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
            gap: 6px !important;
            padding-top: 8px !important;
          }

          .print-avoid-break {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          .print-avoid-break-after {
            break-after: avoid !important;
            page-break-after: avoid !important;
          }

          .print-task-photo {
            height: 110px !important;
            max-height: 110px !important;
            object-fit: cover !important;
            border-bottom: 1px solid #e2e8f0 !important;
          }

          h1, h2, h3, h4 {
            color: #0f172a !important;
          }

          a {
            text-decoration: none !important;
            color: inherit !important;
          }
        }
      `}</style>

      {/* ── Official Print Header (Visible only when printed) ── */}
      <div className="hidden print:block mb-4 pb-2 border-b-2 border-slate-800 text-center print-avoid-break">
        <div className="flex items-center justify-between pb-1 text-[8.5pt] text-slate-500 font-bold border-b border-slate-200">
          <span>ระบบบริหารจัดการและควบคุมงานก่อสร้าง</span>
          <span>การไฟฟ้าส่วนภูมิภาค (กฟภ.)</span>
        </div>
        <h1 className="text-xl font-black text-slate-900 mt-2">
          แฟ้มสะสมผลงานและการปฏิบัติงานของผู้ควบคุมงาน
        </h1>
        <div className="text-[9.5pt] text-slate-600 mt-0.5 flex items-center justify-center gap-3">
          <span className="font-bold text-slate-800">ผู้ควบคุมงาน: {supervisorName}</span>
          <span>•</span>
          <span>ปีประเมิน: {selectedYear === 'all' ? 'ทุกปี (ภาพรวมผลงานทั้งหมด)' : `พ.ศ. ${selectedYear}`}</span>
          <span>•</span>
          <span>วันที่พิมพ์รายงาน: {new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
        </div>
      </div>

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
      <div className="card p-5 sm:p-6 bg-gradient-to-br from-white via-white to-slate-50 dark:from-[#111124] dark:to-[#16162e] border border-slate-200 dark:border-[#202042] rounded-2xl shadow-sm print-profile-card">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-[#202042] print:pb-2">
          <div className="flex items-center gap-3.5">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={supervisorName}
                className="w-14 h-14 rounded-2xl object-cover shadow-md shrink-0 border-2 border-primary-500/30 print:w-12 print:h-12"
              />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-600 to-indigo-700 flex items-center justify-center text-white text-xl font-black shadow-md shrink-0 print:w-12 print:h-12">
                {supervisorName.slice(0, 2)}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-tight print:text-lg">
                  {supervisorName}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1 print:text-[9pt]">
                  <Award size={12} /> ผู้ควบคุมงาน
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 print:text-[8.5pt]">
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-5 print-grid-5">
          <div className="bg-slate-50 dark:bg-[#181834] p-3.5 rounded-xl border border-slate-100 dark:border-[#252548] print:bg-white print:border-slate-300 print:p-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block print:text-[8pt] print:text-slate-500">
              🏢 โครงการหลักที่คุม
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-black text-slate-900 dark:text-white print:text-base">
                {stats.projectCount}
              </span>
              <span className="text-xs text-slate-500 print:text-[8pt]">โครงการ</span>
            </div>
            <p className="text-[11px] font-bold text-blue-600 dark:text-blue-400 mt-0.5 truncate print:text-[8.5pt]">
              ฿{(stats.totalProjectBudget / 1000000).toFixed(2)}M
            </p>
          </div>

          <div className="bg-slate-50 dark:bg-[#181834] p-3.5 rounded-xl border border-slate-100 dark:border-[#252548] print:bg-white print:border-slate-300 print:p-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block print:text-[8pt] print:text-slate-500">
              📋 ภารกิจย่อยทั้งหมด
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-black text-slate-900 dark:text-white print:text-base">
                {stats.totalTasks}
              </span>
              <span className="text-xs text-slate-500 print:text-[8pt]">งาน</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5 print:text-[8.5pt]">
              {supervisorGroups.length} กลุ่มงาน
            </p>
          </div>

          <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-3.5 rounded-xl border border-emerald-200/50 dark:border-emerald-900/30 print:bg-emerald-50/40 print:border-emerald-300 print:p-2">
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block flex items-center gap-1 print:text-[8pt]">
              <CheckCircle2 size={11} /> สำเร็จแล้ว
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 print:text-base">
                {stats.completedTasks}
              </span>
              <span className="text-xs text-emerald-700/80 print:text-[8pt]">งาน</span>
            </div>
            <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 print:text-[8.5pt]">
              ความสำเร็จ {stats.completionRate}%
            </p>
          </div>

          <div className="bg-rose-50/50 dark:bg-rose-950/20 p-3.5 rounded-xl border border-rose-200/50 dark:border-rose-900/30 print:bg-rose-50/40 print:border-rose-300 print:p-2">
            <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider block flex items-center gap-1 print:text-[8pt]">
              <Clock size={11} /> ล่าช้ากว่ากำหนด
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-black text-rose-600 dark:text-rose-400 print:text-base">
                {stats.delayedTasks}
              </span>
              <span className="text-xs text-rose-700/80 print:text-[8pt]">งาน</span>
            </div>
            <p className="text-[11px] text-rose-600/80 mt-0.5 print:text-[8.5pt]">
              {stats.inProgressTasks > 0 ? `กำลังทำ ${stats.inProgressTasks} งาน` : 'ไม่มีงานค้าง'}
            </p>
          </div>

          <div className="bg-amber-50/50 dark:bg-amber-950/20 p-3.5 rounded-xl border border-amber-200/50 dark:border-amber-900/30 print:bg-amber-50/40 print:border-amber-300 print:p-2">
            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block flex items-center gap-1 print:text-[8pt]">
              <AlertTriangle size={11} /> ปัญหาอุปสรรค
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-black text-amber-600 dark:text-amber-400 print:text-base">
                {stats.issueTasks}
              </span>
              <span className="text-xs text-amber-700/80 print:text-[8pt]">เรื่อง</span>
            </div>
            <p className="text-[11px] text-amber-700/80 mt-0.5 print:text-[8.5pt]">
              {stats.issueTasks > 0 ? 'มีบันทึกแนวทางแก้ไข' : 'ดำเนินงานราบรื่น'}
            </p>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 print-grid-2">
            {mainProjects.map((p) => {
              const progressPct = p.progress || 0
              return (
                <div
                  key={p.id}
                  className="card p-4 hover:shadow-md transition-all border border-slate-200 dark:border-[#202042] bg-white dark:bg-[#121226] rounded-xl flex flex-col justify-between print-avoid-break print:p-3 print:bg-white print:border-slate-300"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-[#202042] text-slate-600 dark:text-slate-300 print:border print:border-slate-300">
                        {p.work_group || 'โครงการหลัก'}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary-500/10 text-primary-600 dark:text-primary-400 print:border print:border-primary-300">
                        {p.status}
                      </span>
                    </div>

                    <h3
                      className="text-sm font-bold text-slate-900 dark:text-white line-clamp-2 leading-snug mb-1 print:text-[9.5pt] print:line-clamp-none"
                      title={p.name}
                    >
                      {p.name}
                    </h3>

                    {p.location && (
                      <p className="text-[11px] text-slate-400 truncate mb-2 print:text-[8pt] print:text-slate-500">📍 {p.location}</p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-[#202042] space-y-2 mt-2 print:pt-2 print:border-slate-200">
                    {/* Budget & Progress */}
                    <div className="flex items-center justify-between text-xs print:text-[8.5pt]">
                      <span className="text-slate-400 text-[11px] print:text-[8pt] print:text-slate-500">งบประมาณ:</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {p.budget ? `฿${p.budget.toLocaleString()}` : '-'}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-bold print:text-[8pt]">
                        <span className="text-slate-400 print:text-slate-500">ความคืบหน้า</span>
                        <span className="text-primary-600 dark:text-primary-400">{progressPct}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 dark:bg-[#202042] rounded-full overflow-hidden print:bg-slate-200">
                        <div
                          className="h-full bg-primary-600 rounded-full transition-all duration-300"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>

                    <div className="pt-1 flex justify-end print:hidden">
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
                className="card border border-slate-200 dark:border-[#202042] bg-white dark:bg-[#121226] rounded-2xl overflow-hidden shadow-2xs print-avoid-break print:bg-white print:border-slate-300"
              >
                {/* Group Header */}
                <div className="p-4 bg-slate-50/70 dark:bg-[#16162e] border-b border-slate-100 dark:border-[#202042] flex items-center justify-between gap-3 print-avoid-break-after print:bg-slate-100 print:py-2.5 print:px-3">
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => toggleGroupCollapse(group.id)}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer print:hidden"
                    >
                      {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                    </button>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getGroupBadgeColor(group.color)} print:border-slate-300 print:bg-slate-200/50 print:text-slate-800`}>
                      📁 {group.name}
                    </span>
                    <span className="text-xs font-semibold text-slate-400 print:text-[8pt] print:text-slate-500">
                      ({groupTasks.length} งาน)
                    </span>
                    {canEdit && groupTasks.length > 1 && (
                      <span className="hidden sm:inline-flex items-center text-[11px] text-slate-400 dark:text-slate-500 font-medium print:hidden">
                        • ลากการ์ดหรือกดลูกศร ◀ ▶ เพื่อสลับลำดับ
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 print:hidden">
                    {/* Reorder Group Controls */}
                    {canEdit && supervisorGroups.length > 1 && (
                      <div className="flex items-center gap-0.5 bg-white dark:bg-[#181834] p-0.5 rounded-lg border border-slate-200 dark:border-[#252548] shadow-2xs mr-1">
                        <button
                          type="button"
                          disabled={gIdx === 0}
                          onClick={() => handleMoveGroup(group.id, 'up')}
                          className="p-1 rounded text-slate-500 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-slate-100 dark:hover:bg-[#202042] disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer transition-colors"
                          title="เลื่อนกลุ่มนี้ขึ้นด้านบน"
                        >
                          <ArrowUp size={13} />
                        </button>
                        <button
                          type="button"
                          disabled={gIdx === supervisorGroups.length - 1}
                          onClick={() => handleMoveGroup(group.id, 'down')}
                          className="p-1 rounded text-slate-500 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-slate-100 dark:hover:bg-[#202042] disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer transition-colors"
                          title="เลื่อนกลุ่มนี้ลงด้านล่าง"
                        >
                          <ArrowDown size={13} />
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
                  <div className="p-4 sm:p-5 print:p-2.5">
                    {groupTasks.length === 0 ? (
                      <div className="text-center py-6 text-xs text-slate-400 italic">
                        ยังไม่มีงานในกลุ่มนี้ — คลิก &quot;เพิ่มงานในกลุ่มนี้&quot; เพื่อเริ่มบันทึก
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 print-grid-2">
                        {groupTasks.map((t, tIdx) => {
                          const coverPhoto = t.photo_urls && t.photo_urls.length > 0 ? t.photo_urls[0] : null
                          const isCompleted = t.status === 'completed'
                          const isDelayed = t.status === 'delayed'
                          const isBeingDragged = draggedTaskId === t.id
                          const isDropTarget = dragOverTaskId === t.id && draggedTaskId !== t.id

                          return (
                            <div
                              key={t.id}
                              draggable={canEdit}
                              onDragStart={(e) => {
                                if (!canEdit) return
                                e.dataTransfer.setData('text/plain', t.id)
                                e.dataTransfer.effectAllowed = 'move'
                                setDraggedTaskId(t.id)
                                setIsDraggingState(true)
                              }}
                              onDragOver={(e) => {
                                if (!canEdit || !draggedTaskId) return
                                e.preventDefault()
                                e.dataTransfer.dropEffect = 'move'
                                if (dragOverTaskId !== t.id) {
                                  setDragOverTaskId(t.id)
                                }
                              }}
                              onDragLeave={() => {
                                if (dragOverTaskId === t.id) {
                                  setDragOverTaskId(null)
                                }
                              }}
                              onDrop={(e) => {
                                e.preventDefault()
                                if (!canEdit || !draggedTaskId) return
                                if (draggedTaskId !== t.id) {
                                  handleDropTask(group.id, draggedTaskId, t.id)
                                }
                                setDraggedTaskId(null)
                                setDragOverTaskId(null)
                                setTimeout(() => setIsDraggingState(false), 80)
                              }}
                              onDragEnd={() => {
                                setDraggedTaskId(null)
                                setDragOverTaskId(null)
                                setTimeout(() => setIsDraggingState(false), 80)
                              }}
                              onClick={() => {
                                if (isDraggingState) return
                                setSelectedTaskForDetail(t)
                              }}
                              className={`group relative bg-slate-50/70 dark:bg-[#16162e] hover:bg-white dark:hover:bg-[#1a1a38] border rounded-xl overflow-hidden shadow-2xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between print-avoid-break print:bg-white print:border-slate-300 ${
                                isBeingDragged
                                  ? 'opacity-40 scale-[0.98] ring-2 ring-primary-500 border-dashed border-primary-500'
                                  : isDropTarget
                                  ? 'ring-2 ring-primary-500 ring-offset-2 dark:ring-offset-[#121226] scale-[1.01] border-primary-500 bg-primary-50/20'
                                  : 'border-slate-200/80 dark:border-[#202042] hover:border-primary-400 dark:hover:border-primary-500'
                              }`}
                            >
                              <div>
                                {/* Card Cover Photo */}
                                {coverPhoto ? (
                                  <div className="relative aspect-16/10 w-full overflow-hidden bg-slate-200 dark:bg-[#181834] print:h-28 print:aspect-auto">
                                    <img
                                      src={coverPhoto}
                                      alt={t.title}
                                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 print-task-photo"
                                    />
                                    {t.photo_urls.length > 1 && (
                                      <span className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded print:hidden">
                                        📷 +{t.photo_urls.length - 1}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <div className="h-1.5 w-full bg-slate-200 dark:bg-[#202042] print:hidden" />
                                )}

                                {/* Card Content */}
                                <div className="p-3.5 space-y-2 print:p-2.5 print:space-y-1.5">
                                  {/* Status Badges & Drag Grip */}
                                  <div className="flex items-center justify-between gap-1 flex-wrap">
                                    <div className="flex items-center gap-1.5">
                                      {canEdit && groupTasks.length > 1 && (
                                        <div
                                          className="p-1 -ml-1 rounded text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-slate-100 dark:hover:bg-[#202042] cursor-grab active:cursor-grabbing transition-colors print:hidden"
                                          title="คลิกลากเพื่อสลับลำดับผลงาน"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <GripVertical size={13} />
                                        </div>
                                      )}
                                      {isCompleted ? (
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-1 print:border-emerald-300 print:text-[8pt]">
                                          <CheckCircle2 size={10} /> สำเร็จแล้ว
                                        </span>
                                      ) : isDelayed ? (
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 inline-flex items-center gap-1 print:border-rose-300 print:text-[8pt]">
                                          <AlertTriangle size={10} /> ล่าช้า
                                        </span>
                                      ) : (
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 print:border-blue-300 print:text-[8pt]">
                                          กำลังทำ
                                        </span>
                                      )}
                                    </div>

                                    {t.has_issue && (
                                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20 flex items-center gap-1 print:border-amber-300 print:text-[8pt]">
                                        ⚠️ มีอุปสรรค
                                      </span>
                                    )}
                                  </div>

                                  {/* Task Title */}
                                  <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2 leading-snug group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors print:text-[9.5pt] print:line-clamp-none">
                                    {t.title}
                                  </h4>

                                  {/* Description for print */}
                                  {t.description && (
                                    <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2 print:block print:line-clamp-none print:text-[8pt] print:text-slate-700 pt-0.5">
                                      {t.description}
                                    </p>
                                  )}

                                  {/* Dates */}
                                  <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 pt-1 print:text-[8pt]">
                                    <Calendar size={11} className="shrink-0" />
                                    <span>
                                      {t.start_date ? formatDate(t.start_date) : '-'}
                                      {t.due_date && t.due_date !== t.start_date ? ` ถึง ${formatDate(t.due_date)}` : ''}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Card Footer / Reorder helper */}
                              <div className="px-3.5 py-2 border-t border-slate-100 dark:border-[#202042] bg-white/50 dark:bg-[#121226]/50 flex items-center justify-between text-[10px] text-slate-400 print:hidden">
                                <span className="group-hover:text-primary-600 font-semibold flex items-center gap-1">
                                  คลิกดูรายละเอียด <Maximize2 size={10} />
                                </span>

                                {canEdit && (
                                  <div
                                    className="flex items-center gap-1.5"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <span
                                      className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#1e1e38] text-[10px] font-bold text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-[#252548]"
                                      title={`ผลงานลำดับที่ ${tIdx + 1} ในกลุ่มนี้`}
                                    >
                                      #{tIdx + 1}
                                    </span>
                                    {groupTasks.length > 1 && (
                                      <div className="inline-flex rounded-lg border border-slate-200 dark:border-[#252548] bg-white dark:bg-[#181834] p-0.5 shadow-2xs">
                                        <button
                                          type="button"
                                          disabled={tIdx === 0}
                                          onClick={() => handleMoveTask(group.id, t.id, 'prev')}
                                          className="p-1 rounded text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-[#202042] disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer transition-colors"
                                          title="เลื่อนมาด้านหน้า (ก่อนหน้านี้)"
                                        >
                                          <ChevronLeft size={13} />
                                        </button>
                                        <button
                                          type="button"
                                          disabled={tIdx === groupTasks.length - 1}
                                          onClick={() => handleMoveTask(group.id, t.id, 'next')}
                                          className="p-1 rounded text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-[#202042] disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer transition-colors"
                                          title="เลื่อนไปด้านหลัง (ถัดไป)"
                                        >
                                          <ChevronRight size={13} />
                                        </button>
                                      </div>
                                    )}
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
          <div className="card border-2 border-dashed border-amber-300 dark:border-amber-700/60 bg-amber-50/40 dark:bg-amber-950/20 rounded-2xl overflow-hidden shadow-2xs print-avoid-break print:bg-white print:border-slate-300 print:border-solid">
            <div className="p-4 bg-amber-100/60 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800/50 flex items-center justify-between gap-3 print-avoid-break-after print:bg-slate-100 print:py-2.5 print:px-3">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border bg-amber-500/20 text-amber-800 dark:text-amber-200 border-amber-400 print:bg-slate-200/50 print:border-slate-300 print:text-slate-800">
                  📁 งานอื่นๆ / รอย้ายกลุ่ม ({orphanTasks.length} งาน)
                </span>
                <span className="text-[11px] text-amber-700 dark:text-amber-300 hidden sm:inline print:hidden">
                  (ภารกิจที่รหัสกลุ่มไม่ตรง สามารถคลิกดูหรือกดแก้ไขเพื่อย้ายเข้ากลุ่มงานที่ต้องการได้)
                </span>
              </div>
            </div>
            <div className="p-4 sm:p-5 print:p-2.5">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 print-grid-2">
                {orphanTasks.map((t, oIdx) => {
                  const coverPhoto = t.photo_urls && t.photo_urls.length > 0 ? t.photo_urls[0] : null
                  const isCompleted = t.status === 'completed'
                  const isDelayed = t.status === 'delayed'

                  return (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTaskForDetail(t)}
                      className="group relative bg-white dark:bg-[#16162e] hover:bg-slate-50 dark:hover:bg-[#1a1a38] border border-amber-200 dark:border-amber-900/50 hover:border-amber-400 rounded-xl overflow-hidden shadow-2xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between print-avoid-break print:bg-white print:border-slate-300"
                    >
                      <div>
                        {coverPhoto ? (
                          <div className="relative aspect-16/10 w-full overflow-hidden bg-slate-200 dark:bg-[#181834] print:h-28 print:aspect-auto">
                            <img
                              src={coverPhoto}
                              alt={t.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 print-task-photo"
                            />
                            {t.photo_urls.length > 1 && (
                              <span className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded print:hidden">
                                +{t.photo_urls.length} รูป
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="h-2 w-full bg-gradient-to-r from-amber-400 to-amber-500 print:hidden" />
                        )}

                        <div className="p-3.5 space-y-2 print:p-2.5 print:space-y-1.5">
                          <div className="flex items-center justify-between gap-1 text-[10px]">
                            <span
                              className={`px-2 py-0.5 rounded-full font-bold ${
                                isCompleted
                                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 print:border print:border-emerald-300'
                                  : isDelayed
                                  ? 'bg-red-500/15 text-red-600 dark:text-red-400 print:border print:border-rose-300'
                                  : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 print:border print:border-amber-300'
                              } print:text-[8pt]`}
                            >
                              {isCompleted ? '✅ สำเร็จแล้ว' : isDelayed ? '⚠️ ล่าช้า' : '⏳ กำลังดำเนินการ'}
                            </span>
                            {t.has_issue && (
                              <span className="px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-600 dark:text-rose-400 font-bold flex items-center gap-0.5 print:border print:border-rose-300 print:text-[8pt]">
                                <AlertTriangle size={9} /> มีปัญหา
                              </span>
                            )}
                          </div>

                          <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2 leading-snug group-hover:text-amber-600 transition-colors print:text-[9.5pt] print:line-clamp-none">
                            {t.title}
                          </h4>

                          {t.description && (
                            <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2 print:block print:line-clamp-none print:text-[8pt] print:text-slate-700 pt-0.5">
                              {t.description}
                            </p>
                          )}

                          <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 pt-1 print:text-[8pt]">
                            <Calendar size={11} className="shrink-0" />
                            <span>
                              {t.start_date ? formatDate(t.start_date) : '-'}
                              {t.due_date && t.due_date !== t.start_date ? ` ถึง ${formatDate(t.due_date)}` : ''}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="px-3.5 py-2 border-t border-slate-100 dark:border-[#202042] bg-white/50 dark:bg-[#121226]/50 flex items-center justify-between text-[10px] text-slate-400 print:hidden">
                        <span className="group-hover:text-amber-600 font-semibold flex items-center gap-1">
                          คลิกดูรายละเอียด <Maximize2 size={10} />
                        </span>
                        <span
                          className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/40 text-[10px] font-bold text-amber-700 dark:text-amber-300 border border-amber-300/60 dark:border-amber-800/60"
                          title={`ลำดับที่ ${oIdx + 1}`}
                        >
                          #{oIdx + 1}
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

      {/* ── Official Print Signature Block (Visible only when printed) ── */}
      <div className="hidden print:block pt-8 mt-6 border-t-2 border-slate-800 print-avoid-break">
        <div className="text-[9pt] text-slate-700 mb-6 text-center italic">
          ขอรับรองว่าข้อมูลผลงานและการปฏิบัติงานทั้งหมดข้างต้น ถูกต้องและเป็นความจริงทุกประการ
        </div>
        <div className="grid grid-cols-2 gap-8 text-center text-[9pt]">
          <div className="space-y-1">
            <p className="font-bold text-slate-800">ลงชื่อ..........................................................</p>
            <p className="text-slate-800 font-semibold">({supervisorName})</p>
            <p className="text-slate-600 text-[8.5pt]">ผู้ควบคุมงาน / ผู้รายงาน</p>
            <p className="text-slate-500 text-[8pt]">วันที่ ...... / ...... / ............</p>
          </div>
          <div className="space-y-1">
            <p className="font-bold text-slate-800">ลงชื่อ..........................................................</p>
            <p className="text-slate-800 font-semibold">(..........................................................)</p>
            <p className="text-slate-600 text-[8.5pt]">หัวหน้าแผนก / ผู้ตรวจสอบ</p>
            <p className="text-slate-500 text-[8pt]">วันที่ ...... / ...... / ............</p>
          </div>
        </div>
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
          key={taskModalState.task?.id || 'new-task'}
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

      {/* Toast Notification for Reordering */}
      {reorderSuccessMsg && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-900/90 dark:bg-white/95 text-white dark:text-slate-900 text-xs font-bold shadow-xl backdrop-blur-sm animate-fade-in border border-slate-700/50 dark:border-slate-200 print:hidden">
          <Check size={14} className="text-emerald-400 dark:text-emerald-600" />
          <span>{reorderSuccessMsg}</span>
        </div>
      )}
    </div>
  )
}
