'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  FileText,
  Printer,
  Sparkles,
  TrendingUp,
  Clock,
  DollarSign,
  Image as ImageIcon,
  Edit3,
  X,
  Save,
  History,
  Calendar,
  ChevronDown,
  Trash2,
  Check,
  CheckSquare,
  Square,
} from 'lucide-react'
import type {
  Project,
  Inspection,
  DailyReport,
  WeeklyReport,
  WBSTask,
  ProjectMilestone,
  ContractAmendment,
} from '@/lib/types'
import type { UserSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { computeProjectExtension, computeTaskDates, countWorkingDays } from '@/lib/scheduler'

interface Props {
  project: Project
  inspections: Inspection[]
  dailyReports: DailyReport[]
  weeklyReports?: WeeklyReport[]
  tasks?: WBSTask[]
  milestones?: ProjectMilestone[]
  amendments?: ContractAmendment[]
  user?: UserSession | null
}

interface PhotoSelection {
  url: string
  caption: string
  inspection_no: string
}

export interface ExecutiveReportSnapshot {
  id: string
  title: string
  created_at: string
  reportDate?: string
  highlights: string
  issues: string
  financial: string
  actions: string
  contractStatusTag: string
  selectedPhotos: PhotoSelection[]
  actualProgress: number
  plannedProgress: number
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatThaiDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return '—'
    return d.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return '—'
  }
}

// ── Reusable A4 Page Card for Screen and Batch Printing ──
interface ExecutiveReportA4CardProps {
  project: Project
  report: ExecutiveReportSnapshot
  contractAmount: number
  totalContractDays: number
  daysRemaining: number
  timeProgressPercent: number
  currentEndDate: Date | null
  forecastCompletion: { date: Date; isOverdue: boolean; overdueDays: number; text: string } | null
  paidMilestones: ProjectMilestone[]
  paidAmount: number
  paidPercent: number
  remainingDisbursement: number
  rainyDaysCount: number
  totalDaysObserved: number
  rainPercentage: string
  isInteractive: boolean
  onReportDateChange?: (val: string) => void
  onContractStatusTagChange?: (val: string) => void
  onHighlightsChange?: (val: string) => void
  onIssuesChange?: (val: string) => void
  onFinancialChange?: (val: string) => void
  onActionsChange?: (val: string) => void
  onPhotoClick?: (slotIdx: number) => void
  onPhotoCaptionChange?: (slotIdx: number, caption: string) => void
}

