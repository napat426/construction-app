'use client'

import { useMemo } from 'react'
import type { Project, WBSTask, ProjectMilestone, ContractAmendment } from '@/lib/types'
import type { SelectedProjectSlide } from '../PresentationClient'
import { HardHat } from 'lucide-react'
import { computeTaskDates, computeProjectExtension, countWorkingDays } from '@/lib/scheduler'

interface Props {
  projects: Project[]
  tasks?: WBSTask[]
  milestones?: ProjectMilestone[]
  amendments?: ContractAmendment[]
  selectedSlides: SelectedProjectSlide[]
  theme?: 'dark' | 'light'
}

export function SlideSummary({ projects, tasks = [], milestones = [], amendments = [], selectedSlides, theme = 'dark' }: Props) {
  const isDark = theme === 'dark'
  const presentedProjects = selectedSlides.map(s => projects.find(p => p.id === s.projectId)).filter(Boolean) as Project[]

  const projectEVM = useMemo(() => {
    const map: Record<string, { ev: number; pv: number; svDays: number; acPercent: number; acCost: number; isOverrun: boolean; daysRemaining: number }> = {}

    const today = new Date()
    const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate())

    presentedProjects.forEach(project => {
      const pAmendments = amendments.filter(a => a.project_id === project.id)
      const pTasks = tasks.filter(t => t.project_id === project.id)
      const pMilestones = milestones.filter(m => m.project_id === project.id)

      const ext = computeProjectExtension(project, pAmendments)
      const { totalDays, daysRemaining, isOverrun } = ext

      const scheduledTasks = computeTaskDates(pTasks, project.start_date, pAmendments)
      const totalWbsCost = scheduledTasks.reduce((sum, t) => sum + (Number(t.cost) || 0), 0)

      let pvCumulative = 0
      let evCumulative = 0

      if (totalWbsCost > 0) {
        // Cost-weighted average (same as Dashboard)
        for (const t of scheduledTasks) {
          const tStart = new Date(t.computedStartDate)
          const tEnd = new Date(t.computedEndDate)
          tStart.setHours(0, 0, 0, 0)
          tEnd.setHours(0, 0, 0, 0)
          const weight = (Number(t.cost) || 0) / totalWbsCost

          let plannedProgress = 0
          if (todayDateOnly >= tEnd) plannedProgress = 100
          else if (todayDateOnly < tStart) plannedProgress = 0
          else {
            const total = Math.max(1, countWorkingDays(tStart, tEnd, pAmendments))
            const elapsed = countWorkingDays(tStart, todayDateOnly, pAmendments)
            plannedProgress = (elapsed / total) * 100
          }
          pvCumulative += weight * plannedProgress
          evCumulative += weight * (t.actual_progress || 0)
        }
      } else if (scheduledTasks.length > 0) {
        // Fallback: simple average (matches Dashboard)
        let totalPV = 0, totalEV = 0
        for (const t of scheduledTasks) {
          const tStart = new Date(t.computedStartDate)
          const tEnd = new Date(t.computedEndDate)
          tStart.setHours(0, 0, 0, 0)
          tEnd.setHours(0, 0, 0, 0)
          let plannedProgress = 0
          if (todayDateOnly >= tEnd) plannedProgress = 100
          else if (todayDateOnly < tStart) plannedProgress = 0
          else {
            const total = Math.max(1, countWorkingDays(tStart, tEnd, pAmendments))
            const elapsed = countWorkingDays(tStart, todayDateOnly, pAmendments)
            plannedProgress = (elapsed / total) * 100
          }
          totalPV += plannedProgress
          totalEV += (t.actual_progress || 0)
        }
        pvCumulative = totalPV / scheduledTasks.length
        evCumulative = totalEV / scheduledTasks.length
      }

      // AC from milestones (same as Dashboard)
      const paidMilestonesAmount = pMilestones.filter(m => m.is_paid).reduce((sum, m) => sum + (Number(m.amount) || 0), 0)
      const acCost = pMilestones.length > 0 ? paidMilestonesAmount : (project.paid_amount || 0)
      const acPercent = (acCost / (project.budget || 1)) * 100

      const SV = evCumulative - pvCumulative
      let svDays = 0
      if (totalDays > 0) svDays = Math.round((SV / 100) * totalDays)

      map[project.id] = {
        ev: evCumulative,
        pv: pvCumulative,
        svDays,
        acPercent,
        acCost,
        isOverrun,
        daysRemaining: Math.abs(daysRemaining),
      }
    })

    return map
  }, [presentedProjects, tasks, milestones, amendments])

  const fmt = (val: number) =>
    new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(val)

  return (
    <div className={`w-full h-full flex flex-col items-center justify-center px-10 py-8 ${isDark ? 'bg-[#0d0f14] text-white' : 'bg-[#f0f2f5] text-slate-900'}`}
      style={{ fontFamily: 'Inter, Noto Sans Thai, sans-serif' }}>

      {/* Title */}
      <div className="flex items-center gap-4 mb-6">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isDark ? 'bg-[#a13c9d]/20' : 'bg-purple-100'}`}>
          <HardHat className={isDark ? 'text-[#c56bc1]' : 'text-purple-700'} size={28} />
        </div>
        <div>
          <h1 className={`text-4xl font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>สรุปภาพรวมทุกโครงการ</h1>
          <p className={`text-lg ${isDark ? 'text-white/60' : 'text-slate-500'}`}>
            ข้อมูล ณ วันที่ {new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}
            {' '}· {presentedProjects.length} โครงการ
          </p>
        </div>
      </div>

      {/* Table */}
      <div className={`w-full ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200 shadow-xl'} border rounded-2xl overflow-hidden`}>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className={`${isDark ? 'bg-white/10 text-white/60' : 'bg-slate-50 text-slate-500'} text-sm uppercase tracking-wider font-bold`}>
              <th className="py-3 px-4">ชื่อโครงการ</th>
              <th className="py-3 px-4 text-center">EV%</th>
              <th className="py-3 px-4 text-center">SV (วัน)</th>
              <th className="py-3 px-4 text-center">AC%</th>
              <th className="py-3 px-4 text-center">งบประมาณ</th>
              <th className="py-3 px-4 text-center">เบิกจ่ายแล้ว (AC)</th>
              <th className="py-3 px-4 text-center">สถานะ</th>
            </tr>
          </thead>
          <tbody className="text-base">
            {presentedProjects.map((p, idx) => {
              const evm = projectEVM[p.id] || { ev: p.progress || 0, pv: 0, svDays: 0, acPercent: 0, acCost: p.paid_amount || 0, isOverrun: false, daysRemaining: 0 }
              const svPercent = evm.ev - evm.pv

              return (
                <tr
                  key={p.id}
                  className={`border-t ${isDark ? 'border-white/5' : 'border-slate-100'} ${idx % 2 === 0 ? (isDark ? 'bg-white/[0.02]' : 'bg-slate-50/30') : ''}`}
                >
                  {/* Name */}
                  <td className={`py-3 px-4 font-bold leading-tight max-w-xs`} title={p.name}>
                    <div className={`truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{p.name}</div>
                    {evm.isOverrun && (
                      <div className="text-xs text-red-500 font-semibold mt-0.5">⚠ เกินสัญญา {evm.daysRemaining} วัน</div>
                    )}
                  </td>

                  {/* EV */}
                  <td className={`py-3 px-4 text-center font-black text-lg ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                    {evm.ev.toFixed(1)}%
                  </td>

                  {/* SV */}
                  <td className="py-3 px-4 text-center font-bold">
                    <div className={svPercent > 0 ? (isDark ? 'text-emerald-400' : 'text-emerald-600') : svPercent < 0 ? 'text-red-500' : (isDark ? 'text-white/60' : 'text-slate-500')}>
                      {svPercent > 0 ? '+' : ''}{svPercent.toFixed(1)}%
                    </div>
                    <div className={`text-xs font-normal mt-0.5 ${isDark ? 'text-white/40' : 'text-slate-400'}`}>
                      {evm.svDays > 0 ? `เร็ว ${evm.svDays} วัน` : evm.svDays < 0 ? `ล่าช้า ${Math.abs(evm.svDays)} วัน` : 'ตรงแผน'}
                    </div>
                  </td>

                  {/* AC% */}
                  <td className={`py-3 px-4 text-center font-black text-lg ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                    {evm.acPercent.toFixed(1)}%
                  </td>

                  {/* Budget */}
                  <td className={`py-3 px-4 text-center font-mono text-sm ${isDark ? 'text-white/70' : 'text-slate-500'}`}>
                    {fmt(p.budget || 0)}
                  </td>

                  {/* AC Cost */}
                  <td className={`py-3 px-4 text-center font-mono text-sm ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                    {fmt(evm.acCost)}
                  </td>

                  {/* Status */}
                  <td className="py-3 px-4 text-center">
                    <span className={`inline-block px-3 py-1 rounded-lg text-sm font-bold ${
                      p.status === 'ออกแบบ สำรวจ ประมาณการ' ? 'bg-purple-500/20 text-purple-500' :
                      p.status === 'จัดซื้อจัดจ้าง' ? 'bg-indigo-500/20 text-indigo-500' :
                      p.status === 'รอดำเนินการ' ? 'bg-blue-500/20 text-blue-500' :
                      p.status === 'กำลังดำเนินการ' ? 'bg-amber-500/20 text-amber-600' :
                      p.status === 'ระงับ' ? 'bg-red-500/20 text-red-500' :
                      'bg-emerald-500/20 text-emerald-600'
                    }`}>
                      {p.status}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
