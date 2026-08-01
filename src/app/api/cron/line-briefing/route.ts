import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import {
  sendLineMessage,
  formatMorningBriefingMessage,
  checkAndSendRedFlagAlert,
  type LineChannelTarget,
} from '@/lib/line'
import { computeTaskDates } from '@/lib/scheduler'
import type { Project, WBSTask, ProjectMilestone } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

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

/**
 * Get the current time in Bangkok timezone accurately.
 * Returns dayName (e.g. "Sat"), hours (0-23), minutes (0-59),
 * and bangkokDateStr (e.g. "2026-08-01") for deduplication keys.
 */
function getBangkokCurrentTime() {
  const now = new Date()

  const dayName = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    weekday: 'short',
  }).format(now)

  const hoursStr = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    hour: 'numeric',
    hour12: false,
  }).format(now)

  const minutesStr = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    minute: 'numeric',
  }).format(now)

  const hours = parseInt(hoursStr, 10) % 24
  const minutes = parseInt(minutesStr, 10)

  // FIX: Use Bangkok date for dedup keys (not UTC date which drifts by 7 hours)
  // en-CA format gives "YYYY-MM-DD" without locale quirks
  const bangkokDateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
  }).format(now)

  // Bangkok date object (for message display)
  const bangkokDate = new Date(bangkokDateStr + 'T00:00:00+07:00')
  const dateStr = bangkokDate.toLocaleDateString('th-TH', { dateStyle: 'medium' })

  return { dayName, hours, minutes, bangkokDateStr, dateStr }
}

/**
 * Exact minute match: returns true ONLY when the slot's day+hour+minute match NOW exactly.
 * isForce=true bypasses time check (manual trigger).
 */
