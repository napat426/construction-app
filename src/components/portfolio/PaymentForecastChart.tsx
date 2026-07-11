'use client'

import React, { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts'
import type { ProjectMilestone, Project } from '@/lib/types'

interface PaymentForecastChartProps {
  milestones: ProjectMilestone[]
  projects: Project[]
}

export function PaymentForecastChart({ milestones, projects }: PaymentForecastChartProps) {
  // 1. กรองเฉพาะงวดที่ "ยังไม่จ่าย" (is_paid === false)
  const forecastMilestones = milestones.filter(m => !m.is_paid)

  // 2. จัดกลุ่มตามเดือน-ปี และตามโครงการ
  const { data, totalAmount, totalMonths, unassignedAmount } = useMemo(() => {
    const grouped: Record<string, any> = {}
    let total = 0
    let unassigned = 0
    
    // สร้าง map สีสำหรับแต่ละโครงการ
    const projectColors: Record<string, string> = {}
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6']
    let colorIndex = 0

    forecastMilestones.forEach(m => {
      const p = projects.find(proj => proj.id === m.project_id)
      const pName = p ? p.name : 'Unknown Project'
      
      if (!projectColors[pName]) {
        projectColors[pName] = colors[colorIndex % colors.length]
        colorIndex++
      }

      if (!m.expected_payment_date) {
        unassigned += Number(m.amount) || 0
        return
      }

      const dateObj = new Date(m.expected_payment_date)
      if (isNaN(dateObj.getTime())) return

      // Formatter for Thai month-year
      const monthYear = dateObj.toLocaleDateString('th-TH', { month: 'short', year: '2-digit' })
      const sortKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}` // For sorting

      if (!grouped[sortKey]) {
        grouped[sortKey] = {
          name: monthYear,
          sortKey: sortKey
        }
      }

      if (!grouped[sortKey][pName]) {
        grouped[sortKey][pName] = 0
      }
      
      grouped[sortKey][pName] += Number(m.amount) || 0
      total += Number(m.amount) || 0
    })

    const sortedData = Object.values(grouped).sort((a, b) => a.sortKey.localeCompare(b.sortKey))

    return { 
      data: sortedData, 
      totalAmount: total, 
      totalMonths: sortedData.length,
      unassignedAmount: unassigned
    }
  }, [forecastMilestones, projects])

  // ดึงรายชื่อโครงการทั้งหมดที่มีข้อมูลในกราฟ
  const activeProjects = useMemo(() => {
    const pNames = new Set<string>()
    data.forEach(d => {
      Object.keys(d).forEach(k => {
        if (k !== 'name' && k !== 'sortKey') {
          pNames.add(k)
        }
      })
    })
    return Array.from(pNames)
  }, [data])

  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6']

  // 3. Empty State
  if (data.length === 0 && unassignedAmount === 0) {
    return (
      <div className="card p-6 flex flex-col items-center justify-center min-h-[300px] text-center border-dashed">
        <div className="w-16 h-16 bg-slate-50 dark:bg-[#14142a] rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">ยังไม่มีข้อมูลคาดการณ์เบิกจ่าย</h3>
        <p className="text-xs text-slate-500 max-w-sm">เพิ่มข้อมูลคาดการณ์ได้ที่หน้างวดงานแต่ละโครงการ</p>
      </div>
    )
  }

  return (
    <div className="card p-6 flex flex-col">
      <div className="flex flex-wrap items-center justify-between mb-6 gap-4">
        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white">ประมาณการเบิกจ่ายรายเดือน</h2>
          <p className="text-xs text-slate-500 font-medium">เฉพาะงวดงานที่ยังไม่ได้ส่งมอบ</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">ยอดเบิกจ่ายคาดการณ์ทั้งหมด</p>
          <p className="text-2xl font-black text-primary-600 dark:text-primary-400 font-mono">
            ฿ {totalAmount.toLocaleString()}
          </p>
          <p className="text-xs text-slate-500 font-medium">ครอบคลุม {totalMonths} เดือนข้างหน้า</p>
        </div>
      </div>

      <div className="h-[300px] w-full mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
            <XAxis 
              dataKey="name" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 12, fill: '#64748b' }} 
              dy={10}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 12, fill: '#64748b' }} 
              tickFormatter={(val) => `฿${(val / 1000).toLocaleString()}k`}
            />
            <Tooltip 
              cursor={{ fill: 'transparent' }}
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
              formatter={(value: any) => [`฿ ${Number(value).toLocaleString()}`, 'ยอดคาดการณ์']}
            />
            <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} />
            {activeProjects.map((pName, index) => (
              <Bar 
                key={pName} 
                dataKey={pName} 
                stackId="a" 
                fill={colors[index % colors.length]} 
                radius={index === activeProjects.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
              >
                {/* Add a total label on the top of the stack */}
                {index === activeProjects.length - 1 && (
                  <LabelList 
                    dataKey={(entry) => {
                      // Calculate sum for this stack
                      let sum = 0
                      activeProjects.forEach(p => {
                        sum += entry[p] || 0
                      })
                      return sum > 0 ? `฿${(sum/1000).toLocaleString(undefined, {maximumFractionDigits: 1})}k` : ''
                    }} 
                    position="top" 
                    fill="#64748b" 
                    fontSize={10} 
                    fontWeight="bold"
                  />
                )}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {unassignedAmount > 0 && (
        <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            <span className="text-xs font-bold text-amber-700 dark:text-amber-500">งวดที่ยังไม่ระบุกำหนดการคาดการณ์</span>
          </div>
          <span className="text-sm font-black text-amber-700 dark:text-amber-500 font-mono">
            ฿ {unassignedAmount.toLocaleString()}
          </span>
        </div>
      )}
    </div>
  )
}
