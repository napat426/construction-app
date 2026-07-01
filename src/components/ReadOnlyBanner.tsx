import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'

export async function ReadOnlyBanner() {
  const user = await getCurrentUser()
  
  // If user is logged in, do not render the banner
  if (user) return null

  return (
    <div className="w-full bg-gradient-to-r from-amber-500 to-amber-600 dark:from-amber-600 dark:to-amber-700 text-white py-2.5 px-4 text-center flex items-center justify-center gap-4 text-xs font-bold shadow-sm print:hidden select-none flex-shrink-0">
      <span>👀 คุณกำลังใช้งานในโหมดดูข้อมูลเท่านั้น (สิทธิ์การเพิ่ม/แก้ไข/ลบ/พิมพ์ ถูกซ่อนทั้งหมด)</span>
      <Link
        href="/login"
        className="bg-white hover:bg-slate-100 text-amber-700 px-3 py-1 rounded-lg text-[11px] font-bold shadow-sm transition-colors"
      >
        เข้าสู่ระบบ
      </Link>
    </div>
  )
}
