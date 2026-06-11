import { GET } from '../app/api/public/trust-stats/route';
import { NextRequest } from 'next/server';

async function test() {
  try {
    console.log('Invoking GET /api/public/trust-stats...');
    const req = new NextRequest('http://localhost:3000/api/public/trust-stats');
    const res = await GET(req);
    const body = await res.json();
    console.log('API Status:', res.status);
    console.log('API Response:', JSON.stringify(body, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
