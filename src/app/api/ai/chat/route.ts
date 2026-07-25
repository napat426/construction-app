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
    const { actionType, projectIds, question, userId, forceRefresh, conversationHistory, selectedModel } = await req.json()

    if (!projectIds || projectIds.length === 0) {
      return NextResponse.json({ error: 'No projects selected' }, { status: 400 })
    }

    // Determine model to use
    const modelName = selectedModel || 'gemini-2.5-flash'
    const hasHistory = conversationHistory && conversationHistory.length > 0

    // Check cache first (skip for multi-turn conversations)
    const cacheKey = question || actionType
    if (!forceRefresh && !hasHistory) {
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

    // Fetch extra textual data for better context
    const { data: inspections } = await supabase.from('inspections').select('inspection_no, work_type, status, request_date, note').in('project_id', projectIds).order('created_at', { ascending: false }).limit(10)
    const { data: pours } = await supabase.from('concrete_pours').select('pour_no, pour_date, structure_element, concrete_grade, volume, supplier').in('project_id', projectIds).order('created_at', { ascending: false }).limit(10)
    const { data: dailyReports } = await supabase.from('daily_reports').select('report_date, weather, manpower, machinery, work_done, issues').in('project_id', projectIds).order('report_date', { ascending: false }).limit(10)
    
    let extraContext = ''
    if (inspections && inspections.length > 0) {
      extraContext += `\nรายการตรวจสอบล่าสุด:\n` + inspections.map((i: any) => `- เลขที่: ${i.inspection_no}, งาน: ${i.work_type}, สถานะ: ${i.status}, หมายเหตุ: ${i.note || '-'}`).join('\n')
    }
    if (pours && pours.length > 0) {
      extraContext += `\n\nรายการเทคอนกรีตล่าสุด:\n` + pours.map((p: any) => `- วันที่: ${new Date(p.pour_date).toLocaleDateString('th-TH')}, ส่วนโครงสร้าง: ${p.structure_element}, เกรด: ${p.concrete_grade}, ปริมาตร: ${p.volume} คิว`).join('\n')
    }
    if (dailyReports && dailyReports.length > 0) {
      extraContext += `\n\nรายงานประจำวันล่าสุด:\n` + dailyReports.map((d: any) => {
        const manStr = Array.isArray(d.manpower) ? d.manpower.map((m: any) => `${m.name}=${m.quantity}`).join(', ') : '-'
        return `- วันที่: ${new Date(d.report_date).toLocaleDateString('th-TH')}, สภาพอากาศ: ${d.weather}, แรงงาน: [${manStr}], งานที่ทำ: ${d.work_done || '-'}`
      }).join('\n')
    }

    const today = new Date()
    let rawContext = ''
    let sources: any[] = []

    // Build full enriched summaries used for all actions
    const fullSummaries = projects.map(p => {
      const pTasks = tasks.filter(t => t.project_id === p.id)
      const pMaterials = materials.filter(m => m.project_id === p.id)
      const pendingMat = pMaterials.filter(m => m.status === 'pending').length
      const { pv, ev } = getProjectProgress(p, tasks)
      const sv = ev - pv
      const svText = sv < 0 ? `ล่าช้ากว่าแผน ${Math.abs(sv).toFixed(1)}%` : sv > 0 ? `เร็วกว่าแผน ${sv.toFixed(1)}%` : 'ตรงตามแผน'
      const scheduledTasks = computeTaskDates(pTasks, p.start_date)
      const delayedTasks = scheduledTasks.filter(t => (t.actual_progress || 0) < 100 && new Date(t.computedStartDate) <= today)
      const oldPendingMat = pMaterials.filter(m => m.status === 'pending' && m.submitted_date && (today.getTime() - new Date(m.submitted_date).getTime()) > 7 * 24 * 60 * 60 * 1000).length
      const upcomingTasks = scheduledTasks.filter(t => {
        const diff = new Date(t.computedStartDate).getTime() - today.getTime()
        return diff >= -86400000 && diff <= 7 * 24 * 60 * 60 * 1000 && (t.actual_progress || 0) < 100
      })
      return `โครงการ: ${p.name} | สถานะ: ${p.status} | ความก้าวหน้าจริง: ${ev.toFixed(1)}% | แผน: ${pv.toFixed(1)}% | SV: ${svText} | จำนวนงานทั้งหมด: ${pTasks.length} งาน | งานที่ล่าช้า: ${delayedTasks.length} งาน | งานสัปดาห์นี้: ${upcomingTasks.map(t => t.name).join(', ') || 'ไม่มี'} | วัสดุรออนุมัติ: ${pendingMat} รายการ | วัสดุค้างเกิน 7 วัน: ${oldPendingMat} รายการ`
    })

    // 1. Prepare factual context based on action
    if (actionType === 'summary' || actionType === 'report') {
      rawContext = `สรุปสถานะโครงการ:\n${fullSummaries.join('\n')}`
      
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
    else {
      // chat mode — FULL rich context (fix: was previously basic summary only)
      rawContext = `ข้อมูลครบถ้วนของโครงการที่เลือก:\n${fullSummaries.join('\n')}`
    }

    // Append extra context for ALL questions
    if (extraContext) {
      rawContext += `\n\n--- ข้อมูลบันทึกโครงการล่าสุด (ใช้อ้างอิงหากผู้ใช้ถาม) ---\n${extraContext}`
    }

    // 2. Call Gemini API
    let answer = ''
    
    // DEBUG MODE
    if (question === 'DEBUG_MODELS') {
      try {
        const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || ''
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
        const data = await res.json()
        const modelNames = data.models ? data.models.map((m: any) => m.name).join(', ') : JSON.stringify(data)
        return NextResponse.json({ answer: `AVAILABLE MODELS: ${modelNames}` })
      } catch (e: any) {
        return NextResponse.json({ answer: `DEBUG ERROR: ${e.message}` })
      }
    }

    try {
      const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '')
      const model = genAI.getGenerativeModel({ model: modelName })
      
      const systemInstruction = `คุณคือ AI ผู้ช่วยผู้จัดการโครงการก่อสร้าง หน้าที่ของคุณคือการเรียบเรียงข้อมูลตัวเลขและสถานะโครงการที่ได้รับ ให้เป็นภาษาธรรมชาติที่อ่านง่าย เป็นมืออาชีพ และกระชับ

คำสั่งสำคัญ (Strict Rules):
1. ให้ใช้เฉพาะข้อมูลและตัวเลขที่ให้มาใน "ข้อมูลดิบ" เท่านั้น ห้ามคำนวณใหม่ ห้ามเดา ห้ามสร้างตัวเลขใหม่เองเด็ดขาด
2. หากไม่มีข้อมูล ให้แจ้งชัดเจนว่า "ไม่มีข้อมูลในระบบ"
3. จัดรูปแบบคำตอบให้มี 📌 ภาพรวม / ⚠️ จุดที่ต้องระวัง / ✅ ข้อเสนอแนะ เมื่อเหมาะสม
4. จำบริบทการสนทนาก่อนหน้าและตอบต่อเนื่องได้อย่างเป็นธรรมชาติ

ข้อมูลดิบ (Facts) ณ วันนี้:
${rawContext}`

      // Build multi-turn conversation contents for memory
      const contents: any[] = []
      if (hasHistory) {
        for (const msg of conversationHistory) {
          if (msg.role === 'user' && msg.content) {
            contents.push({ role: 'user', parts: [{ text: msg.content }] })
          } else if (msg.role === 'assistant' && msg.content && !msg.isTyping) {
            contents.push({ role: 'model', parts: [{ text: msg.content }] })
          }
        }
      }
      contents.push({ role: 'user', parts: [{ text: question || actionType || 'สรุปข้อมูล' }] })

      const result = await model.generateContent({ systemInstruction, contents })
      answer = result.response.text()
    } catch (aiError: any) {
      console.error('Gemini API Error:', aiError)
      // Graceful Fallback
      answer = `⚠️ **AI ไม่พร้อมใช้งานชั่วคราว (โควตาหรือเชื่อมต่อ)**\n(Error: ${aiError.message})\nนี่คือข้อมูลสรุปเบื้องต้นที่ระบบคำนวณได้:\n\n${rawContext.split('\n').map(l => `- ${l}`).join('\n')}`
    }

    // 3. Save to History (Cache) — skip for multi-turn conversation mode
    const now = new Date().toISOString()
    if (userId && !hasHistory && !answer.includes('⚠️ **AI ไม่พร้อมใช้งานชั่วคราว')) {
      await supabase.from('ai_conversations').insert({
        user_id: userId,
        project_ids: projectIds,
        question: cacheKey,
        answer,
        sources,
        created_at: now
      })
    }

    return NextResponse.json({ answer, sources, cachedAt: hasHistory ? undefined : now })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
