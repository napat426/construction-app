'use client'

import { useEffect } from 'react'

export default function CronPoller() {
  useEffect(() => {
    // Initial check on mount
    fetch('/api/cron/line-briefing').catch(() => {})

    // Check every 30 seconds
    const interval = setInterval(() => {
      fetch('/api/cron/line-briefing').catch(() => {})
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  return null
}
