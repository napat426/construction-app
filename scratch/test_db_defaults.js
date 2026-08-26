const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://txexenqijhxtdrzgltsm.supabase.co';
const supabaseKey = 'sb_publishable_q3APA2Io-DD6j8ig-cJWfg_6tr77c2P';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Testing query on project_daily_defaults...');
  const { data, error } = await supabase
    .from('project_daily_defaults')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error querying project_daily_defaults:', error);
  } else {
    console.log('Success! Data:', data);
  }
}

run();
