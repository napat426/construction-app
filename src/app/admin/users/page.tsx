import { redirect } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { Header } from '@/components/Header'
import { AdminUsersClient } from '@/components/AdminUsersClient'

export const dynamic = 'force-dynamic'

export default async function AdminUsersPage() {
  const currentUser = await getCurrentUser()

  // Guard: Only allow approved admins
  if (!currentUser || currentUser.role !== 'admin' || currentUser.status !== 'approved') {
    redirect('/')
  }

  // Fetch all user profiles
  const { data: profiles, error } = await supabase
    .from('user_profiles')
    .select('*')
    .order('created_at', { ascending: false })

  const users = profiles || []

  return (
    <div className="flex min-h-screen bg-[#f2f2f8] dark:bg-[#0d0d1c]">
      <div className="flex-1 flex flex-col min-h-screen max-w-full overflow-hidden">
        <Header
          breadcrumb={['ระบบควบคุมงานก่อสร้าง', 'จัดการผู้ใช้']}
          title="การจัดการสิทธิ์และผู้ใช้งาน"
          subtitle="อนุมัติใบสมัครสมาชิกใหม่ กำหนดบทบาท และระงับบัญชีผู้ใช้ในระบบ"
        />

        <main className="flex-1 p-6">
          {error && (
            <div className="mb-5 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-600 dark:text-red-400">
              ⚠️ ไม่สามารถโหลดข้อมูลผู้ใช้ได้: {error.message}
            </div>
          )}

          <AdminUsersClient initialUsers={users} currentUser={currentUser} />
        </main>
      </div>
    </div>
  )
}
