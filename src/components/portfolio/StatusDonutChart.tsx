'use client'

import React, { useMemo } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { PieChart as PieIcon, Layers, Users } from 'lucide-react'

interface ProjectData {
  status: string
  work_group?: string | null
  supervisor: string
}

interface StatusDonutChartProps {
  data: ProjectData[]
  workGroups?: string[]
}

const STATUS_COLORS: Record<string, string> = {
  'ออกแบบ สำรวจ ประมาณการ': '#a855f7', // Violet
  'จัดซื้อจัดจ้าง': '#3b82f6',             // Blue
  'รอดำเนินการ': '#06b6d4',               // Cyan
  'กำลังดำเนินการ': '#f59e0b',            // Amber
  'ระงับ': '#ef4444',                    // Red
  'เสร็จสิ้น': '#10b981',                  // Emerald
}

const PALETTE = [
  '#3b82f6', // Blue
  '#f97316', // Orange
  '#10b981', // Emerald
  '#a855f7', // Violet
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#f59e0b', // Amber
  '#14b8a6', // Teal
  '#6366f1', // Indigo
  '#84cc16', // Lime
]

const RADIAN = Math.PI / 180

const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, value }: any) => {
  if (!value || percent < 0.04) return null
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)

  return (
    <text
      x={x}
      y={y}
      fill="#ffffff"
      textAnchor="middle"
      dominantBaseline="central"
      className="text-xs font-black drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] pointer-events-none select-none"
    >
      {value}
    </text>
  )
}

