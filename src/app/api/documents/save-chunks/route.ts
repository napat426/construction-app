import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: Request) {
  try {
    const { docId, projectId, chunks, isComplete, pageCount, status } = await req.json()

    if (!docId || !projectId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    if (chunks && chunks.length > 0) {
      // Clean and format chunks for DB
      const formattedChunks = chunks.map((c: any) => ({
        document_id: docId,
        project_id: projectId,
        chunk_index: c.chunk_index,
        page_number: c.page_number,
        section_title: c.section_title || null,
        content: c.content,
        // embedding is left NULL for Phase 2A
      }))

      const { error: insertError } = await supabase.from('document_chunks').insert(formattedChunks)
      if (insertError) throw insertError
    }

    // Update progress
    const updateData: any = {}
    if (pageCount !== undefined) updateData.processed_pages = pageCount
    if (status) updateData.status = status

    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabase.from('project_documents').update(updateData).eq('id', docId)
      if (updateError) throw updateError
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Save chunks error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
