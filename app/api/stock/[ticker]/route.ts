import { NextRequest, NextResponse } from 'next/server';
import { getStockDataInternal } from '@/lib/stock-service';

export const dynamic = 'force-dynamic';
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker: rawTicker } = await params;
  try {
    const stockData = await getStockDataInternal(rawTicker);
    return NextResponse.json(stockData);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load stock data';
    console.error(`Error loading stock data for ${rawTicker}:`, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
