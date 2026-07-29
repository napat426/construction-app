'use server'

import { supabase } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'
import type { ChecklistMaster, ProjectChecklistResult, ChecklistStatus } from '@/lib/types'

const DEFAULT_MASTER_CHECKLIST = [
  // หมวดที่ 1: โครงสร้างและภายนอกอาคาร (Structure & Exterior)
  {
    category: 'หมวดที่ 1: โครงสร้างและภายนอกอาคาร (Structure & Exterior)',
    title: 'ดินรอบอาคาร',
    description: 'ดินต้องปรับระดับเรียบร้อย ไม่เป็นหลุมบ่อ ต้องไม่ต่ำกว่าแนวคานคอดินจนเห็นโพรงใต้ตัวอาคาร (ป้องกันสัตว์เลื้อยคลานและหนูเข้าไปทำรัง)',
    sort_order: 10,
  },
  {
    category: 'หมวดที่ 1: โครงสร้างและภายนอกอาคาร (Structure & Exterior)',
    title: 'ทางเดิน ลาน และถนน',
    description: 'ตรวจสอบการปรับระดับและความลาดเอียงของพื้น (เช่น ถนน คสล., บล็อคปูพื้น) น้ำต้องไม่ขังเป็นแอ่ง',
    sort_order: 20,
  },
  {
    category: 'หมวดที่ 1: โครงสร้างและภายนอกอาคาร (Structure & Exterior)',
    title: 'การระบายน้ำรอบอาคาร',
    description: 'บ่อพักน้ำรอบอาคารต้องไม่มีเศษปูนหรือขยะอุดตัน ลองฉีดน้ำลงไปทดสอบว่าน้ำไหลออกไปสู่บ่อสาธารณะได้ดี รางระบายน้ำมีความลาดเอียงเหมาะสม ฝาตะแกรงเหล็กปิดสนิทและแข็งแรง',
    sort_order: 30,
  },

  // หมวดที่ 2: งานหลังคาและฝ้าเพดาน (Roof & Ceiling)
  {
    category: 'หมวดที่ 2: งานหลังคาและฝ้าเพดาน (Roof & Ceiling)',
    title: 'รอยน้ำรั่ว',
    description: 'สังเกตฝ้าเพดานชั้นบนสุด หากมีคราบน้ำสีน้ำตาลอมเหลือง หรือมีรอยหยดน้ำ แปลว่าหลังคารั่วหรือมีการซึมจากรอยต่อแผ่นหลังคา/Flashing',
    sort_order: 40,
  },
  {
    category: 'หมวดที่ 2: งานหลังคาและฝ้าเพดาน (Roof & Ceiling)',
    title: 'ช่องเซอร์วิส',
    description: 'ลองเปิดช่องเซอร์วิส ตรวจสอบว่าสามารถปีนขึ้นไปซ่อมบำรุงได้จริง มีการปูฉนวนกันความร้อนเรียบร้อย และไม่มีเศษวัสดุก่อสร้างหมกไว้ใต้ฝ้า',
    sort_order: 50,
  },
  {
    category: 'หมวดที่ 2: งานหลังคาและฝ้าเพดาน (Roof & Ceiling)',
    title: 'ความเรียบเนียนของฝ้าเพดาน',
    description: 'รอยฉาบรอยต่อแผ่นยิปซั่มต้องเรียบเนียน ไม่เห็นเป็นคลื่นหรือรอยเส้นตรง ฝ้า T-Bar ต้องได้ระดับ ไม่แอ่นตก',
    sort_order: 60,
  },

  // หมวดที่ 3: งานพื้น ผนัง และสี (Flooring, Walls & Paint)
  {
    category: 'หมวดที่ 3: งานพื้น ผนัง และสี (Flooring, Walls & Paint)',
    title: 'งานกระเบื้อง',
    description: 'ใช้เหรียญ 10 หรือไม้เคาะกระเบื้อง "ทุกแผ่น" (แผ่นละ 5 จุด มุม 4 กลาง 1) เสียงต้องทึบแน่น หากเสียงโปร่งแปลว่าซาลาเปา (ปูนไม่เต็ม) ต้องรื้อปูใหม่',
    sort_order: 70,
  },
  {
    category: 'หมวดที่ 3: งานพื้น ผนัง และสี (Flooring, Walls & Paint)',
    title: 'ร่องยาแนว',
    description: 'ยาแนวต้องเต็มร่อง ไม่หลุดร่อน เลอะเทอะ และทำความสะอาดคราบปูนดำๆ ออกหมด',
    sort_order: 80,
  },
  {
    category: 'หมวดที่ 3: งานพื้น ผนัง และสี (Flooring, Walls & Paint)',
    title: 'พื้นไม้ / กระเบื้องยาง (SPC / ลามิเนต)',
    description: 'ลองเดินเหยียบด้วยเท้าเปล่าให้ทั่วห้อง พื้นต้องไม่ยวบ ยุบ หรือมีเสียงดังกรอบแกรบ',
    sort_order: 90,
  },
  {
    category: 'หมวดที่ 3: งานพื้น ผนัง และสี (Flooring, Walls & Paint)',
    title: 'บัวเชิงผนัง',
    description: 'รอยต่อระหว่างบัวกับผนังต้องยิงซิลิโคนปิดสนิท ไม่มีช่องโหว่ให้แมลงเข้า รอยต่อมุมห้องต้องเข้ามุมสนิท',
    sort_order: 100,
  },
  {
    category: 'หมวดที่ 3: งานพื้น ผนัง และสี (Flooring, Walls & Paint)',
    title: 'ความเรียบของผนัง',
    description: 'ปิดไฟในห้อง เอาไฟฉายส่องแนบขนานไปกับผนังเพื่อหารอยคลื่น รอยปูด หรือรอยเกรียงฉาบปูน',
    sort_order: 110,
  },
  {
    category: 'หมวดที่ 3: งานพื้น ผนัง และสี (Flooring, Walls & Paint)',
    title: 'รอยร้าว',
    description: 'รอยแตกลายงาเกิดจากปูนยืดหดตัว (แก้ด้วยสกิมโค้ท) แต่ถ้าเจอ "รอยร้าวเฉียง 45 องศา" ที่มุมวงกบ หรือรอยร้าวลึกทะลุผนัง ต้องเรียกวิศวกรมาตรวจสอบโครงสร้างทันที',
    sort_order: 120,
  },
  {
    category: 'หมวดที่ 3: งานพื้น ผนัง และสี (Flooring, Walls & Paint)',
    title: 'คุณภาพสี',
    description: 'สีต้องสม่ำเสมอ ไม่มีรอยด่าง รอยหยดสี สีลอกพอง หรือรอยแปรงทาสีเลอะไปโดนวงกบหน้าต่าง/บัวพื้น',
    sort_order: 130,
  },

  // หมวดที่ 4: ประตู หน้าต่าง และกระจก (Doors & Windows)
  {
    category: 'หมวดที่ 4: ประตู หน้าต่าง และกระจก (Doors & Windows)',
    title: 'การเปิด-ปิด',
    description: 'ต้องเปิดปิดได้ลื่นไหล ไม่ตกบาน ไม่เสียดสีกับพื้นหรือวงกบ ประตูที่เปิดแง้มทิ้งไว้ต้องไม่ไหลปิดหรือเปิดเอง (ถ้าไหลแปลว่าตั้งวงกบไม่ได้ดิ่ง)',
    sort_order: 140,
  },
  {
    category: 'หมวดที่ 4: ประตู หน้าต่าง และกระจก (Doors & Windows)',
    title: 'กระจกและโครงอลูมิเนียม',
    description: 'เอามือลูบกระจกหาตำหนิรอยขีดข่วน รอยบิ่นขอบ บานเลื่อนและบานสวิงต้องล็อคได้แน่นหนาทุกจุด',
    sort_order: 150,
  },
  {
    category: 'หมวดที่ 4: ประตู หน้าต่าง และกระจก (Doors & Windows)',
    title: 'การกันน้ำและซีลยาง',
    description: 'ยางกันกระแทกรอบบานต้องอยู่ในสภาพดี ไม่ฉีกขาด สังเกตซิลิโคนรอบกรอบหน้าต่างด้านนอกและด้านใน ต้องยิงต่อเนื่องไม่ขาดตอน (ลองเอาสายยางฉีดอัดขอบหน้าต่างจากด้านนอกเพื่อหาจุดรั่วซึม)',
    sort_order: 160,
  },

  // หมวดที่ 5: งานระบบไฟฟ้าและแสงสว่าง (Electrical & Lighting System)
  {
    category: 'หมวดที่ 5: งานระบบไฟฟ้าและแสงสว่าง (Electrical & Lighting System)',
    title: 'ตู้ควบคุมไฟหลัก (MDB) และตู้โหลด (Consumer Unit)',
    description: 'ติดตั้งแน่นหนา มีป้าย (Label) ระบุชัดเจนว่าเบรกเกอร์ตัวไหนคุมโซนไหน ตรวจสอบการร้อยสายไฟ (เช่น สาย THW) ในท่อเหล็ก (IMC/EMT) ว่าร้อยเก็บเรียบร้อย ไม่มีการเดินสายเปลือย',
    sort_order: 170,
  },
  {
    category: 'หมวดที่ 5: งานระบบไฟฟ้าและแสงสว่าง (Electrical & Lighting System)',
    title: 'ทดสอบระบบตัดไฟ (RCBO)',
    description: 'กดปุ่ม Test สีเหลืองหรือสีขาวที่ตัวเบรกเกอร์กันดูด ระบบต้องตัดไฟทันที (ถ้ากดแล้วไม่ตัด ห้ามรับงานเด็ดขาด)',
    sort_order: 180,
  },
  {
    category: 'หมวดที่ 5: งานระบบไฟฟ้าและแสงสว่าง (Electrical & Lighting System)',
    title: 'ทดสอบปลั๊กไฟ',
    description: 'ใช้ Socket Tester หรือที่ชาร์จมือถือเสียบปลั๊ก "ทุกรู" ในอาคารว่ามีไฟเข้า สาย L, N, G ต่อถูกต้อง ปลั๊กภายนอกอาคารต้องมีฝาครอบกันน้ำ สวิตช์และหน้ากากปลั๊กต้องแนบสนิทกับผนัง ไม่โยกคลอน',
    sort_order: 190,
  },
  {
    category: 'หมวดที่ 5: งานระบบไฟฟ้าและแสงสว่าง (Electrical & Lighting System)',
    title: 'แสงสว่าง',
    description: 'เปิดสวิตช์ไฟทุกดวงทิ้งไว้สักพัก สังเกตอาการกระพริบ ไฟเส้น LED Strip ต้องแสงสม่ำเสมอและซ่อนอะแดปเตอร์เรียบร้อย โคมไฟพิเศษ (เช่น โคมกันระเบิด) ต้องซีลแน่นหนา',
    sort_order: 200,
  },
  {
    category: 'หมวดที่ 5: งานระบบไฟฟ้าและแสงสว่าง (Electrical & Lighting System)',
    title: 'ระบบสำหรับผู้ทุพพลภาพ (ถ้ามี)',
    description: 'สวิตช์ฉุกเฉินในห้องน้ำ เมื่อกดแล้วต้องมีทั้งเสียงและแสงเตือนที่หน้าห้องทำงานทันที',
    sort_order: 210,
  },

  // หมวดที่ 6: งานประปา สุขาภิบาล และห้องน้ำ (Plumbing & Sanitary)
  {
    category: 'หมวดที่ 6: งานประปา สุขาภิบาล และห้องน้ำ (Plumbing & Sanitary)',
    title: 'การลาดเอียงของน้ำ (Slope)',
    description: 'เอาน้ำถังใหญ่ราดลงบนพื้นห้องน้ำและระเบียง น้ำต้องไหลลงตะแกรงน้ำทิ้ง (Floor Drain) จนหมดภายใน 10-15 นาที ต้องไม่มีแอ่งน้ำขัง',
    sort_order: 220,
  },
  {
    category: 'หมวดที่ 6: งานประปา สุขาภิบาล และห้องน้ำ (Plumbing & Sanitary)',
    title: 'ทดสอบท่อตันและรั่ว (ซิงค์/อ่างล้างหน้า)',
    description: 'ปิดสะดืออ่าง เปิดน้ำให้เต็ม แล้วปล่อยน้ำทิ้งรวดเดียวเพื่อเช็คท่อตัน จากนั้นนำ "ทิชชู่แห้ง" วางพันไว้ใต้ท่อ P-Trap (ท่อดักกลิ่นใต้อ่าง) หากทิชชู่เปียกแปลว่าซีลยางหรือเกลียวรั่ว',
    sort_order: 230,
  },
  {
    category: 'หมวดที่ 6: งานประปา สุขาภิบาล และห้องน้ำ (Plumbing & Sanitary)',
    title: 'ชักโครก',
    description: 'ปั้นทิชชู่ 1 กำมือโยนลงชักโครกแล้วกดฟลัช ทิชชู่ต้องถูกดูดลงไปรวดเดียว ไม่ตีกลับ ยาแนวขอบโถด้านล่างต้องเนียนรอบด้านเพื่อป้องกันกลิ่นและน้ำซึม',
    sort_order: 240,
  },
  {
    category: 'หมวดที่ 6: งานประปา สุขาภิบาล และห้องน้ำ (Plumbing & Sanitary)',
    title: 'ระบบปั๊มน้ำ (Water Pump / Booster Pump)',
    description: 'ลองเปิดน้ำพร้อมกันหลายๆ ก๊อก ปั๊มต้องทำงานสม่ำเสมอ เสียงไม่ดังผิดปกติ เมื่อปิดน้ำทุกจุดในอาคาร ปั๊มต้องหยุดทำงานสนิท (หากปั๊มทำงานขึ้นมาเองเป็นจังหวะ แสดงว่ามีท่อรั่วหรือชักโครกซึม)',
    sort_order: 250,
  },
  {
    category: 'หมวดที่ 6: งานประปา สุขาภิบาล และห้องน้ำ (Plumbing & Sanitary)',
    title: 'ถังเก็บน้ำ',
    description: 'ตรวจสอบลูกลอยในถังเก็บน้ำใต้ดินและบนดาดฟ้า ว่าทำงานและตัดน้ำได้สนิทเมื่อน้ำเต็มถัง',
    sort_order: 260,
  },
  {
    category: 'หมวดที่ 6: งานประปา สุขาภิบาล และห้องน้ำ (Plumbing & Sanitary)',
    title: 'ระบบบำบัดน้ำเสีย',
    description: 'ตรวจสอบปั๊มเติมอากาศ (Blower) ในถังบำบัดแบบเติมอากาศว่าทำงานปกติ ถังดักไขมันไม่รั่วซึม และทดสอบสวิตช์ลูกลอยในบ่อพักน้ำเสียว่าสั่งเครื่องสูบน้ำทำงานสลับกันได้ตามระบบ',
    sort_order: 270,
  },

  // หมวดที่ 7: งานระบบปรับอากาศและระบายอากาศ (HVAC System)
  {
    category: 'หมวดที่ 7: งานระบบปรับอากาศและระบายอากาศ (HVAC System)',
    title: 'เครื่องปรับอากาศ',
    description: 'เปิดแอร์ทุกเครื่องทิ้งไว้อย่างน้อย 1 ชั่วโมงเพื่อเช็คความเย็นและความเงียบ',
    sort_order: 280,
  },
  {
    category: 'หมวดที่ 7: งานระบบปรับอากาศและระบายอากาศ (HVAC System)',
    title: 'ท่อน้ำทิ้งและท่อน้ำยา',
    description: 'ตรวจสอบท่อน้ำทิ้งแอร์ว่าน้ำไหลออกลื่นไหล ไม่หยดหรือย้อนกลับเข้าไปในตัวเครื่องคอยล์เย็น',
    sort_order: 290,
  },
  {
    category: 'หมวดที่ 7: งานระบบปรับอากาศและระบายอากาศ (HVAC System)',
    title: 'คอยล์ร้อน (Compressor)',
    description: 'ติดตั้งภายนอกบนขายางลดแรงสั่นสะเทือนแน่นหนา การเก็บสายไฟและท่อน้ำยาเรียบร้อย',
    sort_order: 300,
  },
  {
    category: 'หมวดที่ 7: งานระบบปรับอากาศและระบายอากาศ (HVAC System)',
    title: 'พัดลมระบายอากาศ',
    description: 'ทดสอบแรงดูดของพัดลมระบายอากาศในห้องน้ำ/ห้องครัว หากมีระบบตั้งเวลา (Time Switch) หรือ Magnetic Contactor ให้ทดสอบว่าสั่งเปิด-ปิดตามเวลาได้จริง',
    sort_order: 310,
  },

  // หมวดที่ 8: งานระบบความปลอดภัยและแจ้งเหตุ (Security & Fire Alarm)
  {
    category: 'หมวดที่ 8: งานระบบความปลอดภัยและแจ้งเหตุ (Security & Fire Alarm)',
    title: 'กล้องวงจรปิด (IP CCTV)',
    description: 'ตรวจสอบภาพบนจอมอนิเตอร์ ภาพจากกล้องทุกตัวต้องคมชัด มุมกล้องไม่โดนบัง ลองกดดูภาพย้อนหลังในเครื่องบันทึก (NVR) ทดสอบดึงปลั๊กไฟหลักออกเพื่อเช็คว่า UPS สำรองไฟให้กล้องทำงานต่อได้หรือไม่',
    sort_order: 320,
  },
  {
    category: 'หมวดที่ 8: งานระบบความปลอดภัยและแจ้งเหตุ (Security & Fire Alarm)',
    title: 'ระบบแจ้งเหตุเพลิงไหม้ (Fire Alarm)',
    description: 'ตู้คอนโทรลต้องไม่แสดงสถานะ Fault, จำลองเหตุการณ์โดยใช้สเปรย์ควันเทียมพ่นที่ Smoke Detector และเครื่องเป่าลมร้อนเทสต์ Heat Detector, ลองดึงสวิตช์แจ้งเหตุด้วยมือ (Manual Pull Station), กระดิ่งเตือนภัย (Alarm Bell) ต้องดังครอบคลุมพื้นที่ และหน้าตู้คอนโทรลต้องแสดงโซนที่เกิดเหตุถูกต้อง',
    sort_order: 330,
  },

  // หมวดที่ 9: งานระบบสื่อสาร สายสัญญาณ และเครือข่าย (IT & Communication)
  {
    category: 'หมวดที่ 9: งานระบบสื่อสาร สายสัญญาณ และเครือข่าย (IT & Communication)',
    title: 'ห้อง Server / ตู้ Rack',
    description: 'ตรวจสอบพัดลมระบายอากาศของตู้และระบบปลั๊กไฟตู้ให้พร้อมใช้งาน',
    sort_order: 340,
  },
  {
    category: 'หมวดที่ 9: งานระบบสื่อสาร สายสัญญาณ และเครือข่าย (IT & Communication)',
    title: 'ระบบสาย LAN (UTP Cat6) / Fiber Optic',
    description: 'ให้ช่างใช้เครื่องเทสต์สาย (เช่น Fluke Test) ทดสอบเต้ารับ LAN ทุกจุดว่าสัญญาณมาเต็มสปีด ตรวจสอบ Patch Panel ว่าจัดสายเรียบร้อยและมีป้ายกำกับหมายเลขตรงกับจุดใช้งาน',
    sort_order: 350,
  },
  {
    category: 'หมวดที่ 9: งานระบบสื่อสาร สายสัญญาณ และเครือข่าย (IT & Communication)',
    title: 'ระบบโทรศัพท์ตู้สาขา (IP-PABX)',
    description: 'ทดสอบโทรหากันระหว่างเครื่อง (Intercom) และโทรออกภายนอก เสียงต้องชัด หากมีระบบ Redundant (ตู้สำรอง) ให้ช่างจำลองตู้หลักดับ เพื่อดูว่าตู้สำรองทำงานแทนได้ทันที',
    sort_order: 360,
  },
  {
    category: 'หมวดที่ 9: งานระบบสื่อสาร สายสัญญาณ และเครือข่าย (IT & Communication)',
    title: 'ระบบเสียงตามสาย (Public Address)',
    description: 'ทดสอบพูดผ่านไมโครโฟนและเปิดเครื่องเล่นสื่อ ลำโพงต้องดังครบทุกจุด เสียงไม่แตก ไม่มีเสียงหอน (Feedback) หรือเสียงคลื่นแทรก และตัวหมุนปรับระดับเสียง (Volume Control) ตามจุดต่างๆ ต้องใช้งานได้จริง',
    sort_order: 370,
  },
]

