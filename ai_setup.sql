-- ==============================================================
-- AI Assistant Phase 1: Database Schema & Storage Setup
-- กรุณานำโค้ดนี้ไปรันใน Supabase SQL Editor
-- ==============================================================

-- 1. Create AI Conversations table
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  project_ids UUID[],
  question TEXT,
  answer TEXT,
  sources JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.ai_conversations DISABLE ROW LEVEL SECURITY;

-- 2. Create Project Documents table (for PDF Uploads)
CREATE TABLE IF NOT EXISTS public.project_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  doc_type TEXT,           -- e.g., 'spec_sheet'
  file_name TEXT,
  file_url TEXT,
  extracted_text TEXT,     -- for Phase 2 AI search
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.project_documents DISABLE ROW LEVEL SECURITY;

-- 3. Create System Settings table (for AI Toggle)
CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value JSONB
);
ALTER TABLE public.system_settings DISABLE ROW LEVEL SECURITY;

-- Set default AI enabled state
INSERT INTO public.system_settings (key, value)
VALUES ('ai_assistant_enabled', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 4. Create Storage Bucket for Project Docs (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-docs', 'project-docs', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies for project-docs (Public read, authenticated insert)
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING ( bucket_id = 'project-docs' );

CREATE POLICY "Auth Insert" 
ON storage.objects FOR INSERT 
WITH CHECK ( bucket_id = 'project-docs' AND auth.role() = 'authenticated' );

CREATE POLICY "Auth Update" 
ON storage.objects FOR UPDATE 
WITH CHECK ( bucket_id = 'project-docs' AND auth.role() = 'authenticated' );

CREATE POLICY "Auth Delete" 
ON storage.objects FOR DELETE 
USING ( bucket_id = 'project-docs' AND auth.role() = 'authenticated' );
