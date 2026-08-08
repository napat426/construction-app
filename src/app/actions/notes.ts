'use server'

import { supabase } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'
import type { ProjectNote } from '@/lib/types'
import type { UserSession } from '@/lib/auth'

// ─── READ ──────────────────────────────────────────────────────────────────

export async function getNotesByProject(projectId: string): Promise<ProjectNote[]> {
  const { data, error } = await supabase
    .from('project_notes')
    .select('*')
    .eq('project_id', projectId)
    .order('is_pinned', { ascending: false })
    .order('updated_at', { ascending: false })
  if (error) {
    console.error('Error fetching notes:', error)
    return []
  }
  return (data as ProjectNote[]) || []
}

export async function getNoteFolders(projectId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('project_notes')
    .select('folder')
    .eq('project_id', projectId)
  if (error || !data) return ['ทั่วไป']
  const folders = Array.from(new Set(data.map((d) => d.folder as string)))
  if (!folders.includes('ทั่วไป')) folders.unshift('ทั่วไป')
  return folders
}

// ─── CREATE ────────────────────────────────────────────────────────────────

export async function createNote(
  projectId: string,
  data: Partial<Pick<ProjectNote, 'title' | 'folder' | 'color' | 'content' | 'drawing_data'>>,
  user: UserSession
): Promise<{ success: boolean; note?: ProjectNote; error?: string }> {
  if (!user || (user.role !== 'admin' && user.role !== 'editor')) {
    return { success: false, error: 'ไม่มีสิทธิ์สร้างโน้ต กรุณาเข้าสู่ระบบ' }
  }

  const { data: inserted, error } = await supabase
    .from('project_notes')
    .insert({
      project_id: projectId,
      title: data.title || 'โน้ตใหม่',
      folder: data.folder || 'ทั่วไป',
      color: data.color || '#ffffff',
      content: data.content || null,
      drawing_data: data.drawing_data || null,
      created_by: user.display_name || user.username,
    })
    .select()
    .single()

  if (error) return { success: false, error: error.message }

  revalidatePath(`/projects/${projectId}/notes`)
  return { success: true, note: inserted as ProjectNote }
}

// ─── UPDATE ────────────────────────────────────────────────────────────────

export async function updateNote(
  noteId: string,
  data: Partial<Pick<ProjectNote, 'title' | 'folder' | 'color' | 'content' | 'drawing_data' | 'is_pinned'>>,
  user: UserSession,
  projectId: string
): Promise<{ success: boolean; error?: string }> {
  if (!user || (user.role !== 'admin' && user.role !== 'editor')) {
    return { success: false, error: 'ไม่มีสิทธิ์แก้ไขโน้ต' }
  }

  const { error } = await supabase
    .from('project_notes')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', noteId)

  if (error) return { success: false, error: error.message }

  revalidatePath(`/projects/${projectId}/notes`)
  return { success: true }
}

// ─── DELETE ────────────────────────────────────────────────────────────────

export async function deleteNote(
  noteId: string,
  user: UserSession,
  projectId: string
): Promise<{ success: boolean; error?: string }> {
  if (!user || (user.role !== 'admin' && user.role !== 'editor')) {
    return { success: false, error: 'ไม่มีสิทธิ์ลบโน้ต' }
  }

  const { error } = await supabase.from('project_notes').delete().eq('id', noteId)
  if (error) return { success: false, error: error.message }

  revalidatePath(`/projects/${projectId}/notes`)
  return { success: true }
}
