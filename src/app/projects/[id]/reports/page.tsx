import { supabase } from '@/lib/supabase'
import { Header } from '@/components/Header'
import { ProjectTabs } from '@/components/ProjectTabs'
import { ReportsClient } from '@/components/ReportsClient'
import { notFound } from 'next/navigation'
import type { 
  Project, 
  Inspection, 
  DailyReport, 
  WeeklyReport,
  WBSTask,
  ProjectMilestone,
  ContractSuspension
} from '@/lib/types'

export const dynamic = 'force-dynamic'

interface ReportsPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: ReportsPageProps) {
  const { id } = await params
  const { data } = await supabase.from('projects').select('name').eq('id', id).single()
  return {
    title: data ? `ตรวจงาน & รายงาน - ${data.name}` : 'ไม่พบโครงการ',
  }
}

import { getCurrentUser } from '@/lib/auth'

export default async function ProjectReportsPage({ params }: ReportsPageProps) {
  const { id } = await params
  const user = await getCurrentUser()

  // Fetch Project and all related data in parallel
  const [
    projectRes,
    inspectionsRes,
    dailyRes,
    weeklyRes,
    tasksRes,
    milestonesRes,
    concreteRes,
    suspensionsRes
  ] = await Promise.all([
    supabase.from('projects').select('*').eq('id', id).single(),
    supabase.from('inspections').select('*').eq('project_id', id).order('sort_order', { ascending: true }),
    supabase.from('daily_reports').select('*').eq('project_id', id).order('sort_order', { ascending: true }),
    supabase.from('weekly_reports').select('*').eq('project_id', id).order('sort_order', { ascending: true }),
    supabase.from('tasks').select('*').eq('project_id', id).order('wbs_no', { ascending: true }),
    supabase.from('project_milestones').select('*').eq('project_id', id).order('milestone_no', { ascending: true }),
    supabase.from('concrete_pours').select('*').eq('project_id', id).order('sequence', { ascending: true }),
    supabase.from('contract_suspensions').select('*').eq('project_id', id).order('suspend_date', { ascending: true })
  ])

  const projectData = projectRes.data
  const projectError = projectRes.error
  if (projectError || !projectData) notFound()

  const inspectionsData = inspectionsRes.data
  const dailyData = dailyRes.data
  const weeklyData = weeklyRes.data
  const tasksData = tasksRes.data
  const milestonesData = milestonesRes.data
  const concreteData = concreteRes.data
  const suspensionsData = suspensionsRes.data

  return (
    <div className="flex min-h-screen bg-[#f2f2f8] dark:bg-[#0d0d1c] print:block print:min-h-0 print:bg-white">
      <div className="flex-1 flex flex-col min-h-screen max-w-full overflow-hidden print:block print:overflow-visible print:min-h-0 print:ml-0">
        <div className="print:hidden">
          <Header
            breadcrumb={['ระบบควบคุมงานก่อสร้าง', 'โครงการทั้งหมด', projectData.name, 'ตรวจงาน & รายงาน']}
            title="ระบบตรวจงานและรายงานความก้าวหน้า"
            subtitle="จัดการขอตรวจคุณภาพงาน, รายงานประจำวัน และพิมพ์รายงานประจำสัปดาห์ (พร้อม Gantt/S-Curve)"
            user={user}
          />
        </div>
        
        <main className="flex-1 p-6 print:p-0 print:block">
          <div className="print:hidden">
            <ProjectTabs projectId={projectData.id} />
          </div>
          
          <ReportsClient 
            project={projectData as Project}
            inspections={(inspectionsData as Inspection[]) || []}
            dailyReports={(dailyData as DailyReport[]) || []}
            weeklyReports={(weeklyData as WeeklyReport[]) || []}
            concretePours={(concreteData as any[]) || []}
            tasks={(tasksData as WBSTask[]) || []}
            milestones={(milestonesData as ProjectMilestone[]) || []}
            suspensions={(suspensionsData as ContractSuspension[]) || []}
            user={user}
          />
        </main>
      </div>
    </div>
  )
}
