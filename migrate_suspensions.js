const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else { 
      if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk(srcDir);

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // 1. Remove ContractSuspension imports
  content = content.replace(/ContractSuspension,\s*/g, '');
  content = content.replace(/,\s*ContractSuspension/g, '');
  content = content.replace(/ContractSuspension/g, 'ContractAmendment');

  // 2. Data fetching in pages
  // Remove supabase.from('contract_suspensions')...
  content = content.replace(/\s*supabase\.from\('contract_suspensions'\)\.select\('\*'\)[^,]*,/g, '');
  
  // Replace [projectsRes, tasksRes, ..., suspensionsRes, amendmentsRes] -> Remove suspensionsRes
  content = content.replace(/,\s*suspensionsRes/g, '');
  content = content.replace(/suspensionsRes,\s*/g, '');

  // Remove const suspensions = suspensionsRes.data...
  content = content.replace(/const suspensions\s*=\s*.*?suspensionsRes.*?(\r?\n)/g, '');
  content = content.replace(/const suspensionsData\s*=\s*.*?suspensionsRes.*?(\r?\n)/g, '');

  // 3. Component Props
  content = content.replace(/suspensions\?: ContractAmendment\[\]/g, '');
  content = content.replace(/suspensions:\s*ContractAmendment\[\]/g, '');
  content = content.replace(/suspensions\s*=\s*\[\],\s*/g, '');
  content = content.replace(/,\s*suspensions\s*=\s*\[\]/g, '');
  
  // 4. Passing props
  content = content.replace(/suspensions=\{suspensions(?:\s*\|\|\s*\[\])?\}\s*/g, '');
  content = content.replace(/initialSuspensions=\{suspensions(?:\s*\|\|\s*\[\])?\}\s*/g, '');
  
  // 5. Function calls inside components
  content = content.replace(/computeTaskDates\(([^,]+),\s*([^,]+),\s*suspensions\)/g, 'computeTaskDates($1, $2, amendments)');
  content = content.replace(/computeProjectExtension\(([^,]+),\s*suspensions,\s*amendments\)/g, 'computeProjectExtension($1, amendments)');
  content = content.replace(/computeProjectExtension\(([^,]+),\s*suspensions\)/g, 'computeProjectExtension($1, amendments)');
  content = content.replace(/isDateSuspended\(([^,]+),\s*suspensions\)/g, 'isDateSuspended($1, amendments)');
  content = content.replace(/countWorkingDays\(([^,]+),\s*([^,]+),\s*suspensions\)/g, 'countWorkingDays($1, $2, amendments)');
  content = content.replace(/addWorkingDays\(([^,]+),\s*([^,]+),\s*suspensions\)/g, 'addWorkingDays($1, $2, amendments)');
  
  // For PortfolioClient/PresentationClient mapping
  content = content.replace(/const projectSuspensions = suspensions\.filter.*/g, '');
  content = content.replace(/suspensions: projectSuspensions/g, '');
  content = content.replace(/suspensions=\{projectSuspensions\}/g, '');

  // 6. SlideGantt specific
  content = content.replace(/suspensions\.map\(\(s\)/g, "amendments.filter(a => a.amendment_type === 'suspend_with_resume' || a.amendment_type === 'suspend_open').map((s)");
  
  // Update state in PresentationEngine
  content = content.replace(/const \[suspensions, setSuspensions\] = useState<ContractAmendment\[\]>\(initialSuspensions\)/g, '');
  content = content.replace(/initialSuspensions/g, 'initialAmendments'); // just in case

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Updated:', file);
  }
});
