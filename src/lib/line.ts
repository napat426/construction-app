import { supabase } from '@/lib/supabase'
import { computeTaskDates } from '@/lib/scheduler'
import type { Project, WBSTask, ProjectMilestone, ContractAmendment, DailyReport } from '@/lib/types'

export interface LineSendResult {
  success: boolean
  error?: string
}

/**
 * Send message to LINE Notify or LINE Messaging API
 */
export async function sendLineMessage(token: string, message: string): Promise<LineSendResult> {
  if (!token || !token.trim()) {
    return { success: false, error: 'LINE Token is empty' }
  }

  const cleanToken = token.trim()

  // 1. Support LINE Messaging API Push Message (Format: CHANNEL_ACCESS_TOKEN|GROUP_ID)
  if (cleanToken.includes('|')) {
    const parts = cleanToken.split('|').map((s) => s.trim())
    const channelAccessToken = parts[0]
    const targetId = parts[1]

    if (channelAccessToken && targetId) {
      try {
        const response = await fetch('https://api.line.me/v2/bot/message/push', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${channelAccessToken}`,
          },
          body: JSON.stringify({
            to: targetId,
            messages: [{ type: 'text', text: message.trim() }],
          }),
        })

        if (response.ok) {
          return { success: true }
        }

        const resJson = await response.json().catch(() => ({}))
        return {
          success: false,
          error: resJson.message || resJson.details?.[0]?.message || `LINE Messaging API Error (HTTP ${response.status})`,
        }
      } catch (err: any) {
        console.error('Error sending LINE Messaging API push:', err)
        return { success: false, error: err.message || 'Messaging API Network error' }
      }
    }
  }

  // 2. If token is a single Channel Access Token (without '|'), try LINE Messaging API Broadcast
  try {
    const response = await fetch('https://api.line.me/v2/bot/message/broadcast', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cleanToken}`,
      },
      body: JSON.stringify({
        messages: [{ type: 'text', text: message.trim() }],
      }),
    })

    if (response.ok) {
      return { success: true }
    }

    const resJson = await response.json().catch(() => ({}))
    if (resJson.message) {
      return {
        success: false,
        error: `LINE Messaging API: ${resJson.message} ${resJson.details?.[0]?.message || ''}`,
      }
    }
  } catch (err: any) {
    console.error('LINE Broadcast API attempt failed:', err)
  }

  // 3. Fallback Legacy LINE Notify (catch network / DNS fetch errors safely)
  try {
    const response = await fetch('https://notify-api.line.me/api/notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Bearer ${cleanToken}`,
      },
      body: new URLSearchParams({ message }).toString(),
    })

    if (response.ok) {
      return { success: true }
    }

    const resJson = await response.json().catch(() => ({}))
    return {
      success: false,
      error: resJson.message || `HTTP ${response.status}: ${response.statusText}`,
    }
  } catch (err: any) {
    return {
      success: false,
      error: 'LINE Notify ยุติบริการแล้ว กรุณาใส่ Token ในรูปแบบ ChannelAccessToken|GroupId หรือใช้ ChannelAccessToken จาก LINE Developers',
    }
  }
}

export interface LineChannelTarget {
  id: string
  name: string
  token: string
  enabled: boolean
}

/**
 * Send message to all configured LINE Group channels
 */
export async function sendLineMessageToAllChannels(
  defaultToken: string,
  message: string,
  settings?: Record<string, string>
): Promise<{ success: boolean; sentCount: number; errors: string[] }> {
  let channels: LineChannelTarget[] = []

  if (settings && settings['line_channels']) {
    try {
      const parsed = JSON.parse(settings['line_channels'])
      if (Array.isArray(parsed) && parsed.length > 0) {
        channels = parsed.filter((c: LineChannelTarget) => c.enabled && c.token && c.token.trim())
      }
    } catch {}
  }

  if (channels.length === 0) {
    if (!defaultToken || !defaultToken.trim()) {
      return { success: false, sentCount: 0, errors: ['No LINE channels or token available'] }
    }
    const res = await sendLineMessage(defaultToken, message)
    return {
      success: res.success,
      sentCount: res.success ? 1 : 0,
      errors: res.error ? [res.error] : [],
    }
  }

  let sentCount = 0
  const errors: string[] = []

  await Promise.all(
    channels.map(async (ch) => {
      const res = await sendLineMessage(ch.token, message)
      if (res.success) {
        sentCount++
      } else {
        errors.push(`กลุ่ม "${ch.name}": ${res.error || 'Failed'}`)
      }
    })
  )

  return {
    success: sentCount > 0,
    sentCount,
    errors,
  }
}

/**
 * Format Morning Briefing Message
 */
