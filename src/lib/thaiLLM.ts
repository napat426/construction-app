import { supabase } from '@/lib/supabase'

let cachedApiKey: string | null = null
let cachedAt = 0
const CACHE_TTL_MS = 60 * 1000 // 1 minute

/**
 * Get ThaiLLM API Key from env or Supabase system_settings
 */
export async function getThaiLLMApiKey(): Promise<string | null> {
  const envKey = process.env.THAILLM_API_KEY || process.env.TYPHOON_API_KEY
  if (envKey && envKey.trim().length > 0) {
    return envKey.trim()
  }

  const now = Date.now()
  if (cachedApiKey && now - cachedAt < CACHE_TTL_MS) {
    return cachedApiKey
  }

  try {
    const { data } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'thaillm_api_key')
      .maybeSingle()

    if (data?.value && data.value.trim().length > 0) {
      cachedApiKey = data.value.trim()
      cachedAt = now
      return cachedApiKey
    }
  } catch (err) {
    console.warn('[ThaiLLM] Could not load API key from system_settings:', err)
  }

  return null
}

/**
 * Remove reasoning <think>...</think> blocks from models like qwen3 / pathumma
 */
export function cleanThaiLLMResponse(text: string): string {
  if (!text) return ''
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
  return cleaned || text.trim()
}

/**
 * List of ThaiLLM text models in priority order for automatic cascade fallback
 */
export const THAILLM_TEXT_MODELS = [
  'OpenThaiGPT-ThaiLLM-8B-Instruct-v7.2',
  'Typhoon-S-ThaiLLM-8B-Instruct',
  'Pathumma-ThaiLLM-qwen3-8b-think-3.0.0',
  'THaLLE-0.2-ThaiLLM-8B-fa',
  'qwen3.6-35b-a3b',
]

/**
 * Vision model on ThaiLLM that supports multimodal image understanding
 */
export const THAILLM_VISION_MODEL = 'qwen3.6-35b-a3b'

/**
 * Call ThaiLLM Vision model (qwen3.6-35b-a3b) with photos (URLs or base64)
 */
export async function callThaiLLMVision(params: {
  prompt: string
  images: Array<{ url?: string; base64?: string; mimeType?: string }>
  systemPrompt?: string
  temperature?: number
  timeoutMs?: number
}): Promise<string | null> {
  const apiKey = await getThaiLLMApiKey()
  if (!apiKey) {
    console.warn('[ThaiLLM Vision] No API key found in env or system_settings')
    return null
  }

  const { prompt, images, systemPrompt, temperature = 0.2, timeoutMs = 35000 } = params

  const contentParts: any[] = [{ type: 'text', text: prompt }]

  for (const img of images) {
    if (img.url && img.url.startsWith('http')) {
      contentParts.push({
        type: 'image_url',
        image_url: { url: img.url },
      })
    } else if (img.base64) {
      const mime = img.mimeType || 'image/jpeg'
      const dataUrl = img.base64.startsWith('data:')
        ? img.base64
        : `data:${mime};base64,${img.base64}`
      contentParts.push({
        type: 'image_url',
        image_url: { url: dataUrl },
      })
    }
  }

  const messages: any[] = []
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt })
  }
  messages.push({ role: 'user', content: contentParts })

  const endpoint = process.env.THAILLM_API_URL || 'https://api.thaillm.or.th/v1/chat/completions'

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: THAILLM_VISION_MODEL,
        messages,
        temperature,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.warn(`[ThaiLLM Vision] HTTP ${res.status}: ${errText}`)
      return null
    }

    const data = await res.json()
    const rawText = data?.choices?.[0]?.message?.content
    if (!rawText) return null

    return cleanThaiLLMResponse(rawText)
  } catch (err: any) {
    console.warn('[ThaiLLM Vision] Error during call:', err?.message || err)
    return null
  }
}

/**
 * Call ThaiLLM text models with multi-model cascade auto-failover
 */
export async function callThaiLLMTextCascade(params: {
  messages: Array<{ role: string; content: string }>
  temperature?: number
  timeoutMs?: number
}): Promise<string | null> {
  const apiKey = await getThaiLLMApiKey()
  if (!apiKey) return null

  const { messages, temperature = 0.3, timeoutMs = 20000 } = params
  const endpoint = process.env.THAILLM_API_URL || 'https://api.thaillm.or.th/v1/chat/completions'

  for (const model of THAILLM_TEXT_MODELS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
        }),
        signal: AbortSignal.timeout(timeoutMs),
      })

      if (!res.ok) {
        console.warn(`[ThaiLLM Cascade] Model ${model} returned ${res.status}, trying next model...`)
        continue
      }

      const data = await res.json()
      const rawText = data?.choices?.[0]?.message?.content
      if (rawText && rawText.trim().length > 0) {
        const cleaned = cleanThaiLLMResponse(rawText)
        if (cleaned) {
          console.log(`[ThaiLLM Cascade] Success with model: ${model}`)
          return cleaned
        }
      }
    } catch (err: any) {
      console.warn(`[ThaiLLM Cascade] Model ${model} error:`, err?.message || err)
    }
  }

  return null
}
