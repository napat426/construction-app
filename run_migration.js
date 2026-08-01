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
  console.log('Fetching projects and statuses...');
  const { data, error } = await supabase.from('projects').select('id, name, status');
  if (error) {
    console.log('Error:', error.message);
  } else {
    console.log(`Total projects: ${data.length}`);
    data.forEach((p, i) => console.log(`${i+1}. ${p.name} -> status: "${p.status}"`));
  }
}

run();
