'use server'

import { supabase } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'
import type { ActionState } from '@/lib/types'

export async function createConcretePour(projectId: string, prevState: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const data = {
      project_id: projectId,
      pour_no: (formData.get('pour_no') as string)?.trim() || '',
      pour_date: formData.get('pour_date'),
      structure_element: formData.get('structure_element') || null,
      wbs_task_id: formData.get('wbs_task_id') || null,
      concrete_grade: formData.get('concrete_grade') || null,
      slump_spec: formData.get('slump_spec') ? parseFloat(formData.get('slump_spec') as string) : null,
      slump_actual: formData.get('slump_actual') ? parseFloat(formData.get('slump_actual') as string) : null,
      slump_tolerance: formData.get('slump_tolerance') ? parseFloat(formData.get('slump_tolerance') as string) : null,
      volume: formData.get('volume') ? parseFloat(formData.get('volume') as string) : null,
      supplier: formData.get('supplier') || null,
      ticket_no: formData.get('ticket_no') || null,
      pour_start_time: formData.get('pour_start_time') || null,
      pour_end_time: formData.get('pour_end_time') || null,
      weather: formData.get('weather') || null,
      cube_samples: formData.get('cube_samples') ? parseInt(formData.get('cube_samples') as string, 10) : 0,
      note: formData.get('note') || null,
      photos: formData.get('photos') ? JSON.parse(formData.get('photos') as string) : [],
      sequence: formData.get('sequence') ? parseInt(formData.get('sequence') as string, 10) : 0,
    }

    if (!data.pour_no || !data.pour_date) {
      return { error: 'กรุณากรอกเลขที่การเทและวันที่เท' }
    }

    const { error } = await supabase
      .from('concrete_pours')
      .insert(data)

    if (error) {
      console.error('Error creating concrete pour:', error)
      return { error: 'ไม่สามารถบันทึกรายการเทคอนกรีตได้' }
    }

    revalidatePath(`/projects/${projectId}/reports`)
    return { success: true }
  } catch (err: any) {
    console.error('Action error (createConcretePour):', err)
    return { error: 'เกิดข้อผิดพลาดภายในระบบ' }
  }
}

export async function updateConcretePour(pourId: string, projectId: string, prevState: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const data = {
      pour_no: (formData.get('pour_no') as string)?.trim() || '',
      pour_date: formData.get('pour_date'),
      structure_element: formData.get('structure_element') || null,
      wbs_task_id: formData.get('wbs_task_id') || null,
      concrete_grade: formData.get('concrete_grade') || null,
      slump_spec: formData.get('slump_spec') ? parseFloat(formData.get('slump_spec') as string) : null,
      slump_actual: formData.get('slump_actual') ? parseFloat(formData.get('slump_actual') as string) : null,
      slump_tolerance: formData.get('slump_tolerance') ? parseFloat(formData.get('slump_tolerance') as string) : null,
      volume: formData.get('volume') ? parseFloat(formData.get('volume') as string) : null,
      supplier: formData.get('supplier') || null,
      ticket_no: formData.get('ticket_no') || null,
      pour_start_time: formData.get('pour_start_time') || null,
      pour_end_time: formData.get('pour_end_time') || null,
      weather: formData.get('weather') || null,
      cube_samples: formData.get('cube_samples') ? parseInt(formData.get('cube_samples') as string, 10) : 0,
      note: formData.get('note') || null,
      photos: formData.get('photos') ? JSON.parse(formData.get('photos') as string) : [],
    }

    if (!data.pour_no || !data.pour_date) {
      return { error: 'กรุณากรอกเลขที่การเทและวันที่เท' }
    }

    const { error } = await supabase
      .from('concrete_pours')
      .update(data)
      .eq('id', pourId)

    if (error) {
      console.error('Error updating concrete pour:', error)
      return { error: 'ไม่สามารถอัปเดตรายการเทคอนกรีตได้' }
    }

    revalidatePath(`/projects/${projectId}/reports`)
    return { success: true }
  } catch (err: any) {
    console.error('Action error (updateConcretePour):', err)
    return { error: 'เกิดข้อผิดพลาดภายในระบบ' }
  }
}

export async function deleteConcretePour(pourId: string, projectId: string): Promise<ActionState> {
  try {
    const { error } = await supabase
      .from('concrete_pours')
      .delete()
      .eq('id', pourId)

    if (error) {
      console.error('Error deleting concrete pour:', error)
      return { error: 'ไม่สามารถลบรายการได้' }
    }

    revalidatePath(`/projects/${projectId}/reports`)
    return { success: true }
  } catch (err: any) {
    console.error('Action error (deleteConcretePour):', err)
    return { error: 'เกิดข้อผิดพลาดภายในระบบ' }
  }
}

export async function reorderConcretePours(projectId: string, updates: { id: string, sequence: number }[]): Promise<ActionState> {
  try {
    for (const item of updates) {
      const { error } = await supabase
        .from('concrete_pours')
        .update({ sequence: item.sequence })
        .eq('id', item.id)

      if (error) {
        console.error('Error reordering:', error)
        return { error: 'บันทึกลำดับไม่สำเร็จ' }
      }
    }

    revalidatePath(`/projects/${projectId}/reports`)
    return { success: true }
  } catch (err: any) {
    console.error('Action error (reorderConcretePours):', err)
    return { error: 'เกิดข้อผิดพลาดภายในระบบ' }
  }
}
