'use client'

import React, { useMemo, useEffect, useState } from 'react'

/**
 * AmbientBackdrop:
 * Daily Dynamic Ambient Motion component for the Architectural Studio aesthetic.
 * Subtly shifts organic light pools, atmospheric depth, and drafting geometry
 * based on the current day of the week and day of the month.
 */
export function AmbientBackdrop() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const dailyMetrics = useMemo(() => {
    const now = new Date()
    const dayOfMonth = now.getDate() // 1-31
    const dayOfWeek = now.getDay() // 0-6
    const month = now.getMonth() // 0-11

    // Organic coordinates based on date
    const angle = (dayOfMonth * 11.6 + dayOfWeek * 25) % 360
    const primaryDriftX = ((dayOfMonth * 3) % 25) - 12
    const primaryDriftY = ((dayOfWeek * 5) % 20) - 10
    const secondaryAngle = (angle + 140) % 360

    const monthNames = [
      'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
      'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
    ]

    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

    return {
      angle,
      primaryDriftX,
      primaryDriftY,
      secondaryAngle,
      studioLabel: `ATELIER SPEC // ${dayNames[dayOfWeek]} ${String(dayOfMonth).padStart(2, '0')} ${monthNames[month]} // CAL.0${dayOfWeek + 1}`,
    }
  }, [])

  if (!mounted) return null

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none"
    >
      {/* ── 1. Architectural Drafting Paper Grid (Subtle, refined) ── */}
      <div 
        className="absolute inset-0 opacity-[0.45] dark:opacity-[0.18]"
        style={{
          backgroundImage: `
            radial-gradient(circle at 1px 1px, rgba(160, 150, 135, 0.22) 1px, transparent 0)
          `,
          backgroundSize: '32px 32px',
        }}
      />

      {/* ── 2. Dynamic Daily Ambient Light Pools ── */}
      {/* Pool A: Warm Alabaster / Sunken Limestone Glow */}
      <div
        className="absolute w-[800px] h-[650px] rounded-full blur-[140px] opacity-60 dark:opacity-20 transition-all duration-1000 ease-out"
        style={{
          top: `calc(5% + ${dailyMetrics.primaryDriftY}%)`,
          left: `calc(15% + ${dailyMetrics.primaryDriftX}%)`,
          background: `radial-gradient(circle, rgba(235, 226, 212, 0.85) 0%, rgba(245, 240, 232, 0.4) 50%, transparent 80%)`,
          animation: 'studioFloat 28s cubic-bezier(0.16, 1, 0.3, 1) infinite alternate',
        }}
      />

      {/* Pool B: Subtle Raw Brass / Ochre Accent Pool */}
      <div
        className="absolute w-[600px] h-[500px] rounded-full blur-[130px] opacity-40 dark:opacity-15 transition-all duration-1000 ease-out"
        style={{
          top: '40%',
          right: '8%',
          background: `radial-gradient(circle, rgba(214, 196, 170, 0.55) 0%, rgba(230, 220, 205, 0.25) 55%, transparent 80%)`,
          animation: 'studioFloat 34s cubic-bezier(0.22, 1, 0.36, 1) infinite alternate-reverse',
        }}
      />

      {/* ── 3. Ultra-Fine Hairline Studio Corner Accents ── */}
      <div className="absolute top-3 left-4 hidden lg:flex items-center gap-2 opacity-50 dark:opacity-30">
        <span className="w-1.5 h-1.5 rounded-full bg-stone-400 dark:bg-stone-500" />
        <span className="text-[9.5px] font-mono tracking-[0.22em] text-stone-500 dark:text-stone-400 uppercase">
          {dailyMetrics.studioLabel}
        </span>
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