// Initialize Master Items if table is empty
async function ensureMasterChecklistData() {
  const { data, error } = await supabase.from('checklist_masters').select('id').limit(1)
  if (!error && data && data.length === 0) {
    console.log('Seeding Master Checklist items...')
    await supabase.from('checklist_masters').insert(DEFAULT_MASTER_CHECKLIST)
  }
}

// Fetch all Master Checklist items
export async function getChecklistMasters(): Promise<ChecklistMaster[]> {
  try {
    await ensureMasterChecklistData()
    const { data, error } = await supabase
      .from('checklist_masters')
      .select('*')
      .order('sort_order', { ascending: true })

    if (error) {
      console.error('Error fetching master checklist:', error)
      return []
    }
    return (data as ChecklistMaster[]) || []
  } catch (err) {
    console.error('Exception fetching master checklist:', err)
    return []
  }
}

// Fetch Project Inspection Results
export async function getProjectChecklistResults(projectId: string): Promise<ProjectChecklistResult[]> {
  try {
    const { data, error } = await supabase
      .from('project_checklist_results')
      .select('*')
      .eq('project_id', projectId)

    if (error) {
      console.error('Error fetching project checklist results:', error)
      return []
    }
    return (data as ProjectChecklistResult[]) || []
  } catch (err) {
    console.error('Exception fetching project checklist results:', err)
    return []
  }
}

