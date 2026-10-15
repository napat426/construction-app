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

  const [projectsRes, tasksRes, milestonesRes] = await Promise.all([
    supabase.from('projects').select('*').order('created_at', { ascending: false }),
    supabase.from('tasks').select('*'),
    supabase.from('project_milestones').select('*').order('milestone_no', { ascending: true }),
  ])

  const projects: Project[] = (projectsRes.data as Project[]) ?? []
  const tasks: WBSTask[] = (tasksRes.data as WBSTask[]) ?? []
  const milestones: ProjectMilestone[] = (milestonesRes.data as ProjectMilestone[]) ?? []

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
