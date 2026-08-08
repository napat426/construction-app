import { supabase } from '@/lib/supabase'
import { Header } from '@/components/Header'
import { ProjectTabs } from '@/components/ProjectTabs'
import { NotesClient } from '@/components/notes/NotesClient'
import { notFound } from 'next/navigation'
import type { Project } from '@/lib/types'
import { getCurrentUser } from '@/lib/auth'
import { getNotesByProject, getNoteFolders } from '@/app/actions/notes'

export const dynamic = 'force-dynamic'

interface NotesPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: NotesPageProps) {
  const { id } = await params
  const { data } = await supabase.from('projects').select('name').eq('id', id).single()
  return {
    title: data ? `${data.name} | Notes บันทึกงาน` : 'ไม่พบโครงการ',
  }
}

export default async function ProjectNotesPage({ params }: NotesPageProps) {
  const { id } = await params
  const user = await getCurrentUser()

  const [projectRes, notes, folders] = await Promise.all([
    supabase.from('projects').select('*').eq('id', id).single(),
    getNotesByProject(id),
    getNoteFolders(id),
  ])

  if (projectRes.error || !projectRes.data) {
    notFound()
  }

  const project = projectRes.data as Project

  return (
    <div className="flex min-h-screen bg-[#f2f2f8] dark:bg-[#0d0d1c]">
      <div className="flex-1 flex flex-col min-h-screen max-w-full overflow-hidden">
        <Header
          breadcrumb={['ระบบควบคุมงานก่อสร้าง', 'โครงการทั้งหมด', project.name, 'Notes']}
          title="Notes บันทึกงาน"
          subtitle="จดบันทึก ความคิด และข้อมูลสำคัญเกี่ยวกับโครงการ"
          user={user}
        />

        <main className="flex-1 p-6">
          <ProjectTabs projectId={project.id} />
          <NotesClient
            project={project}
            initialNotes={notes}
            initialFolders={folders}
            user={user}
          />
        </main>
      </div>
    </div>
  )
}
