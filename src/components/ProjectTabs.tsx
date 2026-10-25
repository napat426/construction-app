'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, CalendarRange, Package, FileText, ClipboardCheck, ListChecks, NotebookPen, History } from 'lucide-react'

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
    {
      href: `/projects/${projectId}/checklist`,
      label: 'Check list',
      icon: ListChecks,
      active: pathname.startsWith(`/projects/${projectId}/checklist`),
    },
    {
      href: `/projects/${projectId}/notes`,
      label: 'Notes',
      icon: NotebookPen,
      active: pathname.startsWith(`/projects/${projectId}/notes`),
    },
    {
      href: `/activities?projectId=${projectId}`,
      label: 'History ↗',
      icon: History,
      active: pathname.startsWith(`/projects/${projectId}/history`),
    },
  ]

  return (
    <div id="project-tabs-nav" className="flex items-center border-b border-stone-200/90 dark:border-stone-800/80 mb-6 gap-1 print:hidden no-print overflow-x-auto pb-0.5">
      {tabs.map((tab) => {
        const Icon = tab.icon
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={[
              'flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition-all border-b-2 -mb-[2px] whitespace-nowrap rounded-t-lg tracking-wide',
              tab.active
                ? 'border-stone-900 dark:border-stone-100 text-stone-950 dark:text-stone-50 font-extrabold bg-stone-100/60 dark:bg-stone-900/40'
                : 'border-transparent text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 hover:border-stone-300 dark:hover:border-stone-700',
            ].join(' ')}
          >
            <Icon size={14} className={tab.active ? 'text-primary-600 dark:text-primary-400' : 'text-stone-400'} />
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}

