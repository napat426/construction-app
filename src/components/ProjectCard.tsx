'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { MapPin, User, Calendar, DollarSign, Trash2, AlertTriangle } from 'lucide-react'
import { deleteProject } from '@/app/actions/projects'
import type { Project } from '@/lib/types'

/* ─── Status config ─── */
const STATUS_MAP = {
  'กำลังดำเนินการ': {
    bg:     'bg-amber-500/10 dark:bg-amber-500/15',
    text:   'text-amber-600 dark:text-amber-400',
    dot:    'bg-amber-500',
    border: 'border-amber-500/25',
  },
  'เสร็จสิ้น': {
    bg:     'bg-emerald-500/10 dark:bg-emerald-500/15',
    text:   'text-emerald-600 dark:text-emerald-400',
    dot:    'bg-emerald-500',
    border: 'border-emerald-500/25',
  },
  'ระงับ': {
    bg:     'bg-red-500/10 dark:bg-red-500/15',
    text:   'text-red-600 dark:text-red-400',
    dot:    'bg-red-500',
    border: 'border-red-500/25',
  },
  'รอดำเนินการ': {
    bg:     'bg-blue-500/10 dark:bg-blue-500/15',
    text:   'text-blue-600 dark:text-blue-400',
    dot:    'bg-blue-500',
    border: 'border-blue-500/25',
  },
} as const

function formatBudget(amount: number | null): string {
  if (!amount && amount !== 0) return '—'
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  })
}

interface ProjectCardProps {
  project: Project
}

export function ProjectCard({ project }: ProjectCardProps) {
  const [showConfirm, setShowConfirm] = useState(false)
  const [isPending, startTransition] = useTransition()

  const status = STATUS_MAP[project.status] ?? STATUS_MAP['รอดำเนินการ']
  const progressClamped = Math.max(0, Math.min(100, project.progress ?? 0))

  const handleDelete = () => {
    startTransition(async () => {
      await deleteProject(project.id)
    })
  }

  return (
    <div className="card rounded-xl overflow-hidden animate-fade-in flex flex-col">
      {/* Top accent bar — gradient width shows progress */}
      <div className="relative h-[3px] w-full bg-slate-100 dark:bg-[#1e1e38]">
        <div
          className="absolute inset-y-0 left-0 progress-fill"
          style={{ width: `${progressClamped}%` }}
        />
      </div>

      <div className="flex-1 flex flex-col p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <Link
            href={`/projects/${project.id}`}
            className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors flex-1"
          >
            <h3 className="text-[15px] font-bold text-slate-900 dark:text-white leading-snug line-clamp-2">
              {project.name}
            </h3>
          </Link>
          <span
            className={[
              'flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border',
              status.bg, status.text, status.border,
            ].join(' ')}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
            {project.status}
          </span>
        </div>

        {/* Detail rows */}
        <div className="space-y-1.5 mb-4 flex-1">
          <DetailRow icon={<User size={13} />} value={project.supervisor} />
          {project.location && (
            <DetailRow icon={<MapPin size={13} />} value={project.location} />
          )}
          {project.budget != null && project.budget > 0 && (
            <DetailRow icon={<DollarSign size={13} />} value={formatBudget(project.budget)} bold />
          )}
          {(project.start_date || project.end_date) && (
            <DetailRow
              icon={<Calendar size={13} />}
              value={`${formatDate(project.start_date)} – ${formatDate(project.end_date)}`}
            />
          )}
        </div>

        {/* Description */}
        {project.description && (
          <p className="text-[12px] text-slate-400 dark:text-slate-500 line-clamp-2 mb-4 leading-relaxed">
            {project.description}
          </p>
        )}

        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              ความคืบหน้า
            </span>
            <span className="text-[11px] font-bold text-primary-600 dark:text-primary-400">
              {progressClamped}%
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-[#1e1e38] overflow-hidden">
            <div
              className="h-full rounded-full progress-fill"
              style={{ width: `${progressClamped}%` }}
            />
          </div>
        </div>

        {/* Delete button */}
        {!showConfirm ? (
          <button
            id={`delete-${project.id}`}
            onClick={() => setShowConfirm(true)}
            disabled={isPending}
            className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium text-slate-400 dark:text-slate-600 border border-transparent hover:border-red-500/25 hover:text-red-500 hover:bg-red-500/5 transition-all duration-200 disabled:opacity-50"
          >
            <Trash2 size={13} />
            ลบโครงการ
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => setShowConfirm(false)}
              className="flex-1 py-2 px-3 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-[#252548] hover:bg-slate-50 dark:hover:bg-[#1e1e38] transition-all"
            >
              ยกเลิก
            </button>
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="flex-1 flex items-center justify-center gap-1 py-2 px-3 rounded-lg text-xs font-bold text-white bg-red-500 hover:bg-red-600 transition-all disabled:opacity-70"
            >
              {isPending ? (
                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <AlertTriangle size={13} />
              )}
              ยืนยันลบ
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function DetailRow({
  icon,
  value,
  bold,
}: {
  icon: React.ReactNode
  value: string
  bold?: boolean
}) {
  return (
    <div className="flex items-center gap-2 text-[13px]">
      <span className="flex-shrink-0 text-primary-600 dark:text-primary-500">{icon}</span>
      <span
        className={`truncate ${bold ? 'font-semibold text-slate-700 dark:text-slate-200' : 'text-slate-600 dark:text-slate-400'}`}
      >
        {value}
      </span>
    </div>
  )
}
