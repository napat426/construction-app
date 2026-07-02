'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Project, WBSTask, Inspection, ProjectPayment } from '@/lib/types'
import type { SelectedProjectSlide } from '../PresentationClient'
import { Maximize, Minimize, X, ChevronLeft, ChevronRight } from 'lucide-react'

import { SlideOverview } from './SlideOverview'
import { SlideSCurve } from './SlideSCurve'
import { SlidePhotos } from './SlidePhotos'
import { SlideSummary } from './SlideSummary'
import { SlideGantt } from './SlideGantt'

interface Props {
  projects: Project[]
  tasks: WBSTask[]
  inspections: Inspection[]
  payments: ProjectPayment[]
  selectedSlides: SelectedProjectSlide[]
  theme: 'dark' | 'light'
  onExit: () => void
}

type SlideDef = {
  type: 'summary' | 'overview' | 'gantt' | 'scurve' | 'photos'
  project?: Project
  slideData?: SelectedProjectSlide
}

export function PresentationEngine({ projects, tasks, inspections, payments, selectedSlides, theme, onExit }: Props) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)

  // Generate flat list of slides
  const slides: SlideDef[] = []
  
  // 1. Summary at the beginning
  slides.push({ type: 'summary' })
  
  // 2. Project slides
  selectedSlides.forEach(slideSelection => {
    const proj = projects.find(p => p.id === slideSelection.projectId)
    if (!proj) return
    if (slideSelection.showOverview) slides.push({ type: 'overview', project: proj })
    if (slideSelection.showGantt) slides.push({ type: 'gantt', project: proj })
    if (slideSelection.showSCurve) slides.push({ type: 'scurve', project: proj })
    if (slideSelection.showPhotos) slides.push({ type: 'photos', project: proj, slideData: slideSelection })
  })

  // Fullscreen management
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`)
      })
    } else {
      document.exitFullscreen()
    }
  }

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  // Keyboard Navigation
  const goToNext = useCallback(() => {
    setCurrentIndex(prev => Math.min(prev + 1, slides.length - 1))
  }, [slides.length])

  const goToPrev = useCallback(() => {
    setCurrentIndex(prev => Math.max(prev - 1, 0))
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        goToNext()
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        goToPrev()
      } else if (e.key === 'Escape') {
        if (!document.fullscreenElement) {
          onExit() // If already exited fullscreen, pressing Esc again will exit presentation mode
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [goToNext, goToPrev, onExit])

  // Render current slide
  const renderSlide = () => {
    const slide = slides[currentIndex]
    if (!slide) return null

    if (slide.type === 'summary') {
      return <SlideSummary projects={projects} tasks={tasks} selectedSlides={selectedSlides} />
    }

    if (!slide.project) return null

    switch (slide.type) {
      case 'overview':
        return <SlideOverview project={slide.project} tasks={tasks.filter(t => t.project_id === slide.project!.id)} theme={theme} />
      case 'gantt':
        return <SlideGantt project={slide.project} tasks={tasks.filter(t => t.project_id === slide.project!.id)} theme={theme} />
      case 'scurve':
        return <SlideSCurve project={slide.project} tasks={tasks.filter(t => t.project_id === slide.project!.id)} payments={payments.filter(p => p.project_id === slide.project!.id)} theme={theme} />
      case 'photos':
        return <SlidePhotos 
          project={slide.project} 
          selectedPhotoUrls={slide.slideData?.selectedPhotoUrls || []} 
        />
      default:
        return null
    }
  }

  const isDark = theme === 'dark'

  return (
    <div className={`fixed inset-0 z-50 ${isDark ? 'dark bg-[#0d0f14] text-white' : 'bg-[#f0f2f5] text-slate-900'} flex flex-col font-['Sarabun'] overflow-hidden select-none`}>
      {/* 16:9 Container scaled to fit */}
      <div className="flex-1 w-full h-full flex items-center justify-center relative">
        <div 
          className="relative w-full h-full"
          style={{
            aspectRatio: '16/9',
            maxHeight: '100vh',
            maxWidth: '100vw',
          }}
        >
          {/* Inner Slide Wrapper */}
          <div className="absolute inset-0 p-8 flex flex-col">
             {renderSlide()}
          </div>
        </div>

        {/* Overlay UI (hidden in real presentation if idle, but shown for controls) */}
        <div className="absolute top-4 right-4 flex gap-2 opacity-20 hover:opacity-100 transition-opacity z-50">
          <button onClick={toggleFullscreen} className={`p-2 ${isDark ? 'bg-white/10 hover:bg-white/20' : 'bg-black/10 hover:bg-black/20'} rounded-lg backdrop-blur`}>
            {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
          </button>
          <button onClick={onExit} className={`p-2 ${isDark ? 'bg-white/10 hover:bg-red-500/80' : 'bg-black/10 hover:bg-red-500 text-black hover:text-white'} rounded-lg backdrop-blur`}>
            <X size={20} />
          </button>
        </div>

        {/* Slide Counter */}
        <div className={`absolute bottom-4 right-6 text-xl font-bold opacity-50 ${isDark ? 'text-white' : 'text-slate-800'}`}>
          {currentIndex + 1} / {slides.length}
        </div>

        {/* Navigation Arrows (Sides) */}
        <button 
          onClick={goToPrev}
          disabled={currentIndex === 0}
          className={`absolute left-4 top-1/2 -translate-y-1/2 p-4 opacity-0 hover:opacity-100 disabled:hidden transition-opacity ${isDark ? 'text-white/50 hover:text-white' : 'text-black/30 hover:text-black'}`}
        >
          <ChevronLeft size={48} />
        </button>
        
        <button 
          onClick={goToNext}
          disabled={currentIndex === slides.length - 1}
          className={`absolute right-4 top-1/2 -translate-y-1/2 p-4 opacity-0 hover:opacity-100 disabled:hidden transition-opacity ${isDark ? 'text-white/50 hover:text-white' : 'text-black/30 hover:text-black'}`}
        >
          <ChevronRight size={48} />
        </button>
      </div>

      {/* Thumbnail Rail (Bottom) */}
      <div className={`h-16 ${isDark ? 'bg-black/50 border-white/10' : 'bg-white/50 border-black/10'} border-t flex items-center px-4 overflow-x-auto gap-2 scrollbar-hide`}>
        {slides.map((slide, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentIndex(idx)}
            className={`flex-shrink-0 h-10 px-3 rounded-md text-xs font-bold border transition-all ${
              idx === currentIndex 
                ? 'bg-[#a13c9d] border-[#a13c9d] text-white' 
                : isDark 
                  ? 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                  : 'bg-black/5 border-black/10 text-slate-500 hover:bg-black/10'
            }`}
          >
            {slide.type === 'summary' ? 'Summary' : slide.project?.name.substring(0, 15) + '...'}
            <span className={`ml-1 block text-[9px] uppercase ${idx === currentIndex ? 'opacity-80' : 'opacity-50'}`}>{slide.type}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
