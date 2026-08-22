import type { WBSTask, ContractAmendment, Project } from '@/lib/types'

interface ParsedPredecessor {
  wbsNo: string
  type: 'FS' | 'SS' | 'FF' | 'SF'
  lagDays: number
}

// Parses predecessor strings like "1.1", "1.1SS", "1.1FF+10", "4-20"
export function parsePredecessor(predStr: string | null): ParsedPredecessor | null {
  if (!predStr) return null
  const clean = predStr.trim().replace(/\s+/g, '')
  
  const match = clean.match(/^([0-9.]+)(FS|SS|FF|SF)?(?:([+-])(\d+))?$/i)
  if (!match) return null
  
  const wbsNo = match[1]
  const type = (match[2]?.toUpperCase() || 'FS') as 'FS' | 'SS' | 'FF' | 'SF'
  const sign = match[3]
  const amount = match[4] ? parseInt(match[4], 10) : 0
  
  const lagDays = sign === '-' ? -amount : amount
  return { wbsNo, type, lagDays }
}

export interface TaskSegment {
  start: string // ISO string
  end: string   // ISO string
  durationDays: number
}

export interface ScheduledTask extends WBSTask {
  computedStartDate: string // ISO string YYYY-MM-DD
  computedEndDate: string
  segments: TaskSegment[]
}

