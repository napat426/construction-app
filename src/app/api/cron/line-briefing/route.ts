import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { sendLineMessage, formatMorningBriefingMessage } from '@/lib/line'
import { computeTaskDates } from '@/lib/scheduler'
import type { Project, WBSTask, ProjectMilestone, ContractAmendment } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  return handleCronJob()
}

export async function POST(request: Request) {
  return handleCronJob()
}

async function handleCronJob() {
  try {
    // 1. Fetch System Settings
    const { data: settingsData } = await supabase.from('system_settings').select('*')
    const settings: Record<string, string> = {}
    if (settingsData) {
      settingsData.forEach((s) => {
        settings[s.key] = s.value
      })
    }

    const cronEnabled = settings['line_cron_enabled'] !== 'false'
    if (!cronEnabled) {
      return NextResponse.json({ success: false, message: 'LINE Cron Briefing is disabled in System Settings' })
    }

    const globalToken = (settings['line_global_token'] || '').trim()

    // 2. Fetch Projects
    const { data: projData, error: projErr } = await supabase.from('projects').select('*').order('created_at', { ascending: false })
    if (projErr || !projData) {
      return NextResponse.json({ success: false, error: 'Failed to fetch projects' }, { status: 500 })
    }
    const projects = projData as (Project & { line_token?: string | null })[]

    // 3. Fetch WBS Tasks, Milestones, Daily Reports
    const [tasksRes, milestonesRes, dailyRes] = await Promise.all([
      supabase.from('tasks').select('*'),
      supabase.from('project_milestones').select('*'),
      supabase.from('daily_reports').select('*').order('created_at', { ascending: false }),
    ])

    const allTasks = (tasksRes.data as WBSTask[]) || []
    const allMilestones = (milestonesRes.data as ProjectMilestone[]) || []
    const allDailyReports = dailyRes.data || []

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://construction-app-dun.vercel.app'
    const todayDateOnly = new Date()
    todayDateOnly.setHours(0, 0, 0, 0)
    const dateStr = todayDateOnly.toLocaleDateString('th-TH', { dateStyle: 'medium' })

    let sentCount = 0
    const results: { projectId: string; projectName: string; success: boolean; error?: string }[] = []

    // 4. Process Each Active Project
    for (const p of projects) {
      if (p.status === 'ระงับ') continue

      const targetToken = (p.line_token || '').trim() || globalToken
      if (!targetToken) {
        results.push({ projectId: p.id, projectName: p.name, success: false, error: 'No LINE Token' })
        continue
      }

      const pTasks = allTasks.filter((t) => t.project_id === p.id)
      const pMilestones = allMilestones.filter((m) => m.project_id === p.id)
      const pDaily = allDailyReports.filter((d) => d.project_id === p.id)[0] // Latest daily report

      let pvCumulative = 0
      let evCumulative = p.progress || 0

      if (pTasks.length > 0) {
        const scheduledTasks = computeTaskDates(pTasks, p.start_date)
        const totalWeight = scheduledTasks.reduce((sum, t) => sum + (Number(t.cost) || 0), 0)

        if (totalWeight > 0) {
          let totalWeightedPlanned = 0
          let totalWeightedActual = 0

          for (const t of scheduledTasks) {
            const weight = (Number(t.cost) || 0) / totalWeight
            const tStart = new Date(t.computedStartDate)
            const tEnd = new Date(t.computedEndDate)
            tStart.setHours(0, 0, 0, 0)
            tEnd.setHours(0, 0, 0, 0)

            let plannedProgress = 0
            if (todayDateOnly >= tEnd) plannedProgress = 100
            else if (todayDateOnly < tStart) plannedProgress = 0
            else {
              const totalTaskTime = Math.max(1, (tEnd.getTime() - tStart.getTime()) / 86400000)
              const elapsedTaskTime = Math.max(0, (todayDateOnly.getTime() - tStart.getTime()) / 86400000)
              plannedProgress = (elapsedTaskTime / totalTaskTime) * 100
            }

            totalWeightedPlanned += weight * plannedProgress
            totalWeightedActual += weight * (t.actual_progress || 0)
          }

          pvCumulative = totalWeightedPlanned
          evCumulative = totalWeightedActual
        } else {
          let totalPlanned = 0
          let totalActual = 0
          for (const t of scheduledTasks) {
            const tStart = new Date(t.computedStartDate)
            const tEnd = new Date(t.computedEndDate)
            tStart.setHours(0, 0, 0, 0)
            tEnd.setHours(0, 0, 0, 0)

            let plannedProgress = 0
            if (todayDateOnly >= tEnd) plannedProgress = 100
            else if (todayDateOnly < tStart) plannedProgress = 0
            else {
              const totalTaskTime = Math.max(1, (tEnd.getTime() - tStart.getTime()) / 86400000)
              const elapsedTaskTime = Math.max(0, (todayDateOnly.getTime() - tStart.getTime()) / 86400000)
              plannedProgress = (elapsedTaskTime / totalTaskTime) * 100
            }

            totalPlanned += plannedProgress
            totalActual += t.actual_progress || 0
          }
          if (scheduledTasks.length > 0) {
            pvCumulative = totalPlanned / scheduledTasks.length
            evCumulative = totalActual / scheduledTasks.length
          }
        }
      } else if (p.start_date && p.end_date) {
        const start = new Date(p.start_date)
        const end = new Date(p.end_date)
        if (todayDateOnly >= end) pvCumulative = 100
        else if (todayDateOnly < start) pvCumulative = 0
        else {
          const totalTime = Math.max(1, (end.getTime() - start.getTime()) / 86400000)
          const elapsedTime = Math.max(0, (todayDateOnly.getTime() - start.getTime()) / 86400000)
          pvCumulative = (elapsedTime / totalTime) * 100
        }
      }

      const paidAmountSum = pMilestones.filter((m) => m.is_paid).reduce((sum, m) => sum + (Number(m.amount) || 0), 0)
      const acPercent = (paidAmountSum / (p.budget || 1)) * 100

      const SPI = pvCumulative > 0 ? evCumulative / pvCumulative : 1.0
      const CPI = acPercent > 0 ? evCumulative / acPercent : 1.0

      // Calculate Manpower & Weather from latest Daily Report
      let manpower = 0
      let weather = 'ไม่มีข้อมูล'
      if (pDaily) {
        if (pDaily.weather) weather = pDaily.weather
        if (pDaily.manpower && Array.isArray(pDaily.manpower)) {
          manpower = pDaily.manpower.reduce((sum: number, m: any) => sum + (Number(m.count) || 0), 0)
        }
      }

      const projectUrl = `${baseUrl}/projects/${p.id}`

      const message = formatMorningBriefingMessage({
        projectName: p.name,
        supervisor: p.supervisor || 'ไม่ระบุ',
        plannedProgress: pvCumulative,
        actualProgress: evCumulative,
        spi: SPI,
        cpi: CPI,
        manpower,
        weather,
        dateStr,
        projectUrl,
      })

      const res = await sendLineMessage(targetToken, message)
      if (res.success) {
        sentCount++
        results.push({ projectId: p.id, projectName: p.name, success: true })
      } else {
        results.push({ projectId: p.id, projectName: p.name, success: false, error: res.error })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Sent ${sentCount} LINE Morning Briefings`,
      totalProjects: projects.length,
      results,
    })
  } catch (err: any) {
    console.error('Error in LINE briefing cron route:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
