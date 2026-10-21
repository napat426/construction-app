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
    let boqExtractedText = ''
    let milestoneExtractedText = ''

    // Helper for files - extract text from PDF if possible to make Gemini lightning fast
    const extractFileContent = async (files: any[], label: string) => {
      let textAcc = ''
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
              textAcc += `\n[ ข้อมูลตารางที่ดึงได้จากเอกสาร PDF ${file.name || label} ]:\n${extracted.slice(0, 150000)}\n`
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
      return textAcc
    }

    const boqFilesText = await extractFileContent(boqFiles, 'ปร.5/ปร.6')
    boqExtractedText += boqFilesText
    if (boqText && boqText.trim()) {
      boqExtractedText += `\n[ ข้อมูลข้อความ ปร.5 / ปร.6 / สรุปหมวดงาน BOQ ]:\n${boqText.trim()}\n`
    }

    const milestoneFilesText = await extractFileContent(milestoneFiles, 'ตารางงวดงาน')
    milestoneExtractedText += milestoneFilesText
    if (milestoneText && milestoneText.trim()) {
      milestoneExtractedText += `\n[ ข้อมูลข้อความตารางงวดงานและเงื่อนไขการส่งมอบเงินค่างวด ]:\n${milestoneText.trim()}\n`
    }

    const combinedTextContext = `=== ข้อมูลโครงการก่อสร้าง (Project Metadata) ===
- ชื่อโครงการ: "${projectName || 'โครงการก่อสร้าง'}"
- วงเงินสัญญารวม: ${targetAmount > 0 ? targetAmount.toLocaleString('th-TH') + ' บาท' : 'ตามเอกสาร'}
- ระยะเวลาก่อสร้างรวม: ${targetDays} วัน
- วันที่เริ่มสัญญา: ${startDate || 'ไม่ระบุ'}
- วันที่สิ้นสุดสัญญา: ${endDate || 'ไม่ระบุ'}

======================================================================
[ ส่วนที่ 1: เอกสารต้นทุนจริงและปริมาณงาน (BOQ / ปร.4 / ปร.5 / ปร.6) ]
🚨 กฎสำคัญ: ข้อมูลส่วนนี้คือ "แหล่งความจริงแห่งเดียวของต้นทุนกิจกรรม (Task Cost)"
ให้นำหมวดงานและมูลค่าจริงจาก BOQ ส่วนนี้ไปสร้างเป็นกิจกรรม WBS และกำหนด task.cost เท่านั้น!
======================================================================
${boqExtractedText.trim() ? boqExtractedText : '(ไม่มีเอกสาร BOQ แยกมา ให้กระจายมูลค่าตามสัดส่วน Benchmark วิศวกรรมมาตรฐาน)'}

======================================================================
[ ส่วนที่ 2: เอกสารตารางงวดงานและเงื่อนไขการส่งมอบเงินค่างวด (Payment Milestones) ]
🚨 กฎสำคัญ: ข้อมูลส่วนนี้คือ "ตารางการเบิกเงินของผู้รับจ้างตามสัญญา (Cash Disbursement Schedule)"
สัญญามักกดเงินงวดแรกๆ ให้น้อย และจ่ายงวดหลังๆ เยอะ เพื่อป้องกันผู้รับเหมาทิ้งงาน
ข้อมูลส่วนนี้ใช้สำหรับสร้างตารางงวดงาน (milestones) เท่านั้น:
- milestone_no, name, work_scope, percentage, amount, expected_days
⚠️ ห้ามเด็ดขาด: ห้ามนำยอดเงินงวด (milestone.amount) มายัดใส่หรือเฉลี่ยใส่ task.cost เด็ดขาด!
======================================================================
${milestoneExtractedText.trim() ? milestoneExtractedText : '(ไม่มีเอกสารงวดงาน ให้แบ่งงวดตามมาตรฐานการส่งมอบโครงการ)'}
`

    const systemPrompt = `คุณคือวิศวกรวิชาชีพผู้เชี่ยวชาญระดับสูงด้านการวางแผนงานก่อสร้าง ควบคุมต้นทุน และบริหารสัญญาโครงการ (Senior Construction Project Manager & Planning Engineer - PMP, CPM, AACE)

ภารกิจ:
วิเคราะห์เอกสารก่อสร้าง 2 ส่วนเพื่อจัดทำแผนงานก่อสร้างและงวดงานระดับมืออาชีพ:
1. แผนงานกิจกรรมก่อสร้าง WBS (Tasks): แตกกิจกรรมและกำหนดมูลค่า (cost) อิงตาม "BOQ / ปร.4 / ปร.5 / ปร.6" เท่านั้น!
2. แผนการเบิกจ่ายงวดงานตามสัญญา (Milestones): สรุปขอบเขตและเงินค่างวดตาม "ตารางงวดงานท้ายสัญญา"

เป้าหมายตัวเลขโครงการ:
- วงเงินสัญญารวม: ${targetAmount > 0 ? targetAmount.toLocaleString('th-TH') + ' บาท' : 'ตามเอกสาร'}
- ระยะเวลาก่อสร้างรวม: ${targetDays} วัน

======================================================================
🚨 กฎเหล็กหัวใจสำคัญด้านวิศวกรรมและการเงินโครงการ (CRITICAL PRINCIPLES):
======================================================================

1. การแยกขาดระหว่าง "เงินงวดสัญญา (Cash Disbursement)" กับ "ต้นทุนงานจริง (Task Cost from BOQ)":
   - **ตารางงวดงาน (Milestones)**:
     * คือแผนการเบิกจ่ายเงิน (Cash Flow) ของสัญญา ซึ่งเจ้าของโครงการมักกดเงินงวดแรกๆ ให้ต่ำ และจ่ายงวดหลังๆ สูง เพื่อป้องกันผู้รับเหมาทิ้งงาน
     * ตัวเลขเงินงวด (% หรือ amount) ในแต่ละงวด "ไม่ใช่" ต้นทุนจริงของกิจกรรมที่ส่งมอบในงวดนั้น!
     * ⚠️ ห้ามเด็ดขาด (STRICTLY FORBIDDEN): ห้ามนำยอดเงินงวด (amount) ของแต่ละงวด มาเฉลี่ยหรือยัดใส่กิจกรรมงานในงวดนั้นเด็ดขาด!
   
   - **เอกสาร BOQ / ปร.4 / ปร.5 / ปร.6**:
     * คือ "แหล่งความจริงแห่งเดียว (Single Source of Truth)" สำหรับกำหนดชื่องานและต้นทุน (task.cost)!
     * ตัวอย่างข้อผิดพลาดที่ห้ามทำเด็ดขาด:
       ❌ ห้ามทำ: งวดที่ 8 เบิกเงิน 12% เป็นเงิน 2,907,324 บาท โดยสัญญาระบุส่งมอบงานเดินสายสัญญาณโทรศัพท์ แล้วไปตั้งค่างาน "เดินสายสัญญาณโทรศัพท์ = 2,907,324 บาท" -> ผิดหลักวิศวกรรมอย่างร้ายแรง!
       ✅ ที่ถูกต้อง: ใน BOQ งานเดินสายสัญญาณและระบบโทรศัพท์ มีมูลค่าจริงเพียง 150,000 - 350,000 บาท กิจกรรม "งานระบบสายสัญญาณ" ต้องมี cost = 150,000 - 350,000 บาทเท่านั้น! ส่วนเงินงวด 2.9 ล้านคือเงินเบิกจ่ายสะสมของสัญญา!
       ❌ ห้ามทำ: งวดสุดท้ายส่งมอบงาน As-built drawing และทำความสะอาด แล้วตั้งค่างาน As-built = 1,407,324 บาท -> ผิดหลักวิศวกรรมอย่างร้ายแรง!
       ✅ ที่ถูกต้อง: งานทำความสะอาด As-built Drawing ใน BOQ มีมูลค่าเพียง 50,000 - 150,000 บาทเท่านั้น!

2. สัจธรรมสัดส่วนต้นทุนวิศวกรรมก่อสร้าง (Engineering Cost Breakdown):
   - งานที่มีเนื้องานและค่าวัสดุก้อนใหญ่ (โครงสร้าง คสล., เสาเข็ม, ก่ออิฐฉาบปูน, ระบบไฟฟ้า M&E, งานถนนภายนอก) จะต้องมีสัดส่วนมูลค่ามากที่สุดในโครงการ
   - หากใน BOQ มีรายละเอียดตัวเลข ให้ยึดตัวเลขตาม BOQ 100%
   - หากเอกสาร BOQ ที่แนบมาเป็นเพียงภาพรวมหรือสรุปหมวด ให้กระจายต้นทุนตามสัดส่วน Benchmark วิศวกรรมมาตรฐาน:
     * งานเตรียมพื้นที่ วางผัง และงานชั่วคราว: 1 - 2% (~250k - 500k)
     * งานเสาเข็มและดินขุด/ฐานราก: 10 - 15% (~2.5M - 3.6M)
     * งานโครงสร้าง คสล. ชั้น 1, 2 และโครงสร้างหลังคา: 28 - 35% (~6.8M - 8.5M)
     * งานสถาปัตยกรรม (งานก่อฉาบ, ผิวพื้น, ผนัง, ฝ้าเพดาน, ประตูหน้าต่าง, ทาสี): 22 - 28% (~5.3M - 6.8M)
     * งานระบบไฟฟ้ากำลัง แสงสว่าง และหม้อแปลง: 7 - 10% (~1.7M - 2.4M)
     * งานระบบสุขาภิบาล บำบัดน้ำเสีย และประปา: 5 - 8% (~1.2M - 1.9M)
     * งานระบบปรับอากาศและระบายอากาศ (ถ้ามี): 4 - 7%
     * งานระบบสื่อสาร สายสัญญาณ โทรศัพท์ และแจ้งเหตุเพลิงไหม้: 1 - 2% (200,000 - 450,000 บาทเท่านั้น!)
     * งานถนน คอนกรีต รางระบายน้ำ ท่อระบายน้ำ บ่อพัก และรั้วรอบโครงการ: 8 - 14% (~2.0M - 3.4M)
     * งานทำความสะอาด ทดสอบระบบ และจัดทำแบบ As-built: 0.3 - 0.5% (60,000 - 120,000 บาทเท่านั้น!)

3. ความสัมพันธ์ทางคณิตศาสตร์:
   - ผลรวมของ milestone.amount ทั้งหมดทั้งโครงการ = ${targetAmount} บาท (100%)
   - ผลรวมของ task.cost ทั้งหมดทั้งโครงการ = ${targetAmount} บาท (100%)
   - ⚠️ ในแต่ละงวด: ผลรวมของ task.cost ในงวดนั้น "ไม่ต้องเท่ากับ" milestone.amount ของงวดนั้น! เพราะเงินงวดคือเงินเบิกจ่าย ส่วน task cost คือต้นทุนวิศวกรรมจริงจาก BOQ

4. ระยะเวลากิจกรรม (Duration) และ Critical Path Method (CPM):
   - ⚠️ ห้ามใส่ระยะเวลา 20 วัน หรือตัวเลขเดียวกันทุกงานโดยเด็ดขาด!
   - ระยะเวลาทำงานต้องสะท้อนหน้างานจริง:
     * งานเตรียมพื้นที่ วางผัง: 7 - 15 วัน
     * งานเสาเข็มและทดสอบกำลัง: 14 - 25 วัน
     * งานฐานราก ตอม่อ คานคอดิน: 20 - 35 วัน
     * งานโครงสร้างชั้น 1 และ ชั้น 2: 25 - 40 วันต่อชั้น
     * งานโครงสร้างหลังคาและมุงหลังคา: 15 - 25 วัน
     * งานก่ออิฐและกรีดฝังท่อ: 30 - 50 วัน (ทำคู่ขนาน)
     * งานฉาบปูนภายในและภายนอก: 25 - 40 วัน
     * งานเดินสายเมนไฟฟ้าและท่อประปาหลัก: 30 - 60 วัน (ทำคู่ขนาน)
     * งานฝ้าเพดาน ปูกระเบื้อง: 20 - 35 วัน
     * งานติดตั้งอุปกรณ์ไฟฟ้า ดวงโคม และสุขภัณฑ์: 15 - 25 วัน
     * งานเดินสายสัญญาณและโทรศัพท์: 10 - 20 วัน
     * งานถนนคอนกรีตและระบายน้ำภายนอก: 25 - 45 วัน
     * งานทำความสะอาด As-built: 7 - 12 วัน
   - การคิดระยะเวลารวมโครงการ ${targetDays} วัน เป็นแบบ CPM (งานสถาปัตย์ งานระบบ และงานภายนอก สามารถเริ่มทำคู่ขนาน Overlapping ไปกับงานโครงสร้างได้ ไม่ใช่ต่อคิวเส้นตรง)
   - predecessors: ระบุรหัส WBS ของงานก่อนหน้าตามลำดับจริง เช่น "1.1", "1.2", "2.1" หรือใส่ null หากเป็นงานเริ่มต้น

5. โครงสร้างกิจกรรม WBS (Tasks):
   - แตกกิจกรรมให้สมจริงและครอบคลุมงานก่อสร้างทั้งโครงการ (รวมทั้งสิ้นประมาณ 18 - 32 กิจกรรม เฉลี่ยงวดละ 2 - 4 กิจกรรม)
   - ระบุ milestone_no บนแต่ละกิจกรรม เพื่อบ่งชี้ว่างานนี้สัมพันธ์กับงวดงานส่งมอบที่เท่าไหร่

ตอบกลับเป็น JSON เท่านั้น ตามโครงสร้างนี้ (ห้ามใส่ Markdown หรือข้อความเกริ่นนำ):
{
  "milestones": [
    {
      "milestone_no": 1,
      "name": "งวดที่ 1",
      "work_scope": "จัดทำผังบริเวณ ก่อสร้างรั้วชั่วคราว และตอกเสาเข็มแล้วเสร็จ",
      "percentage": 5.0,
      "amount": 1211385,
      "expected_days": 25
    },
    {
      "milestone_no": 8,
      "name": "งวดที่ 8",
      "work_scope": "ติดตั้งระบบไฟฟ้าแสงสว่าง สุขภัณฑ์ และเดินสายสัญญาณโทรศัพท์แล้วเสร็จ",
      "percentage": 12.0,
      "amount": 2907324,
      "expected_days": 180
    }
  ],
  "tasks": [
    {
      "wbs_no": "1.1",
      "name": "งานเตรียมพื้นที่ วางผังโครงการ และรั้วชั่วคราว",
      "milestone_no": 1,
      "duration": 10,
      "cost": 250000,
      "predecessors": null
    },
    {
      "wbs_no": "1.2",
      "name": "งานตอกเสาเข็มคอนกรีตอัดแรงและทดสอบกำลัง",
      "milestone_no": 1,
      "duration": 20,
      "cost": 1850000,
      "predecessors": "1.1"
    },
    {
      "wbs_no": "8.1",
      "name": "งานติดตั้งดวงโคมไฟฟ้า สวิตช์ และเต้ารับ",
      "milestone_no": 8,
      "duration": 25,
      "cost": 650000,
      "predecessors": "7.2"
    },
    {
      "wbs_no": "8.2",
      "name": "งานระบบสื่อสาร สายสัญญาณ และโทรศัพท์",
      "milestone_no": 8,
      "duration": 15,
      "cost": 280000,
      "predecessors": "8.1"
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
      let cost = Math.max(0, Number(t.cost) || 0)
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

    // 🛡️ ENGINEERING SANITY GUARDRAILS (วิศวกรรมคุ้มกันข้อผิดพลาด):
    // ป้องกันกรณี AI พลาดเอายอดเงินงวดหลายล้านมายัดใส่งานย่อยเฉพาะทาง
    if (finalTasks.length > 0 && targetAmount > 0) {
      finalTasks.forEach((t: any) => {
        const lowerName = t.name.toLowerCase()
        // 1. As-built / Cleaning / Final Handover: ไม่ควรเกิน 0.6% หรือ 150,000 บาท
        if (/as[- ]?built|ทำความสะอาด|เก็บรายละเอียด|ส่งมอบงาน/i.test(lowerName)) {
          const maxAllowed = Math.min(150000, Math.round(targetAmount * 0.006))
          if (t.cost > maxAllowed) {
            t.cost = maxAllowed
          }
        }
        // 2. Telecom / Telephone / Signal Cabling: ไม่ควรเกิน 1.8% หรือ 450,000 บาท
        if (/สายสัญญาณ|โทรศัพท์|lan|network|โทรคมนาคม|สายนำสัญญาณ/i.test(lowerName)) {
          const maxAllowed = Math.min(450000, Math.round(targetAmount * 0.018))
          if (t.cost > maxAllowed) {
            t.cost = maxAllowed
          }
        }
        // 3. Site Prep / Temporary Work: ไม่ควรเกิน 2.5% หรือ 600,000 บาท
        if (/เตรียมพื้นที่|วางผัง|รั้วชั่วคราว|รื้อถอน/i.test(lowerName)) {
          const maxAllowed = Math.min(600000, Math.round(targetAmount * 0.025))
          if (t.cost > maxAllowed) {
            t.cost = maxAllowed
          }
        }
      })

      // ปรับจูนสัดส่วนยอดรวม Tasks ให้เท่ากับ 100% ของ targetAmount พอดี โดยคงสัดส่วน BOQ ไว้
      const currentTaskSum = finalTasks.reduce((acc: number, curr: any) => acc + curr.cost, 0)
      if (currentTaskSum > 0) {
        const scale = targetAmount / currentTaskSum
        let runningSum = 0
        let maxTaskIdx = 0
        let maxCost = 0

        finalTasks.forEach((t: any, idx: number) => {
          t.cost = Math.round(t.cost * scale)
          runningSum += t.cost
          if (t.cost > maxCost) {
            maxCost = t.cost
            maxTaskIdx = idx
          }
        })

        const diff = targetAmount - runningSum
        if (diff !== 0 && finalTasks[maxTaskIdx]) {
          finalTasks[maxTaskIdx].cost += diff
        }
      }

      // ตรวจสอบ duration: หาก AI เกลี่ยตัวเลขเดิมทุกงาน (เช่น 20 วันเท่ากันหมด) ให้เกลี่ยตามหลักวิศวกรรม
      const durations = finalTasks.map((t: any) => t.duration)
      const isAllSameDuration = durations.length > 3 && durations.every((d: number) => d === durations[0])
      if (isAllSameDuration) {
        finalTasks.forEach((t: any) => {
          const lowerName = t.name.toLowerCase()
          if (/as[- ]?built|ทำความสะอาด|เก็บรายละเอียด/i.test(lowerName)) t.duration = 10
          else if (/เตรียมพื้นที่|วางผัง|รั้ว/i.test(lowerName)) t.duration = 12
          else if (/เสาเข็ม/i.test(lowerName)) t.duration = 20
          else if (/ฐานราก|ตอม่อ|คานคอดิน/i.test(lowerName)) t.duration = 25
          else if (/โครงสร้าง/i.test(lowerName)) t.duration = 30
          else if (/หลังคา/i.test(lowerName)) t.duration = 20
          else if (/ก่ออิฐ|ฉาบปูน/i.test(lowerName)) t.duration = 35
          else if (/ไฟฟ้า|ประปา|สุขาภิบาล/i.test(lowerName)) t.duration = 30
          else if (/สายสัญญาณ|โทรศัพท์/i.test(lowerName)) t.duration = 15
          else if (/ปูกระเบื้อง|ฝ้า/i.test(lowerName)) t.duration = 25
          else if (/ถนน|ระบายน้ำภายนอก/i.test(lowerName)) t.duration = 35
          else t.duration = 20
        })
      }
    }

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

