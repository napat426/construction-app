'use server'

import { supabase } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'
import type { ActionState } from '@/lib/types'

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
  const progressRaw = formData.get('progress') as string
  const progress    = progressRaw ? Math.max(0, Math.min(100, parseInt(progressRaw, 10))) : 0

  const inspection_committee = (formData.get('inspection_committee') as string)?.trim() || null
  const contractor           = (formData.get('contractor') as string)?.trim()           || null
  const contract_no          = (formData.get('contract_no') as string)?.trim()          || null

  const { error } = await supabase.from('projects').insert({
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
  })

  if (error) {
    return { error: `บันทึกไม่สำเร็จ: ${error.message}` }
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

  const { error } = await supabase
    .from('projects')
    .update({
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
    })
    .eq('id', id)

  if (error) {
    return { error: `แก้ไขข้อมูลโครงการไม่สำเร็จ: ${error.message}` }
  }

  revalidatePath('/projects')
  revalidatePath(`/projects/${id}`)
  return { success: true }
}
