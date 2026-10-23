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
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;700;900&family=Inter:wght@400;500;700;900&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        html, body {
          background: ${isDark ? '#0d0f14' : '#f1f5f9'};
          color: ${isDark ? '#ffffff' : '#0f172a'};
          font-family: 'Inter', 'Noto Sans Thai', sans-serif;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        /* ─── A4 Landscape Print Setup with 16:9 Centered Slide ─── */
        @page {
          size: A4 landscape;
          margin: 0;
        }

        /* Screen preview wrapper */
        .slide-page-wrapper {
          width: 297mm;
          height: 198mm;
          overflow: hidden;
          position: relative;
          background: ${isDark ? '#0d0f14' : '#ffffff'};
          margin: 24px auto;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2);
          border-radius: 8px;
          page-break-after: always;
          break-after: page;
        }

        /* The actual slide rendered at 1280×860, then CSS scaled to fit A4 */
        .slide-native {
          width: 1280px;
          height: 860px;
          transform: scale(0.82);
          transform-origin: top center;
          background: ${isDark ? '#0d0f14' : '#ffffff'};
          overflow: hidden;
          position: absolute;
          top: 15px;
          left: 50%;
          margin-left: -640px;
          padding: 0;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
        }

        .slide-native > * {
          width: 100%;
          height: 100%;
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
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          border-bottom: 1px solid #1e293b;
        }

        .print-toolbar-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .print-toolbar-right {
          display: flex;
          align-items: center;
          gap: 10px;
        }

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
            background: ${isDark ? '#0d0f14' : '#ffffff'} !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 297mm !important;
            height: 210mm !important;
          }

          .print-toolbar { display: none !important; }
          .slides-container {
            padding: 0 !important;
            margin: 0 !important;
          }

          .slide-page-wrapper {
            margin: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            width: 297mm !important;
            height: 210mm !important;
            max-width: 297mm !important;
            max-height: 210mm !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            overflow: hidden !important;
            padding: 8mm 9mm 0 9mm !important;
            box-sizing: border-box !important;
            display: block !important;
            background: ${isDark ? '#0d0f14' : '#ffffff'} !important;
          }

          .slide-page-wrapper:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }

          .slide-native {
            width: 1280px !important;
            height: 860px !important;
            max-width: 1280px !important;
            max-height: 860px !important;
            transform: scale(0.82) !important;
            transform-origin: top center !important;
            position: relative !important;
            top: auto !important;
            left: auto !important;
            margin: 0 auto !important;
            padding: 0 !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: stretch !important;
            background: ${isDark ? '#0d0f14' : '#ffffff'} !important;
          }

          .slide-native > * {
            width: 100% !important;
            height: 100% !important;
            flex: 1 1 0% !important;
          }
        }
      `}</style>

      <div className="print-toolbar">
        <div className="print-toolbar-left">
          <span style={{ fontWeight: 700 }}>🖨️ พรีวิว PDF (16:9 Widescreen) — {slides.length} สไลด์</span>
          <span style={{ fontSize: 12, opacity: 0.7 }}>ขนาด: 297 × 167.1 มม.</span>
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

/** Wraps a slide component at 1280×720, scaled down to 297mm × 167.0625mm (16:9) */
function SlideWrapper({ children, isDark }: { children: React.ReactNode; isDark?: boolean }) {
  return (
    <div className={`slide-page-wrapper ${isDark ? 'dark' : ''}`}>
      <div className={`slide-native ${isDark ? 'dark bg-[#0d0f14] text-white' : 'bg-white text-slate-900'}`}>
        {children}
      </div>
    </div>
  )
}
