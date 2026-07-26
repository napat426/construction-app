const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')
const { GoogleGenerativeAI } = require('@google/generative-ai')
const { GoogleAIFileManager } = require('@google/generative-ai/server')
const pdfParse = require('pdf-parse')

// 1. Load Environment Variables from .env.local
const envPath = path.join(__dirname, '../.env.local')
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf-8')
  envConfig.split('\n').forEach(line => {
    const parts = line.split('=')
    if (parts.length >= 2) {
      process.env[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '')
    }
  })
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const geminiApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY

if (!supabaseUrl || !supabaseKey || !geminiApiKey) {
  console.error('❌ Error: Missing credentials in .env.local')
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, GOOGLE_GENERATIVE_AI_API_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)
const genAI = new GoogleGenerativeAI(geminiApiKey)
const fileManager = new GoogleAIFileManager(geminiApiKey)

async function extractPagesTextLayer(pdfBuffer) {
  const pages = []
  
  // Custom page render function for pdf-parse to compile page-by-page text
  function renderPage(pageData) {
    return pageData.getTextContent()
      .then(textContent => {
        let lastY, text = ''
        for (let item of textContent.items) {
          if (lastY === undefined || lastY === item.transform[5]) {
            text += item.str + ' '
          } else {
            text += '\n' + item.str + ' '
          }
          lastY = item.transform[5]
        }
        pages.push({
          pageNumber: pageData.pageIndex + 1,
          text: text.trim()
        })
        return text
      })
  }

  await pdfParse(pdfBuffer, { pagerender: renderPage })
  // Sort pages in ascending order
  pages.sort((a, b) => a.pageNumber - b.pageNumber)
  return pages
}

