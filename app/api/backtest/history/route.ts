import { NextResponse } from 'next/server';
import { getHistory } from '../../../../lib/backtesting/data-cache';

export async function GET() {
  try {
    const history = getHistory();
    return NextResponse.json({ history });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
