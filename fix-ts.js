const fs = require('fs');

// Fix predictions-db.ts
let dbContent = fs.readFileSync('lib/predictions-db.ts', 'utf8');
dbContent = dbContent.replace(/as unknown as Record<string, unknown>/g, "as Record<string, any>");
dbContent = dbContent.replace(/const stockCache: Record<string, \{ history: any\[\] \}> = \{\};/g, "const stockCache: Record<string, { history: Record<string, any>[] }> = {};");
fs.writeFileSync('lib/predictions-db.ts', dbContent);

// Fix prediction-engine.ts
let peContent = fs.readFileSync('lib/prediction-engine.ts', 'utf8');
peContent = peContent.replace(/ensembleMetrics\?: unknown/g, "ensembleMetrics?: Record<string, any>");
fs.writeFileSync('lib/prediction-engine.ts', peContent);

// Fix data-cache.ts
let dcContent = fs.readFileSync('lib/backtesting/data-cache.ts', 'utf8');
dcContent = dcContent.replace(/function getDb\(\)/g, "function getDb(): Database");
dcContent = dcContent.replace(/return rows.map\(\(r: Record<string, unknown>\)/g, "return rows.map((r: Record<string, any>)");
dcContent = dcContent.replace(/config: BacktestConfig/g, "config: Record<string, any>");
dcContent = dcContent.replace(/export function getJob\(id: string\): BacktestConfig \| null \{/g, "export function getJob(id: string): Record<string, any> | null {");
fs.writeFileSync('lib/backtesting/data-cache.ts', dcContent);

// Fix backtest-engine.ts
let beContent = fs.readFileSync('lib/backtesting/backtest-engine.ts', 'utf8');
beContent = beContent.replace(/walkForwardResult\?: unknown;/g, "walkForwardResult?: Record<string, any>;");
fs.writeFileSync('lib/backtesting/backtest-engine.ts', beContent);

// Fix walk-forward-validation.ts (it had an error passing Record<string, any> to TechnicalIndicators)
let wfvContent = fs.readFileSync('lib/backtesting/walk-forward-validation.ts', 'utf8');
wfvContent = wfvContent.replace(/indicators: Record<string, any>/g, "indicators: any"); // Revert back to any here if needed, or leave it as any
fs.writeFileSync('lib/backtesting/walk-forward-validation.ts', wfvContent);

// Fix app/api/backtest/status/[jobId]/route.ts
let apiRoute = fs.readFileSync('app/api/backtest/status/[jobId]/route.ts', 'utf8');
apiRoute = apiRoute.replace(/const job = getJob\(jobId\);/g, "const job = getJob(jobId) as Record<string, any>;");
fs.writeFileSync('app/api/backtest/status/[jobId]/route.ts', apiRoute);

// Fix scripts/step1.ts, etc open/high/low/close array objects. They need to match HistoricalQuote interface.
for (const file of ['scripts/step1.ts', 'scripts/step1b.ts', 'scripts/test_fix2.ts']) {
    if (fs.existsSync(file)) {
        let scContent = fs.readFileSync(file, 'utf8');
        scContent = scContent.replace(/close: [0-9.]+, volume: [0-9]+/g, match => {
            return "open: 0, high: 0, low: 0, " + match;
        });
        fs.writeFileSync(file, scContent);
    }
}
