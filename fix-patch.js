const fs = require('fs');
let code = fs.readFileSync('src/components/reports/WeeklyReportsTab.tsx', 'utf8');

// Fix double milestones={milestones}
code = code.replace(/milestones={milestones}\r?\n\s*milestones={milestones}/g, 'milestones={milestones}');

// Fix syntax error from previous patch
// We have an unfinished `}</div></div></div></div></div>` at the end of Gantt.
// Actually, let's just properly re-extract from PlanningClient.tsx and inject correctly.
const planningCode = fs.readFileSync('src/components/PlanningClient.tsx', 'utf8');

const ganttDivMatch = planningCode.match(/<div className=\"min-w-\[700px\] space-y-4\">[\s\S]*?ยังไม่มีงานย่อยในระบบ<\/div>\r?\n\s*\)}\r?\n\s*<\/div>/);
const sCurveDivMatch = planningCode.match(/{sCurveData\.length > 1 \? \([\s\S]*?<svg viewBox=\"0 0 500 200\"[\s\S]*?<\/svg>\s*<\/div>\s*\) : \([\s\S]*?<\/div>\s*\)}/);

const graphsUI = `
          <div className="w-full page-break-before-always mt-8 print:mt-12">
            <h3 className="text-sm font-bold border-b border-black pb-2 mb-4">กราฟ S-Curve ความคืบหน้าสะสม</h3>
            ${sCurveDivMatch[0]}
          </div>

          <div className="w-full page-break-before-always mt-8 print:mt-12">
            <h3 className="text-sm font-bold border-b border-black pb-2 mb-4">Gantt Chart แผนงาน</h3>
            <div className="overflow-hidden border border-black p-4 scale-[0.85] origin-top-left" style={{ width: '115%' }}>
              ${ganttDivMatch[0].replace('min-w-[700px]', 'w-full')}
            </div>
          </div>
`;

// Replace the previously injected broken UI with the corrected graphsUI
const startBadInjection = code.indexOf('<div className="w-full page-break-before-always mt-8 print:mt-12">');
if (startBadInjection !== -1) {
  const endBadInjection = code.indexOf('          <div className={`border border-black');
  code = code.slice(0, startBadInjection) + graphsUI + '\n' + code.slice(endBadInjection);
}

fs.writeFileSync('src/components/reports/WeeklyReportsTab.tsx', code);
console.log('Fixed syntax error in WeeklyReportsTab.tsx');
