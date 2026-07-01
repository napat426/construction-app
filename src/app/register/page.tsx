'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { UserPlus, User, Lock, Loader2, ArrowLeft, CheckCircle2, ShieldAlert } from 'lucide-react'
import { registerUser } from '@/app/actions/user'

export default function RegisterPage() {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [isRegistered, setIsRegistered] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    const fd = new FormData(e.currentTarget)

    startTransition(async () => {
      const res = await registerUser(null, fd)
      if (res?.error) {
        setError(res.error)
      } else {
        setIsRegistered(true)
      }
    })
  }

  const inputCls =
    'w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-[#252548] bg-slate-50 dark:bg-[#1a1a32] text-sm font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:bg-white dark:focus:bg-[#14142a] transition-all'

  if (isRegistered) {
    return (
      <div className="min-h-screen bg-[#f2f2f8] dark:bg-[#0d0d1c] flex flex-col justify-center items-center p-4">
        <div className="card rounded-2xl w-full max-w-md shadow-2xl p-8 border border-slate-200 dark:border-[#252548] bg-white dark:bg-[#14142a] text-center space-y-5">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto animate-pulse">
            <ShieldAlert size={36} />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-black text-slate-900 dark:text-white">ส่งคำขอลงทะเบียนสำเร็จ</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              บัญชีของคุณอยู่ในสถานะ <span className="font-bold text-amber-600 dark:text-amber-400">รอการตรวจสอบและอนุมัติ (Pending)</span> จากผู้ดูแลระบบ
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
              กรุณาแจ้งผู้ดูแลระบบเพื่อทำการตรวจสอบและเปลี่ยนสิทธิ์การเข้าถึงข้อมูลระบบควบคุมงานก่อสร้าง
            </p>
          </div>
          <div className="pt-3">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#1e1e38] dark:hover:bg-[#252548] text-xs font-bold text-slate-700 dark:text-slate-300 transition-colors"
            >
              <ArrowLeft size={13} />
              กลับไปหน้าเข้าสู่ระบบ
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f2f2f8] dark:bg-[#0d0d1c] flex flex-col justify-center items-center p-4">
      {/* Back to Login */}
      <Link
        href="/login"
        className="absolute top-6 left-6 flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-primary-600 dark:text-slate-400 dark:hover:text-primary-400 transition-colors"
      >
        <ArrowLeft size={14} />
        กลับไปหน้าเข้าสู่ระบบ
      </Link>

      <div className="card rounded-2xl w-full max-w-md shadow-2xl overflow-hidden p-8 border border-slate-200 dark:border-[#252548] bg-white dark:bg-[#14142a]">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-[#cc4ac8] to-[#a13c9d] flex items-center justify-center text-white mx-auto shadow-md shadow-primary-500/20 mb-3">
            <UserPlus size={22} />
          </div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">สมัครสมาชิกใหม่</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">ส่งคำขอเพื่อรับสิทธิ์เข้าทำงานร่วมกันในโครงการ</p>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs font-semibold text-red-600 dark:text-red-400">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
              Username <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                name="username"
                type="text"
                required
                placeholder="ตั้งชื่อบัญชีผู้ใช้ (ไม่ใช่ Email)"
                className={inputCls}
                disabled={isPending}
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
              ชื่อแสดงในระบบ (Display Name) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                name="display_name"
                type="text"
                required
                placeholder="เช่น วิศวกรสมศักดิ์, โฟร์แมนสมหมาย"
                className={inputCls}
                disabled={isPending}
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
              Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                name="password"
                type="password"
                required
                placeholder="รหัสผ่านอย่างน้อย 6 ตัวอักษร"
                className={inputCls}
                disabled={isPending}
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
              Confirm Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                name="confirm_password"
                type="password"
                required
                placeholder="ป้อนรหัสผ่านอีกครั้งเพื่อยืนยัน"
                className={inputCls}
                disabled={isPending}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full btn-primary py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md shadow-primary-500/10 disabled:opacity-50"
          >
            {isPending ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                กำลังลงทะเบียน...
              </>
            ) : (
              <>
                <UserPlus size={16} />
                ส่งคำขอใช้งาน
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-[#1e1e38] text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            มีบัญชีผู้ใช้อยู่แล้ว?{' '}
            <Link
              href="/login"
              className="font-bold text-[#a13c9d] hover:text-[#cc4ac8] transition-colors"
            >
              เข้าสู่ระบบที่นี่
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
