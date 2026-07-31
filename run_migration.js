const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envLocal = fs.readFileSync('.env.local', 'utf8');
let supabaseUrl = '';
let supabaseKey = '';

envLocal.split(/\r?\n/).forEach(line => {
  const parts = line.split('=');
  if (parts[0] === 'NEXT_PUBLIC_SUPABASE_URL') {
    supabaseUrl = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
  }
  if (parts[0] === 'SUPABASE_SERVICE_ROLE_KEY' || parts[0] === 'NEXT_PUBLIC_SUPABASE_ANON_KEY') {
    if (!supabaseKey) supabaseKey = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
  }
});

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Testing column select...');
  const { data, error } = await supabase.from('projects').select('id, line_token, last_red_flag_alert_date').limit(1);
  if (error) {
    console.log('Error selecting columns:', error.message);
  } else {
    console.log('Columns exist successfully!', data);
  }
}

run();
