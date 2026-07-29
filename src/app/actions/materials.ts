'use server'

import { supabase } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'
import type { MaterialStatus } from '@/lib/types'

export async function createMaterial(projectId: string, formData: FormData) {
  const name = formData.get('name') as string
  const submission_no = (formData.get('submission_no') as string) || null
  const submitted_date = (formData.get('submitted_date') as string) || null

  if (!name?.trim()) return { error: 'กรุณากรอกชื่อวัสดุ' }

  const { error } = await supabase.from('materials').insert({
    project_id: projectId,
    name: name.trim(),
    submission_no: submission_no || null,
    submitted_date: submitted_date || null,
    status: 'pending',
  })

  if (error) return { error: error.message }

  revalidatePath(`/projects/${projectId}/materials`)
  return { success: true }
}

export async function updateMaterial(
  id: string,
  projectId: string,
  formData: FormData
) {
  const name = formData.get('name') as string
  const submission_no = (formData.get('submission_no') as string) || null
  const submitted_date = (formData.get('submitted_date') as string) || null
  const approved_date = (formData.get('approved_date') as string) || null
  const status = (formData.get('status') as MaterialStatus) || 'pending'
  const note = (formData.get('note') as string) || null

  if (!name?.trim()) return { error: 'กรุณากรอกชื่อวัสดุ' }

  const { error } = await supabase
    .from('materials')
    .update({
      name: name.trim(),
      submission_no: submission_no || null,
      submitted_date: submitted_date || null,
      approved_date: status === 'approved' ? (approved_date || null) : null,
      status,
      note: note || null,
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath(`/projects/${projectId}/materials`)
  return { success: true }
}

export async function deleteMaterial(id: string, projectId: string) {
  const { error } = await supabase.from('materials').delete().eq('id', id)

  if (error) return { error: error.message }

  revalidatePath(`/projects/${projectId}/materials`)
  return { success: true }
}

export async function importMaterials(
  projectId: string,
  materialsList: Array<{ name: string; submission_no?: string | null; submitted_date?: string | null }>
) {
  if (!Array.isArray(materialsList) || materialsList.length === 0) {
    return { error: 'ไม่พบข้อมูลรายการวัสดุที่ต้องการนำเข้า' }
  }

  const rows = materialsList.map((m) => ({
    project_id: projectId,
    name: m.name.trim(),
    submission_no: m.submission_no || null,
    submitted_date: m.submitted_date || null,
    status: 'pending' as const,
  }))

  const { error } = await supabase.from('materials').insert(rows)

  if (error) return { error: error.message }

  revalidatePath(`/projects/${projectId}/materials`)
  return { success: true }
}
