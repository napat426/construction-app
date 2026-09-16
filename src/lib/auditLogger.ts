import { supabase } from './supabase'
import { getCurrentUser, type UserSession } from './auth'
import type { ActivityActionType, ActivityEntityType, ActivityModuleType, ActivityLog } from './types'

export interface LogActivityParams {
  projectId?: string | null
  projectName?: string | null
  moduleType?: ActivityModuleType | string
  actionType: ActivityActionType | string
  entityType: ActivityEntityType | string
  entityId?: string | null
  entityTitle?: string | null
  details?: any
  user?: UserSession | null
}

export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    const user = params.user || (await getCurrentUser())
    const userName = user?.display_name || user?.username || 'ระบบอัตโนมัติ'
    const userRole = user?.role || 'editor'
    const userId = user?.id || null
    const moduleType = params.moduleType || (params.projectId ? 'project' : 'system')

    let projectName = params.projectName
    if (params.projectId && !projectName) {
      try {
        const { data: proj } = await supabase
          .from('projects')
          .select('name')
          .eq('id', params.projectId)
          .single()
        if (proj?.name) {
          projectName = proj.name
        }
      } catch {
        // Ignore cache failure
      }
    }

    const { error } = await supabase.from('activity_logs').insert({
      project_id: params.projectId || null,
      project_name: projectName || null,
      module_type: moduleType,
      user_id: userId,
      user_name: userName,
      user_role: userRole,
      action_type: params.actionType,
      entity_type: params.entityType,
      entity_id: params.entityId || null,
      entity_title: params.entityTitle || null,
      details: params.details || {},
    })

    if (error) {
      console.warn('[AuditLog Warning]:', error.message)
    }
  } catch (err: any) {
    console.warn('[AuditLog Exception]:', err?.message || err)
  }
}

export async function getProjectActivityLogs(
  projectId: string,
  options?: {
    limit?: number
    entityType?: string
    actionType?: string
  }
): Promise<ActivityLog[]> {
  return getGlobalActivityLogs({
    projectId,
    entityType: options?.entityType,
    actionType: options?.actionType,
    limit: options?.limit,
  })
}

export async function getGlobalActivityLogs(options?: {
  projectId?: string
  moduleType?: string
  entityType?: string
  actionType?: string
  limit?: number
}): Promise<ActivityLog[]> {
  try {
    let query = supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })

    if (options?.projectId && options.projectId !== 'ALL') {
      if (options.projectId === 'NONE') {
        query = query.is('project_id', null)
      } else {
        query = query.eq('project_id', options.projectId)
      }
    }
    if (options?.moduleType && options.moduleType !== 'ALL') {
      query = query.eq('module_type', options.moduleType)
    }
    if (options?.entityType && options.entityType !== 'ALL') {
      query = query.eq('entity_type', options.entityType)
    }
    if (options?.actionType && options.actionType !== 'ALL') {
      query = query.eq('action_type', options.actionType)
    }
    if (options?.limit) {
      query = query.limit(options.limit)
    } else {
      query = query.limit(200)
    }

    const { data, error } = await query
    if (error) {
      console.warn('[AuditLog Fetch Warning]:', error.message)
      return []
    }
    return (data || []) as ActivityLog[]
  } catch (err) {
    console.error('Failed to fetch activity logs:', err)
    return []
  }
}
