const fs = require('fs');

// Fix predictions-db.ts
let dbContent = fs.readFileSync('lib/predictions-db.ts', 'utf8');
dbContent = dbContent.replace(/as Record<string, unknown>/g, "as unknown as Record<string, unknown>");

// Fix stockCache in predictions-db.ts
dbContent = dbContent.replace("const stockCache: Record<string, unknown> = {};", "const stockCache: Record<string, { history: any[] }> = {};");

fs.writeFileSync('lib/predictions-db.ts', dbContent);

// Fix scripts/step1.ts, scripts/step1b.ts, scripts/test_fix2.ts
for (const file of ['scripts/step1.ts', 'scripts/step1b.ts', 'scripts/test_fix2.ts']) {
    if (fs.existsSync(file)) {
        let scContent = fs.readFileSync(file, 'utf8');
        scContent = scContent.replace(/date: '.*', close: .*, volume: .* }/g, match => {
            return match.replace(" }", ", open: 0, high: 0, low: 0 }");
        });
        fs.writeFileSync(file, scContent);
    }
}
