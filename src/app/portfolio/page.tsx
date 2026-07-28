import { supabase } from '@/lib/supabase'
import { Header } from '@/components/Header'
import { PortfolioClient } from '@/components/PortfolioClient'
import { getCurrentUser } from '@/lib/auth'
import { ReadOnlyBanner } from '@/components/ReadOnlyBanner'
import type { Project, WBSTask, ProjectMilestone, PunchList, PunchItem, ContractAmendment } from '@/lib/types'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'ภาพรวมทุกโครงการ | ระบบควบคุมงานก่อสร้าง',
}

export default async function PortfolioPage() {
  const user = await getCurrentUser()

  // Fetch all projects, tasks, milestones, punch lists, and punch items in parallel
  const [projectsRes, tasksRes, milestonesRes, punchListsRes, punchItemsRes, amendmentsRes, workGroupsRes] = await Promise.all([
    supabase.from('projects').select('*').order('created_at', { ascending: false }),
    supabase.from('tasks').select('*'),
    supabase.from('project_milestones').select('*').order('milestone_no', { ascending: true }),
    supabase.from('punch_lists').select('*'),
    supabase.from('punch_items').select('*').order('sequence', { ascending: true }),
    supabase.from('contract_amendments').select('*').order('amendment_no', { ascending: true }),
    supabase.from('system_settings').select('*').eq('key', 'work_groups').single()
  ])

  const projects: Project[] = (projectsRes.data as Project[]) ?? []
  const tasks: WBSTask[] = (tasksRes.data as WBSTask[]) ?? []
  const milestones: ProjectMilestone[] = (milestonesRes.data as ProjectMilestone[]) ?? []
  const punchLists: PunchList[] = (punchListsRes.data as PunchList[]) ?? []
  const punchItems: PunchItem[] = (punchItemsRes.data as PunchItem[]) ?? []
  const amendments: ContractAmendment[] = (amendmentsRes.data as ContractAmendment[]) ?? []

  let workGroups: string[] = []
  try {
    if (workGroupsRes.data?.value) {
      workGroups = JSON.parse(workGroupsRes.data.value)
    }
  } catch {}

  return (
    <div className="flex flex-col min-h-screen bg-[#f2f2f8] dark:bg-[#0d0d1c]">
      <ReadOnlyBanner />
      <div className="flex-1 flex flex-col min-h-screen max-w-full overflow-hidden">
        <Header
          breadcrumb={['ระบบควบคุมงานก่อสร้าง', 'ภาพรวมทุกโครงการ']}
          title="ภาพรวมและเปรียบเทียบทุกโครงการ"
          subtitle="เปรียบเทียบความก้าวหน้าแผนงาน ต้นทุน และงวดชำระเงินสะสม of ทุกโครงการ"
          user={user}
        />
        <main className="flex-1 p-6">
          <PortfolioClient
            projects={projects}
            tasks={tasks}
            milestones={milestones}
            punchLists={punchLists}
            punchItems={punchItems}
            amendments={amendments}
            user={user}
            workGroups={workGroups}
          />
        </main>
      </div>
    </div>
  )
}
