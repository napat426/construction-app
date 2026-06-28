const fs = require('fs');

let code = fs.readFileSync('src/components/reports/WeeklyReportsTab.tsx', 'utf8');

// 1. Fix missing hoveredPointIndex
if (!code.includes('const [hoveredPointIndex, setHoveredPointIndex]')) {
  code = code.replace(
    /const \[isPending, startTransition\] = useTransition\(\);/,
    'const [isPending, startTransition] = useTransition();\n  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);'
  );
}

// 2. Fix the layout by moving the graphsUI out of the SV/CV grid.
// First, find the SV block.
const svMatch = code.match(/<div className={`border border-black p-2 \${evm\.SV >= 0 \? 'bg-green-100' : 'bg-red-100'}`}>\s*<p className="text-xs font-bold">Schedule Variance \(SV\)<\/p>[\s\S]*?<\/div>/);
// Find the CV block.
const cvMatch = code.match(/<div className={`border border-black p-2 \${evm\.CV >= 0 \? 'bg-green-100' : 'bg-red-100'}`}>\s*<p className="text-xs font-bold">Cost Variance \(CV\)<\/p>[\s\S]*?<\/div>/);

// Find the S-Curve block.
const sCurveMatch = code.match(/<div className="w-full page-break-before-always mt-8 print:mt-12">\s*<h3 className="text-sm font-bold border-b border-black pb-2 mb-4">\s*กราฟ S-Curve ความคืบหน้าสะสม\s*<\/h3>[\s\S]*?<\/svg>\s*<\/div>\s*\)\s*:\s*\([\s\S]*?<\/div>\s*\)}\s*<\/div>/);

// Find the Gantt block.
const ganttMatch = code.match(/<div className="w-full page-break-before-always mt-8 print:mt-12">\s*<h3 className="text-sm font-bold border-b border-black pb-2 mb-4">\s*Gantt Chart แผนงาน\s*<\/h3>[\s\S]*?ยังไม่มีงานย่อยในระบบ<\/div>\s*\)}\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/);

if (svMatch && cvMatch && sCurveMatch && ganttMatch) {
  // Construct the correct grid for SV/CV
  const correctGrid = `
          <div className="grid grid-cols-2 gap-4 mb-8 text-center print:break-inside-avoid">
            ${svMatch[0]}
            ${cvMatch[0]}
          </div>
  `;

  // We need to replace the entire messy section.
  // The messy section starts at: <div className="grid grid-cols-2 gap-4 mb-8 text-center">
  // and ends at the end of the FORM FIELDS.
  // Let's just find the form fields.
  const formFieldsMatch = code.match(/{\/\* ========================================================= \*\/}\s*{\/\* FORM FIELDS[\s\S]*?<\/form>/);

  if (formFieldsMatch) {
    const startReplaceIndex = code.indexOf('<div className="grid grid-cols-2 gap-4 mb-8 text-center">');
    const endReplaceIndex = code.indexOf('</form>');
    
    // Construct the S-Curve and Gantt
    const sCurveFixed = sCurveMatch[0].replace('page-break-before-always mt-8 print:mt-12', 'mt-8 print:mt-12 print:break-inside-avoid');
    const ganttFixed = ganttMatch[0].replace('page-break-before-always mt-8 print:mt-12', 'mt-8 print:mt-0 print:page-break-before-always').replace('w-[1000px]', 'w-full');
    
    const newBody = `
${correctGrid}

        ${formFieldsMatch[0].replace('</form>', '')}

        ${sCurveFixed}

        ${ganttFixed}
      </div>
    </form>`;

    code = code.substring(0, startReplaceIndex) + newBody + code.substring(endReplaceIndex + 7);
  }
} else {
  console.log('Could not find all blocks to reconstruct layout.');
}

// 3. To make the print landscape, we can add a style block at the top of the form.
code = code.replace(/<form onSubmit={handleSubmit}/, '<style type="text/css" media="print">{`@page { size: landscape; margin: 1cm; }`}</style>\n    <form onSubmit={handleSubmit}');

fs.writeFileSync('src/components/reports/WeeklyReportsTab.tsx', code);
console.log('Fixed layout in WeeklyReportsTab.tsx');
