'use client'

import { Fragment, useState, useMemo, useTransition, useRef } from 'react'
import {
  Plus,
  Edit2,
  Trash2,
  Calendar,
  Layers,
  Percent,
  CheckSquare,
  ChevronRight,
  ChevronDown,
  Info,
  TrendingUp,
  AlertTriangle,
  ArrowDownToLine,
  Printer,
} from 'lucide-react'
import { deleteTask } from '@/app/actions/tasks'
import type { Project, WBSTask, ProjectMilestone, ContractAmendment } from '@/lib/types'
import { computeTaskDates, computeProjectExtension, countWorkingDays, isDateSuspended, parsePredecessor } from '@/lib/scheduler'
import type { UserSession } from '@/lib/auth'

interface PlanningClientProps {
  project: Project
  tasks: WBSTask[]
  milestones: ProjectMilestone[]
  
  amendments?: ContractAmendment[]
  user?: UserSession | null
}

// Custom natural sort for WBS numbers (e.g., 1.2 comes before 1.10)
function sortWBS(a: string, b: string): number {
  const partsA = a.split('.').map(Number)
  const partsB = b.split('.').map(Number)
  const maxLen = Math.max(partsA.length, partsB.length)
  for (let i = 0; i < maxLen; i++) {
    const valA = partsA[i] || 0
    const valB = partsB[i] || 0
    if (valA !== valB) {
      return valA - valB
    }
  }
  return 0
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  })
}

