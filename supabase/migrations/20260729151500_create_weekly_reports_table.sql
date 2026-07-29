-- Create weekly_reports table if it does not exist
CREATE TABLE IF NOT EXISTS public.weekly_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  date_range TEXT NOT NULL,
  summary TEXT,
  delayed_tasks TEXT,
  look_ahead TEXT,
  snapshot JSONB DEFAULT '{}'::jsonb,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Disable Row Level Security (RLS) on weekly_reports table
ALTER TABLE public.weekly_reports DISABLE ROW LEVEL SECURITY;
