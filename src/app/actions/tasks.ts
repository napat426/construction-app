'use server'

import { supabase } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'
import type { ActionState } from '@/lib/types'

// Helper function to recalculate project progress and update projects table
async function recalculateProjectProgress(projectId: string): Promise<void> {
  // Fetch all tasks for this project
  const { data: tasks, error: tasksError } = await supabase
    .from('tasks')
    .select('cost, actual_progress')
    .eq('project_id', projectId)

  if (tasksError || !tasks) {
    console.error('Error fetching tasks for recalculation:', tasksError)
    return
  }

  if (tasks.length === 0) {
    // If no tasks, set progress to 0
    await supabase.from('projects').update({ progress: 0 }).eq('id', projectId)
    return
  }

  const totalCost = tasks.reduce((sum, t) => sum + (Number(t.cost) || 0), 0)
  
  let overallProgress = 0
  if (totalCost > 0) {
    const totalWeightedProgress = tasks.reduce((sum, t) => {
      const cost = Number(t.cost) || 0
      const progress = Number(t.actual_progress) || 0
      return sum + (cost * progress)
    }, 0)
    overallProgress = Math.round(totalWeightedProgress / totalCost)
  } else {
    // If total cost is 0, average the progress of all tasks
    const sumProgress = tasks.reduce((sum, t) => sum + (Number(t.actual_progress) || 0), 0)
    overallProgress = Math.round(sumProgress / tasks.length)
  }

  // Update the projects table
  const { error: updateError } = await supabase
    .from('projects')
    .update({ progress: overallProgress })
    .eq('id', projectId)

  if (updateError) {
    console.error('Error updating project progress:', updateError)
  }
}

export async function createTask(
  projectId: string,
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  if (!projectId) return { error: 'ไม่พบ ID โครงการ' }

  const wbs_no = (formData.get('wbs_no') as string)?.trim()
  const name = (formData.get('name') as string)?.trim()
  if (!wbs_no || !name) {
    return { error: 'กรุณากรอกรหัส WBS และชื่อกิจกรรม' }
  }

  const costRaw = formData.get('cost') as string
  const cost = costRaw ? parseFloat(costRaw) : 0
  let start_date = formData.get('start_date') as string
  const predecessors = (formData.get('predecessors') as string)?.trim() || null
  
  if (!start_date) {
    if (!predecessors) {
      return { error: 'กรุณากรอกวันที่เริ่มงาน หรือระบุงานก่อนหน้า' }
    }
    // Fetch project's start date to use as default placeholder in DB
    const { data: proj } = await supabase.from('projects').select('start_date').eq('id', projectId).single()
    start_date = proj?.start_date || new Date().toISOString().split('T')[0]
  }

  const durationRaw = formData.get('duration') as string
  const duration = durationRaw ? parseInt(durationRaw, 10) : 1
  
  const progressRaw = formData.get('actual_progress') as string
  const actual_progress = progressRaw ? Math.max(0, Math.min(100, parseInt(progressRaw, 10))) : 0
  
  const is_milestone = formData.get('is_milestone') === 'true'

  const { error } = await supabase.from('tasks').insert({
    project_id: projectId,
    wbs_no,
    name,
    cost: isNaN(cost) ? 0 : cost,
    start_date,
    duration: isNaN(duration) ? 1 : duration,
    predecessors,
    actual_progress,
    is_milestone,
  })

  if (error) {
    return { error: `สร้างกิจกรรมย่อยไม่สำเร็จ: ${error.message}` }
  }

  await recalculateProjectProgress(projectId)
  revalidatePath(`/projects/${projectId}/planning`)
  revalidatePath(`/projects/${projectId}`)
  revalidatePath('/projects')
  return { success: true }
}

export async function updateTask(
  projectId: string,
  taskId: string,
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  if (!projectId || !taskId) return { error: 'ข้อมูลไม่ครบถ้วน' }

  const wbs_no = (formData.get('wbs_no') as string)?.trim()
  const name = (formData.get('name') as string)?.trim()
  if (!wbs_no || !name) {
    return { error: 'กรุณากรอกรหัส WBS และชื่อกิจกรรม' }
  }

  const costRaw = formData.get('cost') as string
  const cost = costRaw ? parseFloat(costRaw) : 0
  let start_date = formData.get('start_date') as string
  const predecessors = (formData.get('predecessors') as string)?.trim() || null
  
  if (!start_date) {
    if (!predecessors) {
      return { error: 'กรุณากรอกวันที่เริ่มงาน หรือระบุงานก่อนหน้า' }
    }
    // Fetch project's start date to use as default placeholder in DB
    const { data: proj } = await supabase.from('projects').select('start_date').eq('id', projectId).single()
    start_date = proj?.start_date || new Date().toISOString().split('T')[0]
  }
  
  const durationRaw = formData.get('duration') as string
  const duration = durationRaw ? parseInt(durationRaw, 10) : 1
  
  const progressRaw = formData.get('actual_progress') as string
  const actual_progress = progressRaw ? Math.max(0, Math.min(100, parseInt(progressRaw, 10))) : 0
  
  const is_milestone = formData.get('is_milestone') === 'true'

  const { error } = await supabase
    .from('tasks')
    .update({
      wbs_no,
      name,
      cost: isNaN(cost) ? 0 : cost,
      start_date,
      duration: isNaN(duration) ? 1 : duration,
      predecessors,
      actual_progress,
      is_milestone,
    })
    .eq('id', taskId)

  if (error) {
    return { error: `แก้ไขกิจกรรมไม่สำเร็จ: ${error.message}` }
  }

  await recalculateProjectProgress(projectId)
  revalidatePath(`/projects/${projectId}/planning`)
  revalidatePath(`/projects/${projectId}`)
  revalidatePath('/projects')
  return { success: true }
}

export async function deleteTask(projectId: string, taskId: string): Promise<ActionState> {
  if (!projectId || !taskId) return { error: 'ข้อมูลไม่ครบถ้วน' }

  const { error } = await supabase.from('tasks').delete().eq('id', taskId)

  if (error) {
    return { error: `ลบกิจกรรมไม่สำเร็จ: ${error.message}` }
  }

  await recalculateProjectProgress(projectId)
  revalidatePath(`/projects/${projectId}/planning`)
  revalidatePath(`/projects/${projectId}`)
  revalidatePath('/projects')
  return { success: true }
}
