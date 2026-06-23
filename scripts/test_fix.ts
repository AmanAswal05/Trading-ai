import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const file = resolve(__dirname, '../lib/prediction-analytics.ts');
let code = readFileSync(file, 'utf8');

code = code.replace(
  `function scorePenalty(row: PredictionReliabilityRow): number {\n  if (row.reliabilityGrade === 'INSUFFICIENT_DATA') return 15;`,
  `function scorePenalty(row: PredictionReliabilityRow): number {\n  if (row.reliabilityGrade === 'INSUFFICIENT_DATA') return 0;`
);

code = code.replace(
  `function isNoEdge(rows: Record<string, PredictionReliabilityRow>): boolean {\n  return Object.values(rows).some(row => row.accuracy < 55 || row.winLossRatio < 1.05 || row.reliabilityGrade !== 'HIGH' && row.reliabilityGrade !== 'MEDIUM');\n}`,
  `function isNoEdge(rows: Record<string, PredictionReliabilityRow>): boolean {\n  const evaluated = Object.values(rows).filter(r => r.reliabilityGrade !== 'INSUFFICIENT_DATA');\n  if (evaluated.length === 0) return false;\n  const bad = evaluated.filter(row => row.accuracy < 55 || row.winLossRatio < 1.05 || row.reliabilityGrade === 'LOW');\n  return bad.length > evaluated.length / 2;\n}`
);

writeFileSync(file, code);
console.log("Applied fix");
