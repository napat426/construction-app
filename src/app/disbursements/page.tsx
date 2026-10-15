import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { Header } from '@/components/Header'
import { DisbursementsClient } from '@/components/DisbursementsClient'
import { getCurrentUser } from '@/lib/auth'
import { ReadOnlyBanner } from '@/components/ReadOnlyBanner'
import { TrendingUp } from 'lucide-react'
import type { Project, WBSTask, ProjectMilestone } from '@/lib/types'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'การเบิกจ่ายงบประมาณ | ระบบควบคุมงานก่อสร้าง',
}

export default async function DisbursementsPage() {
  const user = await getCurrentUser()

  const [projectsRes, tasksRes, milestonesRes, workGroupsRes, projectOrderRes] = await Promise.all([
    supabase.from('projects').select('*').order('created_at', { ascending: false }),
    supabase.from('tasks').select('*'),
    supabase.from('project_milestones').select('*').order('milestone_no', { ascending: true }),
    supabase.from('system_settings').select('*').eq('key', 'work_groups').single(),
    supabase.from('system_settings').select('*').eq('key', 'project_order').single(),
  ])

  const rawProjects: Project[] = (projectsRes.data as Project[]) ?? []
  const tasks: WBSTask[] = (tasksRes.data as WBSTask[]) ?? []
  const milestones: ProjectMilestone[] = (milestonesRes.data as ProjectMilestone[]) ?? []

  let workGroups: string[] = []
  try {
    if (workGroupsRes.data?.value) {
      workGroups = JSON.parse(workGroupsRes.data.value)
    }
  } catch {}

  let projectOrder: string[] = []
  try {
    if (projectOrderRes.data?.value) {
      projectOrder = JSON.parse(projectOrderRes.data.value)
    }
  } catch {}

  // Sort projects to match main page (/projects) order:
  // 1. Group by defined work_groups in order
  // 2. Within each group: sort by projectOrder index, falling back to created_at desc
  // 3. Unassigned work groups at the end
  const sortedByOrder = [...rawProjects].sort((a, b) => {
    const idxA = projectOrder.indexOf(a.id)
    const idxB = projectOrder.indexOf(b.id)
    if (idxA !== -1 && idxB !== -1) return idxA - idxB
    if (idxA !== -1) return -1
    if (idxB !== -1) return 1
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  const projects: Project[] = []
  workGroups.forEach((wg) => {
    const inGroup = sortedByOrder.filter(
      (p) => (p.work_group || '').trim() === wg.trim()
    )
    projects.push(...inGroup)
  })

  const unassigned = sortedByOrder.filter(
    (p) =>
      !p.work_group ||
      !workGroups.some((wg) => wg.trim() === (p.work_group || '').trim())
  )
  projects.push(...unassigned)

  return (
    <div className="flex flex-col min-h-screen bg-[#f2f2f8] dark:bg-[#0d0d1c] print:bg-white print:h-auto print:min-h-0 print:overflow-visible">
      <ReadOnlyBanner />
      <div className="flex-1 flex flex-col min-h-screen max-w-full overflow-hidden print:overflow-visible print:h-auto print:min-h-0">
        <Header
          breadcrumb={['ระบบควบคุมงานก่อสร้าง', 'การเบิกจ่าย']}
          title="รายงานสถานะการเบิกจ่ายงบประมาณ"
          subtitle="รายงานสถานะงบประมาณ WBS / PR / PO / GR / IR และประมาณการเบิกจ่ายรายเดือน"
          user={user}
          actions={
            <div className="flex items-center gap-2">
              <Link
                href="/portfolio"
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-[#13132a] border border-slate-200 dark:border-[#252548] hover:bg-slate-50 dark:hover:bg-[#1e1e38] transition-colors cursor-pointer shadow-xs"
              >
                <TrendingUp size={14} className="text-primary-600 dark:text-primary-400" />
                <span>ภาพรวมทุกโครงการ</span>
              </Link>
            </div>
          }
        />
        <main className="flex-1 p-6">
          <DisbursementsClient
            projects={projects}
            milestones={milestones}
            tasks={tasks}
          />
        </main>
      </div>
    </div>
  )
}
