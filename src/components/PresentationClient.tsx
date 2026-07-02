'use client'

import { useState, useMemo, useEffect } from 'react'
import type { Project, WBSTask, Inspection, ProjectPayment } from '@/lib/types'
import type { UserSession } from '@/lib/auth'
import { Search, Filter, Play, CheckSquare, Square, X, GripVertical, Image as ImageIcon, Moon, Sun, Save, Download, Trash2 } from 'lucide-react'
import { PresentationEngine } from './presentation/PresentationEngine'
import { PhotoManagerModal } from './presentation/PhotoManagerModal'

interface Props {
  initialProjects: Project[]
  initialTasks: WBSTask[]
  initialInspections: Inspection[]
  initialPayments: ProjectPayment[]
  user?: UserSession | null
}

export type SelectedProjectSlide = {
  projectId: string
  showOverview: boolean
  showGantt: boolean
  showSCurve: boolean
  showPhotos: boolean
  selectedPhotoUrls: string[] // User can choose which 4 photos to show
}

type Preset = {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  selectedSlides: SelectedProjectSlide[]
}

export function PresentationClient({ initialProjects, initialTasks, initialInspections, initialPayments, user }: Props) {
  const [projects] = useState<Project[]>(initialProjects)
  
  // Theme state
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  
  // Presets state
  const [presets, setPresets] = useState<Preset[]>([])
  
  // Filtering states
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSupervisor, setSelectedSupervisor] = useState<string>('all')
  const [statusFilters, setStatusFilters] = useState<Record<string, boolean>>({
    'กำลังดำเนินการ': true,
    'เสร็จสิ้น': true,
    'ระงับ': true,
    'รอดำเนินการ': true,
  })

  // Selection states
  const [selectedSlides, setSelectedSlides] = useState<SelectedProjectSlide[]>([])
  
  // Global slide toggles (UI state only)
  const [globalToggles, setGlobalToggles] = useState({
    showOverview: true,
    showGantt: true,
    showSCurve: true,
    showPhotos: true
  })
  
  // UI states
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [managingPhotosFor, setManagingPhotosFor] = useState<string | null>(null) // projectId
  
  // Load stored preferences
  useEffect(() => {
    const savedTheme = localStorage.getItem('presentation_theme')
    if (savedTheme === 'light' || savedTheme === 'dark') setTheme(savedTheme)
    
    const savedPresets = localStorage.getItem('presentation_presets')
    if (savedPresets) {
      try {
        setPresets(JSON.parse(savedPresets))
      } catch (err) {}
    }
  }, [])
  
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('presentation_theme', next)
  }

  // Presets logic
  const handleSavePreset = () => {
    const existing = presets.find(p => p.selectedSlides.length === selectedSlides.length && p.selectedSlides.every((s, i) => s.projectId === selectedSlides[i]?.projectId))
    
    let defaultName = 'ชุดการนำเสนอใหม่'
    if (existing) {
      if (confirm(`คุณต้องการบันทึกทับชุดการนำเสนอ "${existing.name}" ใช่หรือไม่? (ยกเลิกเพื่อบันทึกเป็นชื่อใหม่)`)) {
        const updated = presets.map(p => p.id === existing.id ? { ...p, selectedSlides, updatedAt: new Date().toISOString() } : p)
        setPresets(updated)
        localStorage.setItem('presentation_presets', JSON.stringify(updated))
        alert('บันทึกทับเรียบร้อยแล้ว')
        return
      }
    }
    
    const name = prompt('ตั้งชื่อชุดการนำเสนอ:', defaultName)
    if (!name) return
    
    const newPreset: Preset = {
      id: Date.now().toString(),
      name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      selectedSlides
    }
    const updated = [newPreset, ...presets]
    setPresets(updated)
    localStorage.setItem('presentation_presets', JSON.stringify(updated))
    alert('บันทึกชุดการนำเสนอใหม่เรียบร้อยแล้ว')
  }
  
  const handleLoadPreset = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    if (!val) return
    const p = presets.find(x => x.id === val)
    if (p) setSelectedSlides(p.selectedSlides)
    e.target.value = '' // reset dropdown
  }
  
  const handleDeletePreset = (id: string, name: string) => {
    if (!confirm(`ยืนยันการลบชุดนำเสนอ "${name}"?`)) return
    const updated = presets.filter(p => p.id !== id)
    setPresets(updated)
    localStorage.setItem('presentation_presets', JSON.stringify(updated))
  }

  // Derived filtered projects
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
      if (selectedSupervisor !== 'all' && p.supervisor !== selectedSupervisor) return false
      if (!statusFilters[p.status]) return false
      return true
    })
  }, [projects, searchQuery, selectedSupervisor, statusFilters])

  // Supervisors list for dropdown
  const supervisors = useMemo(() => {
    const set = new Set(projects.map(p => p.supervisor).filter(Boolean))
    return Array.from(set).sort()
  }, [projects])

  // Handlers
  const applyGlobalToggles = (key: keyof typeof globalToggles, val: boolean) => {
    const nextToggles = { ...globalToggles, [key]: val }
    setGlobalToggles(nextToggles)
    setSelectedSlides(prev => prev.map(s => ({ ...s, [key]: val })))
  }

  const toggleProjectSelection = (projectId: string) => {
    setSelectedSlides(prev => {
      const exists = prev.find(p => p.projectId === projectId)
      if (exists) return prev.filter(p => p.projectId !== projectId)
      
      const projectInspections = initialInspections.filter(i => i.project_id === projectId)
      const allPhotos = projectInspections.flatMap(i => i.photo_urls || []).map(raw => raw.split('|||')[0])
      const latestPhotos = allPhotos.slice(0, 4)

      return [...prev, {
        projectId,
        showOverview: globalToggles.showOverview,
        showGantt: globalToggles.showGantt,
        showSCurve: globalToggles.showSCurve,
        showPhotos: globalToggles.showPhotos,
        selectedPhotoUrls: latestPhotos
      }]
    })
  }

  const selectAll = () => {
    const newSelections = filteredProjects.map(p => {
      const exists = selectedSlides.find(s => s.projectId === p.id)
      if (exists) return exists
      
      const projectInspections = initialInspections.filter(i => i.project_id === p.id)
      const allPhotos = projectInspections.flatMap(i => i.photo_urls || []).map(raw => raw.split('|||')[0])
      return {
        projectId: p.id,
        showOverview: globalToggles.showOverview,
        showGantt: globalToggles.showGantt,
        showSCurve: globalToggles.showSCurve,
        showPhotos: globalToggles.showPhotos,
        selectedPhotoUrls: allPhotos.slice(0, 4)
      }
    })
    
    // Merge with existing selections not in the filtered view
    const existingNotInView = selectedSlides.filter(s => !filteredProjects.find(fp => fp.id === s.projectId))
    setSelectedSlides([...existingNotInView, ...newSelections])
  }

  const clearSelection = () => {
    setSelectedSlides([])
  }

  const toggleSlideOption = (projectId: string, option: keyof Omit<SelectedProjectSlide, 'projectId' | 'selectedPhotoUrls'>) => {
    setSelectedSlides(prev => prev.map(s => {
      if (s.projectId === projectId) {
        return { ...s, [option]: !s[option] }
      }
      return s
    }))
  }

  // Drag and drop sorting
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null)
  
  const handleDragStart = (e: React.DragEvent, idx: number) => {
    setDraggedIdx(idx)
    e.dataTransfer.effectAllowed = 'move'
  }
  
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
  }
  
  const handleDrop = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    if (draggedIdx === null || draggedIdx === idx) return
    
    const newArr = [...selectedSlides]
    const [draggedItem] = newArr.splice(draggedIdx, 1)
    newArr.splice(idx, 0, draggedItem)
    
    setSelectedSlides(newArr)
    setDraggedIdx(null)
  }

  if (isFullScreen) {
    return (
      <PresentationEngine 
        projects={projects}
        tasks={initialTasks}
        inspections={initialInspections}
        payments={initialPayments}
        selectedSlides={selectedSlides}
        theme={theme}
        onExit={() => setIsFullScreen(false)}
      />
    )
  }

  return (
    <div className="flex-1 flex gap-6 h-[calc(100vh-140px)]">
      {/* Left Panel: Filters & Projects */}
      <div className="flex-1 flex flex-col bg-white dark:bg-[#14142a] rounded-2xl shadow-sm border border-slate-200 dark:border-[#1c1c34] overflow-hidden">
        {/* Filter Bar */}
        <div className="p-4 border-b border-slate-200 dark:border-[#1c1c34] space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-bold text-slate-800 dark:text-white">ตัวกรองโครงการ</h2>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <select
                  className="px-3 py-1.5 bg-slate-50 dark:bg-[#0a0a14] border border-slate-200 dark:border-[#252548] rounded-lg text-xs outline-none max-w-[150px]"
                  onChange={handleLoadPreset}
                  defaultValue=""
                >
                  <option value="" disabled>📂 โหลดชุดนำเสนอ...</option>
                  {presets.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                {presets.length > 0 && (
                  <button 
                    onClick={() => {
                      const sel = document.querySelector('select[defaultValue=""]') as HTMLSelectElement
                      if (sel && sel.value) handleDeletePreset(sel.value, sel.options[sel.selectedIndex].text)
                    }}
                    className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                    title="ลบชุดนำเสนอที่เลือก"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              
              <button 
                onClick={handleSavePreset}
                disabled={selectedSlides.length === 0}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-[#1c1c34] hover:bg-slate-200 dark:hover:bg-[#252548] disabled:opacity-50 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-colors"
              >
                <Save size={14} /> บันทึกชุดการนำเสนอ
              </button>
              
              <button onClick={toggleTheme} className="p-2 rounded-lg bg-slate-100 dark:bg-[#1c1c34] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#252548]">
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </button>
            </div>
          </div>
          
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="ค้นหาชื่อโครงการ..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-[#0a0a14] border border-slate-200 dark:border-[#252548] rounded-xl text-sm outline-none focus:border-primary-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select
              className="px-4 py-2 bg-slate-50 dark:bg-[#0a0a14] border border-slate-200 dark:border-[#252548] rounded-xl text-sm outline-none"
              value={selectedSupervisor}
              onChange={(e) => setSelectedSupervisor(e.target.value)}
            >
              <option value="all">ผู้ควบคุมงานทั้งหมด</option>
              {supervisors.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          
          <div className="flex gap-4 text-sm items-center">
            <span className="font-bold text-slate-500">สถานะ:</span>
            {['กำลังดำเนินการ', 'เสร็จสิ้น', 'รอดำเนินการ', 'ระงับ'].map(status => (
              <label key={status} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={statusFilters[status] || false}
                  onChange={(e) => setStatusFilters(prev => ({ ...prev, [status]: e.target.checked }))}
                  className="rounded text-primary-600 focus:ring-primary-500"
                />
                <span className="text-slate-700 dark:text-slate-300">{status}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Project Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold text-slate-700 dark:text-slate-200">โครงการทั้งหมด ({filteredProjects.length})</h2>
            <div className="space-x-3">
              <button onClick={selectAll} className="text-sm text-primary-600 hover:underline font-bold">เลือกทั้งหมด</button>
              <button onClick={clearSelection} className="text-sm text-slate-500 hover:underline">ล้างการเลือก</button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.map(p => {
              const isSelected = selectedSlides.some(s => s.projectId === p.id)
              return (
                <div 
                  key={p.id}
                  onClick={() => toggleProjectSelection(p.id)}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${isSelected ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-900/10' : 'border-slate-200 dark:border-[#252548] hover:border-primary-300 dark:hover:border-primary-700 bg-white dark:bg-[#1a1a32]'}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-sm line-clamp-2 pr-4">{p.name}</h3>
                    {isSelected ? <CheckSquare className="text-primary-500 shrink-0" size={18} /> : <Square className="text-slate-300 shrink-0" size={18} />}
                  </div>
                  <div className="flex justify-between text-xs text-slate-500 mt-4">
                    <span>ความก้าวหน้า: {p.progress.toFixed(1)}%</span>
                    <span>{p.status}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Right Panel: Selected Slides */}
      <div className="w-[400px] flex flex-col bg-white dark:bg-[#14142a] rounded-2xl shadow-sm border border-slate-200 dark:border-[#1c1c34] overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-[#1c1c34] bg-slate-50 dark:bg-[#0a0a14] flex justify-between items-center">
          <h2 className="font-bold text-slate-800 dark:text-white">ลำดับการนำเสนอ ({selectedSlides.length} โครงการ)</h2>
        </div>
        
        {/* Global Slide Settings */}
        <div className="p-3 mx-4 mt-4 bg-slate-50 dark:bg-[#0a0a14] border border-slate-200 dark:border-[#252548] rounded-xl text-xs">
          <div className="font-bold text-slate-700 dark:text-slate-300 mb-2">เลือกประเภทสไลด์สำหรับทุกโครงการ</div>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={globalToggles.showOverview} onChange={(e) => applyGlobalToggles('showOverview', e.target.checked)} />
              <span className="text-slate-600 dark:text-slate-400">ภาพรวม+EVM</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={globalToggles.showGantt} onChange={(e) => applyGlobalToggles('showGantt', e.target.checked)} />
              <span className="text-slate-600 dark:text-slate-400">Gantt Chart</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={globalToggles.showSCurve} onChange={(e) => applyGlobalToggles('showSCurve', e.target.checked)} />
              <span className="text-slate-600 dark:text-slate-400">S-Curve+WBS</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={globalToggles.showPhotos} onChange={(e) => applyGlobalToggles('showPhotos', e.target.checked)} />
              <span className="text-slate-600 dark:text-slate-400">รูปหน้างาน</span>
            </label>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {selectedSlides.length === 0 ? (
            <div className="text-center text-sm text-slate-500 mt-10">
              ยังไม่ได้เลือกโครงการ
            </div>
          ) : (
            selectedSlides.map((slide, idx) => {
              const proj = projects.find(p => p.id === slide.projectId)
              if (!proj) return null
              
              const totalSlides = [slide.showOverview, slide.showGantt, slide.showSCurve, slide.showPhotos].filter(Boolean).length
              
              return (
                <div 
                  key={slide.projectId}
                  draggable
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={(e) => handleDrop(e, idx)}
                  className="p-3 bg-white dark:bg-[#1a1a32] border border-slate-200 dark:border-[#252548] rounded-xl cursor-move hover:shadow-md transition-shadow"
                >
                  <div className="flex gap-3 mb-3">
                    <GripVertical className="text-slate-300 mt-1" size={16} />
                    <div className="flex-1">
                      <h4 className="font-bold text-sm leading-tight mb-1">{proj.name}</h4>
                      <p className="text-[10px] text-slate-500">{totalSlides} สไลด์</p>
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); toggleProjectSelection(proj.id) }}
                      className="text-slate-400 hover:text-red-500"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  
                  <div className="pl-7 grid grid-cols-2 gap-y-2 text-[11px]">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={slide.showOverview} onChange={() => toggleSlideOption(proj.id, 'showOverview')} />
                      <span>ภาพรวม + EVM</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={slide.showGantt} onChange={() => toggleSlideOption(proj.id, 'showGantt')} />
                      <span>Gantt Chart</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={slide.showSCurve} onChange={() => toggleSlideOption(proj.id, 'showSCurve')} />
                      <span>S-Curve + WBS</span>
                    </label>
                    <div className="flex flex-col gap-1">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" checked={slide.showPhotos} onChange={() => toggleSlideOption(proj.id, 'showPhotos')} />
                        <span>ภาพความก้าวหน้า</span>
                      </label>
                      {slide.showPhotos && (
                        <button 
                          onClick={(e) => { e.preventDefault(); setManagingPhotosFor(proj.id) }}
                          className="w-fit text-[9px] flex items-center gap-1 text-primary-600 bg-primary-50 dark:bg-primary-900/30 px-1.5 py-0.5 rounded hover:bg-primary-100 ml-4"
                        >
                          <ImageIcon size={10} /> จัดการรูป
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
        
        <div className="p-4 border-t border-slate-200 dark:border-[#1c1c34]">
          <button 
            onClick={() => setIsFullScreen(true)}
            disabled={selectedSlides.length === 0}
            className="w-full flex items-center justify-center gap-2 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold rounded-xl text-lg shadow-lg shadow-primary-500/20 transition-all"
          >
            <Play size={20} fill="currentColor" /> เริ่มนำเสนอ
          </button>
        </div>
      </div>

      {/* Photo Manager Modal */}
      {managingPhotosFor && (
        <PhotoManagerModal 
          projectId={managingPhotosFor}
          project={projects.find(p => p.id === managingPhotosFor)!}
          inspections={initialInspections.filter(i => i.project_id === managingPhotosFor)}
          selectedUrls={selectedSlides.find(s => s.projectId === managingPhotosFor)?.selectedPhotoUrls || []}
          onSave={(urls) => {
            setSelectedSlides(prev => prev.map(s => s.projectId === managingPhotosFor ? { ...s, selectedPhotoUrls: urls } : s))
            setManagingPhotosFor(null)
          }}
          onClose={() => setManagingPhotosFor(null)}
        />
      )}
    </div>
  )
}
