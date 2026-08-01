import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { sendLineMessage, formatMorningBriefingMessage, type LineChannelTarget } from '@/lib/line'
import { computeTaskDates } from '@/lib/scheduler'
import type { Project, WBSTask, ProjectMilestone } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { channelId, mode } = body // mode: 'test' | 'send_now'

    if (!channelId) {
      return NextResponse.json({ success: false, error: 'ไม่พบคีย์กลุ่มที่ระบุ' }, { status: 400 })
    }

    // 1. Fetch system settings to locate line_channels
    const { data: settingsData } = await supabase.from('system_settings').select('*')
    const settings: Record<string, string> = {}
    if (settingsData) {
      settingsData.forEach((s) => {
        settings[s.key] = s.value
      })
    }

    let channels: LineChannelTarget[] = []
    if (settings['line_channels']) {
      try {
        const parsed = JSON.parse(settings['line_channels'])
        if (Array.isArray(parsed)) channels = parsed
      } catch {}
    }

    const channel = channels.find((c) => c.id === channelId)
    if (!channel) {
      return NextResponse.json({ success: false, error: 'ไม่พบกลุ่มแจ้งเตือนนี้ในระบบ' }, { status: 404 })
    }

    if (!channel.token || !channel.token.trim()) {
      return NextResponse.json({ success: false, error: 'กลุ่มนี้ยังไม่ได้ตั้งค่า LINE Token' }, { status: 400 })
    }

    const todayDateOnly = new Date()
    todayDateOnly.setHours(0, 0, 0, 0)
    const dateStr = todayDateOnly.toLocaleDateString('th-TH', { dateStyle: 'medium' })
    const timeStr = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })

    // ── MODE 1: Ping Connection Test (ปุ่ม 1: ทดสอบการเชื่อมต่อ) ──
    if (mode === 'test') {
      const pingMsg = `📡 [ทดสอบการเชื่อมต่อกลุ่ม LINE]\n\nกลุ่ม: ${channel.name}\nสถานะ: เชื่อมต่อสำเร็จ! ✅\n\n📅 วันที่ทดสอบ: ${dateStr}\n⏰ เวลา: ${timeStr}\n\n(กลุ่มนี้พร้อมรับการแจ้งเตือนจากระบบเรียบร้อยแล้ว)`
      const sendRes = await sendLineMessage(channel.token, pingMsg)

      if (sendRes.success) {
        return NextResponse.json({
          success: true,
          message: `ส่งข้อความทดสอบการเชื่อมต่อเข้ากลุ่ม "${channel.name}" เรียบร้อยแล้ว!`,
        })
      } else {
        return NextResponse.json({
          success: false,
          error: `ส่งข้อความไม่สำเร็จ: ${sendRes.error || 'กรุณาตรวจสอบ Token'}`,
        })
      }
    }

    // ── MODE 2: Manual Send Now (ปุ่ม 2: ส่งสรุปตอนนี้เลย) ──
    if (mode === 'send_now') {
      // Fetch projects
      const { data: projData, error: projErr } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false })

      if (projErr || !projData) {
        return NextResponse.json({ success: false, error: 'ไม่สามารถโหลดข้อมูลโครงการได้' }, { status: 500 })
      }

      const allProjects = projData as Project[]
      // Filter out completed projects
      const nonCompletedProjects = allProjects.filter((p) => p.status !== 'เสร็จสิ้น')

      // Filter by channel's project_ids if specified
      let targetProjects = nonCompletedProjects
      if (channel.project_ids && Array.isArray(channel.project_ids) && channel.project_ids.length > 0) {
        targetProjects = nonCompletedProjects.filter((p) => channel.project_ids!.includes(p.id))
      }

      if (targetProjects.length === 0) {
        return NextResponse.json({
          success: false,
          error: `ไม่มีโครงการที่เปิดใช้งานสำหรับกลุ่ม "${channel.name}" (กรุณาเลือกโครงการในการตั้งค่ากลุ่ม)`,
        })
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

      let sentCount = 0
      const errors: string[] = []

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

        const res = await sendLineMessage(channel.token, message)
        if (res.success) {
          sentCount++
        } else {
          errors.push(`โครงการ ${p.name}: ${res.error || 'Failed'}`)
        }
      }

      if (sentCount > 0) {
        return NextResponse.json({
          success: true,
          message: `ส่งรายงานสรุปเข้ากลุ่ม "${channel.name}" สำเร็จ! (${sentCount} โครงการ)`,
          sentCount,
        })
      } else {
        return NextResponse.json({
          success: false,
          error: errors.join('; ') || 'ไม่สามารถส่งข้อความได้',
        })
      }
    }

    return NextResponse.json({ success: false, error: 'โหมดคำสั่งไม่ถูกต้อง' }, { status: 400 })
  } catch (err: any) {
    console.error('Error in line-channel dispatch route:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
