'use server'

import { supabase } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'
import type { ProjectMilestone } from '@/lib/types'
import { logActivity } from '@/lib/auditLogger'

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
      is_paid: m.status === 'Paid' || !!m.is_paid,
      payment_date: m.payment_date || null,
      expected_payment_date: m.expected_payment_date || null,
      status: m.status || (m.is_paid ? 'Paid' : 'Pending')
    }))

    const { error: insErr } = await supabase
      .from('project_milestones')
      .insert(toInsert)

    if (insErr) {
      console.error('Error inserting milestones:', insErr)
      return { error: 'ไม่สามารถบันทึกงวดงานใหม่ได้' }
    }
  }

  // 3. Calculate total paid amount and count
  const paidMilestones = milestones.filter(m => m.status === 'Paid' || m.is_paid)
  const paidCount = paidMilestones.length
  const totalPaid = paidMilestones.reduce((sum, m) => sum + (Number(m.amount) || 0), 0)

  // 4. Update project paid_amount in DB
  const { error: projErr } = await supabase
    .from('projects')
    .update({ paid_amount: totalPaid })
    .eq('id', projectId)

  if (projErr) {
    console.error('Error updating project paid:', projErr)
    return { error: 'ไม่สามารถอัปเดตยอดชำระเงินรวมได้' }
  }

  await logActivity({
    projectId,
    actionType: 'UPDATE',
    entityType: 'milestone',
    entityTitle: `ปรับปรุงงวดงานและการชำระเงิน (${milestones.length} งวด, ชำระแล้ว ${paidCount} งวด ยอดรวม ฿${totalPaid.toLocaleString()})`,
    details: {
      milestone_count: milestones.length,
      paid_count: paidCount,
      total_paid: totalPaid,
    },
  })

  revalidatePath('/projects')
  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/projects/${projectId}/planning`)
  revalidatePath('/activities')
  revalidatePath('/')
  return { success: true }
}
