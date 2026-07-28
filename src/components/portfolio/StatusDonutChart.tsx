'use client'

import React, { useMemo } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface ProjectStatusData {
  status: string
}

interface StatusDonutChartProps {
  data: ProjectStatusData[]
}

const STATUS_COLORS: Record<string, string> = {
  'ออกแบบ สำรวจ ประมาณการ': '#8b5cf6', // Purple
  'จัดซื้อจัดจ้าง': '#6366f1', // Indigo
  'รอดำเนินการ': '#3b82f6', // Blue
  'กำลังดำเนินการ': '#f59e0b', // Amber
  'ระงับ': '#ef4444', // Red
  'เสร็จสิ้น': '#10b981', // Emerald
}

export function StatusDonutChart({ data }: StatusDonutChartProps) {
  const chartData = useMemo(() => {
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
      }
    })

    return Object.keys(counts)
      .map(status => ({
        name: status,
        value: counts[status],
      }))
      .filter(item => item.value > 0)
  }, [data])

  const total = useMemo(() => data.length, [data])

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
    <div className="bg-white dark:bg-[#0b0b16] border border-slate-200 dark:border-[#1c1c34] rounded-2xl p-5 flex flex-col h-full">
      <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2">
        สัดส่วนสถานะโครงการ
      </h3>

      <div className="h-64 w-full flex-1 relative flex items-center justify-center">
        {chartData.length === 0 ? (
          <div className="text-slate-400 dark:text-slate-500 text-sm">
            ไม่มีข้อมูลสถานะ
          </div>
        ) : (
          <>
            {/* Total projects center label */}
            <div className="absolute flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-black text-slate-900 dark:text-white">{total}</span>
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                โครงการรวม
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
                      fill={STATUS_COLORS[entry.name] || '#94a3b8'} 
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