export function PlanningClient({ project, tasks, milestones, amendments = [], user }: PlanningClientProps) {
  const [activeTab, setActiveTab] = useState<'wbs' | 'gantt' | 'scurve'>('wbs')
  const [isPending, startTransition] = useTransition()
  
  const todayForSuspensionCheck = new Date()
  const isCurrentlySuspended = useMemo(() => isDateSuspended(todayForSuspensionCheck, amendments), [amendments])
  
  // S-Curve tooltip state
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null)

  // Inline edit state
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)

  // Ref to preserve scroll position of the WBS table when entering edit mode
  const tableScrollRef = useRef<HTMLDivElement>(null)
  const savedScrollLeft = useRef(0)
  
  // Local states for inputs in editing mode
  const [inputWbsNo, setInputWbsNo] = useState('')
  const [inputName, setInputName] = useState('')
  const [inputDuration, setInputDuration] = useState<string | number>('')
  const [inputStartDate, setInputStartDate] = useState('')
  const [inputPredecessors, setInputPredecessors] = useState('')
  const [inputPredWbs, setInputPredWbs] = useState('')
  const [inputPredType, setInputPredType] = useState<'FS' | 'SS' | 'FF' | 'SF'>('FS')
  const [inputPredLag, setInputPredLag] = useState<number | ''>('')

  // Helper to re-calculate computed predecessor string
  const updatePredecessorString = (wbs: string, type: 'FS' | 'SS' | 'FF' | 'SF', lag: number | '') => {
    if (!wbs.trim()) {
      setInputPredecessors('')
      return
    }
    let val = wbs.trim()
    if (type !== 'FS') {
      val += type
    }
    const lagNum = Number(lag) || 0
    if (lagNum > 0) {
      val += `+${lagNum}`
    } else if (lagNum < 0) {
      val += `${lagNum}`
    }
    setInputPredecessors(val)
  }
  const [inputCost, setInputCost] = useState<string | number>('')
  const [inputProgress, setInputProgress] = useState<string | number>('')
  const [inputIsMilestone, setInputIsMilestone] = useState(false)

  // Sort tasks naturally by WBS No. and calculate dynamic schedule dates
  const scheduledTasks = useMemo(() => {
    const sorted = [...tasks].sort((a, b) => sortWBS(a.wbs_no, b.wbs_no))
    return computeTaskDates(sorted, project.start_date, amendments)
  }, [tasks, project.start_date, amendments])

  // Helper: compute task status badge
  const todayForStatus = new Date()
  todayForStatus.setHours(0, 0, 0, 0)

  function getTaskStatus(t: { actual_progress: number; computedStartDate: string; computedEndDate: string }) {
    const tStart = new Date(t.computedStartDate)
    const tEnd = new Date(t.computedEndDate)
    tStart.setHours(0, 0, 0, 0)
    tEnd.setHours(0, 0, 0, 0)

    if (t.actual_progress === 100) {
      return { label: 'เสร็จแล้ว', cls: 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/30' }
    }
    if (tStart > todayForStatus) {
      return { label: 'ในอนาคต', cls: 'bg-slate-100 dark:bg-[#1e1e38] text-slate-500 dark:text-slate-400 border-slate-300 dark:border-[#252548]' }
    }
    const totalDur = Math.max(1, countWorkingDays(tStart, tEnd, amendments))
    const elapsed = countWorkingDays(tStart, todayForStatus, amendments)
    const plannedPct = Math.min(100, (elapsed / totalDur) * 100)
    if (plannedPct - (t.actual_progress || 0) >= 5) {
      return { label: 'ล่าช้า', cls: 'bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-300 dark:border-red-500/30' }
    }
    return { label: 'กำลังดำเนินการ', cls: 'bg-sky-100 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-300 dark:border-sky-500/30' }
  }

  // 1. Calculations & Metrics
  const summary = useMemo(() => {
    const totalWBSCost = scheduledTasks.reduce((sum, t) => sum + (Number(t.cost) || 0), 0)
    
    // Calculate weighted actual progress
    let cumulativeActualProgress = 0
    
    if (totalWBSCost > 0) {
      const totalWeighted = scheduledTasks.reduce((sum, t) => {
        const cost = Number(t.cost) || 0
        const progress = Number(t.actual_progress) || 0
        return sum + (cost * progress)
      }, 0)
      cumulativeActualProgress = totalWeighted / totalWBSCost
    } else if (scheduledTasks.length > 0) {
      // Fallback: simple average if cost is 0 on all tasks
      const sumProgress = scheduledTasks.reduce((sum, t) => sum + (Number(t.actual_progress) || 0), 0)
      cumulativeActualProgress = sumProgress / scheduledTasks.length
    }

    return {
      totalCost: totalWBSCost,
      actualProgress: Math.round(cumulativeActualProgress),
      actualProgressRaw: cumulativeActualProgress,
    }
  }, [scheduledTasks])

  // 2. Timeline date range (for Gantt & S-Curve)
  const projectExt = useMemo(() => computeProjectExtension(project, amendments), [project, amendments])
  const dateRange = useMemo(() => {
    const ext = projectExt
    if (scheduledTasks.length === 0) {
      const pStart = project.start_date ? new Date(project.start_date) : new Date()
      const pEnd = ext.newEndDate ? new Date(ext.newEndDate) : new Date(pStart.getTime() + 30 * 24 * 60 * 60 * 1000)
      return { start: pStart, end: pEnd, actualEnd: pEnd, durationDays: Math.ceil((pEnd.getTime() - pStart.getTime()) / (24 * 60 * 60 * 1000)) }
    }

    let minDate = new Date(scheduledTasks[0].computedStartDate)
    let maxDate = new Date(scheduledTasks[0].computedEndDate)

    for (const t of scheduledTasks) {
      const tStart = new Date(t.computedStartDate)
      const tEnd = new Date(t.computedEndDate)
      if (tStart < minDate) minDate = tStart
      if (tEnd > maxDate) maxDate = tEnd
    }

    // Add extra padding days (e.g. 5 days) at the end for visual comfort
    const paddedMaxDate = new Date(maxDate.getTime() + 5 * 24 * 60 * 60 * 1000)

    const durationDays = Math.max(1, Math.ceil((paddedMaxDate.getTime() - minDate.getTime()) / (24 * 60 * 60 * 1000)))
    return { start: minDate, end: paddedMaxDate, actualEnd: maxDate, durationDays }
  }, [scheduledTasks, project, amendments])

  // Today marker left position for Gantt chart
  const todayLeft = useMemo(() => {
    const todayDate = new Date()
    todayDate.setHours(0, 0, 0, 0)
    const { start, end, durationDays } = dateRange
    if (durationDays === 0) return -1
    const totalTime = end.getTime() - start.getTime()
    const elapsed = todayDate.getTime() - start.getTime()
    return (elapsed / totalTime) * 100
  }, [dateRange])

  // 3. S-Curve Calculation Points (PV, EV, AC)
  const sCurveData = useMemo(() => {
    const { start, durationDays } = dateRange
    
    // Dynamic interval based on project length to keep point count balanced (between 10 and 25 points)
    let intervalDays = 7
    if (durationDays <= 30) {
      intervalDays = 3
    } else if (durationDays <= 90) {
      intervalDays = 7
    } else if (durationDays <= 180) {
      intervalDays = 10
    } else if (durationDays <= 365) {
      intervalDays = 15
    } else {
      intervalDays = 30
    }
    const pointsCount = Math.max(4, Math.ceil(durationDays / intervalDays))
    const list: { label: string; planned: number; actual: number | null; actualCost: number | null }[] = []

    if (scheduledTasks.length === 0 || durationDays === 0) return []

    const todayDateOnly = new Date()
    todayDateOnly.setHours(0, 0, 0, 0)

    const totalWeightDenominator = summary.totalCost > 0 ? summary.totalCost : (scheduledTasks.length || 1)

    // Prepare payments (AC calculation) from milestones
    const paymentPoints: { date: Date; amount: number }[] = []
    milestones.forEach(m => {
      if (m.is_paid && m.payment_date) {
        const pd = new Date(m.payment_date);
        pd.setHours(0, 0, 0, 0);
        paymentPoints.push({
          date: pd,
          amount: Number(m.amount) || 0
        })
      }
    })
    paymentPoints.sort((a, b) => a.date.getTime() - b.date.getTime())

    const dates: Date[] = []
    for (let i = 0; i <= pointsCount; i++) {
      const fraction = i / pointsCount
      const currTime = start.getTime() + fraction * durationDays * 24 * 60 * 60 * 1000
      const currDate = new Date(currTime)
      currDate.setHours(0, 0, 0, 0)
      dates.push(currDate)
    }

    // Insert today dynamically to always show latest progress/costs
    if (todayDateOnly > start && todayDateOnly < dateRange.end) {
      const exists = dates.some(d => d.getTime() === todayDateOnly.getTime())
      if (!exists) {
        dates.push(todayDateOnly)
        dates.sort((a, b) => a.getTime() - b.getTime())
      }
    }

    dates.forEach((currDate) => {
      const currTime = currDate.getTime()

      // Planned sum (PV)
      let plannedSum = 0
      for (const t of scheduledTasks) {
        const tStart = new Date(t.computedStartDate)
        const tEnd = new Date(t.computedEndDate)
        const taskWeightValue = summary.totalCost > 0 ? (Number(t.cost) || 0) : 1
        
        if (currDate >= tEnd) {
          plannedSum += taskWeightValue
        } else if (currDate >= tStart) {
          const totalDur = Math.max(1, countWorkingDays(tStart, tEnd, amendments))
          const elapsed = countWorkingDays(tStart, currDate, amendments)
          plannedSum += taskWeightValue * (elapsed / totalDur)
        }
      }

      // Actual sum (EV)
      let actualSum = 0
      const showActual = currDate <= todayDateOnly || currTime === start.getTime()

      if (showActual) {
        for (const t of scheduledTasks) {
          const tStart = new Date(t.computedStartDate)
          const tEnd = new Date(t.computedEndDate)
          const taskWeightValue = summary.totalCost > 0 ? (Number(t.cost) || 0) : 1

          // Boundaries for actual progress calculation
          let progressStart = tStart
          let progressEnd = tEnd < todayDateOnly ? tEnd : todayDateOnly

          // If a future task has progress, it started early!
          if (tStart >= todayDateOnly && (t.actual_progress || 0) > 0) {
            progressStart = start
            progressEnd = todayDateOnly
          }

          if (currDate >= progressEnd) {
            actualSum += taskWeightValue * ((t.actual_progress || 0) / 100)
          } else if (currDate <= progressStart) {
            // progress at this point is 0
          } else {
            const totalDuration = progressEnd.getTime() - progressStart.getTime()
            if (totalDuration > 0) {
              const elapsed = currDate.getTime() - progressStart.getTime()
              const progressAtPoint = (t.actual_progress || 0) * (elapsed / totalDuration)
              actualSum += taskWeightValue * (progressAtPoint / 100)
            } else {
              actualSum += taskWeightValue * ((t.actual_progress || 0) / 100)
            }
          }
        }
      }

      // AC cumulative spent
      let acVal: number | null = null
      if (showActual) {
        if (paymentPoints.length > 0) {
          const totalPaidUpToDate = paymentPoints
            .filter(p => p.date <= currDate)
            .reduce((sum, p) => sum + p.amount, 0)
          acVal = (totalPaidUpToDate / (project.budget || 1)) * 100
        } else {
          // Fallback: draw a linear slant from 0 at start date up to totalPaidPercent at today
          const totalPaidPercent = ((project.paid_amount || 0) / (project.budget || 1)) * 100
          if (totalPaidPercent > 0) {
            const projectStart = start.getTime()
            const projectToday = todayDateOnly.getTime()

            if (currTime <= projectStart) {
              acVal = 0
            } else if (projectToday > projectStart) {
              const ratio = Math.min(1, Math.max(0, (currTime - projectStart) / (projectToday - projectStart)))
              acVal = totalPaidPercent * ratio
            } else {
              acVal = totalPaidPercent
            }
          } else {
            acVal = 0
          }
        }
      }

      list.push({
        label: currDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }),
        planned: Math.min(100, Math.round((plannedSum / totalWeightDenominator) * 100)),
        actual: showActual ? Math.min(100, Math.round((actualSum / totalWeightDenominator) * 100)) : null,
        actualCost: acVal !== null ? Math.round(acVal) : null,
      })
    })
    return list
  }, [scheduledTasks, dateRange, summary, project, milestones])

  // Plan vs Actual deviation at TODAY
  const { plannedPercentAtToday, deviationAtToday } = useMemo(() => {
    const todayDateOnly = new Date()
    todayDateOnly.setHours(0, 0, 0, 0)
    
    if (scheduledTasks.length === 0) return { plannedPercentAtToday: 0, deviationAtToday: 0 }
    
    const totalWeightDenominator = summary.totalCost > 0 ? summary.totalCost : scheduledTasks.length

    // Find dynamic planned cumulative % at TODAY
    let plannedSum = 0
    for (const t of scheduledTasks) {
      const tStart = new Date(t.computedStartDate)
      const tEnd = new Date(t.computedEndDate)
      const taskWeightValue = Number(t.cost) > 0 ? Number(t.cost) : (summary.totalCost === 0 ? 1 : 0)
      
      if (todayDateOnly >= tEnd) {
        plannedSum += taskWeightValue
      } else if (todayDateOnly >= tStart) {
        const totalDur = Math.max(1, countWorkingDays(tStart, tEnd, amendments))
        const elapsed = countWorkingDays(tStart, todayDateOnly, amendments)
        plannedSum += taskWeightValue * (elapsed / totalDur)
      }
    }
    const plannedPercentAtToday = (plannedSum / totalWeightDenominator) * 100
    const deviationAtToday = summary.actualProgressRaw - plannedPercentAtToday
    return { plannedPercentAtToday, deviationAtToday }
  }, [scheduledTasks, summary, amendments])

  // 4. Gantt Timeline columns (10 divisions)
  const ganttHeaders = useMemo(() => {
    const list: string[] = []
    const { start, durationDays } = dateRange
    const cols = 6
    for (let i = 0; i < cols; i++) {
      const d = new Date(start.getTime() + (i / (cols - 1)) * durationDays * 24 * 60 * 60 * 1000)
      list.push(d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }))
    }
    return list
  }, [dateRange])

  // ── PRINT HELPERS ──
  // Number of date labels for print timeline (avoid text overlap)
  const printTimelineCols = dateRange.durationDays <= 180 ? 8 : dateRange.durationDays <= 365 ? 10 : 12

  // Print Gantt Chart
  const handlePrintGantt = () => {
    const { start, durationDays } = dateRange
    const ROWS_PER_PAGE = 22
    const totalPages = Math.ceil(scheduledTasks.length / ROWS_PER_PAGE) || 1
    const printDate = new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })

    // Build timeline header labels
    const tlLabels: { label: string; pct: number }[] = []
    for (let i = 0; i <= printTimelineCols; i++) {
      const d = new Date(start.getTime() + (i / printTimelineCols) * durationDays * 24 * 60 * 60 * 1000)
      tlLabels.push({ label: d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }), pct: (i / printTimelineCols) * 100 })
    }

    // Today marker
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayPct = durationDays > 0 ? ((today.getTime() - start.getTime()) / (durationDays * 24 * 60 * 60 * 1000)) * 100 : -1

    // Build suspension overlays
    const suspHtml = amendments
      .filter(a => (a.amendment_type === 'suspend_with_resume' || a.amendment_type === 'suspend_open') && !!a.suspend_date)
      .map(s => {
        const sStart = new Date(s.suspend_date!)
        sStart.setHours(0, 0, 0, 0)
        
        const isOngoing = !s.resume_date
        const todayMidnight = new Date()
        todayMidnight.setHours(0, 0, 0, 0)
        const sEnd = s.resume_date ? new Date(s.resume_date) : todayMidnight
        sEnd.setHours(0, 0, 0, 0)

        if (sEnd < start || sStart > new Date(start.getTime() + durationDays * 24 * 60 * 60 * 1000)) return ''

        const visibleStart = new Date(Math.max(sStart.getTime(), start.getTime()))
        const visibleEnd = new Date(Math.min(sEnd.getTime(), start.getTime() + durationDays * 24 * 60 * 60 * 1000))

        const leftOffset = durationDays > 0 ? ((visibleStart.getTime() - start.getTime()) / (durationDays * 24 * 60 * 60 * 1000)) * 100 : 0
        const widthPct = durationDays > 0 ? ((visibleEnd.getTime() - visibleStart.getTime()) / (durationDays * 24 * 60 * 60 * 1000)) * 100 : 0

        return `<div class="susp-band" style="left:${leftOffset}%;width:${widthPct}%"></div>`
      }).join('')

    // Build pages HTML
    let pagesHtml = ''
    for (let page = 0; page < totalPages; page++) {
      const pageTasks = scheduledTasks.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE)
      const rowsHtml = pageTasks.map(t => {
        const isMilestone = t.is_milestone
        const barColor = t.actual_progress === 100 ? '#10b981' : isMilestone ? '#a855f7' : '#6366f1'

        const workedDaysTotal = ((t.actual_progress || 0) / 100) * (t.duration || 1)
        let remainingWorkedDays = workedDaysTotal
        const segments = (t as any).segments || []

        const segmentsHtml = segments.map((seg: any, sIdx: number) => {
          const segStart = new Date(seg.start)
          const segEnd = new Date(seg.end)
          
          if (segEnd < start || segStart > new Date(start.getTime() + durationDays * 24 * 60 * 60 * 1000)) return ''
          
          const visibleStart = new Date(Math.max(segStart.getTime(), start.getTime()))
          const visibleEnd = new Date(Math.min(segEnd.getTime(), start.getTime() + durationDays * 24 * 60 * 60 * 1000))

          const segLeft = durationDays > 0 ? ((visibleStart.getTime() - start.getTime()) / (durationDays * 24 * 60 * 60 * 1000)) * 100 : 0
          const segWidth = durationDays > 0 ? ((visibleEnd.getTime() - visibleStart.getTime()) / (durationDays * 24 * 60 * 60 * 1000)) * 100 : 0
            
          const segCapDays = seg.durationDays
          const fillDays = Math.min(segCapDays, Math.max(0, remainingWorkedDays))
          const fillPct = segCapDays > 0 ? (fillDays / segCapDays) * 100 : (t.actual_progress === 100 ? 100 : 0)
          
          remainingWorkedDays -= fillDays

          return `
            <div class="bar-bg" style="left:${segLeft}%;width:${segWidth}%;background:${barColor}26">
              <div class="bar-fill" style="width:${fillPct}%;background:${barColor}"></div>
              ${sIdx === 0 ? `<span class="bar-label">${t.actual_progress || 0}%</span>` : ''}
            </div>`
        }).join('')

        return `
          <tr class="gantt-row">
            <td class="wbs-col">${t.wbs_no}</td>
            <td class="name-col">${t.name}${isMilestone ? ' <span class="ms-badge">MS</span>' : ''}</td>
            <td class="dur-col">${t.duration}วัน</td>
            <td class="bar-col">
              <div class="bar-track">
                ${suspHtml}
                ${tlLabels.map(l => `<div class="grid-line" style="left:${l.pct}%"></div>`).join('')}
                ${todayPct >= 0 && todayPct <= 100 ? `<div class="today-line" style="left:${todayPct}%"></div>` : ''}
                ${segmentsHtml}
              </div>
            </td>
          </tr>`
      }).join('')

      const isLastPage = page === totalPages - 1
      pagesHtml += `
        <div class="page${isLastPage ? '' : ' page-break'}">
          <div class="page-header">
            <div>
              <div class="proj-name">${project.name || 'โครงการ'}</div>
              <div class="proj-sub">Gantt Chart แผนงาน</div>
            </div>
            <div class="page-num">Gantt Chart</div>
          </div>
          <table class="gantt-table">
            <colgroup>
              <col style="width:42px"/>
              <col style="width:130px"/>
              <col style="width:38px"/>
              <col style="width:auto"/>
            </colgroup>
            <thead>
              <tr>
                <th class="th-wbs">WBS</th>
                <th class="th-name">กิจกรรม</th>
                <th class="th-dur">ระยะเวลา</th>
                <th class="th-bar">
                  <div class="tl-header">
                    ${tlLabels.map((l, i) => `<span class="tl-label" style="left:${l.pct}%;${i === 0 ? 'transform:translateX(0);' : i === tlLabels.length - 1 ? 'transform:translateX(-100%);' : ''}">${l.label}</span>`).join('')}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          <div class="legend">
            <span class="leg-item"><span class="leg-swatch" style="background:#6366f1"></span>แผน</span>
            <span class="leg-item"><span class="leg-swatch" style="background:#10b981"></span>เสร็จ 100%</span>
            <span class="leg-item"><span class="leg-swatch" style="background:#a855f7"></span>Milestone</span>
            ${suspHtml ? `<span class="leg-item"><span class="leg-susp"></span>หยุดงาน</span>` : ''}
            <span class="leg-item"><span class="leg-today"></span>วันนี้</span>
            <span class="leg-item">ช่วงเวลา: ${tlLabels[0]?.label} – ${tlLabels[tlLabels.length - 1]?.label}</span>
          </div>
        </div>`
    }

    const html = `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<title>Gantt Chart - ${project.name}</title>
<style>
  @page { size: A4 landscape; margin: 8mm 8mm 6mm; }
  @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Sarabun', sans-serif; font-size: 9px; color: #1e293b; background: white; min-width: 250mm; }
  .page { width: 265mm; padding: 0; min-height: 170mm; page-break-inside: avoid; }
  .page-break { page-break-after: always; }
  .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 2px solid #6366f1; }
  .proj-name { font-size: 13px; font-weight: 700; color: #1e293b; }
  .proj-sub { font-size: 9px; color: #64748b; margin-top: 2px; }
  .page-num { font-size: 10px; font-weight: 700; color: #6366f1; white-space: nowrap; }
  .gantt-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .gantt-table th { font-size: 8px; font-weight: 700; color: #64748b; background: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 3px 3px; }
  .th-wbs { text-align: center; }
  .th-name { text-align: left; }
  .th-dur { text-align: center; }
  .th-bar { position: relative; }
  .tl-header { position: relative; height: 14px; }
  .tl-label { position: absolute; font-size: 7px; font-weight: 700; color: #94a3b8; transform: translateX(-50%); white-space: nowrap; }
  .gantt-row td { border-bottom: 1px solid #f1f5f9; padding: 2px 3px; }
  .wbs-col { font-family: monospace; font-size: 8px; font-weight: 700; color: #475569; text-align: center; }
  .name-col { font-size: 8px; color: #1e293b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dur-col { font-size: 8px; color: #64748b; text-align: center; }
  .ms-badge { font-size: 7px; background: #f3e8ff; color: #9333ea; border-radius: 2px; padding: 0 2px; font-weight: 700; }
  .bar-col { padding: 2px 3px; }
  .bar-track { position: relative; height: 14px; background: #f8fafc; border-radius: 2px; overflow: visible; }
  .grid-line { position: absolute; top: 0; bottom: 0; width: 1px; background: #e2e8f0; pointer-events: none; }
  .today-line { position: absolute; top: -2px; bottom: -2px; width: 0; border-left: 2px dashed #ef4444; z-index: 10; pointer-events: none; }
  .bar-bg { position: absolute; top: 1px; height: 12px; border-radius: 2px; overflow: hidden; display: flex; align-items: center; min-width: 2px; }
  .bar-fill { height: 100%; border-radius: 2px 0 0 2px; transition: none; }
  .bar-label { position: absolute; left: 2px; font-size: 7px; font-weight: 700; color: white; white-space: nowrap; text-shadow: 0 0 3px rgba(0,0,0,0.5); z-index: 5; }
  .susp-band { position: absolute; top: 0; bottom: 0; background-image: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPjxyZWN0IHdpZHRoPSI4IiBoZWlnaHQ9IjgiIGZpbGw9InRyYW5zcGFyZW50Ij48L3JlY3Q+PHBhdGggZD0iTTAgOEw4IDBaTTggMTZMMTYgOFpNLTggMEwwIC04WiIgc3Ryb2tlPSJyZ2JhKDIzOSwgNjgsIDY4LCAwLjgpIiBzdHJva2Utd2lkdGg9IjIuNSI+PC9wYXRoPjwvc3ZnPg=='); background-color: rgba(239, 68, 68, 0.15); border-left: 2px solid rgba(239, 68, 68, 0.8); border-right: 2px solid rgba(239, 68, 68, 0.8); z-index: 1; pointer-events: none; }
  .legend { display: flex; gap: 12px; align-items: center; margin-top: 5px; padding-top: 4px; border-top: 1px solid #e2e8f0; font-size: 8px; color: #64748b; flex-wrap: wrap; }
  .leg-item { display: flex; align-items: center; gap: 3px; }
  .leg-swatch { display: inline-block; width: 10px; height: 8px; border-radius: 1px; }
  .leg-susp { display: inline-block; width: 10px; height: 8px; border-radius: 1px; background-image: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPjxyZWN0IHdpZHRoPSI4IiBoZWlnaHQ9IjgiIGZpbGw9InRyYW5zcGFyZW50Ij48L3JlY3Q+PHBhdGggZD0iTTAgOEw4IDBaTTggMTZMMTYgOFpNLTggMEwwIC04WiIgc3Ryb2tlPSJyZ2JhKDIzOSwgNjgsIDY4LCAwLjgpIiBzdHJva2Utd2lkdGg9IjIuNSI+PC9wYXRoPjwvc3ZnPg=='); background-color: rgba(239, 68, 68, 0.15); border-left: 1px solid rgba(239, 68, 68, 0.8); border-right: 1px solid rgba(239, 68, 68, 0.8); }
  .leg-today { display: inline-block; width: 0; height: 10px; border-left: 2px dashed #ef4444; }
  @media print {
    @page { size: A4 landscape; margin: 8mm 8mm 6mm; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page-break { page-break-after: always; }
  }
</style>
</head>
<body>${pagesHtml}</body>
</html>`

    const win = window.open('', '_blank', 'width=1200,height=800')
    if (!win) { alert('กรุณาอนุญาต Popup เพื่อใช้งานฟีเจอร์พิมพ์'); return }
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print() }, 600)
  }

  // Print S-Curve
  const handlePrintSCurve = () => {
    const printDate = new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })
    const W = 700, H = 280, padL = 45, padR = 15, padT = 15, padB = 35
    const gW = W - padL - padR
    const gH = H - padT - padB

    const toX = (i: number) => padL + (i / Math.max(1, sCurveData.length - 1)) * gW
    const toY = (v: number) => padT + (1 - v / 100) * gH

    // PV path
    const pvPath = sCurveData.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(d.planned).toFixed(1)}`).join(' ')
    // EV path
    const evPoints = sCurveData.map((d, i) => d.actual !== null ? { x: toX(i), y: toY(d.actual) } : null).filter((p): p is {x:number;y:number} => p !== null)
    const evPath = evPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
    // AC path
    const acPoints = sCurveData.map((d, i) => d.actualCost !== null ? { x: toX(i), y: toY(d.actualCost) } : null).filter((p): p is {x:number;y:number} => p !== null)
    const acPath = acPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

    // X-axis labels (show at most 12)
    const labelStep = Math.max(1, Math.ceil(sCurveData.length / 12))
    const xLabels = sCurveData.map((d, i) => {
      if (i % labelStep !== 0 && i !== sCurveData.length - 1) return ''
      const x = toX(i)
      return `<text x="${x.toFixed(1)}" y="${(padT + gH + 16).toFixed(1)}" text-anchor="middle" font-size="8" fill="#94a3b8" font-family="Sarabun,sans-serif">${d.label}</text>`
    }).join('')

    // Y-axis labels & grid
    const yGrids = [0, 25, 50, 75, 100].map(v => {
      const y = toY(v)
      return `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${(padL + gW).toFixed(1)}" y2="${y.toFixed(1)}" stroke="#e2e8f0" stroke-width="1"/>
