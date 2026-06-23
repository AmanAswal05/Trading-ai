const fs = require('fs');

// Fix report route
let reportRoute = fs.readFileSync('app/api/backtest/report/[jobId]/route.ts', 'utf8');
reportRoute = reportRoute.replace(/return NextResponse\.json\(\{\}\);/g, "return NextResponse.json({} as unknown as ProfessionalReport);");
reportRoute = reportRoute.replace(/return NextResponse\.json\(\{\} as any\);/g, "return NextResponse.json({} as unknown as ProfessionalReport);");
fs.writeFileSync('app/api/backtest/report/[jobId]/route.ts', reportRoute);

// Fix run route
let runRoute = fs.readFileSync('app/api/backtest/run/route.ts', 'utf8');
runRoute = runRoute.replace(/walkForwardResult: result\.walkForwardResult as any/g, "walkForwardResult: result.walkForwardResult as unknown as WalkForwardResult");
runRoute = runRoute.replace(/walkForwardResult: result\.walkForwardResult,/g, "walkForwardResult: result.walkForwardResult as unknown as WalkForwardResult,");
fs.writeFileSync('app/api/backtest/run/route.ts', runRoute);

// Fix backtest engine
let be = fs.readFileSync('lib/backtesting/backtest-engine.ts', 'utf8');
be = be.replace(/indicators: indicators as any,/g, "indicators: indicators as unknown as TechnicalIndicators,");
be = be.replace(/indicators: indicators,/g, "indicators: indicators as unknown as TechnicalIndicators,");
fs.writeFileSync('lib/backtesting/backtest-engine.ts', be);

// Fix walk-forward-validation
let wfv = fs.readFileSync('lib/backtesting/walk-forward-validation.ts', 'utf8');
wfv = wfv.replace(/indicators: indicators as any,/g, "indicators: indicators as unknown as TechnicalIndicators,");
wfv = wfv.replace(/indicators: indicators,/g, "indicators: indicators as unknown as TechnicalIndicators,");
fs.writeFileSync('lib/backtesting/walk-forward-validation.ts', wfv);

// Fix data-cache
let dc = fs.readFileSync('lib/backtesting/data-cache.ts', 'utf8');
dc = dc.replace(/db\.pragma/g, "db!.pragma"); // if there are any remaining
fs.writeFileSync('lib/backtesting/data-cache.ts', dc);

// Fix scripts
for (const file of ['scripts/step1.ts', 'scripts/step1b.ts', 'scripts/test_fix2.ts']) {
    if (fs.existsSync(file)) {
        let sc = fs.readFileSync(file, 'utf8');
        sc = sc.replace(/\{ date/g, "{ open: 0, high: 0, low: 0, date");
        fs.writeFileSync(file, sc);
    }
}
