import type { WBSTask, ContractSuspension, Project } from '@/lib/types'

interface ParsedPredecessor {
  wbsNo: string
  lagDays: number
}

// Parses predecessor strings like "1.1", "1.1+10", "1.1-5"
export function parsePredecessor(predStr: string | null): ParsedPredecessor | null {
  if (!predStr) return null
  const clean = predStr.trim().replace(/\s+/g, '')
  
  const match = clean.match(/^([0-9.]+)(?:([+-])(\d+))?$/)
  if (!match) return null
  
  const wbsNo = match[1]
  const sign = match[2]
  const amount = match[3] ? parseInt(match[3], 10) : 0
  
  const lagDays = sign === '-' ? -amount : amount
  return { wbsNo, lagDays }
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
export function isDateSuspended(date: Date, suspensions: ContractSuspension[]): boolean {
  const dTime = stripTime(date).getTime()
  const todayTime = stripTime(new Date()).getTime()

  for (const s of suspensions) {
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
export function addWorkingDays(startDate: Date, daysToAdd: number, suspensions: ContractSuspension[]): Date {
  let currentDate = stripTime(startDate)
  let remainingDays = Math.max(0, daysToAdd) // duration

  while (remainingDays > 0) {
    // If the day is suspended, it doesn't count towards the duration
    if (!isDateSuspended(currentDate, suspensions)) {
      remainingDays--
    }
    if (remainingDays > 0) {
      currentDate.setDate(currentDate.getDate() + 1)
    }
  }
  return currentDate
}

export function countWorkingDays(startDate: Date, endDate: Date, suspensions: ContractSuspension[]): number {
  let count = 0
  let current = stripTime(startDate)
  const end = stripTime(endDate)
  
  while (current < end) {
    if (!isDateSuspended(current, suspensions)) {
      count++
    }
    current.setDate(current.getDate() + 1)
  }
  return count
}

export function getTaskSegments(startDate: Date, durationDays: number, suspensions: ContractSuspension[]): TaskSegment[] {
  let currentDate = stripTime(startDate)
  let remainingDays = Math.max(0, durationDays)
  
  const segments: TaskSegment[] = []
  let currentSegment: { start: Date; end: Date; durationDays: number } | null = null

  while (remainingDays > 0) {
    if (!isDateSuspended(currentDate, suspensions)) {
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

export function computeTaskDates(tasks: WBSTask[], projectStartDateStr: string | null, suspensions: ContractSuspension[] = []): ScheduledTask[] {
  const taskMap = new Map<string, WBSTask>()
  for (const t of tasks) {
    taskMap.set(t.wbs_no, t)
  }

  const computedCache = new Map<string, { start: Date; end: Date }>()
  const fallbackProjectStart = projectStartDateStr ? new Date(projectStartDateStr) : new Date()

  function getDates(wbsNo: string, visiting: Set<string>): { start: Date; end: Date } {
    if (computedCache.has(wbsNo)) return computedCache.get(wbsNo)!

    const task = taskMap.get(wbsNo)
    if (!task) {
      return { start: fallbackProjectStart, end: addWorkingDays(fallbackProjectStart, 1, suspensions) }
    }

    if (visiting.has(wbsNo)) {
      const baseStart = task.start_date ? new Date(task.start_date) : fallbackProjectStart
      return { start: baseStart, end: addWorkingDays(baseStart, task.duration || 1, suspensions) }
    }

    visiting.add(wbsNo)

    const parsedPred = parsePredecessor(task.predecessors)
    let startDate: Date

    if (parsedPred && taskMap.has(parsedPred.wbsNo)) {
      const predDates = getDates(parsedPred.wbsNo, visiting)
      const predFinish = predDates.end
      // Lag days also only count working days? For simplicity, yes.
      if (parsedPred.lagDays >= 0) {
        startDate = addWorkingDays(predFinish, parsedPred.lagDays, suspensions)
      } else {
        // Negative lag (lead) is harder with forward-only addWorkingDays, let's just subtract raw days for now to keep it simple, or implement subtractWorkingDays.
        // For now, raw subtract.
        startDate = new Date(predFinish.getTime() + parsedPred.lagDays * 24 * 60 * 60 * 1000)
      }
    } else {
      startDate = task.start_date ? new Date(task.start_date) : fallbackProjectStart
    }

    const durationDays = task.duration || 1
    // Task ends after duration *working* days
    const endDate = addWorkingDays(startDate, durationDays, suspensions)

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
    
    const segments = getTaskSegments(dates.start, t.duration || 1, suspensions)
    
    return {
      ...t,
      computedStartDate: `${sYear}-${sMonth}-${sDay}`,
      computedEndDate: `${eYear}-${eMonth}-${eDay}`,
      segments,
    }
  })
}

export function computeProjectExtension(project: Project, suspensions: ContractSuspension[]) {
  if (!project.start_date || !project.end_date) {
    return {
      totalDays: 0,
      daysUsed: 0,
      daysRemaining: 0,
      isOverrun: false,
      newEndDate: null,
      totalSuspendedDays: 0,
      isCurrentlySuspended: false,
      currentSuspension: null
    }
  }

  const start = stripTime(new Date(project.start_date))
  const origEnd = stripTime(new Date(project.end_date))
  const today = stripTime(new Date())

  // totalDays = Number of days in contract
  const totalDays = Math.max(0, Math.ceil((origEnd.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))

  let totalSuspendedDays = 0
  let isCurrentlySuspended = false
  let currentSuspension = null

  // Process suspensions sequentially to accumulate total suspended days
  // (We assume they don't overlap as per validation)
  for (const s of suspensions) {
    const sDate = stripTime(new Date(s.suspend_date))
    
    // Only count suspensions that have started relative to today (or fully count them for total extensions?)
    // Actually, to calculate the NEW END DATE, we must count ALL suspensions, even future ones? 
    // Usually extensions are granted and end_date pushes out.
    // If we only push end_date out when suspension finishes, what about today's remaining_days?
    // User formula: 
    // "สูตรทั่วไป: จำนวนวันสัญญาที่เหลือ ณ วันสั่งหยุด = total_days - elapsed_days_ก่อนหยุด"
    // "วันสิ้นสุดสัญญาใหม่ = resume_date + (จำนวนวันที่เหลือ) - 1 วัน"
    
    const rDate = s.resume_date ? stripTime(new Date(s.resume_date)) : null

    if (!rDate) {
      // Currently suspended open-ended
      if (today >= sDate) {
        totalSuspendedDays += Math.ceil((today.getTime() - sDate.getTime()) / (1000 * 60 * 60 * 24))
        if (today >= sDate) {
          isCurrentlySuspended = true
          currentSuspension = s
        }
      }
    } else {
      // Completed suspension (or scheduled)
      // Only accumulate days if we've reached it? 
      // User says: "ถ้า resume_date ยังเป็น NULL... แสดงว่ายังไม่คำนวณ end_date ใหม่"
      // So if resume_date is set, we fully extend end_date by the suspension duration!
      const duration = Math.ceil((rDate.getTime() - sDate.getTime()) / (1000 * 60 * 60 * 24))
      totalSuspendedDays += duration
      
      if (today >= sDate && today < rDate) {
        isCurrentlySuspended = true
        currentSuspension = s
      }
    }
  }

  // Calculate elapsed days (from start to today, minus suspended days)
  let rawElapsed = Math.ceil((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  rawElapsed = Math.max(0, rawElapsed)
  
  // Calculate how many of the suspended days occurred BEFORE OR ON today
  let suspendedDaysUntilToday = 0
  for (const s of suspensions) {
    const sDate = stripTime(new Date(s.suspend_date))
    if (sDate > today) continue
    
    const rDate = s.resume_date ? stripTime(new Date(s.resume_date)) : today
    const endBoundary = rDate < today ? rDate : today
    suspendedDaysUntilToday += Math.max(0, Math.ceil((endBoundary.getTime() - sDate.getTime()) / (1000 * 60 * 60 * 24)))
  }

  const daysUsed = Math.max(0, rawElapsed - suspendedDaysUntilToday)

  // Calculate new end date by adding all *defined* suspension durations to origEnd
  // (If there's an open-ended suspension, the end date is just extended by the days so far, but user says:
  // "ถ้า resume_date ยังเป็น NULL... ระบบต้องนับวันหยุดไปเรื่อยๆ ... โดยที่ยังไม่คำนวณ end_date ใหม่")
  // Let's implement: newEndDate = origEnd + totalSuspendedDays (which includes completed, plus ongoing up to today if null)
  const newEndDate = new Date(origEnd.getTime() + totalSuspendedDays * 24 * 60 * 60 * 1000)

  // Remaining days = totalDays - daysUsed (if we haven't passed end date)
  // Or simply remaining = newEndDate - today (if we include all suspensions)
  // Let's use the explicit remaining calculation
  let daysRemaining = Math.ceil((newEndDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  
  const isOverrun = daysRemaining < 0

  return {
    totalDays,
    daysUsed,
    daysRemaining: Math.abs(daysRemaining),
    isOverrun,
    newEndDate,
    totalSuspendedDays,
    isCurrentlySuspended,
    currentSuspension
  }
}
