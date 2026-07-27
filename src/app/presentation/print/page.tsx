import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { PrintPageClient } from '@/components/PrintPageClient'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Print Slides | ระบบควบคุมงานก่อสร้าง',
}

export default async function PresentationPrintPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const [projectsRes, tasksRes, milestonesRes, amendmentsRes, inspectionsRes, dailyRes, concreteRes] = await Promise.all([
    supabase.from('projects').select('*'),
    supabase.from('tasks').select('*'),
    supabase.from('project_milestones').select('*').order('milestone_no', { ascending: true }),
    supabase.from('contract_amendments').select('*').order('amendment_no', { ascending: true }),
    supabase.from('inspections').select('*'),
    supabase.from('daily_reports').select('project_id, photos, created_at'),
    supabase.from('concrete_pours').select('project_id, photos, created_at'),
  ])

  return (
    <PrintPageClient
      allProjects={projectsRes.data ?? []}
      allTasks={tasksRes.data ?? []}
      allMilestones={milestonesRes.data ?? []}
      allAmendments={amendmentsRes.data ?? []}
      allInspections={inspectionsRes.data ?? []}
      allDailyReports={dailyRes.data ?? []}
      allConcretePours={concreteRes.data ?? []}
    />
  )
}

