'use server'

import { supabase } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'
import type { SupervisorTask, SupervisorTaskGroup, Project } from '@/lib/types'
import { logActivity } from '@/lib/auditLogger'

const SETTING_KEY = 'supervisor_tasks_data'

interface StorageData {
  groups: SupervisorTaskGroup[]
  tasks: SupervisorTask[]
  userLinks?: Record<string, string> // userId -> supervisorName
}

// Default realistic sample data for demo preview
const DEFAULT_SAMPLE_DATA: StorageData = {
  groups: [
    {
      id: 'grp-survey-01',
      supervisor: 'ณภัทร ชัยสิทธิ์สงวน',
      name: 'งานสำรวจและรังวัดพื้นที่',
      color: 'emerald',
      sort_order: 1,
      created_at: '2026-10-01T08:00:00Z',
    },
    {
      id: 'grp-design-02',
      supervisor: 'ณภัทร ชัยสิทธิ์สงวน',
      name: 'งานออกแบบและประมาณการ',
      color: 'blue',
      sort_order: 2,
      created_at: '2026-10-01T08:00:00Z',
    },
    {
      id: 'grp-coord-03',
      supervisor: 'ณภัทร ชัยสิทธิ์สงวน',
      name: 'งานประสานงานราชการและตรวจพื้นที่',
      color: 'amber',
      sort_order: 3,
      created_at: '2026-10-01T08:00:00Z',
    },
  ],
  tasks: [
    {
      id: 'task-001',
      group_id: 'grp-survey-01',
      supervisor: 'ณภัทร ชัยสิทธิ์สงวน',
      title: 'สำรวจระดับดินและแนวเขตอาคาร กฟส.อ้อมน้อย',
      description: 'ลงพื้นที่ตรวจวัดระดับดินร่วมกับเทศบาลกระทุ่มแบน ตรวจสอบหมุดหลักเขตที่ดิน 6 จุด เพื่อกำหนดระดับดินถมก่อนก่อสร้างโรงเก็บมิเตอร์',
      start_date: '2026-10-05',
      due_date: '2026-10-06',
      completed_date: '2026-10-06',
      status: 'completed',
      has_issue: false,
      issue_detail: null,
      issue_solution: null,
      photo_urls: [
        'https://images.unsplash.com/photo-1541888946425-d0fbb18615f8?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=800&q=80',
      ],
      related_project_id: null,
      sort_order: 1,
      created_at: '2026-10-05T09:00:00Z',
    },
    {
      id: 'task-002',
      group_id: 'grp-survey-01',
      supervisor: 'ณภัทร ชัยสิทธิ์สงวน',
      title: 'ตรวจสอบแนวเขตขยายพื้นที่ กฟส.ไทรโยค',
      description: 'รังวัดตรวจสอบแนวเขตเสาไฟฟ้าแรงสูงริมทางหลวง พบแนวเขตชิดขอบรั้วเดิม 0.5 ม.',
      start_date: '2026-10-08',
      due_date: '2026-10-09',
      completed_date: '2026-10-12',
      status: 'delayed',
      has_issue: true,
      issue_detail: 'เจ้าของที่ดินแปลงข้างเคียงคัดค้านแนวหมุดเดิม ทำให้ช่างรังวัดต้องรอนิติกรลงพื้นที่ไกล่เกลี่ย',
      issue_solution: 'นัดเจรจาร่วมกับเจ้าหน้าที่กรมที่ดินและนิติกร กฟภ. เพื่อรังวัดใหม่ในวันที่ 12 ต.ค. สำเร็จเรียบร้อย',
      photo_urls: [
        'https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=800&q=80',
      ],
      related_project_id: null,
      sort_order: 2,
      created_at: '2026-10-08T09:00:00Z',
    },
    {
      id: 'task-003',
      group_id: 'grp-design-02',
      supervisor: 'ณภัทร ชัยสิทธิ์สงวน',
      title: 'ถอดแบบและคิดราคากลางงานรั้วคอนกรีต กฟส.ดอนตูม',
      description: 'จัดทำ BOQ และประมาณราคากลางงานก่อสร้างรั้วลวดหนามและคันหินป้องกันน้ำหลาก ความยาวรวม 320 เมตร',
      start_date: '2026-10-10',
      due_date: '2026-10-14',
      completed_date: '2026-10-14',
      status: 'completed',
      has_issue: false,
      issue_detail: null,
      issue_solution: null,
      photo_urls: [
        'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=800&q=80',
      ],
      related_project_id: null,
      sort_order: 1,
      created_at: '2026-10-10T10:00:00Z',
    },
    {
      id: 'task-004',
      group_id: 'grp-coord-03',
      supervisor: 'ณภัทร ชัยสิทธิ์สงวน',
      title: 'ประชุมประสานงานขอใช้พื้นที่เขตทางหลวง จ.กาญจนบุรี',
      description: 'เข้าร่วมประชุมร่วมกับแขวงทางหลวงกาญจนบุรี เพื่อขออนุญาตวางท่อระบายน้ำข้ามถนนหน้าสถานี',
      start_date: '2026-10-15',
      due_date: '2026-10-15',
      completed_date: '2026-10-15',
      status: 'completed',
      has_issue: false,
      issue_detail: null,
      issue_solution: null,
      photo_urls: [],
      related_project_id: null,
      sort_order: 1,
      created_at: '2026-10-15T14:00:00Z',
    },
  ],
  userLinks: {},
}

