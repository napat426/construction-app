'use server'

import { supabase } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'
import type { QuickLink } from '@/lib/types'
import { logActivity } from '@/lib/auditLogger'

export async function getQuickLinks(projectId?: string): Promise<QuickLink[]> {
  try {
    let query = supabase.from('quick_links').select('*').order('sort_order', { ascending: true })
    
    if (projectId) {
      query = query.or(`project_id.eq.${projectId},project_id.is.null`)
    } else {
      query = query.is('project_id', null)
    }

    const { data, error } = await query
    if (error) {
      console.error('Error fetching quick links:', error)
      return []
    }
    return (data as QuickLink[]) || []
  } catch (err) {
    console.error('Exception fetching quick links:', err)
    return []
  }
}

export async function createQuickLink(payload: {
  project_id?: string | null
  title: string
  type: 'link' | 'note'
  url?: string | null
  content?: string | null
  category?: string | null
  sort_order?: number
}) {
  const { data, error } = await supabase
    .from('quick_links')
    .insert({
      project_id: payload.project_id || null,
      title: payload.title,
      type: payload.type || 'link',
      url: payload.url || null,
      content: payload.content || null,
      category: payload.category || 'ทั่วไป',
      sort_order: payload.sort_order || 0,
    })
    .select()
    .single()

  if (error) return { error: error.message }
  
  await logActivity({
    projectId: payload.project_id || undefined,
    actionType: 'CREATE',
    entityType: 'quick_link',
    entityId: data?.id,
    entityTitle: `เพิ่มลิงก์/โน้ตด่วน "${payload.title}" (${payload.category || 'ทั่วไป'})`,
    details: { title: payload.title, type: payload.type, category: payload.category },
  })

  if (payload.project_id) {
    revalidatePath(`/projects/${payload.project_id}`)
  }
  revalidatePath('/projects')
  revalidatePath('/quick-links')
  revalidatePath('/')
  return { success: true, data: data as QuickLink }
}

export async function updateQuickLink(id: string, payload: Partial<QuickLink>) {
  const { error } = await supabase
    .from('quick_links')
    .update({
      title: payload.title,
      type: payload.type,
      url: payload.url || null,
      content: payload.content || null,
      category: payload.category || 'ทั่วไป',
    })
    .eq('id', id)

  if (error) return { error: error.message }

  await logActivity({
    projectId: payload.project_id || undefined,
    actionType: 'UPDATE',
    entityType: 'quick_link',
    entityId: id,
    entityTitle: `แก้ไขลิงก์/โน้ตด่วน "${payload.title || id}"`,
    details: { title: payload.title, type: payload.type, category: payload.category },
  })

  if (payload.project_id) {
    revalidatePath(`/projects/${payload.project_id}`)
  }
  revalidatePath('/projects')
  revalidatePath('/quick-links')
  revalidatePath('/')
  return { success: true }
}

export async function deleteQuickLink(id: string, projectId?: string | null) {
  const { error } = await supabase.from('quick_links').delete().eq('id', id)
  if (error) return { error: error.message }

  await logActivity({
    projectId: projectId || undefined,
    actionType: 'DELETE',
    entityType: 'quick_link',
    entityId: id,
    entityTitle: `ลบลิงก์/โน้ตด่วน`,
  })

  if (projectId) {
    revalidatePath(`/projects/${projectId}`)
  }
  revalidatePath('/projects')
  revalidatePath('/quick-links')
  revalidatePath('/')
  return { success: true }
}

export async function updateQuickLinksOrder(updates: { id: string; sort_order: number }[], projectId?: string | null) {
  for (const item of updates) {
    await supabase.from('quick_links').update({ sort_order: item.sort_order }).eq('id', item.id)
  }

  if (projectId) {
    revalidatePath(`/projects/${projectId}`)
  }
  revalidatePath('/projects')
  revalidatePath('/quick-links')
  revalidatePath('/')
  return { success: true }
}