function isExactSlotMatching(
  slot: { day: string; time: string },
  currentDayName: string,
  currentHours: number,
  currentMinutes: number,
  isForce: boolean
): boolean {
  if (isForce) return true

  const sDay = (slot.day || '').toLowerCase()
  const cDay = (currentDayName || '').toLowerCase()
  const dayMatch = sDay === 'all' || sDay === cDay
  if (!dayMatch) return false

  const [slotH, slotM] = (slot.time || '08:00').split(':').map(Number)

  // Exact HH:MM match — only true when hour and minute both match exactly!
  return currentHours === (slotH || 0) && currentMinutes === (slotM || 0)
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

    // Emergency Master Check: Stop immediately if globally disabled!
    if (!isTestMode && !isForce && settings['line_cron_enabled'] === 'false') {
      return NextResponse.json({
        success: false,
        message: 'LINE Cron is globally disabled in System Settings.',
        sentCount: 0,
      })
    }

    let globalToken = (overrideToken || settings['line_global_token'] || '').trim()

    if (overrideToken && overrideToken.trim()) {
      globalToken = overrideToken.trim()
      // Use UPSERT to safely save token (atomic, no race condition)
      await supabase
        .from('system_settings')
        .upsert({ key: 'line_global_token', value: globalToken }, { onConflict: 'key' })
    }

    // 2. Fetch Projects
    const { data: projData, error: projErr } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false })
    if (projErr || !projData) {
      return NextResponse.json({ success: false, error: 'Failed to fetch projects' }, { status: 500 })
    }
    const projects = projData as Project[]
    const activeProjects = projects.filter((p) => p.status !== 'เสร็จสิ้น')

    // FIX: Always use Bangkok timezone for time and date
    const bkkTime = getBangkokCurrentTime()
    const { bangkokDateStr, dateStr } = bkkTime

    // Bangkok date object (midnight Bangkok) used for EVM calculations
    const todayDateOnly = new Date(bangkokDateStr + 'T00:00:00+07:00')

    // ── IF TEST MODE (กดปุ่มทดลองส่ง): ส่งข้อความทดสอบ ──
    if (isTestMode) {
      if (!globalToken) {
        return NextResponse.json({ success: false, error: 'กรุณากรอก LINE Token ก่อนกดทดลองส่ง' })
      }

      const testMsg = `📲 [ทดสอบระบบแจ้งเตือน LINE]\n\nเชื่อมต่อระบบควบคุมงานก่อสร้างกับ LINE Messaging API สำเร็จเรียบร้อยแล้ว!\n\n📊 ข้อมูลในระบบปัจจุบัน:\n• โครงการทั้งหมด: ${activeProjects.length} โครงการ\n📅 วันที่ทดสอบ: ${dateStr}\n⏰ เวลา (เวลาไทย ICT): ${bkkTime.hours.toString().padStart(2, '0')}:${bkkTime.minutes.toString().padStart(2, '0')} น.\n\n(ระบบจะส่งสรุป Morning Briefing ของทุกโครงการอัตโนมัติตามเวลาที่ตั้งไว้)`
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

    // FIX: Read last dispatched slots (with Bangkok date-based keys)
    let lastDispatchedSlots: string[] = []
    if (settings['last_cron_dispatched']) {
      try {
        const parsed = JSON.parse(settings['last_cron_dispatched'])
        if (Array.isArray(parsed)) lastDispatchedSlots = parsed
      } catch {}
    }

    // ── CRON MODE: Process channels in line_channels ──
    let lineChannels: LineChannelTarget[] = []
    if (settings['line_channels']) {
      try {
        const parsed = JSON.parse(settings['line_channels'])
        if (Array.isArray(parsed)) lineChannels = parsed
      } catch {}
    }

    if (lineChannels.length === 0 && globalToken) {
      lineChannels = [
        {
          id: 'global_fallback',
          name: 'กลุ่มหลัก',
          token: globalToken,
          enabled: settings['line_cron_enabled'] !== 'false',
          project_ids: 'all',
          cron_enabled: settings['line_cron_enabled'] !== 'false',
          cron_schedule: settings['line_cron_schedule']
            ? JSON.parse(settings['line_cron_schedule'])
            : [{ day: 'Mon', time: '08:30' }],
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
    const newlyDispatchedSlotKeys: string[] = []
    const channelDispatchLog: {
      channelName: string
      success: boolean
      dispatchedProjects: number
      skipped?: boolean
      error?: string
    }[] = []

    for (const ch of lineChannels) {
      if (!ch.enabled || !ch.token || !ch.token.trim()) continue

      const cronSlots =
        ch.cron_schedule && ch.cron_schedule.length > 0 ? ch.cron_schedule : [{ day: 'Mon', time: '08:30' }]
      const isCronEnabled = ch.cron_enabled !== false

      const matchedCronSlot = isCronEnabled
        ? cronSlots.find((slot) =>
            isExactSlotMatching(slot, bkkTime.dayName, bkkTime.hours, bkkTime.minutes, isForce)
          )
        : null

      const alertSlots =
        ch.alert_schedule && ch.alert_schedule.length > 0
          ? ch.alert_schedule
          : [{ day: ch.alert_day || 'Tue', time: ch.alert_time || '09:00' }]
      const isAlertEnabled = ch.alert_enabled !== false

      const matchedAlertSlot = isAlertEnabled
        ? alertSlots.find((slot) =>
            isExactSlotMatching(slot, bkkTime.dayName, bkkTime.hours, bkkTime.minutes, isForce)
          )
        : null

      if (!matchedCronSlot && !matchedAlertSlot) continue

      // FIX: Dedup key uses Bangkok date (not UTC date)
      const activeSlot = matchedCronSlot || matchedAlertSlot
      const slotKey = `${ch.id}-${activeSlot?.day}-${activeSlot?.time}-${bangkokDateStr}`

      if (!isForce && lastDispatchedSlots.includes(slotKey)) {
        console.log(`[LINE Cron] Slot ${slotKey} already dispatched today (Bangkok date). Skipping.`)
        channelDispatchLog.push({
          channelName: ch.name,
          success: true,
          dispatchedProjects: 0,
          skipped: true,
        })
        continue
      }

      let targetProjects = activeProjects
      if (ch.project_ids && Array.isArray(ch.project_ids) && ch.project_ids.length > 0) {
        targetProjects = activeProjects.filter((p) => (ch.project_ids as string[]).includes(p.id))
      }

      if (targetProjects.length === 0) {
        console.log(`[LINE Cron] Channel "${ch.name}": no target projects found. Skipping.`)
        continue
      }

      let channelSentCount = 0

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
            const scheduledTasks2 = computeTaskDates(pTasks, p.start_date)
            for (const t of scheduledTasks2) {
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
            if (scheduledTasks2.length > 0) {
              pvCumulative = totalPlanned / scheduledTasks2.length
              evCumulative = totalActual / scheduledTasks2.length
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
          channelSentCount++
        }
      }

      // Mark slot as dispatched BEFORE saving so we track it correctly
      newlyDispatchedSlotKeys.push(slotKey)
      channelDispatchLog.push({
        channelName: ch.name,
        success: channelSentCount > 0,
        dispatchedProjects: channelSentCount,
      })
    }

    // ── RED ZONE ALERT: Process alert_schedule for each channel ──────────────────
    // (Separate pass: alert schedule may differ from cron_schedule)
    let totalRedZoneAlerts = 0
    const redZoneLog: { channelName: string; projectName: string; alerted: boolean; reason?: string }[] = []

    for (const ch of lineChannels) {
      if (!ch.enabled || !ch.token || !ch.token.trim()) continue
      if (ch.alert_enabled === false) continue

      const alertSlots =
        ch.alert_schedule && ch.alert_schedule.length > 0
          ? ch.alert_schedule
          : [{ day: ch.alert_day || 'Mon', time: ch.alert_time || '08:30' }]

      const matchedAlert = alertSlots.find((slot) =>
        isExactSlotMatching(slot, bkkTime.dayName, bkkTime.hours, bkkTime.minutes, isForce)
      )
      if (!matchedAlert) continue

      // Dedup key for alert (separate from morning briefing key)
      const alertSlotKey = `alert-${ch.id}-${matchedAlert.day}-${matchedAlert.time}-${bangkokDateStr}`
      if (!isForce && lastDispatchedSlots.includes(alertSlotKey)) {
        console.log(`[Red Zone] Alert slot ${alertSlotKey} already dispatched today. Skipping.`)
        continue
      }

      // Determine target projects for this channel
      let alertTargetProjects = activeProjects
      if (ch.project_ids && Array.isArray(ch.project_ids) && ch.project_ids.length > 0) {
        alertTargetProjects = activeProjects.filter((p) => (ch.project_ids as string[]).includes(p.id))
      }

      if (alertTargetProjects.length === 0) continue

      // Run Red Zone check per project using this channel's thresholds and token
      for (const p of alertTargetProjects) {
        const result = await checkAndSendRedFlagAlert(p.id, {
          token: ch.token,
          spiThreshold: ch.alert_spi_threshold ?? 0.9,
          cpiThreshold: ch.alert_cpi_threshold ?? 0.9,
          diffThreshold: ch.alert_diff_threshold ?? 5,
        })
        redZoneLog.push({ channelName: ch.name, projectName: p.name, alerted: result.alerted, reason: result.reason })
        if (result.alerted) totalRedZoneAlerts++
      }

      // Mark alert slot as dispatched
      newlyDispatchedSlotKeys.push(alertSlotKey)
    }

    // FIX: Use atomic UPSERT to save dispatched slots (no race condition)
    // This replaces the old separate select+insert/update pattern
    if (newlyDispatchedSlotKeys.length > 0 && !isForce) {
      const updatedSlotsList = Array.from(new Set([...lastDispatchedSlots, ...newlyDispatchedSlotKeys])).slice(-200)
      const valStr = JSON.stringify(updatedSlotsList)
      await supabase
        .from('system_settings')
        .upsert({ key: 'last_cron_dispatched', value: valStr }, { onConflict: 'key' })
    }

    return NextResponse.json({
      success: true,
      version: 'v5.0-with-red-zone-alert',
      message: `Checked Cron at Bangkok time (${bkkTime.dayName} ${bkkTime.hours}:${bkkTime.minutes}). Briefings: ${totalDispatchesCount}, Red Zone alerts: ${totalRedZoneAlerts}.`,
      bangkokTime: `${bkkTime.dayName} ${bkkTime.hours.toString().padStart(2, '0')}:${bkkTime.minutes.toString().padStart(2, '0')} ICT`,
      bangkokDate: bangkokDateStr,
      totalDispatchesCount,
      totalRedZoneAlerts,
      channelDispatchLog,
      redZoneLog,
    })
  } catch (err: any) {
    console.error('Error in LINE briefing cron route:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
