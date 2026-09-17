'use server'

import { supabase } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'
import type { ActionState } from '@/lib/types'
import { logActivity } from '@/lib/auditLogger'

const DEFAULT_WBS_TASKS = [
  { wbs_no: '1', name: 'งานเตรียมพื้นที่ รื้อถอน เสาเข็ม', duration: 10, predecessors: null },
  { wbs_no: '2', name: 'งานโครงสร้างฐานราก เสาตอม่อ และคานคอดิน', duration: 14, predecessors: '1' },
  { wbs_no: '3', name: 'งานโครงสร้าง คสล. ชั้น 1', duration: 14, predecessors: '2' },
  { wbs_no: '4', name: 'งานโครงสร้าง คสล. ชั้น 2', duration: 14, predecessors: '3' },
  { wbs_no: '5', name: 'งานโครงสร้างหลังคา และมุงหลังคา', duration: 14, predecessors: '4' },
  { wbs_no: '6', name: 'งานก่ออิฐ กรีดผนังฝังท่อร้อยสาย และจับเซี้ยมฉาบปูน', duration: 14, predecessors: '5' },
  { wbs_no: '7', name: 'งานระบบท่อเมนและสุขาภิบาล (ถังบำบัด/บ่อพัก/ท่อระบายน้ำ)', duration: 10, predecessors: '6' },
  { wbs_no: '8', name: 'งานผิวพื้น ปรับระดับ และปูกระเบื้อง', duration: 14, predecessors: '7' },
  { wbs_no: '9', name: 'งานฝ้าเพดาน และงานระบบร้อยสายบนฝ้า', duration: 10, predecessors: '8' },
  { wbs_no: '10', name: 'งานติดตั้งประตู หน้าต่าง ราวบันได และอุปกรณ์ประกอบ', duration: 10, predecessors: '9' },
  { wbs_no: '11', name: 'งานติดตั้งสุขภัณฑ์ ดวงโคม ตู้ระบบ ทาสี และเก็บความเรียบร้อย', duration: 14, predecessors: '10' }
]

/* ── Create project ── */
export async function createProject(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const name       = (formData.get('name') as string)?.trim()
  const supervisor = (formData.get('supervisor') as string)?.trim()

  if (!name || !supervisor) {
    return { error: 'กรุณากรอกชื่อโครงการและชื่อผู้ควบคุมงาน' }
  }

  const description = (formData.get('description') as string)?.trim() || null
  const location    = (formData.get('location') as string)?.trim()   || null
  const status      = (formData.get('status') as string)             || 'รอดำเนินการ'
  const budgetRaw   = formData.get('budget') as string
  const budget      = budgetRaw ? parseFloat(budgetRaw) : null
  const start_date  = (formData.get('start_date') as string)         || null
  const end_date    = (formData.get('end_date') as string)           || null
  const opening_prRaw = formData.get('opening_pr') as string
  const opening_pr    = opening_prRaw ? parseFloat(opening_prRaw) : 0
  const progressRaw = formData.get('progress') as string
  const progress    = progressRaw ? Math.max(0, Math.min(100, parseInt(progressRaw, 10))) : 0

  const inspection_committee = (formData.get('inspection_committee') as string)?.trim() || null
  const contractor           = (formData.get('contractor') as string)?.trim()           || null
  const contract_no          = (formData.get('contract_no') as string)?.trim()          || null
  const work_group           = (formData.get('work_group') as string)?.trim()           || null
  const line_token           = (formData.get('line_token') as string)?.trim()           || null
  const wbs_no               = (formData.get('wbs_no') as string)?.trim()               || null

  const insertPayload: Record<string, any> = {
    name,
    description,
    location,
    supervisor,
    status,
    budget:     budget && !isNaN(budget) ? budget : null,
    start_date: start_date || null,
    end_date:   end_date   || null,
    progress,
    inspection_committee,
    contractor,
    contract_no,
    work_group,
    wbs_no,
    opening_pr: opening_pr && !isNaN(opening_pr) ? opening_pr : 0,
  }

  if (line_token) {
    insertPayload.line_token = line_token
  }

  const { data: newProj, error } = await supabase
    .from('projects')
    .insert(insertPayload)
    .select('id, start_date')
    .single()

  if (error || !newProj) {
    return { error: `บันทึกไม่สำเร็จ: ${error?.message || 'ไม่สามารถรับข้อมูลโครงการที่สร้างใหม่'}` }
  }

  // Pre-populate default WBS tasks from system_settings (or fallback to DEFAULT_WBS_TASKS)
  let tasksToUse = DEFAULT_WBS_TASKS
  try {
    const { data: settingData } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'default_wbs_tasks')
      .maybeSingle()

    if (settingData?.value) {
      const parsed = JSON.parse(settingData.value)
      if (Array.isArray(parsed) && parsed.length > 0) {
        tasksToUse = parsed
      }
    }
  } catch (err) {
    console.error('Error loading default_wbs_tasks setting, falling back to default:', err)
  }

  const defaultTasksPayload = tasksToUse.map((t, idx) => ({
    project_id: newProj.id,
    wbs_no: t.wbs_no || String(idx + 1),
    name: t.name,
    cost: 0,
    start_date: newProj.start_date || new Date().toISOString().split('T')[0],
    duration: Number(t.duration) || 10,
    predecessors: t.predecessors !== undefined ? t.predecessors : (idx === 0 ? null : String(idx)),
    actual_progress: 0,
    is_milestone: false,
  }))

  const { error: tasksError } = await supabase
    .from('tasks')
    .insert(defaultTasksPayload)

  if (tasksError) {
    console.error('Error pre-populating WBS tasks:', tasksError)
  }

  logActivity({
    projectId: newProj.id,
    projectName: name,
    actionType: 'CREATE',
    entityType: 'project',
    entityId: newProj.id,
    entityTitle: `สร้างโครงการใหม่: ${name}`,
    details: { supervisor, status, budget, start_date, end_date },
  })

  revalidatePath('/projects')
  return { success: true }
}

