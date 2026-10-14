'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  X,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  Printer,
  RotateCcw,
  Sparkles,
  Eye,
} from 'lucide-react'

interface ReportPresentationModalProps {
  title: string
  subtitle?: string
  currentIndex?: number
  totalCount?: number
  onPrev?: () => void
  onNext?: () => void
  onPrint?: () => void
  onClose: () => void
  children: React.ReactNode
}

export function ReportPresentationModal({
  title,
  subtitle,
  currentIndex,
  totalCount,
  onPrev,
  onNext,
  onPrint,
  onClose,
  children,
}: ReportPresentationModalProps) {
  // Zoom level as percentage (e.g. 100 = 100%)
  const [zoom, setZoom] = useState<number>(100)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('dark')
  const containerRef = useRef<HTMLDivElement>(null)

  // Quick zoom presets
  const handleZoomIn = () => setZoom((prev) => Math.min(220, prev + 15))
  const handleZoomOut = () => setZoom((prev) => Math.max(45, prev - 15))
  const handleResetZoom = () => setZoom(100)

  // Fit to screen width / height helpers
  const handleFitWidth = () => setZoom(120)
  const handleFitPage = () => setZoom(85)

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input/textarea
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        if (onPrev) onPrev()
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        if (onNext) onNext()
      } else if (e.key === '+' || e.key === '=') {
        handleZoomIn()
      } else if (e.key === '-') {
        handleZoomOut()
      } else if (e.key === '0') {
        handleResetZoom()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, onPrev, onNext])

  // Fullscreen API toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
      setIsFullscreen(true)
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {})
      }
      setIsFullscreen(false)
    }
  }

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFsChange)
    return () => document.removeEventListener('fullscreenchange', handleFsChange)
  }, [])

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col select-none print:hidden transition-colors ${
        themeMode === 'dark' ? 'bg-[#0a0a16] text-white' : 'bg-slate-200 text-slate-900'
      }`}
    >
      {/* ── Top Presentation Control Bar ── */}
      <div className="flex-shrink-0 h-16 px-4 md:px-6 bg-slate-900/95 dark:bg-[#0e0e1e]/95 backdrop-blur-md border-b border-white/10 flex items-center justify-between gap-3 text-white shadow-xl z-20">
        {/* Left: Title & Document Badge */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-primary-600/30 border border-primary-500/50 flex items-center justify-center text-primary-400 flex-shrink-0">
            <Eye size={18} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary-500/20 text-primary-300 border border-primary-500/30 flex-shrink-0">
                โหมดพรีเซนต์
              </span>
              <h2 className="text-sm font-bold truncate">{title}</h2>
            </div>
            {subtitle && (
              <p className="text-[11px] text-slate-400 truncate mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>

        {/* Center: Slide/Item Navigation + Zoom Controls */}
        <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
          {/* Item Navigation (if multiple items) */}
          {totalCount !== undefined && totalCount > 1 && (
            <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
              <button
                type="button"
                onClick={onPrev}
                disabled={currentIndex === 0 || !onPrev}
                title="รายการก่อนหน้า (ลูกศรซ้าย)"
                className="p-1.5 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs font-mono font-bold px-2 text-slate-200">
                {(currentIndex ?? 0) + 1} / {totalCount}
              </span>
              <button
                type="button"
                onClick={onNext}
                disabled={currentIndex === totalCount - 1 || !onNext}
                title="รายการถัดไป (ลูกศรขวา)"
                className="p-1.5 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}

          {/* Zoom Controls */}
          <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
            <button
              type="button"
              onClick={handleZoomOut}
              title="ย่อขนาด (-)"
              className="p-1.5 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-all cursor-pointer"
            >
              <ZoomOut size={16} />
            </button>
            <button
              type="button"
              onClick={handleResetZoom}
              title="รีเซ็ตเป็น 100%"
              className="text-xs font-mono font-bold px-2 py-0.5 rounded hover:bg-white/10 text-slate-200 min-w-[52px] text-center"
            >
              {zoom}%
            </button>
            <button
              type="button"
              onClick={handleZoomIn}
              title="ขยายขนาด (+)"
              className="p-1.5 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-all cursor-pointer"
            >
              <ZoomIn size={16} />
            </button>

            {/* Quick Fit buttons */}
            <div className="hidden sm:flex items-center gap-1 border-l border-white/10 pl-1.5 ml-1">
              <button
                type="button"
                onClick={handleFitPage}
                title="พอดีหน้าจอ"
                className={`text-[10px] font-bold px-2 py-1 rounded-lg transition-all cursor-pointer ${
                  zoom === 85 ? 'bg-primary-600 text-white' : 'hover:bg-white/10 text-slate-300'
                }`}
              >
                พอดีหน้า
              </button>
              <button
                type="button"
                onClick={handleFitWidth}
                title="พอดีความกว้าง"
                className={`text-[10px] font-bold px-2 py-1 rounded-lg transition-all cursor-pointer ${
                  zoom === 120 ? 'bg-primary-600 text-white' : 'hover:bg-white/10 text-slate-300'
                }`}
              >
                กว้างเต็มจอ
              </button>
            </div>
          </div>
        </div>

        {/* Right: Actions (Theme, Fullscreen, Print, Close) */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Toggle Background Theme (Dark / Light) */}
          <button
            type="button"
            onClick={() => setThemeMode((m) => (m === 'dark' ? 'light' : 'dark'))}
            title={themeMode === 'dark' ? 'เปลี่ยนพื้นหลังเป็นสีสว่าง' : 'เปลี่ยนพื้นหลังเป็นสีมืด'}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-all cursor-pointer hidden md:flex items-center justify-center text-xs font-bold"
          >
            {themeMode === 'dark' ? '🌙 มืด' : '☀️ สว่าง'}
          </button>

          {/* Fullscreen button */}
          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'ออกจากเต็มหน้าจอ' : 'เปิดเต็มหน้าจอ'}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-all cursor-pointer hidden sm:flex items-center justify-center"
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>

          {/* Print button */}
          {onPrint && (
            <button
              type="button"
              onClick={onPrint}
              title="พิมพ์เอกสารนี้"
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Printer size={14} />
              <span className="hidden sm:inline">พิมพ์</span>
            </button>
          )}

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            title="ปิดโหมดพรีเซนต์ (Esc)"
            className="p-2 rounded-xl bg-red-600/80 hover:bg-red-600 text-white text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-1.5"
          >
            <X size={17} />
            <span className="hidden sm:inline">ปิด</span>
          </button>
        </div>
      </div>

      {/* ── Document Canvas Viewport ── */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto p-4 md:p-8 flex items-start justify-center cursor-default"
      >
        <div
          style={{
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'top center',
            transition: 'transform 0.12s ease-out',
          }}
          className="pb-16"
        >
          {children}
        </div>
      </div>

      {/* ── Bottom Floating Shortcut Tip ── */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none opacity-40 hover:opacity-100 transition-opacity text-[11px] text-white/70 bg-black/50 px-3 py-1 rounded-full border border-white/10 backdrop-blur-sm hidden sm:block">
        กด <kbd className="font-mono bg-white/10 px-1 rounded">Esc</kbd> ปิด •{' '}
        <kbd className="font-mono bg-white/10 px-1 rounded">◀</kbd>{' '}
        <kbd className="font-mono bg-white/10 px-1 rounded">▶</kbd> เปลี่ยนหน้า •{' '}
        <kbd className="font-mono bg-white/10 px-1 rounded">+</kbd>{' '}
        <kbd className="font-mono bg-white/10 px-1 rounded">-</kbd> ซูม
      </div>
    </div>
  )
}
