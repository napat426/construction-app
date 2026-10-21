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

    const contentParts: any[] = []
    let combinedTextContext = `ข้อมูลโครงการ:
- ชื่อโครงการ: "${projectName || 'โครงการก่อสร้าง'}"
- วงเงินสัญญาเป้าหมาย: ${targetAmount > 0 ? targetAmount.toLocaleString('th-TH') + ' บาท' : 'ตามที่ระบุในเอกสาร'}
- ระยะเวลาก่อสร้างเป้าหมาย: ${targetDays} วัน
- วันที่เริ่มสัญญา: ${startDate || 'ไม่ระบุ'}
- วันสิ้นสุดสัญญา: ${endDate || 'ไม่ระบุ'}

`

    // Helper for files - extract text from PDF if possible to make Gemini lightning fast
    const processFiles = async (files: any[], label: string) => {
      for (const file of files) {
        if (!file?.base64) continue
        const mime = file.mimeType || 'image/jpeg'
        const isPdf = mime === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf')

        if (isPdf) {
          try {
            const { PDFParse } = await import('pdf-parse')
            const buf = Buffer.from(file.base64, 'base64')
            const parser = new PDFParse({ data: buf })
            const parsed = await parser.getText()
            await parser.destroy()

            const extracted = parsed?.text?.trim() || ''
            if (extracted.length > 50) {
              combinedTextContext += `\n[ ข้อมูลตารางที่ดึงได้จากเอกสาร PDF ${file.name || label} ]:\n${extracted.slice(0, 150000)}\n`
              continue // Extracted successfully! Do not send heavy base64 to Gemini.
            }
          } catch (e) {
            console.warn('[PDFParse Error, fallback to vision]:', e)
          }
        }

        // If image or scanned PDF without text layer, send as inlineData
        if (mime.startsWith('image/') || isPdf) {
          contentParts.push({
            inlineData: {
              mimeType: mime,
              data: file.base64,
            },
          })
        }
      }
    }

    await processFiles(boqFiles, 'ปร.5/ปร.6')
    await processFiles(milestoneFiles, 'งวดงาน')

    if (boqText && boqText.trim()) {
      combinedTextContext += `\n[ ข้อมูลจากเอกสาร ปร.5 / ปร.6 / สรุปหมวดงาน ]:\n${boqText.trim()}\n`
    }

    if (milestoneText && milestoneText.trim()) {
      combinedTextContext += `\n[ ข้อมูลจากเอกสารตารางงวดงานและเงื่อนไขการส่งมอบงาน ]:\n${milestoneText.trim()}\n`
    }

    const systemPrompt = `คุณคือวิศวกรวิชาชีพผู้เชี่ยวชาญระดับอาวุโสด้านการวางแผนงานก่อสร้างและควบคุมต้นทุน (Senior Professional Planning & Cost Control Engineer - PMP, CPM)

ภารกิจหลัก:
วิเคราะห์เอกสารก่อสร้างที่ได้รับ 2 ส่วนอย่างละเอียด:
1. เอกสาร BOQ / ปร.4 / ปร.5 / ปร.6 หรือข้อความสรุปหมวดงาน: นำรายการหมวดงานและสัดส่วนมูลค่าจริงจาก BOQ มาสร้างเป็นกิจกรรมงาน (Tasks) และกำหนดมูลค่างาน (Cost)
2. เอกสารตารางงวดงานท้ายสัญญาหรือข้อความเงื่อนไขการส่งมอบ: นำเงื่อนไขการแบ่งงวด 1 ถึง N มาผูกเข้ากับกลุ่มกิจกรรมงาน

เป้าหมายควบคุมโครงการ:
- วงเงินสัญญารวม: ${targetAmount > 0 ? targetAmount.toLocaleString('th-TH') + ' บาท' : 'ตามเอกสาร'}
- ระยะเวลาก่อสร้างรวมตามสัญญา: ${targetDays} วัน

🚨 กฎเหล็กทางวิศวกรรมที่ต้องปฏิบัติตามอย่างเคร่งครัด (STRICT ENGINEERING CONSTRAINTS):

1. ห้ามเกลี่ยระยะเวลา (duration) เท่ากันทุกกิจกรรมเด็ดขาด! (ห้ามใส่ 20 วัน หรือตัวเลขเดียวกันทุกงานโดยเด็ดขาด):
   - ระยะเวลาทำงาน (duration) ต้องสะท้อนความเป็นจริงทางวิศวกรรมก่อสร้าง:
     * งานเตรียมพื้นที่ วางผัง และรื้อถอน: 7 - 15 วัน
     * งานตอกเสาเข็ม/เจาะเสาเข็ม: 14 - 30 วัน
     * งานฐานราก เสาตอม่อ และคานคอดิน: 20 - 35 วัน
     * งานโครงสร้าง คสล. แต่ละชั้น: 20 - 35 วันต่อชั้น
     * งานโครงสร้างหลังคา และมุงหลังคา: 15 - 25 วัน
     * งานก่ออิฐ กรีดท่อ ฉาบปูน: 30 - 60 วัน (ทำคู่ขนาน)
     * งานระบบไฟฟ้า ประปา สุขาภิบาล ปรับอากาศ: 30 - 90 วัน (ทำคู่ขนาน)
     * งานปูกระเบื้องและตกแต่งผิวพื้น-ผนัง: 20 - 45 วัน
     * งานทาสีและติดตั้งสุขภัณฑ์/ดวงโคม: 15 - 30 วัน
     * งานถนน คอนกรีต บ่อพัก ท่อระบายน้ำ และภูมิทัศน์ภายนอก: 25 - 45 วัน
     * งานเก็บรายละเอียด ทำความสะอาด ทดสอบระบบ และจัดทำแบบ As-built Drawing: 7 - 15 วัน
   - การคิดระยะเวลาก่อสร้างรวม ${targetDays} วัน เป็นแบบเส้นทางวิกฤต (Critical Path Method - CPM): งานระบบและงานสถาปัตย์สามารถเริ่มทำขนานไปกับงานโครงสร้างได้ (Overlapping / Parallel tasks) ไม่ใช่การนำระยะเวลาทุกกิจกรรมมาบวกต่อคิวกันแบบเส้นตรง

2. การกำหนดมูลค่างาน (Cost) ต้องอิงจาก BOQ จริง และสมเหตุสมผลตามหลักวิศวกรรม:
   - งานที่มีเนื้องานและค่าวัสดุสูง (เช่น โครงสร้าง คสล., งานเสาเข็ม, งานก่อฉาบ, งานระบบ M&E, งานถนนภายนอก) ต้องได้มูลค่าก้อนใหญ่ตามความเป็นจริงใน BOQ
   - ⚠️ ห้ามใส่มูลค่างานสูงเกินจริงในงานสนับสนุนหรือปลายงวดเด็ดขาด เช่น:
     * งานเก็บรายละเอียด ทำความสะอาดไซต์ และจัดทำแบบ As-built Drawing ต้นทุนจริงในตลาดก่อสร้างอยู่ที่ประมาณ 50,000 - 150,000 บาทเท่านั้น (ห้ามใส่เป็นหลักล้านเด็ดขาด!)
     * หากงวดสุดท้ายมีเงินค่างวดเหลือ ให้จัดสรรเงินส่วนใหญ่ไปที่ "งานถนนคอนกรีต ระบบระบายน้ำภายนอก บ่อพัก หรือภูมิทัศน์" ซึ่งมีต้นทุนค่าของและค่าแรงจริงสูง
   - ผลรวมของมูลค่าทุกกิจกรรม WBS รวมกันทั้งโครงการ ต้องเท่ากับ ${targetAmount > 0 ? targetAmount : 'วงเงินสัญญารวม'} บาทพอดี 100%

3. โครงสร้างกิจกรรม WBS (Tasks):
   - ไม่จำเป็นต้องมีเพียง 2 งานต่องวด! ให้แตกกิจกรรมตามเนื้องานจริงที่ต้องส่งมอบในงวดนั้น (ปกติงวดละ 2 - 4 กิจกรรมที่กระชับและมีความหมายทางวิศวกรรม)
   - wbs_no: ให้เรียงตามลำดับโครงสร้าง เช่น 1.1, 1.2, 1.3, 2.1, 2.2, 2.3
   - predecessors: ให้ระบุความสัมพันธ์ของงานก่อนหน้าตามลำดับหน้างานจริง เช่น งานโครงสร้างชั้น 2 (predecessor คืองานโครงสร้างชั้น 1), งานฉาบปูน (predecessor คืองานก่ออิฐ) หรือระบุ null หากเป็นงานเริ่มต้น

4. ตารางงวดงาน (Milestones):
   - สรุปขอบเขตงานส่งมอบในแต่ละงวดให้ชัดเจน อ่านเข้าใจง่าย ตรงตามข้อกำหนดการตรวจรับงานของหน่วยงานเจ้าของโครงการ
   - สัดส่วน % และยอดเงิน amount ของแต่ละงวดต้องรวมกันได้ 100% และเท่ากับ ${targetAmount > 0 ? targetAmount : 'วงเงินสัญญา'} บาท

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
      "name": "งานเตรียมพื้นที่ วางผัง และรั้วชั่วคราว",
      "milestone_no": 1,
      "duration": 10,
      "cost": 150000,
      "predecessors": null
    },
    {
      "wbs_no": "1.2",
      "name": "งานตอกเสาเข็มและทดสอบกำลังรับน้ำหนัก",
      "milestone_no": 1,
      "duration": 20,
      "cost": 850000,
      "predecessors": "1.1"
    }
  ]
}`

    const genAI = new GoogleGenerativeAI(apiKey)
    const CANDIDATE_MODELS = [
      'gemini-flash-lite-latest',
      'gemini-3.1-flash-lite',
      'gemini-3.6-flash',
    ]

    let resultJson: any = null
    let lastError: any = null

    if (apiKey) {
      for (const modelName of CANDIDATE_MODELS) {
        try {
          const model = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: {
              temperature: 0.1,
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
              setTimeout(() => reject(new Error(`Timeout 45s on ${modelName}`)), 45000)
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
