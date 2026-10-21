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
จัดทำแผนงานก่อสร้างและงวดงานระดับมืออาชีพสำหรับโครงการ:
- ชื่อโครงการ: "${projectName || 'โครงการก่อสร้าง'}"
- วงเงินสัญญารวม: ${targetAmount > 0 ? targetAmount.toLocaleString('th-TH') + ' บาท' : 'ตามเอกสาร'}
- ระยะเวลาก่อสร้างรวม: ${targetDays} วัน

======================================================================
🚨 กฎเหล็กทางวิศวกรรมที่สำคัญที่สุด (STRICT ENGINEERING & CONSTRUCTION RULES):
======================================================================

1. 🚫 ห้ามแตกกิจกรรมแบบเหมารวมหยาบๆ เด็ดขาด! (STRICTLY FORBIDDEN COARSE TASKS):
   - ❌ ห้ามสร้างกิจกรรมเดียวว่า "งานโครงสร้าง คสล. อาคารสำนักงานและอาคารอยู่เวร" แล้วใส่ 60 วันเด็ดขาด!
   - วิศวกรหน้างานไม่สามารถใช้คุมงานหรือตรวจรับความก้าวหน้ารายสัปดาห์ได้เลยถ้ากิจกรรมไม่ไล่ระดับขั้นตอน!
   - ✅ ต้องแตกย่อยและไล่ระดับขั้นตอนงานก่อสร้างจริง (Sequential Construction Hierarchy) ทั้งโครงการอย่างน้อย 22 - 32 กิจกรรมเสมอ!

2. 📐 ลำดับขั้นการแตกกิจกรรม WBS ทางวิศวกรรมอาคารที่ต้องมี (MANDATORY ENGINEERING WBS HIERARCHY):
   หมวดที่ 1: งานเตรียมการและงานเสาเข็ม
   - งานเตรียมพื้นที่ วางผัง จัดทำรั้วชั่วคราว และอาคารชั่วคราว (10-15 วัน)
   - งานเจาะสำรวจดิน ตอก/เจาะเสาเข็ม และทดสอบกำลังรับน้ำหนักเสาเข็ม (20-28 วัน)
   - งานขุดดิน ตัดหัวเสาเข็ม ทรายหยาบ และเทคอนกรีตหยาบรองก้นหลุม (10-15 วัน)

   หมวดที่ 2: งานโครงสร้าง คสล. ใต้ดินและชั้นล่าง
   - งานโครงสร้างฐานราก คสล. และเสาตอม่อ (20-25 วัน)
   - งานคานคอดิน ถมดินบดอัด วางท่อกำจัดปลวก และพื้น คสล. ชั้น 1 (25-30 วัน)

   หมวดที่ 3: งานโครงสร้าง คสล. ชั้นบนและโครงหลังคา
   - งานเสา คสล. ชั้น 1 และคาน-พื้น คสล. ชั้น 2 (25-30 วัน)
   - งานเสา คสล. ชั้น 2 และคานรับหลังคา คสล. (15-20 วัน)
   - งานติดตั้งโครงสร้างเหล็กหลังคา ทาสีกันสนิม (20-25 วัน)
   - งานมุงแผ่นหลังคา ติดตั้งฉนวนกันความร้อน และรางระบายน้ำฝน (15-20 วัน)

   หมวดที่ 4: งานสถาปัตยกรรม (เนื้องานจริง)
   - งานก่ออิฐผนัง ติดตั้งเสาเอ็น-ทับหลัง และติดตั้งวงกบประตูหน้าต่าง (25-35 วัน)
   - งานเดินท่อร้อยสายไฟฟ้าและท่อประปาฝังผนัง (Rough-in) (15-20 วัน ทำคู่ขนาน)
   - งานฉาบปูนผนังภายในและภายนอกอาคาร (25-30 วัน)
   - งานติดตั้งโครงคร่าวฝ้าเพดาน และกรุแผ่นยิปซัม/แผ่นฝ้าชายคา (20-25 วัน)
   - งานปูกระเบื้องพื้น ปูกระเบื้องผนังห้องน้ำ และบัวเชิงผนัง (20-25 วัน)
   - งานติดตั้งกรอบบานประตู-หน้าต่าง อลูมิเนียม และกระจก (15-20 วัน)
   - งานติดตั้งสุขภัณฑ์และอุปกรณ์ประกอบห้องน้ำ (15-20 วัน)
   - งานทาสีรองพื้นและทาสีน้ำอะคริลิกจริงภายใน-ภายนอก (20-25 วัน)

   หมวดที่ 5: งานระบบวิศวกรรมประกอบอาคาร (M&E)
   - งานเดินท่อเมนประปา ท่อระบายน้ำทิ้ง และติดตั้งถังบำบัดน้ำเสีย (20-25 วัน)
   - งานเดินสายเมนไฟฟ้า ติดตั้งตู้ MDB, แผงย่อย และระบบส่องสว่าง/เต้ารับ (25-30 วัน)
   - งานระบบสายดิน (Grounding) และระบบป้องกันฟ้าผ่า (15 วัน)
   - งานระบบสื่อสาร สายสัญญาณ LAN, โทรศัพท์ และระบบแจ้งเหตุเพลิงไหม้ (15-20 วัน)
   - งานติดตั้งระบบปรับอากาศและพัดลมระบายอากาศ (HVAC) (20 วัน)

   หมวดที่ 6: งานผังบริเวณและภูมิทัศน์ภายนอก
   - งานวางท่อระบายน้ำ คสล. บ่อพักน้ำฝน และบ่อดักไขมันภายนอก (20-25 วัน)
   - งานถนน คสล. คันหิน ทางเท้า และลานจอดรถ คสล. (25-35 วัน)
   - งานก่อสร้างรั้ว คสล. รอบโครงการ และประตูเลื่อนทางเข้า (20 วัน)

   หมวดที่ 7: งานทดสอบระบบและส่งมอบโครงการ
   - งานทดสอบระบบไฟฟ้า สุขาภิบาล และระบบความปลอดภัย (Commissioning) (10 วัน)
   - งานทำความสะอาดพื้นที่ เก็บรายละเอียด และจัดทำแบบ As-built Drawing (7-10 วัน)

