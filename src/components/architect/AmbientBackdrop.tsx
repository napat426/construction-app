'use client'

import React, { useMemo, useEffect, useState } from 'react'

/**
 * AmbientBackdrop:
 * Estudio Bang (bybang.co) inspired ambient lighting and studio perimeter aura.
 * Features:
 * 1. Glowing electric cyan/blue perimeter vignette (signature of bybang.co)
 * 2. Subtle architectural paper grid
 * 3. Dynamic dual-city studio clock (BKK UTC+7 & BCN UTC+2)
 * 4. Minimalist bottom studio signatures
 */
export function AmbientBackdrop() {
  const [mounted, setMounted] = useState(false)
  const [timeState, setTimeState] = useState({ bkk: '12:00', bcn: '07:00' })

  useEffect(() => {
    setMounted(true)

    const updateClocks = () => {
      const now = new Date()
      // Bangkok UTC+7
      const bkkTime = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Bangkok',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(now)

      // Barcelona UTC+2 (Europe/Madrid)
      const bcnTime = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Madrid',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(now)

      setTimeState({ bkk: bkkTime, bcn: bcnTime })
    }

    updateClocks()
    const timer = setInterval(updateClocks, 1000)
    return () => clearInterval(timer)
  }, [])

  const dailyMetrics = useMemo(() => {
    const now = new Date()
    const dayOfMonth = now.getDate()
    const dayOfWeek = now.getDay()
    const month = now.getMonth()

    const primaryDriftX = ((dayOfMonth * 3) % 25) - 12
    const primaryDriftY = ((dayOfWeek * 5) % 20) - 10

    const monthNames = [
      'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
      'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
    ]
    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

    return {
      primaryDriftX,
      primaryDriftY,
      studioLabel: `ESTUDIO BANG × ATELIER // ${dayNames[dayOfWeek]} ${String(dayOfMonth).padStart(2, '0')} ${monthNames[month]} 2026`,
    }
  }, [])

  if (!mounted) return null

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none"
    >
      {/* ── 1. Bybang Signature Glowing Perimeter Aura (Outer Viewport Vignette) ── */}
      <div
        className="fixed inset-0 pointer-events-none z-40 transition-opacity duration-700"
        style={{
          boxShadow: `
            inset 0 0 110px 18px rgba(96, 165, 250, 0.18),
            inset 0 0 45px 6px rgba(147, 197, 253, 0.26),
            inset 0 0 12px 1.5px rgba(224, 242, 254, 0.45)
          `,
        }}
      />

      {/* ── 2. Architectural Drafting Paper Grid (Subtle texture) ── */}
      <div 
        className="absolute inset-0 opacity-[0.35] dark:opacity-[0.14]"
        style={{
          backgroundImage: `
            radial-gradient(circle at 1px 1px, rgba(160, 150, 135, 0.22) 1px, transparent 0)
          `,
          backgroundSize: '32px 32px',
        }}
      />

      {/* ── 3. Dynamic Ambient Light Pools ── */}
      <div
        className="absolute w-[850px] h-[700px] rounded-full blur-[150px] opacity-60 dark:opacity-20 transition-all duration-1000 ease-out"
        style={{
          top: `calc(5% + ${dailyMetrics.primaryDriftY}%)`,
          left: `calc(15% + ${dailyMetrics.primaryDriftX}%)`,
          background: `radial-gradient(circle, rgba(235, 226, 212, 0.85) 0%, rgba(245, 240, 232, 0.4) 50%, transparent 80%)`,
          animation: 'studioFloat 28s cubic-bezier(0.16, 1, 0.3, 1) infinite alternate',
        }}
      />

      {/* ── 4. Bottom Studio Fixed Metadata (Exact Estudio Bang style) ── */}
      <div className="fixed bottom-3 inset-x-6 z-40 flex items-end justify-between pointer-events-none print:hidden text-stone-500/80 dark:text-stone-400/80 font-mono text-[10px]">
        {/* Left: Studio Copyright & Spec */}
        <div className="hidden md:flex flex-col gap-0.5 pointer-events-auto">
          <span className="font-bold text-stone-900 dark:text-stone-100 tracking-tight text-xs font-sans">
            estudio.bang
          </span>
          <span className="text-[9px] tracking-wider text-stone-400">
            demo.bybang.co // construction.atelier
          </span>
        </div>

        {/* Center: Legal & System Attribution */}
        <div className="hidden lg:block text-center tracking-wider text-[9.5px]">
          Copyright Estudio Bang® 2026 | ระบบควบคุมงานก่อสร้าง Demo | Architecture & Interiors
        </div>

        {/* Right: Live Clocks & Language */}
        <div className="flex flex-col items-end gap-0.5 pointer-events-auto ml-auto font-mono">
          <div className="flex items-center gap-2 text-[9px] tracking-widest uppercase font-bold text-stone-400">
            <span className="text-stone-900 dark:text-stone-100">ENG</span>
            <span>/</span>
            <span>TH</span>
          </div>
          <div className="flex items-center gap-3 text-[10px] font-bold tracking-tight text-stone-700 dark:text-stone-300">
            <span>BKK {timeState.bkk.replace(':', ' ')}</span>
            <span className="text-stone-300 dark:text-stone-700">•</span>
            <span>BCN {timeState.bcn.replace(':', ' ')}</span>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes studioFloat {
          0% {
            transform: translate3d(0, 0, 0) scale(1);
          }
          50% {
            transform: translate3d(18px, -24px, 0) scale(1.04);
          }
          100% {
            transform: translate3d(-14px, 16px, 0) scale(0.97);
          }
        }
      `}</style>
    </div>
  )
}

