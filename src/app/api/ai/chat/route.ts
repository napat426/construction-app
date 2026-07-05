import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { computeTaskDates } from '@/lib/scheduler'

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
    const { actionType, projectIds, question, userId } = await req.json()

    if (!projectIds || projectIds.length === 0) {
      return NextResponse.json({ error: 'No projects selected' }, { status: 400 })
    }

    const { data: projectsData } = await supabase.from('projects').select('*').in('id', projectIds)
    const projects = projectsData || []

    const { data: tasksData } = await supabase.from('tasks').select('*').in('project_id', projectIds)
    const { data: materialsData } = await supabase.from('project_materials').select('*').in('project_id', projectIds)
    const { data: milestonesData } = await supabase.from('project_milestones').select('*').in('project_id', projectIds)

    const tasks = tasksData || []
    const materials = materialsData || []
    const milestones = milestonesData || []

    let answer = ''
    let sources: any[] = []
    const today = new Date()

    if (actionType === 'summary') {
      const summaries = projects.map(p => {
        const pTasks = tasks.filter(t => t.project_id === p.id)
        const pMaterials = materials.filter(m => m.project_id === p.id)
        const pendingMat = pMaterials.filter(m => m.status === 'pending').length
        
        const { pv, ev } = getProjectProgress(p, tasks)
        const sv = ev - pv
        const svText = sv < 0 ? `ล่าช้ากว่าแผน ${Math.abs(sv).toFixed(1)}%` : sv > 0 ? `เร็วกว่าแผน ${sv.toFixed(1)}%` : 'ตรงตามแผน'
        
        return `📌 **โครงการ ${p.name}**\n- **สถานะ:** ${p.status}\n- **ความก้าวหน้า:** จริง ${ev.toFixed(1)}% | แผน ${pv.toFixed(1)}% (SV: ${svText})\n- **แผนงาน:** มี ${pTasks.length} งาน\n- **วัสดุที่รออนุมัติ:** ${pendingMat} รายการ`
      })
      answer = `**📊 สรุปสถานะโครงการที่เลือก:**\n\n${summaries.join('\n\n')}`
      
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
      
    } else if (actionType === 'risk') {
      let delayedSum = 0
      const risks = projects.map(p => {
        const pTasks = tasks.filter(t => t.project_id === p.id)
        const scheduledTasks = computeTaskDates(pTasks, p.start_date)
        const delayedTasks = scheduledTasks.filter(t => (t.actual_progress || 0) < 100 && new Date(t.computedStartDate) <= today)
        delayedSum += delayedTasks.length
        
        const oldPendingMat = materials.filter(m => m.project_id === p.id && m.status === 'pending' && m.submitted_date && (today.getTime() - new Date(m.submitted_date).getTime()) > 7 * 24 * 60 * 60 * 1000).length
        return `⚠️ **โครงการ ${p.name}**\n- **งานที่อาจล่าช้า:** ${delayedTasks.length} งาน\n- **วัสดุค้างอนุมัติเกิน 7 วัน:** ${oldPendingMat} รายการ`
      })
      answer = `**⚠️ การวิเคราะห์ความเสี่ยง:**\n\n${risks.join('\n\n')}\n\n✅ **ข้อเสนอแนะ:** เร่งรัดการอนุมัติวัสดุที่ค้างนานเกิน 7 วัน และติดตามงานที่ยังไม่เสร็จตามแผน`
      sources = [{ type: 'planning', text: `⚠️ งานล่าช้ารวม ${delayedSum} งาน`, link: `/projects/${projectIds[0]}/planning` }]

    } else if (actionType === 'compare') {
      let table = `| โครงการ | สถานะ | ก้าวหน้า (จริง) | ก้าวหน้า (แผน) | SV |\n|---|---|---|---|---|\n`
      projects.forEach(p => {
        const { pv, ev } = getProjectProgress(p, tasks)
        const sv = ev - pv
        const svStr = sv < 0 ? `**<span style="color:red">${sv.toFixed(1)}%</span>**` : `<span style="color:green">+${sv.toFixed(1)}%</span>`
        table += `| **${p.name}** | ${p.status} | ${ev.toFixed(1)}% | ${pv.toFixed(1)}% | ${svStr} |\n`
      })
      answer = `**🔀 เปรียบเทียบโครงการ:**\n\n${table}`
      sources = [{ type: 'portfolio', text: `🔀 เปรียบเทียบ ${projects.length} โครงการ`, link: `/portfolio` }]

    } else if (actionType === 'tasks') {
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
          upcomingTasksList.push(`- [${p.name}] **${t.name}** (เริ่ม: ${new Date(t.computedStartDate).toLocaleDateString('th-TH')})`)
        })
      })
      
      let list = upcomingTasksList.join('\n')
      if (!list) list = '- ไม่มีงานที่ต้องเริ่มใน 7 วันนี้'
      answer = `**📅 สิ่งที่ต้องทำสัปดาห์นี้ (7 วันข้างหน้า):**\n\n${list}`
      sources = [{ type: 'planning', text: `📅 งานสัปดาห์นี้: ${totalUpcomingCount} งาน`, link: `/projects/${projectIds[0]}/planning` }]

    } else if (actionType === 'report') {
      const reports = projects.map(p => {
        const { pv, ev } = getProjectProgress(p, tasks)
        const sv = ev - pv
        const svStatus = sv < 0 ? 'มีความล่าช้ากว่าแผนงานเล็กน้อย' : 'สามารถดำเนินการได้ตามแผนงานหรือเร็วกว่าแผน'
        const pMilestones = milestones.filter(m => m.project_id === p.id && m.is_paid)
        const paidPercent = p.budget && p.budget > 0 ? (pMilestones.reduce((s, m) => s + Number(m.amount), 0) / p.budget) * 100 : 0
        return `**โครงการ ${p.name}**\nปัจจุบันโครงการอยู่ในสถานะ "${p.status}" มีความก้าวหน้าจริงที่ ${ev.toFixed(1)}% (เทียบกับแผน ${pv.toFixed(1)}%) ภาพรวมพบว่า ${svStatus} การเบิกจ่ายงบประมาณสะสมอยู่ที่ ${paidPercent.toFixed(1)}% ของงบประมาณรวม`
      })
      answer = `**📄 ร่างรายงานผู้บริหาร (Executive Summary):**\n\n${reports.join('\n\n')}\n\n✅ **ข้อเสนอแนะจากระบบ:** ควรติดตามงานที่ยังไม่แล้วเสร็จอย่างใกล้ชิดเพื่อรักษาระดับความก้าวหน้าให้อยู่ในแผนงาน`
      sources = [{ type: 'report', text: `📄 ข้อมูลเพื่อจัดทำรายงาน`, link: `/projects/${projectIds[0]}/reports` }]

    } else {
      answer = `คุณถามว่า: "${question}"\n\n(นี่คือโหมดเฟส 1: กรุณาใช้ปุ่ม Quick Actions ด้านบนเพื่อดูสรุปข้อมูลจริงจากฐานข้อมูลครับ)`
      sources = []
    }

    if (userId) {
      await supabase.from('ai_conversations').insert({
        user_id: userId,
        project_ids: projectIds,
        question: question || actionType,
        answer,
        sources
      })
    }

    return NextResponse.json({ answer, sources })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
