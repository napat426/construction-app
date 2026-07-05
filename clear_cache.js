const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://txexenqijhxtdrzgltsm.supabase.co',
  'sb_publishable_q3APA2Io-DD6j8ig-cJWfg_6tr77c2P'
);

async function run() {
  const { error } = await supabase
    .from('ai_conversations')
    .delete()
    .not('id', 'is', null);
    
  if (error) console.error(error);
  else console.log('Successfully cleared ai_conversations cache.');
}
run();
