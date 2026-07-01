'use server'

import { supabase } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'
import type { PunchList, PunchItem } from '@/lib/types'

export async function createPunchList(projectId: string) {
  if (!projectId) return { error: 'ไม่พบรหัสโครงการ' }

  // Count existing punch lists for this project to generate PL sequence number
  const { count, error: countErr } = await supabase
    .from('punch_lists')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', projectId)

  if (countErr) {
    console.error('Error counting punch lists:', countErr)
  }

  const nextSeq = (count ?? 0) + 1
  const plNumber = `PL-${String(nextSeq).padStart(3, '0')}`

  const { data, error } = await supabase
    .from('punch_lists')
    .insert({
      project_id: projectId,
      pl_number: plNumber,
      title: 'รายการตรวจรับงานใหม่',
      issued_by: '',
      issued_to: '',
      status: 'open',
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating punch list:', error)
    return { error: 'ไม่สามารถสร้าง Punch List ใหม่ได้' }
  }

  revalidatePath(`/projects/${projectId}/punchlist`)
  return { success: true, data: data as PunchList }
}

export async function updatePunchList(
  punchListId: string,
  header: Partial<PunchList>,
  items: Partial<PunchItem>[]
) {
  if (!punchListId) return { error: 'ไม่พบรหัส Punch List' }

  // Auto-close check: if all items are 'done' or 'rejected', auto update status to 'closed'
  let targetStatus = header.status || 'open'
  let autoClosed = false

  if (items.length > 0 && items.every(item => item.status === 'done' || item.status === 'rejected')) {
    if (targetStatus !== 'closed') {
      targetStatus = 'closed'
      autoClosed = true
    }
  }

  // 1. Update Header details
  const { error: headerErr } = await supabase
    .from('punch_lists')
    .update({
      pl_number: header.pl_number,
      title: header.title,
      issued_by: header.issued_by,
      issued_to: header.issued_to,
      due_date: header.due_date || null,
      status: targetStatus,
    })
    .eq('id', punchListId)

  if (headerErr) {
    console.error('Error updating punch list header:', headerErr)
    return { error: 'ไม่สามารถบันทึกข้อมูลหัวข้อ Punch List ได้' }
  }

  // 2. Delete all existing items
  const { error: deleteErr } = await supabase
    .from('punch_items')
    .delete()
    .eq('punch_list_id', punchListId)

  if (deleteErr) {
    console.error('Error clearing old punch items:', deleteErr)
    return { error: 'ไม่สามารถล้างรายการข้อบกพร่องเดิมได้' }
  }

  // 3. Batch insert new items with re-sequencing
  if (items.length > 0) {
    const toInsert = items.map((item, index) => ({
      punch_list_id: punchListId,
      sequence: index + 1,
      location: item.location || '',
      category: item.category || 'อื่นๆ',
      description: item.description || '',
      photos: item.photos || [],
      assignee: item.assignee || null,
      due_date: item.due_date || null,
      status: item.status || 'open',
      closed_date: item.status === 'done' || item.status === 'rejected' 
        ? (item.closed_date || new Date().toISOString().split('T')[0]) 
        : null,
      remark: item.remark || null,
      contractor_response: item.contractor_response || null,
      response_date: item.response_date || null,
    }))

    const { error: insertErr } = await supabase
      .from('punch_items')
      .insert(toInsert)

    if (insertErr) {
      console.error('Error inserting punch items:', insertErr)
      return { error: 'ไม่สามารถบันทึกรายการข้อบกพร่องใหม่ได้' }
    }
  }

  const { data: updatedHeader } = await supabase
    .from('punch_lists')
    .select('*')
    .eq('id', punchListId)
    .single()

  // Find projectId to revalidate paths
  if (updatedHeader) {
    revalidatePath(`/projects/${updatedHeader.project_id}/punchlist`)
    revalidatePath('/portfolio')
  }

  return { success: true, autoClosed, header: updatedHeader as PunchList }
}

export async function deletePunchList(punchListId: string) {
  if (!punchListId) return { error: 'ไม่พบรหัส Punch List' }

  const { data: header } = await supabase
    .from('punch_lists')
    .select('project_id')
    .eq('id', punchListId)
    .single()

  const { error } = await supabase
    .from('punch_lists')
    .delete()
    .eq('id', punchListId)

  if (error) {
    console.error('Error deleting punch list:', error)
    return { error: 'ไม่สามารถลบ Punch List ได้' }
  }

  if (header) {
    revalidatePath(`/projects/${header.project_id}/punchlist`)
    revalidatePath('/portfolio')
  }

  return { success: true }
}
