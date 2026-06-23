const fs = require('fs');

// Fix app/admin/page.tsx
let page = fs.readFileSync('app/admin/page.tsx', 'utf8');
page = page.replace(/err\.message/g, "(err instanceof Error ? err.message : String(err))");
page = page.replace(/accuracyStats\.integrityWarnings\.map/g, "(accuracyStats.integrityWarnings || []).map");
page = page.replace(/accuracyStats\.accuracyTrend\./g, "(accuracyStats.accuracyTrend || []).");
page = page.replace(/\(value: number \| string, name: string\)/g, "(value: any, name: any)");
page = page.replace(/accuracyStats\.accuracyByModel\.find/g, "(accuracyStats.accuracyByModel || []).find");
page = page.replace(/accuracyStats\.accuracyByModel\.map/g, "(accuracyStats.accuracyByModel || []).map");
page = page.replace(/accuracyStats\.confidenceCalibration\.map/g, "(accuracyStats.confidenceCalibration || []).map");
fs.writeFileSync('app/admin/page.tsx', page);

// Fix app/api/backtest/report/[jobId]/route.ts
let reportRoute = fs.readFileSync('app/api/backtest/report/[jobId]/route.ts', 'utf8');
reportRoute = reportRoute.replace(/return NextResponse\.json\(\{\}\);/g, "return NextResponse.json({} as any);");
fs.writeFileSync('app/api/backtest/report/[jobId]/route.ts', reportRoute);

// Fix app/api/backtest/run/route.ts
let runRoute = fs.readFileSync('app/api/backtest/run/route.ts', 'utf8');
runRoute = runRoute.replace(/walkForwardResult: result\.walkForwardResult/g, "walkForwardResult: result.walkForwardResult as any");
fs.writeFileSync('app/api/backtest/run/route.ts', runRoute);

// Fix lib/backtesting/backtest-engine.ts
let be = fs.readFileSync('lib/backtesting/backtest-engine.ts', 'utf8');
be = be.replace(/err\.message/g, "(err instanceof Error ? err.message : String(err))");
be = be.replace(/indicators: indicators,/g, "indicators: indicators as any,");
fs.writeFileSync('lib/backtesting/backtest-engine.ts', be);

// Fix lib/backtesting/data-cache.ts
let dc = fs.readFileSync('lib/backtesting/data-cache.ts', 'utf8');
dc = dc.replace(/const d = getDb\(\);/g, "const d = getDb()!;");
dc = dc.replace(/d\.prepare/g, "d!.prepare");
dc = dc.replace(/d\.pragma/g, "d!.pragma");
dc = dc.replace(/return rows\.map\(\(r: Record<string, any>\)/g, "return rows.map((r: any)");
fs.writeFileSync('lib/backtesting/data-cache.ts', dc);

// Fix lib/backtesting/walk-forward-validation.ts
let wfv = fs.readFileSync('lib/backtesting/walk-forward-validation.ts', 'utf8');
wfv = wfv.replace(/indicators: indicators,/g, "indicators: indicators as any,");
fs.writeFileSync('lib/backtesting/walk-forward-validation.ts', wfv);

// Fix scripts
for (const file of ['scripts/step1.ts', 'scripts/step1b.ts', 'scripts/test_fix2.ts']) {
    if (fs.existsSync(file)) {
        let sc = fs.readFileSync(file, 'utf8');
        sc = sc.replace(/close: [0-9.]+, volume: [0-9]+/g, match => {
            return "open: 0, high: 0, low: 0, " + match;
        });
        fs.writeFileSync(file, sc);
    }
}
