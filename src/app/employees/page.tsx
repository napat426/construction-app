import { Header } from '@/components/Header'
import { getCurrentUser } from '@/lib/auth'
import Link from 'next/link'
import { getEmployees } from '@/app/actions/employees'
import EmployeesClient from '@/components/EmployeesClient'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'ข้อมูลพนักงาน กรย.(ก3) | ระบบควบคุมงานก่อสร้าง',
}

export default async function EmployeesPage() {
  const user = await getCurrentUser()
  const { data: employees, error } = await getEmployees()

  return (
    <div className="flex min-h-screen bg-[#f2f2f8] dark:bg-[#0d0d1c]">
      <div className="flex-1 flex flex-col min-h-screen max-w-full overflow-hidden">
        <Header
          breadcrumb={['ระบบควบคุมงานก่อสร้าง', 'ข้อมูลบุคลากร']}
          title="ข้อมูลพนักงาน กรย.(ก3)"
          subtitle={
            employees && employees.length > 0
              ? `มีพนักงานทั้งหมด ${employees.length} คนในระบบ`
              : 'ระบบข้อมูลบุคลากร'
          }
          actions={
            <Link
              href="/projects"
              className="flex items-center gap-2 px-4 py-2 bg-slate-200 dark:bg-[#252548] hover:bg-slate-300 dark:hover:bg-[#32325c] text-slate-800 dark:text-slate-200 font-bold rounded-xl shadow-sm transition-colors"
            >
              ⬅ กลับหน้าหลัก
            </Link>
          }
          user={user}
        />

        <main className="flex-1 p-6 overflow-hidden flex flex-col">
          {error && (
            <div className="mb-5 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-600 dark:text-red-400 flex items-start gap-2 flex-shrink-0">
              <span className="flex-shrink-0">⚠️</span>
              <div>
                <p className="font-semibold">ไม่สามารถโหลดข้อมูลได้ (หากเพิ่งสร้างระบบ กรุณารัน SQL Migration ใน Supabase)</p>
                <p className="text-xs mt-0.5 opacity-80">{error.message}</p>
              </div>
            </div>
          )}

          <div className="flex-1 bg-white dark:bg-[#14142a] rounded-2xl shadow-sm border border-slate-200 dark:border-[#1c1c34] overflow-hidden flex flex-col">
             <EmployeesClient initialEmployees={employees || []} />
          </div>
        </main>
      </div>
    </div>
  )
}
