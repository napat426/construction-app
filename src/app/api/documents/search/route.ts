import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const dynamic = 'force-dynamic'

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseUrl = rawUrl && (rawUrl.startsWith('http://') || rawUrl.startsWith('https://'))
  ? rawUrl
  : 'https://placeholder-project.supabase.co'
const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseKey = rawKey && !rawKey.includes('[SENSITIVE]')
  ? rawKey
  : 'placeholder-key'
const supabase = createClient(supabaseUrl, supabaseKey)

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '')

export async function POST(req: Request) {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return NextResponse.json({ error: 'Gemini API key is not configured' }, { status: 500 })
  }

  try {
    const { query, projectId } = await req.json()

    if (!query) {
      return NextResponse.json({ error: 'Missing query' }, { status: 400 })
    }

    let queryEmbedding: number[] = []

    // 1. Check Cache
    const { data: cached } = await supabase.from('embedding_cache').select('embedding').eq('query_text', query).single()
    
    if (cached && cached.embedding) {
      // Parse vector string '[0.1, 0.2, ...]'
      try {
        queryEmbedding = JSON.parse(cached.embedding)
      } catch (e) {
        // if parsing fails, fallback to call API
      }
    }

    // 2. Call Gemini if not cached
    if (queryEmbedding.length === 0) {
      const embedModel = genAI.getGenerativeModel({ model: 'gemini-embedding-001' })
      const result = await embedModel.embedContent(query)
      queryEmbedding = result.embedding.values.slice(0, 768)

      // Save to cache (non-blocking)
      supabase.from('embedding_cache').insert({
        query_text: query,
        embedding: `[${queryEmbedding.join(',')}]`
      }).then(({ error }) => {
        if (error) console.error('Cache save error:', error)
      })
    }

    // 3. Match Documents
    const { data: matches, error: matchErr } = await supabase.rpc('match_document_chunks', {
      query_embedding: `[${queryEmbedding.join(',')}]`,
      match_threshold: 0.5,
      match_count: 5,
      p_project_id: projectId || null
    })

    if (matchErr) {
      throw new Error(matchErr.message)
    }

    return NextResponse.json({ matches: matches || [] })

  } catch (err: any) {
    console.error('Search error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
