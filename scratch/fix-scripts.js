const fs = require('fs');

function fix(file) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace("macd: { histogram: -0.1 }", "macd: { histogram: -0.1, macd: 0, signal: 0 }");
    content = content.replace("macd: { histogram: 1.5 }", "macd: { histogram: 1.5, macd: 0, signal: 0 }");
    content = content.replace("williamsR: -20", "williamsR: -20, obv: 0"); // in case it wasn't added
    fs.writeFileSync(file, content);
}
fix('scripts/step1.ts');
fix('scripts/step1b.ts');
fix('scripts/test_fix2.ts');