3. 💰 กฎการกำหนดมูลค่างาน (Cost Allocation from BOQ):
   - แยกขาดระหว่าง "เงินงวดสัญญา (Disbursement)" กับ "ต้นทุนงานจริง (Task Cost from BOQ)"
   - ⚠️ ห้ามเด็ดขาด: ห้ามนำยอดเงินงวดสัญญา (เช่น งวด 8 จ่าย 2.9 ล้าน) มาใส่ในงานสายสัญญาณโทรศัพท์!
   - งานสายสัญญาณ LAN/โทรศัพท์ มีต้นทุนใน BOQ เพียง 250,000 - 350,000 บาทเท่านั้น!
   - งานทำความสะอาด As-built มีต้นทุนใน BOQ เพียง 50,000 - 80,000 บาทเท่านั้น!
   - งานโครงสร้าง คสล., ฐานราก, สถาปัตย์, ระบบไฟฟ้าหลัก, งานถนน คสล. ต้องได้มูลค่าก้อนใหญ่ตามความเป็นจริง!
   - ผลรวมของ task.cost ทุกงานรวมกันทั้งโครงการ = ${targetAmount > 0 ? targetAmount : 'วงเงินสัญญารวม'} บาท (100%)
   - ผลรวมของ milestone.amount ทุกงวดรวมกันทั้งโครงการ = ${targetAmount > 0 ? targetAmount : 'วงเงินสัญญารวม'} บาท (100%)

4. ⏱️ การจัดสายงานวิกฤต (CPM) และ Predecessors:
   - ห้ามใส่ 20 วันเท่ากันทุกงาน!
   - predecessors ต้องเชื่อมโยงตามลำดับวิศวกรรมจริง เช่น 1.1 -> 1.2 -> 1.3 -> 2.1 -> 2.2 -> 2.3 เป็นต้น

