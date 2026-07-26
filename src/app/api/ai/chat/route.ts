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

    // Fetch live data (including new types: amendments & punch items)
    const { data: allProjectsData } = await supabase.from('projects').select('id, name, supervisor, status, budget')
    const { data: projectsData } = await supabase.from('projects').select('*').in('id', projectIds)
    
    const allProjects = allProjectsData || []
    const projects = projectsData || []

    const { data: tasksData } = await supabase.from('tasks').select('*').in('project_id', projectIds)
    const { data: materialsData } = await supabase.from('materials').select('*').in('project_id', projectIds)
    const { data: milestonesData } = await supabase.from('project_milestones').select('*').in('project_id', projectIds)
    const { data: amendmentsData } = await supabase.from('contract_amendments').select('*').in('project_id', projectIds).order('amendment_no', { ascending: true })
    const { data: punchItemsData } = await supabase.from('punch_items').select('*, punch_lists!inner(project_id)').in('punch_lists.project_id', projectIds)

    const tasks = tasksData || []
    const materials = materialsData || []
    const milestones = milestonesData || []
    const amendments = amendmentsData || []
    const punchItems = (punchItemsData as any[]) || []

    // Fetch extra textual data with expanded limits for rich calculations
    const { data: inspectionsData } = await supabase.from('inspections').select('project_id, inspection_no, work_type, status, request_date, note').in('project_id', projectIds).order('created_at', { ascending: false }).limit(50)
    const { data: poursData } = await supabase.from('concrete_pours').select('project_id, pour_no, pour_date, structure_element, concrete_grade, volume, supplier').in('project_id', projectIds).order('created_at', { ascending: false }).limit(50)
    const { data: dailyReportsData } = await supabase.from('daily_reports').select('project_id, report_date, weather, manpower, machinery, work_done, issues').in('project_id', projectIds).order('report_date', { ascending: false }).limit(30)
    
    const inspections = inspectionsData || []
    const pours = poursData || []
    const dailyReports = dailyReportsData || []

    // 1. Calculate and compile Rich Aggregated Context per project
    let richAnalyticsContext = ''
    projects.forEach(p => {
      const pTasks = tasks.filter(t => t.project_id === p.id)
      const pMaterials = materials.filter(m => m.project_id === p.id)
      const pMilestones = milestones.filter(m => m.project_id === p.id)
      const pAmendments = amendments.filter(a => a.project_id === p.id)
      const pPunchItems = punchItems.filter(item => item.punch_lists?.project_id === p.id)
      const pInspections = inspections.filter(i => i.project_id === p.id)
      const pPours = pours.filter(pour => pour.project_id === p.id)
      const pDailyReports = dailyReports.filter(d => d.project_id === p.id)

      // A. Financials & Payment Progress (Milestones)
      const totalBudget = p.budget || 0
      const totalMilestoneValue = pMilestones.reduce((sum, m) => sum + (Number(m.amount) || 0), 0)
      const totalPaidAmount = pMilestones.filter(m => m.is_paid).reduce((sum, m) => sum + (Number(m.amount) || 0), 0)
      const totalUnpaidAmount = totalMilestoneValue - totalPaidAmount
      const paymentProgressPct = totalMilestoneValue > 0 ? (totalPaidAmount / totalMilestoneValue) * 100 : 0
      const paidMilestonesCount = pMilestones.filter(m => m.is_paid).length

      // B. Contract Amendments & Extensions
      const amendmentCount = pAmendments.length
      const totalExtraDays = pAmendments.reduce((sum, a) => sum + (Number(a.extra_days) || 0), 0)
      const amendmentDetails = pAmendments.map(a => `- ครั้งที่ ${a.amendment_no}: เพิ่ม ${a.extra_days} วัน (${a.reason})`).join('\n  ')

      // C. Quality Control / Defect Logs (Punch List)
      const totalPunch = pPunchItems.length
      const punchOpen = pPunchItems.filter(item => item.status === 'open' || item.status === 'in_progress').length
      const punchClosed = pPunchItems.filter(item => item.status === 'done').length
      const punchCategories = pPunchItems.reduce((acc: any, item) => {
        const cat = item.category || 'อื่นๆ'
        acc[cat] = (acc[cat] || 0) + 1
        return acc
      }, {})
      const punchCatText = Object.entries(punchCategories).map(([cat, count]) => `${cat}: ${count} รายการ`).join(', ')

      // D. Quality Inspections Pass Rate (Last 50)
      const totalInsp = pInspections.length
      const approvedInsp = pInspections.filter(i => i.status === 'approved').length
      const rejectedInsp = pInspections.filter(i => i.status === 'rejected').length
      const pendingInsp = pInspections.filter(i => i.status === 'pending' || i.status === 'submitted').length
      const completedInsp = approvedInsp + rejectedInsp
      const passRatePct = completedInsp > 0 ? (approvedInsp / completedInsp) * 100 : 0

      // E. Concrete Pour volume & suppliers
      const totalPoursCount = pPours.length
      const totalVolumePoured = pPours.reduce((sum, pour) => sum + (Number(pour.volume) || 0), 0)
      const suppliers = Array.from(new Set(pPours.map(pour => pour.supplier).filter(Boolean)))

      // F. Daily Reports Aggregated Statistics (Last 30 Days)
      const reportedDays = pDailyReports.length
      const weatherCounts = pDailyReports.reduce((acc: any, d) => {
        const w = d.weather || 'ไม่ระบุ'
        acc[w] = (acc[w] || 0) + 1
        return acc
      }, {})
      const weatherText = Object.entries(weatherCounts).map(([w, count]) => `${w} ${count} วัน`).join(', ')

      // Average manpower per day
      let totalWorkers = 0
      let totalWorkerDays = 0
      pDailyReports.forEach(d => {
        if (Array.isArray(d.manpower)) {
          const dayWorkers = d.manpower.reduce((sum, m) => sum + (Number(m.quantity) || 0), 0)
          if (dayWorkers > 0) {
            totalWorkers += dayWorkers
            totalWorkerDays++
          }
        }
      })
      const avgWorkersPerDay = totalWorkerDays > 0 ? (totalWorkers / totalWorkerDays).toFixed(1) : '0'
      const recentIssues = Array.from(new Set(pDailyReports.map(d => d.issues).filter(Boolean))).slice(0, 5)

      richAnalyticsContext += `
--- ข้อมูลสัญญาและการเงินเชิงลึก (โครงการ: ${p.name}) ---
👤 ผู้เกี่ยวข้องและข้อมูลสัญญา:
  - ผู้ควบคุมงาน (Supervisor): ${p.supervisor || 'ไม่ได้ระบุ'}
  - กรรมการตรวจรับ (Inspection Committee): ${p.inspection_committee || 'ไม่ได้ระบุ'}
  - เลขที่สัญญา: ${p.contract_no || 'ไม่ได้ระบุ'}
  - ผู้รับจ้าง (Contractor): ${p.contractor || 'ไม่ได้ระบุ'}
  - สถานะโครงการ: ${p.status}

📅 กำหนดเวลาและอัตราค่าปรับ:
  - วันเริ่มต้นสัญญา: ${p.start_date ? new Date(p.start_date).toLocaleDateString('th-TH') : 'ไม่ได้ระบุ'}
  - วันสิ้นสุดสัญญา: ${p.end_date ? new Date(p.end_date).toLocaleDateString('th-TH') : 'ไม่ได้ระบุ'}
  - อัตราค่าปรับรายวัน (Penalty Rate): ${(p.penalty_rate || 0).toLocaleString('th-TH')} บาท/วัน

💰 สรุปด้านงบประมาณและสถิติตัวเลข:
  - งบประมาณรวมทั้งหมด: ${totalBudget.toLocaleString('th-TH')} บาท
  - ยอดจ่ายจริงแล้วตามระบบ (Paid Amount): ${(p.paid_amount || 0).toLocaleString('th-TH')} บาท
  - ยอดอนุมัติเบิกจ่ายงวดงานสะสม: ${totalPaidAmount.toLocaleString('th-TH')} บาท (${paymentProgressPct.toFixed(1)}% ของมูลค่างวดชำระสะสม)
  - ยอดคงเหลือค้างชำระ/ยังไม่ได้จ่าย: ${totalUnpaidAmount.toLocaleString('th-TH')} บาท
  - งวดงานทั้งหมด: ${pMilestones.length} งวด (ชำระแล้ว ${paidMilestonesCount} งวด, รอจ่าย ${pMilestones.length - paidMilestonesCount} งวด)

💵 รายละเอียดงวดงานการเบิกจ่ายชำระเงิน:
  ${pMilestones.length > 0 ? pMilestones.map(m => `* งวดที่ ${m.milestone_no}: ${m.name} | ยอดเงิน: ${(m.amount || 0).toLocaleString('th-TH')} บาท | สถานะ: ${m.is_paid ? `จ่ายแล้วเมื่อ ${m.payment_date ? new Date(m.payment_date).toLocaleDateString('th-TH') : '-'}` : `ยังไม่จ่าย (คาดว่าจ่าย: ${m.expected_payment_date ? new Date(m.expected_payment_date).toLocaleDateString('th-TH') : '-'})`}`).join('\n  ') : '* ไม่มีข้อมูลกำหนดงวดงาน'}

⏳ การปรับแก้สัญญาขยายเวลา:
  - ปรับแก้สัญญา: ${amendmentCount} ครั้ง | รวมขยายเวลาสัญญาเพิ่ม: ${totalExtraDays} วัน
  ${amendmentCount > 0 ? `รายละเอียดงานขยายเวลาสัญญาเพิ่มเติม:\n  ${amendmentDetails}` : ''}

🔧 งานแก้ไขบกพร่องค้างคา (Punch List):
  - แจ้งแก้สะสม: ${totalPunch} รายการ (กำลังแก้: ${punchOpen} รายการ | แก้เสร็จสิ้น: ${punchClosed} รายการ)
  - สรุปประเภทงานบกพร่อง: ${punchCatText || 'ไม่มีรายการแก้ไขค้างอยู่'}

📋 อัตราส่วนผ่านการตรวจสอบคุณภาพ (Inspection Pass Rate):
  - ส่งตรวจสอบสะสม (สูงสุด 50 รายการล่าสุด): ${totalInsp} รายการ
  - อนุมัติผ่าน: ${approvedInsp} ครั้ง | ไม่อนุมัติ: ${rejectedInsp} ครั้ง | รอตรวจ: ${pendingInsp} ครั้ง
  - เปอร์เซ็นต์ตรวจผ่าน (Pass Rate): ${passRatePct.toFixed(1)}%

🏗️ งานเทปูนโครงสร้างสะสม (สูงสุด 50 รายการล่าสุด):
  - เทคอนกรีต: ${totalPoursCount} ครั้ง | ปริมาตรรวม: ${totalVolumePoured.toLocaleString('th-TH')} คิว (ลบ.ม.)
  - แหล่งจัดส่งปูน (Suppliers): ${suppliers.join(', ') || 'ไม่มีรายละเอียด'}

📅 ข้อมูลบันทึกสภาพแวดล้อมและแรงงาน (ช่วง 30 วันที่ผ่านมา):
  - บันทึกรายงานรวม: ${reportedDays} วัน
  - สภาพอากาศที่พบ: ${weatherText || 'ไม่มีรายละเอียด'}
  - แรงงานเข้าทำงานเฉลี่ยต่อวัน: ${avgWorkersPerDay} คน
  - ปัญหาและอุปสรรคสำคัญที่รายงาน:
    ${recentIssues.length > 0 ? recentIssues.map(issue => `* ${issue}`).join('\n    ') : '* ไม่มีรายงานอุปสรรค'}
`
    })

    // 2. Build detail snippets for recent items (sliced for context readability)
    let extraContext = ''
    if (inspections && inspections.length > 0) {
      extraContext += `\nรายการตรวจสอบล่าสุด:\n` + inspections.slice(0, 8).map((i: any) => `- เลขที่: ${i.inspection_no}, งาน: ${i.work_type}, สถานะ: ${i.status}, หมายเหตุ: ${i.note || '-'}`).join('\n')
    }
    if (pours && pours.length > 0) {
      extraContext += `\n\nรายการเทคอนกรีตล่าสุด:\n` + pours.slice(0, 8).map((p: any) => `- วันที่: ${new Date(p.pour_date).toLocaleDateString('th-TH')}, ส่วนโครงสร้าง: ${p.structure_element}, เกรด: ${p.concrete_grade}, ปริมาตร: ${p.volume} คิว`).join('\n')
    }
    if (dailyReports && dailyReports.length > 0) {
      extraContext += `\n\nรายงานประจำวันล่าสุด:\n` + dailyReports.slice(0, 5).map((d: any) => {
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

    // Build global system-wide project catalog for cross-project queries (e.g., supervisor comparisons)
    const globalProjectSummary = allProjects.map(p => 
      `- โครงการ: ${p.name} | ผู้ควบคุมงาน: ${p.supervisor || 'ไม่ได้ระบุ'} | สถานะ: ${p.status} | งบประมาณ: ${(p.budget || 0).toLocaleString('th-TH')} บาท`
    ).join('\n')

    if (globalProjectSummary) {
      rawContext += `\n\n--- บัญชีรายชื่อและงบประมาณของโครงการทั้งหมดในระบบ (สำหรับเปรียบเทียบผู้ควบคุมงาน) ---\n${globalProjectSummary}`
    }

    // Append rich analytics context for ALL queries (Option 1 & 3)
    if (richAnalyticsContext) {
      rawContext += `\n\n${richAnalyticsContext}`
    }

    // Append extra context for ALL questions
    if (extraContext) {
      rawContext += `\n\n--- ข้อมูลดิบและประวัติบันทึกโครงการล่าสุด ---\n${extraContext}`
    }

    // --- NEW: RAG Document Search from PDF Contracts & Chunks ---
    try {
      const searchTerms = question || actionType || ''
      if (searchTerms) {
        // Embed the query
        const embedModel = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '').getGenerativeModel({ model: 'gemini-embedding-001' })
        const embedResult = await embedModel.embedContent(searchTerms)
        const queryEmbedding = embedResult.embedding.values.slice(0, 768)

        // Query document_chunks for project matching
        const { data: matchedChunks } = await supabase.rpc('match_document_chunks', {
          query_embedding: `[${queryEmbedding.join(',')}]`,
          match_threshold: 0.2,
          match_count: 8,
          p_project_id: projectIds.length === 1 ? projectIds[0] : null
        })

        if (matchedChunks && matchedChunks.length > 0) {
          const docSnippetText = matchedChunks.map((c: any) => `[เอกสารสัญญา หน้าที่ ${c.page_number}]:\n${c.content}`).join('\n\n')
          rawContext += `\n\n--- เนื้อหาข้อความจากเอกสารสัญญา PDF ที่เกี่ยวข้องกับคำถาม ---\n${docSnippetText}`
        } else {
          // Fallback text query directly if vector match returns empty
          const { data: directChunks } = await supabase
            .from('document_chunks')
            .select('page_number, content')
            .in('project_id', projectIds)
            .limit(10)

          if (directChunks && directChunks.length > 0) {
            const docSnippetText = directChunks.map((c: any) => `[เอกสารสัญญา หน้าที่ ${c.page_number}]:\n${c.content}`).join('\n\n')
            rawContext += `\n\n--- เนื้อหาข้อความในสัญญาโครงการ (ตัวอย่าง 10 หน้าแรก) ---\n${docSnippetText}`
          }
        }
      }
    } catch (ragErr) {
      console.error('RAG Search fallback:', ragErr)
      // Fallback: load first 10 chunks directly if embedding fails
      const { data: fallbackChunks } = await supabase
        .from('document_chunks')
        .select('page_number, content')
        .in('project_id', projectIds)
        .limit(10)

      if (fallbackChunks && fallbackChunks.length > 0) {
        const docSnippetText = fallbackChunks.map((c: any) => `[เอกสารสัญญา หน้าที่ ${c.page_number}]:\n${c.content}`).join('\n\n')
        rawContext += `\n\n--- เนื้อหาข้อความในสัญญาโครงการ ---\n${docSnippetText}`
      }
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
