'use client'

import { useState, useMemo, useEffect } from 'react'
import type { Project, WBSTask, Inspection, ProjectMilestone, ContractAmendment } from '@/lib/types'
import type { UserSession } from '@/lib/auth'
import {
  Search,
  CheckSquare,
  Square,
  X,
  GripVertical,
  Sun,
  Moon,
  Save,
  Trash2,
  SlidersHorizontal,
} from 'lucide-react'
import { computeTaskDates } from '@/lib/scheduler'
import { PresentationEngine } from './presentation/PresentationEngine'
import { PhotoManagerModal } from './presentation/PhotoManagerModal'

interface Props {
  initialProjects: Project[]
  initialTasks: WBSTask[]
  initialInspections: Inspection[]
  initialMilestones: ProjectMilestone[]
  initialDailyReports?: { project_id: string; photos: any[]; created_at: string }[]
  initialConcretePours?: { project_id: string; photos: any[]; created_at: string }[]
  initialAmendments?: ContractAmendment[]
  user?: UserSession | null
  workGroups?: string[]
}

export type SelectedProjectSlide = {
  projectId: string
  showOverview: boolean
  showGantt: boolean
  showSCurve: boolean
  showPhotos: boolean
  selectedPhotoUrls: string[] // User can choose which 4 photos to show
  availablePhotoUrls?: string[] // All available photos for this project
}

type Preset = {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  selectedSlides: SelectedProjectSlide[]
}

const ALL_STATUSES = [
  'ออกแบบ สำรวจ ประมาณการ',
  'จัดซื้อจัดจ้าง',
  'รอดำเนินการ',
  'กำลังดำเนินการ',
  'ระงับ',
  'เสร็จสิ้น',
]

