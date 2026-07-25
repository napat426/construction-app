'use client'

import { useState, useTransition, useEffect } from 'react'
import {
  FileClock,
  Plus,
  Trash2,
  CalendarDays,
  CloudSun,
  ThermometerSun,
  Users,
  Wrench,
  Image as ImageIcon,
  Printer,
  X,
  CheckCircle2,
  Settings,
  ChevronLeft,
  ChevronRight,
  ClipboardPaste,
  Loader2
} from 'lucide-react'
import type { Project, DailyReport, ResourceItem, ReportPhoto } from '@/lib/types'
import { 
  createDailyReport, 
  updateDailyReport, 
  deleteDailyReport, 
  confirmDailyReport, 
  backfillDailyReport, 
  getDailyDefaults,
  uploadReportPhoto
} from '@/app/actions/reports'
import { getWeatherText, getWeatherIcon } from '@/lib/weatherUtils'
import type { UserSession } from '@/lib/auth'

import { DefaultSettingsModal } from './DefaultSettingsModal'
import { BatchPrintPreview } from './BatchPrintPreview'

interface Props {
  project: Project
  data: DailyReport[]
  user?: UserSession | null
}

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
]

export function DailyReportsTab({ project, data, user }: Props) {
  const [items, setItems] = useState<DailyReport[]>(data)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  
  // Month selector states (default to current month/year)
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth())
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  
  // Modal states
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [selectedPrintIds, setSelectedPrintIds] = useState<string[]>([])
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false)
  
  const [isPending, startTransition] = useTransition()

  // Sync props data with local items
  useEffect(() => {
    setItems(data)
  }, [data])

  // Get report mapping by date for fast lookup (YYYY-MM-DD -> DailyReport)
  const reportMap = useMemoMap(items)

  // Memoize map lookup helper
  function useMemoMap(reports: DailyReport[]) {
    return useEffectMemo(() => {
      const map = new Map<string, DailyReport>()
      reports.forEach(r => {
        if (r.report_date) {
          // ensure date formatting YYYY-MM-DD
          const d = r.report_date.split('T')[0]
          map.set(d, r)
        }
      })
      return map
    }, [reports])
  }

  function useEffectMemo<T>(fn: () => T, deps: any[]): T {
    const [val, setVal] = useState<T>(fn)
    useEffect(() => {
      setVal(fn())
    }, deps)
    return val
  }

  // Calculate calendar days
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
  const rawOffset = new Date(currentYear, currentMonth, 1).getDay() // 0 = Sunday, 1 = Monday, etc.
  const firstDayOffset = rawOffset === 0 ? 6 : rawOffset - 1

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11)
      setCurrentYear(prev => prev - 1)
    } else {
      setCurrentMonth(prev => prev - 1)
    }
  }

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0)
      setCurrentYear(prev => prev + 1)
    } else {
      setCurrentMonth(prev => prev + 1)
    }
  }

  const handleSelectDay = (dateStr: string, existingReport: DailyReport | undefined) => {
    if (existingReport) {
      setSelectedId(existingReport.id)
    } else {
      if (!user || (user.role !== 'admin' && user.role !== 'editor')) return
      if (confirm(`ยังไม่มีรายงานของวันที่ ${formatThaiDateString(dateStr)} ต้องการสร้างรายงานอัตโนมัติย้อนหลังสำหรับวันนี้หรือไม่?`)) {
        startTransition(async () => {
          const res = await backfillDailyReport(project.id, dateStr)
          if (res.error) {
            alert(res.error)
          } else {
            // After successful creation, database revalidation will update props,
            // we will select the newly created report.
            // Search items for the new report or wait for props update.
          }
        })
      }
    }
  }

  const formatThaiDateString = (dateStr: string) => {
    const d = new Date(dateStr)
    return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`
  }

  const selectedItem = items.find(i => i.id === selectedId) || null

  const handleDelete = (id: string) => {
    if (!confirm('ยืนยันลบรายงานประจำวันนี้ออกจากระบบ?')) return
    startTransition(async () => {
      await deleteDailyReport(id, project.id)
      if (selectedId === id) setSelectedId(null)
    })
  }

  // Handle select all printed days in current month
  const currentMonthReports = items.filter(r => {
    if (!r.report_date) return false
    const d = new Date(r.report_date)
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear
  })

  const isAllSelected = currentMonthReports.length > 0 && currentMonthReports.every(r => selectedPrintIds.includes(r.id))

  const handleSelectAllToggle = () => {
    if (isAllSelected) {
      // Remove all current month reports from print list
      const idsToRemove = currentMonthReports.map(r => r.id)
      setSelectedPrintIds(selectedPrintIds.filter(id => !idsToRemove.includes(id)))
    } else {
      // Add all current month reports to print list
      const newIds = [...selectedPrintIds]
      currentMonthReports.forEach(r => {
        if (!newIds.includes(r.id)) newIds.push(r.id)
      })
      setSelectedPrintIds(newIds)
    }
  }

  const handleDayPrintCheckboxToggle = (e: React.MouseEvent, reportId: string) => {
    e.stopPropagation()
    if (selectedPrintIds.includes(reportId)) {
      setSelectedPrintIds(selectedPrintIds.filter(id => id !== reportId))
    } else {
      setSelectedPrintIds([...selectedPrintIds, reportId])
    }
  }

  const getSelectedPrintReports = () => {
    return items
      .filter(r => selectedPrintIds.includes(r.id))
      .sort((a, b) => new Date(a.report_date).getTime() - new Date(b.report_date).getTime())
  }

  return (
    <div className="flex h-[calc(100vh-180px)] gap-6 print:h-auto print:block relative text-slate-800 dark:text-slate-200">
      
      {/* ── Left Sidebar (Calendar & Print Controls) ── */}
      <div className="w-[380px] flex-shrink-0 flex flex-col gap-4 print:hidden border-r border-slate-200 dark:border-[#252548] pr-4">
        
        {/* Month Selector header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <button 
              onClick={handlePrevMonth}
              className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl cursor-pointer"
            >
              <ChevronLeft size={16} />
            </button>
            <h3 className="font-bold text-base text-slate-900 dark:text-white min-w-[140px] text-center">
              {THAI_MONTHS[currentMonth]} {currentYear + 543}
            </h3>
            <button 
              onClick={handleNextMonth}
              className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl cursor-pointer"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          
          {user && (user.role === 'admin' || user.role === 'editor') && (
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-white/5 font-semibold text-xs flex items-center gap-1.5 cursor-pointer text-slate-600 dark:text-slate-300"
              title="ตั้งค่า Default"
            >
              <Settings size={14} />
              ตั้งค่า Default
            </button>
          )}
        </div>

        {/* Print Batch action toolbar */}
        {user && currentMonthReports.length > 0 && (
          <div className="p-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
              <input 
                type="checkbox" 
                checked={isAllSelected}
                onChange={handleSelectAllToggle}
                className="w-4 h-4 rounded text-primary-600 border-slate-300 dark:border-slate-700 focus:ring-primary-500"
              />
              เลือกทั้งหมด ({currentMonthReports.length} วัน)
            </label>
            
            {selectedPrintIds.length > 0 && (
              <button
                onClick={() => setIsPrintPreviewOpen(true)}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-md shadow-purple-500/20 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Printer size={12} />
                พิมพ์ที่เลือก ({selectedPrintIds.length} วัน)
              </button>
            )}
          </div>
        )}

        {/* Calendar Grid */}
        <div className="flex-1 bg-slate-50/50 dark:bg-white/5 rounded-3xl p-4 border border-slate-200 dark:border-slate-800 overflow-y-auto">
          {/* Calendar day names */}
          <div className="grid grid-cols-7 gap-2 text-center text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
            <span>จ</span>
            <span>อ</span>
            <span>พ</span>
            <span>พฤ</span>
            <span>ศ</span>
            <span>ส</span>
            <span>อา</span>
          </div>

          {/* Grid cells */}
          <div className="grid grid-cols-7 gap-2">
            {/* Empty slots padding */}
            {Array.from({ length: firstDayOffset }).map((_, idx) => (
              <div key={`offset-${idx}`} className="aspect-square" />
            ))}

            {/* Days list */}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const day = idx + 1
              // Format YYYY-MM-DD
              const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const report = reportMap.get(dateStr)

              let dotColor = 'bg-slate-300 dark:bg-slate-600' // empty (⚪)
              if (report) {
                if (report.is_confirmed) {
                  dotColor = 'bg-emerald-500' // confirmed (🟢)
                } else {
                  dotColor = 'bg-amber-500 animate-pulse' // draft (🟡)
                }
              }

              const isSelected = report && report.id === selectedId

              return (
                <div
                  key={day}
                  onClick={() => handleSelectDay(dateStr, report)}
                  className={`aspect-square rounded-2xl flex flex-col items-center justify-between p-2 border relative transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? 'border-primary-500 bg-white dark:bg-[#1a1a32] shadow-md ring-1 ring-primary-500/20'
                      : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-[#14142a]/30 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  {/* Select Checkbox for batch printing */}
                  {user && report ? (
                    <input 
                      type="checkbox"
                      checked={selectedPrintIds.includes(report.id)}
                      onClick={(e) => handleDayPrintCheckboxToggle(e, report.id)}
                      onChange={() => {}}
                      className="absolute top-1 left-1 w-3.5 h-3.5 rounded text-primary-600 border-slate-300 dark:border-slate-700 focus:ring-primary-500 cursor-pointer"
                    />
                  ) : null}

                  {/* Day number */}
                  <span className="text-sm font-black text-slate-800 dark:text-slate-300 mt-2 block">
                    {day}
                  </span>

                  {/* Status dot */}
                  <span className={`w-2.5 h-2.5 rounded-full ${dotColor} mb-1`} />
                </div>
              )
            })}
          </div>
        </div>

      </div>

      {/* ── Right Content (Form Area) ── */}
      <div className="flex-1 bg-white dark:bg-[#14142a] rounded-3xl border border-slate-200 dark:border-[#252548] overflow-hidden flex flex-col print:border-none print:bg-transparent min-w-0">
        {selectedItem ? (
          <DailyReportForm 
            key={selectedItem.id}
            project={project}
            item={selectedItem}
            allItems={items}
            onDelete={handleDelete}
            user={user}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 print:hidden py-20">
            <FileClock size={64} className="mb-4 opacity-20" />
            <p className="font-bold text-slate-500">เลือกวันที่ปฏิทินเพื่อกรอก/ยืนยันรายงานความก้าวหน้า</p>
            <p className="text-xs text-slate-400 mt-1.5">วันที่เป็นจุดสีขาว ⚪ สามารถกดเพื่อระบบทำการดึงข้อมูลสร้างร่างรายงานอัตโนมัติได้ทันที</p>
          </div>
        )}
      </div>

      {/* Modals */}
      <DefaultSettingsModal 
        projectId={project.id}
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {isPrintPreviewOpen && (
        <BatchPrintPreview 
          project={project}
          selectedReports={getSelectedPrintReports()}
          onClose={() => setIsPrintPreviewOpen(false)}
        />
      )}

    </div>
  )
}

