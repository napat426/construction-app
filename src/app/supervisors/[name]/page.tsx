import { notFound } from 'next/navigation'
import { Header } from '@/components/Header'
import { getCurrentUser } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import type { Project } from '@/lib/types'
import {
  getSupervisorStorageData,
  getSupervisorsList,
} from '@/app/actions/supervisor_tasks'
import { getSupervisorAvatars } from '@/app/actions/settings'
import { SupervisorPortfolioClient } from '@/components/supervisors/SupervisorPortfolioClient'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ name: string }>
}

export default async function SupervisorPersonalPage({ params }: Props) {
  const resolvedParams = await params
  const rawName = resolvedParams.name
  const supervisorName = decodeURIComponent(rawName)

  const currentUser = await getCurrentUser()
  const [allSupervisors, supervisorAvatars] = await Promise.all([
    getSupervisorsList(),
    getSupervisorAvatars(),
  ])

  // Fetch all projects for linking & counting
  const { data: projectsData } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })

  const projects: Project[] = (projectsData as Project[]) || []

  // Fetch supervisor storage data
  const storageData = await getSupervisorStorageData()

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#f2f2f8] dark:bg-[#0a0a14] print:bg-white print:min-h-0">
      <Header
        breadcrumb={['ระบบควบคุมงานก่อสร้าง', 'แฟ้มผลงาน', supervisorName]}
        title={`แฟ้มสะสมผลงาน: ${supervisorName}`}
        subtitle="บันทึกภารกิจย่อย โครงการก่อสร้างหลัก และการประเมินผลงานรอบปี"
        user={currentUser}
      />

      <main className="flex-1 p-4 sm:p-6 print:p-0 print:m-0">
        <SupervisorPortfolioClient
          supervisorName={supervisorName}
          allSupervisors={allSupervisors}
          avatarUrl={supervisorAvatars[supervisorName] || null}
          allAvatars={supervisorAvatars}
          initialGroups={storageData.groups}
          initialTasks={storageData.tasks}
          projects={projects}
          currentUser={currentUser}
        />
      </main>
    </div>
  )
}
