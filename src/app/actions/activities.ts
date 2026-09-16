'use server'

import { getGlobalActivityLogs } from '@/lib/auditLogger'
import type { ActivityLog } from '@/lib/types'

export async function fetchGlobalActivityLogs(options?: {
  projectId?: string
  moduleType?: string
  entityType?: string
  actionType?: string
  limit?: number
}): Promise<ActivityLog[]> {
  return getGlobalActivityLogs(options)
}