function ExecutiveReportA4Card({
  project,
  report,
  contractAmount,
  totalContractDays,
  daysRemaining,
  timeProgressPercent,
  currentEndDate,
  forecastCompletion,
  paidMilestones,
  paidAmount,
  paidPercent,
  remainingDisbursement,
  rainyDaysCount,
  totalDaysObserved,
  rainPercentage,
  isInteractive,
  onReportDateChange,
  onContractStatusTagChange,
  onHighlightsChange,
  onIssuesChange,
  onFinancialChange,
  onActionsChange,
  onPhotoClick,
  onPhotoCaptionChange,
}: ExecutiveReportA4CardProps) {
  const actualProg = report.actualProgress ?? 0
  const plannedProg = report.plannedProgress ?? 0
  const diffProg = actualProg - plannedProg
  const isDelayed = diffProg < -0.5
  const isAhead = diffProg > 0.5

  return (
    <div className="w-full flex flex-col justify-between">
      {/* Section 1: Header */}
      <div className="border-b-2 border-slate-800 dark:border-slate-300 pb-2.5 mb-2.5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-widest text-primary-600 dark:text-primary-400">
              PROJECT EXECUTIVE PERFORMANCE & DISBURSEMENT REPORT
            </span>
            <h1 className="text-lg font-black text-slate-900 dark:text-white print-compact-heading leading-tight mt-0.5">
              รายงานสรุปสถานะความก้าวหน้าและการเบิกจ่ายโครงการ
            </h1>
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-0.5">
              โครงการ: <span className="text-primary-700 dark:text-primary-300">{project.name}</span>
              {project.wbs_no && <span className="ml-2 font-mono text-slate-500">({project.wbs_no})</span>}
            </p>
          </div>
          <div className="text-right text-[11px] font-medium text-slate-500 dark:text-slate-400 flex-shrink-0">
            <div className="flex items-center justify-end gap-1.5">
              <span>ข้อมูล ณ วันที่:</span>
              {isInteractive ? (
                <>
                  <input
                    type="date"
                    value={report.reportDate || ''}
                    onChange={(e) => onReportDateChange && onReportDateChange(e.target.value)}
                    className="no-print text-xs font-bold bg-slate-50 dark:bg-[#181830] px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                    title="คลิกเพื่อแก้ไขวันที่ของรายงาน (รองรับการทำรายงานย้อนหลัง)"
                  />
                  <strong className="hidden print:inline text-slate-800 dark:text-white font-bold">
                    {formatThaiDate(report.reportDate)}
                  </strong>
                </>
              ) : (
                <strong className="text-slate-800 dark:text-white font-bold">
                  {formatThaiDate(report.reportDate)}
                </strong>
              )}
            </div>
            <div className="mt-0.5">ผู้รับจ้าง: <span className="text-slate-700 dark:text-slate-300">{project.contractor || '—'}</span></div>
          </div>
        </div>
      </div>

      {/* Section 2: 3-Pillars KPI Cards */}
      <div className="grid grid-cols-3 gap-2.5 mb-2.5">
        {/* Card 1: Physical Progress */}
        <div className={`p-2.5 rounded-xl border flex flex-col justify-between ${
          isDelayed
            ? 'bg-red-500/5 border-red-500/20 text-red-950 dark:text-red-200'
            : isAhead
            ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-950 dark:text-emerald-200'
            : 'bg-blue-500/5 border-blue-500/20 text-blue-950 dark:text-blue-200'
        }`}>
          <div className="flex items-center justify-between pb-1 border-b border-black/5 dark:border-white/5">
            <span className="text-[10px] font-black uppercase flex items-center gap-1">
              <TrendingUp size={12} /> 1. ความก้าวหน้าทางกายภาพ
            </span>
            <span className={`text-[9px] font-black px-1.5 py-0.2 rounded-full ${
              isDelayed ? 'bg-red-500/20 text-red-700 dark:text-red-400' :
              isAhead ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400' :
              'bg-blue-500/20 text-blue-700 dark:text-blue-400'
            }`}>
              {isDelayed ? 'ล่าช้ากว่าแผน' : isAhead ? 'เร็วกว่าแผน' : 'ตามแผนงาน'}
            </span>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <div>
              <span className="text-[10px] text-slate-500 block">ผลงานจริง</span>
              <span className="text-base font-black font-mono leading-none">
                {actualProg.toFixed(1)}%
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-500 block">แผนงานสะสม</span>
              <span className="text-base font-black font-mono leading-none text-slate-700 dark:text-slate-300">
                {plannedProg.toFixed(1)}%
              </span>
            </div>
          </div>
          <div className="mt-1 text-[10px] font-bold">
            ส่วนต่าง: <span className={diffProg < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}>
              {diffProg > 0 ? `+${diffProg.toFixed(1)}%` : `${diffProg.toFixed(1)}%`}
            </span>
          </div>
        </div>

        {/* Card 2: Schedule & Time with Forecast Finish Date */}
        <div className="p-2.5 rounded-xl border border-slate-200 dark:border-[#252548] bg-slate-50/50 dark:bg-[#15152c]/50 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-[#252548]">
            <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Clock size={12} /> 2. สถานะเวลาตามสัญญา
            </span>
            <span className="text-[10px] font-bold font-mono text-indigo-600 dark:text-indigo-400">
              {timeProgressPercent.toFixed(1)}%
            </span>
          </div>
          <div className="mt-1 flex items-baseline justify-between text-[11px]">
            <div>
              <span className="text-[10px] text-slate-400 block">ระยะเวลารวม</span>
              <strong className="font-mono">{totalContractDays} วัน</strong>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 block">คงเหลือตามสัญญา</span>
              <strong className="font-mono text-amber-600 dark:text-amber-400">{daysRemaining} วัน</strong>
            </div>
          </div>
          {/* Compare Contract End Date vs Forecast End Date */}
          <div className="mt-1 pt-1 border-t border-slate-200/60 dark:border-[#252548] text-[10px] space-y-0.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">ครบกำหนดสัญญา:</span>
              <strong className="font-mono font-bold text-slate-800 dark:text-slate-200">
                {formatThaiDate(currentEndDate?.toISOString())}
              </strong>
            </div>
            <div className="pt-0.5">
              <div className="text-slate-500 dark:text-slate-400 text-[9.5px]">คาดการณ์แล้วเสร็จ:</div>
              <div className="text-right font-mono font-bold mt-0.5">
                {forecastCompletion && forecastCompletion.isOverdue ? (
                  <span className="text-red-600 dark:text-red-400">
                    {formatThaiDate(forecastCompletion.date.toISOString())}{' '}
                    <span className="text-[9px] font-semibold whitespace-nowrap">({forecastCompletion.text})</span>
                  </span>
                ) : (
                  <span className="text-emerald-600 dark:text-emerald-400">
                    {formatThaiDate(currentEndDate?.toISOString())}{' '}
                    <span className="text-[9px] font-semibold whitespace-nowrap">({forecastCompletion?.text || 'ตามสัญญา'})</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Financial & Payout */}
        <div className="p-2.5 rounded-xl border border-slate-200 dark:border-[#252548] bg-slate-50/50 dark:bg-[#15152c]/50 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-[#252548]">
            <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <DollarSign size={12} /> 3. การเบิกจ่ายงบประมาณ
            </span>
            <span className="text-[10px] font-bold font-mono text-emerald-600 dark:text-emerald-400">
              เบิกแล้ว {paidPercent.toFixed(1)}%
            </span>
          </div>
          <div className="mt-1 flex items-baseline justify-between text-[11px]">
            <div>
              <span className="text-[10px] text-slate-400 block">วงเงินสัญญา</span>
              <strong className="font-mono">{formatMoney(contractAmount)} ฿</strong>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 block">เบิกจ่ายแล้ว ({paidMilestones.length} งวด)</span>
              <strong className="font-mono text-emerald-600 dark:text-emerald-400">{formatMoney(paidAmount)} ฿</strong>
            </div>
          </div>
          <div className="mt-1 text-[10px] text-slate-500 truncate">
            คงเหลือเบิกจ่าย: <strong className="text-slate-700 dark:text-slate-300">{formatMoney(remainingDisbursement)} ฿</strong>
          </div>
        </div>
      </div>

      {/* Section 3: Context Tag / Contract Status Bar with Rain Stats Total & % */}
      <div className="mb-2.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#191934] border border-slate-200 dark:border-[#252548] flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider flex-shrink-0">สถานะสัญญาปัจจุบัน:</span>
          {isInteractive ? (
            <input
              type="text"
              value={report.contractStatusTag || ''}
              onChange={(e) => onContractStatusTagChange && onContractStatusTagChange(e.target.value)}
              className="font-bold text-xs bg-transparent border-b border-dashed border-slate-300 dark:border-slate-600 focus:outline-none text-slate-900 dark:text-white px-1 py-0.5 flex-1 min-w-[240px]"
              title="คลิกเพื่อแก้ไขข้อความสถานะสัญญา"
            />
          ) : (
            <span className="font-bold text-xs text-slate-900 dark:text-white">
              {report.contractStatusTag || '—'}
            </span>
          )}
        </div>
        {rainyDaysCount > 0 && (
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex-shrink-0 ml-2">
            🌧️ สถิติฝนตกสะสม: <strong className="text-slate-800 dark:text-white">{rainyDaysCount} วัน</strong> จาก {totalDaysObserved} วัน ({rainPercentage}%)
          </span>
        )}
      </div>

      {/* Section 4: Narrative Summary */}
      <div className="space-y-2 mb-2.5 print-compact-text text-xs text-slate-700 dark:text-slate-300">
        {/* 4.1 Highlights */}
        <div className="p-2.5 rounded-xl bg-slate-50/70 dark:bg-[#16162e] border border-slate-200 dark:border-[#222244]">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-600" />
              1. สรุปผลการดำเนินงานสำคัญในงวดนี้ (Progress Highlights)
            </h3>
            {isInteractive && <Edit3 size={11} className="text-slate-400 no-print" />}
          </div>
          {isInteractive ? (
            <textarea
              rows={Math.max(2, (report.highlights || '').split('\n').length)}
              value={report.highlights || ''}
              onChange={(e) => onHighlightsChange && onHighlightsChange(e.target.value)}
              className="w-full bg-transparent resize-y focus:outline-none focus:bg-white dark:focus:bg-[#1c1c3a] p-1 rounded font-normal leading-relaxed text-slate-800 dark:text-slate-200 text-xs border border-transparent focus:border-slate-300 dark:focus:border-slate-700 transition-all min-h-[46px]"
            />
          ) : (
            <div className="whitespace-pre-wrap leading-relaxed text-[11px] text-black">
              {report.highlights || '—'}
            </div>
          )}
        </div>

        {/* 4.2 Issues and Causes */}
        <div className={`p-2.5 rounded-xl border ${
          isDelayed
            ? 'bg-red-500/5 border-red-500/20'
            : 'bg-slate-50/70 dark:bg-[#16162e] border-slate-200 dark:border-[#222244]'
        }`}>
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${isDelayed ? 'bg-red-500' : 'bg-amber-500'}`} />
              2. ปัญหา อุปสรรค และสาเหตุความล่าช้า (Issues & Cause of Delay)
            </h3>
            {isInteractive && <Edit3 size={11} className="text-slate-400 no-print" />}
          </div>
          {isInteractive ? (
            <textarea
              rows={Math.max(2, (report.issues || '').split('\n').length)}
              value={report.issues || ''}
              onChange={(e) => onIssuesChange && onIssuesChange(e.target.value)}
              className="w-full bg-transparent resize-y focus:outline-none focus:bg-white dark:focus:bg-[#1c1c3a] p-1 rounded font-normal leading-relaxed text-slate-800 dark:text-slate-200 text-xs border border-transparent focus:border-slate-300 dark:focus:border-slate-700 transition-all min-h-[46px]"
            />
          ) : (
            <div className="whitespace-pre-wrap leading-relaxed text-[11px] text-black">
              {report.issues || '—'}
            </div>
          )}
        </div>

        {/* 4.3 Financial Status */}
        <div className="p-2.5 rounded-xl bg-slate-50/70 dark:bg-[#16162e] border border-slate-200 dark:border-[#222244]">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
              3. สถานะการเงินและการเบิกจ่ายงบประมาณ (Financial & Disbursements)
            </h3>
            {isInteractive && <Edit3 size={11} className="text-slate-400 no-print" />}
          </div>
          {isInteractive ? (
            <textarea
              rows={Math.max(2, (report.financial || '').split('\n').length)}
              value={report.financial || ''}
              onChange={(e) => onFinancialChange && onFinancialChange(e.target.value)}
              className="w-full bg-transparent resize-y focus:outline-none focus:bg-white dark:focus:bg-[#1c1c3a] p-1 rounded font-normal leading-relaxed text-slate-800 dark:text-slate-200 text-xs border border-transparent focus:border-slate-300 dark:focus:border-slate-700 transition-all min-h-[46px]"
            />
          ) : (
            <div className="whitespace-pre-wrap leading-relaxed text-[11px] text-black">
              {report.financial || '—'}
            </div>
          )}
        </div>

        {/* 4.4 Action Plan */}
        <div className="p-2.5 rounded-xl bg-slate-50/70 dark:bg-[#16162e] border border-slate-200 dark:border-[#222244]">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
              4. แผนงานเร่งรัดและแนวทางดำเนินการในงวดถัดไป (Action & Recovery Plan)
            </h3>
            {isInteractive && <Edit3 size={11} className="text-slate-400 no-print" />}
          </div>
          {isInteractive ? (
            <textarea
              rows={Math.max(2, (report.actions || '').split('\n').length)}
              value={report.actions || ''}
              onChange={(e) => onActionsChange && onActionsChange(e.target.value)}
              className="w-full bg-transparent resize-y focus:outline-none focus:bg-white dark:focus:bg-[#1c1c3a] p-1 rounded font-normal leading-relaxed text-slate-800 dark:text-slate-200 text-xs border border-transparent focus:border-slate-300 dark:focus:border-slate-700 transition-all min-h-[46px]"
            />
          ) : (
            <div className="whitespace-pre-wrap leading-relaxed text-[11px] text-black">
              {report.actions || '—'}
            </div>
          )}
        </div>
      </div>

      {/* Section 5: Inspection Photos Row (Compact - 6 Photos in 2 Rows) */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <ImageIcon size={13} className="text-primary-600" />
            ภาพถ่ายความคืบหน้าหน้างานจริง (จากใบขอตรวจสอบคุณภาพ 6 ภาพ)
          </span>
          {isInteractive && (
            <span className="text-[10px] text-slate-400 no-print">
              (คลิกที่รูปเพื่อเลือกเปลี่ยนรูปภาพจากใบขอตรวจงาน)
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2, 3, 4, 5].map((slotIdx) => {
            const photo = report.selectedPhotos?.[slotIdx]
            return (
              <div
                key={slotIdx}
                className="rounded-xl border border-slate-200 dark:border-[#252548] p-1 bg-slate-50/50 dark:bg-[#15152c]/50 flex flex-col justify-between group relative"
              >
                <div
                  onClick={() => isInteractive && onPhotoClick && onPhotoClick(slotIdx)}
                  className={`overflow-hidden rounded-lg bg-slate-200 dark:bg-slate-800 h-[82px] flex items-center justify-center relative border border-slate-200 dark:border-slate-700 ${
                    isInteractive ? 'cursor-pointer' : ''
                  }`}
                  title={isInteractive ? 'คลิกเพื่อเลือกภาพจากใบขอตรวจสอบคุณภาพ' : undefined}
                >
                  {photo?.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photo.url}
                      alt={photo.caption || 'ภาพขอตรวจงาน'}
                      className={`w-full h-full object-cover ${
                        isInteractive ? 'group-hover:scale-105 transition-transform duration-200' : ''
                      }`}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement
                        target.style.display = 'none'
                      }}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-400 p-1 text-center">
                      <ImageIcon size={18} className="opacity-40 mb-0.5" />
                      <span className="text-[8px] font-bold">
                        {isInteractive ? `คลิกเลือกรูปภาพ ${slotIdx + 1}` : `ไม่มีรูปภาพ ${slotIdx + 1}`}
                      </span>
                    </div>
                  )}
                  {isInteractive && (
                    <span className="no-print absolute top-1 right-1 bg-black/60 hover:bg-black text-white text-[8px] font-bold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                      เปลี่ยนรูป
                    </span>
                  )}
                </div>

                {/* Caption Input or Text */}
                <div className="mt-0.5">
                  {isInteractive ? (
                    <input
                      type="text"
                      value={photo?.caption || ''}
                      placeholder={`คำบรรยายภาพที่ ${slotIdx + 1}...`}
                      onChange={(e) => onPhotoCaptionChange && onPhotoCaptionChange(slotIdx, e.target.value)}
                      className="w-full text-[9px] font-medium text-slate-600 dark:text-slate-400 bg-transparent border-b border-transparent focus:border-slate-300 focus:outline-none text-center truncate"
                    />
                  ) : (
                    <p className="text-[9px] font-medium text-slate-600 text-center truncate px-1">
                      {photo?.caption || `ภาพที่ ${slotIdx + 1}`}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function ExecutiveSummaryTab({
  project,
  inspections,
  dailyReports,
  tasks = [],
  milestones = [],
  amendments = [],
  user,
}: Props) {
  // 1. Gather all photos from "ใบขอตรวจสอบคุณภาพ" (Inspections) with proper URL parsing
  const allInspectionPhotos = useMemo(() => {
    const list: { url: string; title: string; inspection_no: string; work_type: string; date: string }[] = []
    inspections.forEach(ins => {
      (ins.photo_urls || []).forEach(pStr => {
        if (!pStr) return
        const parts = pStr.split('|||')
        const rawUrl = parts[0]?.trim()
        const customCaption = parts[1]?.trim()
        if (rawUrl) {
          list.push({
            url: rawUrl,
            title: customCaption || ins.title || 'ไม่มีชื่อรายการ',
            inspection_no: ins.inspection_no || '—',
            work_type: ins.work_type || 'งานก่อสร้าง',
            date: ins.request_date || ins.created_at || '',
          })
        }
      })
    })
    return list
  }, [inspections])

  // 2. Compute Contract Dates, Extension and Financial Stats
  const contractAmount = project.budget || 0
  const ext = useMemo(() => {
    return computeProjectExtension(project, amendments)
  }, [project, amendments])

  const currentEndDate = ext.newEndDate || (project.end_date ? new Date(project.end_date) : null)
  const approvedExtensionDays = ext.totalAmendmentDays
  const hasAmendments = amendments.length > 0
  const latestAmendment = amendments[amendments.length - 1]

  const totalContractDays = useMemo(() => {
    if (!project.start_date || !currentEndDate) return 0
    return countWorkingDays(new Date(project.start_date), currentEndDate, amendments)
  }, [project.start_date, currentEndDate, amendments])

  const daysElapsed = useMemo(() => {
    if (!project.start_date) return 0
    const start = new Date(project.start_date)
    const today = new Date()
    if (today < start) return 0
    return countWorkingDays(start, today, amendments)
  }, [project.start_date, amendments])

  const daysRemaining = Math.max(0, totalContractDays - daysElapsed)
  const timeProgressPercent = totalContractDays > 0 ? Math.min(100, (daysElapsed / totalContractDays) * 100) : 0

  // Date of report (defaults to today, editable for backdated reporting)
  const [reportDate, setReportDate] = useState<string>(() => new Date().toISOString().slice(0, 10))

  // Schedule & Tasks Progress (Synchronized with Dashboard & Weekly Reports standards)
  const { scheduledTasks, actualProgress, plannedProgress, svPercent, svDays } = useMemo(() => {
    const scheduled = computeTaskDates(tasks, project.start_date, amendments)
    const evalBase = reportDate ? new Date(reportDate) : new Date()
    const todayDateOnly = new Date(evalBase.getFullYear(), evalBase.getMonth(), evalBase.getDate())

    const totalWbsCost = scheduled.reduce((sum, t) => sum + (Number(t.cost) || 0), 0)

    let pvCumulative = 0
    let evCumulative = 0

    if (totalWbsCost > 0) {
      let totalWeightedPlanned = 0
      let totalWeightedActual = 0

      for (const t of scheduled) {
        const tStart = new Date(t.computedStartDate)
        const tEnd = new Date(t.computedEndDate)
        tStart.setHours(0, 0, 0, 0)
        tEnd.setHours(0, 0, 0, 0)
        const tCost = Number(t.cost) || 0
        const weight = tCost / totalWbsCost

        let taskPlanned = 0
        if (todayDateOnly >= tEnd) {
          taskPlanned = 100
        } else if (todayDateOnly < tStart) {
          taskPlanned = 0
        } else {
          const totalTaskTime = Math.max(1, countWorkingDays(tStart, tEnd, amendments))
          const elapsedTaskTime = countWorkingDays(tStart, todayDateOnly, amendments)
          taskPlanned = (elapsedTaskTime / totalTaskTime) * 100
        }

        totalWeightedPlanned += weight * taskPlanned
        totalWeightedActual += weight * (t.actual_progress || 0)
      }

      pvCumulative = totalWeightedPlanned
      evCumulative = totalWeightedActual
    } else {
      let totalPlanned = 0
      let totalActual = 0
      for (const t of scheduled) {
        const tStart = new Date(t.computedStartDate)
        const tEnd = new Date(t.computedEndDate)
        tStart.setHours(0, 0, 0, 0)
        tEnd.setHours(0, 0, 0, 0)

        let taskPlanned = 0
        if (todayDateOnly >= tEnd) {
          taskPlanned = 100
        } else if (todayDateOnly < tStart) {
          taskPlanned = 0
        } else {
          const totalTaskTime = Math.max(1, countWorkingDays(tStart, tEnd, amendments))
          const elapsedTaskTime = countWorkingDays(tStart, todayDateOnly, amendments)
          taskPlanned = (elapsedTaskTime / totalTaskTime) * 100
        }
        totalPlanned += taskPlanned
        totalActual += t.actual_progress || 0
      }
      if (scheduled.length > 0) {
        pvCumulative = totalPlanned / scheduled.length
        evCumulative = totalActual / scheduled.length
      }
    }

    if (scheduled.length === 0) {
      evCumulative = Number(project.progress) || 0
      pvCumulative = Number(project.planned_progress) || 0
    }

    const sv = evCumulative - pvCumulative
    let svD = 0
    if (ext.totalDays > 0) {
      svD = Math.round((sv / 100) * ext.totalDays)
    }

    return {
      scheduledTasks: scheduled,
      actualProgress: evCumulative,
      plannedProgress: pvCumulative,
      svPercent: sv,
      svDays: svD,
    }
  }, [tasks, project.start_date, project.progress, project.planned_progress, amendments, ext.totalDays, reportDate])

  const progressDiff = svPercent
  const isDelayed = svPercent < -0.5 || svDays < 0
  const isAhead = svPercent > 0.5 && svDays > 0
  const delayDays = Math.abs(svDays)

  // Forecast Completion Date calculation
  const forecastCompletion = useMemo(() => {
    if (!currentEndDate) return null

    if (!isDelayed) {
      return {
        date: currentEndDate,
        isOverdue: false,
        overdueDays: 0,
        text: 'ตามกำหนดสัญญา',
      }
    }

    const overdueDays = Math.max(1, delayDays)
    const projectedFinish = new Date(currentEndDate)
    projectedFinish.setDate(projectedFinish.getDate() + overdueDays)

    return {
      date: projectedFinish,
      isOverdue: true,
      overdueDays,
      text: `เกินสัญญา ~${overdueDays} วัน`,
    }
  }, [currentEndDate, isDelayed, delayDays])

  // Financial & Milestones
  const paidMilestones = milestones.filter(m => m.is_paid || m.status === 'Paid')
  const paidAmount = paidMilestones.reduce((sum, m) => sum + (Number(m.amount) || 0), 0)
  const paidPercent = contractAmount > 0 ? (paidAmount / contractAmount) * 100 : 0
  const remainingDisbursement = Math.max(0, contractAmount - paidAmount)

  const nextMilestone = milestones.find(m => !m.is_paid && m.status !== 'Paid')

  // Weather: Rainy days count from Daily Reports
  const rainyDaysCount = useMemo(() => {
    return dailyReports.filter(d => {
      const w = (d.weather || '').toLowerCase()
      const p = Number(d.precipitation) || 0
      return w.includes('ฝน') || w.includes('rain') || p > 0
    }).length
  }, [dailyReports])

  const totalDaysObserved = Math.max(daysElapsed, dailyReports.length, 1)
  const rainPercentage = ((rainyDaysCount / totalDaysObserved) * 100).toFixed(1)

  // 3. Smart Auto-Draft Generators
  const generateAutoDrafts = () => {
    let hText = `โครงการดำเนินงานมีความก้าวหน้าสะสม ${actualProgress.toFixed(1)}% `
    if (scheduledTasks.length > 0) {
      const completedTasks = scheduledTasks.filter(t => (Number(t.actual_progress) || 0) >= 100)
      const activeTasks = scheduledTasks.filter(t => (Number(t.actual_progress) || 0) > 0 && (Number(t.actual_progress) || 0) < 100)
      if (completedTasks.length > 0) {
        hText += `โดยดำเนินงานสำคัญแล้วเสร็จ ได้แก่ ${completedTasks.slice(0, 2).map(t => `${t.name} (100%)`).join(', ')} `
      }
      if (activeTasks.length > 0) {
        hText += `และกำลังดำเนินการ ${activeTasks.slice(0, 2).map(t => `${t.name} (คืบหน้า ${t.actual_progress}%)`).join(', ')} อย่างต่อเนื่อง`
      } else if (completedTasks.length === 0) {
        hText += `อยู่ระหว่างการเตรียมงานและเข้าดำเนินงานตามงวดงานก่อสร้าง`
      }
    } else {
      hText += `อยู่ระหว่างการดำเนินงานตามแผนงานงวดงานก่อสร้าง`
    }

    let iText = ''
    if (isDelayed) {
      iText += `ผลงานสะสม ${actualProgress.toFixed(1)}% ช้ากว่าแผนงาน ${Math.abs(svPercent).toFixed(1)}% (ล่าช้าประมาณ ${delayDays} วัน คาดการณ์ว่าจะแล้วเสร็จประมาณ ${formatThaiDate(forecastCompletion?.date.toISOString())} ซึ่งเกินกำหนดสัญญาประมาณ ${delayDays} วัน) `
      if (hasAmendments && latestAmendment) {
        iText += `สืบเนื่องจากโครงการมีการแก้ไขสัญญา (${latestAmendment.reason || `ครั้งที่ ${latestAmendment.amendment_no}`}) ขยายเวลา +${latestAmendment.extra_days} วัน ส่งผลให้ต้องปรับแผนการปฏิบัติงาน `
      }
      if (rainyDaysCount > 0) {
        iText += `ประกอบกับในรอบการทำงานมีสถิติฝนตกสะสมจำนวน ${rainyDaysCount} วัน จากทั้งหมด ${totalDaysObserved} วัน (${rainPercentage}%) ส่งผลกระทบต่องานภายนอกอาคารและงานโครงสร้างดิน `
      }
      if (!hasAmendments && rainyDaysCount === 0) {
        iText += `เนื่องจากปัญหาหน้างานด้านการจัดสรรกำลังคนและเครื่องจักรของผู้รับจ้าง `
      }
    } else if (isAhead) {
      iText = `โครงการมีความก้าวหน้า ${actualProgress.toFixed(1)}% เร็วกว่าแผนงาน +${svPercent.toFixed(1)}% (เร็วกว่ากำหนดประมาณ ${Math.abs(svDays)} วัน) การปฏิบัติงานเป็นไปอย่างราบรื่น คาดว่าจะแล้วเสร็จตามกำหนดสัญญา (${formatThaiDate(currentEndDate?.toISOString())}) ไม่พบปัญหาหรืออุปสรรคสำคัญ`
    } else {
      iText = `โครงการดำเนินงานเป็นไปตามกรอบแผนงาน (ส่วนต่าง ${svPercent.toFixed(1)}%) การบริหารจัดการพื้นที่หน้างานและการจัดส่งวัสดุเป็นไปตามแผนที่กำหนด คาดว่างานจะแล้วเสร็จตามสัญญา (${formatThaiDate(currentEndDate?.toISOString())})`
    }

    let fText = `ปัจจุบันโครงการได้เบิกจ่ายงบประมาณไปแล้ว ${paidMilestones.length} งวด เป็นจำนวนเงิน ${formatMoney(paidAmount)} บาท (คิดเป็น ${paidPercent.toFixed(1)}% ของวงเงินสัญญา) คงเหลือวงเงินเบิกจ่าย ${formatMoney(remainingDisbursement)} บาท `
    if (nextMilestone) {
      fText += `สำหรับงวดงานถัดไป (งวดที่ ${nextMilestone.milestone_no}) วงเงิน ${formatMoney(Number(nextMilestone.amount) || 0)} บาท อยู่ระหว่างเตรียมความพร้อมเพื่อตรวจรับงาน`
    }

    let aText = ''
    if (isDelayed) {
      if (hasAmendments) {
        aText += `- เร่งรัดการปรับแผนการทำงานให้สอดคล้องกับสัญญาแก้ไขเพิ่มเติม เพื่อให้ผู้รับจ้างสามารถเข้าดำเนินงานได้เต็มกำลัง\n`
      }
      aText += `- สั่งการให้ผู้รับจ้างเพิ่มชุดแรงงานและเครื่องจักรในกิจกรรมที่ล่าช้า และขยายเวลาทำงานล่วงเวลา (OT)\n- ปรับแผนงานแบบ Fast-tracking โดยเร่งรัดกิจกรรมวิกฤต (Critical Path) เพื่อชดเชยเวลาที่ล่าช้า ${delayDays} วัน`
    } else {
      aText = `- ควบคุมคุณภาพงานก่อสร้างตามมาตรฐานแบบรูปและรายการอย่างต่อเนื่อง\n- ประสานงานเตรียมความพร้อมในการส่งมอบและตรวจรับงวดงานถัดไปให้เป็นไปตามกำหนดเวลา`
    }

    return {
      highlights: hText,
      issues: iText,
      financial: fText,
      actions: aText,
      contractStatusTag: hasAmendments && latestAmendment
        ? `📝 มีการแก้ไขสัญญา (ครั้งที่ ${latestAmendment.amendment_no} ขยายเวลา +${approvedExtensionDays} วัน)`
        : isDelayed
        ? `⚠️ งานล่าช้ากว่าแผน ~${delayDays} วัน (อยู่ระหว่างเร่งรัด)`
        : isAhead
        ? `🚀 ผลงานเร็วกว่าแผนงาน +${svPercent.toFixed(1)}%`
        : `🟢 ปฏิบัติงานตามแผนปกติ`,
    }
  }

  // 4. State for editable texts & photos
  const initialDrafts = useMemo(() => generateAutoDrafts(), [
    project, actualProgress, plannedProgress, progressDiff, svPercent, svDays, isDelayed, isAhead, delayDays,
    hasAmendments, latestAmendment, approvedExtensionDays, rainyDaysCount, totalDaysObserved, rainPercentage, paidMilestones,
    paidAmount, paidPercent, remainingDisbursement, nextMilestone, scheduledTasks, forecastCompletion, currentEndDate
  ])

  const [highlights, setHighlights] = useState(initialDrafts.highlights)
  const [issues, setIssues] = useState(initialDrafts.issues)
  const [financial, setFinancial] = useState(initialDrafts.financial)
  const [actions, setActions] = useState(initialDrafts.actions)
  const [contractStatusTag, setContractStatusTag] = useState(initialDrafts.contractStatusTag)

  // Selected Photos from Inspections (up to 6 photos in 2 rows)
  const [selectedPhotos, setSelectedPhotos] = useState<PhotoSelection[]>(() => {
    const photos: PhotoSelection[] = []
    allInspectionPhotos.slice(0, 6).forEach(p => {
      photos.push({
        url: p.url,
        caption: `${p.inspection_no}: ${p.title}`,
        inspection_no: p.inspection_no,
      })
    })
    return photos
  })

  // Modal for changing photo
  const [pickerSlotIndex, setPickerSlotIndex] = useState<number | null>(null)

  // Snapshots History Management
  const [snapshots, setSnapshots] = useState<ExecutiveReportSnapshot[]>([])
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string>('live')
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('')

  // Batch Selection State
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>(['live'])
  const [batchPrintReports, setBatchPrintReports] = useState<ExecutiveReportSnapshot[]>([])

  // Sync auto-drafts when in live mode and KPIs update
  useEffect(() => {
    if (selectedSnapshotId === 'live') {
      const d = generateAutoDrafts()
      setHighlights(d.highlights)
      setIssues(d.issues)
      setFinancial(d.financial)
      setActions(d.actions)
      setContractStatusTag(d.contractStatusTag)
    }
  }, [project.id, actualProgress, plannedProgress, isDelayed, delayDays, approvedExtensionDays])

  // Load snapshots from Supabase and fallback to localStorage
  useEffect(() => {
    const storageKey = `exec_reports_${project.id}`
    async function loadSnapshots() {
      try {
        const { data } = await supabase
          .from('system_settings')
          .select('value')
          .eq('key', storageKey)
          .maybeSingle()

        if (data?.value) {
          const parsed = JSON.parse(data.value)
          if (Array.isArray(parsed)) {
            setSnapshots(parsed)
            setSelectedBatchIds(['live', ...parsed.map((s: ExecutiveReportSnapshot) => s.id)])
            localStorage.setItem(storageKey, data.value)
            return
          }
        }
      } catch (err) {
        console.warn('Could not load snapshots from Supabase:', err)
      }

      try {
        const local = localStorage.getItem(storageKey)
        if (local) {
          const parsed = JSON.parse(local)
          if (Array.isArray(parsed)) {
            setSnapshots(parsed)
            setSelectedBatchIds(['live', ...parsed.map((s: ExecutiveReportSnapshot) => s.id)])
          }
        }
      } catch {}
    }

    loadSnapshots()
  }, [project.id])

  // Current Live Report Object
  const liveReportObj: ExecutiveReportSnapshot = useMemo(() => ({
    id: 'live',
    title: 'ฉบับปัจจุบัน (Live Draft)',
    created_at: new Date().toISOString(),
    reportDate,
    highlights,
    issues,
    financial,
    actions,
    contractStatusTag,
    selectedPhotos,
    actualProgress,
    plannedProgress,
  }), [reportDate, highlights, issues, financial, actions, contractStatusTag, selectedPhotos, actualProgress, plannedProgress])

  // Currently Active Report to display in the main viewer
  const currentActiveReport: ExecutiveReportSnapshot = useMemo(() => {
    if (selectedSnapshotId === 'live') return liveReportObj
    return snapshots.find(s => s.id === selectedSnapshotId) || liveReportObj
  }, [selectedSnapshotId, liveReportObj, snapshots])

  // All available reports
  const allAvailableReports = useMemo(() => {
    return [liveReportObj, ...snapshots]
  }, [liveReportObj, snapshots])

  // Save current snapshot
  const handleSaveSnapshot = async () => {
    setIsSaving(true)
    const now = new Date()
    const defaultTitle = `รายงานสถานะ (${formatThaiDate(reportDate)})`
    const title = prompt('กรุณาตั้งชื่อรายงานฉบับนี้:', defaultTitle)
    
    if (!title) {
      setIsSaving(false)
      return
    }

    const newSnapshot: ExecutiveReportSnapshot = {
      id: `snap_${Date.now()}`,
      title,
      created_at: now.toISOString(),
      reportDate,
      highlights,
      issues,
      financial,
      actions,
      contractStatusTag,
      selectedPhotos,
      actualProgress,
      plannedProgress,
    }

    const updated = [newSnapshot, ...snapshots]
    setSnapshots(updated)
    setSelectedSnapshotId(newSnapshot.id)
    setSelectedBatchIds(prev => [...prev, newSnapshot.id])

    const storageKey = `exec_reports_${project.id}`
    const serialized = JSON.stringify(updated)
    try {
      localStorage.setItem(storageKey, serialized)
      const { data: existing } = await supabase
        .from('system_settings')
        .select('id')
        .eq('key', storageKey)
        .maybeSingle()

      if (existing) {
        await supabase.from('system_settings').update({ value: serialized }).eq('key', storageKey)
      } else {
        await supabase.from('system_settings').insert({ key: storageKey, value: serialized })
      }
    } catch (err) {
      console.error('Error saving snapshot:', err)
    }

    setIsSaving(false)
    setSaveSuccessMsg('บันทึกรายงานฉบับนี้เรียบร้อยแล้ว!')
    setTimeout(() => setSaveSuccessMsg(''), 3000)
  }

  // Switch between Live and Saved Snapshots
  const handleSelectSnapshot = (snapId: string) => {
    setSelectedSnapshotId(snapId)
    if (snapId === 'live') {
      const d = generateAutoDrafts()
      setHighlights(d.highlights)
      setIssues(d.issues)
      setFinancial(d.financial)
      setActions(d.actions)
      setContractStatusTag(d.contractStatusTag)
      setReportDate(new Date().toISOString().slice(0, 10))
      return
    }

    const target = snapshots.find(s => s.id === snapId)
    if (target) {
      setHighlights(target.highlights)
      setIssues(target.issues)
      setFinancial(target.financial)
      setActions(target.actions)
      setContractStatusTag(target.contractStatusTag)
      if (target.reportDate) {
        setReportDate(target.reportDate)
      } else if (target.created_at) {
        setReportDate(target.created_at.slice(0, 10))
      }
      if (target.selectedPhotos && target.selectedPhotos.length > 0) {
        setSelectedPhotos(target.selectedPhotos)
      }
    }
  }

  // Delete a snapshot
  const handleDeleteSnapshot = async (snapId: string) => {
    if (!confirm('คุณต้องการลบรายงานฉบับที่บันทึกไว้นี้ใช่หรือไม่?')) return
    const updated = snapshots.filter(s => s.id !== snapId)
    setSnapshots(updated)
    setSelectedBatchIds(prev => prev.filter(id => id !== snapId))
    if (selectedSnapshotId === snapId) {
      handleSelectSnapshot('live')
    }
    const storageKey = `exec_reports_${project.id}`
    const serialized = JSON.stringify(updated)
    try {
      localStorage.setItem(storageKey, serialized)
      await supabase.from('system_settings').update({ value: serialized }).eq('key', storageKey)
    } catch {}
  }

  // Re-generate auto draft handler
  const handleRegenerate = () => {
    const d = generateAutoDrafts()
    setHighlights(d.highlights)
    setIssues(d.issues)
    setFinancial(d.financial)
    setActions(d.actions)
    setContractStatusTag(d.contractStatusTag)
    setSelectedSnapshotId('live')
  }

  // Batch Print Handlers
  const handleBatchPrint = () => {
    const toPrint = allAvailableReports.filter(r => selectedBatchIds.includes(r.id))
    if (toPrint.length === 0) return
    setBatchPrintReports(toPrint)
    setTimeout(() => {
      window.print()
    }, 150)
  }

  const handleSinglePrint = () => {
    setBatchPrintReports([currentActiveReport])
    setTimeout(() => {
      window.print()
    }, 150)
  }

  const handleToggleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedBatchIds(allAvailableReports.map(r => r.id))
    } else {
      setSelectedBatchIds([])
    }
  }

  const handleToggleBatchId = (id: string) => {
    setSelectedBatchIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  // List of reports to be printed during window.print()
  const reportsToPrint = useMemo(() => {
    if (batchPrintReports.length > 0) return batchPrintReports
    if (selectedBatchIds.length > 0) {
      const filtered = allAvailableReports.filter(r => selectedBatchIds.includes(r.id))
      if (filtered.length > 0) return filtered
    }
    return [currentActiveReport]
  }, [batchPrintReports, selectedBatchIds, allAvailableReports, currentActiveReport])

  return (
    <div className="space-y-4">
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page {
            size: A4 portrait;
            margin: 6mm 8mm;
          }
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
          .print-page {
            page-break-after: always !important;
            break-after: page !important;
            padding: 0 !important;
            margin: 0 !important;
            min-height: 98vh;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .print-page:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          .print-container {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
          }
          .print-compact-text {
            font-size: 11px !important;
            line-height: 1.35 !important;
          }
          .print-compact-heading {
            font-size: 13px !important;
          }
        }
      `}} />

      {/* ── Screen Two-Column Layout (Hidden in Print) ── */}
      <div className="no-print flex flex-col lg:flex-row gap-4 items-start">
        
        {/* ── Left Sidebar: Compact (w-full lg:w-72 flex-shrink-0) ── */}
        <div className="w-full lg:w-72 flex-shrink-0 flex flex-col gap-3">
          <div className="bg-white dark:bg-[#13132a] border border-slate-200 dark:border-[#1e1e38] rounded-2xl p-3.5 shadow-xs flex flex-col gap-3">
            
            {/* Header with count badge */}
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-[#1e1e38]">
              <div className="flex items-center gap-2">
                <History size={15} className="text-primary-600 dark:text-primary-400" />
                <span className="text-xs font-bold text-slate-800 dark:text-white">ประวัติรายงานสถานะ</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-[#1e1e38] text-slate-600 dark:text-slate-300">
                {allAvailableReports.length} ฉบับ
              </span>
            </div>

            {/* Batch Action Toolbar */}
            <div className="flex items-center justify-between pt-0.5 text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">
                <input
                  type="checkbox"
                  checked={allAvailableReports.length > 0 && selectedBatchIds.length === allAvailableReports.length}
                  onChange={handleToggleSelectAll}
                  className="w-4 h-4 rounded text-primary-600 border-slate-300 dark:border-slate-700 focus:ring-primary-500 cursor-pointer"
                />
                <span className="text-[11px] font-bold">เลือกทั้งหมด ({selectedBatchIds.length})</span>
              </label>

              <button
                type="button"
                onClick={handleBatchPrint}
                disabled={selectedBatchIds.length === 0}
                className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded-xl bg-primary-600 hover:bg-primary-700 text-white disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer shadow-xs"
                title="พิมพ์รายงานที่เลือกพร้อมกันทั้งหมด"
              >
                <Printer size={12} />
                <span>พิมพ์ชุด ({selectedBatchIds.length})</span>
              </button>
            </div>

            {/* Scrollable list of reports */}
            <div className="max-h-[calc(100vh-270px)] overflow-y-auto space-y-2 pr-1">
              
              {/* 1. Live Draft Card */}
              <div
                onClick={() => handleSelectSnapshot('live')}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-1.5 relative select-none ${
                  selectedSnapshotId === 'live'
                    ? 'border-primary-500 bg-primary-50/20 dark:bg-primary-950/20 shadow-xs ring-1 ring-primary-500/30'
                    : 'border-slate-200 dark:border-[#252548] bg-slate-50/60 dark:bg-[#16162e] hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedBatchIds.includes('live')}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => handleToggleBatchId('live')}
                      className="w-4 h-4 rounded text-primary-600 border-slate-300 dark:border-slate-700 focus:ring-primary-500 cursor-pointer"
                    />
                    <span className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-1">
                      📄 ฉบับปัจจุบัน
                    </span>
                  </div>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400">
                    Live Draft
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-500 pl-6">
                  <span>{formatThaiDate(reportDate)}</span>
                  <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                    จริง {actualProgress.toFixed(1)}% | แผน {plannedProgress.toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* 2. Saved Snapshot Cards */}
              {snapshots.map((snap) => {
                const isSelected = selectedSnapshotId === snap.id
                const isChecked = selectedBatchIds.includes(snap.id)
                return (
                  <div
                    key={snap.id}
                    onClick={() => handleSelectSnapshot(snap.id)}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-1.5 relative select-none ${
                      isSelected
                        ? 'border-primary-500 bg-primary-50/20 dark:bg-primary-950/20 shadow-xs ring-1 ring-primary-500/30'
                        : 'border-slate-200 dark:border-[#252548] bg-slate-50/60 dark:bg-[#16162e] hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0 flex-1 mr-1">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => handleToggleBatchId(snap.id)}
                          className="w-4 h-4 rounded text-primary-600 border-slate-300 dark:border-slate-700 focus:ring-primary-500 cursor-pointer flex-shrink-0"
                        />
                        <span className="text-xs font-bold text-slate-800 dark:text-white truncate" title={snap.title}>
                          📅 {snap.title}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteSnapshot(snap.id)
                        }}
                        title="ลบรายงานฉบับนี้"
                        className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors cursor-pointer flex-shrink-0"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 pl-6">
                      <span>{formatThaiDate(snap.reportDate || snap.created_at)}</span>
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                        จริง {snap.actualProgress?.toFixed(1) ?? '—'}% | แผน {snap.plannedProgress?.toFixed(1) ?? '—'}%
                      </span>
                    </div>
                  </div>
                )
              })}

              {snapshots.length === 0 && (
                <div className="text-center py-5 px-2 bg-slate-50/50 dark:bg-[#16162e]/50 rounded-xl border border-dashed border-slate-200 dark:border-[#252548]">
                  <p className="text-[11px] text-slate-400">
                    ยังไม่มีประวัติที่บันทึกไว้<br />กด &apos;💾 บันทึกรายงาน&apos; เพื่อเก็บเป็นประวัติ
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Right Content Area: (flex-1 min-w-0 flex flex-col gap-3) ── */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          
          {/* Top Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-[#13132a] border border-slate-200 dark:border-[#1e1e38] rounded-2xl p-4 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary-600/10 text-primary-600 dark:text-primary-400 flex items-center justify-center font-bold flex-shrink-0">
                <FileText size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-slate-800 dark:text-white">
                    {selectedSnapshotId === 'live'
                      ? 'รายงานสรุปสถานะโครงการสำหรับเสนอผู้บริหาร (Executive Summary)'
                      : `ประวัติรายงาน: ${currentActiveReport.title}`}
                  </h2>
                  {saveSuccessMsg && (
                    <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 animate-fade-in flex items-center gap-1">
                      <Check size={12} /> {saveSuccessMsg}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  ออกแบบให้จัดพิมพ์พอดีใน 1 หน้ากระดาษ A4 • บันทึกดูย้อนหลังได้ • ดึงรูปจากใบขอตรวจสอบคุณภาพ
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Save Button */}
              <button
                type="button"
                onClick={handleSaveSnapshot}
                disabled={isSaving}
                title="บันทึกรายงานฉบับปัจจุบันไว้ดูย้อนหลังในอนาคต"
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer"
              >
                <Save size={14} />
                <span>💾 บันทึกรายงาน</span>
              </button>

              {/* Regenerate Button */}
              <button
                type="button"
                onClick={handleRegenerate}
                title="ให้ระบบวิเคราะห์ข้อมูลและร่างข้อความใหม่อีกครั้ง"
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-[#252548] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#1e1e38] transition-colors cursor-pointer"
              >
                <Sparkles size={14} className="text-amber-500" />
                <span>✨ ร่างข้อความอัตโนมัติ</span>
              </button>

              {/* Print Single Button */}
              <button
                type="button"
                onClick={handleSinglePrint}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-primary-600 hover:bg-primary-700 text-white shadow-xs transition-colors cursor-pointer"
              >
                <Printer size={14} />
                <span>🖨 พิมพ์ฉบับนี้ (A4)</span>
              </button>
            </div>
          </div>

          {/* A4 Report Interactive Preview Container */}
          <div className="print-container bg-white dark:bg-[#13132a] border border-slate-200 dark:border-[#1e1e38] rounded-2xl p-6 shadow-sm text-slate-800 dark:text-slate-200">
            <ExecutiveReportA4Card
              project={project}
              report={currentActiveReport}
              contractAmount={contractAmount}
              totalContractDays={totalContractDays}
              daysRemaining={daysRemaining}
              timeProgressPercent={timeProgressPercent}
              currentEndDate={currentEndDate}
              forecastCompletion={forecastCompletion}
              paidMilestones={paidMilestones}
              paidAmount={paidAmount}
              paidPercent={paidPercent}
              remainingDisbursement={remainingDisbursement}
              rainyDaysCount={rainyDaysCount}
              totalDaysObserved={totalDaysObserved}
              rainPercentage={rainPercentage}
              isInteractive={true}
              onReportDateChange={(val) => setReportDate(val)}
              onContractStatusTagChange={(val) => setContractStatusTag(val)}
              onHighlightsChange={(val) => setHighlights(val)}
              onIssuesChange={(val) => setIssues(val)}
              onFinancialChange={(val) => setFinancial(val)}
              onActionsChange={(val) => setActions(val)}
              onPhotoClick={(idx) => setPickerSlotIndex(idx)}
              onPhotoCaptionChange={(idx, cap) => {
                const next = [...selectedPhotos]
                if (!next[idx]) {
                  next[idx] = { url: '', caption: cap, inspection_no: '' }
                } else {
                  next[idx] = { ...next[idx], caption: cap }
                }
                setSelectedPhotos(next)
              }}
            />
          </div>

        </div>
      </div>

      {/* ── Batch Print Output (Hidden on Screen, Active on Print) ── */}
      <div className="hidden print:block print-all-wrapper">
        {reportsToPrint.map((snap) => (
          <div key={snap.id} className="print-page print-container text-slate-800 dark:text-slate-200">
            <ExecutiveReportA4Card
              project={project}
              report={snap}
              contractAmount={contractAmount}
              totalContractDays={totalContractDays}
              daysRemaining={daysRemaining}
              timeProgressPercent={timeProgressPercent}
              currentEndDate={currentEndDate}
              forecastCompletion={forecastCompletion}
              paidMilestones={paidMilestones}
              paidAmount={paidAmount}
              paidPercent={paidPercent}
              remainingDisbursement={remainingDisbursement}
              rainyDaysCount={rainyDaysCount}
              totalDaysObserved={totalDaysObserved}
              rainPercentage={rainPercentage}
              isInteractive={false}
            />
          </div>
        ))}
      </div>

      {/* ── Photo Picker Modal (Hidden in Print) ── */}
      {pickerSlotIndex !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs no-print animate-fade-in">
          <div className="bg-white dark:bg-[#13132a] border border-slate-200 dark:border-[#252548] rounded-2xl p-5 max-w-2xl w-full shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#1e1e38]">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ImageIcon size={16} className="text-primary-600" />
                  เลือกรูปภาพจากใบขอตรวจสอบคุณภาพ (Inspections)
                </h3>
                <p className="text-[11px] text-slate-500">
                  สำหรับใส่ในช่องรูปภาพที่ {pickerSlotIndex + 1}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPickerSlotIndex(null)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1e1e38] text-slate-400 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* List of inspection photos */}
            <div className="flex-1 overflow-y-auto py-4">
              {allInspectionPhotos.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  ยังไม่มีรูปภาพในใบขอตรวจสอบคุณภาพของโครงการนี้
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {allInspectionPhotos.map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        const next = [...selectedPhotos]
                        next[pickerSlotIndex] = {
                          url: item.url,
                          caption: `${item.inspection_no}: ${item.title}`,
                          inspection_no: item.inspection_no,
                        }
                        setSelectedPhotos(next)
                        setPickerSlotIndex(null)
                      }}
                      className="group flex flex-col text-left rounded-xl overflow-hidden border border-slate-200 dark:border-[#252548] hover:border-primary-500 hover:ring-2 hover:ring-primary-500/20 transition-all cursor-pointer bg-slate-50 dark:bg-[#171732]"
                    >
                      <div className="h-28 bg-slate-200 dark:bg-slate-800 overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.url}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      </div>
                      <div className="p-2">
                        <span className="text-[9px] font-bold font-mono text-primary-600 dark:text-primary-400 block truncate">
                          {item.inspection_no}
                        </span>
                        <p className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 line-clamp-1">
                          {item.title}
                        </p>
                        <span className="text-[9px] text-slate-400 block mt-0.5">
                          {item.work_type}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-[#1e1e38] flex justify-end">
              <button
                type="button"
                onClick={() => setPickerSlotIndex(null)}
                className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-[#252548] text-slate-600 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
