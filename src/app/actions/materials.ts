'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import type { MaterialStatus } from '@/lib/types'

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
let supabaseUrl = rawUrl && (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) ? rawUrl : 'https://txexenqijhxtdrzgltsm.supabase.co'
if (supabaseUrl.startsWith('"') && supabaseUrl.endsWith('"')) supabaseUrl = supabaseUrl.slice(1, -1)
let supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
if (supabaseKey.startsWith('"') && supabaseKey.endsWith('"')) supabaseKey = supabaseKey.slice(1, -1)

const supabase = createClient(supabaseUrl, supabaseKey)

export async function createMaterial(projectId: string, formData: FormData) {
  const name = formData.get('name') as string
  const submission_no = (formData.get('submission_no') as string) || null
  const submitted_date = (formData.get('submitted_date') as string) || null
  const note = (formData.get('note') as string) || null
  const insertPosition = (formData.get('insert_position') as string) || 'end'

  if (!name?.trim()) return { error: 'กรุณากรอกชื่อวัสดุ' }

  // 1. Fetch existing materials to determine order
  const { data: existing } = await supabase
    .from('materials')
    .select('id')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  // 2. Insert new item
  const { data: newMat, error } = await supabase
    .from('materials')
    .insert({
      project_id: projectId,
      name: name.trim(),
      submission_no: submission_no ? submission_no.trim() : null,
      submitted_date: submitted_date ? submitted_date.trim() : null,
      note: note ? note.trim() : null,
      status: 'pending',
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  // 3. Re-sequence timestamps if inserting at specific location or existing items exist
  if (newMat && existing && existing.length > 0) {
    let orderedIds: string[] = []
    if (insertPosition === 'start') {
      orderedIds = [newMat.id, ...existing.map((m) => m.id)]
    } else if (insertPosition.startsWith('after:')) {
      const targetId = insertPosition.replace('after:', '')
      const targetIdx = existing.findIndex((m) => m.id === targetId)
      if (targetIdx !== -1) {
        orderedIds = existing.map((m) => m.id)
        orderedIds.splice(targetIdx + 1, 0, newMat.id)
      } else {
        orderedIds = [...existing.map((m) => m.id), newMat.id]
      }
    } else {
      orderedIds = [...existing.map((m) => m.id), newMat.id]
    }

    const baseTime = Date.now() - orderedIds.length * 1000
    for (let i = 0; i < orderedIds.length; i++) {
      await supabase
        .from('materials')
        .update({ created_at: new Date(baseTime + i * 1000).toISOString() })
        .eq('id', orderedIds[i])
    }
  }

  revalidatePath(`/projects/${projectId}/materials`)
  return { success: true }
}

export async function reorderMaterials(projectId: string, orderedIds: string[]) {
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) return { success: true }

  const baseTime = Date.now() - orderedIds.length * 1000
  for (let i = 0; i < orderedIds.length; i++) {
    await supabase
      .from('materials')
      .update({ created_at: new Date(baseTime + i * 1000).toISOString() })
      .eq('id', orderedIds[i])
  }

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
  materialsList: Array<{ name: string; submission_no?: string | null; submitted_date?: string | null; note?: string | null }>,
  mode: 'append' | 'replace' = 'append'
) {
  if (!Array.isArray(materialsList) || materialsList.length === 0) {
    return { error: 'ไม่พบข้อมูลรายการวัสดุที่ต้องการนำเข้า' }
  }

  if (mode === 'replace') {
    const { error: delError } = await supabase.from('materials').delete().eq('project_id', projectId)
    if (delError) return { error: 'ไม่สามารถลบรายการเดิมได้: ' + delError.message }
  }

  const baseTime = Date.now()
  const rows = materialsList.map((m, idx) => ({
    project_id: projectId,
    name: m.name.trim(),
    submission_no: m.submission_no ? m.submission_no.trim() : null,
    submitted_date: m.submitted_date ? m.submitted_date.trim() : null,
    note: m.note ? m.note.trim() : null,
    status: 'pending' as const,
    // Assign incremental timestamps to guarantee exact Excel row ordering
    created_at: new Date(baseTime + idx * 1000).toISOString(),
  }))

  const { error } = await supabase.from('materials').insert(rows)

  if (error) return { error: error.message }

  revalidatePath(`/projects/${projectId}/materials`)
  return { success: true }
}