// Fetch master storage data
export async function getSupervisorStorageData(): Promise<StorageData> {
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', SETTING_KEY)
      .single()

    if (error || !data?.value) {
      // Initialize with default demo data
      await supabase
        .from('system_settings')
        .upsert({ key: SETTING_KEY, value: JSON.stringify(DEFAULT_SAMPLE_DATA) }, { onConflict: 'key' })
      return DEFAULT_SAMPLE_DATA
    }

    const parsed: StorageData = typeof data.value === 'string' ? JSON.parse(data.value) : data.value
    return {
      groups: parsed.groups || [],
      tasks: parsed.tasks || [],
      userLinks: parsed.userLinks || {},
    }
  } catch (err) {
    console.error('Error loading supervisor storage data:', err)
    return DEFAULT_SAMPLE_DATA
  }
}

// Save storage data helper
async function saveSupervisorStorageData(data: StorageData) {
  await supabase
    .from('system_settings')
    .upsert({ key: SETTING_KEY, value: JSON.stringify(data) }, { onConflict: 'key' })
  revalidatePath('/supervisors')
  revalidatePath('/supervisors/[name]')
}

// Fetch all supervisors list from system_settings or projects
export async function getSupervisorsList(): Promise<string[]> {
  try {
    const { data: settingRes } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'supervisors')
      .single()

    let list: string[] = []
    if (settingRes?.value) {
      try {
        list = JSON.parse(settingRes.value)
      } catch {}
    }

    if (list.length === 0) {
      list = ['ณภัทร ชัยสิทธิ์สงวน', 'อดิศักดิ์ กอลีซอ', 'ภัทรกร สุทธิผล', 'อานนท์ เหล่ารัดเดชา', 'ปฏิพัทธ์ เจริญสุข']
    }
    return list
  } catch (err) {
    return ['ณภัทร ชัยสิทธิ์สงวน', 'อดิศักดิ์ กอลีซอ', 'ภัทรกร สุทธิผล', 'อานนท์ เหล่ารัดเดชา', 'ปฏิพัทธ์ เจริญสุข']
  }
}

// Fetch main projects for a supervisor
export async function getSupervisorProjects(supervisorName: string): Promise<Project[]> {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false })

    if (error || !data) return []

    // Filter projects where supervisor field contains this supervisor's name
    return data.filter((p: Project) => (p.supervisor || '').includes(supervisorName))
  } catch (err) {
    console.error('Error fetching supervisor projects:', err)
    return []
  }
}

// Save or Update a Task
export async function saveSupervisorTask(task: Partial<SupervisorTask> & { supervisor: string; title: string; group_id: string }) {
  try {
    const storage = await getSupervisorStorageData()
    const now = new Date().toISOString()

    // Auto-validate and correct group_id to ensure it always links to a valid group
    let resolvedGroupId = task.group_id
    const existingGroup = storage.groups.find((g) => g.id === resolvedGroupId && g.supervisor === task.supervisor)
    if (!existingGroup) {
      // Try to find by name match (stripping any emoji e.g. "📁 ประชุมและอบรม" -> "ประชุมและอบรม")
      const cleanTarget = (resolvedGroupId || '').replace(/^📁\s*/, '').trim()
      const matchByName = storage.groups.find(
        (g) => g.supervisor === task.supervisor && (g.name === cleanTarget || g.name.trim() === cleanTarget)
      )
      if (matchByName) {
        resolvedGroupId = matchByName.id
      } else {
        const firstGroup = storage.groups.find((g) => g.supervisor === task.supervisor)
        if (firstGroup) {
          resolvedGroupId = firstGroup.id
        }
      }
    }

    if (task.id) {
      // Update
      storage.tasks = storage.tasks.map((t) =>
        t.id === task.id
          ? {
              ...t,
              ...task,
              group_id: resolvedGroupId,
              updated_at: now,
            }
          : t
      )
    } else {
      // Create new
      const newTask: SupervisorTask = {
        id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        group_id: resolvedGroupId,
        supervisor: task.supervisor,
        title: task.title,
        description: task.description || null,
        start_date: task.start_date || null,
        due_date: task.due_date || null,
        completed_date: task.completed_date || null,
        status: task.status || 'pending',
        has_issue: Boolean(task.has_issue),
        issue_detail: task.issue_detail || null,
        issue_solution: task.issue_solution || null,
        photo_urls: task.photo_urls || [],
        related_project_id: task.related_project_id || null,
        sort_order: storage.tasks.filter((t) => t.supervisor === task.supervisor && t.group_id === resolvedGroupId).length + 1,
        created_at: now,
        updated_at: now,
      }
      storage.tasks.push(newTask)
    }

    await saveSupervisorStorageData(storage)

    await logActivity({
      actionType: task.id ? 'UPDATE' : 'CREATE',
      entityType: 'supervisor_task',
      entityTitle: `${task.id ? 'แก้ไข' : 'บันทึก'}ภารกิจย่อย "${task.title}" (${task.supervisor})`,
    })

    return { success: true }
  } catch (err: any) {
    return { error: err.message || 'บันทึกงานไม่สำเร็จ' }
  }
}

