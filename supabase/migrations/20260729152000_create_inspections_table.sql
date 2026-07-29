-- Create inspections table if it does not exist
CREATE TABLE IF NOT EXISTS public.inspections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  inspection_no TEXT,
  work_type TEXT,
  title TEXT,
  request_date DATE,
  inspector TEXT,
  status TEXT DEFAULT 'submitted',
  note TEXT,
  photo_urls JSONB DEFAULT '[]'::jsonb,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure columns exist if table was partially created
ALTER TABLE public.inspections
  ADD COLUMN IF NOT EXISTS inspection_no TEXT,
  ADD COLUMN IF NOT EXISTS work_type TEXT,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS request_date DATE,
  ADD COLUMN IF NOT EXISTS inspector TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'submitted',
  ADD COLUMN IF NOT EXISTS note TEXT,
  ADD COLUMN IF NOT EXISTS photo_urls JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Disable Row Level Security (RLS) on inspections table
ALTER TABLE public.inspections DISABLE ROW LEVEL SECURITY;
