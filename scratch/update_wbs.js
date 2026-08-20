const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://txexenqijhxtdrzgltsm.supabase.co',
  'sb_publishable_q3APA2Io-DD6j8ig-cJWfg_6tr77c2P'
);

const locations = ['UTO', 'BKK', 'CBI', 'NMA', 'SRN', 'PCT', 'UDN', 'cby', 'PYO'];
const sections = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'];

function generateWBS() {
  const year = 67; // matching I-67
  const loc = locations[Math.floor(Math.random() * locations.length)] + String(Math.floor(Math.random() * 90) + 10);
  const sec = sections[Math.floor(Math.random() * sections.length)];
  const num = Math.floor(Math.random() * 8999) + 1000;
  return `I-${year}-I-${loc}.${sec}.${num}`;
}

async function run() {
  const { data: projects, error: projError } = await supabase.from('projects').select('id, name');
  if (projError) {
    console.error('Projects Fetch Error:', projError);
    return;
  }
  
  console.log(`Found ${projects.length} projects to update.`);

  for (const proj of projects) {
    const wbs = generateWBS();
    console.log(`Updating project "${proj.name}" with WBS: ${wbs}`);
    const { error: updateError } = await supabase
      .from('projects')
      .update({ wbs_no: wbs })
      .eq('id', proj.id);
      
    if (updateError) {
      console.error(`  Error updating ${proj.id}:`, updateError);
    } else {
      console.log(`  Successfully updated.`);
    }
  }
}

run();
