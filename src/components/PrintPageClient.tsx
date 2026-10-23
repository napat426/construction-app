'use client'

import { useEffect, useState } from 'react'
import type { Project, WBSTask, ProjectMilestone, ContractAmendment, Inspection } from '@/lib/types'
import type { SelectedProjectSlide } from './PresentationClient'
import { SlideSummary } from './presentation/SlideSummary'
import { SlideOverview } from './presentation/SlideOverview'
import { SlideGantt } from './presentation/SlideGantt'
import { SlideSCurve } from './presentation/SlideSCurve'
import { SlidePhotos } from './presentation/SlidePhotos'

interface Props {
  allProjects: Project[]
  allTasks: WBSTask[]
  allMilestones: ProjectMilestone[]
  allAmendments: ContractAmendment[]
  allInspections: Inspection[]
  allDailyReports: { project_id: string; photos: any[]; created_at: string }[]
  allConcretePours: { project_id: string; photos: any[]; created_at: string }[]
}

/**
 * Each slide is rendered at native 1280×720px (16:9),
 * then CSS-scaled to fit A4 landscape (297mm × 210mm ≈ 1123×794px at 96dpi).
 *
 * Scale factor: 1123 / 1280 ≈ 0.877
 * The wrapper is 297mm × 210mm so each slide breaks onto its own page.
 */
