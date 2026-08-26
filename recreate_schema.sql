-- เปิดใช้งาน Extensions ที่จำเป็น
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- 1. ตาราง projects (โครงการ)
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  location TEXT,
  supervisor TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ออกแบบ สำรวจ ประมาณการ',
  budget NUMERIC,
  start_date DATE,
  end_date DATE,
  progress NUMERIC DEFAULT 0,
  planned_progress NUMERIC DEFAULT 0,
  paid_amount NUMERIC DEFAULT 0,
  penalty_rate NUMERIC DEFAULT 0,
  inspection_committee TEXT,
  contractor TEXT,
  contract_no TEXT,
  work_group TEXT,
  wbs_no TEXT,
  opening_pr NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ตาราง tasks (แผนงาน WBS)
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  wbs_no TEXT NOT NULL,
  name TEXT NOT NULL,
  cost NUMERIC DEFAULT 0,
  start_date DATE NOT NULL,
  duration INTEGER NOT NULL,
  predecessors TEXT,
  actual_progress NUMERIC DEFAULT 0,
  is_milestone BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ตาราง project_payments (การจ่ายเงินงวดสะสม)
CREATE TABLE IF NOT EXISTS public.project_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL,
  amount NUMERIC NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ตาราง project_milestones (งวดงานสัญญา)
CREATE TABLE IF NOT EXISTS public.project_milestones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  milestone_no INTEGER NOT NULL,
  name TEXT NOT NULL,
  work_scope TEXT,
  amount NUMERIC DEFAULT 0,
  is_paid BOOLEAN DEFAULT FALSE,
  payment_date DATE,
  expected_payment_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. ตาราง contract_amendments (การแก้ไขสัญญาและหยุดงาน)
CREATE TABLE IF NOT EXISTS public.contract_amendments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  amendment_no INTEGER NOT NULL,
  amendment_type TEXT NOT NULL, -- suspend_with_resume, suspend_open, direct
  suspend_date DATE,
  resume_date DATE,
  extra_days INTEGER DEFAULT 0,
  reason TEXT NOT NULL,
  amendment_date DATE NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. ตาราง daily_reports (รายงานประจำวัน)
CREATE TABLE IF NOT EXISTS public.daily_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  report_date DATE NOT NULL,
  weather TEXT,
  temperature NUMERIC,
  precipitation NUMERIC,
  weather_code INTEGER,
  manpower JSONB DEFAULT '[]',
  machinery JSONB DEFAULT '[]',
  work_done TEXT,
  issues TEXT,
  photos JSONB DEFAULT '[]',
  sort_order INTEGER DEFAULT 0,
  is_auto_generated BOOLEAN DEFAULT FALSE,
  is_confirmed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. ตาราง project_daily_defaults (ค่าเริ่มต้นรายวัน)
