import { createClient } from '@supabase/supabase-js'

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseUrl = rawUrl && (rawUrl.startsWith('http://') || rawUrl.startsWith('https://'))
  ? rawUrl
  : 'https://placeholder-project.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.includes('[SENSITIVE]')
  ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  : 'placeholder-anon-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
