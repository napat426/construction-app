'use server'

import { supabase } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'

export async function saveSuspension(projectId: string, formData: FormData) {
  const id = formData.get('id') as string | null
  const reason = formData.get('reason') as string
  const suspend_date = formData.get('suspend_date') as string
  const resume_date = formData.get('resume_date') as string | null
  const note = formData.get('note') as string | null

  if (!projectId || !suspend_date) {
    return { error: 'Missing required fields' }
  }

  const payload = {
    project_id: projectId,
    reason,
    suspend_date,
    resume_date: resume_date ? resume_date : null,
    note
  }

  if (id) {
    const { error } = await supabase
      .from('contract_suspensions')
      .update(payload)
      .eq('id', id)
      
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase
      .from('contract_suspensions')
      .insert(payload)
      
    if (error) return { error: error.message }
  }

  revalidatePath('/')
  revalidatePath('/projects/[id]', 'layout')
  return { success: true }
}

export async function deleteSuspension(id: string) {
  if (!id) return { error: 'Missing id' }
  const { error } = await supabase
    .from('contract_suspensions')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }
  
  revalidatePath('/')
  revalidatePath('/projects/[id]', 'layout')
  return { success: true }
}
