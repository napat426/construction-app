CREATE TABLE IF NOT EXISTS public.contract_suspensions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  reason TEXT,                      -- เหตุผล (แก้ไขสัญญา/หยุดงานกรณีพิเศษ)
  suspend_date DATE NOT NULL,       -- วันที่สั่งหยุด
  resume_date DATE,                 -- วันที่กลับมาเริ่มงาน (ส่งมอบพื้นที่ครั้งที่ 2)
                                     -- NULL = ยังไม่กำหนด ยังหยุดอยู่ต่อเนื่อง
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.contract_suspensions DISABLE ROW LEVEL SECURITY;
