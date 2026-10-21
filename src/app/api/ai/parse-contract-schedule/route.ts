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
วิเคราะห์เอกสารโครงการที่ได้รับ (ชื่อโครงการ, BOQ/ปร.5, และตารางงวดงาน) เพื่อจัดทำแผนงาน WBS และตารางงวดงานที่ตรงกับลักษณะและประเภทโครงการจริง 100%:
- ชื่อโครงการ: "${projectName || 'โครงการก่อสร้าง'}"
- วงเงินสัญญารวม: ${targetAmount > 0 ? targetAmount.toLocaleString('th-TH') + ' บาท' : 'ตามเอกสาร'}
- ระยะเวลาก่อสร้างรวม: ${targetDays} วัน

======================================================================
🚨 กฎเหล็กการวิเคราะห์ประเภทโครงการตามจริง (DYNAMIC SCOPE & TYPOLOGY ADAPTATION):
======================================================================

1. 🎯 ตรวจจับประเภทโครงการและขอบเขตงานจริง (Project Typology Detection):
   ห้ามยึดติดกับเทมเพลตสำเร็จรูปอย่างเดียวเด็ดขาด! คุณต้องวิเคราะห์ประเภทโครงการจากชื่อโครงการและเอกสารที่ได้รับจริงเสมอ:
   - 🏢 กรณีเป็นอาคาร 1 ชั้น (หรืออาคารชั้นเดียว/โรงเก็บของ/ป้อมยาม):
     * ห้ามสร้างกิจกรรมชั้น 2 เด็ดขาด!
     * ให้แตกไล่ระดับเฉพาะ: ฐานราก/ตอม่อ -> คานคอดิน & พื้นชั้น 1 -> เสา คสล. และคานรับหลังคา คสล. -> โครงสร้างเหล็กหลังคา -> มุงหลังคา
   - 🏢 กรณีเป็นอาคาร 2 ชั้นขึ้นไป (เช่น อาคารสำนักงานและอาคารอยู่เวร):
     * แตกไล่ระดับตามชั้นจริง: ฐานราก/ตอม่อ -> คานคอดิน & พื้น 1 -> เสาชั้น 1 -> คานและพื้นชั้น 2 -> เสาชั้น 2/บน -> คานรับหลังคา -> โครงหลังคา
   - 🧱 กรณีเป็นโครงการเฉพาะงานรั้ว / กำแพงกันดิน / ประตูทางเข้า:
     * ห้ามสร้างกิจกรรมอาคารเด็ดขาด! ให้แตกตามขั้นตอนงานรั้วจริง:
       สำรวจแนวรั้ว -> เสาเข็มรั้ว -> ฐานรากและคานคอดินรั้ว -> เสารั้วและผนังแผงรั้ว/บล็อก คสล. -> ฉาบปูนและทาสีรั้ว -> ติดตั้งประตูรั้ว
   - 🛣️ กรณีเป็นโครงการเฉพาะงานถนน / ทางเท้า / ระบบระบายน้ำ:
     * ห้ามสร้างกิจกรรมอาคารเด็ดขาด! ให้แตกตามขั้นตอนงานทางจริง:
       ขุดดินปรับระดับและบดอัด -> วางท่อระบายน้ำ คสล. และบ่อพัก -> หินคลุกชั้นรองพื้นทาง (Subbase) -> ผูกเหล็กและเทคอนกรีตผิวทาง คสล. -> คันหินและทางเท้า
   - 🌳 กรณีเป็นโครงการเฉพาะงานภูมิทัศน์ / ผังบริเวณ / ลาน คสล.:
     * ปรับระดับดินเคลียร์พื้นที่ -> วางท่อระบายน้ำและท่อน้ำรดน้ำ -> เทพื้นลาน คสล. หรือบล็อกปูหญ้า -> ปลูกต้นไม้ ปูหญ้า และไฟฟ้าส่องสว่างภายนอก
   - 📑 กรณีมีเอกสาร BOQ / ปร.4 / ปร.5 / ปร.6 แนบมา:
     * ให้ยึดหมวดงานและรายการย่อยที่มีจริงในเอกสาร BOQ เป็นหลัก 100%! หมวดงานใดไม่มีใน BOQ ห้ามสร้างขึ้นมาเด็ดขาด!

2. 🚫 ห้ามแตกกิจกรรมเหมารวมหยาบๆ (NO COARSE TASKS):
   - ไม่ว่าจะเป็นโครงการประเภทใด ต้องแตกกิจกรรมย่อยตามลำดับขั้นตอนการทำงานจริง (Sequential Construction Hierarchy) เพื่อให้วิศวกรใช้ตรวจรับและคุมงานหน้างานได้จริง
   - แต่ละกิจกรรมต้องมีระยะเวลา (duration) ที่สมจริงตามขนาดงาน และมี predecessors เชื่อมโยงกันตามสายงานวิกฤต (CPM)

