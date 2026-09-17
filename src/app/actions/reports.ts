'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { v4 as uuidv4 } from 'uuid'
import type { InspectionStatus } from '@/lib/types'
import { getWeatherText } from '@/lib/weatherUtils'
import { logActivity } from '@/lib/auditLogger'

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
let supabaseUrl = rawUrl && (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) ? rawUrl : 'https://txexenqijhxtdrzgltsm.supabase.co'
if (supabaseUrl.startsWith('"') && supabaseUrl.endsWith('"')) supabaseUrl = supabaseUrl.slice(1, -1)
let supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
if (supabaseKey.startsWith('"') && supabaseKey.endsWith('"')) supabaseKey = supabaseKey.slice(1, -1)
const supabase = createClient(supabaseUrl, supabaseKey)

// ==========================================
// File Upload Helper
// ==========================================
export async function uploadReportPhoto(file: File): Promise<{ url?: string; error?: string }> {
  try {
    const fileExt = file.name.split('.').pop()
    const fileName = `${uuidv4()}.${fileExt}`
    const filePath = `${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('reports')
      .upload(filePath, file)

    if (uploadError) {
      return { error: uploadError.message }
    }

    const { data } = supabase.storage.from('reports').getPublicUrl(filePath)
    return { url: data.publicUrl }
  } catch (err: any) {
    return { error: err.message || 'Unknown error uploading file' }
  }
}

// ==========================================
// Inspections Actions
// ==========================================
export async function createInspection(projectId: string, formData: FormData, photoUrls: string[]) {
  const inspection_no = formData.get('inspection_no') as string
  const work_type = formData.get('work_type') as string
  const title = formData.get('title') as string
  const request_date = (formData.get('request_date') as string) || null
  const inspector = (formData.get('inspector') as string) || null
  const status = (formData.get('status') as InspectionStatus) || 'submitted'

  const { error } = await supabase.from('inspections').insert({
    project_id: projectId,
    inspection_no,
    work_type,
    title,
    request_date,
    inspector,
    status,
    photo_urls: photoUrls,
  })

  if (error) return { error: error.message }

  logActivity({
    projectId,
    actionType: 'CREATE',
    entityType: 'inspection',
    entityTitle: `สร้างใบแจ้งตรวจงาน ${inspection_no || ''}: ${title}`,
    details: { inspection_no, work_type, inspector, status },
  })

  revalidatePath(`/projects/${projectId}/reports`)
  return { success: true }
}

export async function updateInspection(id: string, projectId: string, formData: FormData, photoUrls: string[]) {
  const inspection_no = formData.get('inspection_no') as string
  const work_type = formData.get('work_type') as string
  const title = formData.get('title') as string
  const request_date = (formData.get('request_date') as string) || null
  const inspector = (formData.get('inspector') as string) || null
  const status = (formData.get('status') as InspectionStatus) || 'submitted'
  const note = (formData.get('note') as string) || null

  const { error } = await supabase
    .from('inspections')
    .update({
      inspection_no,
      work_type,
      title,
      request_date,
      inspector,
      status,
      note,
      photo_urls: photoUrls,
    })
    .eq('id', id)

  if (error) return { error: error.message }

  logActivity({
    projectId,
    actionType: 'UPDATE',
    entityType: 'inspection',
    entityId: id,
    entityTitle: `แก้ไขใบแจ้งตรวจงาน ${inspection_no || ''}: ${title} (สถานะ: ${status})`,
    details: { inspection_no, work_type, inspector, status },
  })

  revalidatePath(`/projects/${projectId}/reports`)
  return { success: true }
}

export async function deleteInspection(id: string, projectId: string) {
  const { error } = await supabase.from('inspections').delete().eq('id', id)
  if (error) return { error: error.message }

  logActivity({
    projectId,
    actionType: 'DELETE',
    entityType: 'inspection',
    entityId: id,
    entityTitle: `ลบใบแจ้งตรวจงาน`,
  })

  revalidatePath(`/projects/${projectId}/reports`)
  return { success: true }
}

export async function updateInspectionsOrder(projectId: string, updates: { id: string; sort_order: number }[]) {
  // Supabase doesn't have bulk update natively in a single query via JS SDK easily, 
  // so we update one by one for now (or could use an RPC).
  for (const item of updates) {
    await supabase.from('inspections').update({ sort_order: item.sort_order }).eq('id', item.id)
  }
  revalidatePath(`/projects/${projectId}/reports`)
  return { success: true }
}

import { computeTaskDates } from '@/lib/scheduler'

// ==========================================
// Daily Reports Actions
// ==========================================
export async function getDailyDefaults(projectId: string) {
  try {
    const { data, error } = await supabase
      .from('project_daily_defaults')
      .select('*')
      .eq('project_id', projectId)
      .single()
    if (error && error.code !== 'PGRST116') {
      return { error: error.message }
    }
    return { data: data || null }
  } catch (err: any) {
    return { error: err.message }
  }
}

export async function upsertDailyDefaults(projectId: string, payload: any) {
  try {
    const { error } = await supabase
      .from('project_daily_defaults')
      .upsert({
        project_id: projectId,
        latitude: payload.latitude,
        longitude: payload.longitude,
        location_name: payload.location_name,
        manpower_defaults: payload.manpower_defaults || [],
        machinery_defaults: payload.machinery_defaults || [],
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'project_id'
      })
    if (error) return { error: error.message }
    revalidatePath(`/projects/${projectId}/reports`)
    return { success: true }
  } catch (err: any) {
    return { error: err.message }
  }
}

export async function confirmDailyReport(id: string, projectId: string) {
  try {
    const { error } = await supabase
      .from('daily_reports')
      .update({ is_confirmed: true })
      .eq('id', id)
    if (error) return { error: error.message }
    await logActivity({
      projectId,
      actionType: 'CONFIRM',
      entityType: 'daily_report',
      entityId: id,
      entityTitle: `ยืนยันรายงานประจำวัน`,
    })
    revalidatePath(`/projects/${projectId}/reports`)
    return { success: true }
  } catch (err: any) {
    return { error: err.message }
  }
}

export async function backfillDailyReport(projectId: string, dateStr: string) {
  try {
    // 1. Check if report already exists for this date
    const { data: existing } = await supabase
      .from('daily_reports')
      .select('id')
      .eq('project_id', projectId)
      .eq('report_date', dateStr)
      .single()
    if (existing) {
      return { error: 'รายงานของวันนี้มีอยู่แล้วในระบบ' }
    }

    // 2. Fetch project
    const { data: project, error: projErr } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single()
    if (projErr || !project) {
      return { error: projErr?.message || 'ไม่พบโครงการ' }
    }

    // 3. Fetch daily defaults
    const { data: defaults } = await supabase
      .from('project_daily_defaults')
      .select('*')
      .eq('project_id', projectId)
      .single()

    // 4. Fetch weather info
    let temperature = 25
    let precipitation = 0
    let weatherCode = 0
    let weatherText = 'แดดจัด'

    if (defaults && defaults.latitude && defaults.longitude) {
      try {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const targetDate = new Date(dateStr)
        targetDate.setHours(0, 0, 0, 0)
        const diffDays = (today.getTime() - targetDate.getTime()) / (24 * 60 * 60 * 1000)
        const isArchive = diffDays > 5

        const endpoint = isArchive
          ? 'https://archive-api.open-meteo.com/v1/archive'
          : 'https://api.open-meteo.com/v1/forecast'

        const url = `${endpoint}?latitude=${defaults.latitude}&longitude=${defaults.longitude}&start_date=${dateStr}&end_date=${dateStr}&daily=precipitation_sum,weather_code,temperature_2m_max&timezone=Asia/Bangkok`

        const weatherRes = await fetch(url)
        if (weatherRes.ok) {
          const wData = await weatherRes.json()
          if (wData.daily && wData.daily.time && wData.daily.time.length > 0) {
            temperature = wData.daily.temperature_2m_max ? wData.daily.temperature_2m_max[0] : 25
            precipitation = wData.daily.precipitation_sum ? wData.daily.precipitation_sum[0] : 0
            weatherCode = wData.daily.weather_code ? wData.daily.weather_code[0] : 0

            weatherText = getWeatherText(precipitation, weatherCode)
          }
        }
      } catch (weatherErr) {
        console.error('Failed to fetch weather for backfill:', weatherErr)
      }
    }

    // 5. Fetch tasks and compute active WBS
    const planned = await getPlannedTasksForDate(projectId, dateStr)
    const workDoneText = planned.text || 'ไม่มีงานที่อยู่ระหว่างดำเนินการตามแผนในวันนี้'

    // 6. Insert new daily report
    const { error: insErr } = await supabase
      .from('daily_reports')
      .insert({
        project_id: projectId,
        report_date: dateStr,
        weather: weatherText,
        temperature,
        precipitation,
        weather_code: weatherCode,
        manpower: defaults?.manpower_defaults || [],
        machinery: defaults?.machinery_defaults || [],
        work_done: workDoneText,
        issues: '',
        photos: [],
        is_auto_generated: true,
        is_confirmed: false,
      })

    if (insErr) {
      return { error: `Failed to insert daily report: ${insErr.message}` }
    }

    revalidatePath(`/projects/${projectId}/reports`)
    return { success: true }
  } catch (error: any) {
    console.error('Backfill error:', error)
    return { error: error.message }
  }
}

// Compute active planned tasks for a given date from project WBS
export async function getPlannedTasksForDate(projectId: string, dateStr: string) {
  try {
    const { data: project } = await supabase
      .from('projects')
      .select('start_date')
      .eq('id', projectId)
      .single()

    if (!project || !project.start_date) {
      return { success: false, text: '', count: 0 }
    }

    const { data: dbTasks } = await supabase
      .from('tasks')
      .select('*')
      .eq('project_id', projectId)

    if (!dbTasks || dbTasks.length === 0) {
      return { success: true, text: 'ไม่มีรายการงาน WBS ในระบบ', count: 0 }
    }

    const sorted = [...dbTasks].sort((a, b) => {
      const aParts = (a.wbs_no || '').split('.').map(Number)
      const bParts = (b.wbs_no || '').split('.').map(Number)
      for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const aVal = aParts[i] || 0
        const bVal = bParts[i] || 0
        if (aVal !== bVal) return aVal - bVal
      }
      return 0
    })

    const scheduled = computeTaskDates(sorted, project.start_date)
    const targetDate = new Date(dateStr)
    targetDate.setHours(0, 0, 0, 0)
    const targetTime = targetDate.getTime()

    const activeTasks = scheduled.filter(t => {
      const tStart = new Date(t.computedStartDate)
      tStart.setHours(0, 0, 0, 0)
      const tEnd = new Date(t.computedEndDate)
      tEnd.setHours(23, 59, 59, 999)
      return tStart.getTime() <= targetTime && targetTime <= tEnd.getTime() && (t.actual_progress || 0) < 100
    })

    if (activeTasks.length > 0) {
      const text = 'งานดำเนินการตามแผน:\n' + activeTasks.map(t => `• [${t.wbs_no}] ${t.name} (${t.actual_progress || 0}% → รอ update)`).join('\n')
      return { success: true, text, count: activeTasks.length }
    } else {
      return { success: true, text: 'ไม่มีงานที่อยู่ระหว่างดำเนินการตามแผนในวันนี้', count: 0 }
    }
  } catch (err: any) {
    return { success: false, error: err.message, text: '', count: 0 }
  }
}

// Fast-create a daily report with default WBS tasks — used when user clicks a date
export async function createQuickDailyReport(projectId: string, dateStr: string) {
  try {
    // Check duplicate
    const { data: existing } = await supabase
      .from('daily_reports')
      .select('id')
      .eq('project_id', projectId)
      .eq('report_date', dateStr)
      .single()
    if (existing) return { error: 'รายงานของวันนี้มีอยู่แล้วในระบบ' }

    // Fetch defaults (fast)
    const { data: defaults } = await supabase
      .from('project_daily_defaults')
      .select('manpower_defaults, machinery_defaults')
      .eq('project_id', projectId)
      .single()

    // Compute planned tasks for this date as initial Work Done
    const planned = await getPlannedTasksForDate(projectId, dateStr)
    const initialWorkDone = planned.text || ''

    const { data: inserted, error: insErr } = await supabase
      .from('daily_reports')
      .insert({
        project_id: projectId,
        report_date: dateStr,
        weather: 'แดดจัด',
        temperature: 25,
        precipitation: 0,
        weather_code: 0,
        manpower: defaults?.manpower_defaults || [],
        machinery: defaults?.machinery_defaults || [],
        work_done: initialWorkDone,
        issues: '',
        photos: [],
        is_auto_generated: planned.count ? planned.count > 0 : false,
        is_confirmed: false,
      })
      .select('id')
      .single()

    if (insErr) return { error: insErr.message }

    await logActivity({
      projectId,
      actionType: 'CREATE',
      entityType: 'daily_report',
      entityId: inserted?.id,
      entityTitle: `สร้างรายงานประจำวันที่ ${dateStr}`,
      details: { autoWbs: (planned.count || 0) > 0 }
    })

    revalidatePath(`/projects/${projectId}/reports`)
    return { success: true, id: inserted?.id }
  } catch (err: any) {
    return { error: err.message }
  }
}

export async function createDailyReport(projectId: string, payload: any) {
  const { error } = await supabase.from('daily_reports').insert({
    project_id: projectId,
    report_date: payload.report_date,
    weather: payload.weather,
    temperature: payload.temperature,
    precipitation: payload.precipitation || 0,
    weather_code: payload.weather_code || 0,
    manpower: payload.manpower,
    machinery: payload.machinery,
    work_done: payload.work_done,
    issues: payload.issues,
    photos: payload.photos,
    is_auto_generated: payload.is_auto_generated || false,
    is_confirmed: payload.is_confirmed || false,
  })

  if (error) return { error: error.message }
  revalidatePath(`/projects/${projectId}/reports`)
  return { success: true }
}

export async function updateDailyReport(id: string, projectId: string, payload: any) {
  const { error } = await supabase
    .from('daily_reports')
    .update({
      report_date: payload.report_date,
      weather: payload.weather,
      temperature: payload.temperature,
      precipitation: payload.precipitation || 0,
      weather_code: payload.weather_code || 0,
      manpower: payload.manpower,
      machinery: payload.machinery,
      work_done: payload.work_done,
      issues: payload.issues,
      photos: payload.photos,
      is_auto_generated: payload.is_auto_generated || false,
      is_confirmed: payload.is_confirmed || false,
    })
    .eq('id', id)

  if (error) return { error: error.message }

  await logActivity({
    projectId,
    actionType: 'UPDATE',
    entityType: 'daily_report',
    entityId: id,
    entityTitle: `บันทึกรายงานประจำวันที่ ${payload.report_date}`,
  })

  revalidatePath(`/projects/${projectId}/reports`)
  return { success: true }
}

export async function deleteDailyReport(id: string, projectId: string) {
  const { error } = await supabase.from('daily_reports').delete().eq('id', id)
  if (error) return { error: error.message }

  await logActivity({
    projectId,
    actionType: 'DELETE',
    entityType: 'daily_report',
    entityId: id,
    entityTitle: `ลบรายงานประจำวัน`,
  })

  revalidatePath(`/projects/${projectId}/reports`)
  return { success: true }
}

export async function updateDailyReportsOrder(projectId: string, updates: { id: string; sort_order: number }[]) {
  for (const item of updates) {
    await supabase.from('daily_reports').update({ sort_order: item.sort_order }).eq('id', item.id)
  }
  revalidatePath(`/projects/${projectId}/reports`)
  return { success: true }
}

// ==========================================
// Weekly Reports Actions
// ==========================================
export async function createWeeklyReport(projectId: string, payload: any) {
  const { data, error } = await supabase
    .from('weekly_reports')
    .insert({
      project_id: projectId,
      date_range: payload.date_range,
      summary: payload.summary,
      delayed_tasks: payload.delayed_tasks,
      look_ahead: payload.look_ahead,
      snapshot: payload.snapshot,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  logActivity({
    projectId,
    actionType: 'CREATE',
    entityType: 'weekly_report',
    entityId: data?.id,
    entityTitle: `สร้างรายงานประจำสัปดาห์ ช่วงวันที่ ${payload.date_range || ''}`,
    details: { date_range: payload.date_range },
  })

  revalidatePath(`/projects/${projectId}/reports`)
  return { success: true, data }
}

export async function updateWeeklyReport(id: string, projectId: string, payload: any) {
  const { data, error } = await supabase
    .from('weekly_reports')
    .update({
      date_range: payload.date_range,
      summary: payload.summary,
      delayed_tasks: payload.delayed_tasks,
      look_ahead: payload.look_ahead,
      snapshot: payload.snapshot,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return { error: error.message }

  logActivity({
    projectId,
    actionType: 'UPDATE',
    entityType: 'weekly_report',
    entityId: id,
    entityTitle: `แก้ไขรายงานประจำสัปดาห์ ช่วงวันที่ ${payload.date_range || ''}`,
    details: { date_range: payload.date_range },
  })

  revalidatePath(`/projects/${projectId}/reports`)
  return { success: true, data }
}

export async function deleteWeeklyReport(id: string, projectId: string) {
  const { error } = await supabase.from('weekly_reports').delete().eq('id', id)
  if (error) return { error: error.message }

  logActivity({
    projectId,
    actionType: 'DELETE',
    entityType: 'weekly_report',
    entityId: id,
    entityTitle: `ลบรายงานประจำสัปดาห์`,
  })

  revalidatePath(`/projects/${projectId}/reports`)
  return { success: true }
}

export async function updateWeeklyReportsOrder(projectId: string, updates: { id: string; sort_order: number }[]) {
  for (const item of updates) {
    await supabase.from('weekly_reports').update({ sort_order: item.sort_order }).eq('id', item.id)
  }
  revalidatePath(`/projects/${projectId}/reports`)
  return { success: true }
}
