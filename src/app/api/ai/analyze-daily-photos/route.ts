import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: Request) {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ยังไม่ได้กำหนด GOOGLE_GENERATIVE_AI_API_KEY ในระบบ' },
      { status: 500 }
    )
  }

  try {
    const body = await req.json()
    const { projectId, reportDate, photos } = body

    // Support both string[] or { url: string }[]
    const photoUrls: string[] = Array.isArray(photos)
      ? photos
          .map((p: any) => (typeof p === 'string' ? p : p?.url))
          .filter((u: any) => typeof u === 'string' && u.startsWith('http'))
      : []

    if (photoUrls.length === 0) {
      return NextResponse.json(
        { error: 'ไม่พบรูปภาพที่อัปโหลด กรุณาอัปโหลดรูปภาพการทำงานก่อนวิเคราะห์' },
        { status: 400 }
      )
    }

    // Fetch project info & active tasks for context
    let projectName = 'โครงการก่อสร้าง'
    let taskListText = ''

    if (projectId) {
      try {
        const { data: project } = await supabase
          .from('projects')
          .select('name, description')
          .eq('id', projectId)
          .single()

        if (project?.name) {
          projectName = project.name
        }

        const { data: tasks } = await supabase
          .from('tasks')
          .select('name, is_completed, actual_progress')
          .eq('project_id', projectId)
          .limit(20)

        if (tasks && tasks.length > 0) {
          taskListText = tasks
            .map((t) => `- ${t.name} (ความคืบหน้า ${t.actual_progress || 0}%)`)
            .join('\n')
        }
      } catch (dbErr) {
        console.warn('Could not fetch project context for AI vision:', dbErr)
      }
    }

    // Fetch up to 6 photos and convert to base64
    const selectedUrls = photoUrls.slice(0, 6)
    const imageParts = await Promise.all(
      selectedUrls.map(async (url) => {
        try {
          const res = await fetch(url)
          if (!res.ok) return null
          const contentType = res.headers.get('content-type') || 'image/jpeg'
          const mimeType = contentType.split(';')[0].trim()
          const arrayBuffer = await res.arrayBuffer()
          const base64 = Buffer.from(arrayBuffer).toString('base64')
          return {
            inlineData: {
              data: base64,
              mimeType: mimeType.startsWith('image/') ? mimeType : 'image/jpeg',
            },
          }
        } catch (fetchErr) {
          console.error('Error fetching image for AI vision:', url, fetchErr)
          return null
        }
      })
    )

    const validParts = imageParts.filter(Boolean) as Array<{
      inlineData: { data: string; mimeType: string }
    }>

    if (validParts.length === 0) {
      return NextResponse.json(
        { error: 'ไม่สามารถดาวน์โหลดรูปภาพเพื่อวิเคราะห์ได้ กรุณาลองใหม่อีกครั้ง' },
        { status: 400 }
      )
    }

    // Initialize Gemini with Multi-Model Auto-Failover
    const genAI = new GoogleGenerativeAI(apiKey)
    const CANDIDATE_MODELS = [
      'gemini-3.6-flash',
      'gemini-2.5-flash',
      'gemini-1.5-flash',
      'gemini-2.0-flash',
    ]

    // System Prompt for Engineering Vision Analysis
    const prompt = `คุณคือวิศวกรผู้ควบคุมงานก่อสร้างมืออาชีพ (Site Engineer / Project Engineer)
มีหน้าที่วิเคราะห์ภาพถ่ายหน้างานก่อสร้างประจำวันของโครงการ: "${projectName}" ${reportDate ? `ณ วันที่ ${reportDate}` : ''}
และเขียนสรุป "รายละเอียดความคืบหน้างานวันนี้ (Work Done)" เพื่อใช้บันทึกในสมุดรายงานประจำวัน (Daily Report) ของงานก่อสร้าง

${taskListText ? `รายการงานตามแผนงาน/WBS ในโครงการ (เพื่อช่วยอ้างอิงกิจกรรมให้สอดคล้องกับขอบเขตงาน):\n${taskListText}\n` : ''}

ข้อกำหนดในการวิเคราะห์และจัดทำข้อความ:
1. วิเคราะห์กิจกรรมงานหลักที่กำลังปฏิบัติการตามที่เห็นในภาพอย่างละเอียด เช่น:
   - งานโครงสร้าง: ขุดดินฐานราก, เทคอนกรีตหยาบ, ผูกเหล็กเสริม, ติดตั้งแบบหล่อ, เทคอนกรีต, บ่มคอนกรีต, ติดตั้งชิ้นส่วนสำเร็จรูป
   - งานสถาปัตยกรรม: ก่ออิฐมวลเบา/มอญ, ฉาบปูน, ติดตั้งโครงฝ้าเพดาน, ปูกระเบื้อง, งานทาสีรองพื้น/จริง
   - งานระบบวิศวกรรม (MEP): เดินท่อร้อยสายไฟฟ้า, ติดตั้งท่อประปาและท่อระบายน้ำ, เดินท่อระบบปรับอากาศ
2. ระบุตำแหน่ง องค์ประกอบโครงสร้าง หรือบริเวณพื้นที่ทำงานที่สังเกตได้จากภาพ (เช่น ฐานราก, เสา, คาน, พื้นชั้น 1, ผนังภายนอก/ภายใน)
3. ใช้ภาษาไทยเชิงวิศวกรรมก่อสร้างที่ถูกต้อง สุภาพ กระชับ ชัดเจน และเป็นทางการ
4. จัดรูปแบบเป็นรายการข้อๆ โดยขึ้นต้นแต่ละกิจกรรมด้วยเครื่องหมาย "• " (Bullet point)
5. เขียนเฉพาะเนื้อหาของความคืบหน้างานเท่านั้น ห้ามใส่คำทักทาย เกริ่นนำ หรือคำลงท้ายใดๆ ทั้งสิ้น`

    let generatedText = ''
    let lastError: any = null

    for (const modelName of CANDIDATE_MODELS) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName })
        const response = await model.generateContent([prompt, ...validParts])
        const text = response.response.text()
        if (text && text.trim().length > 0) {
          generatedText = text.trim()
          break
        }
      } catch (err: any) {
        console.warn(`[AI Vision Failover] Model ${modelName} failed, trying next candidate:`, err?.message || err)
        lastError = err
      }
    }

    if (!generatedText) {
      const errMsg = lastError?.message || 'AI ไม่สามารถประมวลผลรูปภาพได้ในขณะนี้'
      return NextResponse.json(
        { error: `AI ขัดข้องชั่วขณะ (${errMsg}) กรุณาลองใหม่อีกครั้งหรือใช้ปุ่ม 'ดึงงานตามแผน (WBS)' แทน` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      workDone: generatedText,
    })
  } catch (error: any) {
    console.error('AI Daily Photo Analysis Error:', error)
    const msg = error?.message || 'เกิดข้อผิดพลาดในการวิเคราะห์รูปภาพด้วย AI'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
