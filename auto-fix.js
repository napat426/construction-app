const fs = require('fs');
const { execSync } = require('child_process');

let content = fs.readFileSync('src/components/reports/WeeklyReportsTab.tsx', 'utf8');

// The error is right before `</form>` at the end of the file.
// We will insert `</div>\n` repeatedly until `npx prettier` succeeds or we hit 15.

const insertIndex = content.lastIndexOf('</form>');

let success = false;
let currentContent = content;

for (let i = 1; i <= 15; i++) {
  const replacement = '</div>\n'.repeat(i) + '    </form>';
  currentContent = content.substring(0, insertIndex) + replacement + content.substring(insertIndex + 7);
  
  fs.writeFileSync('src/components/reports/WeeklyReportsTab.tsx', currentContent);
  
  try {
    execSync('npx prettier --write src/components/reports/WeeklyReportsTab.tsx', { stdio: 'ignore' });
    console.log(`Success! Added ${i} closing divs.`);
    success = true;
    break;
  } catch (e) {
    // try again
  }
}

if (!success) {
  console.log('Failed to fix syntax error automatically.');
}
