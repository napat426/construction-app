import { supabase } from '@/lib/supabase'
import { Header } from '@/components/Header'
import { PresentationClient } from '@/components/PresentationClient'
import { getCurrentUser } from '@/lib/auth'
import { notFound, redirect } from 'next/navigation'
import type { Project, WBSTask, Inspection, ProjectPayment } from '@/lib/types'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Presentation Mode | ระบบควบคุมงานก่อสร้าง',
}

export default async function PresentationPage() {
  const user = await getCurrentUser()
  if (!user) {
    redirect('/login')
  }

  // Fetch all necessary data for the presentation (memory caching via Client Component)
  const [projectsRes, tasksRes, inspectionsRes, milestonesRes, dailyRes, concreteRes, suspensionsRes, amendmentsRes] = await Promise.all([
    supabase.from('projects').select('*').order('created_at', { ascending: false }),
    supabase.from('tasks').select('*'),
    supabase.from('inspections').select('*').order('created_at', { ascending: false }),
    supabase.from('project_milestones').select('*').order('milestone_no', { ascending: true }),
    supabase.from('daily_reports').select('project_id, photos, created_at').order('created_at', { ascending: false }),
    supabase.from('concrete_pours').select('project_id, photos, created_at').order('created_at', { ascending: false }),
    supabase.from('contract_suspensions').select('*').order('suspend_date', { ascending: true }),
    supabase.from('contract_amendments').select('*').order('amendment_no', { ascending: true })
  ])

  const projects = (projectsRes.data as Project[]) ?? []
  const tasks = (tasksRes.data as WBSTask[]) ?? []
  const inspections = (inspectionsRes.data as Inspection[]) ?? []
  const milestones = milestonesRes.data ?? []
  const dailyReports = dailyRes.data ?? []
  const concretePours = concreteRes.data ?? []
  const suspensions = suspensionsRes.data ?? []
  const amendments = (amendmentsRes.data as any[]) ?? []

  return (
    <div className="flex min-h-screen bg-[#f2f2f8] dark:bg-[#0d0d1c]">
      <div className="flex-1 flex flex-col min-h-screen max-w-full overflow-hidden">
        <Header
          breadcrumb={['ระบบควบคุมงานก่อสร้าง', 'นำเสนองาน (Presentation)']}
          title="Presentation Mode"
          subtitle="เลือกโครงการและปรับแต่งสไลด์สำหรับการนำเสนอ"
          user={user}
        />
        <main className="flex-1 p-6 flex flex-col">
          <PresentationClient 
            initialProjects={projects} 
            initialTasks={tasks} 
            initialInspections={inspections}
            initialMilestones={milestones}
            initialDailyReports={dailyReports}
            initialConcretePours={concretePours}
            initialSuspensions={suspensions}
            initialAmendments={amendments}
            user={user}
          />
        </main>
      </div>
    </div>
  )
}
