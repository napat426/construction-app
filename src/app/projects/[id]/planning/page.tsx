import { supabase } from '@/lib/supabase'
import { Header } from '@/components/Header'
import { ProjectTabs } from '@/components/ProjectTabs'
import { PlanningClient } from '@/components/PlanningClient'
import { notFound } from 'next/navigation'
import type { Project, WBSTask, ProjectPayment, ProjectMilestone } from '@/lib/types'

export const dynamic = 'force-dynamic'

interface PlanningPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PlanningPageProps) {
  const { id } = await params
  const { data } = await supabase.from('projects').select('name').eq('id', id).single()
  return {
    title: data ? `แผนงานและความก้าวหน้า - ${data.name}` : 'ไม่พบโครงการ',
  }
}

import { getCurrentUser } from '@/lib/auth'

export default async function ProjectPlanningPage({ params }: PlanningPageProps) {
  const { id } = await params
  const user = await getCurrentUser()

  // Fetch all planning-related data in parallel
  const [
    projectRes,
    tasksRes,
    paymentsRes,
    milestonesRes
  ] = await Promise.all([
    supabase.from('projects').select('*').eq('id', id).single(),
    supabase.from('tasks').select('*').eq('project_id', id).order('wbs_no', { ascending: true }),
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
          breadcrumb={['ระบบควบคุมงานก่อสร้าง', 'โครงการทั้งหมด', project.name, 'แผนงาน & WBS']}
          title="แผนงานและความก้าวหน้าโครงการ"
          subtitle="จัดการโครงสร้างงานย่อย (WBS) สรุปความก้าวหน้าถ่วงน้ำหนัก Gantt Chart และ S-Curve"
          user={user}
        />

        <main className="flex-1 p-6">
          <ProjectTabs projectId={project.id} />
          <PlanningClient project={project} tasks={tasks} payments={payments} milestones={milestones} user={user} />
        </main>
      </div>
    </div>
  )
}