function DailyReportForm({ 
  project, 
  item, 
  allItems,
  onDelete,
  user
}: { 
  project: Project
  item: DailyReport
  allItems: DailyReport[]
  onDelete: (id: string) => void
  user?: UserSession | null
}) {
  const [isPending, startTransition] = useTransition()
  
  // Local states
  const [weather, setWeather] = useState(item.weather || 'แดดจัด')
  const [temperature, setTemperature] = useState(item.temperature?.toString() || '25')
  const [precipitation, setPrecipitation] = useState(item.precipitation?.toString() || '0')
  const [weatherCode, setWeatherCode] = useState(item.weather_code || 0)
  const [manpower, setManpower] = useState<ResourceItem[]>(item.manpower || [])
  const [machinery, setMachinery] = useState<ResourceItem[]>(item.machinery || [])
  const [workDone, setWorkDone] = useState(item.work_done || '')
  const [issues, setIssues] = useState(item.issues || '')
  const [photos, setPhotos] = useState<ReportPhoto[]>(item.photos || [])
  
  const [uploading, setUploading] = useState(false)
  const [isConfirmed, setIsConfirmed] = useState(item.is_confirmed || false)
  const [isSyncingWeather, setIsSyncingWeather] = useState(false)

  const handleSyncWeather = async () => {
    setIsSyncingWeather(true)
    try {
      const defaultsRes = await getDailyDefaults(project.id)
      if (defaultsRes.error || !defaultsRes.data || !defaultsRes.data.latitude || !defaultsRes.data.longitude) {
        alert('กรุณาตั้งค่าพิกัด GPS ของโครงการในเมนูตั้งค่าก่อนเพื่อใช้ฟีเจอร์นี้')
        return
      }
      
      const { latitude, longitude } = defaultsRes.data
      const res = await fetch(`/api/weather?lat=${latitude}&lng=${longitude}&date=${item.report_date}`)
      if (!res.ok) throw new Error('Failed to fetch weather')
      const weatherData = await res.json()
      
      setWeather(weatherData.weather_text || 'แดดจัด')
      setTemperature(weatherData.temperature?.toString() || '25')
      setPrecipitation(weatherData.precipitation?.toString() || '0')
      setWeatherCode(weatherData.weather_code || 0)
      alert('ดึงข้อมูลสภาพอากาศจริงจากดาวเทียมย้อนหลังเรียบร้อยแล้ว!')
    } catch (err) {
      console.error(err)
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อดึงข้อมูลสภาพอากาศ')
    } finally {
      setIsSyncingWeather(false)
    }
  }

  useEffect(() => {
    setWeather(item.weather || 'แดดจัด')
    setTemperature(item.temperature?.toString() || '25')
    setPrecipitation(item.precipitation?.toString() || '0')
    setWeatherCode(item.weather_code || 0)
    setManpower(item.manpower || [])
    setMachinery(item.machinery || [])
    setWorkDone(item.work_done || '')
    setIssues(item.issues || '')
    setPhotos(item.photos || [])
    setIsConfirmed(item.is_confirmed || false)
  }, [item])

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    const rawFile = e.target.files[0]
    setUploading(true)
    try {
      const { compressImage } = await import('@/lib/image')
      const file = await compressImage(rawFile)
      const res = await uploadReportPhoto(file)
      if (res.url) {
        setPhotos(prev => [...prev, { url: res.url!, caption: '' }])
      }
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleCopyFromYesterday = () => {
    const today = new Date(item.report_date)
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
    const yesterdayStr = yesterday.toISOString().split('T')[0]

    const yesterdayReport = allItems.find(r => r.report_date?.split('T')[0] === yesterdayStr)
    if (!yesterdayReport) {
      alert('ไม่พบรายงานประจำวันของเมื่อวานในระบบ ไม่สามารถคัดลอกได้')
      return
    }

    setManpower(yesterdayReport.manpower || [])
    setMachinery(yesterdayReport.machinery || [])
    setWorkDone(yesterdayReport.work_done || '')
    alert('📋 คัดลอกข้อมูล Manpower, Machinery และรายละเอียดความก้าวหน้าจากเมื่อวานเรียบร้อยแล้ว!')
  }

  const handleSave = (confirmState: boolean) => {
    const payload = {
      report_date: item.report_date,
      weather,
      temperature: parseFloat(temperature) || 25,
      precipitation: parseFloat(precipitation) || 0,
      weather_code: weatherCode,
      manpower,
      machinery,
      work_done: workDone,
      issues,
      photos,
      is_auto_generated: item.is_auto_generated || false,
      is_confirmed: confirmState
    }

    startTransition(async () => {
      const res = await updateDailyReport(item.id, project.id, payload)
      if (res.error) {
        alert(res.error)
      } else {
        setIsConfirmed(confirmState)
      }
    })
  }

  const labelCls = 'text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1.5'
  const inputCls = 'w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-[#252548] bg-transparent text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500/40 text-slate-800 dark:text-slate-200'


  return (
    <div className="flex flex-col h-full">
      {/* Header Toolbar */}
      <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-[#1e1e38]">
        <div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white">
            รายงานประจำวันที่ {new Date(item.report_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}
          </h3>
          <p className="text-xs text-slate-400 font-semibold mt-0.5">
            สถานะ: {isConfirmed ? (
              <span className="text-emerald-500 font-bold">✓ ยืนยันข้อมูลแล้ว</span>
            ) : (
              <span className="text-amber-500 font-bold">🟡 ร่างรายงาน (รอยืนยัน)</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {user && (user.role === 'admin' || user.role === 'editor') && (
            <>
              <button 
                type="button"
                onClick={handleCopyFromYesterday}
                className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-white/5 font-bold text-xs flex items-center gap-1.5 cursor-pointer text-slate-600 dark:text-slate-300"
              >
                <ClipboardPaste size={14} />
                คัดลอกจากเมื่อวาน
              </button>

              <button 
                type="button" 
                onClick={() => onDelete(item.id)} 
                disabled={isPending} 
                className="px-3.5 py-2 rounded-xl border border-red-200 dark:border-red-900/30 hover:bg-red-50 dark:hover:bg-red-900/10 font-bold text-xs flex items-center gap-1.5 text-red-500 cursor-pointer"
              >
                <Trash2 size={14} /> ลบ
              </button>
            </>
          )}

          {user && (user.role === 'admin' || user.role === 'editor') && (
            <button 
              type="button" 
              onClick={() => handleSave(true)}
              disabled={isPending || uploading} 
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 cursor-pointer"
            >
              {isPending && <Loader2 className="animate-spin" size={14} />}
              <CheckCircle2 size={14} /> ยืนยันรายงาน
            </button>
          )}


        </div>
      </div>

      {/* Form Fields */}
      <fieldset 
        disabled={!(user && (user.role === 'admin' || user.role === 'editor'))}
        className="flex-1 overflow-y-auto p-6 space-y-6"
      >
        
        {/* Weather section */}
        <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <span>{getWeatherIcon(weatherCode, weather)}</span>
              สภาพอากาศและสภาวะสิ่งแวดล้อม
            </h4>
            {user && (user.role === 'admin' || user.role === 'editor') && (
              <button
                type="button"
                onClick={handleSyncWeather}
                disabled={isSyncingWeather}
                className="text-xs font-bold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                {isSyncingWeather ? 'กำลังดึงข้อมูล...' : '🔄 ดึงสภาพอากาศย้อนหลังจริง'}
              </button>
            )}
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div className="col-span-2">
              <label className={labelCls}>สภาพอากาศ</label>
              <input 
                value={weather} 
                onChange={e => setWeather(e.target.value)}
                className={inputCls} 
              />
            </div>
            <div>
              <label className={labelCls}>อุณหภูมิ (°C)</label>
              <input 
                type="number"
                value={temperature} 
                onChange={e => setTemperature(e.target.value)}
                className={inputCls} 
              />
            </div>
            <div>
              <label className={labelCls}>ปริมาณน้ำฝน (มม.)</label>
              <input 
                type="number"
                value={precipitation} 
                onChange={e => {
                  setPrecipitation(e.target.value)
                  const pVal = parseFloat(e.target.value) || 0
                  setWeather(getWeatherText(pVal, weatherCode))
                }}
                className={inputCls} 
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Manpower */}
          <div className="bg-slate-50 dark:bg-white/5 p-5 rounded-3xl border border-slate-200 dark:border-[#252548] flex flex-col max-h-[350px]">
            <div className="flex items-center justify-between mb-3 flex-shrink-0">
              <label className={`${labelCls} mb-0`}><Users size={12} className="inline mr-1" /> กำลังคน (Manpower)</label>
              <button 
                type="button" 
                onClick={() => setManpower([...manpower, { name: '', quantity: '1' }])} 
                className="text-primary-500 hover:text-primary-600 text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                + เพิ่ม
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {manpower.map((mp, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input 
                    value={mp.name} 
                    onChange={e => { const n = [...manpower]; n[i].name = e.target.value; setManpower(n); }} 
                    placeholder="ประเภทช่าง เช่น ช่างปูน" 
                    className={`${inputCls} py-1.5 px-3 text-xs`} 
                  />
                  <input 
                    type="number"
                    value={mp.quantity} 
                    onChange={e => { const n = [...manpower]; n[i].quantity = e.target.value; setManpower(n); }} 
                    placeholder="จำนวน" 
                    className={`${inputCls} py-1.5 px-3 text-xs w-20 text-center`} 
                  />
                  <button 
                    type="button" 
                    onClick={() => setManpower(manpower.filter((_, idx) => idx !== i))} 
                    className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              {manpower.length === 0 && <p className="text-xs text-slate-400 italic text-center py-4">ไม่มีข้อมูลกำลังคน</p>}
            </div>
          </div>

          {/* Machinery */}
          <div className="bg-slate-50 dark:bg-white/5 p-5 rounded-3xl border border-slate-200 dark:border-[#252548] flex flex-col max-h-[350px]">
            <div className="flex items-center justify-between mb-3 flex-shrink-0">
              <label className={`${labelCls} mb-0`}><Wrench size={12} className="inline mr-1" /> เครื่องจักร (Machinery)</label>
              <button 
                type="button" 
                onClick={() => setMachinery([...machinery, { name: '', quantity: '1' }])} 
                className="text-primary-500 hover:text-primary-600 text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                + เพิ่ม
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {machinery.map((mc, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input 
                    value={mc.name} 
                    onChange={e => { const n = [...machinery]; n[i].name = e.target.value; setMachinery(n); }} 
                    placeholder="ประเภทเครื่องจักร เช่น รถเครน" 
                    className={`${inputCls} py-1.5 px-3 text-xs`} 
                  />
                  <input 
                    type="number"
                    value={mc.quantity} 
                    onChange={e => { const n = [...machinery]; n[i].quantity = e.target.value; setMachinery(n); }} 
                    placeholder="จำนวน" 
                    className={`${inputCls} py-1.5 px-3 text-xs w-20 text-center`} 
                  />
                  <button 
                    type="button" 
                    onClick={() => setMachinery(machinery.filter((_, idx) => idx !== i))} 
                    className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              {machinery.length === 0 && <p className="text-xs text-slate-400 italic text-center py-4">ไม่มีข้อมูลเครื่องจักร</p>}
            </div>
          </div>
        </div>

        {/* Work Done */}
        <div>
          <label className={labelCls}>รายละเอียดความคืบหน้างานวันนี้ (Work Done)</label>
          <textarea 
            rows={5} 
            value={workDone} 
            onChange={e => setWorkDone(e.target.value)}
            className={`${inputCls} leading-relaxed`} 
            placeholder="ระบุความคืบหน้าของ WBS และงานย่อย..." 
          />
        </div>

        {/* Issues */}
        <div>
          <label className={labelCls}>ปัญหาและอุปสรรค (Issues & Roadblocks)</label>
          <textarea 
            rows={2} 
            value={issues} 
            onChange={e => setIssues(e.target.value)}
            className={inputCls} 
            placeholder="ไม่มีอุปสรรคในการปฏิบัติงาน / หรือกรอกข้อมูลปัญหาที่พบ" 
          />
        </div>

        {/* Work Photos */}
        <div>
          <label className={labelCls}><ImageIcon size={12} className="inline mr-1" /> รูปภาพการทำงานหน้างาน</label>
          
          <div className="grid grid-cols-4 gap-4 mt-2">
            {photos.map((photo, i) => (
              <div key={i} className="border border-slate-200 dark:border-[#252548] rounded-2xl overflow-hidden flex flex-col aspect-video relative group bg-slate-50 dark:bg-white/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt="work progress" className="w-full h-full object-cover" />
                {user && (user.role === 'admin' || user.role === 'editor') && (
                  <button 
                    type="button" 
                    onClick={() => setPhotos(photos.filter((_, idx) => idx !== i))} 
                    className="absolute top-2 right-2 w-6 h-6 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-red-500 transition-colors cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-black/50 p-1.5">
                  <input 
                    value={photo.caption} 
                    disabled={!(user && (user.role === 'admin' || user.role === 'editor'))}
                    onChange={e => { const n = [...photos]; n[i].caption = e.target.value; setPhotos(n); }} 
                    placeholder="คำอธิบาย..." 
                    className="w-full bg-transparent text-[10px] text-white outline-none border-none placeholder:text-white/60 text-center" 
                  />
                </div>
              </div>
            ))}

            {user && (user.role === 'admin' || user.role === 'editor') && (
              <label className="aspect-video border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl flex flex-col items-center justify-center hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer transition-all">
                {uploading ? (
                  <span className="text-xs text-slate-400 font-bold flex items-center gap-1.5">
                    <Loader2 className="animate-spin" size={14} /> อัปโหลด...
                  </span>
                ) : (
                  <>
                    <ImageIcon size={20} className="text-slate-400 mb-1" />
                    <span className="text-[10px] text-slate-400 font-black">+ เพิ่มรูปถ่าย</span>
                  </>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploading} />
              </label>
            )}
          </div>
        </div>

      </fieldset>
    </div>
  )
}
