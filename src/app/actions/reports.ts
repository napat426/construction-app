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

// ==========================================
// Daily Reports Actions
// ==========================================
export async function createDailyReport(projectId: string, payload: any) {
  const { error } = await supabase.from('daily_reports').insert({
    project_id: projectId,
    report_date: payload.report_date,
    weather: payload.weather,
    temperature: payload.temperature,
    manpower: payload.manpower,
    machinery: payload.machinery,
    work_done: payload.work_done,
    issues: payload.issues,
    photos: payload.photos,
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
      manpower: payload.manpower,
      machinery: payload.machinery,
      work_done: payload.work_done,
      issues: payload.issues,
      photos: payload.photos,
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
