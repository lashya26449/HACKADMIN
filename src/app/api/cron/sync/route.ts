import { NextRequest, NextResponse } from 'next/server';
import { getSheetsConfig, upsertTeams, saveSyncRecord } from '@/lib/firestore/teams';
import { syncTeamsFromSheet } from '@/lib/sheets/service';
import { isDemoMode } from '@/lib/demo-data';
import type { SyncRecord } from '@/types';

export async function GET(request: NextRequest) {
  const timestamp = new Date().toISOString();
  
  // Validate cron secret
  const authHeader = request.headers.get('Authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isDemoMode()) {
    return NextResponse.json({ success: true, message: 'Demo mode', timestamp });
  }

  try {
    const config = await getSheetsConfig();
    if (!config || !config.configured) {
      return NextResponse.json({ success: false, error: 'Sheets not configured', timestamp });
    }

    const syncId = `sync_${Date.now()}`;
    const startedAt = timestamp;
    const { teams, errors } = await syncTeamsFromSheet(config);
    await upsertTeams(teams);

    const syncRecord: SyncRecord = {
      id: syncId,
      startedAt,
      completedAt: new Date().toISOString(),
      status: errors.length > 0 ? 'partial' : 'success',
      newRecords: 0,
      updatedRecords: teams.length,
      totalRecords: teams.length,
      errors,
      triggeredBy: 'scheduled',
    };

    await saveSyncRecord(syncRecord);
    return NextResponse.json({ success: true, teams: teams.length, errors, timestamp });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Cron sync failed', timestamp }, { status: 500 });
  }
}
