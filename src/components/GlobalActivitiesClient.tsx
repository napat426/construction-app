'use client'

import { useState, useMemo, useTransition } from 'react'
import Link from 'next/link'
import {
  Activity,
  Search,
  Filter,
  RefreshCw,
  Building2,
  Users,
  Clock,
  Sparkles,
  Layers,
  MonitorPlay,
  Bot,
  FileText,
  FileCheck,
  Edit,
  PlusCircle,
  Trash2,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react'
import type { ActivityLog } from '@/lib/types'
import { fetchGlobalActivityLogs } from '@/app/actions/activities'

interface Props {
  initialProjects: { id: string; name: string }[]
  initialLogs: ActivityLog[]
  defaultProjectId?: string
}

export function GlobalActivitiesClient({ initialProjects, initialLogs, defaultProjectId }: Props) {
  const [logs, setLogs] = useState<ActivityLog[]>(initialLogs)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedProject, setSelectedProject] = useState<string>(defaultProjectId || 'ALL')
  const [selectedModule, setSelectedModule] = useState<string>('ALL')
  const [selectedAction, setSelectedAction] = useState<string>('ALL')
  const [selectedUser, setSelectedUser] = useState<string>('ALL')
  const [isPending, startTransition] = useTransition()
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Unique users list
  const userList = useMemo(() => {
    const set = new Set<string>()
    logs.forEach((log) => {
      if (log.user_name) set.add(log.user_name)
    })
    return Array.from(set)
  }, [logs])

  // Project map for quick lookup
  const projectMap = useMemo(() => {
    const map = new Map<string, string>()
    initialProjects.forEach((p) => map.set(p.id, p.name))
    return map
  }, [initialProjects])

  // Refresh handler
  const handleRefresh = async () => {
    setIsRefreshing(true)
    startTransition(async () => {
      try {
        const fresh = await fetchGlobalActivityLogs({
          projectId: selectedProject,
          moduleType: selectedModule,
          actionType: selectedAction,
        })
        setLogs(fresh)
      } finally {
        setIsRefreshing(false)
      }
    })
  }

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // 1. Project filter
      if (selectedProject !== 'ALL') {
        if (selectedProject === 'NONE') {
          if (log.project_id) return false
        } else if (log.project_id !== selectedProject) {
          return false
        }
      }

      // 2. Module filter
      if (selectedModule !== 'ALL' && log.module_type !== selectedModule) {
        return false
      }

      // 3. Action filter
      if (selectedAction !== 'ALL' && log.action_type !== selectedAction) {
        return false
      }

      // 4. User filter
      if (selectedUser !== 'ALL' && log.user_name !== selectedUser) {
        return false
      }

      // 5. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchTitle = (log.entity_title || '').toLowerCase().includes(q)
        const matchUser = (log.user_name || '').toLowerCase().includes(q)
        const matchAction = (log.action_type || '').toLowerCase().includes(q)
        const matchEntity = (log.entity_type || '').toLowerCase().includes(q)
        const matchProject = (log.project_name || (log.project_id ? projectMap.get(log.project_id) : '') || '')
          .toLowerCase()
          .includes(q)
        const matchDetails = JSON.stringify(log.details || {}).toLowerCase().includes(q)

        if (!matchTitle && !matchUser && !matchAction && !matchEntity && !matchProject && !matchDetails) {
          return false
        }
      }

      return true
    })
  }, [logs, selectedProject, selectedModule, selectedAction, selectedUser, searchQuery, projectMap])

  // KPIs
  const totalActivities = filteredLogs.length
  const activeContributors = useMemo(() => {
    const s = new Set<string>()
    filteredLogs.forEach((l) => s.add(l.user_name))
    return s.size
  }, [filteredLogs])

  const activeProjectsCount = useMemo(() => {
    const s = new Set<string>()
    filteredLogs.forEach((l) => {
      if (l.project_id) s.add(l.project_id)
      else if (l.module_type) s.add(l.module_type)
    })
    return s.size
  }, [filteredLogs])

  const latestLogTime = filteredLogs.length > 0 ? filteredLogs[0].created_at : null

  // Relative time formatter
  const formatRelativeTime = (isoString: string) => {
    try {
      const now = new Date()
      const date = new Date(isoString)
      const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000)

      if (diffSec < 60) return 'เมื่อสักครู่'
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)} นาทีที่แล้ว`
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} ชั่วโมงที่แล้ว`
      if (diffSec < 604800) return `${Math.floor(diffSec / 86400)} วันที่แล้ว`

      return new Date(isoString).toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'short',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return isoString
    }
  }

  // Full Thai date formatter
  const formatFullDate = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleDateString('th-TH', {
        weekday: 'short',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return isoString
    }
  }

  // Helper for action badges
  const getActionBadge = (action: string) => {
    switch (action) {
      case 'CREATE':
        return { label: 'สร้างใหม่', bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20', icon: PlusCircle }
      case 'UPDATE':
        return { label: 'แก้ไขข้อมูล', bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20', icon: Edit }
      case 'CONFIRM':
      case 'APPROVE':
        return { label: 'ยืนยัน / อนุมัติ', bg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20', icon: FileCheck }
      case 'DELETE':
        return { label: 'ลบรายการ', bg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20', icon: Trash2 }
      case 'AI_ANALYZE':
        return { label: 'AI Vision ตรวจภาพ', bg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20', icon: Sparkles }
      case 'AI_CHAT':
        return { label: 'ปรึกษา AI Chat', bg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20', icon: Bot }
      case 'EXPORT':
        return { label: 'ส่งออกเอกสาร', bg: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20', icon: ExternalLink }
      default:
        return { label: action, bg: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20', icon: Activity }
    }
  }

  // Helper for module badges
  const getModuleBadge = (moduleType: string, projectId?: string | null) => {
    if (moduleType === 'presentation') {
      return { label: '📺 Presentation', bg: 'bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400 border-fuchsia-500/20' }
    }
    if (moduleType === 'ai_chat') {
      return { label: '🤖 AI Assistant', bg: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20' }
    }
    if (moduleType === 'system' || !projectId) {
      return { label: '⚙️ ระบบส่วนกลาง', bg: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20' }
    }
    return { label: '🏢 โครงการ', bg: 'bg-primary-500/10 text-primary-600 dark:text-primary-400 border-primary-500/20' }
  }

  return (
    <div className="space-y-6">
      {/* 1. Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-[#13132a] border border-slate-200 dark:border-[#252548] shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary-50 dark:bg-primary-950/50 flex items-center justify-center text-primary-600 dark:text-primary-400 flex-shrink-0">
            <Activity size={24} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">บันทึกกิจกรรมทั้งหมด</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">{totalActivities}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#13132a] border border-slate-200 dark:border-[#252548] shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400 flex-shrink-0">
            <Users size={24} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">ผู้มีส่วนร่วมในการบันทึก</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">{activeContributors} คน</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#13132a] border border-slate-200 dark:border-[#252548] shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center text-purple-600 dark:text-purple-400 flex-shrink-0">
            <Layers size={24} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">โครงการ / โมดูลที่เคลื่อนไหว</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">{activeProjectsCount} แหล่ง</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#13132a] border border-slate-200 dark:border-[#252548] shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 flex-shrink-0">
            <Clock size={24} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">กิจกรรมล่าสุด</p>
            <p className="text-sm font-bold text-slate-900 dark:text-white mt-1 truncate">
              {latestLogTime ? formatRelativeTime(latestLogTime) : 'ยังไม่มีกิจกรรม'}
            </p>
          </div>
        </div>
      </div>

      {/* 2. Search & Multi-filter Controls */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#13132a] border border-slate-200 dark:border-[#252548] shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหากิจกรรม, ชื่องาน, คำถาม AI, ผู้ทำ หรือรายละเอียด..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-[#0a0a14] border border-slate-200 dark:border-[#252548] rounded-xl text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
            />
          </div>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing || isPending}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-[#1c1c36] dark:hover:bg-[#252548] text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold transition-all cursor-pointer flex-shrink-0"
            title="รีเฟรชข้อมูลประวัติ"
          >
            <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
            <span>{isRefreshing ? 'กำลังโหลด...' : 'รีเฟรช'}</span>
          </button>
        </div>

        {/* Filters Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-100 dark:border-[#1e1e38]">
          {/* 1. Project / Scope Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              ขอบเขต / โครงการ
            </label>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0a0a14] border border-slate-200 dark:border-[#252548] rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 cursor-pointer"
            >
              <option value="ALL">🌐 รวมทุกโครงการ & ส่วนกลาง</option>
              <option value="NONE">📂 เฉพาะงานนอกโครงการ (Presentation, AI Chat)</option>
              <optgroup label="โครงการทั้งหมด">
                {initialProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    🏢 {p.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* 2. Module Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              หมวดหมู่งาน (Module)
            </label>
            <select
              value={selectedModule}
              onChange={(e) => setSelectedModule(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0a0a14] border border-slate-200 dark:border-[#252548] rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 cursor-pointer"
            >
              <option value="ALL">ทั้งหมดทุกหมวดหมู่</option>
              <option value="project">🏢 งานในโครงการ (Daily Report, etc.)</option>
              <option value="presentation">📺 งานนำเสนอ (Presentation)</option>
              <option value="ai_chat">🤖 การปรึกษา AI Assistant</option>
              <option value="system">⚙️ การตั้งค่าระบบ / Master Data</option>
            </select>
          </div>

          {/* 3. Action Type Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              ประเภทการกระทำ (Action)
            </label>
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0a0a14] border border-slate-200 dark:border-[#252548] rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 cursor-pointer"
            >
              <option value="ALL">ทั้งหมดทุกการกระทำ</option>
              <option value="CREATE">➕ สร้างใหม่ (CREATE)</option>
              <option value="UPDATE">✏️ แก้ไขข้อมูล (UPDATE)</option>
              <option value="CONFIRM">✅ ยืนยัน / อนุมัติ (CONFIRM/APPROVE)</option>
              <option value="DELETE">🗑️ ลบรายการ (DELETE)</option>
              <option value="AI_ANALYZE">✨ AI Vision ตรวจรูปภาพ</option>
              <option value="AI_CHAT">💬 ถาม-ตอบกับ AI</option>
              <option value="EXPORT">📤 ส่งออกเอกสาร / Print</option>
            </select>
          </div>

          {/* 4. User Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              ผู้บันทึก (User)
            </label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0a0a14] border border-slate-200 dark:border-[#252548] rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 cursor-pointer"
            >
              <option value="ALL">ทุกคน</option>
              {userList.map((u) => (
                <option key={u} value={u}>
                  👤 {u}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Reset Filter Button if active */}
        {(searchQuery || selectedProject !== 'ALL' || selectedModule !== 'ALL' || selectedAction !== 'ALL' || selectedUser !== 'ALL') && (
          <div className="flex justify-end pt-1">
            <button
              onClick={() => {
                setSearchQuery('')
                setSelectedProject('ALL')
                setSelectedModule('ALL')
                setSelectedAction('ALL')
                setSelectedUser('ALL')
              }}
              className="text-xs font-bold text-primary-600 dark:text-primary-400 hover:underline cursor-pointer flex items-center gap-1"
            >
              ล้างตัวกรองทั้งหมด
            </button>
          </div>
        )}
      </div>

      {/* 3. Activity Timeline Feed */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Clock size={18} className="text-primary-500" />
            <span>ไทม์ไลน์กิจกรรม (Timeline Feed)</span>
          </h3>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            แสดง {filteredLogs.length} รายการ
          </span>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-white dark:bg-[#13132a] border border-dashed border-slate-300 dark:border-[#252548]">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-[#1c1c36] flex items-center justify-center mx-auto text-slate-400 mb-3">
              <Activity size={28} />
            </div>
            <p className="text-base font-bold text-slate-800 dark:text-slate-200">ยังไม่พบบันทึกกิจกรรมตามเงื่อนไขที่เลือก</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
              เมื่อมีการบันทึกรายงาน, จัดการวัสดุ, ทำ Presentation หรือสอบถามกับ AI Assistant ข้อมูลกิจกรรมจะแสดงที่นี่โดยอัตโนมัติ
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredLogs.map((log) => {
              const actionBadge = getActionBadge(log.action_type)
              const ActionIcon = actionBadge.icon
              const moduleBadge = getModuleBadge(log.module_type, log.project_id)
              const projectName = log.project_name || (log.project_id ? projectMap.get(log.project_id) : null)

              return (
                <div
                  key={log.id}
                  className="p-4 rounded-2xl bg-white dark:bg-[#13132a] border border-slate-200 dark:border-[#252548] shadow-sm hover:border-primary-500/40 hover:shadow-md transition-all duration-200 group"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    {/* Left: User Avatar + Action Details */}
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-[#1e1e38] dark:to-[#252548] border border-slate-200 dark:border-slate-700 flex items-center justify-center font-bold text-slate-700 dark:text-slate-300 flex-shrink-0 text-sm">
                        {(log.user_name || 'U').slice(0, 2).toUpperCase()}
                      </div>

                      <div className="min-w-0 flex-1">
                        {/* Top row: User name, role, badges */}
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="text-sm font-bold text-slate-900 dark:text-white">
                            {log.user_name}
                          </span>

                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border leading-tight ${actionBadge.bg} flex items-center gap-1`}>
                            <ActionIcon size={12} />
                            {actionBadge.label}
                          </span>

                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border leading-tight ${moduleBadge.bg}`}>
                            {moduleBadge.label}
                          </span>

                          {projectName && (
                            <Link
                              href={`/projects/${log.project_id}`}
                              className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-[#1a1a32] hover:bg-primary-50 dark:hover:bg-primary-950/40 hover:text-primary-600 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700 truncate max-w-xs transition-colors flex items-center gap-1"
                              title={projectName}
                            >
                              <Building2 size={11} className="text-primary-500" />
                              <span className="truncate">{projectName}</span>
                            </Link>
                          )}
                        </div>

                        {/* Title of activity */}
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-snug">
                          {log.entity_title || `${log.action_type} on ${log.entity_type}`}
                        </p>

                        {/* Details snippet */}
                        {log.details && Object.keys(log.details).length > 0 && (
                          <div className="mt-2 text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-[#0d0d1c] p-2.5 rounded-xl border border-slate-100 dark:border-[#1e1e38] space-y-1">
                            {log.details.question && (
                              <p className="font-medium text-slate-700 dark:text-slate-300">
                                💬 คำถาม: &ldquo;{log.details.question}&rdquo;
                              </p>
                            )}
                            {log.details.date && (
                              <p>📅 วันที่รายงาน: {log.details.date}</p>
                            )}
                            {log.details.changes && Array.isArray(log.details.changes) && (
                              <p>✏️ ส่วนที่แก้ไข: {log.details.changes.join(', ')}</p>
                            )}
                            {log.details.photo_count !== undefined && (
                              <p>📷 รูปภาพที่วิเคราะห์: {log.details.photo_count} รูป</p>
                            )}
                            {log.details.detected_tasks && Array.isArray(log.details.detected_tasks) && log.details.detected_tasks.length > 0 && (
                              <p>🔍 ตรวจพบงาน: {log.details.detected_tasks.join(', ')}</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Timestamp & Deep Link */}
                    <div className="flex sm:flex-col items-end justify-between sm:justify-start gap-2 flex-shrink-0 text-right">
                      <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                        <span title={formatFullDate(log.created_at)}>
                          {formatRelativeTime(log.created_at)}
                        </span>
                      </div>

                      {/* Quick deep link */}
                      {log.entity_type === 'daily_report' && log.project_id && (
                        <Link
                          href={`/projects/${log.project_id}/reports`}
                          className="text-[11px] font-bold text-primary-600 dark:text-primary-400 hover:underline inline-flex items-center gap-1 opacity-90 group-hover:opacity-100"
                        >
                          <span>เปิดดูรายงาน</span>
                          <ChevronRight size={13} />
                        </Link>
                      )}

                      {log.entity_type === 'project_note' && log.project_id && (
                        <Link
                          href={`/projects/${log.project_id}/notes`}
                          className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline inline-flex items-center gap-1 opacity-90 group-hover:opacity-100"
                        >
                          <span>เปิดดูโน้ต</span>
                          <ChevronRight size={13} />
                        </Link>
                      )}

                      {log.entity_type === 'wbs_task' && log.project_id && (
                        <Link
                          href={`/projects/${log.project_id}/planning`}
                          className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 opacity-90 group-hover:opacity-100"
                        >
                          <span>เปิดดูแผนงาน</span>
                          <ChevronRight size={13} />
                        </Link>
                      )}

                      {log.entity_type === 'material' && log.project_id && (
                        <Link
                          href={`/projects/${log.project_id}/materials`}
                          className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1 opacity-90 group-hover:opacity-100"
                        >
                          <span>เปิดดูวัสดุ</span>
                          <ChevronRight size={13} />
                        </Link>
                      )}

                      {log.entity_type === 'checklist' && log.project_id && (
                        <Link
                          href={`/projects/${log.project_id}/checklist`}
                          className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400 hover:underline inline-flex items-center gap-1 opacity-90 group-hover:opacity-100"
                        >
                          <span>เปิดดูตรวจงาน</span>
                          <ChevronRight size={13} />
                        </Link>
                      )}

                      {log.module_type === 'presentation' && (
                        <Link
                          href="/presentation"
                          className="text-[11px] font-bold text-fuchsia-600 dark:text-fuchsia-400 hover:underline inline-flex items-center gap-1 opacity-90 group-hover:opacity-100"
                        >
                          <span>เปิดดู Presentation</span>
                          <ChevronRight size={13} />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
