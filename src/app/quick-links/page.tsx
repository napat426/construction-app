import { Header } from '@/components/Header'
import { getCurrentUser } from '@/lib/auth'
import { getQuickLinks } from '@/app/actions/quick_links'
import { QuickLinksPageClient } from '@/components/QuickLinksPageClient'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'คลังลิงก์ & โน้ตสำคัญ | ระบบควบคุมงานก่อสร้าง',
}

export default async function QuickLinksPage() {
  const user = await getCurrentUser()
  const quickLinksData = await getQuickLinks()

  return (
    <div className="flex min-h-screen bg-[#f2f2f8] dark:bg-[#0d0d1c]">
      <div className="flex-1 flex flex-col min-h-screen max-w-full overflow-hidden">
        <Header
          breadcrumb={['ระบบควบคุมงานก่อสร้าง', 'คลังลิงก์ & โน้ตสำคัญ']}
          title="คลังลิงก์ & โน้ตสำคัญ"
          subtitle="ศูนย์รวมลิงก์ด่วน แบบแปลน และบันทึกข้อความสำคัญของโครงการ"
          user={user}
        />

        <main className="flex-1 p-6">
          <QuickLinksPageClient initialData={quickLinksData} userRole={user?.role} />
        </main>
      </div>
    </div>
  )
}
