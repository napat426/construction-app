import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { computeTaskDates } from '@/lib/scheduler'
import { GoogleGenerativeAI } from '@google/generative-ai'

function getProjectProgress(project: any, allTasks: any[]) {
  const pTasks = allTasks.filter(t => t.project_id === project.id)
  if (pTasks.length === 0) return { pv: 0, ev: 0 }

  const scheduledTasks = computeTaskDates(pTasks, project.start_date)
  const totalWbsCost = scheduledTasks.reduce((sum, t) => sum + (Number(t.cost) || 0), 0)
  
  const today = new Date()
  const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  let totalWeightedPlanned = 0
  let totalWeightedActual = 0

  if (totalWbsCost > 0) {
    for (const t of scheduledTasks) {
      const tStart = new Date(t.computedStartDate)
      const tEnd = new Date(t.computedEndDate)
      const weight = (Number(t.cost) || 0) / totalWbsCost

      let plannedProgress = 0
      if (todayDateOnly >= tEnd) plannedProgress = 100
      else if (todayDateOnly > tStart) {
        plannedProgress = ((todayDateOnly.getTime() - tStart.getTime()) / Math.max(1, tEnd.getTime() - tStart.getTime())) * 100
      }

      totalWeightedPlanned += weight * plannedProgress
      totalWeightedActual += weight * (t.actual_progress || 0)
    }
  } else {
    for (const t of scheduledTasks) {
      const tStart = new Date(t.computedStartDate)
      const tEnd = new Date(t.computedEndDate)
      
      let plannedProgress = 0
      if (todayDateOnly >= tEnd) plannedProgress = 100
      else if (todayDateOnly > tStart) {
        plannedProgress = ((todayDateOnly.getTime() - tStart.getTime()) / Math.max(1, tEnd.getTime() - tStart.getTime())) * 100
      }
      totalWeightedPlanned += plannedProgress
      totalWeightedActual += (t.actual_progress || 0)
    }
    totalWeightedPlanned /= scheduledTasks.length
    totalWeightedActual /= scheduledTasks.length
  }

  return { pv: totalWeightedPlanned, ev: totalWeightedActual }
}

