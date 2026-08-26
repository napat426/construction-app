import { supabase } from '@/lib/supabase'
import { Header } from '@/components/Header'
import { ProjectTabs } from '@/components/ProjectTabs'
import { MaterialsClient } from '@/components/MaterialsClient'
import { notFound } from 'next/navigation'
import type { Project, ProjectMaterial } from '@/lib/types'

export const dynamic = 'force-dynamic'

interface MaterialsPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: MaterialsPageProps) {
  const { id } = await params
  const { data } = await supabase.from('projects').select('name').eq('id', id).single()
  return {
    title: data ? `การจัดการวัสดุ - ${data.name}` : 'ไม่พบโครงการ',
  }
}

import { getCurrentUser } from '@/lib/auth'

export default async function ProjectMaterialsPage({ params }: MaterialsPageProps) {
  const { id } = await params
  const user = await getCurrentUser()

  const [projectRes, materialsRes] = await Promise.all([
    supabase.from('projects').select('*').eq('id', id).single(),
    supabase.from('materials').select('*').eq('project_id', id).order('created_at', { ascending: true }),
  ])

  const projectData = projectRes.data
  const projectError = projectRes.error
  if (projectError || !projectData) notFound()

  const materialsData = materialsRes.data

  const project = projectData as Project
  const materials = (materialsData as ProjectMaterial[]) || []

  return (
    <div className="flex min-h-screen bg-[#f2f2f8] dark:bg-[#0d0d1c]">
      <div className="flex-1 flex flex-col min-h-screen max-w-full overflow-hidden">
        <Header
          breadcrumb={['ระบบควบคุมงานก่อสร้าง', 'โครงการทั้งหมด', project.name, 'การจัดการวัสดุ']}
          title="การจัดการวัสดุและการอนุมัติ"
          subtitle="ติดตามสถานะการขออนุมัติวัสดุก่อสร้างและบันทึกผลการพิจารณา"
          user={user}
        />
        <main className="flex-1 p-6">
          <ProjectTabs projectId={project.id} />
          <MaterialsClient project={project} materials={materials} user={user} />
        </main>
      </div>
    </div>
  )
}
