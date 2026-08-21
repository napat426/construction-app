'use client'

import { useState, useMemo } from 'react'
import { ChevronDown, ChevronUp, Download, CheckCircle } from 'lucide-react'
import type { Project, ProjectMilestone, WBSTask } from '@/lib/types'
import { PaymentForecastChart } from './portfolio/PaymentForecastChart'

interface DisbursementsViewProps {
  projects: Project[]
  milestones: ProjectMilestone[]
  tasks: WBSTask[]
  exVatEnabled: boolean
  setExVatEnabled: (val: boolean) => void
}

const MONTHS_TH = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
]

function formatThaiMonth(dateStr: string | null): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return '—'
    return `${MONTHS_TH[d.getMonth()]} ${d.getFullYear() + 543}`
  } catch {
    return '—'
  }
}

export function DisbursementsView({
  projects,
  milestones,
  tasks,
  exVatEnabled,
  setExVatEnabled,
}: DisbursementsViewProps) {
  const [expandedIds, setExpandedIds] = useState<string[]>([])

  const toggleExpand = (id: string) => {
    setExpandedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  // Helper to adjust VAT
  const val = (num: number | null | undefined): number => {
    if (num == null || isNaN(num)) return 0
    return exVatEnabled ? num / 1.07 : num
  }

  const formatMoney = (amount: number): string => {
    // Show in Millions of Baht (ล้านบาท) like the boss's template
    const valInMillions = amount / 1000000
    return valInMillions.toLocaleString('th-TH', {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    })
  }

  // Calculate table rows and aggregates
  const rows = useMemo(() => {
    return projects.map((p) => {
      const pMilestones = milestones.filter(m => m.project_id === p.id)
      
      const budget = val(p.budget)
      const openingPr = val(p.opening_pr)

      // Calculate pipeline totals (PR, PO, GR, IR, Paid)
      let prTotal = 0
      let poTotal = 0
      let grTotal = 0
      let irTotal = 0
      let paidTotal = 0

      // Calculate committed PO amount for PR balance deduction
      let totalPoCommitted = 0

      pMilestones.forEach(m => {
        const amt = val(m.amount)
        const status = m.status || (m.is_paid ? 'Paid' : 'Pending')

        if (status === 'PR') prTotal += amt
        else if (status === 'PO') poTotal += amt
        else if (status === 'GR') grTotal += amt
        else if (status === 'IR') irTotal += amt
        else if (status === 'Paid') paidTotal += amt

        // PO/GR/IR/Paid are committed contract values (PO stage or higher)
        if (['PO', 'GR', 'IR', 'Paid'].includes(status)) {
          totalPoCommitted += amt
        }
      })

      // Remaining PR = Opening PR - Committed PO
      const remainingPr = Math.max(0, openingPr - totalPoCommitted)

      // Cumulative planned payout up to the current month (August 2026 / today's month)
      const now = new Date()
      const currentYear = now.getFullYear()
      const currentMonth = now.getMonth()

      const plannedUpToNowMilestones = pMilestones.filter(m => {
        const dateStr = m.expected_payment_date || m.payment_date
        if (!dateStr) return false
        const d = new Date(dateStr)
        if (isNaN(d.getTime())) return false
        
        const dYear = d.getFullYear()
        const dMonth = d.getMonth()
        
        if (dYear < currentYear) return true
        if (dYear === currentYear && dMonth <= currentMonth) return true
        return false
      })

      const planAmount = plannedUpToNowMilestones.reduce((sum, m) => sum + val(m.amount), 0)
      const planPercent = budget > 0 ? (planAmount / budget) * 100 : 0

      // Paid percent of total budget
      const paidPercent = budget > 0 ? (paidTotal / budget) * 100 : 0
      const remainingBudget = Math.max(0, budget - paidTotal)

      return {
        project: p,
        budget,
        openingPr,
        remainingPr,
        planAmount,
        planPercent,
        paidTotal,
        paidPercent,
        prTotal,
        poTotal,
        grTotal,
        irTotal,
        remainingBudget,
        milestones: pMilestones,
      }
    })
  }, [projects, milestones, exVatEnabled])

  // Total summary row
  const totals = useMemo(() => {
    let budget = 0
    let openingPr = 0
    let remainingPr = 0
    let planAmount = 0
    let paidTotal = 0
    let prTotal = 0
    let poTotal = 0
    let grTotal = 0
    let irTotal = 0
    let remainingBudget = 0

    rows.forEach(r => {
      budget += r.budget
      openingPr += r.openingPr
      remainingPr += r.remainingPr
      planAmount += r.planAmount
      paidTotal += r.paidTotal
      prTotal += r.prTotal
      poTotal += r.poTotal
      grTotal += r.grTotal
      irTotal += r.irTotal
      remainingBudget += r.remainingBudget
    })

    return {
      budget,
      openingPr,
      remainingPr,
      planAmount,
      planPercent: budget > 0 ? (planAmount / budget) * 100 : 0,
      paidTotal,
      paidPercent: budget > 0 ? (paidTotal / budget) * 100 : 0,
      prTotal,
      poTotal,
      grTotal,
      irTotal,
      remainingBudget,
    }
  }, [rows])

  // Excel Export Handler (generates clean UTF-8 CSV with Thai BOM)
  const handleExport = () => {
    const headers = [
      'ชื่อโครงการ',
      'หมายเลขงาน (WBS)',
      'กลุ่มงาน',
      `งบประมาณ (${exVatEnabled ? 'ไม่รวม VAT 7%' : 'รวม VAT'})`,
      'ยอดเปิด PR',
      'PR คงเหลือ',
      'แผนเบิกจ่าย (วงเงิน)',
      'แผนเบิกจ่าย (%)',
      'เบิกจ่ายจริง (วงเงิน)',
      'เบิกจ่ายจริง (%)',
      'อยู่ระหว่างดำเนินการ (PR)',
      'อยู่ระหว่างดำเนินการ (PO)',
      'อยู่ระหว่างดำเนินการ (GR)',
      'อยู่ระหว่างดำเนินการ (IR)',
      'ยอดคงเหลือ',
      'สถานะโครงการ'
    ]

    const dataRows = rows.map(r => {
      const budgetMil = (r.budget / 1000000).toFixed(3)
      const opPrMil = (r.openingPr / 1000000).toFixed(3)
      const remPrMil = (r.remainingPr / 1000000).toFixed(3)
      const planMil = (r.planAmount / 1000000).toFixed(3)
      const paidMil = (r.paidTotal / 1000000).toFixed(3)
      const prMil = (r.prTotal / 1000000).toFixed(3)
      const poMil = (r.poTotal / 1000000).toFixed(3)
      const grMil = (r.grTotal / 1000000).toFixed(3)
      const irMil = (r.irTotal / 1000000).toFixed(3)
      const remBugMil = (r.remainingBudget / 1000000).toFixed(3)

      return [
        `"${r.project.name.replace(/"/g, '""')}"`,
        `"${(r.project.wbs_no || '').replace(/"/g, '""')}"`,
        `"${(r.project.work_group || '—').replace(/"/g, '""')}"`,
        budgetMil,
        opPrMil,
        remPrMil,
        planMil,
        r.planPercent.toFixed(2),
        paidMil,
        r.paidPercent.toFixed(2),
        prMil,
        poMil,
        grMil,
        irMil,
        remBugMil,
        `"${r.project.status}"`
      ]
    })

    // Totals row
    const totalsRow = [
      '"รวมทั้งสิ้น"',
      '""',
      '""',
      (totals.budget / 1000000).toFixed(3),
      (totals.openingPr / 1000000).toFixed(3),
      (totals.remainingPr / 1000000).toFixed(3),
      (totals.planAmount / 1000000).toFixed(3),
      totals.planPercent.toFixed(2),
      (totals.paidTotal / 1000000).toFixed(3),
      totals.paidPercent.toFixed(2),
      (totals.prTotal / 1000000).toFixed(3),
      (totals.poTotal / 1000000).toFixed(3),
      (totals.grTotal / 1000000).toFixed(3),
      (totals.irTotal / 1000000).toFixed(3),
      (totals.remainingBudget / 1000000).toFixed(3),
      '""'
    ]

    const csvContent = [
      headers.join(','),
      ...dataRows.map(r => r.join(',')),
      totalsRow.join(',')
    ].join('\r\n')

    // Add BOM for Microsoft Excel Thai language compatibility
    const blob = new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.setAttribute('download', `รายงานการเบิกจ่าย_งบประมาณ_${exVatEnabled ? 'ExVAT' : 'IncVAT'}_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Configuration Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-[#13132a] border border-slate-200 dark:border-[#1e1e38] rounded-2xl p-4 shadow-xs">
        <div>
          <h2 className="text-sm font-bold text-slate-800 dark:text-white">รายงานแสดงสถานะการเบิกจ่ายงบประมาณ WBS / PR / PO / GR / IR</h2>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">หน่วยแสดงผล: ล้านบาท (เช่น 12.050 = 12,050,000 บาท)</p>
        </div>

        <div className="flex items-center gap-4">
          {/* Ex-VAT SAP Toggle */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">หักภาษีมูลค่าเพิ่ม 7% (ระบบ SAP)</span>
            <button
              onClick={() => setExVatEnabled(!exVatEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                exVatEnabled ? 'bg-primary-600' : 'bg-slate-200 dark:bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  exVatEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Excel Export Button */}
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
          >
            <Download size={13} />
            ส่งออก Excel
          </button>
        </div>
      </div>

      {/* Spreadsheet grid */}
      <div className="overflow-x-auto border border-slate-200 dark:border-[#1e1e38] rounded-2xl bg-white dark:bg-[#13132a] shadow-sm">
        <table className="w-full border-collapse text-left text-xs min-w-[1200px]">
          <thead>
            <tr className="bg-slate-50 dark:bg-[#15152c] text-slate-400 dark:text-slate-500 font-bold border-b border-slate-200 dark:border-[#1e1e38]">
              <th className="p-3 w-10"></th>
              <th className="p-3 w-56">โครงการ / รายการ</th>
              <th className="p-3">หมายเลขงาน (WBS)</th>
              <th className="p-3">งบประมาณ</th>
              <th className="p-3">ยอดเปิด PR</th>
              <th className="p-3">PR คงเหลือ</th>
              <th className="p-3 text-center bg-blue-500/5" colSpan={2}>แผนเบิกจ่าย</th>
              <th className="p-3 text-center bg-emerald-500/5" colSpan={2}>เบิกจ่ายจริง</th>
              <th className="p-3 text-center bg-amber-500/5" colSpan={4}>อยู่ระหว่างดำเนินการ (Pipeline)</th>
              <th className="p-3">คงเหลือ</th>
              <th className="p-3">สถานะ</th>
            </tr>
            <tr className="bg-slate-50/50 dark:bg-[#15152c]/50 text-slate-400 dark:text-slate-500 font-bold border-b border-slate-200 dark:border-[#1e1e38] text-[10px] uppercase">
              <th colSpan={3}></th>
              <th></th>
              <th></th>
              <th></th>
              <th className="p-2 w-20 text-center bg-blue-500/5 border-l border-slate-200 dark:border-[#1e1e38]">วงเงิน</th>
              <th className="p-2 w-14 text-center bg-blue-500/5">%</th>
              <th className="p-2 w-20 text-center bg-emerald-500/5 border-l border-slate-200 dark:border-[#1e1e38]">วงเงิน</th>
              <th className="p-2 w-14 text-center bg-emerald-500/5">%</th>
              <th className="p-2 w-16 text-center bg-amber-500/5 border-l border-slate-200 dark:border-[#1e1e38]">PR</th>
              <th className="p-2 w-16 text-center bg-amber-500/5">PO</th>
              <th className="p-2 w-16 text-center bg-amber-500/5">GR</th>
              <th className="p-2 w-16 text-center bg-amber-500/5">IR</th>
              <th colSpan={2} className="border-l border-slate-200 dark:border-[#1e1e38]"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-[#1e1e38] font-medium text-slate-700 dark:text-slate-300">
            {rows.map((r) => {
              const isExpanded = expandedIds.includes(r.project.id)
              return (
                <tr key={r.project.id} className="contents">
                  <tr
                    onClick={() => toggleExpand(r.project.id)}
                    className="hover:bg-slate-50 dark:hover:bg-[#15152c]/40 cursor-pointer transition-colors w-full table-row"
                  >
                    <td className="p-3 text-center">
                      {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </td>
                    <td className="p-3 font-bold text-slate-900 dark:text-white truncate max-w-[220px]" title={r.project.name}>
                      {r.project.name}
                    </td>
                    <td className="p-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      {r.project.wbs_no || '—'}
                    </td>
                    <td className="p-3 font-mono">{formatMoney(r.budget)}</td>
                    <td className="p-3 font-mono">{formatMoney(r.openingPr)}</td>
                    <td className="p-3 font-mono text-indigo-600 dark:text-indigo-400 font-bold">{formatMoney(r.remainingPr)}</td>
                    
                    {/* Plan */}
                    <td className="p-3 font-mono bg-blue-500/5 border-l border-slate-100 dark:border-[#1e1e38]">{formatMoney(r.planAmount)}</td>
                    <td className="p-3 text-center bg-blue-500/5 font-mono font-bold text-blue-600 dark:text-blue-400">{r.planPercent.toFixed(1)}%</td>
                    
                    {/* Paid */}
                    <td className="p-3 font-mono bg-emerald-500/5 border-l border-slate-100 dark:border-[#1e1e38] text-emerald-600 dark:text-emerald-400">{formatMoney(r.paidTotal)}</td>
                    <td className="p-3 text-center bg-emerald-500/5 font-mono font-bold text-emerald-600 dark:text-emerald-400">{r.paidPercent.toFixed(1)}%</td>
                    
                    {/* Pipeline */}
                    <td className="p-3 font-mono bg-amber-500/5 border-l border-slate-100 dark:border-[#1e1e38]">{formatMoney(r.prTotal)}</td>
                    <td className="p-3 font-mono bg-amber-500/5">{formatMoney(r.poTotal)}</td>
                    <td className="p-3 font-mono bg-amber-500/5">{formatMoney(r.grTotal)}</td>
                    <td className="p-3 font-mono bg-amber-500/5">{formatMoney(r.irTotal)}</td>
                    
                    <td className="p-3 font-mono border-l border-slate-100 dark:border-[#1e1e38]">{formatMoney(r.remainingBudget)}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 dark:bg-[#1c1c38] text-slate-600 dark:text-slate-300">
                        {r.project.status.replace(/\d\.\s/, '')}
                      </span>
                    </td>
                  </tr>

                  {/* Collapsible Details Drawer (Option C) */}
                  {isExpanded && (
                    <tr className="bg-slate-50/40 dark:bg-[#0d0d1c]/40 w-full table-row">
                      <td colSpan={16} className="p-4 border-l-4 border-primary-500">
                        <div className="space-y-3">
                          <h4 className="text-xs font-bold text-primary-600 dark:text-primary-400 flex items-center gap-1.5">
                            📌 รายละเอียดงวดงานการเบิกจ่าย (Payment Milestones)
                          </h4>
                          {r.milestones.length === 0 ? (
                            <p className="text-[11px] text-slate-400 dark:text-slate-500">ยังไม่ได้จัดตั้งเป้าหมายงวดงานโครงการนี้ในระบบ</p>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                              {r.milestones
                                .sort((a, b) => a.milestone_no - b.milestone_no)
                                .map(m => {
                                  const status = m.status || (m.is_paid ? 'Paid' : 'Pending')
                                  const isPaid = status === 'Paid'
                                  return (
                                    <div
                                      key={m.id}
                                      className={`p-3 rounded-xl border flex flex-col justify-between gap-1 shadow-xs ${
                                        isPaid
                                          ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                                          : 'bg-white dark:bg-[#13132a] border-slate-200 dark:border-[#1e1e38]'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="font-bold text-xs">งวดที่ {m.milestone_no}</span>
                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                                          status === 'Paid' ? 'bg-emerald-500/10 text-emerald-600' :
                                          status === 'IR' ? 'bg-amber-500/10 text-amber-600' :
                                          status === 'GR' ? 'bg-blue-500/10 text-blue-600' :
                                          status === 'PO' ? 'bg-indigo-500/10 text-indigo-600' :
                                          status === 'PR' ? 'bg-pink-500/10 text-pink-600' :
                                          'bg-slate-100 text-slate-500'
                                        }`}>
                                          {status}
                                        </span>
                                      </div>
                                      
                                      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold line-clamp-1 mt-1 text-left">
                                        {m.work_scope || 'ไม่มีรายละเอียด'}
                                      </p>
                                      
                                      <p className="text-sm font-black font-mono mt-1 text-left">
                                        ฿{formatMoney(val(m.amount))}M
                                      </p>
                                      
                                      <div className="flex justify-between items-center text-[9px] text-slate-400 dark:text-slate-500 mt-1 pt-1 border-t border-slate-100 dark:border-[#1e1e38]">
                                        <span>แผน: {m.expected_payment_date ? formatThaiMonth(m.expected_payment_date) : '—'}</span>
                                        {isPaid && (
                                          <span className="flex items-center gap-0.5 text-emerald-600">
                                            <CheckCircle size={8} />
                                            {m.payment_date ? formatThaiMonth(m.payment_date) : 'จ่ายแล้ว'}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  )
                                })}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </tr >
              )
            })}

            {/* Total Aggregate Row */}
            <tr className="bg-slate-100/50 dark:bg-[#1a1a36]/50 font-black text-slate-900 dark:text-white border-t-2 border-slate-300 dark:border-[#252548]">
              <td></td>
              <td className="p-3 text-left">รวมทั้งสิ้น</td>
              <td></td>
              <td className="p-3 font-mono">{formatMoney(totals.budget)}</td>
              <td className="p-3 font-mono">{formatMoney(totals.openingPr)}</td>
              <td className="p-3 font-mono text-indigo-600 dark:text-indigo-400">{formatMoney(totals.remainingPr)}</td>
              <td className="p-3 font-mono bg-blue-500/5 border-l border-slate-200 dark:border-[#252548]">{formatMoney(totals.planAmount)}</td>
              <td className="p-3 text-center bg-blue-500/5 font-mono text-blue-600 dark:text-blue-400">{totals.planPercent.toFixed(1)}%</td>
              <td className="p-3 font-mono bg-emerald-500/5 border-l border-slate-200 dark:border-[#252548] text-emerald-600 dark:text-emerald-400">{formatMoney(totals.paidTotal)}</td>
              <td className="p-3 text-center bg-emerald-500/5 font-mono text-emerald-600 dark:text-emerald-400">{totals.paidPercent.toFixed(1)}%</td>
              <td className="p-3 font-mono bg-amber-500/5 border-l border-slate-200 dark:border-[#252548]">{formatMoney(totals.prTotal)}</td>
              <td className="p-3 font-mono bg-amber-500/5">{formatMoney(totals.poTotal)}</td>
              <td className="p-3 font-mono bg-amber-500/5">{formatMoney(totals.grTotal)}</td>
              <td className="p-3 font-mono bg-amber-500/5">{formatMoney(totals.irTotal)}</td>
              <td className="p-3 font-mono border-l border-slate-200 dark:border-[#252548]">{formatMoney(totals.remainingBudget)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Monthly Payout Forecast */}
      <div className="mt-6">
        <PaymentForecastChart
          milestones={milestones}
          projects={projects}
          exVatEnabled={exVatEnabled}
        />
      </div>
    </div>
  )
}
