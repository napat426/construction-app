'use server'

import { supabase } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'

export async function saveAmendment(projectId: string, formData: FormData) {
  const id = formData.get('id') as string | null
  const amendment_no = parseInt(formData.get('amendment_no') as string, 10)
  const raw_extra_days = formData.get('extra_days') as string
  const extra_days = raw_extra_days !== null && raw_extra_days !== '' ? parseInt(raw_extra_days, 10) : 0
  const reason = formData.get('reason') as string
  const amendment_date = formData.get('amendment_date') as string
  const amendment_type = formData.get('amendment_type') as string
  const suspend_date = formData.get('suspend_date') as string || null
  const resume_date = formData.get('resume_date') as string || null
  const note = formData.get('note') as string | null

  if (!projectId || isNaN(amendment_no) || !reason || !amendment_date || !amendment_type) {
    return { error: 'Missing or invalid required fields' }
  }

  const payload = {
    project_id: projectId,
    amendment_no,
    extra_days,
    reason,
    amendment_date,
    amendment_type,
    suspend_date,
    resume_date,
    note
  }

  if (id) {
    const { error } = await supabase
      .from('contract_amendments')
      .update(payload)
      .eq('id', id)
      
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase
      .from('contract_amendments')
      .insert(payload)
      
    if (error) return { error: error.message }
  }

  revalidatePath('/')
  revalidatePath('/projects/[id]', 'layout')
  return { success: true }
}

export async function deleteAmendment(id: string) {
  if (!id) return { error: 'Missing id' }
  const { error } = await supabase
    .from('contract_amendments')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }
  
  revalidatePath('/')
  revalidatePath('/projects/[id]', 'layout')
  return { success: true }
}
