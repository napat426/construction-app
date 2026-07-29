'use client'

import { useState, useTransition, useMemo } from 'react'
import {
  CheckCircle2,
  XCircle,
  MinusCircle,
  Clock,
  Printer,
  Search,
  FileText,
} from 'lucide-react'
import type { Project, ChecklistMaster, ProjectChecklistResult, ChecklistStatus } from '@/lib/types'
import type { UserSession } from '@/lib/auth'
import { updateChecklistResult } from '@/app/actions/checklist'

interface Props {
  project: Project
  masters: ChecklistMaster[]
  results: ProjectChecklistResult[]
  user?: UserSession | null
}

export function ChecklistClient({ project, masters: initialMasters, results: initialResults }: Props) {
  const [masters] = useState<ChecklistMaster[]>(initialMasters)
  const [resultsMap, setResultsMap] = useState<Record<string, ProjectChecklistResult>>(() => {
    const map: Record<string, ProjectChecklistResult> = {}
    initialResults.forEach((r) => {
      map[r.master_id] = r
    })
    return map
  })

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [, startTransition] = useTransition()

  // Extract unique categories in sort order
  const categories = useMemo(() => {
    const cats: string[] = []
    masters.forEach((m) => {
      if (!cats.includes(m.category)) {
        cats.push(m.category)
      }
    })
    return cats
  }, [masters])

  // Statistics calculation
  const stats = useMemo(() => {
    const total = masters.length
    let passed = 0
    let failed = 0
    let na = 0
    let pending = 0

    masters.forEach((m) => {
      const res = resultsMap[m.id]
      const status = res?.status || 'pending'
      if (status === 'passed') passed++
      else if (status === 'failed') failed++
      else if (status === 'na') na++
      else pending++
    })

    const inspectedCount = passed + failed + na
    const progressPct = total > 0 ? Math.round((inspectedCount / total) * 100) : 0

    return { total, passed, failed, na, pending, inspectedCount, progressPct }
  }, [masters, resultsMap])

  // Update Status for an item
  const handleStatusChange = (masterId: string, newStatus: ChecklistStatus) => {
    const currentRes = resultsMap[masterId]
    const updatedStatus: ChecklistStatus = currentRes?.status === newStatus ? 'pending' : newStatus

    // Optimistic UI update
    setResultsMap((prev) => ({
      ...prev,
      [masterId]: {
        id: prev[masterId]?.id || `temp-${masterId}`,
        project_id: project.id,
        master_id: masterId,
        status: updatedStatus,
        note: prev[masterId]?.note || null,
        updated_at: new Date().toISOString(),
      },
    }))

    startTransition(async () => {
      const res = await updateChecklistResult(project.id, masterId, updatedStatus)
      if (res.error) {
        console.error('Error saving checklist result:', res.error)
      }
    })
  }

  // Filter items
  const filteredMasters = useMemo(() => {
    return masters.filter((m) => {
      const matchesSearch =
        m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.description && m.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        m.category.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesCat = selectedCategory === 'all' || m.category === selectedCategory
      return matchesSearch && matchesCat
    })
  }, [masters, searchQuery, selectedCategory])

  // Group filtered items by category
  const groupedMasters = useMemo(() => {
    const groups: Record<string, ChecklistMaster[]> = {}
    filteredMasters.forEach((m) => {
      if (!groups[m.category]) {
        groups[m.category] = []
      }
      groups[m.category].push(m)
    })
    return groups
  }, [filteredMasters])

  return (
    <div className="space-y-6 print:m-0 print:space-y-4">
      {/* ── Print CSS ── */}
      <style type="text/css" media="print">{`
        @page {
          size: A4 portrait;
          margin: 10mm 8mm !important;
        }
        html, body {
          background-color: white !important;
          background: white !important;
          color: #0f172a !important;
          font-size: 10px !important;
        }
        header, nav, aside, footer, .print-hidden, .no-print {
          display: none !important;
        }
        .print-layout {
          display: block !important;
          width: 100% !important;
        }
        table {
          width: 100% !important;
          border-collapse: collapse !important;
        }
        th, td {
          border: 1px solid #cbd5e1 !important;
          padding: 6px 8px !important;
        }
      `}</style>

      {/* ── Control Header Bar (Hidden in Print) ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-[#13132a] p-5 rounded-2xl border border-slate-200 dark:border-[#252548] shadow-xs print:hidden">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            Checklist ตรวจรับงานก่อสร้าง (Master Checklist)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            รายการตรวจรับมาตรฐานงานก่อสร้างประจำโครงการ: <strong className="text-primary-600 dark:text-primary-400">{project.name}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-[#1e1e38] border border-slate-200 dark:border-[#252548] rounded-xl hover:bg-slate-50 dark:hover:bg-[#252548] transition-colors shadow-xs cursor-pointer"
          >
            <Printer size={16} /> พิมพ์รายงาน Checklist
          </button>
        </div>
      </div>

      {/* ── Printable Header ── */}
      <div className="hidden print:block text-center mb-4">
        <h1 className="text-xl font-bold mb-1">Checklist ตรวจรับงานก่อสร้าง (Master Checklist)</h1>
        <h2 className="text-sm font-semibold">โครงการ: {project.name}</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          วันที่พิมพ์: {new Date().toLocaleDateString('th-TH', { dateStyle: 'long' })}
        </p>
      </div>

      {/* ── Summary Statistics Cards (Hidden in Print) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 print:hidden">
        {/* Total Progress Card */}
        <div className="col-span-2 sm:col-span-1 p-3.5 bg-white dark:bg-[#13132a] border border-slate-200 dark:border-[#252548] rounded-2xl shadow-xs">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ความก้าวหน้าการตรวจ</p>
          <p className="text-xl font-black text-slate-900 dark:text-white mt-1">
            {stats.progressPct}%
          </p>
          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className="bg-primary-600 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${stats.progressPct}%` }}
            />
          </div>
        </div>

        {/* Passed Count */}
        <div className="p-3.5 bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-2xl shadow-xs">
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 size={16} />
            <span className="text-[10px] font-bold uppercase">ผ่าน (Passed)</span>
          </div>
          <p className="text-xl font-black text-emerald-700 dark:text-emerald-300 mt-1">
            {stats.passed} <span className="text-xs font-normal">รายการ</span>
          </p>
        </div>

        {/* Failed Count */}
        <div className="p-3.5 bg-red-50/70 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-2xl shadow-xs">
          <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
            <XCircle size={16} />
            <span className="text-[10px] font-bold uppercase">ไม่ผ่าน (Failed)</span>
          </div>
          <p className="text-xl font-black text-red-700 dark:text-red-300 mt-1">
            {stats.failed} <span className="text-xs font-normal">รายการ</span>
          </p>
        </div>

        {/* N/A Count */}
        <div className="p-3.5 bg-slate-100/70 dark:bg-slate-800/40 border border-slate-300 dark:border-slate-700/50 rounded-2xl shadow-xs">
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
            <MinusCircle size={16} />
            <span className="text-[10px] font-bold uppercase">ไม่มีงานในส่วนนี้ (N/A)</span>
          </div>
          <p className="text-xl font-black text-slate-700 dark:text-slate-300 mt-1">
            {stats.na} <span className="text-xs font-normal">รายการ</span>
          </p>
        </div>

        {/* Pending Count */}
        <div className="p-3.5 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl shadow-xs">
          <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
            <Clock size={16} />
            <span className="text-[10px] font-bold uppercase">ยังไม่ได้ตรวจ (Pending)</span>
          </div>
          <p className="text-xl font-black text-amber-700 dark:text-amber-300 mt-1">
            {stats.pending} <span className="text-xs font-normal">รายการ</span>
          </p>
        </div>
      </div>

      {/* ── Search & Category Filter Pills (Hidden in Print) ── */}
      <div className="flex flex-col sm:flex-row gap-3 print:hidden">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาชื่อรายการตรวจรับ หรือคำอธิบาย..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-[#252548] bg-white dark:bg-[#13132a] text-xs font-medium focus:ring-2 focus:ring-primary-500/40 outline-none"
          />
        </div>

        {/* Category Selector */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-primary-600 text-white shadow-xs'
                : 'bg-white dark:bg-[#13132a] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-[#252548] hover:bg-slate-50'
            }`}
          >
            หมวดทั้งหมด ({masters.length})
          </button>
          {categories.map((cat, idx) => {
            const count = masters.filter((m) => m.category === cat).length
            const shortName = `หมวดที่ ${idx + 1}`
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                title={cat}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-primary-600 text-white shadow-xs'
                    : 'bg-white dark:bg-[#13132a] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-[#252548] hover:bg-slate-50'
                }`}
              >
                {shortName} ({count})
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Main Checklist Items Grouped by Category ── */}
      {Object.keys(groupedMasters).length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-[#13132a] rounded-2xl border border-slate-200 dark:border-[#252548]">
          <FileText size={40} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
          <p className="text-sm font-bold text-slate-600 dark:text-slate-400">ไม่พบรายการตรวจรับในหมวดนี้</p>
        </div>
      ) : (
        Object.entries(groupedMasters).map(([catTitle, items]) => {
          // Category level counts
          const catPassed = items.filter((m) => resultsMap[m.id]?.status === 'passed').length
          const catFailed = items.filter((m) => resultsMap[m.id]?.status === 'failed').length
          const catNa = items.filter((m) => resultsMap[m.id]?.status === 'na').length

          return (
            <div
              key={catTitle}
              className="bg-white dark:bg-[#13132a] border border-slate-200 dark:border-[#252548] rounded-2xl overflow-hidden shadow-xs print:border-none print:shadow-none print:bg-transparent"
            >
              {/* Category Section Header */}
              <div className="bg-slate-50/80 dark:bg-[#1e1e38] px-5 py-3.5 border-b border-slate-200 dark:border-[#252548] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>{catTitle}</span>
                  <span className="text-xs font-normal text-slate-400">({items.length} รายการ)</span>
                </h3>

                <div className="flex items-center gap-2 text-xs font-bold print:hidden">
                  <span className="bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-md">
                    ✓ ผ่าน {catPassed}
                  </span>
                  <span className="bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 px-2 py-0.5 rounded-md">
                    ✗ ไม่ผ่าน {catFailed}
                  </span>
                  <span className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md">
                    - N/A {catNa}
                  </span>
                </div>
              </div>

              {/* Items Cards / Rows */}
              <div className="divide-y divide-slate-100 dark:divide-[#1e1e38]">
                {items.map((item) => {
                  const currentStatus = resultsMap[item.id]?.status || 'pending'

                  // Dynamic Theme Color Mapping
                  // Passed = Green, Failed = Red, N/A = Gray, Pending = Neutral
                  let cardThemeCls =
                    'border-transparent bg-white dark:bg-[#13132a]'
                  if (currentStatus === 'passed') {
                    cardThemeCls =
                      'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/20 text-emerald-950 dark:text-emerald-100 ring-1 ring-emerald-500/30'
                  } else if (currentStatus === 'failed') {
                    cardThemeCls =
                      'border-red-500 bg-red-50/60 dark:bg-red-950/20 text-red-950 dark:text-red-100 ring-1 ring-red-500/30'
                  } else if (currentStatus === 'na') {
                    cardThemeCls =
                      'border-slate-400 bg-slate-100/70 dark:bg-slate-800/40 text-slate-800 dark:text-slate-200 ring-1 ring-slate-400/30'
                  }

                  return (
                    <div
                      key={item.id}
                      className={`p-4 transition-all border-l-4 ${cardThemeCls} flex flex-col md:flex-row md:items-center justify-between gap-4`}
                    >
                      {/* Left Item Info */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          {item.title}
                        </h4>

                        {item.description && (
                          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                            {item.description}
                          </p>
                        )}
                      </div>

                      {/* Right Action Buttons (Passed / Failed / N/A) */}
                      <div className="flex items-center gap-2 flex-wrap flex-shrink-0 print:hidden">
                        {/* 1. ผ่าน (Passed) - Green */}
                        <button
                          onClick={() => handleStatusChange(item.id, 'passed')}
                          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                            currentStatus === 'passed'
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20'
                              : 'bg-white dark:bg-[#1e1e38] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#252548] hover:border-emerald-500 hover:text-emerald-600'
                          }`}
                        >
                          <CheckCircle2 size={15} />
                          <span>ผ่าน</span>
                        </button>

                        {/* 2. ไม่ผ่าน (Failed) - Red */}
                        <button
                          onClick={() => handleStatusChange(item.id, 'failed')}
                          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                            currentStatus === 'failed'
                              ? 'bg-red-600 text-white border-red-600 shadow-md shadow-red-600/20'
                              : 'bg-white dark:bg-[#1e1e38] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#252548] hover:border-red-500 hover:text-red-600'
                          }`}
                        >
                          <XCircle size={15} />
                          <span>ไม่ผ่าน</span>
                        </button>

                        {/* 3. ไม่มีงานในส่วนนี้ (N/A) - Gray */}
                        <button
                          onClick={() => handleStatusChange(item.id, 'na')}
                          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                            currentStatus === 'na'
                              ? 'bg-slate-600 text-white border-slate-600 shadow-md shadow-slate-600/20'
                              : 'bg-white dark:bg-[#1e1e38] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#252548] hover:border-slate-500 hover:text-slate-700'
                          }`}
                        >
                          <MinusCircle size={15} />
                          <span>ไม่มีงานในส่วนนี้</span>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
