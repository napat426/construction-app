'use client'

import { useState } from 'react'
import { ClipboardCheck, FileClock, CalendarDays } from 'lucide-react'
import type { Project, Inspection, DailyReport, WeeklyReport, WBSTask, ProjectPayment, ProjectMilestone } from '@/lib/types'

// We will lazily load or statically import the child components
import { InspectionsTab } from './reports/InspectionsTab'
import { DailyReportsTab } from './reports/DailyReportsTab'
import { WeeklyReportsTab } from './reports/WeeklyReportsTab'

interface Props {
  project: Project
  inspections: Inspection[]
  dailyReports: DailyReport[]
  weeklyReports: WeeklyReport[]
  tasks: WBSTask[]
  payments: ProjectPayment[]
  milestones: ProjectMilestone[]
}

type TabType = 'inspections' | 'daily' | 'weekly'

export function ReportsClient({
  project,
  inspections,
  dailyReports,
  weeklyReports,
  tasks,
  payments,
  milestones,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabType>('inspections')

  const tabs = [
    { id: 'inspections', label: 'ตรวจสอบคุณภาพ', icon: ClipboardCheck },
    { id: 'daily', label: 'รายงานประจำวัน', icon: FileClock },
    { id: 'weekly', label: 'รายงานประจำสัปดาห์', icon: CalendarDays },
  ] as const

  return (
    <div className="space-y-6 print:m-0 print:p-0">
      {/* ── Sub Tabs Navigation (Hidden when printing) ── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-[#1c1c34] pb-px print:hidden">
        {tabs.map((t) => {
          const Icon = t.icon
          const isActive = activeTab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={[
                'flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold transition-all border-b-2 -mb-0.5',
                isActive
                  ? 'border-primary-600 text-primary-700 dark:text-primary-400 font-extrabold'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300',
              ].join(' ')}
            >
              <Icon size={14} />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* ── Tab Content Areas ── */}
      <div className="print:m-0 print:p-0">
        {activeTab === 'inspections' && <InspectionsTab project={project} data={inspections} />}
        {activeTab === 'daily' && <DailyReportsTab project={project} data={dailyReports} />}
        {activeTab === 'weekly' && (
          <WeeklyReportsTab 
            project={project} 
            data={weeklyReports} 
            tasks={tasks}
            payments={payments}
            milestones={milestones}
          />
        )}
      </div>
    </div>
  )
}
