import { GET } from '../app/api/predict/[ticker]/route';
import { NextRequest } from 'next/server';

async function test() {
  try {
    console.log('Generating prediction for MSFT...');
    const req = new NextRequest('http://localhost:3000/api/predict/MSFT?timeframe=7D&model=V1');
    const res = await GET(req, { params: Promise.resolve({ ticker: 'MSFT' }) });
    const body = await res.json();
    console.log('Prediction Status:', res.status);
    console.log('Prediction Output:', JSON.stringify(body, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
