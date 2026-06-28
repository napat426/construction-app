'use server'

import { supabase } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'
import type { ProjectMilestone } from '@/lib/types'

export async function saveMilestones(projectId: string, milestones: ProjectMilestone[]) {
  if (!projectId) return { error: 'ไม่พบรหัสโครงการ' }

  // 1. Delete all existing milestones for this project
  const { error: delErr } = await supabase
    .from('project_milestones')
    .delete()
    .eq('project_id', projectId)

  if (delErr) {
    console.error('Error deleting milestones:', delErr)
    return { error: 'ไม่สามารถล้างข้อมูลเป้าหมายงวดงานเดิมได้' }
  }

  // 2. Insert new milestones
  if (milestones.length > 0) {
    const toInsert = milestones.map((m, idx) => ({
      project_id: projectId,
      milestone_no: idx + 1,
      name: m.name || `งวดที่ ${idx + 1}`,
      work_scope: m.work_scope || null,
      amount: Number(m.amount) || 0,
      is_paid: !!m.is_paid,
      payment_date: m.payment_date || null
    }))

    const { error: insErr } = await supabase
      .from('project_milestones')
      .insert(toInsert)

    if (insErr) {
      console.error('Error inserting milestones:', insErr)
      return { error: 'ไม่สามารถบันทึกงวดงานใหม่ได้' }
    }
  }

  // 3. Calculate total paid amount
  const totalPaid = milestones
    .filter(m => m.is_paid)
    .reduce((sum, m) => sum + (Number(m.amount) || 0), 0)

  // 4. Update project paid_amount in DB
  const { error: projErr } = await supabase
    .from('projects')
    .update({ paid_amount: totalPaid })
    .eq('id', projectId)

  if (projErr) {
    console.error('Error updating project paid:', projErr)
    return { error: 'ไม่สามารถอัปเดตยอดชำระเงินรวมได้' }
  }

  revalidatePath('/projects')
  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/projects/${projectId}/planning`)
  return { success: true }
}
