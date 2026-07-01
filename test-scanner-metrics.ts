import { GET } from './app/api/scanner/route';
import { NextRequest } from 'next/server';
async function run() {
  const req = new NextRequest('http://localhost:3000/api/scanner?limit=30');
  const res = await GET(req);
  const data = await res.json();
  console.log(JSON.stringify(data.metrics, null, 2));
}
run();
