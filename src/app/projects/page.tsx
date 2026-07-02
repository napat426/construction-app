import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { Header } from '@/components/Header'
import { ProjectsClient } from '@/components/ProjectsClient'
import type { Project } from '@/lib/types'

// Always fetch fresh data from Supabase (no caching in Next.js 16 by default)
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'โครงการทั้งหมด | ระบบควบคุมงานก่อสร้าง',
}

import { getCurrentUser } from '@/lib/auth'

export default async function ProjectsPage() {
  const user = await getCurrentUser()

  const [projectsRes, tasksRes] = await Promise.all([
    supabase.from('projects').select('*').order('created_at', { ascending: false }),
    supabase.from('tasks').select('*')
  ])

  const projects: Project[] = (projectsRes.data as Project[]) ?? []
  const error = projectsRes.error
  const tasks = tasksRes.data ?? []

  return (
    <div className="flex min-h-screen bg-[#f2f2f8] dark:bg-[#0d0d1c]">
      <div className="flex-1 flex flex-col min-h-screen max-w-full overflow-hidden">
        <Header
          breadcrumb={['ระบบควบคุมงานก่อสร้าง', 'โครงการ']}
          title="โครงการทั้งหมด"
          subtitle={
            projects.length > 0
              ? `${projects.length} โครงการในระบบ`
              : 'ยังไม่มีโครงการ'
          }
          actions={
            <Link
              href="/presentation"
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl shadow-md transition-colors"
            >
              📽 Presentation
            </Link>
          }
          user={user}
        />

        <main className="flex-1 p-6">
          {/* DB error banner */}
          {error && (
            <div className="mb-5 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-600 dark:text-red-400 flex items-start gap-2">
              <span className="flex-shrink-0">⚠️</span>
              <div>
                <p className="font-semibold">ไม่สามารถโหลดข้อมูลได้</p>
                <p className="text-xs mt-0.5 opacity-80">{error.message}</p>
              </div>
            </div>
          )}

          <ProjectsClient initialProjects={projects} initialTasks={tasks} user={user} />
        </main>
      </div>
    </div>
  )
}
