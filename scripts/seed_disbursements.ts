import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import { resolve } from 'path';

const envContent = fs.readFileSync(resolve(__dirname, '../.env.local'), 'utf-8');
const envVars = Object.fromEntries(envContent.split('\n').filter(line => line && !line.startsWith('#')).map(line => line.split('=').map(s => s.replace(/(^"|"$)/g, ''))));

const supabaseUrl = envVars['NEXT_PUBLIC_SUPABASE_URL']?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = envVars['SUPABASE_SERVICE_ROLE_KEY']?.trim() || envVars['NEXT_PUBLIC_SUPABASE_ANON_KEY']?.trim() || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  console.log('Seeding disbursement data...');

  const { data: projects, error: projectsError } = await supabase.from('projects').select('id, budget');
  if (projectsError) {
    console.error('Failed to get projects:', projectsError);
    return;
  }

  for (const p of projects) {
    if (Math.random() > 0.1) {
      const budget = p.budget || 10000000;
      const opening_pr = budget * (0.8 + Math.random() * 0.4);
      await supabase.from('projects').update({ opening_pr }).eq('id', p.id);
    }
  }

  const { data: milestones, error: milestonesError } = await supabase.from('project_milestones').select('id, is_paid');
  if (milestonesError) {
    console.error('Failed to get milestones:', milestonesError);
    return;
  }

  let counts = { PR: 0, PO: 0, GR: 0, IR: 0, Paid: 0, Pending: 0 };

  for (const m of milestones) {
    let status = '';
    let is_paid = m.is_paid;

    if (m.is_paid) {
      status = 'Paid';
    } else {
      const rand = Math.random();
      if (rand < 0.15) status = 'PR';
      else if (rand < 0.3) status = 'PO';
      else if (rand < 0.45) status = 'GR';
      else if (rand < 0.6) status = 'IR';
      else if (rand < 0.7) {
        status = 'Paid';
        is_paid = true;
      } else {
        status = 'Pending';
      }
    }
    
    counts[status as keyof typeof counts]++;

    await supabase.from('project_milestones').update({ 
      status,
      is_paid
    }).eq('id', m.id);
  }

  console.log('Updated milestones statuses:', counts);
  console.log('Done!');
}

seed();
