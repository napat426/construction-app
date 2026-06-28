'use client'

import { useState, useMemo, useTransition } from 'react'
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
} from 'lucide-react'
import { deleteTask } from '@/app/actions/tasks'
import { computeTaskDates } from '@/lib/scheduler'
import type { Project, WBSTask, ProjectPayment, ProjectMilestone } from '@/lib/types'

interface PlanningClientProps {
  project: Project
  tasks: WBSTask[]
  payments: ProjectPayment[]
  milestones: ProjectMilestone[]
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

export function PlanningClient({ project, tasks, payments, milestones }: PlanningClientProps) {
  const [activeTab, setActiveTab] = useState<'wbs' | 'gantt' | 'scurve'>('wbs')
  const [isPending, startTransition] = useTransition()
  
  // S-Curve tooltip state
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null)

  // Inline edit state
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  
  // Local states for inputs in editing mode
  const [inputWbsNo, setInputWbsNo] = useState('')
  const [inputName, setInputName] = useState('')
  const [inputDuration, setInputDuration] = useState(1)
  const [inputStartDate, setInputStartDate] = useState('')
  const [inputPredecessors, setInputPredecessors] = useState('')
  const [inputCost, setInputCost] = useState(0)
  const [inputProgress, setInputProgress] = useState(0)
  const [inputIsMilestone, setInputIsMilestone] = useState(false)

