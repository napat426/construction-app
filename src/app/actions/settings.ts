'use server'

import { supabase } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'
import { logActivity } from '@/lib/auditLogger'

export async function saveSystemSetting(key: string, value: string, title?: string) {
  try {
    const { data: existing } = await supabase
      .from('system_settings')
      .select('id, value')
      .eq('key', key)
      .maybeSingle()

    if (existing) {
      const { error } = await supabase
        .from('system_settings')
        .update({ value })
        .eq('key', key)
      if (error) return { error: error.message }
    } else {
      const { error } = await supabase
        .from('system_settings')
        .insert({ key, value })
      if (error) return { error: error.message }
    }

    const keyLabels: Record<string, string> = {
      ai_assistant_enabled: 'เปิด/ปิด AI Assistant',
      line_notify_token: 'LINE Notify Token',
      line_channel_access_token: 'LINE Messaging Channel Access Token',
      line_user_id: 'LINE Target User/Group ID',
      morning_briefing_time: 'เวลาส่งรายงานสรุปช่วงเช้า',
      red_flag_alert_enabled: 'การแจ้งเตือนความล่าช้า (Red Flag Alert)',
      red_flag_threshold_days: 'เกณฑ์ความล่าช้าแจ้งเตือน (วัน)',
      line_channels: 'กลุ่มแจ้งเตือน LINE',
      work_groups: 'กลุ่มงานโครงการ',
      default_wbs_tasks: 'กิจกรรม WBS เริ่มต้น',
    }

    const label = title || keyLabels[key] || key

    await logActivity({
      actionType: 'UPDATE',
      entityType: 'system_setting',
      entityTitle: `แก้ไขการตั้งค่าระบบ: ${label}`,
      details: {
        key,
        value: key.toLowerCase().includes('token') || key.toLowerCase().includes('key') ? '****** (ปกปิดความปลอดภัย)' : value,
      },
    })

    revalidatePath('/admin/settings')
    revalidatePath('/activities')
    revalidatePath('/')

    return { success: true }
  } catch (err: any) {
    return { error: err.message || 'Internal server error' }
  }
}

export async function updateWorkGroupsSetting(groups: string[]) {
  try {
    const serialized = JSON.stringify(groups)
    const { data: existing } = await supabase
      .from('system_settings')
      .select('id')
      .eq('key', 'work_groups')
      .maybeSingle()

    if (existing) {
      await supabase.from('system_settings').update({ value: serialized }).eq('key', 'work_groups')
    } else {
      await supabase.from('system_settings').insert({ key: 'work_groups', value: serialized })
    }

    await logActivity({
      actionType: 'UPDATE',
      entityType: 'system_setting',
      entityTitle: `ปรับปรุงกลุ่มงานโครงการ (${groups.length} กลุ่มงาน)`,
      details: {
        work_groups: groups,
        count: groups.length,
      },
    })

    revalidatePath('/admin/settings')
    revalidatePath('/projects')
    revalidatePath('/activities')

    return { success: true }
  } catch (err: any) {
    return { error: err.message }
  }
}

export async function updateDefaultWbsTasksSetting(tasks: any[]) {
  try {
    const serialized = JSON.stringify(tasks)
    const { data: existing } = await supabase
      .from('system_settings')
      .select('id')
      .eq('key', 'default_wbs_tasks')
      .maybeSingle()

    if (existing) {
      await supabase.from('system_settings').update({ value: serialized }).eq('key', 'default_wbs_tasks')
    } else {
      await supabase.from('system_settings').insert({ key: 'default_wbs_tasks', value: serialized })
    }

    await logActivity({
      actionType: 'UPDATE',
      entityType: 'system_setting',
      entityTitle: `ปรับปรุงเทมเพลตกิจกรรม WBS เริ่มต้น (${tasks.length} รายการ)`,
      details: {
        task_count: tasks.length,
      },
    })

    revalidatePath('/admin/settings')
    revalidatePath('/activities')

    return { success: true }
  } catch (err: any) {
    return { error: err.message }
  }
}