<text x="${(padL - 5).toFixed(1)}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-size="8" fill="#94a3b8" font-family="Sarabun,sans-serif" font-weight="700">${v}%</text>`
    }).join('')

    const html = `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<title>S-Curve - ${project.name}</title>
<style>
  @page { size: A4 landscape; margin: 10mm; }
  @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Sarabun', sans-serif; background: white; min-width: 250mm; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 2px solid #6366f1; }
  .proj-name { font-size: 14px; font-weight: 700; color: #1e293b; }
  .proj-sub { font-size: 9px; color: #64748b; margin-top: 2px; }
  .chart-wrap { width: 100%; }
  svg { width: 100%; height: auto; overflow: visible; }
  .legend { display: flex; gap: 16px; margin-top: 8px; padding-top: 6px; border-top: 1px solid #e2e8f0; font-size: 9px; color: #64748b; flex-wrap: wrap; }
  .leg { display: flex; align-items: center; gap: 4px; }
  .note { margin-top: 8px; font-size: 8px; color: #94a3b8; line-height: 1.6; background: #f8fafc; padding: 6px 8px; border-radius: 4px; border: 1px solid #e2e8f0; }
  @media print {
    @page { size: A4 landscape; margin: 10mm; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="proj-name">${project.name || 'โครงการ'}</div>
      <div class="proj-sub">S-Curve แสดงมูลค่าความก้าวหน้าสะสม</div>
    </div>
    <div style="font-size:10px;font-weight:700;color:#6366f1">Earned Value Management</div>
  </div>
  <div class="chart-wrap">
    <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
      ${yGrids}
      ${pvPath ? `<path d="${pvPath}" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="5,3"/>` : ''}
      ${evPath ? `<path d="${evPath}" fill="none" stroke="#6366f1" stroke-width="2"/>` : ''}
      ${acPath ? `<path d="${acPath}" fill="none" stroke="#f59e0b" stroke-width="2"/>` : ''}
      ${xLabels}
      <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + gH}" stroke="#cbd5e1" stroke-width="1"/>
      <line x1="${padL}" y1="${padT + gH}" x2="${padL + gW}" y2="${padT + gH}" stroke="#cbd5e1" stroke-width="1"/>
    </svg>
  </div>
  <div class="legend">
    <span class="leg"><svg width="18" height="10"><line x1="0" y1="5" x2="18" y2="5" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="5,3"/></svg>PV แผนสะสม (Planned Value)</span>
    <span class="leg"><svg width="18" height="10"><line x1="0" y1="5" x2="18" y2="5" stroke="#6366f1" stroke-width="2"/></svg>EV ผลงานสะสม (Earned Value)</span>
    <span class="leg"><svg width="18" height="10"><line x1="0" y1="5" x2="18" y2="5" stroke="#f59e0b" stroke-width="2"/></svg>AC รายจ่ายจริงสะสม (Actual Cost)</span>
  </div>
  <div class="note">เส้น S-Curve ประกอบด้วย 3 ส่วนตามระบบ Earned Value Management: PV (แผนสะสม), EV (ผลงานที่ได้จริง), และ AC (รายจ่ายจริงสะสม) เพื่อประเมินความคุ้มค่าและความล่าช้าของโครงการ</div>
</body></html>`

    const win = window.open('', '_blank', 'width=1200,height=700')
    if (!win) { alert('กรุณาอนุญาต Popup เพื่อใช้งานฟีเจอร์พิมพ์'); return }
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print() }, 600)
  }

  // Inline CRUD handlers
  const handleEditInline = (task: WBSTask) => {
    const container = tableScrollRef.current
    const targetScrollLeft = container?.scrollLeft ?? 0
    savedScrollLeft.current = targetScrollLeft

    // Lock scroll: any browser-triggered scroll (e.g. scroll-to-focused-input)
    // that fires within the next 400ms will be immediately reversed.
    if (container) {
      const lockScroll = () => {
        container.scrollLeft = targetScrollLeft
      }
      container.addEventListener('scroll', lockScroll)
      setTimeout(() => container.removeEventListener('scroll', lockScroll), 400)
    }

    setEditingTaskId(task.id)
    setInputWbsNo(task.wbs_no)
    setInputName(task.name)
    setInputDuration(task.duration)
    setInputStartDate(task.start_date || '')
    setInputPredecessors(task.predecessors || '')
    const initialPred = task.predecessors ? parsePredecessor(task.predecessors) : null
    setInputPredWbs(initialPred?.wbsNo || '')
    setInputPredType(initialPred?.type || 'FS')
    setInputPredLag(initialPred !== null ? initialPred.lagDays : '')
    setInputCost(task.cost)
    setInputProgress(task.actual_progress)
    setInputIsMilestone(task.is_milestone)
  }

  const handleNewInline = () => {
    setEditingTaskId('new')
    setInputWbsNo('')
    setInputName('')
    setInputDuration('')
    setInputStartDate('')
    setInputPredecessors('')
    setInputPredWbs('')
    setInputPredType('FS')
    setInputPredLag('')
    setInputCost('')
    setInputProgress('')
    setInputIsMilestone(false)
  }

  const handleCancelInline = () => {
    setEditingTaskId(null)
  }

  const handleInsertInline = (task: WBSTask) => {
    const targetWbsParts = task.wbs_no.split('.')
    const prefix = targetWbsParts.slice(0, -1).join('.')
    const targetSuffix = Number(targetWbsParts[targetWbsParts.length - 1])
    const newWbsNo = (prefix ? prefix + '.' : '') + (targetSuffix + 1)
    
    const container = tableScrollRef.current
    const targetScrollLeft = container?.scrollLeft ?? 0
    savedScrollLeft.current = targetScrollLeft
    if (container) {
      const lockScroll = () => { container.scrollLeft = targetScrollLeft }
      container.addEventListener('scroll', lockScroll)
      setTimeout(() => container.removeEventListener('scroll', lockScroll), 400)
    }

    setEditingTaskId(`insert_after_${task.id}`)
    setInputWbsNo(newWbsNo)
    setInputName('')
    setInputDuration('')
    setInputStartDate('')
    setInputPredecessors(`${task.wbs_no}`)
    setInputPredWbs(task.wbs_no)
    setInputPredType('FS')
    setInputPredLag('')
    setInputCost('')
    setInputProgress('')
    setInputIsMilestone(false)
  }

  const handleSaveInline = async () => {
    if (!inputWbsNo.trim() || !inputName.trim()) {
      alert('กรุณากรอกรหัส WBS และชื่อกิจกรรม')
      return
    }

    const formData = new FormData()
    formData.append('wbs_no', inputWbsNo)
    formData.append('name', inputName)
    formData.append('cost', inputCost.toString())
    formData.append('start_date', inputStartDate)
    formData.append('duration', inputDuration.toString())
    formData.append('predecessors', inputPredecessors)
    formData.append('actual_progress', inputProgress.toString())
    formData.append('is_milestone', inputIsMilestone ? 'true' : 'false')

    startTransition(async () => {
      let result
      if (editingTaskId === 'new') {
        const { createTask } = await import('@/app/actions/tasks')
        result = await createTask(project.id, null, formData)
      } else if (editingTaskId?.startsWith('insert_after_')) {
        const { insertTaskAfter } = await import('@/app/actions/tasks')
        const targetId = editingTaskId.replace('insert_after_', '')
        result = await insertTaskAfter(project.id, targetId, null, formData)
      } else if (editingTaskId) {
        const { updateTask } = await import('@/app/actions/tasks')
        result = await updateTask(project.id, editingTaskId, null, formData)
      }

      if (result?.error) {
        alert(result.error)
      } else {
        setEditingTaskId(null)
      }
    })
  }

  const handleDelete = (taskId: string) => {
    if (confirm('คุณต้องการลบกิจกรรมย่อยนี้ใช่หรือไม่? (การคำนวณความคืบหน้าจะปรับตัวใหม่อัตโนมัติ)')) {
      startTransition(async () => {
        await deleteTask(project.id, taskId)
      })
    }
  }

  const labelCls = 'text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest'

  return (
    <div className="space-y-6">
      {/* ── Summary statistics row ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* WBS cost */}
        <div className="stat-card rounded-2xl p-5 flex items-center justify-between">
          <div>
            <span className={labelCls}>มูลค่าแผนงานสะสม WBS</span>
            <p className="text-xl font-black text-slate-900 dark:text-white mt-1">
              {formatCurrency(summary.totalCost)}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-primary-600/10 dark:bg-primary-600/20 flex items-center justify-center text-primary-600 dark:text-primary-400">
            <Layers size={18} />
          </div>
        </div>

        {/* Planned Percent At Today */}
        <div className="stat-card rounded-2xl p-5 flex items-center justify-between">
          <div>
            <span className={labelCls}>ความก้าวหน้าตามแผนงาน</span>
            <p className="text-xl font-black text-slate-900 dark:text-white mt-1">
              {plannedPercentAtToday.toFixed(1)}%
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-primary-600/10 dark:bg-primary-600/20 flex items-center justify-center text-primary-600 dark:text-primary-400">
            <Calendar size={18} />
          </div>
        </div>

        {/* Weighted Cumulative Actual Progress */}
        <div className="stat-card rounded-2xl p-5 flex items-center justify-between">
          <div>
            <span className={labelCls}>ความก้าวหน้าถ่วงน้ำหนักรวม</span>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xl font-black text-primary-600 dark:text-primary-400">
                {summary.actualProgressRaw.toFixed(1)}%
              </p>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded">
                Auto Update to Project
              </span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-primary-600/10 dark:bg-primary-600/20 flex items-center justify-center text-primary-600 dark:text-primary-400">
            <Percent size={18} />
          </div>
        </div>

        {/* Schedule sync state */}
        <div className="stat-card rounded-2xl p-5 flex items-center justify-between">
          <div>
            <span className={labelCls}>ความเบี่ยงเบนแผน (Plan vs Actual) ณ ปัจจุบัน</span>
            <p className={`text-xl font-black mt-1 ${deviationAtToday >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
              {deviationAtToday >= 0 ? `+${deviationAtToday.toFixed(1)}%` : `${deviationAtToday.toFixed(1)}%`}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-primary-600/10 dark:bg-primary-600/20 flex items-center justify-center text-primary-600 dark:text-primary-400">
            <TrendingUp size={18} />
          </div>
        </div>
      </div>

      {/* ── Sub Navigation Tabs ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-[#1c1c34] pb-px">
        <div className="flex gap-2">
          {(
            [
              { id: 'wbs', label: 'ตารางแผนงาน WBS', icon: Layers },
              { id: 'gantt', label: 'Gantt Chart แผนงาน', icon: Calendar },
              { id: 'scurve', label: 'S-Curve ผลความคืบหน้า', icon: TrendingUp },
            ] as const
          ).map((t) => {
            const Icon = t.icon
            const active = activeTab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={[
                  'flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold transition-all border-b-2 -mb-0.5',
                  active
                    ? 'border-primary-600 text-primary-700 dark:text-primary-400 font-extrabold'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300',
                ].join(' ')}
              >
                <Icon size={14} />
                {t.label}
              </button>
            )
          })}
        </div>

        {user && (user.role === 'admin' || user.role === 'editor') && (
          <button
            id="add-task-wbs-btn"
            onClick={handleNewInline}
            disabled={editingTaskId === 'new'}
            className="flex items-center gap-2 px-3.5 py-2 mb-2 rounded-lg text-xs font-bold text-white btn-primary flex-shrink-0 disabled:opacity-50 cursor-pointer"
          >
            <Plus size={14} />
            เพิ่มงานย่อย WBS
          </button>
        )}
      </div>

      {/* ── Tab Content Areas ── */}
      
      {/* ── 1. WBS TABLE TAB ── */}
      {activeTab === 'wbs' && (
        <div className="card rounded-2xl overflow-hidden animate-fade-in border border-slate-200 dark:border-[#1c1c34]">
          <div className="overflow-x-auto" ref={tableScrollRef}>
            <table className="w-full text-left text-xs border-collapse" style={{ tableLayout: 'fixed', width: '100%', minWidth: '1354px' }}>
              <colgroup>
                <col style={{ width: '72px' }} />{/* WBS No */}
                <col style={{ width: '280px' }} />{/* Task Name — widened */}
                <col style={{ width: '88px' }} />{/* Status */}
                <col style={{ width: '80px' }} />{/* Duration */}
                <col style={{ width: '108px' }} />{/* Start Date */}
                <col style={{ width: '100px' }} />{/* End Date */}
                <col style={{ width: '175px' }} />{/* Predecessors */}
                <col style={{ width: '108px' }} />{/* Cost */}
                <col style={{ width: '68px' }} />{/* Weight */}
                <col style={{ width: '105px' }} />{/* Progress */}
                <col style={{ width: '75px' }} />{/* Weighted */}
                <col style={{ width: '95px' }} />{/* Actions */}
              </colgroup>
              <thead>
                <tr className="bg-slate-50 dark:bg-[#14142a] text-slate-400 dark:text-slate-500 font-bold border-b border-slate-200 dark:border-[#1c1c34]">
                  <th className="py-3 px-2">WBS No.</th>
                  <th className="py-3 px-2">รายการกิจกรรม</th>
                  <th className="py-3 px-2">สถานะ</th>
                  <th className="py-3 px-2">ระยะเวลา (วัน)</th>
                  <th className="py-3 px-2">วันเริ่มงาน</th>
                  <th className="py-3 px-2">วันสิ้นสุด</th>
                  <th className="py-3 px-2">งานก่อนหน้า</th>
                  <th className="py-3 px-2 text-right">มูลค่างาน</th>
                  <th className="py-3 px-2 text-right">สัดส่วน</th>
                  <th className="py-3 px-2">ความคืบหน้า</th>
                  <th className="py-3 px-2 text-right">ถ่วงน้ำหนัก</th>
                  <th className="py-3 px-2 text-center">จัดการ</th>
                </tr>
                {/* Summary Row */}
                {scheduledTasks.length > 0 && (
                  <tr className="bg-primary-50/50 dark:bg-primary-900/10 text-primary-700 dark:text-primary-300 font-bold border-b border-primary-100 dark:border-primary-900/20 text-xs">
                    <th className="py-2 px-4 text-right" colSpan={3}>รวมทั้งหมด :</th>
                    <th className="py-2 px-4">{scheduledTasks.reduce((sum, t) => sum + (Number(t.duration) || 0), 0)} วัน</th>
                    <th className="py-2 px-4 font-mono">{formatDate(dateRange.start.toISOString())}</th>
                    <th className="py-2 px-4 font-mono">{formatDate(dateRange.actualEnd.toISOString())}</th>
                    <th className="py-2 px-4"></th>
                    <th className="py-2 px-4 text-right font-mono">{formatCurrency(summary.totalCost)}</th>
                    <th className="py-2 px-4 text-right font-mono">100.0%</th>
                    <th className="py-2 px-4"></th>
                    <th className="py-2 px-4 text-right font-mono">{summary.actualProgressRaw.toFixed(1)}%</th>
                    <th className="py-2 px-4"></th>
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#1e1e38] font-medium text-slate-600 dark:text-slate-300">
                {scheduledTasks.length > 0 ? (
                  scheduledTasks.map((t) => {
                    const taskCost = Number(t.cost) || 0
                    const weight = summary.totalCost > 0 ? (taskCost / summary.totalCost) * 100 : 0
                    const weightedProgress = weight * (t.actual_progress || 0) / 100

                    const isAutoScheduled = !!t.predecessors && t.computedStartDate !== t.start_date

                    if (editingTaskId === t.id) {
                      // Inline edit row
                      return (
                        <tr key={t.id} className="bg-primary-50/10 dark:bg-[#1e1e38]/30">
                          <td className="py-2 px-2">
                            <input
                              type="text"
                              className="input-base input-xs font-mono w-full"
                              style={{ padding: '4px 6px' }}
                              value={inputWbsNo}
                              onChange={(e) => setInputWbsNo(e.target.value)}
                            />
                          </td>
                          <td className="py-2 px-2">
                            <div className="flex items-center gap-1 w-full">
                              <input
                                type="checkbox"
                                checked={inputIsMilestone}
                                onChange={(e) => setInputIsMilestone(e.target.checked)}
                                title="Milestone"
                                className="w-3.5 h-3.5 flex-shrink-0"
                              />
                              <input
                                type="text"
                                className="input-base input-xs w-full"
                                style={{ padding: '4px 6px' }}
                                value={inputName}
                                onChange={(e) => setInputName(e.target.value)}
                              />
                            </div>
                          </td>
                          <td className="py-2 px-2" />{/* status placeholder */}
                          <td className="py-2 px-2">
                            <input
                              type="number"
                              className="input-base input-xs w-full text-center"
                              style={{ padding: '4px 6px' }}
                              value={inputDuration || ''}
                              onChange={(e) => setInputDuration(e.target.value.replace(/^0+(?=\d)/, ''))}
                              placeholder="0"
                            />
                          </td>
                          <td className="py-2 px-2">
                            {inputPredecessors ? (
                              <div className="px-1.5 py-1 text-xs font-mono text-slate-400 bg-slate-100 dark:bg-[#14142a] rounded border border-slate-200 dark:border-[#252548]">
                                {formatDate(t.computedStartDate)}
                                <span className="block text-[9px] text-primary-500 font-bold mt-0.5">(คำนวณจากงานก่อนหน้า)</span>
                              </div>
                            ) : (
                              <input
                                type="date"
                                className="input-base input-xs w-full"
                                style={{ padding: '4px 4px' }}
                                value={inputStartDate}
                                onChange={(e) => setInputStartDate(e.target.value)}
                              />
                            )}
                          </td>
                          <td className="py-2 px-2 font-mono text-slate-400 text-xs">
                            {formatDate(t.computedEndDate)}
                          </td>
                          <td className="py-2 px-2">
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                className="input-base input-xs flex-1 min-w-0 text-center font-mono"
                                style={{ padding: '4px 4px', minWidth: '36px', maxWidth: '48px' }}
                                value={inputPredWbs}
                                onChange={(e) => {
                                  const val = e.target.value
                                  setInputPredWbs(val)
                                  updatePredecessorString(val, inputPredType, inputPredLag)
                                }}
                                placeholder="#"
                              />
                              <select
                                className="input-base input-xs flex-shrink-0"
                                style={{ padding: '4px 2px', width: '48px' }}
                                value={inputPredType}
                                onChange={(e) => {
                                  const val = e.target.value as any
                                  setInputPredType(val)
                                  updatePredecessorString(inputPredWbs, val, inputPredLag)
                                }}
                              >
                                <option value="FS">FS</option>
                                <option value="SS">SS</option>
                                <option value="FF">FF</option>
                                <option value="SF">SF</option>
                              </select>
                              <input
                                type="number"
                                className="input-base input-xs flex-1 min-w-0 text-center"
                                style={{ padding: '4px 4px', minWidth: '30px', maxWidth: '40px' }}
                                value={inputPredLag}
                                onChange={(e) => {
                                  const val = e.target.value
                                  const num = val === '' ? '' : Number(val)
                                  setInputPredLag(num)
                                  updatePredecessorString(inputPredWbs, inputPredType, num)
                                }}
                                placeholder="0"
                              />
                            </div>
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="number"
                              className="input-base input-xs w-full text-right"
                              style={{ padding: '4px 6px' }}
                              value={inputCost || ''}
                              onChange={(e) => setInputCost(e.target.value.replace(/^0+(?=\d)/, ''))}
                              placeholder="0"
                            />
                          </td>
                          <td className="py-2 px-2 text-right font-mono text-slate-400">
                            {weight.toFixed(1)}%
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              className="input-base input-xs w-full text-center"
                              style={{ padding: '4px 6px' }}
                              value={inputProgress || ''}
                              onChange={(e) => setInputProgress(e.target.value.replace(/^0+(?=\d)/, ''))}
                              placeholder="0"
                            />
                          </td>
                          <td className="py-2 px-2 text-right font-mono text-slate-400">
                            {(weight * (Number(inputProgress) || 0) / 100).toFixed(1)}%
                          </td>
                          <td className="py-2 px-2">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={handleSaveInline}
                                disabled={isPending}
                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold"
                              >
                                บันทึก
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelInline}
                                className="px-2 py-1 bg-slate-500 hover:bg-slate-600 text-white rounded text-[10px] font-bold"
                              >
                                ยกเลิก
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    }

                    const status = getTaskStatus(t)
                    
                    const isInsertRow = editingTaskId === `insert_after_${t.id}`
                    const inlineEditForm = isInsertRow ? (
                        <tr className="bg-primary-50/15 dark:bg-[#1e1e38]/40 border-b border-primary-100">
                          <td className="py-2 px-2">
                            <input
                              type="text"
                              className="input-base input-xs font-mono w-full text-primary-600 dark:text-primary-400 font-bold"
                              style={{ padding: '4px 6px' }}
                              value={inputWbsNo}
                              onChange={(e) => setInputWbsNo(e.target.value)}
                            />
                          </td>
                          <td className="py-2 px-2">
                            <div className="flex items-center gap-1 w-full">
                              <input
                                type="checkbox"
                                checked={inputIsMilestone}
                                onChange={(e) => setInputIsMilestone(e.target.checked)}
                                title="Milestone"
                                className="w-3.5 h-3.5 flex-shrink-0"
                              />
                              <input
                                type="text"
                                className="input-base input-xs w-full"
                                style={{ padding: '4px 6px' }}
                                value={inputName}
                                placeholder="แทรกกิจกรรมใหม่..."
                                onChange={(e) => setInputName(e.target.value)}
                              />
                            </div>
                          </td>
                          <td className="py-2 px-2" />{/* status placeholder */}
                          <td className="py-2 px-2">
                            <input
                              type="number"
                              className="input-base input-xs w-full text-center"
                              style={{ padding: '4px 6px' }}
                              value={inputDuration || ''}
                              onChange={(e) => setInputDuration(e.target.value.replace(/^0+(?=\d)/, ''))}
                              placeholder="0"
                            />
                          </td>
                          <td className="py-2 px-2">
                            {inputPredecessors ? (
                              <div className="px-1.5 py-1 text-xs font-mono text-slate-400 bg-slate-100 dark:bg-[#14142a] rounded border border-slate-200 dark:border-[#252548]">
                                <span className="block text-[9px] text-primary-500 font-bold mt-0.5">(คำนวณจากงานก่อนหน้า)</span>
                              </div>
                            ) : (
                              <input
                                type="date"
                                className="input-base input-xs w-full"
                                style={{ padding: '4px 4px' }}
                                value={inputStartDate}
                                onChange={(e) => setInputStartDate(e.target.value)}
                              />
                            )}
                          </td>
                          <td className="py-2 px-2" />
                          <td className="py-2 px-2">
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                className="input-base input-xs flex-1 min-w-0 text-center font-mono"
                                style={{ padding: '4px 4px', minWidth: '36px', maxWidth: '48px' }}
                                value={inputPredWbs}
                                onChange={(e) => {
                                  const val = e.target.value
                                  setInputPredWbs(val)
                                  updatePredecessorString(val, inputPredType, inputPredLag)
                                }}
                                placeholder="#"
                              />
                              <select
                                className="input-base input-xs flex-shrink-0"
                                style={{ padding: '4px 2px', width: '48px' }}
                                value={inputPredType}
                                onChange={(e) => {
                                  const val = e.target.value as any
                                  setInputPredType(val)
                                  updatePredecessorString(inputPredWbs, val, inputPredLag)
                                }}
                              >
                                <option value="FS">FS</option>
                                <option value="SS">SS</option>
                                <option value="FF">FF</option>
                                <option value="SF">SF</option>
                              </select>
                              <input
                                type="number"
                                className="input-base input-xs flex-1 min-w-0 text-center"
                                style={{ padding: '4px 4px', minWidth: '30px', maxWidth: '40px' }}
                                value={inputPredLag}
                                onChange={(e) => {
                                  const val = e.target.value
                                  const num = val === '' ? '' : Number(val)
                                  setInputPredLag(num)
                                  updatePredecessorString(inputPredWbs, inputPredType, num)
                                }}
                                placeholder="0"
                              />
                            </div>
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="number"
                              className="input-base input-xs w-full text-right"
                              style={{ padding: '4px 6px' }}
                              value={inputCost || ''}
                              onChange={(e) => setInputCost(e.target.value.replace(/^0+(?=\d)/, ''))}
                              placeholder="0"
                            />
                          </td>
                          <td className="py-2 px-2 text-right font-mono text-slate-400"></td>
                          <td className="py-2 px-2">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              className="input-base input-xs w-full text-center"
                              style={{ padding: '4px 6px' }}
                              value={inputProgress || ''}
                              onChange={(e) => setInputProgress(e.target.value.replace(/^0+(?=\d)/, ''))}
                              placeholder="0"
                            />
                          </td>
                          <td className="py-2 px-2"></td>
                          <td className="py-2 px-2">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={handleSaveInline}
                                disabled={isPending}
                                className="px-2 py-1 bg-primary-600 hover:bg-primary-700 text-white rounded text-[10px] font-bold shadow"
                              >
                                เพิ่มงาน
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelInline}
                                className="px-2 py-1 bg-slate-500 hover:bg-slate-600 text-white rounded text-[10px] font-bold shadow"
                              >
                                ยกเลิก
                              </button>
                            </div>
                          </td>
                        </tr>
                    ) : null

                    return (
                      <Fragment key={t.id}>
                        <tr className="hover:bg-slate-50/50 dark:hover:bg-[#14142a]/30 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-slate-800 dark:text-slate-400">
                            {t.wbs_no}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            {t.is_milestone && (
                              <span className="text-[9px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-600 dark:text-purple-400 px-1 rounded border border-purple-500/10 flex-shrink-0">
                                MS
                              </span>
                            )}
                            <span className="truncate max-w-sm">{t.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${status.cls} whitespace-nowrap`}>
                            {status.label}
                          </span>
                        </td>
                        <td className="py-3 px-4">{t.duration} วัน</td>
                        <td className="py-3 px-4 font-mono">
                          <div className="flex flex-col">
                            <span>{formatDate(t.computedStartDate)}</span>
                            {isAutoScheduled && (
                              <span className="text-[9px] text-primary-600 dark:text-primary-400 font-bold">
                                (คำนวณอัตโนมัติ)
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono">
                          {formatDate(t.computedEndDate)}
                        </td>
                        <td className="py-3 px-4 font-mono">{t.predecessors || '—'}</td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-slate-700 dark:text-slate-200">
                          {formatCurrency(taskCost)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-500 dark:text-slate-500">
                          {weight.toFixed(1)}%
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 bg-slate-100 dark:bg-[#1e1e38] rounded-full overflow-hidden flex-shrink-0">
                              <div
                                className="h-full rounded-full progress-fill"
                                style={{ width: `${t.actual_progress}%` }}
                              />
                            </div>
                            <span className="font-mono text-[10px] font-bold text-primary-600 dark:text-primary-400">
                              {t.actual_progress}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {weightedProgress.toFixed(1)}%
                        </td>
                        <td className="py-3 px-4">
                          {user && (user.role === 'admin' || user.role === 'editor') ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                id={`insert-after-${t.id}`}
                                onClick={() => handleInsertInline(t)}
                                title="แทรกกิจกรรมด้านล่าง"
                                className="w-7 h-7 rounded border border-slate-200 dark:border-[#252548] bg-slate-50 dark:bg-[#14142a] flex items-center justify-center text-slate-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors cursor-pointer"
                              >
                                <ArrowDownToLine size={11} />
                              </button>
                              <button
                                id={`edit-task-${t.id}`}
                                onClick={() => handleEditInline(t)}
                                title="แก้ไขงานย่อย"
                                className="w-7 h-7 rounded border border-slate-200 dark:border-[#252548] bg-slate-50 dark:bg-[#14142a] flex items-center justify-center text-slate-500 hover:text-amber-600 dark:hover:text-amber-500 transition-colors cursor-pointer"
                              >
                                <Edit2 size={11} />
                              </button>
                              <button
                                id={`delete-task-${t.id}`}
                                onClick={() => handleDelete(t.id)}
                                disabled={isPending}
                                title="ลบงานย่อย"
                                className="w-7 h-7 rounded border border-slate-200 dark:border-[#252548] bg-slate-50 dark:bg-[#14142a] flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          ) : (
                            <div className="text-center text-slate-400 font-bold">—</div>
                          )}
                        </td>
                      </tr>
                      {inlineEditForm}
                    </Fragment>
                  )
                  })
                ) : (
                  <tr>
                    <td colSpan={12} className="py-20 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <Layers size={32} className="text-slate-300 dark:text-slate-600 mb-3" />
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300">ยังไม่มีงานย่อยในระบบ WBS</p>
                        <p className="text-xs text-slate-400 mt-1">เริ่มต้นวางแผนโดยการเพิ่มกิจกรรมย่อยชิ้นแรกของคุณ</p>
                      </div>
                    </td>
                  </tr>
                )}

                {/* Inline Insert Row */}
                {editingTaskId === 'new' && (
                  <tr className="bg-primary-50/15 dark:bg-[#1e1e38]/40 border-b border-primary-100">
                    <td className="py-2 px-2">
                      <input
                        type="text"
                        placeholder="เช่น 1.1"
                        className="input-base input-xs font-mono w-full"
                        style={{ padding: '4px 6px' }}
                        value={inputWbsNo}
                        onChange={(e) => setInputWbsNo(e.target.value)}
                      />
                    </td>
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-1 w-full">
                        <input
                          type="checkbox"
                          checked={inputIsMilestone}
                          onChange={(e) => setInputIsMilestone(e.target.checked)}
                          title="Milestone"
                          className="w-3.5 h-3.5 flex-shrink-0"
                        />
                        <input
                          type="text"
                          placeholder="ชื่อกิจกรรม"
                          className="input-base input-xs w-full"
                          style={{ padding: '4px 6px' }}
                          value={inputName}
                          onChange={(e) => setInputName(e.target.value)}
                        />
                      </div>
                    </td>
                    <td className="py-2 px-2" />{/* status placeholder */}
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        placeholder="0"
                        className="input-base input-xs w-full text-center"
                        style={{ padding: '4px 6px' }}
                        value={inputDuration || ''}
                        onChange={(e) => setInputDuration(e.target.value.replace(/^0+(?=\d)/, ''))}
                      />
                    </td>
                    <td className="py-2 px-2">
                      {inputPredecessors ? (
                        <div className="px-1.5 py-1 text-xs font-mono text-slate-400 bg-slate-100 dark:bg-[#14142a] rounded border border-slate-200 dark:border-[#252548]">
                          <span className="block text-[9px] text-primary-500 font-bold">คำนวณจากงานก่อนหน้า</span>
                        </div>
                      ) : (
                        <input
                          type="date"
                          className="input-base input-xs w-full"
                          style={{ padding: '4px 4px' }}
                          value={inputStartDate}
                          onChange={(e) => setInputStartDate(e.target.value)}
                        />
                      )}
                    </td>
                    <td className="py-2 px-2 font-mono text-slate-400 text-xs">—</td>{/* end date placeholder */}
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          className="input-base input-xs flex-1 min-w-0 text-center font-mono"
                          style={{ padding: '4px 4px', minWidth: '36px', maxWidth: '48px' }}
                          value={inputPredWbs}
                          onChange={(e) => {
                            const val = e.target.value
                            setInputPredWbs(val)
                            updatePredecessorString(val, inputPredType, inputPredLag)
                          }}
                          placeholder="#"
                        />
                        <select
                          className="input-base input-xs flex-shrink-0"
                          style={{ padding: '4px 2px', width: '48px' }}
                          value={inputPredType}
                          onChange={(e) => {
                            const val = e.target.value as any
                            setInputPredType(val)
                            updatePredecessorString(inputPredWbs, val, inputPredLag)
                          }}
                        >
                          <option value="FS">FS</option>
                          <option value="SS">SS</option>
                          <option value="FF">FF</option>
                          <option value="SF">SF</option>
                        </select>
                        <input
                          type="number"
                          className="input-base input-xs flex-1 min-w-0 text-center"
                          style={{ padding: '4px 4px', minWidth: '30px', maxWidth: '40px' }}
                          value={inputPredLag}
                          onChange={(e) => {
                            const val = e.target.value
                            const num = val === '' ? '' : Number(val)
                            setInputPredLag(num)
                            updatePredecessorString(inputPredWbs, inputPredType, num)
                          }}
                          placeholder="0"
                        />
                      </div>
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        placeholder="0"
                        className="input-base input-xs w-full text-right"
                        style={{ padding: '4px 6px' }}
                        value={inputCost || ''}
                        onChange={(e) => setInputCost(e.target.value.replace(/^0+(?=\d)/, ''))}
                      />
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-slate-400">—</td>
                    <td className="py-2 px-2" title={isCurrentlySuspended ? 'อยู่ในช่วงหยุดงาน ไม่สามารถบันทึกความคืบหน้าได้' : ''}>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        placeholder="0"
                        className={`input-base input-xs w-full text-center ${isCurrentlySuspended ? 'bg-slate-100 text-slate-400 cursor-not-allowed dark:bg-[#14142a]' : ''}`}
                        style={{ padding: '4px 6px' }}
                        value={inputProgress || ''}
                        disabled={isCurrentlySuspended}
                        onChange={(e) => setInputProgress(e.target.value.replace(/^0+(?=\d)/, ''))}
                      />
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-slate-400">—</td>
                    <td className="py-2 px-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={handleSaveInline}
                          disabled={isPending}
                          className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold"
                        >
                          บันทึก
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelInline}
                          className="px-2 py-1 bg-slate-500 hover:bg-slate-600 text-white rounded text-[10px] font-bold"
                        >
                          ยกเลิก
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 2. GANTT CHART TAB ── */}
      {activeTab === 'gantt' && (
        <div className="card rounded-2xl p-6 overflow-x-auto animate-fade-in border border-slate-200 dark:border-[#1c1c34]">
          <div className="min-w-[700px] space-y-4">
            {/* Print button */}
            <div className="flex justify-end">
              <button
                onClick={handlePrintGantt}
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm"
              >
                <Printer size={13} />
                พิมพ์ Gantt Chart
              </button>
            </div>
            
            {/* Timeline date header */}
            <div className="flex items-center pb-2 border-b border-slate-100 dark:border-[#1e1e38]">
              <div className="w-60 flex-shrink-0 font-bold text-slate-400 dark:text-slate-500 text-xs">กิจกรรม WBS</div>
              <div className="flex-1 relative h-4 text-[10px] font-bold text-slate-400 dark:text-slate-500">
                {ganttHeaders.map((h, i) => (
                  <span
                    key={i}
                    className="absolute -translate-x-1/2 text-center whitespace-nowrap"
                    style={{ left: `${(i / (ganttHeaders.length - 1)) * 100}%` }}
                  >
                    {h}
                  </span>
                ))}
              </div>
            </div>

            {/* Gantt rows */}
            <div className="divide-y divide-slate-100 dark:divide-[#1e1e38]/50">
              {scheduledTasks.length > 0 ? (
                scheduledTasks.map((t) => {
                  const { start, durationDays } = dateRange
                  const tStart = new Date(t.computedStartDate)
                  
                  // Calculate offsets in percent
                  const leftOffset = durationDays > 0 
                    ? ((tStart.getTime() - start.getTime()) / (durationDays * 24 * 60 * 60 * 1000)) * 100
                    : 0
                  const barWidth = durationDays > 0
                    ? (t.duration / durationDays) * 100
                    : 0

                  return (
                    <div key={t.id} className="flex items-center py-2.5 hover:bg-slate-50/50 dark:hover:bg-[#14142a]/10 transition-colors">
                      {/* Name column */}
                      <div className="w-60 flex-shrink-0 pr-3 truncate">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                          {t.wbs_no} {t.name}
                        </p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">
                          {formatDate(t.computedStartDate)} · {t.duration} วัน
                        </p>
                      </div>

                      {/* Bar column */}
                      <div className="flex-1 relative h-6 bg-slate-50 dark:bg-[#0a0a14]/20 rounded border border-transparent">
                        {/* Grid background lines */}
                        {ganttHeaders.map((_, idx) => (
                          <div
                            key={idx}
                            className="absolute top-0 bottom-0 w-px border-l border-slate-100 dark:border-[#1e1e38]/50 pointer-events-none"
                            style={{ left: `${(idx / (ganttHeaders.length - 1)) * 100}%` }}
                          />
                        ))}

                        {/* Suspension bands */}
                        {amendments.filter(a => (a.amendment_type === 'suspend_with_resume' || a.amendment_type === 'suspend_open') && !!a.suspend_date).map((s, idx) => {
                          const sStart = new Date(s.suspend_date!)
                          sStart.setHours(0, 0, 0, 0)
                          
                          // If no resume_date, cap at today (not end of timeline)
                          const isOngoing = !s.resume_date
                          const todayMidnight = new Date()
                          todayMidnight.setHours(0, 0, 0, 0)
                          const sEnd = s.resume_date ? new Date(s.resume_date) : todayMidnight
                          sEnd.setHours(0, 0, 0, 0)

                          if (sEnd < dateRange.start || sStart > dateRange.end) return null

                          const visibleStart = new Date(Math.max(sStart.getTime(), dateRange.start.getTime()))
                          const visibleEnd = new Date(Math.min(sEnd.getTime(), dateRange.end.getTime()))

                          const leftOffset = dateRange.durationDays > 0 
                            ? ((visibleStart.getTime() - dateRange.start.getTime()) / (dateRange.durationDays * 24 * 60 * 60 * 1000)) * 100
                            : 0
                          const widthPct = dateRange.durationDays > 0
                            ? ((visibleEnd.getTime() - visibleStart.getTime()) / (dateRange.durationDays * 24 * 60 * 60 * 1000)) * 100
                            : 0

                          return (
                            <div
                              key={`susp-${idx}`}
                              className="absolute top-0 bottom-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPjxyZWN0IHdpZHRoPSI4IiBoZWlnaHQ9IjgiIGZpbGw9InRyYW5zcGFyZW50Ij48L3JlY3Q+PHBhdGggZD0iTTAgOEw4IDBaTTggMTZMMTYgOFpNLTggMEwwIC04WiIgc3Ryb2tlPSJyZ2JhKDIzOSwgNjgsIDY4LCAwLjgpIiBzdHJva2Utd2lkdGg9IjIuNSI+PC9wYXRoPjwvc3ZnPg==')] bg-red-500/20 dark:bg-red-500/40 z-0 border-x-2 border-red-500/80 group/susp cursor-help"
                              style={{ left: `${leftOffset}%`, width: `${widthPct}%` }}
                            >
                              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 hidden group-hover/susp:block bg-red-900 text-white font-bold text-[9px] px-2 py-0.5 rounded shadow-lg whitespace-nowrap z-30 pointer-events-none">
                                ⏸ หยุดงาน ({formatDate(s.suspend_date!)} - {isOngoing ? 'ยังไม่กำหนด (ถึงวันนี้)' : formatDate(s.resume_date!)})
                              </div>
                            </div>
                          )
                        })}

                        {/* Today vertical line */}
                        {todayLeft >= 0 && todayLeft <= 100 && (
                          <div
                            className="absolute top-0 bottom-0 w-px border-l-2 border-dashed border-red-500 dark:border-white/50 z-25 pointer-events-none"
                            style={{ left: `${todayLeft}%` }}
                          />
                        )}

                        {/* Render segments */}
                        {(() => {
                          const workedDaysTotal = ((t.actual_progress || 0) / 100) * (t.duration || 1)
                          let remainingWorkedDays = workedDaysTotal
                          const segments = (t as any).segments || []

                          return segments.map((seg: any, sIdx: number) => {
                            const segStart = new Date(seg.start)
                            const segEnd = new Date(seg.end)
                            
                            if (segEnd < dateRange.start || segStart > dateRange.end) return null
                            
                            const visibleStart = new Date(Math.max(segStart.getTime(), dateRange.start.getTime()))
                            const visibleEnd = new Date(Math.min(segEnd.getTime(), dateRange.end.getTime()))

                            const segLeft = dateRange.durationDays > 0 
                              ? ((visibleStart.getTime() - dateRange.start.getTime()) / (dateRange.durationDays * 24 * 60 * 60 * 1000)) * 100
                              : 0
                            const segWidth = dateRange.durationDays > 0
                              ? ((visibleEnd.getTime() - visibleStart.getTime()) / (dateRange.durationDays * 24 * 60 * 60 * 1000)) * 100
                              : 0
                              
                            const segCapDays = seg.durationDays
                            const fillDays = Math.min(segCapDays, Math.max(0, remainingWorkedDays))
                            const fillPct = segCapDays > 0 ? (fillDays / segCapDays) * 100 : (t.actual_progress === 100 ? 100 : 0)
                            
                            remainingWorkedDays -= fillDays

                            return (
                              <div
                                key={sIdx}
                                className="absolute inset-y-0 my-1 group cursor-pointer z-10 hover:z-40"
                                style={{
                                  left: `${Math.min(99, Math.max(0, segLeft))}%`,
                                  width: `${Math.max(0.5, segWidth)}%`,
                                }}
                              >
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-slate-900 text-white font-bold text-[9px] px-2 py-0.5 rounded shadow-lg pointer-events-none whitespace-nowrap border border-slate-700/50" style={{ zIndex: 100 }}>
                                  {formatDate(t.computedStartDate)} - {formatDate(t.computedEndDate)}
                                </div>

                                <div className={`relative w-full h-4 bg-slate-200 dark:bg-[#1e1e38] shadow-sm flex items-center overflow-hidden hover:bg-slate-300 dark:hover:bg-[#2c2c4d] transition-all ${sIdx === 0 ? 'rounded-l' : ''} ${sIdx === segments.length - 1 ? 'rounded-r' : ''}`}>
                                  <div
                                    className="absolute inset-y-0 left-0 progress-fill"
                                    style={{ width: `${fillPct}%` }}
                                  />
                                  
                                  {sIdx === 0 && (
                                    <span className="absolute z-10 text-[9px] font-extrabold text-primary-950 dark:text-white pl-1.5 whitespace-nowrap">
                                      {t.actual_progress}%
                                    </span>
                                  )}
                                </div>
                              </div>
                            )
                          })
                        })()}
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="py-12 text-center text-slate-400">ยังไม่มีงานย่อยในระบบ</div>
              )}
            </div>
            
            {/* Guide details */}
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500 pt-3 border-t border-slate-100 dark:border-[#1e1e38]">
              <Info size={13} className="text-primary-600 dark:text-primary-400" />
              <span>แถบสีแสดงระยะเวลาแผนงานสะสมตาม WBS ทับด้วยแถบสีม่วงเข้มตามอัตราส่วนความก้าวหน้าจริงของกิจกรรม</span>
            </div>

          </div>
        </div>
      )}

      {/* ── 3. S-CURVE GRAPH TAB ── */}
      {activeTab === 'scurve' && (
        <div className="card rounded-2xl p-6 animate-fade-in border border-slate-200 dark:border-[#1c1c34]">
          <div className="space-y-6">
            <div className="flex justify-between items-center gap-3 flex-wrap">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <TrendingUp size={15} className="text-primary-600 dark:text-primary-400" />
                กราฟแสดงมูลค่าความก้าวหน้าสะสม (S-Curve)
              </h4>
              <div className="flex gap-4 text-[11px] font-bold flex-wrap">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <span className="w-3 h-0.5 border-t-2 border-dashed border-slate-400" />
                  PV แผนสะสม (Planned)
                </span>
                <span className="flex items-center gap-1.5 text-primary-600 dark:text-primary-400">
                  <span className="w-3 h-0.5 bg-primary-600 dark:bg-primary-400" />
                  EV ผลงานสะสม (Actual)
                </span>
                <span className="flex items-center gap-1.5 text-amber-500">
                  <span className="w-3 h-0.5 bg-amber-500" />
                  AC รายจ่ายจริงสะสม (Actual Cost)
                </span>
              </div>
              <button
                onClick={handlePrintSCurve}
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm flex-shrink-0"
              >
                <Printer size={13} />
                พิมพ์ S-Curve
              </button>
            </div>

            {sCurveData.length > 1 ? (
              <div className="relative">
                {/* HTML Tooltip on hover */}
                {hoveredPointIndex !== null && sCurveData[hoveredPointIndex] && (
                  <div
                    className="absolute bg-slate-900/95 dark:bg-[#14142a]/95 text-white p-3 rounded-lg border border-slate-700/50 shadow-xl pointer-events-none text-xs space-y-1 z-30"
                    style={{
                      left: `${(40 + (hoveredPointIndex / (sCurveData.length - 1)) * 445) / 500 * 100}%`,
                      transform: hoveredPointIndex > sCurveData.length / 2 ? 'translateX(-100%)' : 'none',
                      top: '15px',
                    }}
                  >
                    <p className="font-bold text-slate-300 border-b border-slate-700 pb-1 mb-1">
                      วันที่ {sCurveData[hoveredPointIndex].label}
                    </p>
                    <p className="flex justify-between gap-6 text-slate-400">
                      <span>PV แผน:</span>
                      <span className="font-mono font-bold">{sCurveData[hoveredPointIndex].planned.toFixed(1)}%</span>
                    </p>
                    <p className="flex justify-between gap-6 text-primary-400">
                      <span>EV ผลงาน:</span>
                      <span className="font-mono font-bold">
                        {sCurveData[hoveredPointIndex].actual !== null 
                          ? `${sCurveData[hoveredPointIndex].actual?.toFixed(1)}%` 
                          : '—'}
                      </span>
                    </p>
                    <p className="flex justify-between gap-6 text-amber-400">
                      <span>AC จ่ายจริง:</span>
                      <span className="font-mono font-bold">
                        {sCurveData[hoveredPointIndex].actualCost !== null 
                          ? `${sCurveData[hoveredPointIndex].actualCost?.toFixed(1)}%` 
                          : '—'}
                      </span>
                    </p>
                  </div>
                )}

                {/* SVG Render graph */}
                <svg viewBox="0 0 500 200" className="w-full overflow-visible">
                  {/* Grid Lines */}
                  {[0, 25, 50, 75, 100].map((v) => {
                    const y = 10 + (1 - v / 100) * 165
                    return (
                      <g key={v}>
                        <line x1="40" y1={y} x2="485" y2={y} className="stroke-slate-100 dark:stroke-[#1e1e38] stroke-1" />
                        <text x="32" y={y + 3} className="fill-slate-400 dark:fill-slate-600 font-mono text-[9px] text-right font-bold" textAnchor="end">
                          {v}%
                        </text>
                      </g>
                    )
                  })}

                  {/* Planned Cumulative Path (PV) */}
                  <path
                    d={sCurveData
                      .map((d, i) => {
                        const x = 40 + (i / (sCurveData.length - 1)) * 445
                        const y = 10 + (1 - d.planned / 100) * 165
                        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
                      })
                      .join(' ')}
                    fill="none"
                    className="stroke-slate-400 dark:stroke-slate-600 stroke-2"
                    strokeDasharray="4 3"
                  />

                   {/* Actual Cumulative Path (EV) */}
                  <path
                    d={sCurveData
                      .map((d, idx) => {
                        if (d.actual === null) return null
                        const x = 40 + (idx / (sCurveData.length - 1)) * 445
                        const y = 10 + (1 - d.actual / 100) * 165
                        return { x, y }
                      })
                      .filter((pt): pt is { x: number; y: number } => pt !== null)
                      .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`)
                      .join(' ')}
                    fill="none"
                    className="stroke-primary-600 dark:stroke-primary-400 stroke-2"
                  />

                  {/* AC Cumulative Path (Actual Cost) */}
                  <path
                    d={sCurveData
                      .map((d, idx) => {
                        if (d.actualCost === null) return null
                        const x = 40 + (idx / (sCurveData.length - 1)) * 445
                        const y = 10 + (1 - d.actualCost / 100) * 165
                        return { x, y }
                      })
                      .filter((pt): pt is { x: number; y: number } => pt !== null)
                      .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`)
                      .join(' ')}
                    fill="none"
                    className="stroke-amber-500 stroke-2"
                  />

                  {/* Data Points */}
                  {sCurveData.map((d, i) => {
                    const x = 40 + (i / (sCurveData.length - 1)) * 445
                    const yPlanned = 10 + (1 - d.planned / 100) * 165
                    const yActual = d.actual !== null ? 10 + (1 - d.actual / 100) * 165 : null
                    const yAC = d.actualCost !== null ? 10 + (1 - d.actualCost / 100) * 165 : null

                    return (
                      <g key={i} className="group">
                        <circle cx={x} cy={yPlanned} r="2.5" className="fill-slate-400 dark:fill-slate-600" />
                        {yActual !== null && (
                          <circle cx={x} cy={yActual} r="2.5" className="fill-primary-600 dark:fill-primary-400" />
                        )}
                        {yAC !== null && (
                          <circle cx={x} cy={yAC} r="2.5" className="fill-amber-500" />
                        )}
                      </g>
                    )
                  })}

                  {/* Invisible hover zones for vertical tracking */}
                  {sCurveData.map((d, i) => {
                    const x = 40 + (i / (sCurveData.length - 1)) * 445
                    return (
                      <rect
                        key={i}
                        x={x - 15}
                        y="10"
                        width="30"
                        height="165"
                        className="fill-transparent cursor-pointer hover:fill-slate-500/5 dark:hover:fill-slate-200/5"
                        onMouseEnter={() => setHoveredPointIndex(i)}
                        onMouseLeave={() => setHoveredPointIndex(null)}
                      />
                    )
                  })}

                  {/* X Axis Date labels (show dynamic steps to avoid overlap) */}
                  {sCurveData.map((d, i) => {
                    const labelStep = Math.max(1, Math.ceil(sCurveData.length / 8))
                    if (i % labelStep !== 0 && i !== sCurveData.length - 1) return null
                    const x = 40 + (i / (sCurveData.length - 1)) * 445
                    return (
                      <text key={i} x={x} y="193" className="fill-slate-400 dark:fill-slate-600 font-bold text-[8px]" textAnchor="middle">
                        {d.label}
                      </text>
                    )
                  })}
                </svg>
              </div>
            ) : (
              <div className="py-20 text-center text-slate-400">ต้องการข้อมูลอย่างน้อย 2 รายการเพื่อสร้างกราฟ S-Curve</div>
            )}
            
            <div className="flex items-start gap-2 bg-slate-50 dark:bg-[#14142a] p-3 rounded-lg border border-slate-100 dark:border-[#1e1e38] text-[11px] text-slate-500 dark:text-slate-400">
              <AlertTriangle size={14} className="text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                เส้น S-Curve นี้ประกอบไปด้วย 3 ส่วนสำคัญตามระบบ Earned Value Management ได้แก่ PV (แผนสะสม), EV (ผลงานที่ได้จริง), และ AC (รายจ่ายจริงสะสมที่ชำระเบิกจ่ายแล้ว) เพื่อประเมินความคุ้มค่าโครงการอย่างครบวงจร
              </p>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
