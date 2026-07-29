import { supabase } from '@/lib/supabase'
import { Header } from '@/components/Header'
import { ProjectTabs } from '@/components/ProjectTabs'
import { ChecklistClient } from '@/components/ChecklistClient'
import { notFound } from 'next/navigation'
import type { Project } from '@/lib/types'
import { getCurrentUser } from '@/lib/auth'
import { getChecklistMasters, getProjectChecklistResults } from '@/app/actions/checklist'

export const dynamic = 'force-dynamic'

interface ChecklistPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: ChecklistPageProps) {
  const { id } = await params
  const { data } = await supabase.from('projects').select('name').eq('id', id).single()
  return {
    title: data ? `${data.name} | Checklist ตรวจรับงาน` : 'ไม่พบโครงการ',
  }
}

export default async function ProjectChecklistPage({ params }: ChecklistPageProps) {
  const { id } = await params
  const user = await getCurrentUser()

  const [projectRes, masters, results] = await Promise.all([
    supabase.from('projects').select('*').eq('id', id).single(),
    getChecklistMasters(),
    getProjectChecklistResults(id),
  ])

  if (projectRes.error || !projectRes.data) {
    notFound()
  }

  const project = projectRes.data as Project

  return (
    <div className="flex min-h-screen bg-[#f2f2f8] dark:bg-[#0d0d1c]">
      <div className="flex-1 flex flex-col min-h-screen max-w-full overflow-hidden">
        <Header
          breadcrumb={['ระบบควบคุมงานก่อสร้าง', 'โครงการทั้งหมด', project.name, 'Check list']}
          title="Checklist ตรวจรับงานก่อสร้าง"
          subtitle="รายการตรวจสอบรับมอบงานตามหมวดหมู่และมาตรฐานก่อสร้าง"
          user={user}
        />

        <main className="flex-1 p-6">
          <ProjectTabs projectId={project.id} />
          <ChecklistClient
            project={project}
            masters={masters}
            results={results}
            user={user}
          />
        </main>
      </div>
    </div>
  )
}
