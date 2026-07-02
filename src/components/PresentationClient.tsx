'use client'

import { useState, useMemo, useEffect } from 'react'
import type { Project, WBSTask, Inspection } from '@/lib/types'
import type { UserSession } from '@/lib/auth'
import { Search, Filter, Play, CheckSquare, Square, X, GripVertical, Image as ImageIcon } from 'lucide-react'
import { PresentationEngine } from './presentation/PresentationEngine'
import { PhotoManagerModal } from './presentation/PhotoManagerModal'

interface Props {
  initialProjects: Project[]
  initialTasks: WBSTask[]
  initialInspections: Inspection[]
  user?: UserSession | null
}

export type SelectedProjectSlide = {
  projectId: string
  showOverview: boolean
  showSCurve: boolean
  showPhotos: boolean
  selectedPhotoUrls: string[] // User can choose which 4 photos to show
}

export function PresentationClient({ initialProjects, initialTasks, initialInspections, user }: Props) {
  const [projects] = useState<Project[]>(initialProjects)
  
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
  
  // UI states
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [managingPhotosFor, setManagingPhotosFor] = useState<string | null>(null) // projectId

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
  const toggleProjectSelection = (projectId: string) => {
    setSelectedSlides(prev => {
      const exists = prev.find(p => p.projectId === projectId)
      if (exists) return prev.filter(p => p.projectId !== projectId)
      
      // Get latest 4 photos by default
      const projectInspections = initialInspections.filter(i => i.project_id === projectId)
      const allPhotos = projectInspections.flatMap(i => i.photo_urls || [])
      const latestPhotos = allPhotos.slice(0, 4)

      return [...prev, {
        projectId,
        showOverview: true,
        showSCurve: true,
        showPhotos: true,
        selectedPhotoUrls: latestPhotos
      }]
    })
  }

  const selectAll = () => {
    const newSelections = filteredProjects.map(p => {
      const exists = selectedSlides.find(s => s.projectId === p.id)
      if (exists) return exists
      
      const projectInspections = initialInspections.filter(i => i.project_id === p.id)
      const allPhotos = projectInspections.flatMap(i => i.photo_urls || [])
      return {
        projectId: p.id,
        showOverview: true,
        showSCurve: true,
        showPhotos: true,
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

  const toggleSlideOption = (projectId: string, option: 'showOverview' | 'showSCurve' | 'showPhotos') => {
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
        selectedSlides={selectedSlides}
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
        <div className="p-4 border-b border-slate-200 dark:border-[#1c1c34] bg-slate-50 dark:bg-[#0a0a14]">
          <h2 className="font-bold text-slate-800 dark:text-white">ลำดับการนำเสนอ ({selectedSlides.length} โครงการ)</h2>
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
              
              const totalSlides = [slide.showOverview, slide.showSCurve, slide.showPhotos].filter(Boolean).length
              
              return (
                <div 
                  key={slide.projectId}
                  draggable
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={(e) => handleDrop(e, idx)}
                  className="p-3 bg-white dark:bg-[#1a1a32] border border-slate-200 dark:border-[#252548] rounded-xl cursor-move"
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
                  
                  <div className="pl-7 space-y-2 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={slide.showOverview} onChange={() => toggleSlideOption(proj.id, 'showOverview')} />
                      <span>ภาพรวมโครงการ + EVM</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={slide.showSCurve} onChange={() => toggleSlideOption(proj.id, 'showSCurve')} />
                      <span>S-Curve + สรุปแผนงาน (WBS)</span>
                    </label>
                    <label className="flex items-center justify-between cursor-pointer">
                      <div className="flex items-center gap-2">
                        <input type="checkbox" checked={slide.showPhotos} onChange={() => toggleSlideOption(proj.id, 'showPhotos')} />
                        <span>ภาพความก้าวหน้าหน้างาน</span>
                      </div>
                      {slide.showPhotos && (
                        <button 
                          onClick={(e) => { e.preventDefault(); setManagingPhotosFor(proj.id) }}
                          className="text-[10px] flex items-center gap-1 text-primary-600 bg-primary-50 dark:bg-primary-900/30 px-2 py-1 rounded-md hover:bg-primary-100"
                        >
                          <ImageIcon size={12} /> จัดการรูป
                        </button>
                      )}
                    </label>
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
