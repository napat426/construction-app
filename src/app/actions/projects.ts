'use server'

import { supabase } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'
import type { ActionState } from '@/lib/types'

const DEFAULT_WBS_TASKS = [
  { wbs_no: '1', name: 'งานเตรียมพื้นที่และวางผังอาคาร', duration: 5, predecessors: null },
  { wbs_no: '2', name: 'งานตอกเสาเข็ม / เจาะเสาเข็ม', duration: 7, predecessors: '1' },
  { wbs_no: '3', name: 'งานขุดดินเปิดหน้าดิน และตัดหัวเสาเข็ม', duration: 5, predecessors: '2' },
  { wbs_no: '4', name: 'งานเทลีน เข้าแบบ ผูกเหล็ก และเทคอนกรีตฐานราก (Footing)', duration: 7, predecessors: '3' },
  { wbs_no: '5', name: 'งานเข้าแบบ ผูกเหล็ก และเทคอนกรีตเสาตอม่อ', duration: 5, predecessors: '4' },
  { wbs_no: '6', name: 'งานเข้าแบบ ผูกเหล็ก และเทคอนกรีตคานคอดิน (คานชั้น 1)', duration: 8, predecessors: '5' },
  { wbs_no: '7', name: 'งานวางระบบท่อสุขาภิบาลใต้พื้น และเทคอนกรีตพื้นชั้น 1', duration: 7, predecessors: '6' },
  { wbs_no: '8', name: 'งานเข้าแบบ ผูกเหล็ก และเทคอนกรีตเสาชั้น 1', duration: 6, predecessors: '7' },
  { wbs_no: '9', name: 'งานค้ำยัน เข้าแบบ ผูกเหล็ก และเทคอนกรีตคานชั้น 2', duration: 8, predecessors: '8' },
  { wbs_no: '10', name: 'งานวางแผ่นพื้นสำเร็จรูป / หล่อพื้น คสล. ชั้น 2', duration: 7, predecessors: '9' },
  { wbs_no: '11', name: 'งานเข้าแบบ ผูกเหล็ก และเทคอนกรีตเสาชั้น 2', duration: 6, predecessors: '10' },
  { wbs_no: '12', name: 'งานเข้าแบบ ผูกเหล็ก และเทคอนกรีตคานรับหลังคา (คานรัดหัวเสา)', duration: 7, predecessors: '11' },
  { wbs_no: '13', name: 'งานติดตั้งโครงสร้างหลังคาเหล็ก มุงแผ่นหลังคา และเชิงชาย', duration: 10, predecessors: '12' },
  { wbs_no: '14', name: 'งานติดตั้งวงกบ และก่ออิฐผนังทั้งหมด (ชั้น 1 และ ชั้น 2)', duration: 12, predecessors: '13' },
  { wbs_no: '15', name: 'งานกรีดผนังฝังท่อร้อยสายไฟ ท่อน้ำดี ท่อน้ำทิ้ง และท่อน้ำยาแอร์', duration: 9, predecessors: '14' },
  { wbs_no: '16', name: 'งานจับเซี้ยม และฉาบปูนผนังทั้งหมด (ภายในและภายนอกอาคาร)', duration: 14, predecessors: '15' },
  { wbs_no: '17', name: 'งานติดตั้งโครงคร่าวและแผ่นฝ้าเพดาน (ภายในและภายนอก)', duration: 9, predecessors: '16' },
  { wbs_no: '18', name: 'งานระบบกันซึม และงานปูกระเบื้องทั้งหมด (พื้นห้องโถง ผนัง/พื้นห้องน้ำ ระเบียง)', duration: 12, predecessors: '17' },
  { wbs_no: '19', name: 'งานติดตั้งบานประตู หน้าต่าง กระจก ราวบันได และอุปกรณ์สุขภัณฑ์', duration: 10, predecessors: '18' },
  { wbs_no: '20', name: 'งานทาสีรองพื้นและทาสีจริงทั้งหมด (ภายในและภายนอกอาคาร)', duration: 10, predecessors: '19' },
  { wbs_no: '21', name: 'งานดึงสายไฟ ติดตั้งดวงโคม สวิตช์ ปลั๊ก ตู้ไฟ MDB และติดตั้งแอร์', duration: 9, predecessors: '20' },
  { wbs_no: '22', name: 'งานปรับภูมิทัศน์ วางท่อระบายน้ำรอบบ้าน และเทพื้นลานคอนกรีต', duration: 8, predecessors: '21' },
  { wbs_no: '23', name: 'งานเก็บความเรียบร้อย (Defect Touch-up), ทำความสะอาด และส่งมอบ', duration: 7, predecessors: '22' }
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

  // Pre-populate default WBS tasks
  const defaultTasksPayload = DEFAULT_WBS_TASKS.map(t => ({
    project_id: newProj.id,
    wbs_no: t.wbs_no,
    name: t.name,
    cost: 0,
    start_date: newProj.start_date || new Date().toISOString().split('T')[0],
    duration: t.duration,
    predecessors: t.predecessors,
    actual_progress: 0,
    is_milestone: false,
  }))

  const { error: tasksError } = await supabase
    .from('tasks')
    .insert(defaultTasksPayload)

  if (tasksError) {
    console.error('Error pre-populating WBS tasks:', tasksError)
  }

  revalidatePath('/projects')
  return { success: true }
}

/* ── Delete project ── */
export async function deleteProject(id: string): Promise<ActionState> {
  if (!id) return { error: 'ไม่พบ ID โครงการ' }

  const { error } = await supabase.from('projects').delete().eq('id', id)

  if (error) {
    return { error: `ลบไม่สำเร็จ: ${error.message}` }
  }

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

  // Trigger Red Flag threshold check asynchronously
  try {
    const { checkAndSendRedFlagAlert } = await import('@/lib/line')
    checkAndSendRedFlagAlert(id).catch(err => console.error('Error in checkAndSendRedFlagAlert background trigger:', err))
  } catch (err) {}

  revalidatePath('/projects')
  revalidatePath(`/projects/${id}`)
  return { success: true }
}
