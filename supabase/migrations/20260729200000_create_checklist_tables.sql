-- Create checklist_masters table
CREATE TABLE IF NOT EXISTS public.checklist_masters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create project_checklist_results table
CREATE TABLE IF NOT EXISTS public.project_checklist_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  master_id UUID NOT NULL REFERENCES public.checklist_masters(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending', -- 'passed', 'failed', 'na', 'pending'
  note TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT project_master_unique UNIQUE (project_id, master_id)
);

-- Disable Row Level Security (RLS) on both tables
ALTER TABLE public.checklist_masters DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_checklist_results DISABLE ROW LEVEL SECURITY;