CREATE TABLE IF NOT EXISTS public.project_daily_defaults (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE UNIQUE,
  latitude NUMERIC(9,6),
  longitude NUMERIC(9,6),
  location_name TEXT,
  manpower_defaults JSONB DEFAULT '[]',
  machinery_defaults JSONB DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. ตาราง punch_lists (รายการตรวจรับงาน)
CREATE TABLE IF NOT EXISTS public.punch_lists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  pl_number TEXT NOT NULL,
  title TEXT NOT NULL,
  issued_by TEXT NOT NULL,
  issued_to TEXT NOT NULL,
  due_date DATE,
  status TEXT DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. ตาราง punch_items (รายการจุดบกพร่องในงานตรวจรับ)
CREATE TABLE IF NOT EXISTS public.punch_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  punch_list_id UUID NOT NULL REFERENCES public.punch_lists(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL,
  location TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  photos JSONB DEFAULT '[]',
  assignee TEXT,
  due_date DATE,
  status TEXT DEFAULT 'open',
  closed_date DATE,
  remark TEXT,
  contractor_response TEXT,
  response_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. ตาราง system_settings (การตั้งค่าระบบ)
CREATE TABLE IF NOT EXISTS public.system_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. ตาราง ai_conversations (ประวัติการคุย AI)
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  project_ids JSONB DEFAULT '[]',
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  sources JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. ตาราง project_documents (เอกสารของโครงการ)
CREATE TABLE IF NOT EXISTS public.project_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  extracted_text TEXT,
  source_type TEXT,
  external_url TEXT,
  page_count INTEGER,
  processed_pages INTEGER,
  status TEXT,
  keep_original BOOLEAN DEFAULT TRUE,
  scope TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. ตาราง document_chunks (ข้อมูลแยกย่อยจากเอกสารสัญญาเพื่อใช้ค้นหา RAG)
CREATE TABLE IF NOT EXISTS public.document_chunks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.project_documents(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  page_number INTEGER NOT NULL,
  section_title TEXT,
  content TEXT NOT NULL,
  embedding vector(768),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. ตาราง embedding_cache (แคชข้อมูลเวกเตอร์)
CREATE TABLE IF NOT EXISTS public.embedding_cache (
  id BIGSERIAL PRIMARY KEY,
  text_hash TEXT UNIQUE NOT NULL,
  embedding vector(768) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ปิดใช้งาน RLS สำหรับความสะดวกในการสาธิต
ALTER TABLE public.projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_milestones DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_amendments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_daily_defaults DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.punch_lists DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.punch_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_chunks DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.embedding_cache DISABLE ROW LEVEL SECURITY;

-- เพิ่มค่าตั้งต้นเริ่มต้นของระบบ
INSERT INTO public.system_settings (key, value) VALUES 
  ('ai_assistant_enabled', 'true'),
  ('ai_ocr_enabled', 'true'),
  ('work_groups', '["งานงบลงทุนเร่งด่วน", "งานแผนสนับสนุน"]')
ON CONFLICT (key) DO NOTHING;
C R E A T E   T A B L E   I F   N O T   E X I S T S   p u b l i c . m a t e r i a l s   ( 
     i d   U U I D   D E F A U L T   g e n _ r a n d o m _ u u i d ( )   P R I M A R Y   K E Y , 
     p r o j e c t _ i d   U U I D   N O T   N U L L   R E F E R E N C E S   p u b l i c . p r o j e c t s ( i d )   O N   D E L E T E   C A S C A D E , 
     n a m e   T E X T   N O T   N U L L , 
     s u b m i s s i o n _ n o   T E X T , 
     s u b m i t t e d _ d a t e   D A T E , 
     a p p r o v e d _ d a t e   D A T E , 
     s t a t u s   T E X T   N O T   N U L L   D E F A U L T   ' p e n d i n g ' , 
     n o t e   T E X T , 
     c r e a t e d _ a t   T I M E S T A M P   W I T H   T I M E   Z O N E   D E F A U L T   t i m e z o n e ( ' u t c ' : : t e x t ,   n o w ( ) )   N O T   N U L L 
 ) ; 
 
 A L T E R   T A B L E   p u b l i c . m a t e r i a l s   E N A B L E   R O W   L E V E L   S E C U R I T Y ; 
 
 C R E A T E   P O L I C Y   " A l l o w   a l l   o n   m a t e r i a l s   f o r   a u t h e n t i c a t e d   u s e r s " 
     O N   p u b l i c . m a t e r i a l s   F O R   A L L 
     T O   a u t h e n t i c a t e d   U S I N G   ( t r u e )   W I T H   C H E C K   ( t r u e ) ; 
 
 C R E A T E   P O L I C Y   " A l l o w   r e a d   o n   m a t e r i a l s   f o r   p u b l i c " 
     O N   p u b l i c . m a t e r i a l s   F O R   S E L E C T 
     T O   p u b l i c   U S I N G   ( t r u e ) ;  
 