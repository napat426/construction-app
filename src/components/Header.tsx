'use client'

import { ReactNode } from 'react'
import { useTheme } from './ThemeProvider'
import { Sun, Moon, ChevronRight, History, Home, ArrowLeft, Building2, Users, Settings as SettingsIcon } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useState, useEffect } from 'react'
import { saveSystemSetting } from '@/app/actions/settings'

import type { UserSession } from '@/lib/auth'

interface HeaderProps {
  breadcrumb?: string[]
  title: string
  subtitle?: string
  actions?: ReactNode
  user?: UserSession | null
}

export function Header({ breadcrumb, title, subtitle, actions, user }: HeaderProps) {
  const { theme, toggleTheme } = useTheme()
  const pathname = usePathname()
  const [aiEnabled, setAiEnabled] = useState(false)

  useEffect(() => {
    if (user?.role === 'admin') {
      supabase.from('system_settings').select('value').eq('key', 'ai_assistant_enabled').single().then(({ data }) => {
        if (data) {
          setAiEnabled(data.value === 'true' || data.value === true)
        }
      })
    }
  }, [user])

  const toggleAi = async () => {
    const newVal = !aiEnabled
    setAiEnabled(newVal)
    await saveSystemSetting('ai_assistant_enabled', String(newVal))
    // force reload to apply
    window.location.reload()
  }

  // Get project ID from pathname (URL format: /projects/[projectId]/...)
  const segments = pathname.split('/')
  const projectId = segments[1] === 'projects' && segments[2] ? segments[2] : null

  return (
    <header className="sticky top-0 z-40 px-6 py-4 border-b border-slate-200 dark:border-[#1c1c34] bg-white/80 dark:bg-[#0d0d1c]/80 backdrop-blur-md print:hidden">
      <div className="flex items-center justify-between gap-4">
        {/* Left: breadcrumb + title */}
        <div className="flex-1 min-w-0 pr-2">
          {(() => {
            if (!breadcrumb || breadcrumb.length === 0) return null

            // 1. Prepare crumbs list
            let crumbs = [...breadcrumb]
            if (crumbs.length === 3 && crumbs[0] === 'ระบบควบคุมงานก่อสร้าง' && (crumbs[1] === 'โครงการทั้งหมด' || crumbs[1] === 'โครงการ')) {
              crumbs.push('Dashboard')
            }
            if (crumbs.length > 2) {
              crumbs = crumbs.filter(c => c !== 'โครงการทั้งหมด' && c !== 'โครงการ')
            }

            const isNotHome = pathname !== '/projects' && pathname !== '/'

            return (
              <div className="flex items-center gap-1.5 mb-1.5 overflow-x-auto scrollbar-none whitespace-nowrap py-0.5">
                {/* 1st Crumb: Prominent Back-to-Home button if subpage, or Home Badge if home */}
                {isNotHome ? (
                  <Link
                    href="/projects"
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-extrabold text-white bg-primary-600 hover:bg-primary-700 shadow-xs hover:shadow transition-all hover:scale-102 active:scale-98 flex-shrink-0 cursor-pointer"
                    title="คลิกเพื่อกลับสู่หน้ารวมโครงการทั้งหมด (หน้าหลัก)"
                  >
                    <ArrowLeft size={13} className="stroke-[2.5]" />
                    <span>หน้าหลัก</span>
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-primary-700 dark:text-primary-300 bg-primary-100/80 dark:bg-primary-950/60 border border-primary-200 dark:border-primary-800/40 flex-shrink-0">
                    <Home size={13} className="text-primary-600 dark:text-primary-400" />
                    <span>หน้าหลัก</span>
                  </span>
                )}

                {/* Remaining crumbs (starting from index 1) */}
                {crumbs.slice(1).map((crumb, i) => {
                  const isLast = i === crumbs.length - 2
                  
                  let displayCrumb = crumb
                  let CrumbIcon: any = null
                  if (crumb === 'โครงการทั้งหมด' || crumb === 'โครงการ') {
                    displayCrumb = 'โครงการ'
                    CrumbIcon = Building2
                  } else if (
                    crumb === 'แผนงานและความก้าวหน้าโครงการ' ||
                    crumb === 'แผนงานและความคืบหน้าโครงการ' ||
                    crumb === 'แผนงานและความคืบหน้า (WBS / Gantt / S-Curve)' ||
                    crumb === 'แผนงานและความก้าวหน้า' ||
                    crumb === 'แผนงาน & WBS'
                  ) {
                    displayCrumb = 'Planning'
                  } else if (crumb === 'การจัดการวัสดุ') {
                    displayCrumb = 'Materials'
                  } else if (crumb === 'ตรวจงาน & รายงาน') {
                    displayCrumb = 'Reports'
                  }

                  let href = ''
                  if (!isLast && projectId) {
                    href = `/projects/${projectId}`
                  }

                  return (
                    <span key={i} className="flex items-center gap-1.5 flex-shrink-0">
                      <ChevronRight size={13} className="text-slate-400 dark:text-slate-600 flex-shrink-0" />
                      {href ? (
                        <Link
                          href={href}
                          title={crumb}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100/90 hover:bg-primary-50 dark:bg-[#181832] dark:hover:bg-primary-950/40 hover:text-primary-600 dark:hover:text-primary-400 border border-slate-200 dark:border-[#28284e] hover:border-primary-400 transition-all cursor-pointer shadow-2xs hover:scale-102 flex-shrink-0"
                        >
                          {CrumbIcon && <CrumbIcon size={13} className="text-primary-600 dark:text-primary-400 flex-shrink-0" />}
                          <span className="whitespace-nowrap">{displayCrumb}</span>
                        </Link>
                      ) : (
                        <span 
                          title={crumb}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs flex-shrink-0 ${
                            isLast 
                              ? 'text-slate-900 dark:text-white font-extrabold bg-slate-200/90 dark:bg-[#222248] border border-slate-300 dark:border-[#353568]' 
                              : 'text-slate-500 dark:text-slate-400 font-medium'
                          }`}
                        >
                          {CrumbIcon && <CrumbIcon size={13} className="text-slate-400 dark:text-slate-500 flex-shrink-0" />}
                          <span className="whitespace-nowrap">{displayCrumb}</span>
                        </span>
                      )}
                    </span>
                  )
                })}
              </div>
            )
          })()}
          <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight truncate">
            {title === 'แผนงานและความก้าวหน้าโครงการ' || title === 'แผนงานและความคืบหน้าโครงการ' ? 'แผนงาน & WBS' : title}
          </h2>
          {subtitle && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 page-subtitle truncate">{subtitle}</p>
          )}
        </div>

        {/* Right: actions + theme toggle + user account controls */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {actions}

          {pathname !== '/activities' && (
            <Link
              href="/activities"
              title="ศูนย์รวมประวัติกิจกรรมทั้งหมด (Global Activity Center)"
              className="px-2.5 h-9 rounded-lg border border-slate-200 dark:border-[#252548] bg-slate-50 dark:bg-[#14142a] flex items-center gap-1.5 justify-center text-slate-600 dark:text-slate-300 hover:border-primary-500 hover:text-primary-600 dark:hover:text-primary-400 transition-all duration-200 cursor-pointer"
            >
              <History size={15} className="text-primary-500 flex-shrink-0" />
              <span className="text-xs font-bold hidden 2xl:inline">ประวัติกิจกรรม</span>
            </Link>
          )}

          <button
            type="button"
            id="theme-toggle"
            suppressHydrationWarning
            onClick={() => {
              toggleTheme();
            }}
            title={theme === 'dark' ? 'เปลี่ยนเป็น Light Mode' : 'เปลี่ยนเป็น Dark Mode'}
            className="px-2.5 h-9 rounded-lg border border-slate-200 dark:border-[#252548] bg-slate-50 dark:bg-[#14142a] flex items-center gap-1.5 justify-center text-slate-500 dark:text-slate-400 hover:border-primary-500 hover:text-primary-600 dark:hover:text-primary-400 transition-all duration-200 cursor-pointer"
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            <span className="text-xs font-bold theme-label hidden 2xl:inline">{theme === 'dark' ? 'โหมดมืด' : 'โหมดสว่าง'}</span>
          </button>

          {/* User profiles controls */}
          {user ? (
            <div className="flex items-center gap-2 border-l border-slate-200 dark:border-[#252548] pl-2.5">
              <div className="hidden lg:block text-right">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight truncate max-w-[120px]">
                  {user.display_name}
                </p>
                <span className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded leading-none inline-block ${
                  user.role === 'admin'
                    ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                    : user.role === 'editor'
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                    : 'bg-slate-500/10 text-slate-600 dark:text-slate-400'
                }`}>
                  {user.role}
                </span>
              </div>
              
              {user.role === 'admin' && (
                <div className="flex items-center gap-1.5 border-r border-slate-200 dark:border-[#252548] pr-2.5" title="AI Assistant Toggle">
                  <span className="text-[10px] font-bold text-slate-500 hidden xl:inline">AI</span>
                  <button 
                    suppressHydrationWarning
                    onClick={toggleAi}
                    className={`w-7 h-4 rounded-full transition-colors relative ${aiEnabled ? 'bg-primary-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${aiEnabled ? 'translate-x-3' : ''}`} />
                  </button>
                </div>
              )}

              {user.role === 'admin' && (
                <div className="flex gap-1.5">
                  <Link
                    href="/admin/users"
                    title="จัดการผู้ใช้"
                    className="px-2.5 h-9 rounded-lg border border-[#a13c9d]/30 text-[#a13c9d] hover:bg-[#a13c9d]/5 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Users size={14} />
                    <span className="hidden xl:inline">ผู้ใช้</span>
                  </Link>
                  <Link
                    href="/admin/settings"
                    title="ตั้งค่าระบบ"
                    className="px-2.5 h-9 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <SettingsIcon size={14} />
                    <span className="hidden xl:inline">ตั้งค่า</span>
                  </Link>
                </div>
              )}

              <button
                type="button"
                suppressHydrationWarning
                onClick={async () => {
                  const { logoutUser } = await import('@/app/actions/user')
                  await logoutUser()
                  window.location.href = '/'
                }}
                className="px-2.5 h-9 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-bold flex items-center justify-center transition-colors cursor-pointer"
                title="ออกจากระบบ"
              >
                ออกจากระบบ
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="px-4.5 h-9 rounded-lg btn-primary text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md shadow-primary-500/10"
            >
              เข้าสู่ระบบ
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
