import { supabase } from '@/lib/supabase'
import { Header } from '@/components/Header'
import { ProjectTabs } from '@/components/ProjectTabs'
import { DashboardClient } from '@/components/DashboardClient'
import { notFound } from 'next/navigation'
import type { Project, WBSTask, ProjectPayment, ProjectMilestone } from '@/lib/types'

// Force dynamic fetch for fresh real-time calculations
export const dynamic = 'force-dynamic'

interface ProjectPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: ProjectPageProps) {
  const { id } = await params
  const { data } = await supabase.from('projects').select('name').eq('id', id).single()
  return {
    title: data ? `${data.name} | แดชบอร์ดควบคุมงาน` : 'ไม่พบโครงการ',
  }
}

import { getCurrentUser } from '@/lib/auth'

export default async function ProjectDashboardPage({ params }: ProjectPageProps) {
  const { id } = await params
  const user = await getCurrentUser()

  // Fetch all project-related data in parallel
  const [
    projectRes,
    tasksRes,
    paymentsRes,
    milestonesRes
  ] = await Promise.all([
    supabase.from('projects').select('*').eq('id', id).single(),
    supabase.from('tasks').select('*').eq('project_id', id),
    supabase.from('project_payments').select('*').eq('project_id', id).order('payment_date', { ascending: true }),
    supabase.from('project_milestones').select('*').eq('project_id', id).order('milestone_no', { ascending: true }),
  ])

  const projectData = projectRes.data
  const projectError = projectRes.error
  if (projectError || !projectData) {
    console.error('Error fetching project:', projectError)
    notFound()
  }

  const tasksData = tasksRes.data
  const paymentsData = paymentsRes.data
  const milestonesData = milestonesRes.data

  const project = projectData as Project
  const tasks = (tasksData as WBSTask[]) || []
  const payments = (paymentsData as ProjectPayment[]) || []
  const milestones = (milestonesData as ProjectMilestone[]) || []

  return (
    <div className="flex min-h-screen bg-[#f2f2f8] dark:bg-[#0d0d1c]">
      <div className="flex-1 flex flex-col min-h-screen max-w-full overflow-hidden">
        <Header
          breadcrumb={['ระบบควบคุมงานก่อสร้าง', 'โครงการทั้งหมด', project.name]}
          title="แดชบอร์ดควบคุมโครงการ"
          subtitle="การบริหารจัดการ ติดตามความก้าวหน้า และควบคุมทางการเงิน"
          user={user}
        />

        <main className="flex-1 p-6">
          <ProjectTabs projectId={project.id} />
          <DashboardClient project={project} tasks={tasks} payments={payments} milestones={milestones} user={user} />
        </main>
      </div>
    </div>
  )
}
