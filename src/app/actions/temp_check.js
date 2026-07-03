const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://txexenqijhxtdrzgltsm.supabase.co'
const supabaseKey = 'sb_publishable_q3APA2Io-DD6j8ig-cJWfg_6tr77c2P'
const supabase = createClient(supabaseUrl, supabaseKey)

async function check() {
  const { data: projects } = await supabase.from('projects').select('*').ilike('name', '%ซ่อมแซมถนน%')
  if (!projects || projects.length === 0) {
    console.log('No project found')
    return
  }
  const project = projects[0]
  console.log('Project details:', {
    id: project.id,
    name: project.name,
    budget: project.budget,
    paid_amount: project.paid_amount,
    start_date: project.start_date,
    end_date: project.end_date
  })

  const { data: milestones } = await supabase.from('project_milestones').select('*').eq('project_id', project.id)
  console.log('Milestones:')
  console.table(milestones.map(m => ({
    milestone_no: m.milestone_no,
    name: m.name,
    amount: m.amount,
    is_paid: m.is_paid,
    payment_date: m.payment_date
  })))
}

check()
