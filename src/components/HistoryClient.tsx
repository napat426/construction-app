'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  History,
  Search,
  Filter,
  User,
  Calendar,
  Sparkles,
  FileText,
  CheckCircle2,
  Trash2,
  Edit3,
  Package,
  Layers,
  Clock,
  ArrowUpRight,
  RefreshCw,
  SlidersHorizontal,
  ChevronRight
} from 'lucide-react'
import type { Project, ActivityLog } from '@/lib/types'

interface HistoryClientProps {
  project: Project
  initialLogs: ActivityLog[]
}

const ACTION_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  CREATE: { label: 'สร้างใหม่', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20', icon: FileText },
  UPDATE: { label: 'แก้ไขข้อมูล', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20', icon: Edit3 },
  CONFIRM: { label: 'ยืนยันเอกสาร', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', icon: CheckCircle2 },
  APPROVE: { label: 'อนุมัติ', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', icon: CheckCircle2 },
  REJECT: { label: 'ไม่อนุมัติ', color: 'bg-red-500/10 text-red-500 border-red-500/20', icon: Trash2 },
  DELETE: { label: 'ลบข้อมูล', color: 'bg-red-500/10 text-red-500 border-red-500/20', icon: Trash2 },
  AI_ANALYZE: { label: 'AI Vision', color: 'bg-violet-500/10 text-violet-400 border-violet-500/20', icon: Sparkles },
  FETCH_WBS: { label: 'ดึงแผน WBS', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20', icon: Layers },
}

const ENTITY_CONFIG: Record<string, { label: string; href: (pId: string) => string }> = {
  daily_report: { label: 'รายงานประจำวัน', href: (id) => `/projects/${id}/reports` },
  weekly_report: { label: 'รายงานประจำสัปดาห์', href: (id) => `/projects/${id}/reports` },
  material: { label: 'การจัดการวัสดุ', href: (id) => `/projects/${id}/materials` },
  wbs_task: { label: 'แผนงาน WBS', href: (id) => `/projects/${id}/planning` },
  inspection: { label: 'การตรวจงาน', href: (id) => `/projects/${id}/reports` },
  punchlist: { label: 'Punch List', href: (id) => `/projects/${id}/punchlist` },
  project: { label: 'โครงการ', href: (id) => `/projects/${id}` },
}

export function HistoryClient({ project, initialLogs }: HistoryClientProps) {
  const [logs, setLogs] = useState<ActivityLog[]>(initialLogs)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedEntity, setSelectedEntity] = useState('ALL')
  const [selectedAction, setSelectedAction] = useState('ALL')
  const [selectedUser, setSelectedUser] = useState('ALL')

  // Extract unique users
  const uniqueUsers = useMemo(() => {
    const set = new Set<string>()
    logs.forEach(l => {
      if (l.user_name) set.add(l.user_name)
    })
    return Array.from(set)
  }, [logs])

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // Search text
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchTitle = (log.entity_title || '').toLowerCase().includes(q)
        const matchUser = (log.user_name || '').toLowerCase().includes(q)
        const matchAction = (log.action_type || '').toLowerCase().includes(q)
        if (!matchTitle && !matchUser && !matchAction) return false
      }

      // Entity type filter
      if (selectedEntity !== 'ALL' && log.entity_type !== selectedEntity) {
        return false
      }

      // Action type filter
      if (selectedAction !== 'ALL' && log.action_type !== selectedAction) {
        return false
      }

      // User filter
      if (selectedUser !== 'ALL' && log.user_name !== selectedUser) {
        return false
      }

      return true
    })
  }, [logs, searchQuery, selectedEntity, selectedAction, selectedUser])

  // Date formatting helpers
  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr)
    const date = d.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
    const time = d.toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit'
    })
    return { date, time }
  }

  const getRelativeTime = (dateStr: string) => {
    const now = new Date().getTime()
    const past = new Date(dateStr).getTime()
    const diffMin = Math.floor((now - past) / (1000 * 60))

    if (diffMin < 1) return 'เมื่อสักครู่'
    if (diffMin < 60) return `${diffMin} นาทีที่แล้ว`
    const diffHours = Math.floor(diffMin / 60)
    if (diffHours < 24) return `${diffHours} ชั่วโมงที่แล้ว`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays === 1) return 'เมื่อวานนี้'
    if (diffDays < 7) return `${diffDays} วันที่แล้ว`
    return null
  }

  // Count stats
  const totalCount = logs.length
  const aiCount = logs.filter(l => l.action_type === 'AI_ANALYZE').length
  const confirmCount = logs.filter(l => l.action_type === 'CONFIRM' || l.action_type === 'APPROVE').length

  return (
    <div className="space-y-6">
      {/* Header Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#14142a] border border-slate-200 dark:border-[#252548] p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">บันทึกกิจกรรมทั้งหมด</span>
            <div className="w-8 h-8 rounded-xl bg-primary-500/10 text-primary-500 flex items-center justify-center">
              <History size={18} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 dark:text-white">{totalCount}</span>
            <span className="text-xs text-slate-400 font-semibold">รายการ</span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#14142a] border border-slate-200 dark:border-[#252548] p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">ยืนยัน / อนุมัติงาน</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-500">{confirmCount}</span>
            <span className="text-xs text-slate-400 font-semibold">ครั้ง</span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#14142a] border border-slate-200 dark:border-[#252548] p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">การใช้งาน AI Vision</span>
            <div className="w-8 h-8 rounded-xl bg-violet-500/10 text-violet-400 flex items-center justify-center">
              <Sparkles size={18} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-violet-500">{aiCount}</span>
            <span className="text-xs text-slate-400 font-semibold">ครั้ง</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-[#14142a] border border-slate-200 dark:border-[#252548] p-4 rounded-2xl shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="ค้นหาข้อความ, ชื่องาน, หรือผู้ใช้..."
            className="w-full pl-10 pr-4 py-2 rounded-xl text-xs bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Entity Filter */}
          <select
            value={selectedEntity}
            onChange={e => setSelectedEntity(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
          >
            <option value="ALL">หมวดหมู่ทั้งหมด</option>
            <option value="daily_report">รายงานประจำวัน</option>
            <option value="weekly_report">รายงานประจำสัปดาห์</option>
            <option value="material">การจัดการวัสดุ</option>
            <option value="wbs_task">แผนงาน WBS</option>
            <option value="inspection">การตรวจงาน</option>
            <option value="punchlist">Punch List</option>
          </select>

          {/* Action Filter */}
          <select
            value={selectedAction}
            onChange={e => setSelectedAction(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
          >
            <option value="ALL">กิจกรรมทั้งหมด</option>
            <option value="CREATE">สร้างใหม่</option>
            <option value="UPDATE">แก้ไข</option>
            <option value="CONFIRM">ยืนยันงาน</option>
            <option value="AI_ANALYZE">AI Vision</option>
            <option value="DELETE">ลบข้อมูล</option>
          </select>

          {/* User Filter */}
          {uniqueUsers.length > 0 && (
            <select
              value={selectedUser}
              onChange={e => setSelectedUser(e.target.value)}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
            >
              <option value="ALL">ผู้ใช้ทุกคน</option>
              {uniqueUsers.map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          )}

          {(searchQuery || selectedEntity !== 'ALL' || selectedAction !== 'ALL' || selectedUser !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('')
                setSelectedEntity('ALL')
                setSelectedAction('ALL')
                setSelectedUser('ALL')
              }}
              className="px-3 py-2 rounded-xl text-xs font-bold text-primary-500 hover:bg-primary-500/10 cursor-pointer transition-colors"
            >
              ล้างตัวกรอง
            </button>
          )}
        </div>
      </div>

      {/* Activity Timeline List */}
      <div className="bg-white dark:bg-[#14142a] border border-slate-200 dark:border-[#252548] rounded-3xl p-6 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-[#1e1e38] mb-6">
          <h3 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
            <History size={16} className="text-primary-500" />
            <span>ประวัติกิจกรรมล่าสุด</span>
            <span className="text-xs text-slate-400 font-normal">({filteredLogs.length} รายการ)</span>
          </h3>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-white/5 mx-auto flex items-center justify-center text-slate-400 mb-3">
              <History size={28} />
            </div>
            <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">ยังไม่มีบันทึกกิจกรรมตามเงื่อนไขที่เลือก</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              เมื่อมีการสร้าง แก้ไข หรือยืนยันรายงานในระบบ ประวัติกิจกรรมจะถูกบันทึกและแสดงที่นี่โดยอัตโนมัติ
            </p>
          </div>
        ) : (
          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
            {filteredLogs.map((log) => {
              const actionInfo = ACTION_CONFIG[log.action_type] || {
                label: log.action_type,
                color: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
                icon: Clock
              }
              const entityInfo = ENTITY_CONFIG[log.entity_type] || {
                label: log.entity_type,
                href: (id) => `/projects/${id}`
              }
              const { date, time } = formatDateTime(log.created_at)
              const relTime = getRelativeTime(log.created_at)
              const ActionIcon = actionInfo.icon

              return (
                <div key={log.id} className="relative group">
                  {/* Timeline dot */}
                  <div className="absolute -left-6 top-3 -translate-x-1/2 w-4 h-4 rounded-full border-2 border-white dark:border-[#14142a] bg-primary-500 shadow-sm" />

                  {/* Card */}
                  <div className="border border-slate-200 dark:border-slate-800 hover:border-primary-500/40 rounded-2xl p-4 bg-slate-50/50 dark:bg-white/[0.02] hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-all">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      {/* Left: User & Action Badges */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                          <User size={13} className="text-slate-400" />
                          {log.user_name}
                        </span>

                        <span className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded leading-none ${
                          log.user_role === 'admin'
                            ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                            : log.user_role === 'editor'
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                            : 'bg-slate-500/10 text-slate-600 dark:text-slate-400'
                        }`}>
                          {log.user_role}
                        </span>

                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${actionInfo.color}`}>
                          <ActionIcon size={11} />
                          {actionInfo.label}
                        </span>

                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                          {entityInfo.label}
                        </span>
                      </div>

                      {/* Right: Timestamp */}
                      <div className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                        <Calendar size={12} />
                        <span>{date} เวลา {time} น.</span>
                        {relTime && (
                          <span className="text-[10px] text-primary-500 bg-primary-500/10 px-1.5 py-0.2 rounded font-bold">
                            ({relTime})
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Content Title */}
                    <div className="mt-2.5 flex items-start justify-between gap-4">
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                        {log.entity_title || 'บันทึกการเปลี่ยนแปลง'}
                      </p>

                      <Link
                        href={entityInfo.href(project.id)}
                        className="text-xs font-bold text-primary-500 hover:text-primary-600 flex items-center gap-1 flex-shrink-0 group-hover:translate-x-0.5 transition-transform"
                      >
                        <span>เปิดดู</span>
                        <ArrowUpRight size={13} />
                      </Link>
                    </div>

                    {/* Details Snippet (if any) */}
                    {log.details && Object.keys(log.details).length > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-200/50 dark:border-slate-800/50 text-[11px] text-slate-500 dark:text-slate-400">
                        {log.details.preview && (
                          <p className="italic font-mono bg-white/40 dark:bg-black/20 p-2 rounded-lg">
                            &ldquo;{log.details.preview}&rdquo;
                          </p>
                        )}
                        {log.details.photoCount !== undefined && (
                          <span>รูปถ่ายที่วิเคราะห์: {log.details.photoCount} รูป</span>
                        )}
                        {log.details.autoWbs && (
                          <span className="text-emerald-500 font-semibold">• ดึงแผน WBS อัตโนมัติ</span>
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
    </div>
  )
}
