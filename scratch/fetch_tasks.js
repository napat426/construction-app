const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://txexenqijhxtdrzgltsm.supabase.co',
  'sb_publishable_q3APA2Io-DD6j8ig-cJWfg_6tr77c2P'
);

async function run() {
  const { data: projects, error: projError } = await supabase.from('projects').select('id, name, wbs_no');
  if (projError) {
    console.error('Projects Error:', projError);
    return;
  }
  
  for (const proj of projects) {
    console.log(`\nProject: ${proj.name} (id: ${proj.id}, current wbs_no: ${proj.wbs_no})`);
    const { data: tasks, error: taskError } = await supabase
      .from('tasks')
      .select('id, wbs_no, name')
      .eq('project_id', proj.id)
      .order('wbs_no', { ascending: true });
    
    if (taskError) {
      console.error(`  Error fetching tasks for ${proj.id}:`, taskError);
      continue;
    }
    
    for (const task of tasks) {
      console.log(`  - Task: [${task.wbs_no}] ${task.name} (id: ${task.id})`);
    }
  }
}

run();