  // Sort tasks naturally by WBS No. and calculate dynamic schedule dates
  const scheduledTasks = useMemo(() => {
    const sorted = [...tasks].sort((a, b) => sortWBS(a.wbs_no, b.wbs_no))
    return computeTaskDates(sorted, project.start_date)
  }, [tasks, project.start_date])

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
    const totalDur = Math.max(1, tEnd.getTime() - tStart.getTime())
    const elapsed = todayForStatus.getTime() - tStart.getTime()
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
    }
  }, [scheduledTasks])

  // 2. Timeline date range (for Gantt & S-Curve)
  const dateRange = useMemo(() => {
    if (scheduledTasks.length === 0) {
      const pStart = project.start_date ? new Date(project.start_date) : new Date()
      const pEnd = project.end_date ? new Date(project.end_date) : new Date(pStart.getTime() + 30 * 24 * 60 * 60 * 1000)
      return { start: pStart, end: pEnd, durationDays: Math.ceil((pEnd.getTime() - pStart.getTime()) / (24 * 60 * 60 * 1000)) }
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
    maxDate = new Date(maxDate.getTime() + 5 * 24 * 60 * 60 * 1000)

    const durationDays = Math.max(1, Math.ceil((maxDate.getTime() - minDate.getTime()) / (24 * 60 * 60 * 1000)))
    return { start: minDate, end: maxDate, durationDays }
  }, [scheduledTasks, project])

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
    const pointsCount = 12
    const list: { label: string; planned: number; actual: number | null; actualCost: number | null }[] = []
    const { start, durationDays } = dateRange

    if (scheduledTasks.length === 0 || durationDays === 0) return []

    const todayDateOnly = new Date()
    todayDateOnly.setHours(0, 0, 0, 0)

    const totalWeightDenominator = summary.totalCost > 0 ? summary.totalCost : (scheduledTasks.length || 1)

    // Group paid milestones by date and sort chronologically
    const groupedMap = new Map<string, number>()
    for (const m of milestones) {
      if (m.is_paid && m.payment_date && Number(m.amount) > 0) {
        const dStr = m.payment_date
        groupedMap.set(dStr, (groupedMap.get(dStr) || 0) + Number(m.amount))
      }
    }

    const sortedPayments = Array.from(groupedMap.entries())
      .map(([dateStr, amount]) => ({
        time: new Date(dateStr).getTime(),
        amount,
      }))
      .sort((a, b) => a.time - b.time)

    const keyPoints: { time: number; value: number }[] = []
    keyPoints.push({ time: start.getTime(), value: 0 })

    let runningSum = 0
    for (const p of sortedPayments) {
      runningSum += p.amount
      keyPoints.push({
        time: p.time,
        value: (runningSum / (project.budget || 1)) * 100,
      })
    }

    for (let i = 0; i <= pointsCount; i++) {
      const fraction = i / pointsCount
      const currTime = start.getTime() + fraction * durationDays * 24 * 60 * 60 * 1000
      const currDate = new Date(currTime)
      currDate.setHours(0, 0, 0, 0)

      // Planned sum (PV)
      let plannedSum = 0
      for (const t of scheduledTasks) {
        const tStart = new Date(t.computedStartDate)
        const tEnd = new Date(t.computedEndDate)
        const taskWeightValue = summary.totalCost > 0 ? (Number(t.cost) || 0) : 1
        
        if (currDate >= tEnd) {
          plannedSum += taskWeightValue
        } else if (currDate >= tStart) {
          const elapsed = (currDate.getTime() - tStart.getTime()) / (24 * 60 * 60 * 1000)
          plannedSum += taskWeightValue * (elapsed / t.duration)
        }
      }

      // Actual sum (EV)
      let actualSum = 0
      const showActual = currDate <= todayDateOnly || i === 0

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

      // AC cumulative spent from project milestones
      let acVal: number | null = null
      if (showActual) {
        if (keyPoints.length > 1) {
          if (currTime <= keyPoints[0].time) {
            acVal = 0
          } else {
            let found = false
            for (let j = 0; j < keyPoints.length - 1; j++) {
              const pA = keyPoints[j]
              const pB = keyPoints[j + 1]
              if (currTime >= pA.time && currTime <= pB.time) {
                const dt = pB.time - pA.time
                if (dt > 0) {
                  const ratio = (currTime - pA.time) / dt
                  acVal = pA.value + (pB.value - pA.value) * ratio
                } else {
                  acVal = pB.value
                }
                found = true
                break
              }
            }
            if (!found) {
              acVal = keyPoints[keyPoints.length - 1].value
            }
          }
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
        actualCost: acVal !== null ? Math.min(100, Math.round(acVal)) : null,
      })
    }
    return list
  }, [scheduledTasks, dateRange, summary, project, milestones])

  // Plan vs Actual deviation at TODAY
  const deviationAtToday = useMemo(() => {
    const todayDateOnly = new Date()
    todayDateOnly.setHours(0, 0, 0, 0)
    
    if (scheduledTasks.length === 0) return 0
    
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
        const elapsed = (todayDateOnly.getTime() - tStart.getTime()) / (24 * 60 * 60 * 1000)
        plannedSum += taskWeightValue * (elapsed / t.duration)
      }
    }
    const plannedPercentAtToday = (plannedSum / totalWeightDenominator) * 100
    return summary.actualProgress - plannedPercentAtToday
  }, [scheduledTasks, summary])

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

  // Inline CRUD handlers
  const handleEditInline = (task: WBSTask) => {
    setEditingTaskId(task.id)
    setInputWbsNo(task.wbs_no)
    setInputName(task.name)
    setInputDuration(task.duration)
    setInputStartDate(task.start_date || '')
    setInputPredecessors(task.predecessors || '')
    setInputCost(task.cost)
    setInputProgress(task.actual_progress)
    setInputIsMilestone(task.is_milestone)
  }

  const handleNewInline = () => {
    setEditingTaskId('new')
    setInputWbsNo('')
    setInputName('')
    setInputDuration(1)
    setInputStartDate('')
    setInputPredecessors('')
    setInputCost(0)
    setInputProgress(0)
    setInputIsMilestone(false)
  }

  const handleCancelInline = () => {
    setEditingTaskId(null)
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

        {/* Weighted Cumulative Actual Progress */}
        <div className="stat-card rounded-2xl p-5 flex items-center justify-between">
          <div>
            <span className={labelCls}>ความก้าวหน้าถ่วงน้ำหนักรวม</span>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xl font-black text-primary-600 dark:text-primary-400">
                {summary.actualProgress}%
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

        <button
          id="add-task-wbs-btn"
          onClick={handleNewInline}
          disabled={editingTaskId === 'new'}
          className="flex items-center gap-2 px-3.5 py-2 mb-2 rounded-lg text-xs font-bold text-white btn-primary flex-shrink-0 disabled:opacity-50"
        >
          <Plus size={14} />
          เพิ่มงานย่อย WBS
        </button>
      </div>

      {/* ── Tab Content Areas ── */}
      
      {/* ── 1. WBS TABLE TAB ── */}
      {activeTab === 'wbs' && (
        <div className="card rounded-2xl overflow-hidden animate-fade-in border border-slate-200 dark:border-[#1c1c34]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-[#14142a] text-slate-400 dark:text-slate-500 font-bold border-b border-slate-200 dark:border-[#1c1c34]">
                  <th className="py-3 px-4 w-20">WBS No.</th>
                  <th className="py-3 px-4 min-w-44">รายการกิจกรรม</th>
                  <th className="py-3 px-4 w-28">สถานะ</th>
                  <th className="py-3 px-4 w-28">ระยะเวลา (วัน)</th>
                  <th className="py-3 px-4 w-28">วันเริ่มงาน</th>
                  <th className="py-3 px-4 w-28">วันสิ้นสุดงาน</th>
                  <th className="py-3 px-4 w-24">งานก่อนหน้า</th>
                  <th className="py-3 px-4 w-32 text-right">มูลค่างาน</th>
                  <th className="py-3 px-4 w-20 text-right">สัดส่วน (Weight)</th>
                  <th className="py-3 px-4 w-32">ความคืบหน้างานย่อย</th>
                  <th className="py-3 px-4 w-20 text-right">ความคืบหน้าถ่วงน้ำหนัก</th>
                  <th className="py-3 px-4 w-28 text-center">จัดการ</th>
                </tr>
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
                              className="input-base font-mono w-full px-1.5 py-1 text-xs"
                              value={inputWbsNo}
                              onChange={(e) => setInputWbsNo(e.target.value)}
                            />
                          </td>
                          <td className="py-2 px-2">
                            <div className="flex items-center gap-1.5 w-full">
                              <input
                                type="checkbox"
                                checked={inputIsMilestone}
                                onChange={(e) => setInputIsMilestone(e.target.checked)}
                                title="Milestone"
                                className="w-3.5 h-3.5"
                              />
                              <input
                                type="text"
                                className="input-base w-full px-1.5 py-1 text-xs"
                                value={inputName}
                                onChange={(e) => setInputName(e.target.value)}
                              />
                            </div>
                          </td>
                          <td className="py-2 px-2" />{/* status placeholder */}
                          <td className="py-2 px-2">
                            <input
                              type="number"
                              className="input-base w-full px-1.5 py-1 text-xs"
                              value={inputDuration}
                              onChange={(e) => setInputDuration(parseInt(e.target.value) || 0)}
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
                                className="input-base w-full px-1 py-1 text-xs"
                                value={inputStartDate}
                                onChange={(e) => setInputStartDate(e.target.value)}
                              />
                            )}
                          </td>
                          <td className="py-2 px-2 font-mono text-slate-400">
                            {formatDate(t.computedEndDate)}
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="text"
                              className="input-base w-full px-1.5 py-1 text-xs font-mono"
                              value={inputPredecessors}
                              onChange={(e) => setInputPredecessors(e.target.value)}
                            />
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="number"
                              className="input-base w-full px-1.5 py-1 text-xs text-right"
                              value={inputCost}
                              onChange={(e) => setInputCost(parseFloat(e.target.value) || 0)}
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
                              className="input-base w-full px-1.5 py-1 text-xs"
                              value={inputProgress}
                              onChange={(e) => setInputProgress(parseInt(e.target.value) || 0)}
                            />
                          </td>
                          <td className="py-2 px-2 text-right font-mono text-slate-400">
                            {(weight * inputProgress / 100).toFixed(1)}%
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
                          <td className="py-2 px-2" />
                        </tr>
                      )
                    }

                    const status = getTaskStatus(t)
                    return (
                      <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-[#14142a]/30 transition-colors">
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
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              id={`edit-task-${t.id}`}
                              onClick={() => handleEditInline(t)}
                              title="แก้ไขงานย่อย"
                              className="w-7 h-7 rounded border border-slate-200 dark:border-[#252548] bg-slate-50 dark:bg-[#14142a] flex items-center justify-center text-slate-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                            >
                              <Edit2 size={11} />
                            </button>
                            <button
                              id={`delete-task-${t.id}`}
                              onClick={() => handleDelete(t.id)}
                              disabled={isPending}
                              title="ลบงานย่อย"
                              className="w-7 h-7 rounded border border-slate-200 dark:border-[#252548] bg-slate-50 dark:bg-[#14142a] flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </td>
                      </tr>
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
                        className="input-base font-mono w-full px-1.5 py-1 text-xs"
                        value={inputWbsNo}
                        onChange={(e) => setInputWbsNo(e.target.value)}
                      />
                    </td>
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-1.5 w-full">
                        <input
                          type="checkbox"
                          checked={inputIsMilestone}
                          onChange={(e) => setInputIsMilestone(e.target.checked)}
                          title="Milestone"
                          className="w-3.5 h-3.5"
                        />
                        <input
                          type="text"
                          placeholder="ชื่อกิจกรรม"
                          className="input-base w-full px-1.5 py-1 text-xs"
                          value={inputName}
                          onChange={(e) => setInputName(e.target.value)}
                        />
                      </div>
                    </td>
                    <td className="py-2 px-2" />{/* status placeholder */}
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        placeholder="ระยะเวลา"
                        className="input-base w-full px-1.5 py-1 text-xs"
                        value={inputDuration}
                        onChange={(e) => setInputDuration(parseInt(e.target.value) || 0)}
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
                          className="input-base w-full px-1 py-1 text-xs"
                          value={inputStartDate}
                          onChange={(e) => setInputStartDate(e.target.value)}
                        />
                      )}
                    </td>
                    <td className="py-2 px-2 font-mono text-slate-400 text-xs">—</td>{/* end date placeholder */}
                    <td className="py-2 px-2">
                      <input
                        type="text"
                        placeholder="งานก่อนหน้า"
                        className="input-base w-full px-1.5 py-1 text-xs font-mono"
                        value={inputPredecessors}
                        onChange={(e) => setInputPredecessors(e.target.value)}
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        placeholder="งบประมาณ"
                        className="input-base w-full px-1.5 py-1 text-xs text-right"
                        value={inputCost}
                        onChange={(e) => setInputCost(parseFloat(e.target.value) || 0)}
                      />
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-slate-400">—</td>
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        className="input-base w-full px-1.5 py-1 text-xs"
                        value={inputProgress}
                        onChange={(e) => setInputProgress(parseInt(e.target.value) || 0)}
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

                        {/* Today vertical line */}
                        {todayLeft >= 0 && todayLeft <= 100 && (
                          <div
                            className="absolute top-0 bottom-0 w-px border-l-2 border-dashed border-red-500 dark:border-white/50 z-25 pointer-events-none"
                            style={{ left: `${todayLeft}%` }}
                          />
                        )}

                        <div
                          className="absolute inset-y-0 h-4 my-1 rounded bg-slate-200 dark:bg-[#1e1e38] shadow-sm flex items-center px-1 overflow-visible group cursor-pointer hover:bg-slate-300 dark:hover:bg-[#2c2c4d] transition-all"
                          style={{
                            left: `${Math.min(95, Math.max(0, leftOffset))}%`,
                            width: `${Math.min(100, Math.max(2, barWidth))}%`,
                          }}
                        >
                          {/* CSS Hover Tooltip */}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block bg-slate-900 text-white font-bold text-[9px] px-2 py-0.5 rounded shadow-lg pointer-events-none whitespace-nowrap z-30 border border-slate-700/50">
                            {formatDate(t.computedStartDate)} - {formatDate(t.computedEndDate)}
                          </div>

                          {/* Inner Actual Progress bar */}
                          <div
                            className="absolute inset-y-0 left-0 progress-fill rounded-l"
                            style={{ width: `${t.actual_progress}%` }}
                          />
                          
                          <span className="relative z-10 text-[9px] font-extrabold text-primary-950 dark:text-white pl-1.5">
                            {t.actual_progress}%
                          </span>
                        </div>
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
            <div className="flex justify-between items-center">
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

                  {/* X Axis Date labels (show every 2 points to avoid overlap) */}
                  {sCurveData.map((d, i) => {
                    if (i % 2 !== 0 && i !== sCurveData.length - 1) return null
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
