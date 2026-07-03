'use server'

import { supabase } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'
import { v4 as uuidv4 } from 'uuid'
import type { InspectionStatus } from '@/lib/types'

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
  revalidatePath(`/projects/${projectId}/reports`)
  return { success: true }
}

export async function deleteInspection(id: string, projectId: string) {
  const { error } = await supabase.from('inspections').delete().eq('id', id)
  if (error) return { error: error.message }
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

            const code = weatherCode
            if (code === 0 || code === 1) {
              weatherText = 'แดดจัด'
            } else if (code === 2 || code === 3) {
              weatherText = 'ครึ้มฟ้าครึ้มฝน'
            } else if (code >= 51 && code <= 57) {
              weatherText = 'ฝนตกเล็กน้อย'
            } else if (code >= 61 && code <= 65) {
              weatherText = 'ฝนตกปานกลาง'
            } else if (code >= 71 && code <= 77) {
              weatherText = 'ฝนตกหนัก'
            } else if (code >= 80 && code <= 82) {
              weatherText = 'ฝนตกทั้งวัน (หยุดงาน)'
            }
          }
        }
      } catch (weatherErr) {
        console.error('Failed to fetch weather for backfill:', weatherErr)
      }
    }

    // 5. Fetch tasks and compute active WBS
    const { data: dbTasks } = await supabase
      .from('tasks')
      .select('*')
      .eq('project_id', projectId)

    let workDoneText = ''
    if (dbTasks && dbTasks.length > 0 && project.start_date) {
      const sorted = [...dbTasks].sort((a, b) => {
        const aParts = a.wbs_no.split('.').map(Number)
        const bParts = b.wbs_no.split('.').map(Number)
        for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
          const aVal = aParts[i] || 0
          const bVal = bParts[i] || 0
          if (aVal !== bVal) return aVal - bVal
        }
        return 0
      })
      const scheduled = computeTaskDates(sorted, project.start_date)
      const targetTime = new Date(dateStr).getTime()

      const activeTasks = scheduled.filter(t => {
        const tStart = new Date(t.computedStartDate).getTime()
        const tEnd = new Date(t.computedEndDate).getTime()
        return tStart <= targetTime && targetTime <= tEnd && (t.actual_progress || 0) < 100
      })

      if (activeTasks.length > 0) {
        workDoneText = 'งานดำเนินการตามแผน:\n' + activeTasks.map(t => `• [${t.wbs_no}] ${t.name} (${t.actual_progress || 0}% → รอ update)`).join('\n')
      } else {
        workDoneText = 'ไม่มีงานที่อยู่ระหว่างดำเนินการตามแผนในวันนี้'
      }
    }

    // 6. Insert new report
    const { error: insErr } = await supabase.from('daily_reports').insert({
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

    if (insErr) return { error: insErr.message }
    revalidatePath(`/projects/${projectId}/reports`)
    return { success: true }
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
  revalidatePath(`/projects/${projectId}/reports`)
  return { success: true }
}

export async function deleteDailyReport(id: string, projectId: string) {
  const { error } = await supabase.from('daily_reports').delete().eq('id', id)
  if (error) return { error: error.message }
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
  const { error } = await supabase.from('weekly_reports').insert({
    project_id: projectId,
    date_range: payload.date_range,
    summary: payload.summary,
    delayed_tasks: payload.delayed_tasks,
    look_ahead: payload.look_ahead,
    snapshot: payload.snapshot,
  })

  if (error) return { error: error.message }
  revalidatePath(`/projects/${projectId}/reports`)
  return { success: true }
}

export async function updateWeeklyReport(id: string, projectId: string, payload: any) {
  const { error } = await supabase
    .from('weekly_reports')
    .update({
      date_range: payload.date_range,
      summary: payload.summary,
      delayed_tasks: payload.delayed_tasks,
      look_ahead: payload.look_ahead,
      snapshot: payload.snapshot,
    })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath(`/projects/${projectId}/reports`)
  return { success: true }
}

export async function deleteWeeklyReport(id: string, projectId: string) {
  const { error } = await supabase.from('weekly_reports').delete().eq('id', id)
  if (error) return { error: error.message }
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
