'use client'

import type { Project } from '@/lib/types'
import type { SelectedProjectSlide } from '../PresentationClient'
import { HardHat } from 'lucide-react'

interface Props {
  projects: Project[]
  selectedSlides: SelectedProjectSlide[]
}

export function SlideSummary({ projects, selectedSlides }: Props) {
  const presentedProjects = selectedSlides.map(s => projects.find(p => p.id === s.projectId)).filter(Boolean) as Project[]

  return (
    <div className="w-full h-full flex flex-col items-center justify-center pt-8">
      <div className="flex flex-col items-center mb-12">
        <div className="w-32 h-32 rounded-3xl bg-gradient-to-br from-[#a13c9d] to-purple-900 flex items-center justify-center shadow-2xl shadow-purple-900/50 mb-8">
          <HardHat size={64} className="text-white" />
        </div>
        <h1 className="text-5xl font-bold mb-4">สรุปภาพรวมทุกโครงการ</h1>
        <p className="text-3xl text-white/60">ข้อมูล ณ วันที่ {new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>

      <div className="w-[80%] max-w-6xl bg-white/5 border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white/10 text-white/70 text-2xl">
              <th className="py-6 px-8 font-medium">ชื่อโครงการ</th>
              <th className="py-6 px-8 font-medium text-center">ความก้าวหน้า</th>
              <th className="py-6 px-8 font-medium text-center">งบประมาณเบิกจ่าย</th>
              <th className="py-6 px-8 font-medium text-center">สถานะ</th>
            </tr>
          </thead>
          <tbody className="text-2xl">
            {presentedProjects.map((p, idx) => (
              <tr key={p.id} className={`border-t border-white/5 ${idx % 2 === 0 ? 'bg-white/[0.02]' : ''}`}>
                <td className="py-6 px-8 font-bold leading-tight">{p.name}</td>
                <td className="py-6 px-8 text-center text-emerald-400 font-bold">{p.progress.toFixed(1)}%</td>
                <td className="py-6 px-8 text-center font-mono">
                  {new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(p.paid_amount || 0)}
                </td>
                <td className="py-6 px-8 text-center">
                  <span className={`inline-block px-4 py-2 rounded-xl text-xl font-bold ${
                    p.status === 'กำลังดำเนินการ' ? 'bg-blue-500/20 text-blue-400' :
                    p.status === 'เสร็จสิ้น' ? 'bg-emerald-500/20 text-emerald-400' :
                    p.status === 'ระงับ' ? 'bg-red-500/20 text-red-400' :
                    'bg-slate-500/20 text-slate-400'
                  }`}>
                    {p.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
