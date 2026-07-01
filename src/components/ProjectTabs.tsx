'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, CalendarRange, Package, FileText, ClipboardCheck } from 'lucide-react'

interface ProjectTabsProps {
  projectId: string
}

export function ProjectTabs({ projectId }: ProjectTabsProps) {
  const pathname = usePathname()

  const tabs = [
    {
      href: `/projects/${projectId}`,
      label: 'Dashboard',
      icon: LayoutDashboard,
      active: pathname === `/projects/${projectId}`,
    },
    {
      href: `/projects/${projectId}/planning`,
      label: 'Planning',
      icon: CalendarRange,
      active: pathname.startsWith(`/projects/${projectId}/planning`),
    },
    {
      href: `/projects/${projectId}/materials`,
      label: 'Materials',
      icon: Package,
      active: pathname.startsWith(`/projects/${projectId}/materials`),
    },
    {
      href: `/projects/${projectId}/punchlist`,
      label: 'Punch List',
      icon: ClipboardCheck,
      active: pathname.startsWith(`/projects/${projectId}/punchlist`),
    },
    {
      href: `/projects/${projectId}/reports`,
      label: 'Reports',
      icon: FileText,
      active: pathname.startsWith(`/projects/${projectId}/reports`),
    },
  ]

  return (
    <div className="flex border-b border-slate-200 dark:border-[#1c1c34] mb-6 gap-2">
      {tabs.map((tab) => {
        const Icon = tab.icon
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={[
              'flex items-center gap-2 px-5 py-3 text-sm font-bold transition-all border-b-2 -mb-[2px]',
              tab.active
                ? 'border-primary-600 text-primary-700 dark:text-primary-400 font-extrabold'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200',
            ].join(' ')}
          >
            <Icon size={16} />
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
