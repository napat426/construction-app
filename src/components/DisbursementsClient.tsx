'use client'

import { useState } from 'react'
import type { Project, ProjectMilestone, WBSTask } from '@/lib/types'
import { DisbursementsView } from './DisbursementsView'

interface DisbursementsClientProps {
  projects: Project[]
  milestones: ProjectMilestone[]
  tasks: WBSTask[]
}

export function DisbursementsClient({
  projects,
  milestones,
  tasks,
}: DisbursementsClientProps) {
  const [exVatEnabled, setExVatEnabled] = useState(false)

  return (
    <DisbursementsView
      projects={projects}
      milestones={milestones}
      tasks={tasks}
      exVatEnabled={exVatEnabled}
      setExVatEnabled={setExVatEnabled}
    />
  )
}
