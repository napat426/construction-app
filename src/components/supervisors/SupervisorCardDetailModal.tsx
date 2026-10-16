'use client'

import React, { useState } from 'react'
import {
  X,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Building2,
  Trash2,
  Edit3,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Maximize2,
} from 'lucide-react'
import type { SupervisorTask, SupervisorTaskGroup, Project } from '@/lib/types'

interface Props {
  task: SupervisorTask | null
  group?: SupervisorTaskGroup
  projects: Project[]
  canEdit: boolean
  onClose: () => void
  onEdit: (task: SupervisorTask) => void
  onDelete: (taskId: string) => void
}

export function SupervisorCardDetailModal({
  task,
  group,
  projects,
  canEdit,
  onClose,
  onEdit,
  onDelete,
}: Props) {
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null)

  if (!task) return null

  const relatedProject = task.related_project_id
    ? projects.find((p) => p.id === task.related_project_id)
    : null

  // Status Badge Helper
  const renderStatus = () => {
    switch (task.status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 size={13} /> สำเร็จแล้ว
          </span>
        )
      case 'delayed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <AlertTriangle size={13} /> ล่าช้ากว่ากำหนด
          </span>
        )
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <Clock size={13} /> กำลังดำเนินการ
          </span>
        )
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">
            ยกเลิก
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            รอดำเนินการ
          </span>
        )
    }
  }

  const photos = task.photo_urls || []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white dark:bg-[#121226] border border-slate-200 dark:border-[#252548] rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col">
        {/* Header Bar */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-[#202042] flex items-start justify-between gap-3 bg-slate-50/70 dark:bg-[#16162e]">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              {group && (
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-primary-500/10 text-primary-600 dark:text-primary-400 border border-primary-500/20">
                  📁 {group.name}
                </span>
              )}
              {renderStatus()}
              {task.has_issue && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1">
                  ⚠️ มีปัญหาอุปสรรค
                </span>
              )}
            </div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-snug">
              {task.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-[#202042] transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body (Scrollable) */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* Photo Gallery Grid */}
          {photos.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                📸 ภาพถ่ายผลงานหน้างาน ({photos.length} รูป)
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {photos.map((url, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedPhotoIndex(idx)}
                    className="group relative aspect-4/3 rounded-xl overflow-hidden border border-slate-200 dark:border-[#252548] bg-slate-100 dark:bg-[#1a1a36] cursor-pointer shadow-xs hover:shadow-md transition-all"
                  >
                    <img
                      src={url}
                      alt={`ภาพงาน ${idx + 1}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                      <Maximize2 size={20} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          {task.description && (
            <div className="bg-slate-50 dark:bg-[#16162e] p-4 rounded-xl border border-slate-100 dark:border-[#202042]">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                📝 รายละเอียดผลการดำเนินงาน
              </h4>
              <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed font-normal break-words">
                {task.description}
              </p>
            </div>
          )}

          {/* Issue & Solution Box */}
          {task.has_issue && (
            <div className="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/40 rounded-xl p-4 space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400">
                <AlertTriangle size={15} /> ปัญหาอุปสรรคและการแก้ไข (Issue & Solution)
              </div>
              {task.issue_detail && (
                <div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    ปัญหาที่พบ:
                  </span>
                  <p className="text-xs text-amber-900 dark:text-amber-200 font-medium mt-0.5">
                    {task.issue_detail}
                  </p>
                </div>
              )}
              {task.issue_solution && (
                <div className="pt-2 border-t border-amber-200/50 dark:border-amber-900/40">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    💡 แนวทางแก้ไข / การดำเนินการต่อ:
                  </span>
                  <p className="text-xs text-slate-800 dark:text-slate-200 font-medium mt-0.5">
                    {task.issue_solution}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Metadata Row: Dates & Linked Project */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-[#202042] text-xs">
            {/* Timeline */}
            <div className="space-y-1 text-slate-600 dark:text-slate-400">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Calendar size={12} /> ระยะเวลาปฏิบัติงาน
              </span>
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                เริ่ม: {task.start_date || 'ไม่ได้ระบุ'}
              </p>
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                กำหนดเสร็จ: {task.due_date || 'ไม่ได้ระบุ'}
              </p>
              {task.completed_date && (
                <p className="font-bold text-emerald-600 dark:text-emerald-400">
                  เสร็จจริง: {task.completed_date}
                </p>
              )}
            </div>

            {/* Linked Project */}
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                <Building2 size={12} /> โครงการก่อสร้างที่เกี่ยวข้อง
              </span>
              {relatedProject ? (
                <a
                  href={`/projects/${relatedProject.id}`}
                  className="inline-flex items-center gap-1.5 font-bold text-primary-600 dark:text-primary-400 hover:underline"
                >
                  <span className="truncate max-w-[240px]">{relatedProject.name}</span>
                  <ExternalLink size={12} />
                </a>
              ) : (
                <span className="text-slate-400 italic">ไม่ได้ผูกกับโครงการหลัก (งานเฉพาะกิจ)</span>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-slate-50 dark:bg-[#16162e] border-t border-slate-100 dark:border-[#202042] flex items-center justify-between">
          <div>
            {canEdit && (
              <button
                type="button"
                onClick={() => {
                  if (confirm('คุณต้องการลบงานนี้ใช่หรือไม่?')) {
                    onDelete(task.id)
                    onClose()
                  }
                }}
                className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Trash2 size={13} /> ลบงานนี้
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {canEdit && (
              <button
                type="button"
                onClick={() => {
                  onEdit(task)
                  onClose()
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-[#252548] text-slate-800 dark:text-slate-200 hover:bg-slate-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Edit3 size={13} /> แก้ไขข้อมูล
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs cursor-pointer shadow-xs"
            >
              ปิด
            </button>
          </div>
        </div>
      </div>

      {/* Lightbox Modal for Full-Size Photo Zoom */}
      {selectedPhotoIndex !== null && (
        <div
          className="fixed inset-0 z-60 bg-black/90 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setSelectedPhotoIndex(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <img
              src={photos[selectedPhotoIndex]}
              alt={`ภาพขนาดเต็ม ${selectedPhotoIndex + 1}`}
              className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl"
            />
            <div className="mt-3 flex items-center gap-4 text-white text-xs font-bold">
              <span>{selectedPhotoIndex + 1} จาก {photos.length} รูป</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedPhotoIndex((prev) => (prev! > 0 ? prev! - 1 : photos.length - 1))}
                  className="p-1 rounded-lg bg-white/20 hover:bg-white/40 cursor-pointer"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPhotoIndex((prev) => (prev! < photos.length - 1 ? prev! + 1 : 0))}
                  className="p-1 rounded-lg bg-white/20 hover:bg-white/40 cursor-pointer"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPhotoIndex(null)}
                className="ml-4 px-2 py-1 rounded-lg bg-white/20 hover:bg-white/40 cursor-pointer"
              >
                ✕ ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