/* ── Delete project ── */
export async function deleteProject(id: string): Promise<ActionState> {
  if (!id) return { error: 'ไม่พบ ID โครงการ' }

  const { error } = await supabase.from('projects').delete().eq('id', id)

  if (error) {
    return { error: `ลบโครงการไม่สำเร็จ: ${error.message}` }
  }

  logActivity({
    projectId: id,
    actionType: 'DELETE',
    entityType: 'project',
    entityId: id,
    entityTitle: `ลบโครงการ`,
  })

  revalidatePath('/projects')
  return { success: true }
}

/* ── Update project baseline / values ── */
export async function updateProjectBaseline(
  id: string,
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  if (!id) return { error: 'ไม่พบ ID โครงการ' }

  const name       = (formData.get('name') as string)?.trim()
  const supervisor = (formData.get('supervisor') as string)?.trim()

  if (!name || !supervisor) {
    return { error: 'กรุณากรอกชื่อโครงการและชื่อผู้ควบคุมงาน' }
  }

  const description = (formData.get('description') as string)?.trim() || null
  const location    = (formData.get('location') as string)?.trim()   || null
  const status      = (formData.get('status') as string)             || 'รอดำเนินการ'

  const budgetRaw          = formData.get('budget') as string
  const budget             = budgetRaw ? parseFloat(budgetRaw) : null
  const paidRaw            = formData.get('paid_amount') as string
  const paid_amount        = paidRaw ? parseFloat(paidRaw) : 0
  const penaltyRaw         = formData.get('penalty_rate') as string
  const penalty_rate       = penaltyRaw ? parseFloat(penaltyRaw) : 0
  
  const start_date         = (formData.get('start_date') as string) || null
  const end_date           = (formData.get('end_date') as string) || null
  const opening_prRaw      = formData.get('opening_pr') as string
  const opening_pr         = opening_prRaw ? parseFloat(opening_prRaw) : 0
  
  if (start_date && end_date && new Date(start_date) >= new Date(end_date)) {
    return { error: 'วันสิ้นสุดสัญญาต้องมาหลังวันเริ่มต้น' }
  }
  
  const progressRaw        = formData.get('progress') as string
  const progress           = progressRaw ? Math.max(0, Math.min(100, parseInt(progressRaw, 10))) : 0
  const plannedProgressRaw = formData.get('planned_progress') as string
  const planned_progress   = plannedProgressRaw ? Math.max(0, Math.min(100, parseInt(plannedProgressRaw, 10))) : 0

  const inspection_committee = (formData.get('inspection_committee') as string)?.trim() || null
  const contractor           = (formData.get('contractor') as string)?.trim()           || null
  const contract_no          = (formData.get('contract_no') as string)?.trim()          || null
  const work_group           = (formData.get('work_group') as string)?.trim()           || null
  const line_token           = (formData.get('line_token') as string)?.trim()           || null
  const wbs_no               = (formData.get('wbs_no') as string)?.trim()               || null

  const updatePayload: Record<string, any> = {
    name,
    supervisor,
    description,
    location,
    status,
    budget: budget && !isNaN(budget) ? budget : null,
    paid_amount: paid_amount && !isNaN(paid_amount) ? paid_amount : 0,
    penalty_rate: penalty_rate && !isNaN(penalty_rate) ? penalty_rate : 0,
    start_date: start_date || null,
    end_date: end_date || null,
    progress,
    planned_progress,
    inspection_committee,
    contractor,
    contract_no,
    work_group,
    wbs_no,
    opening_pr: opening_pr && !isNaN(opening_pr) ? opening_pr : 0,
  }

  if (line_token !== null) {
    updatePayload.line_token = line_token
  }

  const { error } = await supabase
    .from('projects')
    .update(updatePayload)
    .eq('id', id)

  if (error) {
    return { error: `แก้ไขข้อมูลโครงการไม่สำเร็จ: ${error.message}` }
  }

  logActivity({
    projectId: id,
    projectName: name,
    actionType: 'UPDATE',
    entityType: 'project',
    entityId: id,
    entityTitle: `แก้ไขข้อมูลโครงการ: ${name}`,
    details: { status, progress, planned_progress, budget },
  })

  // Trigger Red Flag threshold check asynchronously
  try {
    const { checkAndSendRedFlagAlert } = await import('@/lib/line')
    checkAndSendRedFlagAlert(id).catch(err => console.error('Error in checkAndSendRedFlagAlert background trigger:', err))
  } catch (err) {}

  revalidatePath('/projects')
  revalidatePath(`/projects/${id}`)
  return { success: true }
}
