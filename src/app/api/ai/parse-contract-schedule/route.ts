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
    const {
      projectName,
      contractAmount,
      durationDays,
      startDate,
      endDate,
      boqText,
      boqFiles = [],
      milestoneText,
      milestoneFiles = [],
    } = body

    const targetAmount = Number(contractAmount) || 0
    const targetDays = Number(durationDays) || 120

    // Prepare content parts for Gemini (both text and inline media)
    const contentParts: any[] = []

    // Helper for files
    const attachFiles = (files: any[], label: string) => {
      files.forEach((file: any) => {
        if (!file?.base64) return
        const mime = file.mimeType || 'image/jpeg'
        if (mime.startsWith('image/') || mime === 'application/pdf') {
          contentParts.push({
            inlineData: {
              mimeType: mime,
              data: file.base64,
            },
          })
        }
      })
    }

    attachFiles(boqFiles, 'ปร.5/ปร.6')
    attachFiles(milestoneFiles, 'งวดงาน')

    let combinedTextContext = `ข้อมูลโครงการ:
- ชื่อโครงการ: "${projectName || 'โครงการก่อสร้าง'}"
- วงเงินสัญญาเป้าหมาย: ${targetAmount > 0 ? targetAmount.toLocaleString('th-TH') + ' บาท' : 'ตามที่ระบุในเอกสาร'}
- ระยะเวลาก่อสร้างเป้าหมาย: ${targetDays} วัน
- วันที่เริ่มสัญญา: ${startDate || 'ไม่ระบุ'}
- วันสิ้นสุดสัญญา: ${endDate || 'ไม่ระบุ'}

`

    if (boqText && boqText.trim()) {
      combinedTextContext += `\n[ ข้อมูลจากเอกสาร ปร.5 / ปร.6 / สรุปหมวดงาน ]:\n${boqText.trim()}\n`
    }

    if (milestoneText && milestoneText.trim()) {
      combinedTextContext += `\n[ ข้อมูลจากเอกสารตารางงวดงานและเงื่อนไขการส่งมอบงาน ]:\n${milestoneText.trim()}\n`
    }

    const systemPrompt = `คุณคือวิศวกรผู้เชี่ยวชาญด้านการวางแผนงานก่อสร้างและบริหารต้นทุนโครงการ (Senior Construction Planning & Cost Control Engineer)
ภารกิจของคุณ: วิเคราะห์เอกสาร 2 ส่วนที่ได้รับ:
1. เอกสาร ปร.5 / ปร.6 หรือ สรุปหมวดงานก่อสร้าง (เพื่อเข้าใจสัดส่วนมูลค่าหมวดงานหลัก เช่น โครงสร้าง, สถาปัตย์, ระบบวิศวกรรม, สุขาภิบาล)
2. เอกสารตารางงวดงานและการเบิกจ่ายเงินตามสัญญา (เพื่อเข้าใจจำนวนงวดงานที่ 1 ถึง N และเงื่อนไขการส่งมอบในแต่ละงวด)

ให้สังเคราะห์ข้อมูลทั้งสองส่วนร่วมกับพารามิเตอร์ควบคุม:
- วงเงินสัญญารวม: ${targetAmount > 0 ? targetAmount + ' บาท' : 'ตามเอกสาร'} (ผลรวมของยอดเงินงวดงานทุกงวด และผลรวมของมูลค่ากิจกรรม WBS ต้องเท่ากับจำนวนนี้พอดี 100%)
- ระยะเวลาก่อสร้างรวม: ${targetDays} วัน (เกลี่ยระยะเวลาของกิจกรรมย่อยตามลำดับ CPM ให้เหมาะสมกับกรอบเวลานี้)

ข้อกำหนดผลลัพธ์ (Strict Requirements):
1. สร้างตารางงวดงาน (milestones):
   - milestone_no: ลำดับงวด 1, 2, 3 ...
   - name: ชื่องวด เช่น "งวดที่ 1"
   - work_scope: สรุปขอบเขตงานที่ต้องส่งมอบในงวดนี้อย่างชัดเจนตามมาตรฐานสัญญา
   - percentage: สัดส่วนร้อยละของงวดนั้น (ผลรวมทุกงวดต้องเท่ากับ 100%)
   - amount: ยอดเงินของงวดนั้น (บาท) (ผลรวมทุกงวดต้องเท่ากับวงเงินสัญญารวม ${targetAmount} บาท พอดีเป๊ะ)
   - expected_days: จำนวนวันสะสมนับจากวันเริ่มโครงการที่คาดว่าจะส่งมอบงวดนี้
2. สร้างแผนงานกิจกรรมย่อย WBS (tasks):
   - แตกกิจกรรมจากขอบเขตงานของแต่ละงวดงาน
   - wbs_no: รหัสลำดับแบบมีโครงสร้าง เช่น "1.1", "1.2", "2.1", "2.2" (ตัวเลขหน้าจุดคืองวดงาน)
   - name: ชื่อกิจกรรมเชิงวิศวกรรมที่กระชับ ชัดเจน
   - milestone_no: รหัสงวดงานที่กิจกรรมนี้สังกัด (เช่น 1, 2, 3)
   - duration: ระยะเวลาทำงานของกิจกรรมนั้น (วัน) โดยรวมสายงานแล้วต้องไม่เกิน ${targetDays} วัน
   - cost: มูลค่างานประเมินของกิจกรรมนั้น (บาท) โดยผลรวมของ cost ทุกกิจกรรมในงวดต้องเท่ากับ amount ของงวดนั้น
   - predecessors: รหัส WBS ของงานที่ต้องทำเสร็จก่อน เช่น "1.1" หรือถ้าทำพร้อมกันหรือเป็นงานแรกให้ใส่ null

ตอบกลับเป็น JSON เท่านั้น ตามโครงสร้างนี้ (ห้ามใส่ Markdown code block หรือข้อความเกริ่นนำใดๆ):
{
  "milestones": [
    {
      "milestone_no": 1,
      "name": "งวดที่ 1",
      "work_scope": "ขอบเขตงานส่งมอบงวดที่ 1...",
      "percentage": 10.0,
      "amount": 1000000,
      "expected_days": 30
    }
  ],
  "tasks": [
    {
      "wbs_no": "1.1",
      "name": "งานเตรียมพื้นที่และวางผังอาคาร",
      "milestone_no": 1,
      "duration": 10,
      "cost": 300000,
      "predecessors": null
    },
    {
      "wbs_no": "1.2",
      "name": "งานตอกเสาเข็มและทดสอบการรับน้ำหนัก",
      "milestone_no": 1,
      "duration": 14,
      "cost": 700000,
      "predecessors": "1.1"
    }
  ]
}`

    const genAI = new GoogleGenerativeAI(apiKey)
    const CANDIDATE_MODELS = [
      'gemini-2.5-flash',
      'gemini-flash-latest',
      'gemini-2.5-flash-lite',
      'gemini-flash-lite-latest',
      'gemini-3.1-flash-lite',
    ]

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

          const promptPayload = [
            systemPrompt,
            combinedTextContext,
            ...contentParts,
          ]

          const res = (await Promise.race([
            model.generateContent(promptPayload),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error(`Timeout 25s on ${modelName}`)), 25000)
            ),
          ])) as any

          const text = res.response.text().trim()
          const cleanedText = text.replace(/^```json/i, '').replace(/```$/i, '').trim()
          resultJson = JSON.parse(cleanedText)
          if (Array.isArray(resultJson?.milestones) && resultJson.milestones.length > 0) {
            break
          }
        } catch (err: any) {
          lastError = err
          console.warn(`[AI Plan Failover] Model ${modelName} error:`, err?.message || err)
        }
      }
    }

    if (!resultJson || !Array.isArray(resultJson.milestones) || resultJson.milestones.length === 0) {
      throw lastError || new Error('ไม่สามารถประมวลผลข้อมูลจากเอกสารได้ กรุณาตรวจสอบว่าเอกสารชัดเจนหรือมีข้อมูลตารางงวดงาน')
    }

    // Post-processing & Sanitize to guarantee math integrity
    const rawMilestones = resultJson.milestones
    const rawTasks = Array.isArray(resultJson.tasks) ? resultJson.tasks : []

    // Adjust milestone amounts to match targetAmount exactly if specified
    let finalMilestones = rawMilestones.map((m: any, idx: number) => {
      const pct = Number(m.percentage) || (100 / rawMilestones.length)
      const amt = targetAmount > 0
        ? Math.round((targetAmount * pct) / 100)
        : Number(m.amount) || 0

      return {
        milestone_no: idx + 1,
        name: m.name || `งวดที่ ${idx + 1}`,
        work_scope: String(m.work_scope || `ขอบเขตงานงวดที่ ${idx + 1}`).trim(),
        percentage: Number(pct.toFixed(2)),
        amount: amt,
        expected_days: Number(m.expected_days) || Math.round(((idx + 1) / rawMilestones.length) * targetDays),
      }
    })

    // Balance rounding discrepancy for milestones
    if (targetAmount > 0 && finalMilestones.length > 0) {
      const currentSum = finalMilestones.reduce((acc: number, curr: any) => acc + curr.amount, 0)
      const diff = targetAmount - currentSum
      if (diff !== 0) {
        finalMilestones[finalMilestones.length - 1].amount += diff
      }
    }

    // Process tasks and map to milestones
    let finalTasks = rawTasks.map((t: any, idx: number) => {
      const wbsNo = String(t.wbs_no || `${t.milestone_no || 1}.${idx + 1}`).trim()
      const name = String(t.name || `กิจกรรมที่ ${wbsNo}`).trim()
      const dur = Math.max(1, Number(t.duration) || 7)
      const cost = Math.max(0, Number(t.cost) || 0)
      const predecessors = t.predecessors ? String(t.predecessors).trim() : null

      return {
        wbs_no: wbsNo,
        name,
        milestone_no: Number(t.milestone_no) || 1,
        duration: dur,
        cost,
        predecessors,
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        milestones: finalMilestones,
        tasks: finalTasks,
        targetAmount,
        targetDays,
      },
    })
  } catch (error: any) {
    console.error('Parse Contract Schedule Error:', error)
    return NextResponse.json(
      { error: error?.message || 'เกิดข้อผิดพลาดในการประมวลผลเอกสารด้วย AI' },
      { status: 500 }
    )
  }
}
