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
  History,
  Award,
} from 'lucide-react'

const navItems = [
  { href: '/projects',    icon: Building2,      label: 'โครงการทั้งหมด' },
  { href: '/supervisors', icon: Award,          label: 'แฟ้มผลงานบุคคล' },
  { href: '/presentation', icon: MonitorPlay,    label: 'นำเสนองาน' },
  { href: '/activities',  icon: History,        label: 'ประวัติกิจกรรม' },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed inset-y-0 left-0 z-50 w-64 flex flex-col bg-[#FAF8F5]/95 dark:bg-[#0c0c14]/95 backdrop-blur-md border-r border-stone-200/90 dark:border-stone-800 print:hidden">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-200/80 dark:border-stone-800">
        <div className="w-9 h-9 rounded-xl bg-stone-900 text-stone-100 dark:bg-stone-100 dark:text-stone-950 flex items-center justify-center shadow-xs flex-shrink-0">
          <HardHat size={18} />
        </div>
        <div className="leading-tight">
          <h1 className="text-sm font-bold text-stone-950 dark:text-stone-50 tracking-tight font-sans">ระบบควบคุม</h1>
          <p className="text-[11px] text-stone-500 dark:text-stone-400 font-medium">งานก่อสร้าง</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <p className="text-[10px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-widest px-3 mb-3 font-mono">
          เมนูหลัก
        </p>

        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href || (href === '/supervisors' && pathname.startsWith('/supervisors'))
          return (
            <Link
              key={href}
              href={href}
              className={[
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200',
                isActive
                  ? 'bg-stone-200/70 dark:bg-stone-800 text-stone-950 dark:text-stone-50 shadow-2xs font-bold'
                  : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100/80 dark:hover:bg-stone-800/50 hover:text-stone-950 dark:hover:text-stone-100',
                'cursor-pointer',
              ].join(' ')}
            >
              <Icon
                size={16}
                className={`flex-shrink-0 ${isActive ? 'text-stone-950 dark:text-stone-100' : 'text-stone-500 dark:text-stone-400'}`}
              />
              <span className="flex-1 truncate">{label}</span>
              {isActive && (
                <ChevronRight size={14} className="text-stone-900 dark:text-stone-100" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom status */}
      <div className="px-5 py-4 border-t border-stone-200/80 dark:border-stone-800 font-mono">
        <div className="flex items-center gap-2 mb-1">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-xs text-stone-600 dark:text-stone-400 font-medium">ระบบออนไลน์</span>
        </div>
        <p className="text-[10px] text-stone-400 dark:text-stone-500">ATELIER CORE · SUPABASE</p>
      </div>
    </aside>
  )
}
