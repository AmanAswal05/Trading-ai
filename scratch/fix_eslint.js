const fs = require('fs');

const replaceInFile = (file, search, replace) => {
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, 'utf8');
  const newContent = typeof search === 'function' ? search(content) : content.replace(search, replace);
  if (content !== newContent) {
    fs.writeFileSync(file, newContent, 'utf8');
    console.log(`Updated ${file}`);
  }
};

// 1. Fix unused variables
replaceInFile('lib/featureEngineering.ts', /import \{ (.*?)TechnicalIndicators,?(.*?) \} from/g, 'import { $1$2 } from');
replaceInFile('lib/jobs-db.ts', /const isSupabaseConfigured = true;?\n?/g, '');
replaceInFile('lib/marketRegime.ts', /const ema50Slope = .*?\n?/g, '');
replaceInFile('lib/multiTimeframeAnalysis.ts', /import \{ (.*?)MACD,?(.*?) \} from/g, 'import { $1$2 } from');
replaceInFile('scripts/test_api.ts', /import \{ NextResponse \} from 'next\/server';\n?/g, '');
replaceInFile('scripts/test_api.ts', /const jestMock = .*?\n?/g, '');

// Clean up any empty import braces
const cleanImports = (content) => content.replace(/import \{ \s* \} from/g, '// empty import removed');
replaceInFile('lib/featureEngineering.ts', cleanImports);
replaceInFile('lib/multiTimeframeAnalysis.ts', cleanImports);

// 2. Fix requires
const fixRequires = (content) => {
  return content.replace(/const (\w+) = require\(['"]([^'"]+)['"]\);?/g, 'import * as $1 from "$2";');
};
['lib/jobs-db.ts', 'lib/prediction-engine.ts', 'lib/predictions-db.ts', 'scripts/test_api.ts'].forEach(f => replaceInFile(f, fixRequires));

// 3. Fix any -> unknown
// We'll just replace `: any` with `: unknown` and `<any>` with `<unknown>`
const fixAny = (content) => content.replace(/: any/g, ': unknown').replace(/<any>/g, '<unknown>').replace(/any\[\]/g, 'unknown[]');
const anyFiles = [
  'lib/confidenceCalibration.ts',
  'lib/failureAnalysis.ts',
  'lib/featureEngineering.ts',
  'lib/prediction-analytics.ts',
  'lib/prediction-engine.ts',
  'lib/predictions-db.ts',
  'lib/similarity-engine.ts',
  'scripts/diagnostic3.ts',
  'scripts/run_walk_forward.ts',
  'scripts/step1.ts',
  'scripts/step1b.ts',
  'scripts/test_api.ts',
  'scripts/test_fix2.ts'
];
anyFiles.forEach(f => replaceInFile(f, fixAny));