3. 💰 กฎการกำหนดมูลค่างาน (Cost Allocation from BOQ):
   - แยกขาดระหว่าง "เงินงวดสัญญา (Cash Disbursement)" กับ "ต้นทุนงานจริง (Task Cost from BOQ)"
   - ยอดเงินงวดสัญญาในตารางงวดงาน (milestone.amount) คือเงื่อนไขการเบิกเงินตามสัญญา (ซึ่งงวดแรกๆ มักถูกกดเงินไว้น้อย และจ่ายงวดหลังๆ เยอะ)
   - มูลค่างานกิจกรรม (task.cost) ต้องยึดตามราคาหมวดงานใน BOQ เท่านั้น ห้ามเอายอดเงินงวดหลายล้านมายัดใส่งานย่อยเด็ดขาด! (เช่น งานสายสัญญาณโทรศัพท์ใน BOQ มีราคา 2.5 - 3.5 แสน ก็ต้องได้เท่านั้น ห้ามกลายเป็น 2.9 ล้าน)
   - ผลรวมของ task.cost ทุกงานรวมกันทั้งโครงการ = ${targetAmount > 0 ? targetAmount : 'วงเงินสัญญารวม'} บาท (100%)
   - ผลรวมของ milestone.amount ทุกงวดรวมกันทั้งโครงการ = ${targetAmount > 0 ? targetAmount : 'วงเงินสัญญารวม'} บาท (100%)

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
      "name": "ชื่องานย่อยตามประเภทโครงการจริง...",
      "milestone_no": 1,
      "duration": 15,
      "cost": 350000,
      "predecessors": null
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

    // 🏗️ DYNAMIC CONTEXT-AWARE DECOMPOSITION ENGINE:
    // แตกกิจกรรมเฉพาะเมื่อพบชื่องานที่มีลักษณะเหมารวมหลายหมวดเข้าด้วยกัน (Compound Tasks)
    // โดยปรับตามลักษณะของโครงการจริง (เช่น อาคารชั้นเดียว, อาคารหลายชั้น, งานรั้ว, งานถนน)
    const decomposeCoarseTasks = (tasks: any[]) => {
      const output: any[] = []
      const contextCorpus = `${projectName || ''} ${boqText || ''} ${milestoneText || ''} ${tasks.map((t: any) => t.name || '').join(' ')}`.toLowerCase()

      const hasMultiStory = /ชั้น\s*[2-9]|2\s*ชั้น|สองชั้น|3\s*ชั้น|สามชั้น|multi[- ]?story/i.test(contextCorpus)
      const isExplicitOneStory = /ชั้นเดียว|1\s*ชั้น|โรงเก็บ|ป้อมยาม|โรงจอดรถ|โรงอาหาร|โกดัง|warehouse|ศาลา|บ้านพักชั้นเดียว/i.test(contextCorpus)
      const isOneStory = isExplicitOneStory || (!hasMultiStory && /ชั้นเดียว/i.test(contextCorpus))
      const isPureFence = /รั้ว|กำแพง/i.test(contextCorpus) && !/อาคาร|สำนักงาน|ตึก|บ้าน|โรง/i.test(contextCorpus)
      const isPureRoad = /ถนน|ผิวทาง|ทางหลวง|ผิวจราจร/i.test(contextCorpus) && !/อาคาร|สำนักงาน|ตึก|บ้าน/i.test(contextCorpus)

      for (const t of tasks) {
        const name = String(t.name || '').trim()
        const m = Number(t.milestone_no) || 1
        const c = Math.max(0, Number(t.cost) || 0)
        const dur = Math.max(1, Number(t.duration) || 20)

        // 1. งานโครงสร้าง คสล. เหมารวม (ตรวจจับชั้นเดียว vs หลายชั้น)
        if (/โครงสร้าง.*คสล/i.test(name) && !/ฐานราก|ตอม่อ|คานคอดิน|ชั้น\s*[12]/i.test(name)) {
          if (isOneStory) {
            output.push(
              { name: 'งานโครงสร้างฐานราก คสล. และเสาตอม่อ', milestone_no: m, duration: 25, cost: Math.round(c * 0.35) },
              { name: 'งานคานคอดิน และพื้น คสล. ชั้น 1', milestone_no: m, duration: 25, cost: Math.round(c * 0.35) },
              { name: 'งานเสา คสล. และคานรับหลังคา คสล.', milestone_no: m, duration: 20, cost: Math.round(c * 0.30) }
            )
          } else {
            output.push(
              { name: 'งานโครงสร้างฐานราก คสล. และเสาตอม่อ', milestone_no: m, duration: 25, cost: Math.round(c * 0.28) },
              { name: 'งานคานคอดิน และพื้น คสล. ชั้น 1', milestone_no: m, duration: 25, cost: Math.round(c * 0.30) },
              { name: 'งานเสา คสล. ชั้น 1 และคาน-พื้น คสล. ชั้น 2', milestone_no: m, duration: 30, cost: Math.round(c * 0.27) },
              { name: 'งานเสา คสล. ชั้น 2 และคานรับหลังคา คสล.', milestone_no: m, duration: 20, cost: Math.round(c * 0.15) }
            )
          }
          continue
        }

        // 2. งานรั้วและกำแพงเหมารวม
        if (/รั้ว|กำแพง/i.test(name) && !/ชั่วคราว/i.test(name) && dur >= 15 && !/ขุดดิน|ฐานราก|เสารั้ว|แผงรั้ว/i.test(name)) {
          output.push(
            { name: 'งานฐานราก เสาเข็ม และคานคอดินรั้ว คสล.', milestone_no: m, duration: Math.max(10, Math.round(dur * 0.35)), cost: Math.round(c * 0.40) },
            { name: 'งานเสารั้วและก่อผนังแผงรั้ว คสล.', milestone_no: m, duration: Math.max(10, Math.round(dur * 0.40)), cost: Math.round(c * 0.40) },
            { name: 'งานฉาบปูน ทาสีรั้ว และติดตั้งประตูเลื่อน', milestone_no: m, duration: Math.max(7, Math.round(dur * 0.25)), cost: Math.round(c * 0.20) }
          )
          continue
        }

        // 3. งานโครงสร้างหลังคาและมุงหลังคา เหมารวม
        if ((/โครงสร้างหลังคา/i.test(name) && /มุงหลังคา/i.test(name)) || (/หลังคา/i.test(name) && /มุง/i.test(name))) {
          output.push(
            { name: 'งานติดตั้งโครงสร้างเหล็กหลังคา และทาสีกันสนิม', milestone_no: m, duration: 25, cost: Math.round(c * 0.55) },
            { name: 'งานมุงแผ่นหลังคา ติดตั้งฉนวนกันความร้อน และรางระบายน้ำฝน', milestone_no: m, duration: 20, cost: Math.round(c * 0.45) }
          )
          continue
        }

        // 4. งานก่ออิฐ ฉาบปูน ฝ้าเพดาน เหมารวม
        if ((/ก่ออิฐ/i.test(name) && /ฉาบปูน/i.test(name)) || (/ก่ออิฐ/i.test(name) && /ฝ้า/i.test(name))) {
          output.push(
            { name: 'งานก่ออิฐผนัง ติดตั้งเสาเอ็น-ทับหลัง และติดตั้งวงกบประตูหน้าต่าง', milestone_no: m, duration: 30, cost: Math.round(c * 0.45) },
            { name: 'งานเดินท่อร้อยสายไฟฟ้าและท่อประปาฝังผนัง (Rough-in)', milestone_no: m, duration: 20, cost: Math.round(c * 0.15) },
            { name: 'งานฉาบปูนผนังภายในและภายนอกอาคาร', milestone_no: m, duration: 25, cost: Math.round(c * 0.40) }
          )
          continue
        }

        // 5. งานตกแต่งพื้น ผนัง ประตูหน้าต่าง เหมารวม
        if ((/พื้น/i.test(name) && /ผนัง/i.test(name) && /ประตู/i.test(name)) || (/ปูกระเบื้อง/i.test(name) && /ประตู/i.test(name))) {
          output.push(
            { name: 'งานติดตั้งโครงคร่าวฝ้าเพดาน และกรุแผ่นยิปซัมบอร์ด/แผ่นฝ้าชายคา', milestone_no: m, duration: 20, cost: Math.round(c * 0.30) },
            { name: 'งานปูกระเบื้องพื้น ปูกระเบื้องผนังห้องน้ำ และบัวเชิงผนัง', milestone_no: m, duration: 25, cost: Math.round(c * 0.45) },
            { name: 'งานติดตั้งกรอบบานประตู-หน้าต่าง อลูมิเนียม และกระจก', milestone_no: m, duration: 20, cost: Math.round(c * 0.25) }
          )
          continue
        }

        // 6. งานทาสีและติดตั้งสุขภัณฑ์ เหมารวม
        if (/ทาสี/i.test(name) && /สุขภัณฑ์/i.test(name)) {
          output.push(
            { name: 'งานติดตั้งสุขภัณฑ์และอุปกรณ์ประกอบห้องน้ำ', milestone_no: m, duration: 20, cost: Math.round(c * 0.45) },
            { name: 'งานทาสีรองพื้นและทาสีน้ำอะคริลิกจริงภายใน-ภายนอก', milestone_no: m, duration: 25, cost: Math.round(c * 0.55) }
          )
          continue
        }

        // 7. งานระบบไฟฟ้าและสุขาภิบาล เหมารวม
        if (/ไฟฟ้า/i.test(name) && /สุขาภิบาล/i.test(name)) {
          output.push(
            { name: 'งานเดินท่อเมนประปา ท่อระบายน้ำทิ้ง และติดตั้งถังบำบัดน้ำเสีย', milestone_no: m, duration: 25, cost: Math.round(c * 0.35) },
            { name: 'งานเดินสายเมนไฟฟ้า ติดตั้งตู้ MDB, แผงย่อย และระบบส่องสว่าง/เต้ารับ', milestone_no: m, duration: 30, cost: Math.round(c * 0.50) },
            { name: 'งานระบบสายดิน (Grounding) และระบบป้องกันฟ้าผ่า', milestone_no: m, duration: 15, cost: Math.round(c * 0.15) }
          )
          continue
        }

        // 8. งานระบบสายสัญญาณและโทรศัพท์ (เมื่อหลุดมาเป็นก้อนใหญ่)
        if (/สายสัญญาณ.*โทรศัพท์|โทรคมนาคม/i.test(name) && c > 1000000) {
          output.push(
            { name: 'งานติดตั้งดวงโคมไฟแสงสว่าง สวิตช์ เต้ารับ และอุปกรณ์ไฟฟ้าปลายทาง', milestone_no: m, duration: 25, cost: Math.round(c * 0.60) },
            { name: 'งานระบบสื่อสาร สายสัญญาณ LAN, โทรศัพท์ และระบบแจ้งเหตุเพลิงไหม้', milestone_no: m, duration: 15, cost: Math.min(350000, Math.round(c * 0.15)) },
            { name: 'งานติดตั้งระบบปรับอากาศและพัดลมระบายอากาศ (HVAC)', milestone_no: m, duration: 20, cost: Math.round(c * 0.25) }
          )
          continue
        }

        // 9. งานระบบสื่อสารและตกแต่งภายใน เหมารวม
        if (/สื่อสาร.*ตกแต่งภายใน/i.test(name)) {
          output.push(
            { name: 'งานตกแต่งภายใน เคาน์เตอร์บริการ บิลท์อิน และป้ายบอกทางอาคาร', milestone_no: m, duration: 25, cost: Math.round(c * 0.65) },
            { name: 'งานติดตั้งระบบกล้องวงจรปิด CCTV และระบบควบคุมการเข้า-ออก (Access Control)', milestone_no: m, duration: 20, cost: Math.round(c * 0.35) }
          )
          continue
        }

        // 10. งานถนน คสล. ระบบระบายน้ำ และภูมิทัศน์ เหมารวม
        if (/ถนน/i.test(name) && /ระบายน้ำ/i.test(name)) {
          output.push(
            { name: 'งานวางท่อระบายน้ำ คสล. บ่อพักน้ำฝน และบ่อดักไขมันภายนอก', milestone_no: m, duration: 25, cost: Math.round(c * 0.35) },
            { name: 'งานถนน คสล. คันหิน ทางเท้า และลานจอดรถ คสล.', milestone_no: m, duration: 30, cost: Math.round(c * 0.45) },
            { name: 'งานก่อสร้างรั้ว คสล. รอบโครงการ และประตูเลื่อนทางเข้า', milestone_no: m, duration: 20, cost: Math.round(c * 0.20) }
          )
          continue
        }

        // 11. งานภูมิทัศน์ ผังบริเวณ ลาน คสล. หรือจัดสวน เหมารวม
        if (/ภูมิทัศน์|จัดสวน|ลาน\s*คสล|ลานจอดรถ|ผังบริเวณ/i.test(name) && dur >= 15 && !/ปรับระดับ|ขุดดิน|ปูหญ้า/i.test(name)) {
          output.push(
            { name: 'งานปรับระดับดิน เคลียร์พื้นที่ และระบบระบายน้ำผังบริเวณ', milestone_no: m, duration: Math.max(10, Math.round(dur * 0.35)), cost: Math.round(c * 0.35) },
            { name: 'งานเทพื้นลาน คสล. บล็อกปูทางเดินเท้า และคันหิน', milestone_no: m, duration: Math.max(10, Math.round(dur * 0.40)), cost: Math.round(c * 0.45) },
            { name: 'งานปลูกต้นไม้ ไม้พุ่ม ปูหญ้า และไฟฟ้าส่องสว่างภูมิทัศน์', milestone_no: m, duration: Math.max(7, Math.round(dur * 0.25)), cost: Math.round(c * 0.20) }
          )
          continue
        }

        // 12. งานเก็บรายละเอียด ทำความสะอาด และ As-built
        if (/เก็บรายละเอียด|ทำความสะอาด|as[- ]?built/i.test(name) && c > 200000) {
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