// Delete Task
export async function deleteSupervisorTask(taskId: string) {
  try {
    const storage = await getSupervisorStorageData()
    const target = storage.tasks.find((t) => t.id === taskId)
    storage.tasks = storage.tasks.filter((t) => t.id !== taskId)
    await saveSupervisorStorageData(storage)

    if (target) {
      await logActivity({
        actionType: 'DELETE',
        entityType: 'supervisor_task',
        entityTitle: `ลบภารกิจย่อย "${target.title}" (${target.supervisor})`,
      })
    }

    return { success: true }
  } catch (err: any) {
    return { error: err.message || 'ลบงานไม่สำเร็จ' }
  }
}

// Save or Update Task Group
export async function saveSupervisorTaskGroup(group: Partial<SupervisorTaskGroup> & { supervisor: string; name: string }) {
  try {
    const storage = await getSupervisorStorageData()
    const now = new Date().toISOString()

    if (group.id) {
      // Update
      storage.groups = storage.groups.map((g) =>
        g.id === group.id ? { ...g, ...group } : g
      )
    } else {
      // Create
      const newGroup: SupervisorTaskGroup = {
        id: `grp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        supervisor: group.supervisor,
        name: group.name,
        color: group.color || 'blue',
        sort_order: storage.groups.filter((g) => g.supervisor === group.supervisor).length + 1,
        created_at: now,
      }
      storage.groups.push(newGroup)
    }

    await saveSupervisorStorageData(storage)
    return { success: true }
  } catch (err: any) {
    return { error: err.message || 'บันทึกกลุ่มงานไม่สำเร็จ' }
  }
}

// Delete Task Group
export async function deleteSupervisorTaskGroup(groupId: string) {
  try {
    const storage = await getSupervisorStorageData()
    // Delete group and orphan its tasks or move them to empty group
    storage.groups = storage.groups.filter((g) => g.id !== groupId)
    storage.tasks = storage.tasks.filter((t) => t.group_id !== groupId)

    await saveSupervisorStorageData(storage)
    return { success: true }
  } catch (err: any) {
    return { error: err.message || 'ลบกลุ่มงานไม่สำเร็จ' }
  }
}

// Reorder Groups
export async function reorderSupervisorTaskGroups(supervisor: string, orderedGroupIds: string[]) {
  try {
    const storage = await getSupervisorStorageData()
    storage.groups = storage.groups.map((g) => {
      if (g.supervisor !== supervisor) return g
      const idx = orderedGroupIds.indexOf(g.id)
      return idx !== -1 ? { ...g, sort_order: idx + 1 } : g
    })

    await saveSupervisorStorageData(storage)
    return { success: true }
  } catch (err: any) {
    return { error: err.message || 'จัดลำดับกลุ่มงานไม่สำเร็จ' }
  }
}

// Reorder Tasks within a group
export async function reorderSupervisorTasks(supervisor: string, groupId: string, orderedTaskIds: string[]) {
  try {
    const storage = await getSupervisorStorageData()
    storage.tasks = storage.tasks.map((t) => {
      if (t.supervisor !== supervisor || t.group_id !== groupId) return t
      const idx = orderedTaskIds.indexOf(t.id)
      return idx !== -1 ? { ...t, sort_order: idx + 1 } : t
    })

    await saveSupervisorStorageData(storage)
    return { success: true }
  } catch (err: any) {
    return { error: err.message || 'จัดลำดับงานย่อยไม่สำเร็จ' }
  }
}
