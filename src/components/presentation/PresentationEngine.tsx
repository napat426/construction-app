'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Project, WBSTask, Inspection } from '@/lib/types'
import type { SelectedProjectSlide } from '../PresentationClient'
import { Maximize, Minimize, X, ChevronLeft, ChevronRight } from 'lucide-react'

import { SlideOverview } from './SlideOverview'
import { SlideSCurve } from './SlideSCurve'
import { SlidePhotos } from './SlidePhotos'
import { SlideSummary } from './SlideSummary'

interface Props {
  projects: Project[]
  tasks: WBSTask[]
  inspections: Inspection[]
  selectedSlides: SelectedProjectSlide[]
  onExit: () => void
}

type SlideDef = {
  type: 'overview' | 'scurve' | 'photos' | 'summary'
  project?: Project
  slideData?: SelectedProjectSlide
}

export function PresentationEngine({ projects, tasks, inspections, selectedSlides, onExit }: Props) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)

  // Generate flat list of slides
  const slides: SlideDef[] = []
  selectedSlides.forEach(slideSelection => {
    const proj = projects.find(p => p.id === slideSelection.projectId)
    if (!proj) return
    if (slideSelection.showOverview) slides.push({ type: 'overview', project: proj })
    if (slideSelection.showSCurve) slides.push({ type: 'scurve', project: proj })
    if (slideSelection.showPhotos) slides.push({ type: 'photos', project: proj, slideData: slideSelection })
  })
  
  // Always add summary at the end
  slides.push({ type: 'summary' })

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
      return <SlideSummary projects={projects} selectedSlides={selectedSlides} />
    }

    if (!slide.project) return null

    switch (slide.type) {
      case 'overview':
        return <SlideOverview project={slide.project} tasks={tasks.filter(t => t.project_id === slide.project!.id)} />
      case 'scurve':
        return <SlideSCurve project={slide.project} tasks={tasks.filter(t => t.project_id === slide.project!.id)} />
      case 'photos':
        return <SlidePhotos 
          project={slide.project} 
          selectedPhotoUrls={slide.slideData?.selectedPhotoUrls || []} 
        />
      default:
        return null
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#0d0f14] text-white flex flex-col font-['Sarabun'] overflow-hidden select-none">
      {/* 16:9 Container scaled to fit */}
      <div className="flex-1 w-full h-full flex items-center justify-center relative">
        <div 
          className="relative bg-[#0d0f14]"
          style={{
            aspectRatio: '16/9',
            maxHeight: '100vh',
            maxWidth: '100vw',
            width: '100%',
            height: 'auto',
          }}
        >
          {/* Inner 1920x1080 scaler using CSS container queries or transform. For simplicity, we just use percentages or flex layout internally inside the slide components. */}
          <div className="absolute inset-0 p-8 flex flex-col">
             {renderSlide()}
          </div>
        </div>

        {/* Overlay UI (hidden in real presentation if idle, but shown for controls) */}
        <div className="absolute top-4 right-4 flex gap-2 opacity-20 hover:opacity-100 transition-opacity">
          <button onClick={toggleFullscreen} className="p-2 bg-white/10 hover:bg-white/20 rounded-lg backdrop-blur">
            {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
          </button>
          <button onClick={onExit} className="p-2 bg-white/10 hover:bg-red-500/80 rounded-lg backdrop-blur">
            <X size={20} />
          </button>
        </div>

        {/* Slide Counter */}
        <div className="absolute bottom-4 right-6 text-xl font-bold opacity-50">
          {currentIndex + 1} / {slides.length}
        </div>

        {/* Navigation Arrows (Sides) */}
        <button 
          onClick={goToPrev}
          disabled={currentIndex === 0}
          className="absolute left-4 top-1/2 -translate-y-1/2 p-4 opacity-0 hover:opacity-100 disabled:hidden text-white/50 hover:text-white transition-opacity"
        >
          <ChevronLeft size={48} />
        </button>
        
        <button 
          onClick={goToNext}
          disabled={currentIndex === slides.length - 1}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-4 opacity-0 hover:opacity-100 disabled:hidden text-white/50 hover:text-white transition-opacity"
        >
          <ChevronRight size={48} />
        </button>
      </div>

      {/* Thumbnail Rail (Bottom) */}
      <div className="h-16 bg-black/50 border-t border-white/10 flex items-center px-4 overflow-x-auto gap-2 scrollbar-hide">
        {slides.map((slide, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentIndex(idx)}
            className={`flex-shrink-0 h-10 px-3 rounded-md text-xs font-bold border transition-all ${
              idx === currentIndex 
                ? 'bg-[#a13c9d] border-[#a13c9d] text-white' 
                : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
            }`}
          >
            {slide.type === 'summary' ? 'Summary' : slide.project?.name.substring(0, 15) + '...'}
            <span className="ml-1 opacity-50 block text-[9px] uppercase">{slide.type}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
