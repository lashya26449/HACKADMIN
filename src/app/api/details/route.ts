import { NextRequest, NextResponse } from 'next/server';
import { fetchTeamDetails } from '@/lib/sheets/details-service';

export async function GET(request: NextRequest) {
  try {
    const result = await fetchTeamDetails();
    return NextResponse.json(result);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Failed to fetch team details';
    return NextResponse.json(
      {
        success: false,
        error: errorMsg,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
