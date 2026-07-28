'use client'

import React, { useMemo, useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface ProjectData {
  status: string
  work_group?: string | null
  supervisor: string
}

interface StatusDonutChartProps {
  data: ProjectData[]
}

const STATUS_COLORS: Record<string, string> = {
  'ออกแบบ สำรวจ ประมาณการ': '#8b5cf6',
  'จัดซื้อจัดจ้าง': '#6366f1',
  'รอดำเนินการ': '#3b82f6',
  'กำลังดำเนินการ': '#f59e0b',
  'ระงับ': '#ef4444',
  'เสร็จสิ้น': '#10b981',
}

const PALETTE = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6',
  '#3b82f6', '#ec4899', '#14b8a6', '#f97316', '#a855f7',
]

function DonutSlide({
  chartData,
  total,
  label,
  centerLabel,
  colorMap,
}: {
  chartData: { name: string; value: number }[]
  total: number
  label: string
  centerLabel: string
  colorMap: (name: string, index: number) => string
}) {
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const entry = payload[0]
      const percent = total > 0 ? ((entry.value / total) * 100).toFixed(0) : 0
      return (
        <div className="bg-white dark:bg-[#121228] border border-slate-200 dark:border-[#252548] px-3 py-2 rounded-xl shadow-xl text-xs font-semibold">
          <span className="text-slate-500 dark:text-slate-400 mr-2">{entry.name}:</span>
          <span className="text-slate-800 dark:text-white font-mono">{entry.value} โครงการ ({percent}%)</span>
        </div>
      )
    }
    return null
  }

  return (
    <div className="flex flex-col w-full">
      <div className="h-64 w-full relative flex items-center justify-center">
        {chartData.length === 0 ? (
          <div className="text-slate-400 dark:text-slate-500 text-sm">ไม่มีข้อมูล</div>
        ) : (
          <>
            <div className="absolute flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-black text-slate-900 dark:text-white">{total}</span>
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                {centerLabel}
              </span>
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={colorMap(entry.name, index)}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </>
        )}
      </div>
    </div>
  )
}

export function StatusDonutChart({ data }: StatusDonutChartProps) {
  const [slideIndex, setSlideIndex] = useState(0)

  const slides = [
    { key: 'status', title: 'สัดส่วนสถานะโครงการ' },
    { key: 'work_group', title: 'สัดส่วนกลุ่มงาน' },
    { key: 'supervisor', title: 'สัดส่วนผู้ควบคุมงาน' },
  ]

  // Slide 1: Status
  const statusData = useMemo(() => {
    const counts: Record<string, number> = {
      'ออกแบบ สำรวจ ประมาณการ': 0,
      'จัดซื้อจัดจ้าง': 0,
      'รอดำเนินการ': 0,
      'กำลังดำเนินการ': 0,
      'ระงับ': 0,
      'เสร็จสิ้น': 0,
    }
    data.forEach(p => { if (counts[p.status] !== undefined) counts[p.status]++ })
    return Object.keys(counts)
      .map(s => ({ name: s, value: counts[s] }))
      .filter(i => i.value > 0)
  }, [data])

  // Slide 2: Work Group
  const workGroupData = useMemo(() => {
    const counts: Record<string, number> = {}
    data.forEach(p => {
      const g = p.work_group || 'ไม่ระบุกลุ่มงาน'
      counts[g] = (counts[g] || 0) + 1
    })
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
  }, [data])

  // Slide 3: Supervisor
  const supervisorData = useMemo(() => {
    const counts: Record<string, number> = {}
    data.forEach(p => {
      const s = p.supervisor || 'ไม่ระบุ'
      counts[s] = (counts[s] || 0) + 1
    })
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [data])

  const total = data.length

  const prev = () => setSlideIndex(i => (i - 1 + slides.length) % slides.length)
  const next = () => setSlideIndex(i => (i + 1) % slides.length)

  return (
    <div className="bg-white dark:bg-[#0b0b16] border border-slate-200 dark:border-[#1c1c34] rounded-2xl p-5 flex flex-col h-full">
      {/* Header with nav controls */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
          {slides[slideIndex].title}
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={prev}
            className="w-6 h-6 rounded-full flex items-center justify-center bg-slate-100 dark:bg-[#1c1c34] hover:bg-slate-200 dark:hover:bg-[#252548] text-slate-600 dark:text-slate-300 transition-colors"
          >
            <ChevronLeft size={14} />
          </button>
          {/* Dot indicators */}
          <div className="flex gap-1 px-1">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setSlideIndex(i)}
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  i === slideIndex
                    ? 'bg-indigo-500 w-3'
                    : 'bg-slate-300 dark:bg-slate-600'
                }`}
              />
            ))}
          </div>
          <button
            onClick={next}
            className="w-6 h-6 rounded-full flex items-center justify-center bg-slate-100 dark:bg-[#1c1c34] hover:bg-slate-200 dark:hover:bg-[#252548] text-slate-600 dark:text-slate-300 transition-colors"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Slide content */}
      <div className="flex-1">
        {slideIndex === 0 && (
          <DonutSlide
            chartData={statusData}
            total={total}
            label="สถานะ"
            centerLabel="โครงการรวม"
            colorMap={(name) => STATUS_COLORS[name] || '#94a3b8'}
          />
        )}
        {slideIndex === 1 && (
          <DonutSlide
            chartData={workGroupData}
            total={total}
            label="กลุ่มงาน"
            centerLabel="โครงการรวม"
            colorMap={(_, i) => PALETTE[i % PALETTE.length]}
          />
        )}
        {slideIndex === 2 && (
          <DonutSlide
            chartData={supervisorData}
            total={total}
            label="ผู้ควบคุมงาน"
            centerLabel="โครงการรวม"
            colorMap={(_, i) => PALETTE[i % PALETTE.length]}
          />
        )}
      </div>
    </div>
  )
}
