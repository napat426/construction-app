'use client'

import React, { useMemo, useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { ChevronLeft, ChevronRight } from 'lucide-react'

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
  const [currentPage, setCurrentPage] = useState(0)
  const projectsPerPage = 5

  // Reset page when data filters change
  useEffect(() => {
    setCurrentPage(0)
  }, [data])

  const chartData = useMemo(() => {
    return [...data].map(p => ({
      name: p.name.length > 20 ? p.name.substring(0, 20) + '...' : p.name,
      fullName: p.name,
      'แผนงาน (PV)': parseFloat(p.pvCumulative.toFixed(1)),
      'ผลงานจริง (EV)': parseFloat(p.evCumulative.toFixed(1)),
      'เบิกจ่ายสะสม (AC)': parseFloat(p.acPercent.toFixed(1)),
    }))
  }, [data])

  const totalPages = Math.ceil(chartData.length / projectsPerPage)

  const paginatedData = useMemo(() => {
    const startIndex = currentPage * projectsPerPage
    return chartData.slice(startIndex, startIndex + projectsPerPage)
  }, [chartData, currentPage])

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const proj = chartData.find(d => d.name === label)
      return (
        <div className="bg-white dark:bg-[#121228] border border-slate-200 dark:border-[#252548] p-4 rounded-xl shadow-xl">
          <p className="font-bold text-sm text-slate-800 dark:text-slate-200 mb-2 leading-tight">
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

  const handlePrevPage = () => {
    setCurrentPage(prev => Math.max(0, prev - 1))
  }

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))
  }

  const startProjectIdx = currentPage * projectsPerPage + 1
  const endProjectIdx = Math.min(chartData.length, (currentPage + 1) * projectsPerPage)

  return (
    <div className="bg-white dark:bg-[#0b0b16] border border-slate-200 dark:border-[#1c1c34] rounded-2xl p-5 flex flex-col justify-between h-full">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            เปรียบเทียบความก้าวหน้าโครงการ (PV vs EV vs AC)
          </h3>
          
          {totalPages > 1 && (
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500">
              แสดงโครงการที่ {startProjectIdx}-{endProjectIdx} จาก {chartData.length}
            </span>
          )}
        </div>

        <div className="h-72 w-full">
          {paginatedData.length === 0 ? (
            <div className="h-full w-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
              ไม่มีข้อมูลความก้าวหน้า
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={paginatedData}
                margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" className="dark:hidden" />
                <CartesianGrid strokeDasharray="3 3" stroke="#1c1c34" className="hidden dark:block" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }} 
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
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
                  height={32} 
                  wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} 
                />
                <Bar dataKey="แผนงาน (PV)" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={24} />
                <Bar dataKey="ผลงานจริง (EV)" fill="#10b981" radius={[4, 4, 0, 0]} barSize={24} />
                <Bar dataKey="เบิกจ่ายสะสม (AC)" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-100 dark:border-[#1c1c34] pt-4 mt-2">
          <button
            onClick={handlePrevPage}
            disabled={currentPage === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-[#252548] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1e1e38] disabled:opacity-40 disabled:hover:bg-transparent transition-all cursor-pointer"
          >
            <ChevronLeft size={14} /> ก่อนหน้า
          </button>

          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }).map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentPage(idx)}
                className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  currentPage === idx
                    ? 'bg-primary-600 text-white shadow-md'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1e1e38]'
                }`}
              >
                {idx + 1}
              </button>
            ))}
          </div>

          <button
            onClick={handleNextPage}
            disabled={currentPage === totalPages - 1}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-[#252548] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1e1e38] disabled:opacity-40 disabled:hover:bg-transparent transition-all cursor-pointer"
          >
            ถัดไป <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
