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
  const [ready, setReady] = useState(false)

  // Load selected slides from localStorage (set by PresentationClient before opening print page)
  useEffect(() => {
    try {
      const stored = localStorage.getItem('print_selected_slides')
      if (stored) setSelectedSlides(JSON.parse(stored))
    } catch {}
    setReady(true)
  }, [])

  // Auto-print after a short delay to let Recharts render
  useEffect(() => {
    if (!ready) return
    const timer = setTimeout(() => {
      window.print()
    }, 2500)
    return () => clearTimeout(timer)
  }, [ready])


  // Build the list of slides to render
  const slides: React.ReactNode[] = []

  // Slide 1: Summary (always first)
  slides.push(
    <SlideWrapper key="summary">
      <SlideSummary
        projects={allProjects}
        tasks={allTasks}
        milestones={allMilestones}
        amendments={allAmendments}
        selectedSlides={selectedSlides}
        theme="light"
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

    const selectedPhotoUrls =
      slideSelection.selectedPhotoUrls?.length > 0
        ? slideSelection.selectedPhotoUrls
        : [...new Set([...inspectionPhotos, ...dailyPhotos, ...concretePhotos])].filter(Boolean).slice(0, 4)

    if (slideSelection.showOverview) {
      slides.push(
        <SlideWrapper key={`${proj.id}-overview`}>
          <SlideOverview
            project={proj}
            tasks={pTasks}
            milestones={pMilestones}
            amendments={pAmendments}
            inspections={pInspections}
            theme="light"
          />
        </SlideWrapper>
      )
    }
    if (slideSelection.showGantt) {
      slides.push(
        <SlideWrapper key={`${proj.id}-gantt`}>
          <SlideGantt project={proj} tasks={pTasks} amendments={pAmendments} theme="light" />
        </SlideWrapper>
      )
    }
    if (slideSelection.showSCurve) {
      slides.push(
        <SlideWrapper key={`${proj.id}-scurve`}>
          <SlideSCurve
            project={proj}
            tasks={pTasks}
            milestones={pMilestones}
            amendments={pAmendments}
            theme="light"
          />
        </SlideWrapper>
      )
    }
    if (slideSelection.showPhotos) {
      slides.push(
        <SlideWrapper key={`${proj.id}-photos`}>
          <SlidePhotos project={proj} selectedPhotoUrls={selectedPhotoUrls} theme="light" />
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
          background: #ffffff;
          font-family: 'Inter', 'Noto Sans Thai', sans-serif;
        }

        /* ─── Print page setup ─── */
        @page {
          size: A4 landscape;
          margin: 0;
        }

        /* Screen: show all slides stacked */
        .slide-page-wrapper {
          width: 297mm;
          height: 210mm;
          overflow: hidden;
          position: relative;
          background: #ffffff;
          page-break-after: always;
          break-after: page;
        }

        /* The actual slide rendered at 1280×720, then scaled */
        .slide-native {
          width: 1280px;
          height: 720px;
          transform: scale(0.877);
          transform-origin: top left;
          background: #ffffff;
          overflow: hidden;
          position: absolute;
          top: 0;
          left: 0;
        }

        /* Screen preview bar */
        .print-toolbar {
          position: fixed;
          top: 0; left: 0; right: 0;
          background: #1e293b;
          color: white;
          padding: 12px 24px;
          display: flex;
          align-items: center;
          gap: 16px;
          z-index: 9999;
          font-family: 'Inter', sans-serif;
          font-size: 14px;
        }

        .print-toolbar button {
          padding: 8px 20px;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          font-weight: bold;
          font-size: 14px;
        }

        .btn-print { background: #7c3aed; color: white; }
        .btn-close { background: #475569; color: white; }

        .slides-container {
          padding-top: 52px;
        }

        @media print {
          .print-toolbar { display: none !important; }
          .slides-container { padding-top: 0; }

          .slide-page-wrapper {
            page-break-after: always;
            break-after: page;
            page-break-inside: avoid;
          }
        }
      `}</style>

      <div className="print-toolbar">
        <span>🖨️ พรีวิว PDF — {slides.length} สไลด์</span>
        <button className="btn-print" onClick={() => window.print()}>พิมพ์ / บันทึก PDF</button>
        <button className="btn-close" onClick={() => window.close()}>ปิด</button>
      </div>

      <div className="slides-container">
        {slides}
      </div>
    </>
  )
}

/** Wraps a slide component at 1280×720, scaled down to A4 landscape */
function SlideWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="slide-page-wrapper">
      <div className="slide-native">
        {children}
      </div>
    </div>
  )
}
