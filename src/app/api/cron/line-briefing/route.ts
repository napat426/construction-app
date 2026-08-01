import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { sendLineMessage, formatMorningBriefingMessage, type LineChannelTarget } from '@/lib/line'
import { computeTaskDates } from '@/lib/scheduler'
import type { Project, WBSTask, ProjectMilestone } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const isForce = url.searchParams.get('force') === 'true'
  return handleCronJob({ isTest: false, isForce })
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const token = body.token || null
    return handleCronJob({ isTest: true, overrideToken: token })
  } catch (e) {
    return handleCronJob({ isTest: true })
  }
}

function getBangkokCurrentTime() {
  const now = new Date()
  
  const dayName = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Bangkok', weekday: 'short' }).format(now)
  const hoursStr = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Bangkok', hour: 'numeric', hour12: false }).format(now)
  const minutesStr = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Bangkok', minute: 'numeric' }).format(now)

  const hours = parseInt(hoursStr, 10) % 24
  const minutes = parseInt(minutesStr, 10)
  const currentTotalMinutes = hours * 60 + minutes

  return { dayName, hours, minutes, currentTotalMinutes }
}

function isSlotMatching(
  slot: { day: string; time: string },
  currentDayName: string,
  currentTotalMinutes: number,
  isForce: boolean
): boolean {
  if (isForce) return true

  const dayMatch = slot.day === 'All' || slot.day === 'all' || slot.day === currentDayName
  if (!dayMatch) return false

  const [slotH, slotM] = (slot.time || '08:00').split(':').map(Number)
  const slotTotalMinutes = (slotH || 0) * 60 + (slotM || 0)

  // Allow a 25-minute window for Cron execution tolerances
  const diff = Math.abs(currentTotalMinutes - slotTotalMinutes)
  return diff <= 25
}

