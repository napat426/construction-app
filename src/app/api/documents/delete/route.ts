import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/auditLogger'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const { docId } = await req.json()
    if (!docId) {
      return NextResponse.json({ error: 'Missing document ID' }, { status: 400 })
    }

    // 1. Fetch document info to get file_url and name
    const { data: doc, error: fetchError } = await supabase
      .from('project_documents')
      .select('file_name, file_url, source_type, project_id')
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

    await logActivity({
      projectId: doc.project_id || undefined,
      actionType: 'DELETE',
      entityType: 'document',
      entityId: docId,
      entityTitle: `ลบเอกสารสัญญา: ${doc.file_name}`,
      details: { fileName: doc.file_name },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete document error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

