'use client'

import { useMemo } from 'react'
import type { Project, WBSTask } from '@/lib/types'
import type { SelectedProjectSlide } from '../PresentationClient'
import { HardHat } from 'lucide-react'
import { computeTaskDates } from '@/lib/scheduler'

interface Props {
  projects: Project[]
  tasks?: WBSTask[]
  selectedSlides: SelectedProjectSlide[]
  theme?: 'dark' | 'light'
}

export function SlideSummary({ projects, tasks = [], selectedSlides, theme = 'dark' }: Props) {
  const isDark = theme === 'dark'
  const presentedProjects = selectedSlides.map(s => projects.find(p => p.id === s.projectId)).filter(Boolean) as Project[]

  const projectEVM = useMemo(() => {
    const map: Record<string, { ev: number, pv: number, svDays: number }> = {}
    
    const today = new Date()
    const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate())

    presentedProjects.forEach(project => {
      const pTasks = tasks.filter(t => t.project_id === project.id)
      
      const start = project.start_date ? new Date(project.start_date) : null
      const end = project.end_date ? new Date(project.end_date) : null
      let totalDays = 0

      if (start && end) {
        start.setHours(0, 0, 0, 0)
        end.setHours(0, 0, 0, 0)
        const diffTime = end.getTime() - start.getTime()
        totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      }

      const scheduledTasks = computeTaskDates(pTasks, project.start_date)

      const totalWbsCost = scheduledTasks.reduce((sum, t) => sum + (Number(t.cost) || 0), 0)
      let pvCumulative = 0
      let evCumulative = 0

      scheduledTasks.forEach(t => {
        const w = totalWbsCost > 0 ? (Number(t.cost) || 0) / totalWbsCost : 0
        
        const tStart = new Date(t.computedStartDate)
        const tEnd = new Date(t.computedEndDate)
        tStart.setHours(0,0,0,0)
        tEnd.setHours(0,0,0,0)
        
        let plannedProgress = 0
        if (todayDateOnly >= tEnd) plannedProgress = 100
        else if (todayDateOnly < tStart) plannedProgress = 0
        else {
          const totalTaskTime = Math.max(1, tEnd.getTime() - tStart.getTime())
          const elapsedTaskTime = todayDateOnly.getTime() - tStart.getTime()
          plannedProgress = (elapsedTaskTime / totalTaskTime) * 100
        }
        
        pvCumulative += plannedProgress * w
        evCumulative += (t.actual_progress || 0) * w
      })

      const SV = evCumulative - pvCumulative
      let svDays = 0
      if (totalDays > 0) svDays = Math.round((SV / 100) * totalDays)

      map[project.id] = {
        ev: evCumulative,
        pv: pvCumulative,
        svDays
      }
    })
    
    return map
  }, [presentedProjects, tasks])

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(val)
  }

  return (
    <div className={`w-full h-full flex flex-col items-center justify-center pt-8 ${isDark ? 'bg-[#0d0f14] text-white' : 'bg-[#f0f2f5] text-slate-900'}`}>
      <div className="flex flex-col items-center mb-12">
        <div className="w-32 h-32 rounded-3xl bg-gradient-to-br from-[#a13c9d] to-purple-900 flex items-center justify-center shadow-2xl shadow-purple-900/50 mb-8">
          <HardHat size={64} className="text-white" />
        </div>
        <h1 className="text-5xl font-bold mb-4">สรุปภาพรวมทุกโครงการ</h1>
        <p className={`text-3xl ${isDark ? 'text-white/60' : 'text-slate-500'}`}>ข้อมูล ณ วันที่ {new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>

      <div className={`w-[90%] max-w-7xl ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200 shadow-xl'} border rounded-3xl overflow-hidden`}>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className={`${isDark ? 'bg-white/10 text-white/70' : 'bg-slate-50 text-slate-500'} text-xl uppercase tracking-wider`}>
              <th className="py-6 px-6 font-medium">ชื่อโครงการ</th>
              <th className="py-6 px-6 font-medium text-center">ความก้าวหน้า (EV)</th>
              <th className="py-6 px-6 font-medium text-center">Schedule Variance (SV)</th>
              <th className="py-6 px-6 font-medium text-center">งบประมาณโครงการ</th>
              <th className="py-6 px-6 font-medium text-center">เบิกจ่ายแล้ว (AC)</th>
              <th className="py-6 px-6 font-medium text-center">สถานะ</th>
            </tr>
          </thead>
          <tbody className="text-xl">
            {presentedProjects.map((p, idx) => {
              const evm = projectEVM[p.id] || { ev: p.progress, pv: p.planned_progress, svDays: 0 }
              const svPercent = evm.ev - evm.pv
              
              return (
                <tr key={p.id} className={`border-t ${isDark ? 'border-white/5 hover:bg-white/5' : 'border-slate-100 hover:bg-slate-50'} ${idx % 2 === 0 ? (isDark ? 'bg-white/[0.02]' : 'bg-slate-50/50') : ''} transition-colors`}>
                  <td className={`py-6 px-6 font-bold leading-tight max-w-[300px] truncate ${isDark ? 'text-white' : 'text-slate-800'}`} title={p.name}>{p.name}</td>
                  <td className={`py-6 px-6 text-center ${isDark ? 'text-emerald-400' : 'text-emerald-600'} font-bold`}>{evm.ev.toFixed(1)}%</td>
                  <td className="py-6 px-6 text-center font-bold">
                    <div className={svPercent > 0 ? (isDark ? 'text-emerald-400' : 'text-emerald-600') : svPercent < 0 ? (isDark ? 'text-red-400' : 'text-red-600') : (isDark ? 'text-white' : 'text-slate-800')}>
                      {svPercent > 0 ? '+' : ''}{svPercent.toFixed(1)}%
                    </div>
                    <div className="text-sm font-normal mt-1 opacity-80">
                      {evm.svDays > 0 ? `เร็วกว่าแผน ${evm.svDays} วัน` : evm.svDays < 0 ? `ล่าช้า ${Math.abs(evm.svDays)} วัน` : 'ตรงตามแผน'}
                    </div>
                  </td>
                  <td className={`py-6 px-6 text-center font-mono ${isDark ? 'text-white/80' : 'text-slate-500'}`}>
                    {formatCurrency(p.budget || 0)}
                  </td>
                  <td className={`py-6 px-6 text-center font-mono ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                    {formatCurrency(p.paid_amount || 0)}
                  </td>
                  <td className="py-6 px-6 text-center">
                    <span className={`inline-block px-4 py-2 rounded-xl text-lg font-bold ${
                      p.status === 'กำลังดำเนินการ' ? 'bg-blue-500/20 text-blue-400' :
                      p.status === 'เสร็จสิ้น' ? 'bg-emerald-500/20 text-emerald-400' :
                      p.status === 'ระงับ' ? 'bg-red-500/20 text-red-400' :
                      'bg-slate-500/20 text-slate-400'
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
