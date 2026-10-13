import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase/admin';
import { getSheetsConfig, upsertTeams, saveSyncRecord } from '@/lib/firestore/teams';
import { syncTeamsFromSheet } from '@/lib/sheets/service';
import { isDemoMode } from '@/lib/demo-data';
import type { ApiResponse, SyncRecord } from '@/types';

export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();

  if (isDemoMode()) {
    return NextResponse.json({ success: true, message: 'Demo mode — no real sync', timestamp });
  }

  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized', timestamp }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifyIdToken(token);

    const config = await getSheetsConfig();
    if (!config || !config.configured) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Sheets not configured', timestamp }, { status: 400 });
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
      triggeredBy: 'manual',
      triggeredByEmail: decoded.email ?? undefined,
    };

    await saveSyncRecord(syncRecord);

    return NextResponse.json<ApiResponse<object>>({
      success: true,
      data: { newRecords: 0, updatedRecords: teams.length, errors },
      timestamp,
    });
  } catch (error) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: error instanceof Error ? error.message : 'Sync failed', timestamp },
      { status: 500 }
    );
  }
}
