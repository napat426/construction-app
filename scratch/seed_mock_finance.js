const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://txexenqijhxtdrzgltsm.supabase.co";
const SUPABASE_KEY = "sb_publishable_q3APA2Io-DD6j8ig-cJWfg_6tr77c2P"; // Note: this is a client key, but it works if RLS allows or we use it directly.

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const STATUS_POOL = ['Pending', 'PR', 'PO', 'GR', 'IR', 'Paid'];

async function seed() {
  console.log("Starting mock finance data seeding...");
  
  // 1. Fetch all projects
  const { data: projects, error: projErr } = await supabase.from('projects').select('*');
  if (projErr) {
    console.error("Error fetching projects:", projErr);
    return;
  }
  
  console.log(`Found ${projects.length} projects.`);

  for (const project of projects) {
    // Determine a random opening PR budget (Budget * 1.10 - 1.25, rounded to nearest 10k)
    const budget = Number(project.budget) || 10000000;
    const factor = 1.10 + Math.random() * 0.15; // 1.10 to 1.25
    const openingPr = Math.round((budget * factor) / 10000) * 10000;

    console.log(`Project: ${project.name}`);
    console.log(` - Setting Opening PR to: ฿${openingPr.toLocaleString()}`);

    // Update project opening_pr
    const { error: updProjErr } = await supabase
      .from('projects')
      .update({ opening_pr: openingPr })
      .eq('id', project.id);

    if (updProjErr) {
      console.error(` - Error updating project:`, updProjErr);
      continue;
    }

    // 2. Fetch milestones for this project
    const { data: milestones, error: msErr } = await supabase
      .from('project_milestones')
      .select('*')
      .eq('project_id', project.id);

    if (msErr) {
      console.error(` - Error fetching milestones:`, msErr);
      continue;
    }

    console.log(` - Found ${milestones.length} milestones.`);

    // 3. Randomly distribute statuses
    let totalPaid = 0;
    for (let i = 0; i < milestones.length; i++) {
      const milestone = milestones[i];
      // Distribute statuses:
      // Index 0, 1 -> Paid
      // Index 2 -> IR
      // Index 3 -> GR
      // Index 4 -> PO
      // Index 5 -> PR
      // Remaining -> Pending
      let status = 'Pending';
      if (i === 0 || i === 1) status = 'Paid';
      else if (i === 2) status = 'IR';
      else if (i === 3) status = 'GR';
      else if (i === 4) status = 'PO';
      else if (i === 5) status = 'PR';

      const isPaid = status === 'Paid';
      const paymentDate = isPaid ? new Date(Date.now() - (30 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : null;

      if (isPaid) {
        totalPaid += Number(milestone.amount) || 0;
      }

      console.log(`   * Milestone ${milestone.milestone_no}: Status = ${status}, Amount = ฿${Number(milestone.amount).toLocaleString()}`);

      const { error: updMsErr } = await supabase
        .from('project_milestones')
        .update({
          status: status,
          is_paid: isPaid,
          payment_date: paymentDate
        })
        .eq('id', milestone.id);

      if (updMsErr) {
        console.error(`   - Error updating milestone:`, updMsErr);
      }
    }

    // Update project paid_amount in DB to sync
    await supabase
      .from('projects')
      .update({ paid_amount: totalPaid })
      .eq('id', project.id);
  }

  console.log("Seeding complete!");
}

seed();
