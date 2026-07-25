'use client'

import { useState, useMemo } from 'react'
import { Plus, Search, SlidersHorizontal, FolderOpen, Building2, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { ProjectCard } from './ProjectCard'
import { CreateProjectModal } from './CreateProjectModal'
import { AIAssistantSection } from './ai/AIAssistantSection'
import type { Project, WBSTask, ContractAmendment } from '@/lib/types'
import type { UserSession } from '@/lib/auth'

interface ProjectsClientProps {
  initialProjects: Project[]
  initialTasks: WBSTask[]
  amendments?: ContractAmendment[]
  user?: UserSession | null
  aiEnabled?: boolean
}

export function ProjectsClient({ initialProjects, initialTasks, amendments = [], user, aiEnabled = false }: ProjectsClientProps) {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedSupervisors, setSelectedSupervisors] = useState<string[]>([])
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
  const [supervisorOpen, setSupervisorOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

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
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.supervisor.toLowerCase().includes(q) ||
        p.location?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q)
      return matchSupervisor && matchStatus && matchSearch
    })
  }, [initialProjects, selectedSupervisors, selectedStatuses, searchQuery])

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

  return (
    <>
      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
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
      <div className="flex flex-wrap items-center gap-3 mb-5">
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
                      "รอดำเนินการ",
                      "กำลังดำเนินการ",
                      "เสร็จสิ้น",
                      "ระงับ",
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

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href="/portfolio"
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-[#1a1a36] border border-slate-200 dark:border-[#252548] hover:bg-slate-50 dark:hover:bg-[#252548] transition-colors cursor-pointer"
          >
            <TrendingUp size={16} className="text-primary-600 dark:text-primary-400" />
            ภาพรวมทุกโครงการ
          </Link>

          {user && (user.role === 'admin' || user.role === 'editor') && (
            <button
              id="create-project-btn"
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold text-white btn-primary flex-shrink-0 cursor-pointer"
            >
              <Plus size={16} />
              สร้างโครงการใหม่
            </button>
          )}
        </div>
      </div>

      {/* ── Filter result count ── */}
      {(searchQuery || selectedSupervisors.length > 0 || selectedStatuses.length > 0) && (
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          แสดง{' '}
          <span className="font-bold text-primary-600 dark:text-primary-400">
            {filtered.length}
          </span>{' '}
          จาก {initialProjects.length} โครงการ
        </p>
      )}

      {/* ── Projects grid ── */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              tasks={initialTasks.filter((t) => t.project_id === project.id)}
              amendments={amendments.filter((a) => a.project_id === project.id)}
              user={user}
            />
          ))}
        </div>
      ) : (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-20 h-20 rounded-2xl bg-primary-600/10 dark:bg-primary-600/15 flex items-center justify-center mb-5">
            {searchQuery || selectedSupervisors.length > 0 || selectedStatuses.length > 0 ? (
              <Search size={36} className="text-primary-600 dark:text-primary-400 opacity-70" />
            ) : (
              <Building2 size={36} className="text-primary-600 dark:text-primary-400 opacity-70" />
            )}
          </div>
          <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-2">
            {searchQuery || selectedSupervisors.length > 0 || selectedStatuses.length > 0
              ? 'ไม่พบโครงการที่ตรงเงื่อนไข'
              : 'ยังไม่มีโครงการในระบบ'}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-6 leading-relaxed">
            {searchQuery || selectedSupervisors.length > 0 || selectedStatuses.length > 0
              ? 'ลองเปลี่ยนคำค้นหาหรือเลือกสถานะ/ผู้ควบคุมงานอื่น'
              : 'เริ่มต้นโดยการเพิ่มโครงการก่อสร้างโครงการแรกของคุณ'}
          </p>
          {!searchQuery && selectedSupervisors.length === 0 && selectedStatuses.length === 0 && user && (user.role === 'admin' || user.role === 'editor') && (
            <button
              onClick={() => setShowCreateModal(true)}
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
        <CreateProjectModal onClose={() => setShowCreateModal(false)} />
      )}

      {/* ── AI Assistant Section ── */}
      {aiEnabled && (
        <AIAssistantSection projects={initialProjects} user={user} />
      )}
    </>
  )
}