export function PresentationClient({
  initialProjects,
  initialTasks,
  initialInspections,
  initialMilestones,
  initialDailyReports = [],
  initialConcretePours = [],
  initialAmendments = [],
  user,
  workGroups = ['งานงบลงทุนเร่งด่วน', 'งานแผนสนับสนุน'],
}: Props) {
  const [projects] = useState<Project[]>(initialProjects)

  // Theme state
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  // Presets state
  const [presets, setPresets] = useState<Preset[]>([])

  // Filtering states matching ProjectsClient.tsx
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSupervisors, setSelectedSupervisors] = useState<string[]>([])
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([
    'กำลังดำเนินการ',
    'ออกแบบ สำรวจ ประมาณการ',
    'จัดซื้อจัดจ้าง',
    'รอดำเนินการ',
    'ระงับ',
  ])
  const [selectedWorkGroups, setSelectedWorkGroups] = useState<string[]>([])

  // Dropdown open states
  const [supervisorOpen, setSupervisorOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [workGroupOpen, setWorkGroupOpen] = useState(false)

  // Selection states
  const [selectedSlides, setSelectedSlides] = useState<SelectedProjectSlide[]>([])

  // Global slide toggles (UI state only)
  const [globalToggles, setGlobalToggles] = useState({
    showOverview: true,
    showGantt: true,
    showSCurve: true,
    showPhotos: true,
  })

  // UI states
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [managingPhotosFor, setManagingPhotosFor] = useState<string | null>(null) // projectId

  // Load stored preferences
  useEffect(() => {
    const savedTheme = localStorage.getItem('presentation_theme')
    if (savedTheme === 'light' || savedTheme === 'dark') setTheme(savedTheme)

    const savedPresets = localStorage.getItem('presentation_presets')
    if (savedPresets) {
      try {
        setPresets(JSON.parse(savedPresets))
      } catch (err) {}
    }
  }, [])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('presentation_theme', next)
  }

  // Presets logic
  const handleSavePreset = () => {
    const existing = presets.find(
      (p) =>
        p.selectedSlides.length === selectedSlides.length &&
        p.selectedSlides.every((s, i) => s.projectId === selectedSlides[i]?.projectId)
    )

    let defaultName = 'ชุดการนำเสนอใหม่'
    if (existing) {
      if (
        confirm(
          `คุณต้องการบันทึกทับชุดการนำเสนอ "${existing.name}" ใช่หรือไม่? (ยกเลิกเพื่อบันทึกเป็นชื่อใหม่)`
        )
      ) {
        const updated = presets.map((p) =>
          p.id === existing.id
            ? { ...p, selectedSlides, updatedAt: new Date().toISOString() }
            : p
        )
        setPresets(updated)
        localStorage.setItem('presentation_presets', JSON.stringify(updated))
        alert('บันทึกทับเรียบร้อยแล้ว')
        return
      }
    }

    const name = prompt('ตั้งชื่อชุดการนำเสนอ:', defaultName)
    if (!name) return

    const newPreset: Preset = {
      id: Date.now().toString(),
      name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      selectedSlides,
    }
    const updated = [newPreset, ...presets]
    setPresets(updated)
    localStorage.setItem('presentation_presets', JSON.stringify(updated))
    alert('บันทึกชุดการนำเสนอใหม่เรียบร้อยแล้ว')
  }

  const handleLoadPreset = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    if (!val) return
    const p = presets.find((x) => x.id === val)
    if (p) setSelectedSlides(p.selectedSlides)
    e.target.value = '' // reset dropdown
  }

  const handleDeletePreset = (id: string, name: string) => {
    if (!confirm(`ยืนยันการลบชุดนำเสนอ "${name}"?`)) return
    const updated = presets.filter((p) => p.id !== id)
    setPresets(updated)
    localStorage.setItem('presentation_presets', JSON.stringify(updated))
  }

  // Derived supervisors list for dropdown
  const supervisors = useMemo(
    () =>
      [
        ...new Set(
          projects.flatMap((p) => (p.supervisor || '').split(',').map((s) => s.trim()).filter(Boolean))
        ),
      ].sort(),
    [projects]
  )

  // Derived filtered projects matching ProjectsClient.tsx
  const filteredProjects = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    return projects.filter((p) => {
      const pSupervisors = (p.supervisor || '').split(',').map((s) => s.trim()).filter(Boolean)
      const matchSupervisor =
        selectedSupervisors.length === 0 ||
        pSupervisors.some((s) => selectedSupervisors.includes(s))
      const matchStatus =
        selectedStatuses.length === 0 || selectedStatuses.includes(p.status)
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
  }, [projects, selectedSupervisors, selectedStatuses, selectedWorkGroups, searchQuery])

  // Stats summary for header counters
  const stats = useMemo(
    () => ({
      total: projects.length,
      active: projects.filter((p) => p.status === 'กำลังดำเนินการ').length,
      done: projects.filter((p) => p.status === 'เสร็จสิ้น').length,
      paused: projects.filter((p) => p.status === 'ระงับ').length,
      pending: projects.filter((p) => p.status === 'รอดำเนินการ').length,
    }),
    [projects]
  )

  // Precompute progress
  const projectProgress = useMemo(() => {
    const map: Record<string, number> = {}
    projects.forEach((p) => {
      const pTasks = initialTasks.filter((t) => t.project_id === p.id)
      if (pTasks.length === 0) {
        map[p.id] = p.progress || 0
        return
      }
      const scheduledTasks = computeTaskDates(pTasks, p.start_date)
      const totalCost = scheduledTasks.reduce((s, t) => s + (Number(t.cost) || 0), 0)

      let ev = 0
      if (totalCost > 0) {
        scheduledTasks.forEach((t) => {
          ev += (t.actual_progress || 0) * ((Number(t.cost) || 0) / totalCost)
        })
      } else {
        scheduledTasks.forEach((t) => {
          ev += (t.actual_progress || 0) / scheduledTasks.length
        })
      }
      map[p.id] = ev
    })
    return map
  }, [projects, initialTasks])

  // Handlers
  const applyGlobalToggles = (key: keyof typeof globalToggles, val: boolean) => {
    const nextToggles = { ...globalToggles, [key]: val }
    setGlobalToggles(nextToggles)
    setSelectedSlides((prev) => prev.map((s) => ({ ...s, [key]: val })))
  }

  const getProjectPhotos = (projectId: string) => {
    const pInspections = initialInspections.filter((i) => i.project_id === projectId)
    const inspectionPhotos = pInspections.flatMap((i) => i.photo_urls || []).map((raw) => raw.split('|||')[0])

    const pDaily = initialDailyReports.filter((d) => d.project_id === projectId)
    const dailyPhotos = pDaily.flatMap((d) => d.photos || []).map((p) => (typeof p === 'string' ? p : p.url || ''))

    const pConcrete = initialConcretePours.filter((c) => c.project_id === projectId)
    const concretePhotos = pConcrete.flatMap((c) => c.photos || []).map((p) => (typeof p === 'string' ? p : p.url || ''))

    const defaultSelected = inspectionPhotos.slice(0, 4)
    const allPhotos = Array.from(new Set([...inspectionPhotos, ...dailyPhotos, ...concretePhotos])).filter(Boolean)

    return { defaultSelected, allPhotos }
  }

  const toggleProjectSelection = (projectId: string) => {
    setSelectedSlides((prev) => {
      const exists = prev.find((p) => p.projectId === projectId)
      if (exists) return prev.filter((p) => p.projectId !== projectId)

      const { defaultSelected, allPhotos } = getProjectPhotos(projectId)

      return [
        ...prev,
        {
          projectId,
          showOverview: globalToggles.showOverview,
          showGantt: globalToggles.showGantt,
          showSCurve: globalToggles.showSCurve,
          showPhotos: globalToggles.showPhotos,
          selectedPhotoUrls: defaultSelected,
          availablePhotoUrls: allPhotos,
        },
      ]
    })
  }

  const selectAll = () => {
    const newSelections = filteredProjects.map((p) => {
      const exists = selectedSlides.find((s) => s.projectId === p.id)
      if (exists) return exists

      const { defaultSelected, allPhotos } = getProjectPhotos(p.id)
      return {
        projectId: p.id,
        showOverview: globalToggles.showOverview,
        showGantt: globalToggles.showGantt,
        showSCurve: globalToggles.showSCurve,
        showPhotos: globalToggles.showPhotos,
        selectedPhotoUrls: defaultSelected,
        availablePhotoUrls: allPhotos,
      }
    })

    const existingNotInView = selectedSlides.filter(
      (s) => !filteredProjects.find((fp) => fp.id === s.projectId)
    )
    setSelectedSlides([...existingNotInView, ...newSelections])
  }

  const clearSelection = () => {
    setSelectedSlides([])
  }

  const toggleSlideOption = (
    projectId: string,
    option: keyof Omit<SelectedProjectSlide, 'projectId' | 'selectedPhotoUrls'>
  ) => {
    setSelectedSlides((prev) =>
      prev.map((s) => {
        if (s.projectId === projectId) {
          return { ...s, [option]: !s[option] }
        }
        return s
      })
    )
  }

  // Drag and drop sorting
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null)

  const handleDragStart = (e: React.DragEvent, idx: number) => {
    setDraggedIdx(idx)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    if (draggedIdx === null || draggedIdx === idx) return

    const newArr = [...selectedSlides]
    const [draggedItem] = newArr.splice(draggedIdx, 1)
    newArr.splice(idx, 0, draggedItem)

    setSelectedSlides(newArr)
    setDraggedIdx(null)
  }

  if (isFullScreen) {
    return (
      <PresentationEngine
        projects={projects}
        tasks={initialTasks}
        milestones={initialMilestones}
        amendments={initialAmendments}
        inspections={initialInspections}
        selectedSlides={selectedSlides}
        theme={theme}
        onExit={() => setIsFullScreen(false)}
      />
    )
  }

  return (
    <div className="flex-1 flex gap-6 h-[calc(100vh-140px)] print:hidden">
      {/* Left Panel: Filters & Projects */}
      <div className="flex-1 flex flex-col bg-white dark:bg-[#14142a] rounded-2xl shadow-sm border border-slate-200 dark:border-[#1c1c34] overflow-hidden">
        {/* Top Header Bar */}
        <div className="p-4 border-b border-slate-200 dark:border-[#1c1c34] space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <h2 className="font-bold text-slate-800 dark:text-white text-base">ตัวกรองและคัดเลือกโครงการ</h2>
              <div className="hidden sm:flex items-center gap-2 text-xs font-bold">
                <span className="bg-primary-50 dark:bg-primary-950/40 text-primary-600 px-2 py-0.5 rounded-md">
                  ทั้งหมด {stats.total}
                </span>
                <span className="bg-amber-50 dark:bg-amber-950/40 text-amber-600 px-2 py-0.5 rounded-md">
                  กำลังทำ {stats.active}
                </span>
                <span className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 px-2 py-0.5 rounded-md">
                  เสร็จสิ้น {stats.done}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <select
                  className="px-3 py-1.5 bg-slate-50 dark:bg-[#0a0a14] border border-slate-200 dark:border-[#252548] rounded-lg text-xs outline-none max-w-[150px]"
                  onChange={handleLoadPreset}
                  defaultValue=""
                >
                  <option value="" disabled>📂 โหลดชุดนำเสนอ...</option>
                  {presets.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                {presets.length > 0 && (
                  <button
                    onClick={() => {
                      const sel = document.querySelector('select[defaultValue=""]') as HTMLSelectElement
                      if (sel && sel.value) handleDeletePreset(sel.value, sel.options[sel.selectedIndex].text)
                    }}
                    className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                    title="ลบชุดนำเสนอที่เลือก"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>

              <button
                onClick={handleSavePreset}
                disabled={selectedSlides.length === 0}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-[#1c1c34] hover:bg-slate-200 dark:hover:bg-[#252548] disabled:opacity-50 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                <Save size={14} /> บันทึกชุดการนำเสนอ
              </button>

              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg bg-slate-100 dark:bg-[#1c1c34] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#252548] cursor-pointer"
                title={theme === 'dark' ? 'สลับเป็นโหมดสว่าง' : 'สลับเป็นโหมดมืด'}
              >
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </button>
            </div>
          </div>

          {/* ── Dropdown Filters Row (Matching ProjectsClient.tsx) ── */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 min-w-48">
              <Search
                size={15}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-600 pointer-events-none"
              />
              <input
                type="text"
                placeholder="ค้นหาโครงการ, ผู้ควบคุม, สถานที่..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-[#0a0a14] border border-slate-200 dark:border-[#252548] rounded-xl text-xs font-medium outline-none focus:border-primary-500"
              />
            </div>

            {/* 1. Supervisor Multi-Select Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setSupervisorOpen(!supervisorOpen)
                  setStatusOpen(false)
                  setWorkGroupOpen(false)
                }}
                className="px-3 py-2 bg-slate-50 dark:bg-[#0a0a14] border border-slate-200 dark:border-[#252548] rounded-xl text-xs font-semibold text-left flex items-center justify-between gap-2 min-w-44 text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                <SlidersHorizontal size={14} className="text-slate-400 shrink-0" />
                <span className="truncate flex-1">
                  {selectedSupervisors.length === 0
                    ? 'ผู้ควบคุมทั้งหมด'
                    : `ผู้ควบคุม (${selectedSupervisors.length} คน)`}
                </span>
                <span className="text-[10px] text-slate-400">▼</span>
              </button>

              {supervisorOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setSupervisorOpen(false)} />
                  <div className="absolute left-0 mt-1.5 w-64 bg-white dark:bg-[#13132a] border border-slate-200 dark:border-[#252548] rounded-xl shadow-xl z-20 p-3 max-h-60 overflow-y-auto">
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
                                  setSelectedSupervisors(selectedSupervisors.filter((x) => x !== s))
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

            {/* 2. Status Multi-Select Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setStatusOpen(!statusOpen)
                  setSupervisorOpen(false)
                  setWorkGroupOpen(false)
                }}
                className="px-3 py-2 bg-slate-50 dark:bg-[#0a0a14] border border-slate-200 dark:border-[#252548] rounded-xl text-xs font-semibold text-left flex items-center justify-between gap-2 min-w-40 text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                <SlidersHorizontal size={14} className="text-slate-400 shrink-0" />
                <span className="truncate flex-1">
                  {selectedStatuses.length === 0
                    ? 'สถานะทั้งหมด'
                    : `สถานะ (${selectedStatuses.length})`}
                </span>
                <span className="text-[10px] text-slate-400">▼</span>
              </button>

              {statusOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setStatusOpen(false)} />
                  <div className="absolute left-0 mt-1.5 w-64 bg-white dark:bg-[#13132a] border border-slate-200 dark:border-[#252548] rounded-xl shadow-xl z-20 p-3 max-h-60 overflow-y-auto">
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
                                  setSelectedStatuses(selectedStatuses.filter((x) => x !== st))
                                }
                              }}
                              className="w-4 h-4 rounded text-primary-600 border-slate-300 dark:border-slate-700 focus:ring-primary-500 cursor-pointer"
                            />
                            <span className="truncate">{st}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* 3. Work Group Multi-Select Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setWorkGroupOpen(!workGroupOpen)
                  setSupervisorOpen(false)
                  setStatusOpen(false)
                }}
                className="px-3 py-2 bg-slate-50 dark:bg-[#0a0a14] border border-slate-200 dark:border-[#252548] rounded-xl text-xs font-semibold text-left flex items-center justify-between gap-2 min-w-40 text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                <SlidersHorizontal size={14} className="text-slate-400 shrink-0" />
                <span className="truncate flex-1">
                  {selectedWorkGroups.length === 0
                    ? 'กลุ่มงานทั้งหมด'
                    : `กลุ่มงาน (${selectedWorkGroups.length})`}
                </span>
                <span className="text-[10px] text-slate-400">▼</span>
              </button>

              {workGroupOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setWorkGroupOpen(false)} />
                  <div className="absolute left-0 mt-1.5 w-64 bg-white dark:bg-[#13132a] border border-slate-200 dark:border-[#252548] rounded-xl shadow-xl z-20 p-3 max-h-60 overflow-y-auto">
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
                                  setSelectedWorkGroups(selectedWorkGroups.filter((x) => x !== wg))
                                }
                              }}
                              className="w-4 h-4 rounded text-primary-600 border-slate-300 dark:border-slate-700 focus:ring-primary-500 cursor-pointer"
                            />
                            <span className="truncate">{wg}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Project Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold text-slate-700 dark:text-slate-200 text-sm">
              รายการโครงการ ({filteredProjects.length})
            </h2>
            <div className="space-x-3">
              <button onClick={selectAll} className="text-xs text-primary-600 hover:underline font-bold">
                เลือกทั้งหมด
              </button>
              <button onClick={clearSelection} className="text-xs text-slate-500 hover:underline">
                ล้างการเลือก
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredProjects.map((p) => {
              const isSelected = selectedSlides.some((s) => s.projectId === p.id)
              return (
                <div
                  key={p.id}
                  onClick={() => toggleProjectSelection(p.id)}
                  className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-900/10'
                      : 'border-slate-200 dark:border-[#252548] hover:border-primary-300 dark:hover:border-primary-700 bg-white dark:bg-[#1a1a32]'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-xs line-clamp-2 pr-2 text-slate-900 dark:text-white">{p.name}</h3>
                    {isSelected ? (
                      <CheckSquare className="text-primary-500 shrink-0" size={18} />
                    ) : (
                      <Square className="text-slate-300 shrink-0" size={18} />
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-3 pt-2 border-t border-slate-100 dark:border-[#252548]">
                    <span>ความก้าวหน้า: {(projectProgress[p.id] || 0).toFixed(1)}%</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">{p.status}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Right Panel: Selected Slides */}
      <div className="w-[380px] flex flex-col bg-white dark:bg-[#14142a] rounded-2xl shadow-sm border border-slate-200 dark:border-[#1c1c34] overflow-hidden flex-shrink-0">
        <div className="p-4 border-b border-slate-200 dark:border-[#1c1c34] bg-slate-50 dark:bg-[#0a0a14] flex justify-between items-center">
          <h2 className="font-bold text-slate-800 dark:text-white text-sm">
            ลำดับสไลด์ที่จะนำเสนอ ({selectedSlides.length})
          </h2>
          {selectedSlides.length > 0 && (
            <button
              onClick={() => setIsFullScreen(true)}
              className="btn-primary px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer shadow-md"
            >
              ▶ เริ่มนำเสนอ
            </button>
          )}
        </div>

        {/* Global Slide Settings */}
        <div className="p-3 mx-4 mt-4 bg-slate-50 dark:bg-[#0a0a14] border border-slate-200 dark:border-[#252548] rounded-xl text-xs">
          <div className="font-bold text-slate-700 dark:text-slate-300 mb-2">เลือกประเภทสไลด์สำหรับทุกโครงการ</div>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={globalToggles.showOverview}
                onChange={(e) => applyGlobalToggles('showOverview', e.target.checked)}
              />
              <span className="text-slate-600 dark:text-slate-400">ภาพรวม+EVM</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={globalToggles.showGantt}
                onChange={(e) => applyGlobalToggles('showGantt', e.target.checked)}
              />
              <span className="text-slate-600 dark:text-slate-400">แผนผัง Gantt</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={globalToggles.showSCurve}
                onChange={(e) => applyGlobalToggles('showSCurve', e.target.checked)}
              />
              <span className="text-slate-600 dark:text-slate-400">S-Curve</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={globalToggles.showPhotos}
                onChange={(e) => applyGlobalToggles('showPhotos', e.target.checked)}
              />
              <span className="text-slate-600 dark:text-slate-400">รูปภาพ</span>
            </label>
          </div>
        </div>

        {/* Selected List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {selectedSlides.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs font-semibold">
              ยังไม่ได้เลือกโครงการ <br />
              <span className="text-[10px] text-slate-500 mt-1 block">คลิกที่การ์ดโครงการด้านซ้ายเพื่อเพิ่มลงในสไลด์</span>
            </div>
          ) : (
            selectedSlides.map((slide, idx) => {
              const project = projects.find((p) => p.id === slide.projectId)
              if (!project) return null

              return (
                <div
                  key={slide.projectId}
                  draggable
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={(e) => handleDrop(e, idx)}
                  className="p-3 bg-slate-50 dark:bg-[#1c1c34] border border-slate-200 dark:border-[#252548] rounded-xl space-y-2 cursor-grab active:cursor-grabbing hover:border-primary-500 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <GripVertical size={14} className="text-slate-400 shrink-0" />
                      <span className="font-bold text-xs truncate text-slate-900 dark:text-white">
                        {idx + 1}. {project.name}
                      </span>
                    </div>
                    <button
                      onClick={() => toggleProjectSelection(project.id)}
                      className="text-slate-400 hover:text-red-500 p-1 cursor-pointer"
                      title="เอาออก"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2 text-[10px] pt-1 border-t border-slate-200/50 dark:border-[#252548]">
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={slide.showOverview}
                        onChange={() => toggleSlideOption(project.id, 'showOverview')}
                      />
                      <span>ภาพรวม</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={slide.showGantt}
                        onChange={() => toggleSlideOption(project.id, 'showGantt')}
                      />
                      <span>Gantt</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={slide.showSCurve}
                        onChange={() => toggleSlideOption(project.id, 'showSCurve')}
                      />
                      <span>S-Curve</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={slide.showPhotos}
                        onChange={() => toggleSlideOption(project.id, 'showPhotos')}
                      />
                      <span>รูปภาพ</span>
                    </label>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
