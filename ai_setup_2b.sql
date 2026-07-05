-- ==============================================================
-- AI Assistant Phase 2B-1: OCR + Embedding setup
-- ==============================================================

-- 1. เพิ่มคอลัมน์สำหรับการกันประมวลผลซ้ำใน project_documents
ALTER TABLE public.project_documents
  ADD COLUMN IF NOT EXISTS file_hash TEXT,
  ADD COLUMN IF NOT EXISTS total_pages INTEGER DEFAULT 0;

-- 2. เพิ่มคอลัมน์ใน document_chunks เพื่อบันทึกวิธี OCR และคุณภาพ
ALTER TABLE public.document_chunks
  ADD COLUMN IF NOT EXISTS extract_method TEXT,
  ADD COLUMN IF NOT EXISTS ocr_confidence TEXT;

-- 3. เปลี่ยนขนาด Vector เป็น 768 สำหรับ Gemini text-embedding-004
-- เนื่องจากอาจมี index เก่าที่ใช้ 1536 อยู่ ต้องลบ index ก่อน
DROP INDEX IF EXISTS public.document_chunks_embedding_idx;

-- เคลียร์ข้อมูลเก่าก่อนแปลง type เพื่อไม่ให้ติดปัญหา (เพราะ dimension เปลี่ยน)
DELETE FROM public.document_chunks;

ALTER TABLE public.document_chunks 
  ALTER COLUMN embedding TYPE vector(768);

-- สร้าง index ใหม่
CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx 
  ON public.document_chunks 
  USING ivfflat (embedding vector_cosine_ops) 
  WITH (lists = 100);

-- 4. สร้างตาราง Cache สำหรับผลลัพธ์คำค้นหาของ Embedding
CREATE TABLE IF NOT EXISTS public.embedding_cache (
  query_text TEXT PRIMARY KEY,
  embedding vector(768),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.embedding_cache DISABLE ROW LEVEL SECURITY;

-- 5. สร้างฟังก์ชันค้นหา Semantic Search แบบ Cosine Similarity
CREATE OR REPLACE FUNCTION match_document_chunks (
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  p_project_id uuid
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  chunk_index int,
  page_number int,
  section_title text,
  content text,
  extract_method text,
  ocr_confidence text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.chunk_index,
    dc.page_number,
    dc.section_title,
    dc.content,
    dc.extract_method,
    dc.ocr_confidence,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM document_chunks dc
  -- Join กับ project_documents เพื่อดู scope
  JOIN project_documents pd ON dc.document_id = pd.id
  WHERE (pd.scope = 'global' OR pd.project_id = p_project_id)
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
