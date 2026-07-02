'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Building2,
  LayoutDashboard,
  FileBarChart2,
  Users,
  Package,
  Wallet,
  Settings,
  HardHat,
  ChevronRight,
  MonitorPlay,
} from 'lucide-react'

const navItems = [
  { href: '/projects',    icon: Building2,      label: 'โครงการทั้งหมด' },
  { href: '/presentation', icon: MonitorPlay,    label: 'นำเสนองาน' },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed inset-y-0 left-0 z-50 w-64 flex flex-col bg-white dark:bg-[#0a0a14] border-r border-slate-200 dark:border-[#1c1c34] print:hidden">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200 dark:border-[#1c1c34]">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-600 to-primary-900 flex items-center justify-center purple-glow flex-shrink-0">
          <HardHat size={18} className="text-white" />
        </div>
        <div className="leading-tight">
          <h1 className="text-sm font-bold text-slate-900 dark:text-white">ระบบควบคุม</h1>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">งานก่อสร้าง</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest px-3 mb-3">
          เมนูหลัก
        </p>

        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={[
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                isActive
                  ? 'sidebar-active text-primary-700 dark:text-primary-400'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#14142a] hover:text-slate-900 dark:hover:text-white',
                'cursor-pointer',
              ].join(' ')}
            >
              <Icon
                size={17}
                className={`flex-shrink-0 ${isActive ? 'text-primary-600 dark:text-primary-400' : ''}`}
              />
              <span className="flex-1 truncate">{label}</span>
              {isActive && (
                <ChevronRight size={14} className="text-primary-600 dark:text-primary-400" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom status */}
      <div className="px-5 py-4 border-t border-slate-200 dark:border-[#1c1c34]">
        <div className="flex items-center gap-2 mb-1">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">ระบบออนไลน์</span>
        </div>
        <p className="text-[10px] text-slate-400 dark:text-slate-600">v1.0.0 · Supabase Connected</p>
      </div>
    </aside>
  )
}
