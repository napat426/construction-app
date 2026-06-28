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
  ProjectPayment,
  ProjectMilestone
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

export default async function ProjectReportsPage({ params }: ReportsPageProps) {
  const { id } = await params

  // Fetch Project
  const { data: projectData, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single()

  if (projectError || !projectData) notFound()

  // Fetch all related data in parallel
  const [
    { data: inspectionsData },
    { data: dailyData },
    { data: weeklyData },
    { data: tasksData },
    { data: paymentsData },
    { data: milestonesData }
  ] = await Promise.all([
    supabase.from('inspections').select('*').eq('project_id', id).order('sort_order', { ascending: true }),
    supabase.from('daily_reports').select('*').eq('project_id', id).order('sort_order', { ascending: true }),
    supabase.from('weekly_reports').select('*').eq('project_id', id).order('sort_order', { ascending: true }),
    supabase.from('tasks').select('*').eq('project_id', id).order('wbs_no', { ascending: true }),
    supabase.from('project_payments').select('*').eq('project_id', id).order('payment_date', { ascending: true }),
    supabase.from('project_milestones').select('*').eq('project_id', id).order('milestone_no', { ascending: true }),
  ])

  return (
    <div className="flex min-h-screen bg-[#f2f2f8] dark:bg-[#0d0d1c]">
      <div className="flex-1 flex flex-col min-h-screen max-w-full overflow-hidden print:ml-0">
        <div className="print:hidden">
          <Header
            breadcrumb={['ระบบควบคุมงานก่อสร้าง', 'โครงการทั้งหมด', projectData.name, 'ตรวจงาน & รายงาน']}
            title="ระบบตรวจงานและรายงานความก้าวหน้า"
            subtitle="จัดการขอตรวจคุณภาพงาน, รายงานประจำวัน และพิมพ์รายงานประจำสัปดาห์ (พร้อม Gantt/S-Curve)"
          />
        </div>
        
        <main className="flex-1 p-6 print:p-0">
          <div className="print:hidden">
            <ProjectTabs projectId={projectData.id} />
          </div>
          
          <ReportsClient 
            project={projectData as Project}
            inspections={(inspectionsData as Inspection[]) || []}
            dailyReports={(dailyData as DailyReport[]) || []}
            weeklyReports={(weeklyData as WeeklyReport[]) || []}
            tasks={(tasksData as WBSTask[]) || []}
            payments={(paymentsData as ProjectPayment[]) || []}
            milestones={(milestonesData as ProjectMilestone[]) || []}
          />
        </main>
      </div>
    </div>
  )
}