export function formatMorningBriefingMessage(data: {
  projectName: string
  supervisor: string
  plannedProgress: number
  actualProgress: number
  spi: number
  cpi: number
  manpower: number
  weather: string
  dateStr: string
  projectUrl: string
}): string {
  const diff = data.actualProgress - data.plannedProgress
  let statusText = '🎯 ดำเนินการตรงตามแผนงาน'
  if (diff > 0.005) {
    statusText = `✅ เร็วกว่าแผนงาน ${diff.toFixed(1)}%`
  } else if (diff < -0.005) {
    statusText = `⚠️ ล่าช้ากว่าแผนงาน ${Math.abs(diff).toFixed(1)}%`
  }

  const spiText =
    data.spi >= 1.0
      ? 'เร็วกว่าแผน'
      : data.spi >= 0.9
      ? 'ล่าช้าเล็กน้อย'
      : 'วิกฤต'
  const cpiText =
    data.cpi >= 1.0
      ? 'อยู่ในงบประมาณ'
      : data.cpi >= 0.9
      ? 'เฝ้าระวัง'
      : 'งบประมาณเกินเกณฑ์'

  return `\n🌅 [Morning Briefing] สรุปความก้าวหน้าโครงการประจำวัน\n\n🏗️ โครงการ: ${data.projectName}\n👤 ผู้ควบคุมงาน: ${data.supervisor || 'ไม่ระบุ'}\n\n📊 ความก้าวหน้า (S-Curve):\n• แผนงาน (% Planned): ${data.plannedProgress.toFixed(1)}%\n• ผลงานจริง (% Actual): ${data.actualProgress.toFixed(1)}%\n• สถานะ: ${statusText}\n\n📈 ดัชนีประสิทธิภาพ EVM:\n• SPI (ดัชนีแผน): ${data.spi.toFixed(2)} (${spiText})\n• CPI (ดัชนีต้นทุน): ${data.cpi.toFixed(2)} (${cpiText})\n\n👷 ข้อมูลหน้างานล่าสุด (${data.dateStr}):\n• แรงงานรวม (Manpower): ${data.manpower} คน\n• สภาพอากาศ: ${data.weather}\n\n🔗 เปิดดูแดชบอร์ดโครงการบนเว็บ:\n${data.projectUrl}`
}

/**
 * Format Red Flag Alert Message
 */
export function formatRedFlagAlertMessage(data: {
  projectName: string
  supervisor: string
  reasons: string[]
  delayedTasks: string[]
  planningUrl: string
}): string {
  const reasonsFormatted = data.reasons.map((r, i) => `${i + 1}. ${r}`).join('\n')
  const delayedTasksFormatted =
    data.delayedTasks.length > 0
      ? data.delayedTasks.map((t) => `• ${t}`).join('\n')
      : '• ไม่มีรายการ WBS ระบุล่าช้าเฉพาะเจาะจง'

  return `\n🚨 [RED FLAG ALERT] ตรวจพบสถานะวิกฤต!\n\n🏗️ โครงการ: ${data.projectName}\n👤 ผู้ควบคุมงาน: ${data.supervisor || 'ไม่ระบุ'}\n\n⚠️ สาเหตุจุดวิกฤตที่พบ:\n${reasonsFormatted}\n\n📌 รายการงาน WBS ที่ล่าช้าสะสม:\n${delayedTasksFormatted}\n\n🔗 ตรวจสอบรายละเอียด Gantt Chart & EVM:\n${data.planningUrl}`
}

/**
 * Check threshold rules and send Red Flag alert if triggered
 * Ensures Spam Control: Only sends ONCE per day per project.
 */
