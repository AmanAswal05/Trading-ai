const fs = require('fs');

function removeLine(file, lineNum) {
    let content = fs.readFileSync(file, 'utf8');
    let lines = content.split('\n');
    lines.splice(lineNum - 1, 1);
    fs.writeFileSync(file, lines.join('\n'));
}

removeLine('components/admin/AccuracyTab.tsx', 1028);
removeLine('components/admin/AuditorTab.tsx', 577);
removeLine('components/admin/MetricsTab.tsx', 332);