async function handleCronJob(options: { isTest?: boolean; overrideToken?: string | null; isForce?: boolean }) {
  try {
    const isTestMode = options.isTest === true
    const isForce = options.isForce === true
    const overrideToken = options.overrideToken || null

    // 1. Fetch System Settings
    const { data: settingsData } = await supabase.from('system_settings').select('*')
    const settings: Record<string, string> = {}
    if (settingsData) {
      settingsData.forEach((s) => {
        settings[s.key] = s.value
      })
    }

    let globalToken = (overrideToken || settings['line_global_token'] || '').trim()

    // If overrideToken provided, save it to DB
    if (overrideToken && overrideToken.trim()) {
      globalToken = overrideToken.trim()
      const { data: existing } = await supabase.from('system_settings').select('id').eq('key', 'line_global_token').single()
      if (existing) {
        await supabase.from('system_settings').update({ value: globalToken }).eq('key', 'line_global_token')
      } else {
        await supabase.from('system_settings').insert({ key: 'line_global_token', value: globalToken })
      }
    }

    // 2. Fetch Projects
    const { data: projData, error: projErr } = await supabase.from('projects').select('*').order('created_at', { ascending: false })
    if (projErr || !projData) {
      return NextResponse.json({ success: false, error: 'Failed to fetch projects' }, { status: 500 })
    }
    const projects = projData as Project[]
    const activeProjects = projects.filter((p) => p.status !== 'เสร็จสิ้น')

    const bkkTime = getBangkokCurrentTime()
    const todayDateOnly = new Date()
    todayDateOnly.setHours(0, 0, 0, 0)
    const dateStr = todayDateOnly.toLocaleDateString('th-TH', { dateStyle: 'medium' })

    // ── IF TEST MODE (กดปุ่มทดลองส่ง): ส่งข้อความทดสอบ ──
    if (isTestMode) {
      if (!globalToken) {
        return NextResponse.json({ success: false, error: 'กรุณากรอก LINE Token ก่อนกดทดลองส่ง' })
      }

      const testMsg = `📲 [ทดสอบระบบแจ้งเตือน LINE]\n\nเชื่อมต่อระบบควบคุมงานก่อสร้างกับ LINE Messaging API สำเร็จเรียบร้อยแล้ว!\n\n📊 ข้อมูลในระบบปัจจุบัน:\n• โครงการทั้งหมด: ${activeProjects.length} โครงการ\n📅 วันที่ทดสอบ: ${dateStr}\n⏰ เวลา (เวลาไทย ICT): ${bkkTime.hours.toString().padStart(2, '0')}:${bkkTime.minutes.toString().padStart(2, '0')} น.\n\n(ระบบจะส่งสรุป Morning Briefing ของทุกโครงการอัตโนมัติทุกเช้าตามเวลาที่ตั้งไว้)`
      const sendRes = await sendLineMessage(globalToken, testMsg)

      if (sendRes.success) {
        return NextResponse.json({
          success: true,
          message: `เชื่อมต่อสำเร็จ! ส่งข้อความทดสอบเข้า LINE เรียบร้อยแล้ว`,
        })
      } else {
        return NextResponse.json({
          success: false,
          error: sendRes.error || 'ไม่สามารถส่งข้อความได้ กรุณาตรวจสอบ Token',
        })
      }
    }

    // ── CRON MODE: Process channels in line_channels ──
    let lineChannels: LineChannelTarget[] = []
    if (settings['line_channels']) {
      try {
        const parsed = JSON.parse(settings['line_channels'])
        if (Array.isArray(parsed)) lineChannels = parsed
      } catch {}
    }

    // Fallback channel if line_channels is empty but globalToken exists
    if (lineChannels.length === 0 && globalToken) {
      lineChannels = [
        {
          id: 'global_fallback',
          name: 'กลุ่มหลัก',
          token: globalToken,
          enabled: settings['line_cron_enabled'] !== 'false',
          project_ids: 'all',
          cron_enabled: settings['line_cron_enabled'] !== 'false',
          cron_schedule: settings['line_cron_schedule'] ? JSON.parse(settings['line_cron_schedule']) : [{ day: 'Mon', time: '08:30' }],
        },
      ]
    }

    // Fetch WBS Tasks, Milestones, Daily Reports
    const [tasksRes, milestonesRes, dailyRes] = await Promise.all([
      supabase.from('tasks').select('*'),
      supabase.from('project_milestones').select('*'),
      supabase.from('daily_reports').select('*').order('created_at', { ascending: false }),
    ])

    const allTasks = (tasksRes.data as WBSTask[]) || []
    const allMilestones = (milestonesRes.data as ProjectMilestone[]) || []
    const allDailyReports = dailyRes.data || []
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://construction-app-dun.vercel.app'

    let totalDispatchesCount = 0
    const channelDispatchLog: { channelName: string; success: boolean; dispatchedProjects: number; error?: string }[] = []

    for (const ch of lineChannels) {
      if (!ch.enabled || !ch.token || !ch.token.trim()) continue

      // 1. Check Morning Briefing Schedule
      const cronSlots = ch.cron_schedule && ch.cron_schedule.length > 0
        ? ch.cron_schedule
        : [{ day: 'Mon', time: '08:30' }]
      const isCronEnabled = ch.cron_enabled !== false

      const isCronMatched = isCronEnabled && cronSlots.some((slot) =>
        isSlotMatching(slot, bkkTime.dayName, bkkTime.currentTotalMinutes, isForce)
      )

      // 2. Check Red Zone Alert Schedule
      const alertSlots = ch.alert_schedule && ch.alert_schedule.length > 0
        ? ch.alert_schedule
        : [{ day: ch.alert_day || 'Tue', time: ch.alert_time || '09:00' }]
      const isAlertEnabled = ch.alert_enabled !== false

      const isAlertMatched = isAlertEnabled && alertSlots.some((slot) =>
        isSlotMatching(slot, bkkTime.dayName, bkkTime.currentTotalMinutes, isForce)
      )

      // Skip if neither Morning Briefing nor Red Zone Alert matched this channel right now
      if (!isCronMatched && !isAlertMatched) continue

      // Filter target projects for this channel
      let targetProjects = activeProjects
      if (ch.project_ids && Array.isArray(ch.project_ids) && ch.project_ids.length > 0) {
        targetProjects = activeProjects.filter((p) => ch.project_ids!.includes(p.id))
      }

      if (targetProjects.length === 0) continue

      // Build & Send Morning Briefing for matched target projects
      for (const p of targetProjects) {
        const pTasks = allTasks.filter((t) => t.project_id === p.id)
        const pMilestones = allMilestones.filter((m) => m.project_id === p.id)
        const pDaily = allDailyReports.filter((d) => d.project_id === p.id)[0]

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

        const sendResult = await sendLineMessage(ch.token, message)
        if (sendResult.success) {
          totalDispatchesCount++
        }
      }

      channelDispatchLog.push({
        channelName: ch.name,
        success: true,
        dispatchedProjects: targetProjects.length,
      })
    }

    return NextResponse.json({
      success: true,
      message: `Checked Cron at Bangkok time (${bkkTime.dayName} ${bkkTime.hours}:${bkkTime.minutes}). Dispatched ${totalDispatchesCount} messages across channels.`,
      bangkokTime: `${bkkTime.dayName} ${bkkTime.hours.toString().padStart(2, '0')}:${bkkTime.minutes.toString().padStart(2, '0')} ICT`,
      totalDispatchesCount,
      channelDispatchLog,
    })
  } catch (err: any) {
    console.error('Error in LINE briefing cron route:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
