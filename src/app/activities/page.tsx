import { supabase } from '@/lib/supabase'
import { Header } from '@/components/Header'
import { GlobalActivitiesClient } from '@/components/GlobalActivitiesClient'
import { getCurrentUser } from '@/lib/auth'
import { getGlobalActivityLogs } from '@/lib/auditLogger'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'ศูนย์รวมประวัติกิจกรรม | ระบบควบคุมงานก่อสร้าง',
  description: 'ตรวจสอบประวัติกิจกรรม ความเคลื่อนไหวทั้งหมดของทุกโครงการและงานส่วนกลาง',
}

interface PageProps {
  searchParams: Promise<{ projectId?: string }>
}

export default async function GlobalActivitiesPage({ searchParams }: PageProps) {
  const { projectId } = await searchParams
  const user = await getCurrentUser()

  const [projectsRes, initialLogs] = await Promise.all([
    supabase.from('projects').select('id, name').order('name'),
    getGlobalActivityLogs({ limit: 300 }),
  ])

  const projects = (projectsRes.data || []) as { id: string; name: string }[]

  return (
    <div className="flex min-h-screen bg-[#f2f2f8] dark:bg-[#0d0d1c]">
      <div className="flex-1 flex flex-col min-h-screen max-w-full overflow-hidden">
        <Header
          breadcrumb={['ระบบควบคุมงานก่อสร้าง', 'ประวัติกิจกรรม']}
          title="ศูนย์รวมประวัติกิจกรรม (Activity Center)"
          subtitle="ตรวจสอบประวัติความเคลื่อนไหวทั้งหมดในระบบ ทั้งโครงการและงานส่วนกลางอย่างโปร่งใส"
          user={user}
        />

        <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
          <GlobalActivitiesClient
            initialProjects={projects}
            initialLogs={initialLogs}
            defaultProjectId={projectId}
          />
        </main>
      </div>
    </div>
  )
}
