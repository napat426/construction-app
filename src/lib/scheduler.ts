import type { WBSTask } from '@/lib/types'

interface ParsedPredecessor {
  wbsNo: string
  lagDays: number
}

// Parses predecessor strings like "1.1", "1.1+10", "1.1-5"
export function parsePredecessor(predStr: string | null): ParsedPredecessor | null {
  if (!predStr) return null
  const clean = predStr.trim().replace(/\s+/g, '')
  
  // Matches "wbsNo" followed optionally by "+/-" and a number
  const match = clean.match(/^([0-9.]+)(?:([+-])(\d+))?$/)
  if (!match) return null
  
  const wbsNo = match[1]
  const sign = match[2]
  const amount = match[3] ? parseInt(match[3], 10) : 0
  
  const lagDays = sign === '-' ? -amount : amount
  return { wbsNo, lagDays }
}

export interface ScheduledTask extends WBSTask {
  computedStartDate: string // ISO string YYYY-MM-DD
  computedEndDate: string
}

// Calculates dynamic start and end dates for all tasks based on WBS predecessors
export function computeTaskDates(tasks: WBSTask[], projectStartDateStr: string | null): ScheduledTask[] {
  const taskMap = new Map<string, WBSTask>()
  for (const t of tasks) {
    taskMap.set(t.wbs_no, t)
  }

  const computedCache = new Map<string, { start: Date; end: Date }>()
  const fallbackProjectStart = projectStartDateStr ? new Date(projectStartDateStr) : new Date()

  function getDates(wbsNo: string, visiting: Set<string>): { start: Date; end: Date } {
    if (computedCache.has(wbsNo)) {
      return computedCache.get(wbsNo)!
    }

    const task = taskMap.get(wbsNo)
    if (!task) {
      return { start: fallbackProjectStart, end: new Date(fallbackProjectStart.getTime() + 1 * 24 * 60 * 60 * 1000) }
    }

    // Circular dependency detection
    if (visiting.has(wbsNo)) {
      const baseStart = task.start_date ? new Date(task.start_date) : fallbackProjectStart
      return { start: baseStart, end: new Date(baseStart.getTime() + task.duration * 24 * 60 * 60 * 1000) }
    }

    visiting.add(wbsNo)

    const parsedPred = parsePredecessor(task.predecessors)
    let startDate: Date

    if (parsedPred && taskMap.has(parsedPred.wbsNo)) {
      // Recursively calculate predecessor dates
      const predDates = getDates(parsedPred.wbsNo, visiting)
      
      // Start date = Predecessor End Date + Lag/Lead
      const predFinish = predDates.end
      startDate = new Date(predFinish.getTime() + parsedPred.lagDays * 24 * 60 * 60 * 1000)
    } else {
      startDate = task.start_date ? new Date(task.start_date) : fallbackProjectStart
    }

    const durationDays = task.duration || 1
    const endDate = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000)

    visiting.delete(wbsNo)

    const result = { start: startDate, end: endDate }
    computedCache.set(wbsNo, result)
    return result
  }

  return tasks.map((t) => {
    const dates = getDates(t.wbs_no, new Set<string>())
    const computedStartDate = dates.start.toISOString().split('T')[0]
    const computedEndDate = dates.end.toISOString().split('T')[0]
    
    return {
      ...t,
      computedStartDate,
      computedEndDate,
    }
  })
}
