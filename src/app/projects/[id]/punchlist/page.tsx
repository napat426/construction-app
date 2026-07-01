import { supabase } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { ReadOnlyBanner } from '@/components/ReadOnlyBanner'
import { Header } from '@/components/Header'
import { ProjectTabs } from '@/components/ProjectTabs'
import { PunchListClient } from '@/components/PunchListClient'
import type { Project, PunchList, PunchItem } from '@/lib/types'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ProjectPunchListPage({ params }: Props) {
  const { id: projectId } = await params
  const user = await getCurrentUser()

  // Fetch project, punch lists, and items in parallel to avoid waterfalls
  const [projectRes, punchListsRes, punchItemsRes] = await Promise.all([
    supabase.from('projects').select('*').eq('id', projectId).single(),
    supabase.from('punch_lists').select('*').eq('project_id', projectId).order('created_at', { ascending: true }),
    supabase.from('punch_items').select('*, punch_lists!inner(project_id)').eq('punch_lists.project_id', projectId).order('sequence', { ascending: true })
  ])

  if (projectRes.error || !projectRes.data) {
    notFound()
  }

  const project: Project = projectRes.data as Project
  const punchLists: PunchList[] = (punchListsRes.data as PunchList[]) ?? []

  // Map out inner join artifacts from supabase filter query
  const punchItems: PunchItem[] = (punchItemsRes.data as any[])?.map(item => {
    const { punch_lists, ...rest } = item
    return rest as PunchItem
  }) ?? []

  return (
    <div className="flex flex-col min-h-screen bg-[#f2f2f8] dark:bg-[#0d0d1c]">
      <ReadOnlyBanner />
      <div className="flex-1 flex flex-col min-h-screen max-w-full overflow-hidden">
        <Header
          breadcrumb={['ระบบควบคุมงานก่อสร้าง', project.name, 'Punch List']}
          title={`โครงการ: ${project.name}`}
          subtitle={`ผู้ควบคุมงาน: ${project.supervisor}`}
          user={user}
        />
        <main className="flex-1 p-6">
          <ProjectTabs projectId={projectId} />
          <PunchListClient
            project={project}
            initialPunchLists={punchLists}
            initialPunchItems={punchItems}
            user={user}
          />
        </main>
      </div>
    </div>
  )
}
