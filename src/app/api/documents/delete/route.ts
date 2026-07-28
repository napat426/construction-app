import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const { docId } = await req.json()
    if (!docId) {
      return NextResponse.json({ error: 'Missing document ID' }, { status: 400 })
    }

    // 1. Fetch document info to get file_url
    const { data: doc, error: fetchError } = await supabase
      .from('project_documents')
      .select('file_url, source_type')
      .eq('id', docId)
      .single()
      
    if (fetchError) throw fetchError

    // 2. Delete from storage if it was uploaded and still exists
    if (doc.source_type === 'upload' && doc.file_url) {
      // Extract the path from the URL, e.g. "https://.../project-docs/project_id/timestamp_hash.pdf"
      const storageKey = doc.file_url.split('/project-docs/')[1]
      if (storageKey) {
        await supabase.storage.from('project-docs').remove([storageKey])
      }
    }

    // 3. Delete from DB (this will cascade delete chunks)
    const { error: deleteError } = await supabase.from('project_documents').delete().eq('id', docId)
    if (deleteError) throw deleteError

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete document error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
