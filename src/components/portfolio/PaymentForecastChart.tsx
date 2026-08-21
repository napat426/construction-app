'use client'

import React, { useMemo, useState, useEffect, useRef } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList, Brush } from 'recharts'
import type { ProjectMilestone, Project } from '@/lib/types'
import { Calendar, Filter, EyeOff } from 'lucide-react'

interface PaymentForecastChartProps {
  milestones: ProjectMilestone[]
  projects: Project[]
  exVatEnabled?: boolean
}

// Clean and reusable dropdown component for metadata filtering
function FilterDropdown({
  label,
  options,
  selected,
  onChange,
}: {
  label: string
  options: string[]
  selected: string[]
  onChange: (value: string[]) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: any) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleToggle = (opt: string) => {
    const next = selected.includes(opt)
      ? selected.filter(x => x !== opt)
      : [...selected, opt]
    onChange(next)
  }

  const isAllSelected = selected.length === options.length

  const handleToggleAll = () => {
    if (isAllSelected) {
      onChange([])
    } else {
      onChange(options)
    }
  }

  return (
    <div className="relative flex flex-col gap-1.5" ref={dropdownRef}>
      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</span>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#252548] bg-white dark:bg-[#1e1e38] text-slate-700 dark:text-slate-300 flex items-center justify-between min-w-[130px] md:min-w-[155px] hover:border-slate-300 dark:hover:border-slate-600 transition-colors cursor-pointer select-none font-bold"
      >
        <span>
          {selected.length === 0
            ? 'ปิดทั้งหมด'
            : (selected.length === options.length ? 'ทั้งหมด' : `${selected.length} รายการ`)}
        </span>
        <span className="ml-1 text-[8px] text-slate-400">▼</span>
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white dark:bg-[#121228] border border-slate-200 dark:border-[#252548] rounded-xl shadow-xl z-30 py-2 min-w-[200px] max-h-60 overflow-y-auto">
          <div className="px-3 py-1.5 border-b border-slate-100 dark:border-[#252548] flex justify-between items-center mb-1">
            <button
              type="button"
              onClick={handleToggleAll}
              className="text-[10px] font-bold text-blue-500 hover:underline cursor-pointer"
            >
              {isAllSelected ? 'เคลียร์ทั้งหมด' : 'เลือกทั้งหมด'}
            </button>
          </div>
          {options.map(opt => {
            const isChecked = selected.includes(opt)
            return (
              <label
                key={opt}
                className="px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-[#1e1e38] flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => handleToggle(opt)}
                  className="rounded border-slate-300 dark:border-[#252548] text-primary-600 focus:ring-primary-500 w-3.5 h-3.5"
                />
                <span className="truncate">{opt}</span>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function PaymentForecastChart({ milestones, projects, exVatEnabled = false }: PaymentForecastChartProps) {
  // 1. Basic Filtering (get unpaid milestones only)
  const forecastMilestones = useMemo(() => {
    return milestones.filter(m => (m.status || (m.is_paid ? 'Paid' : 'Pending')) !== 'Paid')
  }, [milestones])

  // Extract unique metadata options from all projects
  const allSupervisors = useMemo(() => {
    const list = new Set<string>()
    projects.forEach(p => { if (p.supervisor) list.add(p.supervisor) })
    return Array.from(list).sort()
  }, [projects])

  const allStatuses = useMemo(() => {
    const list = new Set<string>()
    projects.forEach(p => { if (p.status) list.add(p.status) })
    return Array.from(list).sort()
  }, [projects])

  const allWorkGroups = useMemo(() => {
    const list = new Set<string>()
    projects.forEach(p => {
      const g = p.work_group || 'ไม่ระบุกลุ่มงาน'
      list.add(g)
    })
    return Array.from(list).sort()
  }, [projects])

  // 2. States for independent filters
  const [selectedSupervisors, setSelectedSupervisors] = useState<string[]>([])
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
  const [selectedWorkGroups, setSelectedWorkGroups] = useState<string[]>([])
  const [selectedProjects, setSelectedProjects] = useState<string[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  // Initialize filters
  useEffect(() => {
    if (projects.length > 0) {
      setSelectedSupervisors(allSupervisors)
      setSelectedStatuses(allStatuses)
      setSelectedWorkGroups(allWorkGroups)
    }
  }, [projects, allSupervisors, allStatuses, allWorkGroups])

  // Filter projects by current independent metadata filter selections
  const filteredProjectsByMetaData = useMemo(() => {
    return projects.filter(p => {
      if (selectedSupervisors.length > 0 && !selectedSupervisors.includes(p.supervisor)) return false
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(p.status)) return false
      const g = p.work_group || 'ไม่ระบุกลุ่มงาน'
      if (selectedWorkGroups.length > 0 && !selectedWorkGroups.includes(g)) return false
      return true
    })
  }, [projects, selectedSupervisors, selectedStatuses, selectedWorkGroups])

  // Get active project names matching metadata filters
  const allProjectNames = useMemo(() => {
    const names = new Set<string>()
    forecastMilestones.forEach(m => {
      const p = filteredProjectsByMetaData.find(proj => proj.id === m.project_id)
      if (p) names.add(p.name)
    })
    return Array.from(names).sort()
  }, [forecastMilestones, filteredProjectsByMetaData])

  // Initialize and synchronize selected project checkboxes
  useEffect(() => {
    setSelectedProjects(allProjectNames)
    setIsLoaded(true)
  }, [allProjectNames])

  const handleToggleProject = (pName: string) => {
    setSelectedProjects(prev =>
      prev.includes(pName) ? prev.filter(n => n !== pName) : [...prev, pName]
    )
  }

  const handleSelectAllProjects = () => setSelectedProjects(allProjectNames)
  const handleClearAllProjects = () => setSelectedProjects([])

  // 3. Process raw monthly data
  const rawGroupedData = useMemo(() => {
    const grouped: Record<string, { dateObj: Date, total: number, unassigned: number, [key: string]: any }> = {}
    let unassigned = 0

    const adjustVal = (num: number) => {
      const adjusted = exVatEnabled ? num / 1.07 : num
      return Math.round(adjusted)
    }

    forecastMilestones.forEach(m => {
      const p = projects.find(proj => proj.id === m.project_id)
      const pName = p ? p.name : 'Unknown Project'

      // Skip if project is not matching the metadata filters
      const isProjectMatched = filteredProjectsByMetaData.some(proj => proj.id === m.project_id)
      if (!isProjectMatched) return

      if (!m.expected_payment_date) {
        if (selectedProjects.includes(pName)) {
           unassigned += adjustVal(Number(m.amount) || 0)
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
      
      grouped[sortKey][pName] += adjustVal(Number(m.amount) || 0)
    })

    return {
      grouped,
      totalUnassigned: unassigned
    }
  }, [forecastMilestones, projects, selectedProjects, filteredProjectsByMetaData, exVatEnabled])

  const allMonthsSorted = useMemo(() => {
    return Object.values(rawGroupedData.grouped).sort((a, b) => a.sortKey.localeCompare(b.sortKey))
  }, [rawGroupedData])

  // 4. Date Range Filters
  const [startMonthKey, setStartMonthKey] = useState<string>('')
  const [endMonthKey, setEndMonthKey] = useState<string>('')

  useEffect(() => {
    if (allMonthsSorted.length > 0 && !startMonthKey && !endMonthKey) {
      setStartMonthKey(allMonthsSorted[0].sortKey)
      setEndMonthKey(allMonthsSorted[allMonthsSorted.length - 1].sortKey)
    }
  }, [allMonthsSorted, startMonthKey, endMonthKey])

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
      if (startMonthKey && m.sortKey < startMonthKey) return false
      if (endMonthKey && m.sortKey > endMonthKey) return false
      return true
    }).map(m => {
      const newObj: any = { name: m.name, sortKey: m.sortKey, total: 0 }
      Object.keys(m).forEach(k => {
        if (k !== 'name' && k !== 'sortKey' && k !== 'dateObj' && k !== 'total' && k !== 'unassigned') {
          if (selectedProjects.includes(k)) {
            newObj[k] = m[k]
            newObj.total += m[k]
            activeProjs.add(k)
            total += m[k]
          }
        }
      })
      return newObj
    }).filter(m => m.total > 0)

    return { filteredData: data, finalTotal: total, activeProjectsInView: Array.from(activeProjs) }
  }, [allMonthsSorted, selectedProjects, startMonthKey, endMonthKey])

  if (!isLoaded) return <div className="animate-pulse h-[400px] bg-slate-100 dark:bg-[#1c1c34] rounded-2xl mb-6"></div>

  // Custom Tooltip component without project color dots
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload
      return (
        <div className="bg-white dark:bg-[#121228] border border-slate-200 dark:border-[#252548] p-4 rounded-xl shadow-xl text-xs font-semibold">
          <p className="font-bold text-sm text-slate-800 dark:text-slate-200 mb-2 leading-tight">
            ประมาณการเดือน {label}
          </p>
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100 dark:border-[#252548] text-primary-600 dark:text-primary-400 font-bold">
            <span>ยอดรวม:</span>
            <span>฿ {dataPoint.total.toLocaleString()}</span>
          </div>
          <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
            {activeProjectsInView.map((pName) => {
              const val = dataPoint[pName]
              if (!val) return null
              return (
                <div key={pName} className="flex items-center justify-between gap-6 text-slate-500 dark:text-slate-400 text-[11px]">
                  <span className="truncate max-w-[200px]">{pName}</span>
                  <span className="font-mono font-bold text-slate-700 dark:text-slate-300">฿ {val.toLocaleString()}</span>
                </div>
              )
            })}
          </div>
        </div>
      )
    }
    return null
  }

  // 6. Empty State
  if (filteredData.length === 0 && rawGroupedData.totalUnassigned === 0) {
    return (
      <div className="card p-6 flex flex-col items-center justify-center min-h-[400px] text-center border-dashed mb-6">
        <div className="w-16 h-16 bg-slate-50 dark:bg-[#14142a] rounded-full flex items-center justify-center mb-4 text-slate-400">
          <EyeOff size={32} />
        </div>
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">ไม่มีข้อมูลในเงื่อนไขที่เลือก</h3>
        <p className="text-xs text-slate-500 max-w-sm mb-4">ลองเปลี่ยนตัวกรองโครงการหรือช่วงเดือน เพื่อดูข้อมูลคาดการณ์เบิกจ่าย</p>
        
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

      {/* Filters Area (Hidden in print) */}
      <div className="flex flex-col gap-5 mb-6 no-print bg-slate-50 dark:bg-[#14142a] p-4 rounded-xl border border-slate-100 dark:border-[#1c1c34]">
        {/* Dropdowns and Date Filters Row */}
        <div className="flex flex-wrap items-center gap-4">
          <FilterDropdown 
            label="ผู้ควบคุมงาน" 
            options={allSupervisors} 
            selected={selectedSupervisors} 
            onChange={setSelectedSupervisors} 
          />
          <FilterDropdown 
            label="สถานะโครงการ" 
            options={allStatuses} 
            selected={selectedStatuses} 
            onChange={setSelectedStatuses} 
          />
          <FilterDropdown 
            label="กลุ่มงาน" 
            options={allWorkGroups} 
            selected={selectedWorkGroups} 
            onChange={setSelectedWorkGroups} 
          />

          <div className="h-8 w-px bg-slate-200 dark:bg-[#252548] hidden md:block" />

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">จากเดือน</label>
            <input 
              type="month" 
              value={startMonthKey}
              onChange={(e) => setStartMonthKey(e.target.value)}
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#252548] bg-white dark:bg-[#1e1e38] text-slate-700 dark:text-slate-300 focus:outline-none focus:border-primary-500 font-semibold"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">ถึงเดือน</label>
            <input 
              type="month" 
              value={endMonthKey}
              onChange={(e) => setEndMonthKey(e.target.value)}
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#252548] bg-white dark:bg-[#1e1e38] text-slate-700 dark:text-slate-300 focus:outline-none focus:border-primary-500 font-semibold"
            />
          </div>
          <div className="flex gap-1.5 pb-0.5 mt-4">
            <button onClick={() => handleQuickSelect(3)} className="px-2.5 py-1.5 text-[10px] font-bold rounded-lg bg-slate-200 dark:bg-[#252548] text-slate-600 dark:text-slate-300 hover:bg-slate-300 transition-colors cursor-pointer select-none">3 ด. ข้างหน้า</button>
            <button onClick={() => handleQuickSelect(6)} className="px-2.5 py-1.5 text-[10px] font-bold rounded-lg bg-slate-200 dark:bg-[#252548] text-slate-600 dark:text-slate-300 hover:bg-slate-300 transition-colors cursor-pointer select-none">6 ด. ข้างหน้า</button>
            <button onClick={handleSelectAllMonths} className="px-2.5 py-1.5 text-[10px] font-bold rounded-lg bg-slate-200 dark:bg-[#252548] text-slate-600 dark:text-slate-300 hover:bg-slate-300 transition-colors cursor-pointer select-none">ทั้งหมด</button>
          </div>
        </div>

        {/* Project Tag Checks Filter */}
        {allProjectNames.length > 0 && (
          <div className="pt-4 border-t border-slate-200/60 dark:border-[#252548]/60">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Filter size={12} /> คัดกรองรายโครงการในกลุ่มผลลัพธ์
              </span>
              <div className="flex gap-2">
                <button onClick={handleSelectAllProjects} className="text-[10px] font-bold text-blue-600 hover:underline cursor-pointer">เลือกทั้งหมด</button>
                <button onClick={handleClearAllProjects} className="text-[10px] font-bold text-slate-400 hover:underline cursor-pointer">ล้างทั้งหมด</button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {allProjectNames.map((pName) => {
                const isSelected = selectedProjects.includes(pName)
                return (
                  <button
                    key={pName}
                    onClick={() => handleToggleProject(pName)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all flex items-center cursor-pointer select-none
                      ${isSelected ? 'bg-indigo-500 border-transparent text-white shadow-sm' : 'bg-transparent border-slate-200 dark:border-[#252548] text-slate-400 dark:text-slate-500'}`}
                  >
                    {pName}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {filteredData.length > 0 ? (
        <>
          {/* Chart */}
          <div className="h-[380px] w-full mt-4 print-chart-container">
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
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} />
                <Brush 
                  dataKey="name" 
                  height={20} 
                  stroke="#3b82f6" 
                  fill="#f8fafc"
                  className="dark:fill-[#14142a] dark:stroke-[#1c1c34]"
                  startIndex={0} 
                  endIndex={Math.min(filteredData.length - 1, 11)}
                />
                <Bar 
                  dataKey="total" 
                  name="ประมาณการเบิกจ่าย" 
                  fill="#3b82f6" 
                  radius={[4, 4, 0, 0]}
                  barSize={32}
                >
                  <LabelList 
                    dataKey="total"
                    position="top" 
                    fill="#475569" 
                    className="dark:fill-slate-300"
                    fontSize={10} 
                    fontWeight="bold"
                    offset={10}
                    formatter={(val: any) => val > 0 ? `฿${Number(val).toLocaleString()}` : ''}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Summary Table */}
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
                  let monthTotal = 0
                  const projectBreakdowns: {name: string, val: number}[] = []
                  activeProjectsInView.forEach(p => {
                    if (row[p]) {
                      monthTotal += row[p]
                      projectBreakdowns.push({ name: p, val: row[p] })
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
                            <div key={pb.name} className="flex items-center justify-between max-w-sm py-0.5">
                              <span className="text-slate-500">{pb.name}</span>
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
