const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://txexenqijhxtdrzgltsm.supabase.co'
const supabaseKey = 'sb_publishable_q3APA2Io-DD6j8ig-cJWfg_6tr77c2P'
const supabase = createClient(supabaseUrl, supabaseKey)

// Custom natural sort for WBS numbers
function sortWBS(a, b) {
  const partsA = a.split('.').map(Number)
  const partsB = b.split('.').map(Number)
  const maxLen = Math.max(partsA.length, partsB.length)
  for (let i = 0; i < maxLen; i++) {
    const valA = partsA[i] || 0
    const valB = partsB[i] || 0
    if (valA !== valB) return valA - valB
  }
  return 0
}

// Compute task dates like the scheduler does
function computeTaskDates(tasks, projectStartDate) {
  if (!projectStartDate) return tasks
  const start = new Date(projectStartDate)
  const taskMap = new Map(tasks.map(t => [t.wbs_no, t]))

  // Helper to get computed start/end dates
  const computed = new Map()

  function getDates(wbsNo) {
    if (computed.has(wbsNo)) return computed.get(wbsNo)
    const t = taskMap.get(wbsNo)
    if (!t) return null

    let startDate = new Date(start)
    if (t.predecessors) {
      const preds = t.predecessors.split(',').map(s => s.trim())
      let maxEnd = new Date(start)
      for (const p of preds) {
        const pDates = getDates(p)
        if (pDates && pDates.end > maxEnd) {
          maxEnd = new Date(pDates.end)
        }
      }
      startDate = new Date(maxEnd)
    } else if (t.start_date) {
      startDate = new Date(t.start_date)
    }

    const duration = Number(t.duration) || 0
    const endDate = new Date(startDate)
    endDate.setDate(startDate.getDate() + duration)

    const res = {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0],
      duration
    }
    computed.set(wbsNo, res)
    return res
  }

  return tasks.map(t => {
    const dates = getDates(t.wbs_no)
    return {
      ...t,
      computedStartDate: dates ? dates.start : projectStartDate,
      computedEndDate: dates ? dates.end : projectStartDate,
      duration: dates ? dates.duration : (Number(t.duration) || 0)
    }
  })
}

async function check() {
  const { data: projects } = await supabase.from('projects').select('*').ilike('name', '%ซ่อมแซมถนน%')
  if (!projects || projects.length === 0) return
  const project = projects[0]

  const { data: tasks } = await supabase.from('tasks').select('*').eq('project_id', project.id)
  const sorted = tasks.sort((a, b) => sortWBS(a.wbs_no, b.wbs_no))
  const scheduled = computeTaskDates(sorted, project.start_date)

  console.log('Project:', project.name)
  console.log('WBS Tasks with schedules:')
  
  const today = new Date('2026-07-03') // simulate current local time in script
  today.setHours(0,0,0,0)

  console.table(scheduled.map(t => {
    const tStart = new Date(t.computedStartDate)
    const tEnd = new Date(t.computedEndDate)
    let pp = 0
    if (today >= tEnd) pp = 100
    else if (today >= tStart) {
      pp = ((today.getTime() - tStart.getTime()) / Math.max(1, tEnd.getTime() - tStart.getTime())) * 100
    }
    const isDelayed = (pp - (t.actual_progress || 0) >= 5) && t.actual_progress < 100
    
    return {
      wbs_no: t.wbs_no,
      name: t.name,
      computedStartDate: t.computedStartDate,
      computedEndDate: t.computedEndDate,
      actual_progress: t.actual_progress,
      planned_progress: pp.toFixed(1),
      isDelayed: isDelayed
    }
  }))
}

check()
