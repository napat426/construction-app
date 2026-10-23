'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Project, WBSTask, Inspection, ProjectMilestone, ContractAmendment } from '@/lib/types'
import type { SelectedProjectSlide } from '../PresentationClient'
import {
  Maximize,
  Minimize,
  X,
  ChevronLeft,
  ChevronRight,
  Printer,
  Layers,
  FileText,
  ExternalLink,
  Sun,
  Moon,
  Check,
} from 'lucide-react'

import { SlideOverview } from './SlideOverview'
import { SlideSCurve } from './SlideSCurve'
import { SlidePhotos } from './SlidePhotos'
import { SlideSummary } from './SlideSummary'
import { SlideGantt } from './SlideGantt'

interface Props {
  projects: Project[]
  tasks: WBSTask[]
  inspections: Inspection[]
  milestones: ProjectMilestone[]
  amendments?: ContractAmendment[]
  selectedSlides: SelectedProjectSlide[]
  theme: 'dark' | 'light'
  onExit: () => void
}

type SlideDef = {
  type: 'summary' | 'overview' | 'gantt' | 'scurve' | 'photos'
  project?: Project
  slideData?: SelectedProjectSlide
}

export function PresentationEngine({
  projects,
  tasks,
  inspections,
  milestones,
  amendments = [],
  selectedSlides,
  theme,
  onExit,
}: Props) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)

  // Print controls
  const [printModalOpen, setPrintModalOpen] = useState(false)
  const [printScope, setPrintScope] = useState<'all' | 'current'>('all')
  const [printTheme, setPrintTheme] = useState<'light' | 'dark'>(theme)

  // Generate flat list of slides
  const slides: SlideDef[] = []

  // 1. Summary at the beginning
  slides.push({ type: 'summary' })

  // 2. Project slides
  selectedSlides.forEach((slideSelection) => {
    const proj = projects.find((p) => p.id === slideSelection.projectId)
    if (!proj) return
    if (slideSelection.showOverview) slides.push({ type: 'overview', project: proj })
    if (slideSelection.showGantt) slides.push({ type: 'gantt', project: proj })
    if (slideSelection.showSCurve) slides.push({ type: 'scurve', project: proj })
    if (slideSelection.showPhotos) slides.push({ type: 'photos', project: proj, slideData: slideSelection })
  })

  // Fullscreen management
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
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
    setCurrentIndex((prev) => Math.min(prev + 1, slides.length - 1))
  }, [slides.length])

  const goToPrev = useCallback(() => {
    setCurrentIndex((prev) => Math.max(prev - 1, 0))
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't navigate while modal is open
      if (printModalOpen) {
        if (e.key === 'Escape') setPrintModalOpen(false)
        return
      }

      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        goToNext()
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        goToPrev()
      } else if (e.key === 'Escape') {
        if (!document.fullscreenElement) {
          onExit()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [goToNext, goToPrev, onExit, printModalOpen])

  // Trigger browser print
  const handleTriggerPrint = (scope: 'all' | 'current') => {
    setPrintScope(scope)
    setPrintModalOpen(false)
    setTimeout(() => {
      window.print()
    }, 400)
  }

  // Open separate print preview tab
  const handleOpenPrintPreview = () => {
    localStorage.setItem('print_selected_slides', JSON.stringify(selectedSlides))
    localStorage.setItem('presentation_theme', printTheme)
    window.open('/presentation/print', '_blank')
    setPrintModalOpen(false)
  }

  // Render individual slide content for both screen and print
  const renderSlideContent = (slide: SlideDef, activeTheme: 'dark' | 'light' = theme) => {
    if (!slide) return null

    if (slide.type === 'summary') {
      return (
        <SlideSummary
          projects={projects}
          tasks={tasks}
          milestones={milestones}
          amendments={amendments}
          theme={activeTheme}
          selectedSlides={selectedSlides}
        />
      )
    }

    if (!slide.project) return null

    switch (slide.type) {
      case 'overview':
        return (
          <SlideOverview
            project={slide.project}
            tasks={tasks.filter((t) => t.project_id === slide.project!.id)}
            milestones={milestones.filter((m) => m.project_id === slide.project!.id)}
            amendments={amendments.filter((a) => a.project_id === slide.project!.id)}
            inspections={inspections.filter((i) => i.project_id === slide.project!.id)}
            theme={activeTheme}
          />
        )
      case 'gantt':
        return (
          <SlideGantt
            project={slide.project}
            tasks={tasks.filter((t) => t.project_id === slide.project!.id)}
            amendments={amendments.filter((a) => a.project_id === slide.project!.id)}
            theme={activeTheme}
          />
        )
      case 'scurve':
        return (
          <SlideSCurve
            project={slide.project}
            tasks={tasks.filter((t) => t.project_id === slide.project!.id)}
            milestones={milestones.filter((m) => m.project_id === slide.project!.id)}
            amendments={amendments.filter((a) => a.project_id === slide.project!.id)}
            theme={activeTheme}
          />
        )
      case 'photos': {
        let photoUrls = slide.slideData?.selectedPhotoUrls || []
        if (photoUrls.length < 4 && slide.slideData?.availablePhotoUrls) {
          const more = slide.slideData.availablePhotoUrls.filter((u) => !photoUrls.includes(u))
          photoUrls = [...photoUrls, ...more].slice(0, 4)
        }
        if (photoUrls.length < 4) {
          const pInspections = inspections.filter((i) => i.project_id === slide.project!.id)
          const insp = pInspections.flatMap((i) => i.photo_urls || []).map((r) => r.split('|||')[0])
          const more = insp.filter((u) => !photoUrls.includes(u))
          photoUrls = [...photoUrls, ...more].slice(0, 4)
        }
        return (
          <SlidePhotos
            project={slide.project}
            selectedPhotoUrls={photoUrls}
            theme={activeTheme}
          />
        )
      }
      default:
        return null
    }
  }

  const isDark = theme === 'dark'
  const isPrintDark = printTheme === 'dark'

  return (
    <div
      className={`fixed inset-0 z-50 ${
        isDark ? 'dark bg-[#0d0f14] text-white' : 'bg-[#f0f2f5] text-slate-900'
      } flex flex-col font-['Sarabun'] select-none print:relative print:inset-auto print:z-auto print:overflow-visible print:bg-transparent print:text-black`}
    >
      {/* ── Exact 16:9 Slide centered on A4 Landscape (297mm × 210mm) ── */}
      <style>{`
        @page {
          size: A4 landscape;
          margin: 0;
        }

        /* ── Keep print deck measured and rendered offscreen before print ── */
        @media screen {
          .presentation-print-deck {
            position: fixed !important;
            top: -30000px !important;
            left: -30000px !important;
            width: 1280px !important;
            height: 860px !important;
            opacity: 0 !important;
            pointer-events: none !important;
            z-index: -9999 !important;
            overflow: hidden !important;
          }
        }

        @media print {
          html, body {
            width: 297mm !important;
            height: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: ${isPrintDark ? '#0d0f14' : '#ffffff'} !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Hide everything on screen except print container */
          header, nav, .presentation-screen-mode {
            display: none !important;
          }

          .presentation-print-deck {
            position: static !important;
            top: auto !important;
            left: auto !important;
            width: 297mm !important;
            margin: 0 !important;
            padding: 0 !important;
            opacity: 1 !important;
            display: block !important;
            pointer-events: auto !important;
            z-index: auto !important;
          }

          /* Each page is exactly 1 A4 sheet, with display: block so page breaks work reliably */
          .print-slide-page {
            width: 297mm !important;
            height: 210mm !important;
            max-width: 297mm !important;
            max-height: 210mm !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            position: relative !important;
            overflow: hidden !important;
            margin: 0 !important;
            padding: 8mm 9mm 0 9mm !important;
            box-sizing: border-box !important;
            display: block !important;
            background: ${isPrintDark ? '#0d0f14' : '#ffffff'} !important;
          }

          /* Never generate an extra empty page after the last slide */
          .print-slide-page:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }

          /* Scaled slide box: 1280px wide × 860px high, scaled by 0.82 to fit A4 sheet cleanly */
          .print-slide-native {
            width: 1280px !important;
            height: 860px !important;
            max-width: 1280px !important;
            max-height: 860px !important;
            transform: scale(0.82) !important;
            transform-origin: top center !important;
            padding: 0 !important;
            margin: 0 auto !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: stretch !important;
            background: ${isPrintDark ? '#0d0f14' : '#ffffff'} !important;
          }

          .print-slide-native > * {
            width: 100% !important;
            height: 100% !important;
            flex: 1 1 0% !important;
          }
        }
      `}</style>

      {/* ──────── SCREEN MODE CONTAINER (Hidden when printing) ──────── */}
      <div className="presentation-screen-mode flex-1 w-full h-full flex flex-col overflow-hidden print:hidden">
        {/* 16:9 Container scaled to fit viewport */}
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
              {renderSlideContent(slides[currentIndex], theme)}
            </div>
          </div>

          {/* Overlay UI */}
          <div className="absolute top-4 right-4 flex gap-2 opacity-30 hover:opacity-100 transition-opacity z-50">
            <button
              onClick={() => setPrintModalOpen(true)}
              className={`p-2.5 ${
                isDark ? 'bg-white/10 hover:bg-purple-600' : 'bg-black/10 hover:bg-purple-600 hover:text-white'
              } rounded-xl backdrop-blur transition-all cursor-pointer`}
              title="พิมพ์ / บันทึก PDF (16:9)"
            >
              <Printer size={20} />
            </button>
            <button
              onClick={toggleFullscreen}
              className={`p-2.5 ${
                isDark ? 'bg-white/10 hover:bg-white/20' : 'bg-black/10 hover:bg-black/20'
              } rounded-xl backdrop-blur transition-all cursor-pointer`}
              title={isFullscreen ? 'ออกจากเต็มจอ' : 'แสดงเต็มจอ'}
            >
              {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
            </button>
            <button
              onClick={onExit}
              className={`p-2.5 ${
                isDark ? 'bg-white/10 hover:bg-red-500/80' : 'bg-black/10 hover:bg-red-500 hover:text-white'
              } rounded-xl backdrop-blur transition-all cursor-pointer`}
              title="ปิดการนำเสนอ"
            >
              <X size={20} />
            </button>
          </div>

          {/* Slide Counter */}
          <div
            className={`absolute bottom-4 right-6 text-xl font-bold opacity-50 ${
              isDark ? 'text-white' : 'text-slate-800'
            }`}
          >
            {currentIndex + 1} / {slides.length}
          </div>

          {/* Navigation Arrows (Sides) */}
          <button
            onClick={goToPrev}
            disabled={currentIndex === 0}
            className={`absolute left-4 top-1/2 -translate-y-1/2 p-4 opacity-0 hover:opacity-100 disabled:hidden transition-opacity cursor-pointer ${
              isDark ? 'text-white/50 hover:text-white' : 'text-black/30 hover:text-black'
            }`}
            title="สไลด์ก่อนหน้า (Arrow Left)"
          >
            <ChevronLeft size={48} />
          </button>

          <button
            onClick={goToNext}
            disabled={currentIndex === slides.length - 1}
            className={`absolute right-4 top-1/2 -translate-y-1/2 p-4 opacity-0 hover:opacity-100 disabled:hidden transition-opacity cursor-pointer ${
              isDark ? 'text-white/50 hover:text-white' : 'text-black/30 hover:text-black'
            }`}
            title="สไลด์ถัดไป (Arrow Right / Space)"
          >
            <ChevronRight size={48} />
          </button>
        </div>

        {/* Thumbnail Rail (Bottom) */}
        <div
          className={`h-16 ${
            isDark ? 'bg-black/50 border-white/10' : 'bg-white/50 border-black/10'
          } border-t flex items-center px-4 overflow-x-auto gap-2 scrollbar-hide`}
        >
          {slides.map((slide, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`flex-shrink-0 h-10 px-3 rounded-md text-xs font-bold border transition-all cursor-pointer ${
                idx === currentIndex
                  ? 'bg-[#a13c9d] border-[#a13c9d] text-white shadow-md'
                  : isDark
                  ? 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                  : 'bg-black/5 border-black/10 text-slate-500 hover:bg-black/10'
              }`}
            >
              {slide.type === 'summary' ? 'Summary' : slide.project?.name.substring(0, 15) + '...'}
              <span
                className={`ml-1 block text-[9px] uppercase ${
                  idx === currentIndex ? 'opacity-90' : 'opacity-50'
                }`}
              >
                {slide.type}
              </span>
            </button>
          ))}
        </div>

        {/* ──────── PRINT OPTIONS MODAL ──────── */}
        {printModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
            <div
              className={`w-full max-w-lg rounded-2xl shadow-2xl border p-6 space-y-5 ${
                isDark ? 'bg-[#14142a] border-[#252548] text-white' : 'bg-white border-slate-200 text-slate-900'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-black flex items-center gap-2">
                    <Printer className="text-purple-500" size={22} />
                    พิมพ์ / บันทึก PDF ขนาด 16:9 (Widescreen)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    จัดหน้าแนวนอน 297 × 167 มม. (สัดส่วน 16:9 พอดีจอ ไม่มีขอบขาวเหลือ)
                  </p>
                </div>
                <button
                  onClick={() => setPrintModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Scope Selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  สไลด์ที่ต้องการพิมพ์:
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPrintScope('all')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      printScope === 'all'
                        ? 'border-purple-500 bg-purple-500/10 text-purple-600 dark:text-purple-300 font-bold'
                        : isDark
                        ? 'border-[#252548] bg-white/5 hover:bg-white/10 text-slate-300'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Layers size={16} />
                        <span className="text-sm">ทุกสไลด์</span>
                      </div>
                      {printScope === 'all' && <Check size={16} className="text-purple-500" />}
                    </div>
                    <div className="text-[11px] opacity-70 mt-1">
                      {slides.length} สไลด์ (1 สไลด์ต่อ 1 หน้า)
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPrintScope('current')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      printScope === 'current'
                        ? 'border-purple-500 bg-purple-500/10 text-purple-600 dark:text-purple-300 font-bold'
                        : isDark
                        ? 'border-[#252548] bg-white/5 hover:bg-white/10 text-slate-300'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText size={16} />
                        <span className="text-sm">เฉพาะสไลด์นี้</span>
                      </div>
                      {printScope === 'current' && <Check size={16} className="text-purple-500" />}
                    </div>
                    <div className="text-[11px] opacity-70 mt-1">
                      หน้า {currentIndex + 1} จาก {slides.length}
                    </div>
                  </button>
                </div>
              </div>

              {/* Theme Selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  ธีมสีเอกสาร PDF:
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPrintTheme('light')}
                    className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold cursor-pointer transition-all ${
                      printTheme === 'light'
                        ? 'border-purple-500 bg-purple-500/10 text-purple-600 dark:text-purple-300'
                        : isDark
                        ? 'border-[#252548] bg-white/5 hover:bg-white/10 text-slate-300'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <Sun size={15} /> โหมดสว่าง (แนะนำสำหรับ PDF)
                  </button>

                  <button
                    type="button"
                    onClick={() => setPrintTheme('dark')}
                    className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold cursor-pointer transition-all ${
                      printTheme === 'dark'
                        ? 'border-purple-500 bg-purple-500/10 text-purple-600 dark:text-purple-300'
                        : isDark
                        ? 'border-[#252548] bg-white/5 hover:bg-white/10 text-slate-300'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <Moon size={15} /> โหมดมืด (ตามหน้าจอ)
                  </button>
                </div>
              </div>

              {/* Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => handleTriggerPrint(printScope)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30 transition-all cursor-pointer"
                >
                  <Printer size={16} /> พิมพ์ / บันทึก PDF ทันที
                </button>
                <button
                  type="button"
                  onClick={handleOpenPrintPreview}
                  className={`py-2.5 px-4 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    isDark
                      ? 'border-[#252548] hover:bg-white/10 text-slate-300'
                      : 'border-slate-200 hover:bg-slate-100 text-slate-700'
                  }`}
                  title="เปิดหน้าตัวอย่างการพิมพ์แบบเต็มในแท็บใหม่"
                >
                  <ExternalLink size={14} /> เปิดแท็บพรีวิว
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ──────── PRINT DECK CONTAINER (Kept live offscreen for SVG chart measurement, active on print) ──────── */}
      <div className="presentation-print-deck">
        {(printScope === 'all' ? slides : [slides[currentIndex]]).filter(Boolean).map((slide, sIdx) => (
          <div
            key={sIdx}
            className={`print-slide-page ${
              isPrintDark ? 'dark bg-[#0d0f14] text-white' : 'bg-white text-slate-900'
            }`}
          >
            <div
              className={`print-slide-native ${
                isPrintDark ? 'dark bg-[#0d0f14] text-white' : 'bg-white text-slate-900'
              }`}
            >
              {renderSlideContent(slide, printTheme)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
