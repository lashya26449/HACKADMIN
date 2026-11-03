import { NextRequest, NextResponse } from 'next/server';
import { verifyServerAuth } from '@/lib/firebase/server-auth';
import { inspectAndMapHeaders, invalidateTeamsCache, getSheetsClient } from '@/lib/sheets/service';
import { isDemoMode, LAKSHYA_SPREADSHEET_ID, LAKSHYA_WORKSHEET_GID } from '@/lib/demo-data';
import type { ApiResponse } from '@/types';

export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();

  try {
    // 1. Authenticate & Authorize
    const authResult = await verifyServerAuth(request, '/api/check-in/bulk');
    if (!authResult.success) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: authResult.error, timestamp },
        { status: authResult.status }
      );
    }

    const { role: organizerRole } = authResult.user;
    if (organizerRole !== 'super_admin' && organizerRole !== 'checkin_organizer') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Forbidden: Insufficient permissions for bulk dispatch operations', timestamp },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { teamIds = [] } = body as { teamIds: string[] };

    const validIds = Array.from(
      new Set(
        teamIds
          .map(id => String(id).trim().toUpperCase())
          .filter(id => id && id !== 'LAK-001' && id !== '001')
      )
    );

    if (validIds.length === 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'No valid Team IDs provided', timestamp },
        { status: 400 }
      );
    }

    // 2. Demo mode fallback
    if (isDemoMode()) {
      return NextResponse.json<ApiResponse<{ count: number; teamIds: string[] }>>({
        success: true,
        data: { count: validIds.length, teamIds: validIds },
        timestamp,
      });
    }

    // 3. Live Google Sheets batch write to mark Column P as 'P'
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || LAKSHYA_SPREADSHEET_ID;
    const worksheetGid = process.env.GOOGLE_SHEETS_WORKSHEET_GID || LAKSHYA_WORKSHEET_GID;

    const inspection = await inspectAndMapHeaders(spreadsheetId, worksheetGid);
    const config = inspection.config;
    const worksheetName = config.worksheetName;
    const attendanceCol = config.attendanceColumn || 'P';
    const teamIdCol = config.teamIdColumn || 'O';

    const sheets = getSheetsClient();

    // Fetch Team ID column to map teamId to row number
    const readRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${worksheetName}'!${teamIdCol}1:${teamIdCol}150`,
    });

    const rows = readRes.data.values || [];
    const idToRow = new Map<string, number>();

    rows.forEach((r, idx) => {
      const val = String(r[0] || '').trim().toUpperCase();
      if (val) {
        idToRow.set(val, idx + 1); // 1-based row number
      }
    });

    const batchData: { range: string; values: string[][] }[] = [];
    const matchedIds: string[] = [];
    const dataStartRow = config.dataStartRow ?? 2;

    for (const id of validIds) {
      const rowNum = idToRow.get(id);
      if (rowNum && rowNum >= dataStartRow) {
        matchedIds.push(id);
        batchData.push({
          range: `'${worksheetName}'!${attendanceCol}${rowNum}`,
          values: [['P']],
        });
      }
    }

    if (batchData.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: batchData,
        },
      });

      invalidateTeamsCache(spreadsheetId);
    }

    return NextResponse.json<ApiResponse<{ count: number; matchedIds: string[]; triggeredEmails: boolean }>>({
      success: true,
      data: {
        count: matchedIds.length,
        matchedIds,
        triggeredEmails: true,
      },
      timestamp,
    });

  } catch (error) {
    console.error('Bulk check-in dispatch error:', error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to execute bulk dispatch',
        timestamp,
      },
      { status: 500 }
    );
  }
}
