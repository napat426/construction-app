-- Create quick_links table if it does not exist
CREATE TABLE IF NOT EXISTS public.quick_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'link',
  url TEXT,
  content TEXT,
  category TEXT DEFAULT 'ทั่วไป',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure columns exist if table was partially created
ALTER TABLE public.quick_links
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'link',
  ADD COLUMN IF NOT EXISTS url TEXT,
  ADD COLUMN IF NOT EXISTS content TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'ทั่วไป',
  ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Disable Row Level Security (RLS) on quick_links table
ALTER TABLE public.quick_links DISABLE ROW LEVEL SECURITY;