ตอบกลับเป็น JSON เท่านั้น (ห้ามใส่ Markdown หรือข้อความเกริ่นนำใดๆ):
{
  "milestones": [
    {
      "milestone_no": 1,
      "name": "งวดที่ 1",
      "work_scope": "ขอบเขตงานงวดที่ 1...",
      "percentage": 5.0,
      "amount": 1211385,
      "expected_days": 30
    }
  ],
  "tasks": [
    {
      "wbs_no": "1.1",
      "name": "งานเตรียมพื้นที่ วางผัง จัดทำรั้วชั่วคราว และสำนักงานสนาม",
      "milestone_no": 1,
      "duration": 12,
      "cost": 350000,
      "predecessors": null
    },
    {
      "wbs_no": "1.2",
      "name": "งานเจาะสำรวจดิน ตอกเสาเข็ม และทดสอบกำลังรับน้ำหนัก",
      "milestone_no": 1,
      "duration": 25,
      "cost": 1250000,
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

    // 🏗️ CIVIL ENGINEERING WBS DECOMPOSITION ENGINE:
    // หาก AI แตกงานหยาบเกินไป (เช่น รวบเป็น 1 งานต่องวด หรือมีงานโครงสร้าง คสล. ก้อนเดียว 60 วัน)
    // ระบบจะทำการแตกย่อยเป็นขั้นตอนก่อสร้างจริงทันที เพื่อให้วิศวกรใช้คุมงานได้จริง 100%
    const decomposeCoarseTasks = (tasks: any[]) => {
      const output: any[] = []

      for (const t of tasks) {
        const name = String(t.name || '').trim()
        const m = Number(t.milestone_no) || 1
        const c = Math.max(0, Number(t.cost) || 0)
        const dur = Math.max(1, Number(t.duration) || 20)

        // 1. งานโครงสร้าง คสล. เหมารวม
        if (/โครงสร้าง.*คสล/i.test(name) && !/ฐานราก|ตอม่อ|คานคอดิน|ชั้น\s*[12]/i.test(name)) {
          output.push(
            { name: 'งานโครงสร้างฐานราก คสล. และเสาตอม่อ', milestone_no: m, duration: 25, cost: Math.round(c * 0.28) },
            { name: 'งานคานคอดิน และพื้น คสล. ชั้น 1', milestone_no: m, duration: 25, cost: Math.round(c * 0.30) },
            { name: 'งานเสา คสล. ชั้น 1 และคาน-พื้น คสล. ชั้น 2', milestone_no: m, duration: 30, cost: Math.round(c * 0.27) },
            { name: 'งานเสา คสล. ชั้น 2 และคานรับหลังคา คสล.', milestone_no: m, duration: 20, cost: Math.round(c * 0.15) }
          )
          continue
        }

        // 2. งานโครงสร้างหลังคาและมุงหลังคา เหมารวม
        if ((/โครงสร้างหลังคา/i.test(name) && /มุงหลังคา/i.test(name)) || (/หลังคา/i.test(name) && /มุง/i.test(name))) {
          output.push(
            { name: 'งานติดตั้งโครงสร้างเหล็กหลังคา และทาสีกันสนิม', milestone_no: m, duration: 25, cost: Math.round(c * 0.55) },
            { name: 'งานมุงแผ่นหลังคา ติดตั้งฉนวนกันความร้อน และรางระบายน้ำฝน', milestone_no: m, duration: 20, cost: Math.round(c * 0.45) }
          )
          continue
        }

        // 3. งานก่ออิฐ ฉาบปูน ฝ้าเพดาน เหมารวม
        if ((/ก่ออิฐ/i.test(name) && /ฉาบปูน/i.test(name)) || (/ก่ออิฐ/i.test(name) && /ฝ้า/i.test(name))) {
          output.push(
            { name: 'งานก่ออิฐผนัง ติดตั้งเสาเอ็น-ทับหลัง และติดตั้งวงกบประตูหน้าต่าง', milestone_no: m, duration: 30, cost: Math.round(c * 0.45) },
            { name: 'งานเดินท่อร้อยสายไฟฟ้าและท่อประปาฝังผนัง (Rough-in)', milestone_no: m, duration: 20, cost: Math.round(c * 0.15) },
            { name: 'งานฉาบปูนผนังภายในและภายนอกอาคาร', milestone_no: m, duration: 25, cost: Math.round(c * 0.40) }
          )
          continue
        }

        // 4. งานตกแต่งพื้น ผนัง ประตูหน้าต่าง เหมารวม
        if ((/พื้น/i.test(name) && /ผนัง/i.test(name) && /ประตู/i.test(name)) || (/ปูกระเบื้อง/i.test(name) && /ประตู/i.test(name))) {
          output.push(
            { name: 'งานติดตั้งโครงคร่าวฝ้าเพดาน และกรุแผ่นยิปซัมบอร์ด/แผ่นฝ้าชายคา', milestone_no: m, duration: 20, cost: Math.round(c * 0.30) },
            { name: 'งานปูกระเบื้องพื้น ปูกระเบื้องผนังห้องน้ำ และบัวเชิงผนัง', milestone_no: m, duration: 25, cost: Math.round(c * 0.45) },
            { name: 'งานติดตั้งกรอบบานประตู-หน้าต่าง อลูมิเนียม และกระจก', milestone_no: m, duration: 20, cost: Math.round(c * 0.25) }
          )
          continue
        }

        // 5. งานทาสีและติดตั้งสุขภัณฑ์ เหมารวม
        if (/ทาสี/i.test(name) && /สุขภัณฑ์/i.test(name)) {
          output.push(
            { name: 'งานติดตั้งสุขภัณฑ์และอุปกรณ์ประกอบห้องน้ำ', milestone_no: m, duration: 20, cost: Math.round(c * 0.45) },
            { name: 'งานทาสีรองพื้นและทาสีน้ำอะคริลิกจริงภายใน-ภายนอก', milestone_no: m, duration: 25, cost: Math.round(c * 0.55) }
          )
          continue
        }

        // 6. งานระบบไฟฟ้าและสุขาภิบาล เหมารวม
        if (/ไฟฟ้า/i.test(name) && /สุขาภิบาล/i.test(name)) {
          output.push(
            { name: 'งานเดินท่อเมนประปา ท่อระบายน้ำทิ้ง และติดตั้งถังบำบัดน้ำเสีย', milestone_no: m, duration: 25, cost: Math.round(c * 0.35) },
            { name: 'งานเดินสายเมนไฟฟ้า ติดตั้งตู้ MDB, แผงย่อย และระบบส่องสว่าง/เต้ารับ', milestone_no: m, duration: 30, cost: Math.round(c * 0.50) },
            { name: 'งานระบบสายดิน (Grounding) และระบบป้องกันฟ้าผ่า', milestone_no: m, duration: 15, cost: Math.round(c * 0.15) }
          )
          continue
        }

        // 7. งานระบบสายสัญญาณและโทรศัพท์ (มักมาจากงวดเงิน 12% 2.9 ล้าน)
        if (/สายสัญญาณ.*โทรศัพท์|โทรคมนาคม/i.test(name)) {
          output.push(
            { name: 'งานติดตั้งดวงโคมไฟแสงสว่าง สวิตช์ เต้ารับ และอุปกรณ์ไฟฟ้าปลายทาง', milestone_no: m, duration: 25, cost: Math.round(c * 0.60) },
            { name: 'งานระบบสื่อสาร สายสัญญาณ LAN, โทรศัพท์ และระบบแจ้งเหตุเพลิงไหม้', milestone_no: m, duration: 15, cost: Math.min(350000, Math.round(c * 0.15)) },
            { name: 'งานติดตั้งระบบปรับอากาศและพัดลมระบายอากาศ (HVAC)', milestone_no: m, duration: 20, cost: Math.round(c * 0.25) }
          )
          continue
        }

        // 8. งานระบบสื่อสารและตกแต่งภายใน เหมารวม
        if (/สื่อสาร.*ตกแต่งภายใน/i.test(name)) {
          output.push(
            { name: 'งานตกแต่งภายใน เคาน์เตอร์บริการ บิลท์อิน และป้ายบอกทางอาคาร', milestone_no: m, duration: 25, cost: Math.round(c * 0.65) },
            { name: 'งานติดตั้งระบบกล้องวงจรปิด CCTV และระบบควบคุมการเข้า-ออก (Access Control)', milestone_no: m, duration: 20, cost: Math.round(c * 0.35) }
          )
          continue
        }

        // 9. งานถนน คสล. ระบบระบายน้ำ และภูมิทัศน์ เหมารวม
        if (/ถนน/i.test(name) && /ระบายน้ำ/i.test(name)) {
          output.push(
            { name: 'งานวางท่อระบายน้ำ คสล. บ่อพักน้ำฝน และบ่อดักไขมันภายนอก', milestone_no: m, duration: 25, cost: Math.round(c * 0.35) },
            { name: 'งานถนน คสล. คันหิน ทางเท้า และลานจอดรถ คสล.', milestone_no: m, duration: 30, cost: Math.round(c * 0.45) },
            { name: 'งานก่อสร้างรั้ว คสล. รอบโครงการ และประตูเลื่อนทางเข้า', milestone_no: m, duration: 20, cost: Math.round(c * 0.20) }
          )
          continue
        }

        // 10. งานเก็บรายละเอียด ทำความสะอาด และ As-built
        if (/เก็บรายละเอียด|ทำความสะอาด|as[- ]?built/i.test(name)) {
          output.push(
            { name: 'งานทดสอบระบบไฟฟ้า สุขาภิบาล และระบบความปลอดภัย (Commissioning)', milestone_no: m, duration: 10, cost: 70000 },
            { name: 'งานทำความสะอาดพื้นที่ เก็บรายละเอียด และจัดทำแบบ As-built Drawing', milestone_no: m, duration: 10, cost: 50000 }
          )
          continue
        }

        output.push({
          name,
          milestone_no: m,
          duration: dur,
          cost: c,
        })
      }

      return output
    }

    // รัน Decomposition
    let decomposedTasks = decomposeCoarseTasks(rawTasks)
    if (decomposedTasks.length < 15) {
      decomposedTasks = decomposeCoarseTasks(decomposedTasks)
    }

    // จัดเรียง WBS Number และเชื่อมโยง Predecessors ตามลำดับขั้นตอนวิศวกรรม CPM
    const milestoneMap = new Map<number, any[]>()
    decomposedTasks.forEach((t) => {
      const m = t.milestone_no || 1
      if (!milestoneMap.has(m)) milestoneMap.set(m, [])
      milestoneMap.get(m)!.push(t)
    })

    const sortedMilestones = Array.from(milestoneMap.keys()).sort((a, b) => a - b)
    let previousLastWbs: string | null = null
    const finalTasks: any[] = []

    for (const m of sortedMilestones) {
      const mTasks = milestoneMap.get(m)!
      mTasks.forEach((t, idx) => {
        const wbs = `${m}.${idx + 1}`
        const pred = idx === 0 ? previousLastWbs : `${m}.${idx}`
        finalTasks.push({
          wbs_no: wbs,
          name: t.name,
          milestone_no: m,
          duration: Math.max(7, Number(t.duration) || 20),
          cost: Math.max(0, Number(t.cost) || 0),
          predecessors: pred,
        })
      })
      if (mTasks.length > 0) {
        previousLastWbs = `${m}.${mTasks.length}`
      }
    }

    // 🛡️ ENGINEERING COST BALANCING & SCALING:
    // ล็อคเพดานงานย่อยเฉพาะทางให้สมเหตุสมผลตาม BOQ และเกลี่ยเงินส่วนที่เหลือให้งานโครงสร้าง/สถาปัตย์
    if (finalTasks.length > 0 && targetAmount > 0) {
      // 1. Lock fixed caps for small specialized trades
      finalTasks.forEach((t: any) => {
        const lowerName = t.name.toLowerCase()
        if (/as[- ]?built|ทำความสะอาด|เก็บรายละเอียด/i.test(lowerName)) {
          t.cost = Math.min(80000, t.cost || 50000)
        } else if (/commissioning|ทดสอบระบบ/i.test(lowerName)) {
          t.cost = Math.min(100000, t.cost || 70000)
        } else if (/สายสัญญาณ|โทรศัพท์|lan|network|โทรคมนาคม|สายนำสัญญาณ/i.test(lowerName)) {
          t.cost = Math.min(350000, t.cost || 300000)
        }
      })

      // 2. Scale remaining major tasks proportionally to hit targetAmount 100% exact
      const isFixedTrade = (name: string) => /as[- ]?built|ทำความสะอาด|เก็บรายละเอียด|commissioning|ทดสอบระบบ|สายสัญญาณ|โทรศัพท์/i.test(name)
      const fixedSum = finalTasks.filter((t: any) => isFixedTrade(t.name)).reduce((s: number, t: any) => s + t.cost, 0)
      const scalableTasks = finalTasks.filter((t: any) => !isFixedTrade(t.name))
      const scalableSum = scalableTasks.reduce((s: number, t: any) => s + t.cost, 0)

      if (scalableSum > 0) {
        const remainingTarget = targetAmount - fixedSum
        const scale = remainingTarget / scalableSum
        let running = fixedSum
        let maxIdx = 0
        let maxCost = 0

        scalableTasks.forEach((t: any, idx: number) => {
          t.cost = Math.round(t.cost * scale)
          running += t.cost
          if (t.cost > maxCost) {
            maxCost = t.cost
            maxIdx = idx
          }
        })

        const diff = targetAmount - running
        if (diff !== 0 && scalableTasks[maxIdx]) {
          scalableTasks[maxIdx].cost += diff
        }
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