// Update or Upsert Inspection Result for a specific item in a project
export async function updateChecklistResult(
  projectId: string,
  masterId: string,
  status: ChecklistStatus,
  note?: string | null
) {
  try {
    const { error } = await supabase
      .from('project_checklist_results')
      .upsert(
        {
          project_id: projectId,
          master_id: masterId,
          status,
          note: note ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'project_id,master_id' }
      )

    if (error) {
      console.error('Error updating checklist result:', error)
      return { error: error.message }
    }

    revalidatePath(`/projects/${projectId}/checklist`)
    return { success: true }
  } catch (err: any) {
    return { error: err.message || 'Unknown error' }
  }
}

// Admin: Add Master Item
export async function addMasterChecklist(payload: {
  category: string
  title: string
  description?: string | null
}) {
  try {
    const { data: maxOrderData } = await supabase
      .from('checklist_masters')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)

    const nextOrder = (maxOrderData?.[0]?.sort_order || 0) + 10

    const { data, error } = await supabase
      .from('checklist_masters')
      .insert({
        category: payload.category,
        title: payload.title,
        description: payload.description || null,
        sort_order: nextOrder,
      })
      .select()
      .single()

    if (error) return { error: error.message }
    revalidatePath('/projects')
    return { success: true, data: data as ChecklistMaster }
  } catch (err: any) {
    return { error: err.message || 'Unknown error' }
  }
}

// Admin: Edit Master Item
export async function editMasterChecklist(
  id: string,
  payload: {
    category: string
    title: string
    description?: string | null
  }
) {
  try {
    const { error } = await supabase
      .from('checklist_masters')
      .update({
        category: payload.category,
        title: payload.title,
        description: payload.description || null,
      })
      .eq('id', id)

    if (error) return { error: error.message }
    revalidatePath('/projects')
    return { success: true }
  } catch (err: any) {
    return { error: err.message || 'Unknown error' }
  }
}

// Admin: Delete Master Item
export async function deleteMasterChecklist(id: string) {
  try {
    const { error } = await supabase.from('checklist_masters').delete().eq('id', id)
    if (error) return { error: error.message }
    revalidatePath('/projects')
    return { success: true }
  } catch (err: any) {
    return { error: err.message || 'Unknown error' }
  }
}
