'use client'

import React, { useMemo, useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts'
import type { ProjectMilestone, Project } from '@/lib/types'
import { Calendar, Filter, EyeOff } from 'lucide-react'

interface PaymentForecastChartProps {
  milestones: ProjectMilestone[]
  projects: Project[]
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6']

export function PaymentForecastChart({ milestones, projects }: PaymentForecastChartProps) {
  // 1. Basic Filtering
  const forecastMilestones = useMemo(() => milestones.filter(m => !m.is_paid), [milestones])

  // Get all unique project names that have at least one forecast milestone
  const allProjectNames = useMemo(() => {
    const names = new Set<string>()
    forecastMilestones.forEach(m => {
      const p = projects.find(proj => proj.id === m.project_id)
      if (p) names.add(p.name)
    })
    return Array.from(names)
  }, [forecastMilestones, projects])

  // 2. State for Project Filter
  const [selectedProjects, setSelectedProjects] = useState<string[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  // Initialize from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('paymentForecast_projects')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSelectedProjects(parsed)
        } else {
          // If empty array saved, respect it (user unchecked all)
          setSelectedProjects(parsed)
        }
      } catch (e) {
        setSelectedProjects(allProjectNames)
      }
    } else {
      // Default: Select All
      setSelectedProjects(allProjectNames)
    }
    setIsLoaded(true)
  }, [allProjectNames])

  // Save to localStorage on change
  const handleToggleProject = (pName: string) => {
    setSelectedProjects(prev => {
      const next = prev.includes(pName) ? prev.filter(n => n !== pName) : [...prev, pName]
      localStorage.setItem('paymentForecast_projects', JSON.stringify(next))
      return next
    })
  }

  const handleSelectAllProjects = () => {
    setSelectedProjects(allProjectNames)
    localStorage.setItem('paymentForecast_projects', JSON.stringify(allProjectNames))
  }

  const handleClearAllProjects = () => {
    setSelectedProjects([])
    localStorage.setItem('paymentForecast_projects', JSON.stringify([]))
  }

  // 3. Process raw monthly data to get available months
  const rawGroupedData = useMemo(() => {
    const grouped: Record<string, { dateObj: Date, total: number, unassigned: number, [key: string]: any }> = {}
    let unassigned = 0

    forecastMilestones.forEach(m => {
      const p = projects.find(proj => proj.id === m.project_id)
      const pName = p ? p.name : 'Unknown Project'

      if (!m.expected_payment_date) {
        if (selectedProjects.includes(pName)) {
           unassigned += Number(m.amount) || 0
        }
        return
      }

      const dateObj = new Date(m.expected_payment_date)
      if (isNaN(dateObj.getTime())) return

      const sortKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`

      if (!grouped[sortKey]) {
        grouped[sortKey] = {
          dateObj: dateObj,
          sortKey: sortKey,
          name: dateObj.toLocaleDateString('th-TH', { month: 'short', year: '2-digit' }),
          total: 0,
          unassigned: 0
        }
      }

      if (!grouped[sortKey][pName]) {
        grouped[sortKey][pName] = 0
      }
      
      grouped[sortKey][pName] += Number(m.amount) || 0
    })

    return {
      grouped,
      totalUnassigned: unassigned
    }
  }, [forecastMilestones, projects, selectedProjects])

  const allMonthsSorted = useMemo(() => {
    return Object.values(rawGroupedData.grouped).sort((a, b) => a.sortKey.localeCompare(b.sortKey))
  }, [rawGroupedData])

  // 4. State for Date Range Filter
  const [startMonthKey, setStartMonthKey] = useState<string>('')
  const [endMonthKey, setEndMonthKey] = useState<string>('')

  // Set default date range to all if not set
  useEffect(() => {
    if (allMonthsSorted.length > 0 && !startMonthKey && !endMonthKey) {
      setStartMonthKey(allMonthsSorted[0].sortKey)
      setEndMonthKey(allMonthsSorted[allMonthsSorted.length - 1].sortKey)
    }
  }, [allMonthsSorted, startMonthKey, endMonthKey])

  // Quick Select Handlers
  const handleQuickSelect = (months: number) => {
    if (allMonthsSorted.length === 0) return
    const now = new Date()
    const startKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    
    const futureDate = new Date(now.getFullYear(), now.getMonth() + months, 1)
    const endKey = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, '0')}`
    
    setStartMonthKey(startKey)
    setEndMonthKey(endKey)
  }

  const handleSelectAllMonths = () => {
    if (allMonthsSorted.length > 0) {
      setStartMonthKey(allMonthsSorted[0].sortKey)
      setEndMonthKey(allMonthsSorted[allMonthsSorted.length - 1].sortKey)
    }
  }

  // 5. Final Filtered Data
  const { filteredData, finalTotal, activeProjectsInView } = useMemo(() => {
    let total = 0
    const activeProjs = new Set<string>()

    const data = allMonthsSorted.filter(m => {
      // Apply date filter if set
      if (startMonthKey && m.sortKey < startMonthKey) return false
      if (endMonthKey && m.sortKey > endMonthKey) return false
      return true
    }).map(m => {
      const newObj: any = { name: m.name, sortKey: m.sortKey }
      // Apply project filter
      Object.keys(m).forEach(k => {
        if (k !== 'name' && k !== 'sortKey' && k !== 'dateObj' && k !== 'total' && k !== 'unassigned') {
          if (selectedProjects.includes(k)) {
            newObj[k] = m[k]
            activeProjs.add(k)
            total += m[k]
          }
        }
      })
      return newObj
    }).filter(m => {
      // Remove months that have 0 amount after project filtering
      const sum = Object.keys(m).reduce((acc, k) => (k !== 'name' && k !== 'sortKey') ? acc + m[k] : acc, 0)
      return sum > 0
    })

    return { filteredData: data, finalTotal: total, activeProjectsInView: Array.from(activeProjs) }
  }, [allMonthsSorted, selectedProjects, startMonthKey, endMonthKey])


  if (!isLoaded) return <div className="animate-pulse h-[400px] bg-slate-100 dark:bg-[#1c1c34] rounded-2xl mb-6"></div>

  // 6. Empty State
  if (filteredData.length === 0 && rawGroupedData.totalUnassigned === 0) {
    return (
      <div className="card p-6 flex flex-col items-center justify-center min-h-[400px] text-center border-dashed mb-6">
        <div className="w-16 h-16 bg-slate-50 dark:bg-[#14142a] rounded-full flex items-center justify-center mb-4 text-slate-400">
          <EyeOff size={32} />
        </div>
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">ไม่มีข้อมูลในเงื่อนไขที่เลือก</h3>
        <p className="text-xs text-slate-500 max-w-sm mb-4">ลองเปลี่ยนตัวกรองโครงการหรือช่วงเดือน เพื่อดูข้อมูลคาดการณ์เบิกจ่าย</p>
        
        {/* Render filters even in empty state so user can clear them */}
        <div className="flex gap-2">
           <button onClick={handleSelectAllProjects} className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-[#252548] text-slate-600 hover:bg-slate-50 cursor-pointer">เลือกทุกโครงการ</button>
           <button onClick={handleSelectAllMonths} className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-[#252548] text-slate-600 hover:bg-slate-50 cursor-pointer">เลือกทุกเดือน</button>
        </div>
      </div>
    )
  }

  return (
    <div className="card p-6 flex flex-col print-exact-colors mb-6">
      <div className="flex flex-wrap items-start justify-between mb-6 gap-4 border-b border-slate-100 dark:border-[#1c1c34] pb-6">
        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Calendar size={20} className="text-primary-500" />
            ประมาณการเบิกจ่ายรายเดือน
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-1">เฉพาะงวดงานที่ยังไม่ได้ส่งมอบ</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">ยอดเบิกจ่ายตามเงื่อนไข</p>
          <p className="text-3xl font-black text-primary-600 dark:text-primary-400 font-mono">
            ฿ {(finalTotal + rawGroupedData.totalUnassigned).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Filters (Hidden in print) */}
      <div className="flex flex-col gap-5 mb-6 no-print bg-slate-50 dark:bg-[#14142a] p-4 rounded-xl border border-slate-100 dark:border-[#1c1c34]">
        {/* Project Filter */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
              <Filter size={12} /> ตัวกรองโครงการ
            </span>
            <div className="flex gap-2">
              <button onClick={handleSelectAllProjects} className="text-[10px] font-bold text-blue-600 hover:underline cursor-pointer">เลือกทั้งหมด</button>
              <button onClick={handleClearAllProjects} className="text-[10px] font-bold text-slate-400 hover:underline cursor-pointer">ล้างทั้งหมด</button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {allProjectNames.map((pName, idx) => {
              const isSelected = selectedProjects.includes(pName)
              const color = COLORS[idx % COLORS.length]
              return (
                <button
                  key={pName}
                  onClick={() => handleToggleProject(pName)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer select-none
                    ${isSelected ? 'bg-white dark:bg-[#1e1e38] border-transparent shadow-sm text-slate-800 dark:text-slate-200' : 'bg-transparent border-slate-200 dark:border-[#252548] text-slate-400 grayscale opacity-60'}`}
                >
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: isSelected ? color : '#cbd5e1' }} />
                  {pName}
                </button>
              )
            })}
          </div>
        </div>

        {/* Date Filter */}
        <div className="pt-4 border-t border-slate-200 dark:border-[#252548] flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase">จากเดือน</label>
            <input 
              type="month" 
              value={startMonthKey}
              onChange={(e) => setStartMonthKey(e.target.value)}
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#252548] bg-white dark:bg-[#1e1e38] text-slate-700 dark:text-slate-300 focus:outline-none focus:border-primary-500"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase">ถึงเดือน</label>
            <input 
              type="month" 
              value={endMonthKey}
              onChange={(e) => setEndMonthKey(e.target.value)}
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#252548] bg-white dark:bg-[#1e1e38] text-slate-700 dark:text-slate-300 focus:outline-none focus:border-primary-500"
            />
          </div>
          <div className="flex gap-2 pb-0.5">
            <button onClick={() => handleQuickSelect(3)} className="px-3 py-1.5 text-[10px] font-bold rounded-lg bg-slate-200 dark:bg-[#252548] text-slate-600 dark:text-slate-300 hover:bg-slate-300 transition-colors cursor-pointer">3 เดือนข้างหน้า</button>
            <button onClick={() => handleQuickSelect(6)} className="px-3 py-1.5 text-[10px] font-bold rounded-lg bg-slate-200 dark:bg-[#252548] text-slate-600 dark:text-slate-300 hover:bg-slate-300 transition-colors cursor-pointer">6 เดือนข้างหน้า</button>
            <button onClick={handleSelectAllMonths} className="px-3 py-1.5 text-[10px] font-bold rounded-lg bg-slate-200 dark:bg-[#252548] text-slate-600 dark:text-slate-300 hover:bg-slate-300 transition-colors cursor-pointer">ทั้งหมด</button>
          </div>
        </div>
      </div>

      {filteredData.length > 0 ? (
        <>
          {/* Chart */}
          <div className="h-[350px] w-full mt-4 print-chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={filteredData}
                margin={{ top: 30, right: 30, left: 20, bottom: 5 }}
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
                  tickFormatter={(val) => `฿${(val / 1000000).toFixed(1)}M`}
                />
                <Tooltip 
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                  formatter={(value: any) => [`฿ ${Number(value).toLocaleString()}`, 'ยอดคาดการณ์']}
                />
                <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} />
                {activeProjectsInView.map((pName) => {
                  const pIdx = allProjectNames.indexOf(pName)
                  const isTopStack = activeProjectsInView[activeProjectsInView.length - 1] === pName
                  return (
                    <Bar 
                      key={pName} 
                      dataKey={pName} 
                      stackId="a" 
                      fill={COLORS[pIdx % COLORS.length]} 
                      radius={isTopStack ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                    >
                      {isTopStack && (
                        <LabelList 
                          dataKey={(entry) => {
                            let sum = 0
                            activeProjectsInView.forEach(p => { sum += entry[p] || 0 })
                            return sum > 0 ? `฿${sum.toLocaleString()}` : ''
                          }} 
                          position="top" 
                          fill="#475569" 
                          fontSize={11} 
                          fontWeight="900"
                          offset={10}
                        />
                      )}
                    </Bar>
                  )
                })}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Summary Table (Visible in both screen and print) */}
          <div className="mt-8 border border-slate-200 dark:border-[#252548] rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-[#14142a] border-b border-slate-200 dark:border-[#252548] text-slate-500 font-bold uppercase tracking-wider">
                  <th className="p-3 w-32">เดือน</th>
                  <th className="p-3 text-right w-40">ยอดรวม (บาท)</th>
                  <th className="p-3">แยกตามโครงการ (บาท)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#1c1c34] text-slate-700 dark:text-slate-300 font-medium">
                {filteredData.map((row, idx) => {
                  // Calculate month total
                  let monthTotal = 0
                  const projectBreakdowns: {name: string, val: number, color: string}[] = []
                  activeProjectsInView.forEach(p => {
                    if (row[p]) {
                      monthTotal += row[p]
                      const pIdx = allProjectNames.indexOf(p)
                      projectBreakdowns.push({ name: p, val: row[p], color: COLORS[pIdx % COLORS.length] })
                    }
                  })

                  return (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-[#14142a]/50 transition-colors">
                      <td className="p-3 font-bold whitespace-nowrap align-top">{row.name}</td>
                      <td className="p-3 text-right font-black text-primary-600 dark:text-primary-400 font-mono align-top">
                        {monthTotal.toLocaleString()}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-col gap-1.5">
                          {projectBreakdowns.map(pb => (
                            <div key={pb.name} className="flex items-center justify-between max-w-sm">
                              <span className="text-slate-500 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full print-exact-colors" style={{ backgroundColor: pb.color }} />
                                {pb.name}
                              </span>
                              <span className="font-mono text-slate-900 dark:text-white font-bold">{pb.val.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="text-center py-10 text-slate-500 text-sm font-bold border border-dashed border-slate-200 dark:border-[#252548] rounded-xl mt-4 bg-slate-50/50 dark:bg-[#14142a]/50">
          ไม่มียอดเบิกจ่ายในช่วงเดือนที่เลือก หรือไม่มีโครงการที่ถูกเลือก
        </div>
      )}

      {rawGroupedData.totalUnassigned > 0 && (
        <div className="mt-6 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-xl flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            <span className="text-xs font-bold text-amber-700 dark:text-amber-500">ยอดที่รอคาดการณ์ (ยังไม่ระบุวันที่เบิกจ่าย) จากโครงการที่เลือก</span>
          </div>
          <span className="text-sm font-black text-amber-700 dark:text-amber-500 font-mono">
            ฿ {rawGroupedData.totalUnassigned.toLocaleString()}
          </span>
        </div>
      )}
    </div>
  )
}
