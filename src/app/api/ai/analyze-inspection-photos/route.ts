import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/auditLogger'

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
    const { projectId, inspectionNo, workType, currentTitle, photos, mode } = body

    // Support string[] or { url: string }[]
    const photoUrls: string[] = Array.isArray(photos)
      ? photos
          .map((p: any) => (typeof p === 'string' ? p : p?.url))
          .filter((u: any) => typeof u === 'string' && u.startsWith('http'))
      : []

    if (photoUrls.length === 0) {
      return NextResponse.json(
        { error: 'ไม่พบรูปภาพที่อัปโหลด กรุณาอัปโหลดรูปภาพประกอบการขอตรวจก่อนเริ่มวิเคราะห์' },
        { status: 400 }
      )
    }

    // Fetch project context
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
        console.warn('Could not fetch project context for AI inspection vision:', dbErr)
      }
    }

    // Fetch up to 8 photos and convert to base64
    const selectedUrls = photoUrls.slice(0, 8)
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
          console.error('Error fetching image for AI inspection vision:', url, fetchErr)
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

    // Initialize Gemini with verified active models
    const genAI = new GoogleGenerativeAI(apiKey)
    const CANDIDATE_MODELS = [
      'gemini-3.6-flash',
      'gemini-3.5-flash',
      'gemini-3-flash-preview',
      'gemini-2.5-flash',
    ]

    const prompt = `คุณคือวิศวกรผู้ควบคุมงานก่อสร้างและผู้ตรวจสอบคุณภาพงาน (Site Quality Inspector / Quality Control Engineer)
มีหน้าที่วิเคราะห์รูปภาพหน้างานจริงใน "ใบขอส่งตรวจสอบคุณภาพงาน (Inspection Report)"
โครงการ: "${projectName}"
${inspectionNo ? `เลขที่ใบตรวจ: ${inspectionNo}` : ''}
${workType ? `หมวดงานปัจจุบัน: ${workType}` : ''}
${currentTitle ? `หัวข้องานที่ระบุเบื้องต้น: ${currentTitle}` : ''}
${taskListText ? `รายการงานตามแผนงาน/WBS ในโครงการเพื่ออ้างอิง:\n${taskListText}\n` : ''}

ภารกิจของคุณ:
1. วิเคราะห์รูปภาพแต่ละภาพอย่างละเอียด ว่าในภาพกำลังทำอะไร เป็นงานส่วนไหน สภาพงานถูกต้องตามมาตรฐานหรือไม่
2. สรุปเป็น JSON รูปแบบนี้เท่านั้น (ห้ามใส่ Markdown code block หรือตัวอักษรอื่นนอกเหนือจาก JSON):
{
  "suggestedTitle": "หัวข้อที่ขอตรวจที่กระชับและเป็นทางการเชิงวิศวกรรม เช่น ตรวจสอบงานผูกเหล็กและติดตั้งแบบหล่อเสา ค.ส.ล. ชั้น 1",
  "suggestedWorkType": "งานดิน/ฐานราก" หรือ "งานโครงสร้าง" หรือ "งานสถาปัตยกรรม" หรือ "งานระบบไฟฟ้า" หรือ "งานระบบประปา/สุขาภิบาล" หรือ "อื่นๆ",
  "inspectionDetails": "คำอธิบายรายละเอียดงานที่ขอตรวจ ระบุจุดที่ตรวจ ตำแหน่ง ชิ้นงาน และรายละเอียดทางเทคนิค เช่น ขนาดเหล็ก ระยะทาบ ความสะอาดแบบหล่อ โดยขึ้นต้นด้วย • แต่ละข้อ",
  "captions": [
    "คำบรรยายสั้นๆ สำหรับรูปภาพที่ 1 เช่น ผูกเหล็กแกนเสาและรัดลูกปูนเว้นระยะหนุน (Covering)",
    "คำบรรยายสั้นๆ สำหรับรูปภาพที่ 2"
  ]
}

ข้อกำหนดสำคัญ:
- อาร์เรย์ captions ต้องมีความยาวเท่ากับจำนวนรูปภาพที่ส่งมา (${validParts.length} รูป) ตามลำดับรูป
- ภาษาไทยต้องเป็นศัพท์เทคนิควิศวกรรมก่อสร้างที่ถูกต้อง สุภาพ ชัดเจน และเป็นทางการ
- ตอบเป็น JSON แท้ๆ เท่านั้น`

    let generatedResult: any = null
    let lastError: any = null

    for (const modelName of CANDIDATE_MODELS) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            responseMimeType: 'application/json',
          },
        })
        const response = await model.generateContent([prompt, ...validParts])
        const rawText = response.response.text()
        if (rawText && rawText.trim().length > 0) {
          const cleanedText = rawText.trim().replace(/^```json\s*/i, '').replace(/\s*```$/i, '')
          generatedResult = JSON.parse(cleanedText)
          break
        }
      } catch (err: any) {
        console.warn(`[AI Inspection Vision Failover] Model ${modelName} failed:`, err?.message || err)
        lastError = err
      }
    }

    if (!generatedResult) {
      const errMsg = lastError?.message || 'AI ไม่สามารถประมวลผลรูปภาพได้ในขณะนี้'
      return NextResponse.json(
        { error: `AI ขัดข้องชั่วขณะ (${errMsg}) กรุณาลองใหม่อีกครั้ง` },
        { status: 500 }
      )
    }

    if (projectId) {
      await logActivity({
        projectId,
        actionType: 'AI_ANALYZE',
        entityType: 'inspection',
        entityTitle: `วิเคราะห์รูปภาพใบขอตรวจคุณภาพด้วย AI Vision (${inspectionNo || 'ใบตรวจ'})`,
        details: {
          photoCount: validParts.length,
          suggestedTitle: generatedResult.suggestedTitle,
          suggestedWorkType: generatedResult.suggestedWorkType,
        },
      })
    }

    return NextResponse.json({
      success: true,
      ...generatedResult,
    })
  } catch (error: any) {
    console.error('AI Inspection Photo Analysis Error:', error)
    const msg = error?.message || 'เกิดข้อผิดพลาดในการวิเคราะห์รูปภาพใบขอตรวจด้วย AI'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
