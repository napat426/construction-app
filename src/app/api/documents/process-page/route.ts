import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Use a service role key if available, otherwise anon key
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '')

export async function POST(req: Request) {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return NextResponse.json({ error: 'Gemini API key is not configured' }, { status: 500 })
  }

  try {
    const body = await req.json()
    const { documentId, projectId, pageNumber, text, imageBase64 } = body

    if (!documentId || !pageNumber) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    let pageText = text || ''
    let extractMethod = text ? 'text_layer' : 'gemini_ocr'
    let ocrConfidence = 'high'

    // 1. OCR with Gemini Vision if no text provided
    if (!pageText && imageBase64) {
      try {
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
        const base64Data = imageBase64.replace(/^data:image\/(png|jpeg|jpg);base64,/, '')
        const prompt = "Please extract all text and tables from this image accurately. Preserve the reading order and structure. If there is Thai text, please extract it correctly."
        
        const result = await model.generateContent([
          prompt,
          { inlineData: { data: base64Data, mimeType: 'image/jpeg' } }
        ])
        
        pageText = result.response.text()
        if (!pageText || pageText.trim() === '') {
          ocrConfidence = 'low'
          pageText = '[No readable text found on this page]'
        }
      } catch (ocrErr: any) {
        console.error('OCR Error:', ocrErr)
        // If rate limit error
        if (ocrErr.status === 429) {
          return NextResponse.json({ error: 'Rate limit exceeded for Gemini OCR', retryAfter: 5 }, { status: 429 })
        }
        return NextResponse.json({ error: 'OCR failed: ' + ocrErr.message }, { status: 500 })
      }
    }

    if (!pageText.trim()) {
      return NextResponse.json({ success: true, message: 'Empty page skipped' })
    }

    // 2. Chunking (~500 words per chunk)
    // Simple approach: split by double newline (paragraphs) and group
    const paragraphs = pageText.split(/\n\s*\n/)
    const chunks: string[] = []
    let currentChunk = ''

    for (const p of paragraphs) {
      if ((currentChunk + ' ' + p).split(/\s+/).length > 500) {
        if (currentChunk) chunks.push(currentChunk.trim())
        currentChunk = p
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + p
      }
    }
    if (currentChunk) chunks.push(currentChunk.trim())

    // 3. Embedding and Saving
    const embedModel = genAI.getGenerativeModel({ model: 'embedding-001' })

    for (let i = 0; i < chunks.length; i++) {
      const chunkText = chunks[i]
      if (!chunkText) continue

      try {
        const result = await embedModel.embedContent(chunkText)
        const embedding = result.embedding.values

        const { error: insertErr } = await supabase.from('document_chunks').insert({
          document_id: documentId,
          project_id: projectId || null,
          chunk_index: i,
          page_number: pageNumber,
          content: chunkText,
          embedding: `[${embedding.join(',')}]`, // Postgres vector string format
          extract_method: extractMethod,
          ocr_confidence: ocrConfidence
        })

        if (insertErr) {
          console.error('Insert chunk error:', insertErr)
          throw new Error('Failed to insert chunk: ' + insertErr.message)
        }
      } catch (embedErr: any) {
        console.error('Embed Error:', embedErr)
        if (embedErr.status === 429) {
          return NextResponse.json({ error: 'Rate limit exceeded for Gemini Embedding', retryAfter: 5 }, { status: 429 })
        }
        throw embedErr
      }
    }

    // 4. Update project_documents processed_pages
    await supabase.rpc('increment_processed_pages', { doc_id: documentId })
    // If rpc doesn't exist, we can fallback to frontend updating or normal update
    // We'll update the record simply:
    const { data: docInfo } = await supabase.from('project_documents').select('processed_pages').eq('id', documentId).single()
    if (docInfo) {
      await supabase.from('project_documents').update({ processed_pages: (docInfo.processed_pages || 0) + 1 }).eq('id', documentId)
    }

    return NextResponse.json({ success: true, chunksProcessed: chunks.length })

  } catch (err: any) {
    console.error('Process page error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
