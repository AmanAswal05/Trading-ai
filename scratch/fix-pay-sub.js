const fs = require('fs');
let content = fs.readFileSync('components/admin/MetricsTab.tsx', 'utf8');
content = content.replace(/\(pay\)/g, "(pay: any)");
content = content.replace(/\(sub\)/g, "(sub: any)");
fs.writeFileSync('components/admin/MetricsTab.tsx', content);
