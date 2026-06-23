/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */
import { NextResponse } from 'next/server';
import { GET } from '../app/api/evaluate_model/route';

async function run() {
  const req = {
    nextUrl: { searchParams: { get: () => '10000' } },
    headers: { get: () => 'mock-admin-token' }
  } as any;
  // mock getAuthenticatedAdmin
  const jestMock = require('jest-mock');
  const adminApiAuth = require('../lib/admin-api-auth');
  adminApiAuth.getAuthenticatedAdmin = () => Promise.resolve({ id: 'admin' });

  const res = await GET(req);
  const data = await res.json();
  console.log("tradeableCount:", data.tradeableCount);
  console.log("filteredPredictionsCount:", data.filteredPredictionsCount);
  console.log("evaluatedRows:", data.evaluatedRows);
}
run();
