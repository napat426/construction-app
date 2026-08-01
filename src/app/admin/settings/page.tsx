import { redirect } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { Header } from '@/components/Header'
import { AdminSettingsClient } from '@/components/AdminSettingsClient'

export const dynamic = 'force-dynamic'

export default async function AdminSettingsPage() {
  const currentUser = await getCurrentUser()

  // Guard: Only allow approved admins
  if (!currentUser || currentUser.role !== 'admin' || currentUser.status !== 'approved') {
    redirect('/')
  }

  // Fetch settings and projects
  const [{ data: settingsData, error }, { data: projectsData }] = await Promise.all([
    supabase.from('system_settings').select('key, value'),
    supabase.from('projects').select('id, name, status, supervisor').order('created_at', { ascending: false }),
  ])

  const initialSettings = (settingsData || []).reduce((acc: Record<string, string>, curr) => {
    acc[curr.key] = curr.value
    return acc
  }, {})

  return (
    <div className="flex min-h-screen bg-[#f2f2f8] dark:bg-[#0d0d1c]">
      <div className="flex-1 flex flex-col min-h-screen max-w-full overflow-hidden">
        <Header
          breadcrumb={['ระบบควบคุมงานก่อสร้าง', 'ตั้งค่าระบบ']}
          title="ตั้งค่าระบบ"
          subtitle="จัดการการตั้งค่าต่างๆ ภายในระบบ"
        />

        <main className="flex-1 p-6 max-w-4xl mx-auto w-full">
          {error && (
            <div className="mb-5 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-600 dark:text-red-400">
              ⚠️ ไม่สามารถโหลดข้อมูลตั้งค่าได้: {error.message}
            </div>
          )}

          <AdminSettingsClient initialSettings={initialSettings} projects={projectsData || []} />
        </main>
      </div>
    </div>
  )
}
