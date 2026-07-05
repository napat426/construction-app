-- ==============================================================
-- AI Assistant Phase 2A: Semantic Search Setup
-- ==============================================================

-- 1. Enable Vector Extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Add new columns to project_documents
ALTER TABLE public.project_documents
  ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'upload',
  ADD COLUMN IF NOT EXISTS external_url TEXT,
  ADD COLUMN IF NOT EXISTS page_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS processed_pages INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS keep_original BOOLEAN DEFAULT false;

-- 3. Create document_chunks table
CREATE TABLE IF NOT EXISTS public.document_chunks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID REFERENCES public.project_documents(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  chunk_index INTEGER,
  page_number INTEGER,
  section_title TEXT,
  content TEXT,
  embedding vector(1536),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.document_chunks DISABLE ROW LEVEL SECURITY;

-- 4. Create index for fast vector search (will be useful in Phase 2B)
CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx ON public.document_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