export async function checkAndSendRedFlagAlert(projectId: string): Promise<{ alerted: boolean; reason?: string }> {
  try {
    // 1. Fetch System Settings
    const { data: settingsData } = await supabase.from('system_settings').select('*')
    const settings: Record<string, string> = {}
    if (settingsData) {
      settingsData.forEach((s) => {
        settings[s.key] = s.value
      })
    }

    const alertEnabled = settings['line_alert_enabled'] !== 'false'
    if (!alertEnabled) {
      return { alerted: false, reason: 'LINE Alert disabled in System Settings' }
    }

    const globalToken = settings['line_global_token'] || ''
    const spiThreshold = parseFloat(settings['line_alert_spi_threshold'] || '0.90')
    const cpiThreshold = parseFloat(settings['line_alert_cpi_threshold'] || '0.90')
    const diffThreshold = parseFloat(settings['line_alert_diff_threshold'] || '5')

    // Check configured weekly alert day
    const alertDay = settings['line_alert_day'] || 'Mon'
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const todayDayName = dayNames[new Date().getDay()]
    if (alertDay !== 'all' && alertDay !== todayDayName) {
      return { alerted: false, reason: `Today (${todayDayName}) is not the configured Red Zone alert day (${alertDay})` }
    }

    // 2. Fetch Project Data
    const { data: projData, error: projErr } = await supabase.from('projects').select('*').eq('id', projectId).single()
    if (projErr || !projData) {
      return { alerted: false, reason: 'Project not found' }
    }
    const project = projData as Project & { line_token?: string | null; last_red_flag_alert_date?: string | null }

    const targetToken = project.line_token?.trim() || globalToken.trim()
    if (!targetToken) {
      return { alerted: false, reason: 'No LINE Token available for project or global settings' }
    }

    // 3. Spam Control: Check if already alerted today (YYYY-MM-DD)
    const todayStr = new Date().toISOString().split('T')[0]
    if (project.last_red_flag_alert_date === todayStr) {
      return { alerted: false, reason: 'Already alerted today (Spam Prevention)' }
    }

    // 4. Fetch Tasks, Milestones, Amendments for EVM calculation
    const [tasksRes, milestonesRes, amendmentsRes] = await Promise.all([
      supabase.from('tasks').select('*').eq('project_id', projectId),
      supabase.from('project_milestones').select('*').eq('project_id', projectId),
      supabase.from('contract_amendments').select('*').eq('project_id', projectId),
    ])

    const tasks = (tasksRes.data as WBSTask[]) || []
    const milestones = (milestonesRes.data as ProjectMilestone[]) || []
    const amendments = (amendmentsRes.data as ContractAmendment[]) || []

    const todayDateOnly = new Date()
    todayDateOnly.setHours(0, 0, 0, 0)

    let pvCumulative = 0
    let evCumulative = project.progress || 0
    const delayedTasksList: string[] = []

    if (tasks.length > 0) {
      const scheduledTasks = computeTaskDates(tasks, project.start_date)
      const totalTaskWeight = scheduledTasks.reduce((sum, t) => sum + (Number(t.cost) || 0), 0)

      if (totalTaskWeight > 0) {
        let totalWeightedPlanned = 0
        let totalWeightedActual = 0

        for (const t of scheduledTasks) {
          const weight = (Number(t.cost) || 0) / totalTaskWeight
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

          if (plannedProgress - (t.actual_progress || 0) >= 5) {
            delayedTasksList.push(`${t.name} (แผน ${Math.round(plannedProgress)}% / ทำได้ ${t.actual_progress || 0}%)`)
          }
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

          if (plannedProgress - (t.actual_progress || 0) >= 5) {
            delayedTasksList.push(`${t.name} (แผน ${Math.round(plannedProgress)}% / ทำได้ ${t.actual_progress || 0}%)`)
          }
        }
        if (scheduledTasks.length > 0) {
          pvCumulative = totalPlanned / scheduledTasks.length
          evCumulative = totalActual / scheduledTasks.length
        }
      }
    } else if (project.start_date && project.end_date) {
      // Fallback using project dates
      const start = new Date(project.start_date)
      const end = new Date(project.end_date)
      if (todayDateOnly >= end) pvCumulative = 100
      else if (todayDateOnly < start) pvCumulative = 0
      else {
        const totalTime = Math.max(1, (end.getTime() - start.getTime()) / 86400000)
        const elapsedTime = Math.max(0, (todayDateOnly.getTime() - start.getTime()) / 86400000)
        pvCumulative = (elapsedTime / totalTime) * 100
      }
    }

    const paidAmountSum = milestones.filter((m) => m.is_paid).reduce((sum, m) => sum + (Number(m.amount) || 0), 0)
    const acPercent = (paidAmountSum / (project.budget || 1)) * 100

    const SPI = pvCumulative > 0 ? evCumulative / pvCumulative : 1.0
    const CPI = acPercent > 0 ? evCumulative / acPercent : 1.0
    const lagDiff = pvCumulative - evCumulative

    // 5. Evaluate Red Flag Reasons
    const reasons: string[] = []
    if (SPI < spiThreshold) {
      reasons.push(`ค่า SPI เท่ากับ ${SPI.toFixed(2)} (ต่ำกว่าเกณฑ์วิกฤต ${spiThreshold.toFixed(2)})`)
    }
    if (CPI < cpiThreshold && acPercent > 0) {
      reasons.push(`ค่า CPI เท่ากับ ${CPI.toFixed(2)} (เกินงบประมาณวิกฤต ${cpiThreshold.toFixed(2)})`)
    }
    if (lagDiff > diffThreshold) {
      reasons.push(`ผลงานจริง (${evCumulative.toFixed(1)}%) ล่าช้ากว่าแผนสะสม (${pvCumulative.toFixed(1)}%) เกิน ${diffThreshold}% (ต่างกัน ${lagDiff.toFixed(1)}%)`)
    }

    if (reasons.length === 0) {
      return { alerted: false, reason: 'Project status is healthy (No thresholds breached)' }
    }

    // 6. Format and Send Red Flag Alert
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://construction-app-dun.vercel.app'
    const planningUrl = `${baseUrl}/projects/${project.id}/planning`

    const message = formatRedFlagAlertMessage({
      projectName: project.name,
      supervisor: project.supervisor || 'ไม่ระบุ',
      reasons,
      delayedTasks: delayedTasksList.slice(0, 3), // Top 3 delayed tasks
      planningUrl,
    })

    const sendRes = await sendLineMessageToAllChannels(targetToken, message, settings)
    if (sendRes.success) {
      // Update last_red_flag_alert_date in database
      try {
        await supabase.from('projects').update({ last_red_flag_alert_date: todayStr }).eq('id', project.id)
      } catch {}
      return { alerted: true }
    } else {
      return { alerted: false, reason: sendRes.errors.join('; ') || 'Failed to send alert' }
    }
  } catch (err: any) {
    console.error('Error in checkAndSendRedFlagAlert:', err)
    return { alerted: false, reason: err.message }
  }
}
