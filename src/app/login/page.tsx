'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LogIn, User, Lock, Loader2, ArrowLeft } from 'lucide-react'
import { loginUser } from '@/app/actions/user'

export default function LoginPage() {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    const fd = new FormData(e.currentTarget)

    startTransition(async () => {
      const res = await loginUser(null, fd)
      if (res?.error) {
        setError(res.error)
      } else {
        // Refresh router to sync server components and redirect
        router.refresh()
        router.push('/')
      }
    })
  }

  const inputCls =
    'w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-[#252548] bg-slate-50 dark:bg-[#1a1a32] text-sm font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:bg-white dark:focus:bg-[#14142a] transition-all'

  return (
    <div className="min-h-screen bg-[#f2f2f8] dark:bg-[#0d0d1c] flex flex-col justify-center items-center p-4">
      {/* Back button */}
      <Link
        href="/"
        className="absolute top-6 left-6 flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-primary-600 dark:text-slate-400 dark:hover:text-primary-400 transition-colors"
      >
        <ArrowLeft size={14} />
        กลับไปโหมดดูข้อมูล
      </Link>

      <div className="card rounded-2xl w-full max-w-md shadow-2xl overflow-hidden p-8 border border-slate-200 dark:border-[#252548] bg-white dark:bg-[#14142a]">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-[#cc4ac8] to-[#a13c9d] flex items-center justify-center text-white mx-auto shadow-md shadow-primary-500/20 mb-3">
            <LogIn size={22} />
          </div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">เข้าสู่ระบบควบคุมงาน</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">กรอกข้อมูลบัญชีเพื่อเข้าใช้งานระบบเต็มรูปแบบ</p>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs font-semibold text-red-600 dark:text-red-400">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
              Username
            </label>
            <div className="relative">
              <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                name="username"
                type="text"
                required
                placeholder="ระบุชื่อบัญชีผู้ใช้"
                className={inputCls}
                disabled={isPending}
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                name="password"
                type="password"
                required
                placeholder="ระบุรหัสผ่านของคุณ"
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
                กำลังเข้าระบบ...
              </>
            ) : (
              <>
                <LogIn size={16} />
                เข้าสู่ระบบ
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-[#1e1e38] text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            ยังไม่มีบัญชีใช้งาน?{' '}
            <Link
              href="/register"
              className="font-bold text-[#a13c9d] hover:text-[#cc4ac8] transition-colors"
            >
              สมัครสมาชิกใหม่
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
