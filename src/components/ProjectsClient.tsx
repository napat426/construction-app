'use client'

import { useState, useMemo } from 'react'
import { Plus, Search, SlidersHorizontal, FolderOpen, Building2, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { ProjectCard } from './ProjectCard'
import { CreateProjectModal } from './CreateProjectModal'
import type { Project, WBSTask } from '@/lib/types'
import type { UserSession } from '@/lib/auth'

interface ProjectsClientProps {
  initialProjects: Project[]
  initialTasks: WBSTask[]
  user?: UserSession | null
}

export function ProjectsClient({ initialProjects, initialTasks, user }: ProjectsClientProps) {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedSupervisor, setSelectedSupervisor] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  /* ── Derived data ── */
  const supervisors = useMemo(
    () => [...new Set(initialProjects.map((p) => p.supervisor))].sort(),
    [initialProjects]
  )

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    return initialProjects.filter((p) => {
      const matchSupervisor =
        selectedSupervisor === 'all' || p.supervisor === selectedSupervisor
      const matchStatus =
        selectedStatus === 'all' || p.status === selectedStatus
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.supervisor.toLowerCase().includes(q) ||
        p.location?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q)
      return matchSupervisor && matchStatus && matchSearch
    })
  }, [initialProjects, selectedSupervisor, selectedStatus, searchQuery])

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

        {/* Supervisor filter */}
        <div className="relative">
          <SlidersHorizontal
            size={14}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-600 pointer-events-none"
          />
          <select
            id="filter-supervisor"
            value={selectedSupervisor}
            onChange={(e) => setSelectedSupervisor(e.target.value)}
            className="input-base appearance-none cursor-pointer min-w-56 pr-8"
            style={{ paddingLeft: "2.5rem" }}
          >
            <option value="all">ผู้ควบคุมทั้งหมด</option>
            {supervisors.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {/* Status filter */}
        <div className="relative">
          <SlidersHorizontal
            size={14}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-600 pointer-events-none"
          />
          <select
            id="filter-status"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="input-base appearance-none cursor-pointer min-w-48 pr-8"
            style={{ paddingLeft: "2.5rem" }}
          >
            <option value="all">สถานะทั้งหมด</option>
            <option value="รอดำเนินการ">รอดำเนินการ</option>
            <option value="กำลังดำเนินการ">กำลังดำเนินการ</option>
            <option value="เสร็จสิ้น">เสร็จสิ้น</option>
            <option value="ระงับ">ระงับ</option>
          </select>
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
      {(searchQuery || selectedSupervisor !== 'all' || selectedStatus !== 'all') && (
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
              user={user}
            />
          ))}
        </div>
      ) : (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-20 h-20 rounded-2xl bg-primary-600/10 dark:bg-primary-600/15 flex items-center justify-center mb-5">
            {searchQuery || selectedSupervisor !== 'all' || selectedStatus !== 'all' ? (
              <Search size={36} className="text-primary-600 dark:text-primary-400 opacity-70" />
            ) : (
              <Building2 size={36} className="text-primary-600 dark:text-primary-400 opacity-70" />
            )}
          </div>
          <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-2">
            {searchQuery || selectedSupervisor !== 'all' || selectedStatus !== 'all'
              ? 'ไม่พบโครงการที่ตรงเงื่อนไข'
              : 'ยังไม่มีโครงการในระบบ'}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-6 leading-relaxed">
            {searchQuery || selectedSupervisor !== 'all' || selectedStatus !== 'all'
              ? 'ลองเปลี่ยนคำค้นหาหรือเลือกสถานะ/ผู้ควบคุมงานอื่น'
              : 'เริ่มต้นโดยการเพิ่มโครงการก่อสร้างโครงการแรกของคุณ'}
          </p>
          {!searchQuery && selectedSupervisor === 'all' && selectedStatus === 'all' && user && (user.role === 'admin' || user.role === 'editor') && (
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
    </>
  )
}
