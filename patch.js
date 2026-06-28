const fs = require('fs');
let code = fs.readFileSync('src/components/reports/WeeklyReportsTab.tsx', 'utf8');
const planningCode = fs.readFileSync('src/components/PlanningClient.tsx', 'utf8');

// Extract the useMemo blocks from PlanningClient.tsx
const summaryMatch = planningCode.match(/const summary = useMemo\(\(\) => \{[\s\S]*?\}, \[scheduledTasks\]\)/);
const dateRangeMatch = planningCode.match(/const dateRange = useMemo\(\(\) => \{[\s\S]*?\}, \[scheduledTasks, project\]\)/);
const todayLeftMatch = planningCode.match(/const todayLeft = useMemo\(\(\) => \{[\s\S]*?\}, \[dateRange\]\)/);
const sCurveDataMatch = planningCode.match(/const sCurveData = useMemo\(\(\) => \{[\s\S]*?\}, \[scheduledTasks, dateRange, summary, project, milestones\]\)/);
const ganttHeadersMatch = planningCode.match(/const ganttHeaders = useMemo\(\(\) => \{[\s\S]*?\}, \[dateRange\]\)/);

const allHooks = [summaryMatch[0], dateRangeMatch[0], todayLeftMatch[0], sCurveDataMatch[0], ganttHeadersMatch[0]].join('\n\n');

// Insert hooks into WeeklyReportForm right after 'const evm = useMemo(...)' block
const insertHooksAt = code.indexOf('const labelCls =');
code = code.slice(0, insertHooksAt) + allHooks + '\n\n  ' + code.slice(insertHooksAt);

// Now extract the SVG and Gantt divs from PlanningClient.tsx
// Gantt: 
const ganttDivMatch = planningCode.match(/<div className=\"min-w-\[700px\] space-y-4\">[\s\S]*?{ganttHeaders\.map[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/);
// The S-Curve:
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

const insertUiAt = code.indexOf('          <div className="grid grid-cols-2 gap-4 mb-8 text-center">');
const insertUiEnd = code.indexOf('</div>', insertUiAt + 60) + 6;

code = code.slice(0, insertUiEnd) + '\n\n' + graphsUI + '\n' + code.slice(insertUiEnd);

fs.writeFileSync('src/components/reports/WeeklyReportsTab.tsx', code);
console.log('Patched successfully.');
