const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://txexenqijhxtdrzgltsm.supabase.co'
const supabaseKey = 'sb_publishable_q3APA2Io-DD6j8ig-cJWfg_6tr77c2P'

async function check() {
  const supabase = createClient(supabaseUrl, supabaseKey)
  const { data, error } = await supabase.from('system_settings').select('*')
  console.log('DB ERROR:', error)
  console.log('ALL SYSTEM SETTINGS:', JSON.stringify(data, null, 2))
}

check()