function stripTime(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

// Helper to check if a date is inside any suspension (exclusive of resume_date if we treat resume_date as the first day back to work)
// The prompt says: "resume_date ... (วันเริ่มกลับมาเป็นวันทำงานวันแรกของช่วงที่เหลือ)"
// So if suspend_date = 15 July, resume_date = 20 Aug, then 15 July to 19 Aug are suspended days. 20 Aug is a working day.
export function isDateSuspended(date: Date, amendments: ContractAmendment[]): boolean {
  const dTime = stripTime(date).getTime()
  const todayTime = stripTime(new Date()).getTime()
  
  const suspensions = amendments.filter(a => a.amendment_type === 'suspend_with_resume' || a.amendment_type === 'suspend_open')

  for (const s of suspensions) {
    if (!s.suspend_date) continue
    const sTime = stripTime(new Date(s.suspend_date)).getTime()
    
    let rTime = Infinity
    if (s.resume_date) {
      rTime = stripTime(new Date(s.resume_date)).getTime()
    } else {
      // To prevent infinite loops in scheduling when resume_date is null,
      // we cap the suspension at 'today' for future projection purposes.
      rTime = Math.max(sTime, todayTime)
    }

    if (dTime >= sTime && dTime < rTime) {
      return true
    }
  }
  return false
}

// Add working days to a start date, skipping suspended days
// Add working days to a start date, skipping suspended days (supports positive and negative lag)
export function addWorkingDays(startDate: Date, daysToAdd: number, amendments: ContractAmendment[]): Date {
  let currentDate = stripTime(startDate)
  
  if (daysToAdd >= 0) {
    let remainingDays = daysToAdd
    while (remainingDays > 0) {
      // If the day is suspended, it doesn't count towards the duration
      if (!isDateSuspended(currentDate, amendments)) {
        remainingDays--
      }
      if (remainingDays > 0) {
        currentDate.setDate(currentDate.getDate() + 1)
      }
    }
  } else {
    let remainingDays = Math.abs(daysToAdd)
    while (remainingDays > 0) {
      currentDate.setDate(currentDate.getDate() - 1)
      if (!isDateSuspended(currentDate, amendments)) {
        remainingDays--
      }
    }
  }
  return currentDate
}

export function countWorkingDays(startDate: Date, endDate: Date, amendments: ContractAmendment[]): number {
  let count = 0
  let current = stripTime(startDate)
  const end = stripTime(endDate)
  
  while (current <= end) {
    if (!isDateSuspended(current, amendments)) {
      count++
    }
    current.setDate(current.getDate() + 1)
  }
  return count
}

export function getTaskSegments(startDate: Date, durationDays: number, amendments: ContractAmendment[]): TaskSegment[] {
  let currentDate = stripTime(startDate)
  let remainingDays = Math.max(0, durationDays)
  
  const segments: TaskSegment[] = []
  let currentSegment: { start: Date; end: Date; durationDays: number } | null = null

  while (remainingDays > 0) {
    if (!isDateSuspended(currentDate, amendments)) {
      if (!currentSegment) {
        currentSegment = { start: new Date(currentDate), end: new Date(currentDate), durationDays: 0 }
      }
      currentSegment.durationDays++
      currentSegment.end = new Date(currentDate)
      remainingDays--
    } else {
      if (currentSegment) {
        const sYear = currentSegment.start.getFullYear()
        const sMonth = String(currentSegment.start.getMonth() + 1).padStart(2, '0')
        const sDay = String(currentSegment.start.getDate()).padStart(2, '0')
        const eYear = currentSegment.end.getFullYear()
        const eMonth = String(currentSegment.end.getMonth() + 1).padStart(2, '0')
        const eDay = String(currentSegment.end.getDate()).padStart(2, '0')

        segments.push({
          start: `${sYear}-${sMonth}-${sDay}`,
          end: `${eYear}-${eMonth}-${eDay}`,
          durationDays: currentSegment.durationDays
        })
        currentSegment = null
      }
    }
    
    if (remainingDays > 0) {
      currentDate.setDate(currentDate.getDate() + 1)
    }
  }

  if (currentSegment) {
    const sYear = currentSegment.start.getFullYear()
    const sMonth = String(currentSegment.start.getMonth() + 1).padStart(2, '0')
    const sDay = String(currentSegment.start.getDate()).padStart(2, '0')
    const eYear = currentSegment.end.getFullYear()
    const eMonth = String(currentSegment.end.getMonth() + 1).padStart(2, '0')
    const eDay = String(currentSegment.end.getDate()).padStart(2, '0')

    segments.push({
      start: `${sYear}-${sMonth}-${sDay}`,
      end: `${eYear}-${eMonth}-${eDay}`,
      durationDays: currentSegment.durationDays
    })
  }

  if (segments.length === 0) {
    const sYear = startDate.getFullYear()
    const sMonth = String(startDate.getMonth() + 1).padStart(2, '0')
    const sDay = String(startDate.getDate()).padStart(2, '0')
    segments.push({
      start: `${sYear}-${sMonth}-${sDay}`,
      end: `${sYear}-${sMonth}-${sDay}`,
      durationDays: 0
    })
  }

  return segments
}

export function computeTaskDates(tasks: WBSTask[], projectStartDate: string | null, amendments: ContractAmendment[] = []): ScheduledTask[] {
  const taskMap = new Map<string, WBSTask>()
  for (const t of tasks) {
    taskMap.set(t.wbs_no, t)
  }

  const computedCache = new Map<string, { start: Date; end: Date }>()
  const fallbackProjectStart = projectStartDate ? new Date(projectStartDate) : new Date()

  function getDates(wbsNo: string, visiting: Set<string>): { start: Date; end: Date } {
    if (computedCache.has(wbsNo)) return computedCache.get(wbsNo)!

    const task = taskMap.get(wbsNo)
    if (!task) {
      return { start: fallbackProjectStart, end: addWorkingDays(fallbackProjectStart, 1, amendments) }
    }

    if (visiting.has(wbsNo)) {
      const baseStart = task.start_date ? new Date(task.start_date) : fallbackProjectStart
      return { start: baseStart, end: addWorkingDays(baseStart, task.duration || 1, amendments) }
    }

    visiting.add(wbsNo)

    const parsed = parsePredecessor(task.predecessors)
    let startDate: Date
    const durationDays = task.duration || 1

    if (parsed && taskMap.has(parsed.wbsNo)) {
      const predDates = getDates(parsed.wbsNo, visiting)
      const predStart = predDates.start
      const predEnd = predDates.end
      const lag = parsed.lagDays

      if (parsed.type === 'SS') {
        startDate = addWorkingDays(predStart, lag, amendments)
      } else if (parsed.type === 'FF') {
        const endDate = addWorkingDays(predEnd, lag, amendments)
        startDate = addWorkingDays(endDate, -durationDays, amendments)
      } else if (parsed.type === 'SF') {
        const endDate = addWorkingDays(predStart, lag, amendments)
        startDate = addWorkingDays(endDate, -durationDays, amendments)
      } else {
        // FS (Default)
        startDate = addWorkingDays(predEnd, lag, amendments)
      }
    } else {
      startDate = task.start_date ? new Date(task.start_date) : fallbackProjectStart
    }

    const endDate = addWorkingDays(startDate, durationDays, amendments)

    visiting.delete(wbsNo)

    const result = { start: startDate, end: endDate }
    computedCache.set(wbsNo, result)
    return result
  }

  return tasks.map((t) => {
    const dates = getDates(t.wbs_no, new Set<string>())
    // Correct string splitting by using local year-month-day to avoid timezone shifting
    const sYear = dates.start.getFullYear()
    const sMonth = String(dates.start.getMonth() + 1).padStart(2, '0')
    const sDay = String(dates.start.getDate()).padStart(2, '0')
    const eYear = dates.end.getFullYear()
    const eMonth = String(dates.end.getMonth() + 1).padStart(2, '0')
    const eDay = String(dates.end.getDate()).padStart(2, '0')
    
    const segments = getTaskSegments(dates.start, t.duration || 1, amendments)
    
    return {
      ...t,
      computedStartDate: `${sYear}-${sMonth}-${sDay}`,
      computedEndDate: `${eYear}-${eMonth}-${eDay}`,
      segments,
    }
  })
}

export function computeProjectExtension(project: Project, amendments: ContractAmendment[] = []) {
  if (!project.start_date || !project.end_date) {
    return {
      totalDays: 0,
      daysUsed: 0,
      daysRemaining: 0,
      isOverrun: false,
      newEndDate: null,
      totalSuspendedDays: 0,
      totalAmendmentDays: 0,
      isCurrentlySuspended: false,
      currentSuspension: null
    }
  }

  const start = stripTime(new Date(project.start_date))
  const origEnd = stripTime(new Date(project.end_date))
  const today = stripTime(new Date())

  // totalDaysAtBaseline = จำนวนวันสัญญาตาม baseline เดิม (บวก 1 เพื่อให้นับรวมหัวท้าย)
  const totalDaysAtBaseline = Math.max(0, Math.round((origEnd.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1)

  let totalSuspendedDaysForEndDate = 0
  let suspendedDaysUntilToday = 0
  let isCurrentlySuspended = false
  let currentSuspension = null

  const suspensions = amendments.filter(a => a.amendment_type === 'suspend_with_resume' || a.amendment_type === 'suspend_open')

  // Sort suspensions by date just in case
  const sortedSuspensions = [...suspensions].sort((a, b) => {
    if (!a.suspend_date || !b.suspend_date) return 0
    return new Date(a.suspend_date).getTime() - new Date(b.suspend_date).getTime()
  })

  for (const s of sortedSuspensions) {
    if (!s.suspend_date) continue
    const sDate = stripTime(new Date(s.suspend_date))
    let rDate: Date | null = null
    
    if (s.resume_date) {
      rDate = stripTime(new Date(s.resume_date))
      // For end date calculation: only count suspensions that have a resume_date
      totalSuspendedDaysForEndDate += Math.max(0, Math.round((rDate.getTime() - sDate.getTime()) / (1000 * 60 * 60 * 24)))
    }

    // Check if currently suspended
    if (rDate) {
      if (today >= sDate && today < rDate) {
        isCurrentlySuspended = true
        currentSuspension = s
      }
    } else {
      if (today >= sDate) {
        isCurrentlySuspended = true
        currentSuspension = s
      }
    }

    // For elapsed days calculation: count any suspended days that overlap with the past
    if (sDate <= today) {
      // Use an exclusive boundary for calculation
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      const endBoundary = rDate && rDate <= today ? rDate : tomorrow
      suspendedDaysUntilToday += Math.max(0, Math.round((endBoundary.getTime() - sDate.getTime()) / (1000 * 60 * 60 * 24)))
    }
  }

  let totalAmendmentDays = 0
  for (const a of amendments) {
    totalAmendmentDays += Number(a.extra_days) || 0
  }

  // 1. Raw elapsed days = today - start_date (บวก 1 ให้นับรวมหัวท้าย)
  const rawElapsed = Math.max(0, Math.round((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1)
  
  // 2. Elapsed days (actual working days used) = raw elapsed - suspended days in the past
  const elapsedDays = Math.max(0, rawElapsed - suspendedDaysUntilToday)

  // 3. Total days current = baseline + amendment days
  const totalDaysCurrent = Math.max(0, totalDaysAtBaseline + totalAmendmentDays)

  // 4. Remaining days = totalDaysCurrent - elapsedDays
  const remainingDaysRaw = totalDaysCurrent - elapsedDays
  const isOverrun = remainingDaysRaw < 0
  const daysRemaining = Math.abs(remainingDaysRaw)

  // 5. New end date = origEnd + totalSuspendedDaysForEndDate + totalAmendmentDays
  const newEndDate = new Date(origEnd.getTime() + (totalSuspendedDaysForEndDate + totalAmendmentDays) * 24 * 60 * 60 * 1000)

  return {
    totalDays: totalDaysCurrent,
    daysUsed: elapsedDays,
    daysRemaining,
    isOverrun,
    newEndDate,
    totalSuspendedDays: totalSuspendedDaysForEndDate,
    totalAmendmentDays,
    isCurrentlySuspended,
    currentSuspension
  }
}
