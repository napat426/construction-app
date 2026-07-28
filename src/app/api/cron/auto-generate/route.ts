import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { backfillDailyReport } from '@/app/actions/reports'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get today's date in ICT (Asia/Bangkok) YYYY-MM-DD
    const now = new Date()
    // Convert to Bangkok timezone string
    const dateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }) // returns YYYY-MM-DD

    // Fetch all projects
    const { data: projects, error: projErr } = await supabase
      .from('projects')
      .select('id, name')
    if (projErr) {
      throw new Error(`Failed to fetch projects: ${projErr.message}`)
    }

    const results = []
    for (const project of projects) {
      const res = await backfillDailyReport(project.id, dateStr)
      results.push({
        project_id: project.id,
        name: project.name,
        result: res
      })
    }

    return NextResponse.json({
      success: true,
      date: dateStr,
      results
    })

  } catch (error: any) {
    console.error('Cron job failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
