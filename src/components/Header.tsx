'use client'

import { ReactNode } from 'react'
import { useTheme } from './ThemeProvider'
import { Sun, Moon, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface HeaderProps {
  breadcrumb?: string[]
  title: string
  subtitle?: string
  actions?: ReactNode
}

export function Header({ breadcrumb, title, subtitle, actions }: HeaderProps) {
  const { theme, toggleTheme } = useTheme()
  const pathname = usePathname()

  // Get project ID from pathname (URL format: /projects/[projectId]/...)
  const segments = pathname.split('/')
  const projectId = segments[1] === 'projects' && segments[2] ? segments[2] : null

  return (
    <header className="sticky top-0 z-40 px-6 py-4 border-b border-slate-200 dark:border-[#1c1c34] bg-white/80 dark:bg-[#0d0d1c]/80 backdrop-blur-md">
      <div className="flex items-center justify-between gap-4">
        {/* Left: title + breadcrumb */}
        <div>
          {breadcrumb && breadcrumb.length > 0 && (
            <div className="flex items-center gap-1 mb-1">
              {breadcrumb.map((crumb, i) => {
                const isLast = i === breadcrumb.length - 1
                
                // Determine destination URL dynamically
                let href = ''
                if (!isLast) {
                  if (crumb === 'ระบบควบคุมงานก่อสร้าง') {
                    href = '/'
                  } else if (crumb === 'โครงการทั้งหมด' || crumb === 'โครงการ') {
                    href = '/projects'
                  } else if (projectId) {
                    // It's the project name, linking to the project dashboard page
                    href = `/projects/${projectId}`
                  }
                }

                return (
                  <span key={i} className="flex items-center gap-1">
                    {href ? (
                      <Link
                        href={href}
                        className="text-[11px] text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:underline transition-all font-medium"
                      >
                        {crumb}
                      </Link>
                    ) : (
                      <span className={`text-[11px] ${isLast ? 'text-slate-800 dark:text-slate-200 font-bold' : 'text-slate-400 dark:text-slate-500 font-medium'}`}>
                        {crumb}
                      </span>
                    )}
                    {i < breadcrumb.length - 1 && (
                      <ChevronRight size={11} className="text-slate-300 dark:text-slate-600" />
                    )}
                  </span>
                )
              })}
            </div>
          )}
          <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">
            {title}
          </h2>
          {subtitle && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
          )}
        </div>

        {/* Right: actions + theme toggle */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {actions}

          <button
            type="button"
            id="theme-toggle"
            onClick={() => {
              console.log('Theme toggle clicked! Current theme:', theme);
              toggleTheme();
            }}
            title={theme === 'dark' ? 'เปลี่ยนเป็น Light Mode' : 'เปลี่ยนเป็น Dark Mode'}
            className="px-3 h-9 rounded-lg border border-slate-200 dark:border-[#252548] bg-slate-50 dark:bg-[#14142a] flex items-center gap-2 justify-center text-slate-500 dark:text-slate-400 hover:border-primary-500 hover:text-primary-600 dark:hover:text-primary-400 transition-all duration-200"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            <span className="text-xs font-bold">{theme === 'dark' ? 'โหมดมืด' : 'โหมดสว่าง'}</span>
          </button>
        </div>
      </div>
    </header>
  )
}