function DonutCard({
  title,
  icon,
  chartData,
  total,
  centerLabel = 'โครงการ',
  colorMap,
}: {
  title: string
  icon: React.ReactNode
  chartData: { name: string; value: number }[]
  total: number
  centerLabel?: string
  colorMap: (name: string, index: number) => string
}) {
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const entry = payload[0]
      const percent = total > 0 ? ((entry.value / total) * 100).toFixed(1) : '0'
      return (
        <div className="bg-white dark:bg-[#121228] border border-slate-200 dark:border-[#252548] px-3 py-2 rounded-xl shadow-xl text-xs font-semibold">
          <div className="flex items-center gap-1.5 mb-1">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: entry.payload.fill || colorMap(entry.name, 0) }}
            />
            <span className="text-slate-700 dark:text-slate-300">{entry.name}</span>
          </div>
          <p className="text-slate-900 dark:text-white font-mono font-bold">
            {entry.value} โครงการ <span className="text-slate-400 font-normal">({percent}%)</span>
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="bg-white dark:bg-[#13132a] border border-slate-200 dark:border-[#1c1c34] rounded-2xl p-5 flex flex-col h-full shadow-xs min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#1e1e38]">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-[#1c1c34] text-primary-600 dark:text-primary-400 flex-shrink-0">
            {icon}
          </div>
          <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider truncate">
            {title}
          </h3>
        </div>
        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-[#1c1c34] px-2 py-0.5 rounded-md flex-shrink-0">
          รวม {total}
        </span>
      </div>

      {/* Chart */}
      <div className="h-56 w-full relative flex items-center justify-center my-2">
        {chartData.length === 0 ? (
          <div className="text-slate-400 dark:text-slate-500 text-xs font-semibold">ไม่มีข้อมูล</div>
        ) : (
          <>
            <div className="absolute top-[48%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-black text-slate-900 dark:text-white leading-none">{total}</span>
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-1">
                {centerLabel}
              </span>
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="48%"
                  innerRadius={50}
                  outerRadius={78}
                  paddingAngle={chartData.length > 1 ? 3 : 0}
                  dataKey="value"
                  label={renderCustomizedLabel}
                  labelLine={false}
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={colorMap(entry.name, index)}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </>
        )}
      </div>

      {/* Legend / Breakdown list with badges */}
      <div className="mt-auto pt-3 border-t border-slate-100 dark:border-[#1e1e38] space-y-1.5 max-h-40 overflow-y-auto pr-1">
        {chartData.length === 0 ? (
          <p className="text-center text-[11px] text-slate-400">ไม่มีรายการ</p>
        ) : (
          chartData.map((entry, idx) => {
            const percent = total > 0 ? ((entry.value / total) * 100).toFixed(0) : '0'
            const color = colorMap(entry.name, idx)
            return (
              <div
                key={idx}
                className="flex items-center justify-between text-xs py-0.5 hover:bg-slate-50 dark:hover:bg-[#1a1a32] px-1.5 rounded-md transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-slate-700 dark:text-slate-300 font-medium truncate" title={entry.name}>
                    {entry.name}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                    {entry.value}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                    ({percent}%)
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export function StatusDonutChart({ data, workGroups = [] }: StatusDonutChartProps) {
  // Chart 1: Status
  const statusData = useMemo(() => {
    const counts: Record<string, number> = {
      'ออกแบบ สำรวจ ประมาณการ': 0,
      'จัดซื้อจัดจ้าง': 0,
      'รอดำเนินการ': 0,
      'กำลังดำเนินการ': 0,
      'ระงับ': 0,
      'เสร็จสิ้น': 0,
    }
    data.forEach(p => {
      if (counts[p.status] !== undefined) {
        counts[p.status]++
      } else {
        counts[p.status] = (counts[p.status] || 0) + 1
      }
    })
    return Object.keys(counts)
      .map(s => ({ name: s, value: counts[s] }))
      .filter(i => i.value > 0)
  }, [data])

  // Chart 2: Work Group (Sorted by Admin's workGroups setting)
  const workGroupData = useMemo(() => {
    const counts: Record<string, number> = {}
    data.forEach(p => {
      const g = (p.work_group || '').trim() || 'ไม่ระบุกลุ่มงาน'
      counts[g] = (counts[g] || 0) + 1
    })

    const items = Object.entries(counts).map(([name, value]) => ({ name, value }))

    if (workGroups && workGroups.length > 0) {
      return items.sort((a, b) => {
        const idxA = workGroups.indexOf(a.name)
        const idxB = workGroups.indexOf(b.name)
        if (idxA !== -1 && idxB !== -1) return idxA - idxB
        if (idxA !== -1) return -1
        if (idxB !== -1) return 1
        return a.name.localeCompare(b.name, 'th')
      })
    }

    return items.sort((a, b) => b.value - a.value)
  }, [data, workGroups])

  // Chart 3: Supervisor
  const supervisorData = useMemo(() => {
    const counts: Record<string, number> = {}
    data.forEach(p => {
      const sups = p.supervisor
        ? p.supervisor.split(',').map(s => s.trim()).filter(Boolean)
        : ['ไม่ระบุ']
      if (sups.length === 0) sups.push('ไม่ระบุ')
      sups.forEach(s => {
        counts[s] = (counts[s] || 0) + 1
      })
    })
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [data])

  const total = data.length

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <DonutCard
        title="สัดส่วนสถานะโครงการ"
        icon={<PieIcon size={16} />}
        chartData={statusData}
        total={total}
        centerLabel="โครงการ"
        colorMap={(name) => STATUS_COLORS[name] || '#94a3b8'}
      />
      <DonutCard
        title="สัดส่วนกลุ่มงาน"
        icon={<Layers size={16} />}
        chartData={workGroupData}
        total={total}
        centerLabel="โครงการ"
        colorMap={(name, i) => {
          if (workGroups && workGroups.length > 0) {
            const wgIdx = workGroups.indexOf(name)
            if (wgIdx !== -1) return PALETTE[wgIdx % PALETTE.length]
          }
          return PALETTE[i % PALETTE.length]
        }}
      />
      <DonutCard
        title="สัดส่วนผู้ควบคุมงาน"
        icon={<Users size={16} />}
        chartData={supervisorData}
        total={total}
        centerLabel="โครงการ"
        colorMap={(_, i) => PALETTE[i % PALETTE.length]}
      />
    </div>
  )
}
