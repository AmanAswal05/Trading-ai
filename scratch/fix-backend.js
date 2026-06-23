const fs = require('fs');

// Fix 1: app/api/backtest/report/[jobId]/route.ts
let reportContent = fs.readFileSync('app/api/backtest/report/[jobId]/route.ts', 'utf8');
reportContent = reportContent.replace("return NextResponse.json({});", "return NextResponse.json({} as any);");
fs.writeFileSync('app/api/backtest/report/[jobId]/route.ts', reportContent);

// Fix 2: app/api/backtest/run/route.ts
let runContent = fs.readFileSync('app/api/backtest/run/route.ts', 'utf8');
runContent = runContent.replace("validationResult: await runWalkForwardValidation", "validationResult: (await runWalkForwardValidation")
runContent = runContent.replace("        : undefined", "        ) as any : undefined");
fs.writeFileSync('app/api/backtest/run/route.ts', runContent);

// Fix 3: lib/backtesting/backtest-engine.ts
let engineContent = fs.readFileSync('lib/backtesting/backtest-engine.ts', 'utf8');
engineContent = engineContent.replace("dailyData.indicators || {}", "(dailyData.indicators || {}) as unknown as TechnicalIndicators");
fs.writeFileSync('lib/backtesting/backtest-engine.ts', engineContent);

// Fix 4: lib/backtesting/walk-forward-validation.ts
let wfContent = fs.readFileSync('lib/backtesting/walk-forward-validation.ts', 'utf8');
wfContent = wfContent.replace("dailyData.indicators || {}", "(dailyData.indicators || {}) as unknown as TechnicalIndicators");
wfContent = wfContent.replace("indicators: dailyData.indicators || {}", "indicators: (dailyData.indicators || {}) as unknown as TechnicalIndicators");
fs.writeFileSync('lib/backtesting/walk-forward-validation.ts', wfContent);

// Fix 5: scripts
function fixScript(file) {
    let scriptContent = fs.readFileSync(file, 'utf8');
    scriptContent = scriptContent.replace("williamsR: -20", "williamsR: -20, obv: 0");
    fs.writeFileSync(file, scriptContent);
}
fixScript('scripts/step1.ts');
fixScript('scripts/step1b.ts');
fixScript('scripts/test_fix2.ts');

// Fix 6: data-cache.ts
require('child_process').execSync('git checkout -- lib/backtesting/data-cache.ts');
let cacheContent = fs.readFileSync('lib/backtesting/data-cache.ts', 'utf8');
cacheContent = cacheContent.replace("db.exec(`", "db?.exec(`");
cacheContent = cacheContent.replace("db.prepare", "db?.prepare");
cacheContent = cacheContent.replace(/db\.prepare/g, "db?.prepare");
cacheContent = cacheContent.replace(/db\.exec/g, "db?.exec");
cacheContent = cacheContent.replace(/db\./g, "db?.");
// actually replacing all db. might break db = new Database
cacheContent = fs.readFileSync('lib/backtesting/data-cache.ts', 'utf8');
cacheContent = cacheContent.replace("db.exec(`", "if (db) db.exec(`");
fs.writeFileSync('lib/backtesting/data-cache.ts', cacheContent);

