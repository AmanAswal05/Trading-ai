const fs = require('fs');
const content = fs.readFileSync('app/admin/page.tsx', 'utf8');
const lines = content.split('\n');

let inRender = false;
let returnDepth = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  if (line.match(/^interface /) || line.match(/^export default function/) || line.match(/^  const \[/) || line.match(/^  const /) && line.includes('useMemo') || line.match(/^  const \w+ = async/)) {
     console.log(`${i+1}: ${line.trim()}`);
  }
  
  if (line.match(/  return \(/) || line.match(/  return /) && !line.includes('=>') && !inRender) {
      console.log(`\n--- RENDER BLOCKS START ---`);
      inRender = true;
  }
  
  if (inRender) {
      if (line.includes('{/*')) {
          console.log(`${i+1}: ${line.trim()}`);
      }
  }
}
