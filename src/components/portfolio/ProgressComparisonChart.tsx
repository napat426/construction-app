'use client'

import React, { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface ProjectProgressData {
  name: string
  pvCumulative: number
  evCumulative: number
  acPercent: number
}

interface ProgressComparisonChartProps {
  data: ProjectProgressData[]
}

export function ProgressComparisonChart({ data }: ProgressComparisonChartProps) {
  // Sort projects alphabetically or by progress
  const chartData = useMemo(() => {
    return [...data].map(p => ({
      name: p.name.length > 25 ? p.name.substring(0, 25) + '...' : p.name,
      fullName: p.name,
      'แผนงาน (PV)': parseFloat(p.pvCumulative.toFixed(1)),
      'ผลงานจริง (EV)': parseFloat(p.evCumulative.toFixed(1)),
      'เบิกจ่ายสะสม (AC)': parseFloat(p.acPercent.toFixed(1)),
    }))
  }, [data])

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const proj = chartData.find(d => d.name === label)
      return (
        <div className="bg-white dark:bg-[#121228] border border-slate-200 dark:border-[#252548] p-4 rounded-xl shadow-xl">
          <p className="font-bold text-sm text-slate-800 dark:text-slate-200 mb-2">
            {proj ? proj.fullName : label}
          </p>
          {payload.map((entry: any) => (
            <div key={entry.name} className="flex items-center gap-2 text-xs font-semibold mb-1">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-slate-500 dark:text-slate-400">{entry.name}:</span>
              <span className="text-slate-800 dark:text-white font-mono">{entry.value}%</span>
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div className="bg-white dark:bg-[#0b0b16] border border-slate-200 dark:border-[#1c1c34] rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
          เปรียบเทียบความก้าวหน้าโครงการ (PV vs EV vs AC)
        </h3>
      </div>

      <div className="h-80 w-full">
        {chartData.length === 0 ? (
          <div className="h-full w-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
            ไม่มีข้อมูลความก้าวหน้า
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" className="dark:hidden" />
              <CartesianGrid strokeDasharray="3 3" stroke="#1c1c34" className="hidden dark:block" />
              <XAxis 
                dataKey="name" 
                tick={{ fontSize: 10, fill: '#64748b' }} 
                axisLine={{ stroke: '#cbd5e1' }}
                tickLine={false}
                angle={-15}
                textAnchor="end"
                interval={0}
              />
              <YAxis 
                domain={[0, 100]} 
                tick={{ fontSize: 10, fill: '#64748b' }} 
                axisLine={{ stroke: '#cbd5e1' }}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                verticalAlign="top" 
                height={36} 
                wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} 
              />
              <Bar dataKey="แผนงาน (PV)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="ผลงานจริง (EV)" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="เบิกจ่ายสะสม (AC)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
