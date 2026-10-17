import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { callThaiLLMVision, getThaiLLMApiKey } from '@/lib/thaiLLM'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: Request) {
  let apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || ''
  apiKey = apiKey.replace(/^["']|["']$/g, '').trim()
  const thaiKey = await getThaiLLMApiKey()

  if (!apiKey && !thaiKey) {
    return NextResponse.json(
      { error: 'ยังไม่ได้กำหนด GOOGLE_GENERATIVE_AI_API_KEY หรือ ThaiLLM API Key ในระบบ' },
      { status: 500 }
    )
  }

  try {
    const body = await req.json()
    const { photos, supervisor, groupName, relatedProjectName } = body

    const photoList: string[] = Array.isArray(photos) ? photos : []
    if (photoList.length === 0) {
      return NextResponse.json(
        { error: 'กรุณาเพิ่มรูปถ่ายหน้างานอย่างน้อย 1 รูปก่อนให้ AI วิเคราะห์' },
        { status: 400 }
      )
    }

    // Take up to 5 photos for vision analysis
    const selectedPhotos = photoList.slice(0, 5)
    const imageParts = await Promise.all(
      selectedPhotos.map(async (photo) => {
        try {
          if (photo.startsWith('data:image/')) {
            const matches = photo.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/)
            if (matches) {
              return {
                inlineData: {
                  mimeType: matches[1],
                  data: matches[2],
                },
              }
            }
          }

          if (photo.startsWith('http')) {
            const res = await fetch(photo, { signal: AbortSignal.timeout(10000) })
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
          }
          return null
        } catch (fetchErr) {
          console.error('Error preparing image for supervisor AI vision:', fetchErr)
          return null
        }
      })
    )

    const validParts = imageParts.filter(Boolean) as Array<{
      inlineData: { data: string; mimeType: string }
    }>

    if (validParts.length === 0) {
      return NextResponse.json(
        { error: 'ไม่สามารถโหลดรูปภาพเพื่อวิเคราะห์ได้ กรุณาตรวจสอบ URL หรือไฟล์รูปภาพ' },
        { status: 400 }
      )
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const CANDIDATE_MODELS = [
      'gemini-flash-latest',
      'gemini-3.8-flash',
      'gemini-3.7-flash',
      'gemini-3.6-flash',
      'gemini-3.1-flash-lite',
    ]

    const prompt = `คุณคือวิศวกรผู้ควบคุมงานก่อสร้างอาวุโส (Senior Site Engineer / Construction Supervisor)
หน้าที่ของคุณคือ: วิเคราะห์ภาพถ่ายการปฏิบัติงานหน้างานก่อสร้างของผู้ควบคุมงาน: "${supervisor || 'ผู้ควบคุมงาน'}"
${groupName ? `อยู่ในกลุ่มงาน: "${groupName}"` : ''}
${relatedProjectName ? `เกี่ยวข้องกับโครงการ: "${relatedProjectName}"` : ''}

ให้ทำการวิเคราะห์ภาพถ่ายทั้งหมด และสร้างข้อมูลสรุปผลงานที่กระชับ เป็นทางการ สุภาพ และถูกต้องตามหลักวิศวกรรมก่อสร้าง
ตอบกลับมาในรูปแบบ JSON ตามโครงสร้างนี้เท่านั้น (ห้ามใส่ Markdown code block หรือข้อความอื่นนอกเหนือจาก JSON):
{
  "title": "ชื่องาน / ภารกิจที่ปฏิบัติ (สั้น กระชับ ชัดเจน ไม่เกิน 80 ตัวอักษร เช่น 'สำรวจระดับแนวท่อระบายน้ำและวางหมุดผังอาคาร' หรือ 'ตรวจสอบความสมบูรณ์งานเทคอนกรีตฐานราก')",
  "description": "รายละเอียดผลการดำเนินงาน (สรุปกิจกรรมที่เห็นในรูปอย่างละเอียด โดยจัดเป็นข้อๆ ขึ้นต้นด้วย • แต่ละข้อระบุกิจกรรม พื้นที่ หรืออุปกรณ์เครื่องมือที่ใช้ รวมถึงผลการตรวจสอบ)",
  "has_issue": false,
  "issue_detail": "",
  "issue_solution": ""
}

ข้อแนะนำเพิ่มเติม:
- หากในภาพสังเกตเห็นปัญหา อุปสรรคหน้างาน เช่น ฝนตกน้ำท่วมขัง, ดินสไลด์, แนวทับซ้อน, ความไม่เรียบร้อย, วัสดุเสียหาย หรือต้องแก้ไข ให้ตั้ง "has_issue": true พร้อมระบุ "issue_detail" (ปัญหาที่พบ) และ "issue_solution" (แนวทางแก้ไขหรือข้อเสนอแนะ)
- หากไม่มีปัญหาหน้างาน ให้ "has_issue": false และเว้นว่าง string ไว้`

    let resultJson: any = null
    let lastError: any = null

    if (apiKey) {
      for (const modelName of CANDIDATE_MODELS) {
        try {
          const model = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: {
              temperature: 0.2,
              responseMimeType: 'application/json',
            },
          })

          const res = await Promise.race([
            model.generateContent([prompt, ...validParts]),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error(`Timeout 25s on ${modelName}`)), 25000)
            ),
          ]) as any

          const text = res.response.text().trim()
          const cleanedText = text.replace(/^```json/i, '').replace(/```$/i, '').trim()
          resultJson = JSON.parse(cleanedText)
          if (resultJson?.title && resultJson?.description) {
            break
          }
        } catch (err: any) {
          lastError = err
          console.warn(`Supervisor vision failover from ${modelName}:`, err.message)
        }
      }
    }

    // Backup Plan: ThaiLLM Vision Auto-Failover (qwen3.6-35b-a3b)
    if (!resultJson || !resultJson.title) {
      try {
        console.log('[ThaiLLM Vision] Attempting fallback for supervisor task...')
        const thaiImages = validParts.map((p) => ({
          base64: p.inlineData.data,
          mimeType: p.inlineData.mimeType,
        }))

        const thaiRes = await callThaiLLMVision({
          prompt,
          images: thaiImages,
          temperature: 0.2,
          timeoutMs: 35000,
        })

        if (thaiRes) {
          const jsonMatch = thaiRes.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0])
            if (parsed?.title && parsed?.description) {
              resultJson = parsed
              console.log('[ThaiLLM Vision] Successfully recovered supervisor task via ThaiLLM!')
            }
          }
        }
      } catch (thaiErr: any) {
        console.warn('[ThaiLLM Vision] Fallback error for supervisor task:', thaiErr?.message || thaiErr)
      }
    }

    if (!resultJson || !resultJson.title) {
      throw lastError || new Error('ไม่สามารถประมวลผลข้อมูลจากรูปภาพได้')
    }

    return NextResponse.json({
      success: true,
      data: resultJson,
    })
  } catch (error: any) {
    console.error('Supervisor AI Vision Error:', error)
    return NextResponse.json(
      { error: error.message || 'เกิดข้อผิดพลาดในการวิเคราะห์รูปภาพด้วย AI' },
      { status: 500 }
    )
  }
}
