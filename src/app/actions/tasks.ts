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
  const cost = Number(costRaw) || 0
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
  const duration = (Number(durationRaw) || 0) <= 0 ? 1 : Number(durationRaw)
  
  const progressRaw = formData.get('actual_progress') as string
  const actual_progress = Math.max(0, Math.min(100, Number(progressRaw) || 0))
  
  const is_milestone = formData.get('is_milestone') === 'true'

  const { error } = await supabase.from('tasks').insert({
    project_id: projectId,
    wbs_no,
    name,
    cost,
    start_date,
    duration,
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
  const cost = Number(costRaw) || 0
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
  const duration = (Number(durationRaw) || 0) <= 0 ? 1 : Number(durationRaw)
  
  const progressRaw = formData.get('actual_progress') as string
  const actual_progress = Math.max(0, Math.min(100, Number(progressRaw) || 0))
  
  const is_milestone = formData.get('is_milestone') === 'true'

  const { error } = await supabase
    .from('tasks')
    .update({
      wbs_no,
      name,
      cost,
      start_date,
      duration,
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

// Helper function to sort WBS
function sortWBS(a: string, b: string): number {
  const partsA = a.split('.').map(Number)
  const partsB = b.split('.').map(Number)
  const maxLen = Math.max(partsA.length, partsB.length)
  for (let i = 0; i < maxLen; i++) {
    const valA = partsA[i] || 0
    const valB = partsB[i] || 0
    if (valA !== valB) {
      return valA - valB
    }
  }
  return 0
}

function updatePredecessorString(predStr: string | null, mapping: Map<string, string>): string | null {
  if (!predStr) return predStr
  const clean = predStr.trim().replace(/\s+/g, '')
  const match = clean.match(/^([0-9.]+)(FS|SS|FF|SF)?(?:([+-])(\d+))?$/i)
  if (!match) return predStr
  
  const wbsNo = match[1]
  if (mapping.has(wbsNo)) {
    const newWbs = mapping.get(wbsNo)!
    const type = match[2] || ''
    const sign = match[3] || ''
    const amount = match[4] || ''
    return newWbs + type + sign + amount
  }
  return predStr
}

export async function insertTaskAfter(
  projectId: string,
  targetTaskId: string,
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  if (!projectId || !targetTaskId) return { error: 'ข้อมูลไม่ครบถ้วน' }

  const name = (formData.get('name') as string)?.trim()
  if (!name) {
    return { error: 'กรุณากรอกชื่อกิจกรรม' }
  }

  // Fetch all tasks
  const { data: allTasks, error: fetchError } = await supabase
    .from('tasks')
    .select('*')
    .eq('project_id', projectId)

  if (fetchError || !allTasks) {
    return { error: 'ดึงข้อมูลกิจกรรมไม่สำเร็จ' }
  }

  const sorted = [...allTasks].sort((a, b) => sortWBS(a.wbs_no, b.wbs_no))
  const targetIndex = sorted.findIndex(t => t.id === targetTaskId)
  
  if (targetIndex === -1) {
    return { error: 'ไม่พบกิจกรรมอ้างอิง' }
  }

  const targetTask = sorted[targetIndex]
  const targetWbsParts = targetTask.wbs_no.split('.')
  const prefix = targetWbsParts.slice(0, -1).join('.')
  const targetSuffix = Number(targetWbsParts[targetWbsParts.length - 1])
  
  const wbsMapping = new Map<string, string>()

  for (let i = 0; i < sorted.length; i++) {
    const t = sorted[i]
    if (i <= targetIndex) continue
    
    const parts = t.wbs_no.split('.')
    if (parts.length >= targetWbsParts.length) {
      const tTopLevelSuffix = Number(parts[targetWbsParts.length - 1])
      const tTopLevelPrefix = parts.slice(0, targetWbsParts.length - 1).join('.')
      
      if (tTopLevelPrefix === prefix && tTopLevelSuffix > targetSuffix) {
        const newParts = [...parts]
        newParts[targetWbsParts.length - 1] = tTopLevelSuffix + 1
        const newWbsNo = newParts.join('.')
        wbsMapping.set(t.wbs_no, newWbsNo)
      }
    }
  }

  const newTaskWbsNo = (prefix ? prefix + '.' : '') + (targetSuffix + 1)

  // We need to update predecessors for all tasks that have predecessors mapped
  const tasksWithUpdatedPredecessors = allTasks.map(t => {
    const baseWbsNo = wbsMapping.get(t.wbs_no) || t.wbs_no
    const newPred = updatePredecessorString(t.predecessors, wbsMapping)
    
    if (baseWbsNo !== t.wbs_no || newPred !== t.predecessors) {
      return { ...t, wbs_no: baseWbsNo, predecessors: newPred }
    }
    return null
  }).filter(t => t !== null)

  // Perform updates
  if (tasksWithUpdatedPredecessors.length > 0) {
    const { error: updateError } = await supabase
      .from('tasks')
      .upsert(tasksWithUpdatedPredecessors.map(t => ({
        id: t.id,
        project_id: t.project_id,
        wbs_no: t.wbs_no,
        name: t.name,
        cost: t.cost,
        start_date: t.start_date,
        duration: t.duration,
        predecessors: t.predecessors,
        actual_progress: t.actual_progress,
        is_milestone: t.is_milestone
      })))

    if (updateError) {
      return { error: `แก้ไขลำดับกิจกรรมไม่สำเร็จ: ${updateError.message}` }
    }
  }

  // Create new task
  const costRaw = formData.get('cost') as string
  const cost = Number(costRaw) || 0
  let start_date = formData.get('start_date') as string
  const predecessors = (formData.get('predecessors') as string)?.trim() || null
  
  if (!start_date) {
    if (!predecessors) {
      return { error: 'กรุณากรอกวันที่เริ่มงาน หรือระบุงานก่อนหน้า' }
    }
    // Fetch project's start date
    const { data: proj } = await supabase.from('projects').select('start_date').eq('id', projectId).single()
    start_date = proj?.start_date || new Date().toISOString().split('T')[0]
  }

  const durationRaw = formData.get('duration') as string
  const duration = (Number(durationRaw) || 0) <= 0 ? 1 : Number(durationRaw)
  
  const progressRaw = formData.get('actual_progress') as string
  const actual_progress = Math.max(0, Math.min(100, Number(progressRaw) || 0))
  
  const is_milestone = formData.get('is_milestone') === 'true'

  const { error: insertError } = await supabase.from('tasks').insert({
    project_id: projectId,
    wbs_no: newTaskWbsNo,
    name,
    cost,
    start_date,
    duration,
    predecessors,
    actual_progress,
    is_milestone,
  })

  if (insertError) {
    return { error: `สร้างกิจกรรมย่อยไม่สำเร็จ: ${insertError.message}` }
  }

  await recalculateProjectProgress(projectId)
  revalidatePath(`/projects/${projectId}/planning`)
  revalidatePath(`/projects/${projectId}`)
  revalidatePath('/projects')
  return { success: true }
}
