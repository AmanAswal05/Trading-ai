import { readFileSync } from 'fs';
import { resolve } from 'path';

const dbPath = resolve(__dirname, '../lib/mock-predictions-db.json');
const data = JSON.parse(readFileSync(dbPath, 'utf8'));

console.log("Keys of first prediction:", Object.keys(data[0]));
console.log("Values of first prediction:", data[0]);

