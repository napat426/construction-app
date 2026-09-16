-- Create Global Activity Logs (Audit Trail) Table
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  project_name TEXT,
  module_type TEXT NOT NULL DEFAULT 'project', -- 'project' | 'presentation' | 'ai_chat' | 'system'
  user_id UUID,
  user_name TEXT NOT NULL,
  user_role TEXT NOT NULL DEFAULT 'editor',
  action_type TEXT NOT NULL, -- 'CREATE' | 'UPDATE' | 'DELETE' | 'CONFIRM' | 'APPROVE' | 'REJECT' | 'AI_ANALYZE' | 'AI_CHAT'
  entity_type TEXT NOT NULL, -- 'daily_report' | 'weekly_report' | 'material' | 'wbs_task' | 'inspection' | 'punchlist' | 'presentation' | 'ai_chat' | 'system'
  entity_id TEXT,
  entity_title TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Disable RLS for application-level access control
ALTER TABLE public.activity_logs DISABLE ROW LEVEL SECURITY;

-- Indexes for high-performance querying
CREATE INDEX IF NOT EXISTS idx_activity_logs_project_id ON public.activity_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_module_type ON public.activity_logs(module_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
