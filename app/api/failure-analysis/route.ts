import { NextResponse } from 'next/server';
import { PredictionsDbService } from '@/lib/predictions-db';
import { buildFailureAnalysisReport } from '@/lib/failureAnalysis';

export async function GET() {
  try {
    const allPredictions = await PredictionsDbService.getAllPredictions();
    const verified = allPredictions.filter(p => p.status === 'VERIFIED');
    
    const report = buildFailureAnalysisReport(verified);
    
    return NextResponse.json(report);
  } catch (error: any) {
    console.error('Failed to generate failure analysis report:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