async function uploadDocument(filePath, scope, projectId = null) {
  const absolutePath = path.resolve(filePath)
  if (!fs.existsSync(absolutePath)) {
    console.error(`❌ Error: File not found at ${absolutePath}`)
    process.exit(1)
  }

  const fileName = path.basename(absolutePath)
  console.log(`\n📄 Processing: ${fileName}`)
  console.log(`   Scope: ${scope}`)
  if (projectId) console.log(`   Project ID: ${projectId}`)

  const pdfBuffer = fs.readFileSync(absolutePath)
  
  // 1. Check if digital text exists using pdf-parse
  console.log('🔍 Checking PDF text layer...')
  const textPages = await extractPagesTextLayer(pdfBuffer)
  const totalPages = textPages.length
  console.log(`   Found text layer for ${totalPages} pages.`)

  let isScanned = true
  let extractedPages = []

  // Check if there is actual readable text in the text layer
  const totalLength = textPages.reduce((sum, p) => sum + p.text.length, 0)
  if (totalLength > 100) {
    isScanned = false
    extractedPages = textPages
    console.log('   ✅ Digital text layer found. Running in Hybrid mode (instant text extraction).')
  } else {
    console.log('   ⚠️ Scanned PDF detected (no text layer). Uploading to Gemini File API for OCR...')
  }

  // 2. Insert document record in Supabase
  const { data: doc, error: docError } = await supabase.from('project_documents').insert({
    project_id: projectId,
    doc_type: 'PDF',
    source_type: 'file',
    external_url: '#',
    file_name: fileName,
    scope: scope,
    status: 'processing',
    total_pages: totalPages,
    processed_pages: 0
  }).select().single()

  if (docError) {
    console.error('❌ Failed to insert document record:', docError.message)
    process.exit(1)
  }

  console.log(`   Created document record in DB: ${doc.id}`)

  // 3. OCR processing for scanned PDF using Gemini File API
  let uploadResult
  if (isScanned) {
    try {
      console.log('🚀 Uploading PDF file to Gemini File API...')
      uploadResult = await fileManager.uploadFile(absolutePath, {
        mimeType: 'application/pdf',
        displayName: fileName,
      })
      console.log(`   Gemini File URI: ${uploadResult.uri}`)
    } catch (uploadErr) {
      console.error('❌ Gemini upload failed:', uploadErr.message)
      await supabase.from('project_documents').update({ status: 'error' }).eq('id', doc.id)
      process.exit(1)
    }
  }

  // 4. Process each page sequentially
  const embedModel = genAI.getGenerativeModel({ model: 'gemini-embedding-001' })
  const ocrModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    console.log(`\n⏳ Page ${pageNum}/${totalPages}...`)
    let pageText = ''
    let extractMethod = 'text_layer'
    let ocrConfidence = 'high'

    if (isScanned) {
      extractMethod = 'gemini_ocr'
      let success = false
      let attempts = 0

      while (!success && attempts < 5) {
        attempts++
        try {
          const result = await ocrModel.generateContent([
            uploadResult,
            `Please accurately extract all text and tables from page ${pageNum} of this PDF. Keep Thai characters correct and maintain formatting structure. Return ONLY the text for page ${pageNum}.`
          ])
          pageText = result.response.text()
          if (!pageText || pageText.trim() === '') {
            ocrConfidence = 'low'
            pageText = '[No readable text found on this page]'
          }
          success = true
        } catch (ocrErr) {
          console.error(`   ⚠️ Rate limit/Error on page ${pageNum} (Attempt ${attempts}):`, ocrErr.message)
          console.log('   Waiting 60 seconds to clear rate limit sliding window...')
          await new Promise(r => setTimeout(r, 60000))
        }
      }
    } else {
      pageText = extractedPages.find(p => p.pageNumber === pageNum)?.text || ''
    }

    if (!pageText.trim()) {
      console.log(`   Page ${pageNum} is empty. Skipped.`)
      await supabase.from('project_documents').update({ processed_pages: pageNum }).eq('id', doc.id)
      continue
    }

    // Chunking text (paragraphs, max 500 words per chunk)
    const paragraphs = pageText.split(/\n\s*\n/)
    const chunks = []
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

    // Embedding and Saving
    console.log(`   Saving ${chunks.length} chunks...`)
    for (let i = 0; i < chunks.length; i++) {
      const chunkText = chunks[i]
      if (!chunkText) continue

      let embedded = false
      let embedAttempts = 0
      while (!embedded && embedAttempts < 5) {
        embedAttempts++
        try {
          const result = await embedModel.embedContent(chunkText)
          const embeddingArray = result.embedding.values.slice(0, 768)

          const { error: insertErr } = await supabase.from('document_chunks').insert({
            document_id: doc.id,
            project_id: projectId,
            chunk_index: i,
            page_number: pageNum,
            content: chunkText,
            embedding: `[${embeddingArray.join(',')}]`,
            extract_method: extractMethod,
            ocr_confidence: ocrConfidence
          })

          if (insertErr) {
            console.error(`   ❌ DB chunk insert error:`, insertErr.message)
          } else {
            embedded = true
          }
        } catch (embedErr) {
          console.error(`   ⚠️ Embedding Rate limit/Error (Attempt ${embedAttempts}):`, embedErr.message)
          console.log('   Waiting 60 seconds...')
          await new Promise(r => setTimeout(r, 60000))
        }
      }
    }

    // Update progress in DB
    await supabase.from('project_documents').update({ processed_pages: pageNum }).eq('id', doc.id)
    
    // Quick pause (200ms) to pace requests
    await new Promise(r => setTimeout(r, 200))
  }

  // Set status to ready
  await supabase.from('project_documents').update({ status: 'ready' }).eq('id', doc.id)
  console.log(`\n🎉 Success! Document fully indexed and ready for AI search.`)
  
  // Cleanup Gemini uploaded file
  if (isScanned && uploadResult) {
    try {
      console.log('🧹 Cleaning up Gemini File API temporary storage...')
      await fileManager.deleteFile(uploadResult.name)
    } catch (cleanupErr) {
      console.error('   Failed to delete temporary file from Gemini:', cleanupErr.message)
    }
  }
}

// 5. Command line args parsing
const args = process.argv.slice(2)
if (args.length < 2) {
  console.log('📖 Usage: node scripts/upload_document.js <file_path> <scope> [project_id]')
  console.log('   <scope>     : "global" or "project"')
  console.log('   [project_id]: Supabase UUID of the project (required if scope is "project")')
  console.log('\nExample Global Spec: node scripts/upload_document.js "./specs/global_spec.pdf" "global"')
  console.log('Example Project Contract: node scripts/upload_document.js "./contracts/contract.pdf" "project" "519cb171-2db8-4df2-b2b3-df1fd952b9b4"')
  process.exit(1)
}

const filePath = args[0]
const scope = args[1]
const projectId = args[2] || null

if (scope !== 'global' && scope !== 'project') {
  console.error('❌ Error: Scope must be "global" or "project"')
  process.exit(1)
}

if (scope === 'project' && !projectId) {
  console.error('❌ Error: Project ID is required when scope is "project"')
  process.exit(1)
}

uploadDocument(filePath, scope, projectId)
