import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: Request) {
  try {
    const { docId } = await req.json()
    if (!docId) {
      return NextResponse.json({ error: 'Missing document ID' }, { status: 400 })
    }

    // 1. Fetch document info to get file name
    const { data: doc, error: fetchError } = await supabase
      .from('project_documents')
      .select('file_name, source_type')
      .eq('id', docId)
      .single()
      
    if (fetchError) throw fetchError

    // 2. Delete from storage if it was uploaded and still exists
    if (doc.source_type === 'upload' && doc.file_name) {
      // It might not exist if keep_original was false, but we try anyway
      await supabase.storage.from('project-docs').remove([doc.file_name])
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
