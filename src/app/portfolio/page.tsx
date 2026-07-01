import { supabase } from '@/lib/supabase'
import { Header } from '@/components/Header'
import { PortfolioClient } from '@/components/PortfolioClient'
import { getCurrentUser } from '@/lib/auth'
import { ReadOnlyBanner } from '@/components/ReadOnlyBanner'
import type { Project, WBSTask, ProjectMilestone } from '@/lib/types'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'ภาพรวมทุกโครงการ | ระบบควบคุมงานก่อสร้าง',
}

export default async function PortfolioPage() {
  const user = await getCurrentUser()

  // Fetch all projects, tasks, and milestones in parallel to avoid round-trip latencies
  const [projectsRes, tasksRes, milestonesRes] = await Promise.all([
    supabase.from('projects').select('*').order('created_at', { ascending: false }),
    supabase.from('tasks').select('*'),
    supabase.from('project_milestones').select('*').order('milestone_no', { ascending: true })
  ])

  const projects: Project[] = (projectsRes.data as Project[]) ?? []
  const tasks: WBSTask[] = (tasksRes.data as WBSTask[]) ?? []
  const milestones: ProjectMilestone[] = (milestonesRes.data as ProjectMilestone[]) ?? []

  return (
    <div className="flex flex-col min-h-screen bg-[#f2f2f8] dark:bg-[#0d0d1c]">
      <ReadOnlyBanner />
      <div className="flex-1 flex flex-col min-h-screen max-w-full overflow-hidden">
        <Header
          breadcrumb={['ระบบควบคุมงานก่อสร้าง', 'ภาพรวมทุกโครงการ']}
          title="ภาพรวมและเปรียบเทียบทุกโครงการ"
          subtitle="เปรียบเทียบความก้าวหน้าแผนงาน ต้นทุน และงวดชำระเงินสะสมของทุกโครงการ"
          user={user}
        />
        <main className="flex-1 p-6">
          <PortfolioClient projects={projects} tasks={tasks} milestones={milestones} user={user} />
        </main>
      </div>
    </div>
  )
}