export function PrintPageClient({
  allProjects,
  allTasks,
  allMilestones,
  allAmendments,
  allInspections,
  allDailyReports,
  allConcretePours,
}: Props) {
  const [selectedSlides, setSelectedSlides] = useState<SelectedProjectSlide[]>([])
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [ready, setReady] = useState(false)

  // Load selected slides and theme from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('print_selected_slides')
      if (stored) setSelectedSlides(JSON.parse(stored))
      const storedTheme = localStorage.getItem('presentation_theme')
      if (storedTheme === 'dark' || storedTheme === 'light') {
        setTheme(storedTheme)
      }
    } catch {}
    setReady(true)
  }, [])

  // Tailwind `dark:` variants match ANY `.dark` ancestor (including <html>, set by the app theme).
  // Force <html> to match the chosen print theme, otherwise light slides render with dark-mode text colors.
  useEffect(() => {
    const root = document.documentElement
    const hadDark = root.classList.contains('dark')
    root.classList.toggle('dark', theme === 'dark')
    return () => {
      root.classList.toggle('dark', hadDark)
    }
  }, [theme])

  // Auto-print after a short delay to let Recharts render
  useEffect(() => {
    if (!ready) return
    const timer = setTimeout(() => {
      window.print()
    }, 1500)
    return () => clearTimeout(timer)
  }, [ready])

  const isDark = theme === 'dark'

  // Build the list of slides to render
  const slides: React.ReactNode[] = []

  // Slide 1: Summary (always first)
  slides.push(
    <SlideWrapper key="summary" isDark={isDark}>
      <SlideSummary
        projects={allProjects}
        tasks={allTasks}
        milestones={allMilestones}
        amendments={allAmendments}
        selectedSlides={selectedSlides}
        theme={theme}
      />
    </SlideWrapper>
  )

  // Per-project slides
  selectedSlides.forEach((slideSelection) => {
    const proj = allProjects.find((p) => p.id === slideSelection.projectId)
    if (!proj) return
    const pTasks = allTasks.filter((t) => t.project_id === proj.id)
    const pMilestones = allMilestones.filter((m) => m.project_id === proj.id)
    const pAmendments = allAmendments.filter((a) => a.project_id === proj.id)
    const pInspections = allInspections.filter((i) => i.project_id === proj.id)

    // Get photos
    const inspectionPhotos = allInspections
      .filter((i) => i.project_id === proj.id)
      .flatMap((i) => (i.photo_urls || []).map((r: string) => r.split('|||')[0]))
    const dailyPhotos = allDailyReports
      .filter((d) => d.project_id === proj.id)
      .flatMap((d) => (d.photos || []).map((p: any) => (typeof p === 'string' ? p : p.url || '')))
    const concretePhotos = allConcretePours
      .filter((c) => c.project_id === proj.id)
      .flatMap((c) => (c.photos || []).map((p: any) => (typeof p === 'string' ? p : p.url || '')))

    const allProjPhotos = [...new Set([...inspectionPhotos, ...dailyPhotos, ...concretePhotos])].filter(Boolean)
    let selectedPhotoUrls = slideSelection.selectedPhotoUrls?.length > 0
      ? slideSelection.selectedPhotoUrls
      : allProjPhotos.slice(0, 4)
    if (selectedPhotoUrls.length < 4) {
      const more = allProjPhotos.filter((u) => !selectedPhotoUrls.includes(u))
      selectedPhotoUrls = [...selectedPhotoUrls, ...more].slice(0, 4)
    }

    if (slideSelection.showOverview) {
      slides.push(
        <SlideWrapper key={`${proj.id}-overview`} isDark={isDark}>
          <SlideOverview
            project={proj}
            tasks={pTasks}
            milestones={pMilestones}
            amendments={pAmendments}
            inspections={pInspections}
            theme={theme}
          />
        </SlideWrapper>
      )
    }
    if (slideSelection.showGantt) {
      slides.push(
        <SlideWrapper key={`${proj.id}-gantt`} isDark={isDark}>
          <SlideGantt project={proj} tasks={pTasks} amendments={pAmendments} theme={theme} />
        </SlideWrapper>
      )
    }
    if (slideSelection.showSCurve) {
      slides.push(
        <SlideWrapper key={`${proj.id}-scurve`} isDark={isDark}>
          <SlideSCurve
            project={proj}
            tasks={pTasks}
            milestones={pMilestones}
            amendments={pAmendments}
            theme={theme}
          />
        </SlideWrapper>
      )
    }
    if (slideSelection.showPhotos) {
      slides.push(
        <SlideWrapper key={`${proj.id}-photos`} isDark={isDark}>
          <SlidePhotos project={proj} selectedPhotoUrls={selectedPhotoUrls} theme={theme} />
        </SlideWrapper>
      )
    }
  })

  return (
    <>
      <style>{`
        /*
         * NOTE: Do NOT add a global "* { margin:0; padding:0 }" reset here.
         * Tailwind v4 puts utilities inside @layer, so any unlayered reset
         * overrides every padding/margin utility and collapses the slide layout.
         */
        html, body {
          background: ${isDark ? '#0d0f14' : '#e2e8f0'};
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        /* ─── A4 Landscape: 297mm × 210mm, one slide per sheet ─── */
        @page {
          size: A4 landscape;
          margin: 0;
        }

        /* One A4 landscape sheet (same box on screen preview and in print) */
        .slide-page-wrapper {
          position: relative;
          width: 297mm;
          height: 210mm;
          overflow: hidden;
          background: ${isDark ? '#0d0f14' : '#ffffff'};
          margin: 24px auto;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.25);
          border-radius: 6px;
        }

        /*
         * Slide is laid out at a fixed native size (1280×900 ≈ A4 ratio),
         * then absolutely centered and scaled: 1280×0.82 = 1050px (277.8mm),
         * 900×0.82 = 738px (195.3mm) → ~9.6mm side margins, ~7.4mm top/bottom.
         */
        .slide-native {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 1280px;
          height: 900px;
          padding: 20px;
          box-sizing: border-box;
          transform: translate(-50%, -50%) scale(0.82);
          transform-origin: center center;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .slide-native > * {
          width: 100%;
          height: 100%;
          min-height: 0;
          flex: 1 1 0%;
        }

        /* Screen preview toolbar */
        .print-toolbar {
          position: fixed;
          top: 0; left: 0; right: 0;
          background: #0f172a;
          color: white;
          padding: 10px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          z-index: 9999;
          font-size: 14px;
          border-bottom: 1px solid #1e293b;
        }
        .print-toolbar-left { display: flex; align-items: center; gap: 16px; }
        .print-toolbar-right { display: flex; align-items: center; gap: 10px; }
        .print-toolbar button {
          padding: 8px 16px;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          font-weight: bold;
          font-size: 13px;
          transition: all 0.15s ease;
        }
        .btn-print { background: #7c3aed; color: white; }
        .btn-print:hover { background: #6d28d9; }
        .btn-theme { background: #334155; color: white; }
        .btn-theme:hover { background: #475569; }
        .btn-close { background: #1e293b; color: #94a3b8; border: 1px solid #334155 !important; }
        .btn-close:hover { background: #334155; color: white; }

        .slides-container {
          padding-top: 60px;
          padding-bottom: 40px;
        }

        @media print {
          html, body {
            width: 297mm !important;
            margin: 0 !important;
            padding: 0 !important;
            min-height: 0 !important;
            background: ${isDark ? '#0d0f14' : '#ffffff'} !important;
          }

          .print-toolbar { display: none !important; }

          .slides-container {
            display: block !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          /* display:block (not flex) — Chromium ignores forced breaks on flex boxes */
          .slide-page-wrapper {
            display: block !important;
            margin: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            break-after: page;
            page-break-after: always;
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .slide-page-wrapper:last-child {
            break-after: auto;
            page-break-after: auto;
          }
        }
      `}</style>

      <div className="print-toolbar">
        <div className="print-toolbar-left">
          <span style={{ fontWeight: 700 }}>🖨️ พรีวิว PDF — {slides.length} สไลด์</span>
          <span style={{ fontSize: 12, opacity: 0.7 }}>กระดาษ A4 แนวนอน (297 × 210 มม.) · 1 สไลด์ต่อ 1 หน้า</span>
        </div>
        <div className="print-toolbar-right">
          <button
            className="btn-theme"
            onClick={() => {
              const next = theme === 'dark' ? 'light' : 'dark'
              setTheme(next)
              localStorage.setItem('presentation_theme', next)
            }}
          >
            {theme === 'dark' ? '☀️ โหมดสว่าง' : '🌙 โหมดมืด'}
          </button>
          <button className="btn-print" onClick={() => window.print()}>
            พิมพ์ / บันทึก PDF
          </button>
          <button className="btn-close" onClick={() => window.close()}>
            ปิดหน้าต่าง
          </button>
        </div>
      </div>

      <div className="slides-container">
        {slides}
      </div>
    </>
  )
}

/** Wraps a slide component at native 1280×900, centered & scaled onto one A4 landscape sheet */
function SlideWrapper({ children, isDark }: { children: React.ReactNode; isDark?: boolean }) {
  return (
    <div className={`slide-page-wrapper ${isDark ? 'dark' : ''}`}>
      <div className={`slide-native ${isDark ? 'dark bg-[#0d0f14] text-white' : 'bg-white text-slate-900'}`}>
        {children}
      </div>
    </div>
  )
}
