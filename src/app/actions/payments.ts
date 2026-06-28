'use server'

import { supabase } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'

export async function addPayment(projectId: string, date: string, amount: number, description: string) {
  if (!projectId || !date || isNaN(amount) || amount <= 0) {
    return { error: 'กรุณากรอกข้อมูลให้ครบถ้วนและถูกต้อง' }
  }

  // 1. Insert payment entry
  const { error: insertErr } = await supabase
    .from('project_payments')
    .insert({
      project_id: projectId,
      payment_date: date,
      amount,
      description
    })

  if (insertErr) {
    console.error('Error inserting payment:', insertErr)
    return { error: 'ไม่สามารถบันทึกรายการจ่ายเงินได้' }
  }

  // 2. Recalculate total paid_amount for project
  const { data: payments } = await supabase
    .from('project_payments')
    .select('amount')
    .eq('project_id', projectId)

  const totalPaid = (payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0)

  // 3. Update project record
  const { error: updateErr } = await supabase
    .from('projects')
    .update({ paid_amount: totalPaid })
    .eq('id', projectId)

  if (updateErr) {
    console.error('Error updating project paid_amount:', updateErr)
    return { error: 'ไม่สามารถอัปเดตยอดจ่ายเงินรวมของโครงการได้' }
  }

  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/projects/${projectId}/planning`)
  return { success: true }
}

export async function deletePayment(projectId: string, paymentId: string) {
  if (!projectId || !paymentId) {
    return { error: 'ข้อมูลไม่ครบถ้วน' }
  }

  // 1. Delete payment entry
  const { error: deleteErr } = await supabase
    .from('project_payments')
    .delete()
    .eq('id', paymentId)

  if (deleteErr) {
    console.error('Error deleting payment:', deleteErr)
    return { error: 'ไม่สามารถลบรายการจ่ายเงินได้' }
  }

  // 2. Recalculate total paid_amount for project
  const { data: payments } = await supabase
    .from('project_payments')
    .select('amount')
    .eq('project_id', projectId)

  const totalPaid = (payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0)

  // 3. Update project record
  const { error: updateErr } = await supabase
    .from('projects')
    .update({ paid_amount: totalPaid })
    .eq('id', projectId)

  if (updateErr) {
    console.error('Error updating project paid_amount:', updateErr)
    return { error: 'ไม่สามารถอัปเดตยอดจ่ายเงินรวมของโครงการได้' }
  }

  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/projects/${projectId}/planning`)
  return { success: true }
}
