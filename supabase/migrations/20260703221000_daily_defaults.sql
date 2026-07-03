-- Create project_daily_defaults table
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

-- Disable Row Level Security (RLS) on defaults table
ALTER TABLE public.project_daily_defaults DISABLE ROW LEVEL SECURITY;

-- Add new daily reports columns
ALTER TABLE public.daily_reports
  ADD COLUMN IF NOT EXISTS is_auto_generated BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_confirmed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS temperature NUMERIC(4,1),
  ADD COLUMN IF NOT EXISTS precipitation NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS weather_code INTEGER;