export async function POST(req: Request) {
  try {
    const { actionType, projectIds, question, userId, forceRefresh } = await req.json()

    if (!projectIds || projectIds.length === 0) {
      return NextResponse.json({ error: 'No projects selected' }, { status: 400 })
    }

    // Check cache first
    const cacheKey = question || actionType
    if (!forceRefresh) {
      const { data: cached } = await supabase
        .from('ai_conversations')
        .select('*')
        .eq('question', cacheKey)
        .order('created_at', { ascending: false })
        .limit(20)

      if (cached && cached.length > 0) {
        const validCache = cached.find(c => {
          // Verify exact project match and age < 1 hour
          try {
            const pIdsMatch = JSON.stringify([...c.project_ids].sort()) === JSON.stringify([...projectIds].sort())
            const isRecent = (new Date().getTime() - new Date(c.created_at).getTime()) < 3600000
            return pIdsMatch && isRecent
          } catch(e) { return false }
        })

        if (validCache) {
          return NextResponse.json({ 
            answer: validCache.answer, 
            sources: validCache.sources, 
            cachedAt: validCache.created_at 
          })
        }
      }
    }

    // Fetch live data
    const { data: projectsData } = await supabase.from('projects').select('*').in('id', projectIds)
    const projects = projectsData || []

    const { data: tasksData } = await supabase.from('tasks').select('*').in('project_id', projectIds)
    const { data: materialsData } = await supabase.from('materials').select('*').in('project_id', projectIds)
    const { data: milestonesData } = await supabase.from('project_milestones').select('*').in('project_id', projectIds)

    const tasks = tasksData || []
    const materials = materialsData || []
    const milestones = milestonesData || []

    const today = new Date()
    let rawContext = ''
    let sources: any[] = []

    // 1. Prepare factual context based on action
    if (actionType === 'summary' || actionType === 'report' || !actionType) {
      const summaries = projects.map(p => {
        const pTasks = tasks.filter(t => t.project_id === p.id)
        const pMaterials = materials.filter(m => m.project_id === p.id)
        const pendingMat = pMaterials.filter(m => m.status === 'pending').length
        
        const { pv, ev } = getProjectProgress(p, tasks)
        const sv = ev - pv
        const svText = sv < 0 ? `ล่าช้ากว่าแผน ${Math.abs(sv).toFixed(1)}%` : sv > 0 ? `เร็วกว่าแผน ${sv.toFixed(1)}%` : 'ตรงตามแผน'
        
        return `โครงการ: ${p.name} | สถานะ: ${p.status} | ความก้าวหน้าจริง: ${ev.toFixed(1)}% | แผน: ${pv.toFixed(1)}% | SV: ${svText} | จำนวนงานทั้งหมด: ${pTasks.length} งาน | วัสดุที่รออนุมัติ: ${pendingMat} รายการ`
      })
      rawContext = `สรุปสถานะ:\n${summaries.join('\n')}`
      
      let totalEv = 0, totalPv = 0
      projects.forEach(p => {
        const { pv, ev } = getProjectProgress(p, tasks)
        totalEv += ev
        totalPv += pv
      })
      const overallSv = projects.length > 0 ? (totalEv / projects.length) - (totalPv / projects.length) : 0
      const pendingCount = materials.filter(m => m.status === 'pending').length
      sources = [
        { type: 'dashboard', text: `📊 จากแผนงาน: SV = ${overallSv.toFixed(1)}%`, link: `/portfolio` },
        { type: 'materials', text: `📦 จากวัสดุ: ค้าง ${pendingCount} รายการ`, link: `/projects/${projectIds[0]}/materials` }
      ]
    } 
    else if (actionType === 'risk') {
      let delayedSum = 0
      const risks = projects.map(p => {
        const pTasks = tasks.filter(t => t.project_id === p.id)
        const scheduledTasks = computeTaskDates(pTasks, p.start_date)
        const delayedTasks = scheduledTasks.filter(t => (t.actual_progress || 0) < 100 && new Date(t.computedStartDate) <= today)
        delayedSum += delayedTasks.length
        
        const oldPendingMat = materials.filter(m => m.project_id === p.id && m.status === 'pending' && m.submitted_date && (today.getTime() - new Date(m.submitted_date).getTime()) > 7 * 24 * 60 * 60 * 1000).length
        return `โครงการ: ${p.name} | งานที่ล่าช้าหรือเกินกำหนดเริ่ม: ${delayedTasks.length} งาน | วัสดุค้างอนุมัติเกิน 7 วัน: ${oldPendingMat} รายการ`
      })
      rawContext = `วิเคราะห์ความเสี่ยง:\n${risks.join('\n')}`
      sources = [{ type: 'planning', text: `⚠️ งานล่าช้ารวม ${delayedSum} งาน`, link: `/projects/${projectIds[0]}/planning` }]
    } 
    else if (actionType === 'compare') {
      const comps = projects.map(p => {
        const { pv, ev } = getProjectProgress(p, tasks)
        const sv = ev - pv
        return `โครงการ: ${p.name} | สถานะ: ${p.status} | จริง: ${ev.toFixed(1)}% | แผน: ${pv.toFixed(1)}% | SV: ${sv.toFixed(1)}%`
      })
      rawContext = `เปรียบเทียบโครงการ:\n${comps.join('\n')}`
      sources = [{ type: 'portfolio', text: `🔀 เปรียบเทียบ ${projects.length} โครงการ`, link: `/portfolio` }]
    } 
    else if (actionType === 'tasks') {
      const upcomingTasksList: string[] = []
      let totalUpcomingCount = 0
      
      projects.forEach(p => {
        const pTasks = tasks.filter(t => t.project_id === p.id)
        const scheduledTasks = computeTaskDates(pTasks, p.start_date)
        const upcomingTasks = scheduledTasks.filter(t => {
          const diff = new Date(t.computedStartDate).getTime() - today.getTime()
          return diff >= -86400000 && diff <= 7 * 24 * 60 * 60 * 1000 && (t.actual_progress || 0) < 100
        })
        
        totalUpcomingCount += upcomingTasks.length
        upcomingTasks.forEach(t => {
          upcomingTasksList.push(`โครงการ: ${p.name} | ชื่องาน: ${t.name} | กำหนดเริ่ม: ${new Date(t.computedStartDate).toLocaleDateString('th-TH')}`)
        })
      })
      
      rawContext = upcomingTasksList.length > 0 ? `สิ่งที่ต้องทำสัปดาห์นี้:\n${upcomingTasksList.join('\n')}` : `สิ่งที่ต้องทำสัปดาห์นี้: ไม่มีงานที่ต้องเริ่มใน 7 วันนี้`
      sources = [{ type: 'planning', text: `📅 งานสัปดาห์นี้: ${totalUpcomingCount} งาน`, link: `/projects/${projectIds[0]}/planning` }]
    }

    // 2. Call Gemini API
    let answer = ''
    try {
      const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '')
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
      
      const prompt = `คุณคือ AI ผู้ช่วยผู้จัดการโครงการก่อสร้าง หน้าที่ของคุณคือการเรียบเรียงข้อมูลตัวเลขและสถานะโครงการที่ได้รับ ให้เป็นภาษาธรรมชาติที่อ่านง่าย เป็นมืออาชีพ และกระชับ

คำสั่งสำคัญ (Strict Rules):
1. ให้ใช้เฉพาะข้อมูลและตัวเลขที่ให้มาใน "ข้อมูลดิบ" เท่านั้น ห้ามคำนวณใหม่ ห้ามเดา ห้ามสร้างตัวเลขใหม่เองเด็ดขาด
2. หากไม่มีข้อมูล ให้แจ้งชัดเจนว่า "ไม่มีข้อมูลในระบบ"
3. จัดรูปแบบคำตอบให้มี 📌 ภาพรวม / ⚠️ จุดที่ต้องระวัง / ✅ ข้อเสนอแนะ

ข้อมูลดิบ (Facts):
${rawContext}

คำถามจากผู้ใช้:
${question || actionType}

กรุณาเขียนสรุปตอบกลับ:`

      const result = await model.generateContent(prompt)
      answer = result.response.text()
    } catch (aiError: any) {
      console.error('Gemini API Error:', aiError)
      // Graceful Fallback
      answer = `⚠️ **AI ไม่พร้อมใช้งานชั่วคราว (โควตาหรือเชื่อมต่อ)**\n(Error: ${aiError.message})\nนี่คือข้อมูลสรุปเบื้องต้นที่ระบบคำนวณได้:\n\n${rawContext.split('\n').map(l => `- ${l}`).join('\n')}`
    }

    // 3. Save to History (Cache)
    const now = new Date().toISOString()
    if (userId) {
      await supabase.from('ai_conversations').insert({
        user_id: userId,
        project_ids: projectIds,
        question: cacheKey,
        answer,
        sources,
        created_at: now
      })
    }

    return NextResponse.json({ answer, sources, cachedAt: now })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
