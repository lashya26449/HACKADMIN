import { NextRequest, NextResponse } from 'next/server';
import { resolveWorksheetTitleByGid, inspectAndMapHeaders, syncTeamsFromSheet } from '@/lib/sheets/service';
import { hasGoogleSheetsCredentials, LAKSHYA_SPREADSHEET_ID, LAKSHYA_WORKSHEET_GID } from '@/lib/demo-data';

export async function GET(request: NextRequest) {
  const timestamp = new Date().toISOString();

  if (!hasGoogleSheetsCredentials()) {
    return NextResponse.json({
      success: false,
      error: 'Google Service Account credentials are not configured in environment.',
      data: { teams: [], isLive: false },
      timestamp,
    }, { status: 503 });
  }

  try {
    const forceRefresh = request.nextUrl.searchParams.get('force') === 'true';
    const startTime = Date.now();
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || LAKSHYA_SPREADSHEET_ID;
    const gid = process.env.GOOGLE_SHEETS_WORKSHEET_GID || LAKSHYA_WORKSHEET_GID;

    const { title: worksheetName } = await resolveWorksheetTitleByGid(spreadsheetId, gid, forceRefresh);
    const inspection = await inspectAndMapHeaders(spreadsheetId, worksheetName, 1, forceRefresh);

    const config = {
      spreadsheetId,
      worksheetName,
      worksheetGid: gid,
      teamIdColumn: inspection.config.teamIdColumn || 'O',
      teamNameColumn: inspection.config.teamNameColumn || 'B',
      collegeColumn: inspection.config.collegeColumn || 'D',
      attendanceColumn: inspection.config.attendanceColumn || 'P',
      emailStatusColumn: inspection.config.emailStatusColumn || 'Q',
      leaderNameColumn: inspection.config.leaderNameColumn || 'C',
      leaderEmailColumn: inspection.config.leaderEmailColumn || 'G',
      leaderPhoneColumn: inspection.config.leaderPhoneColumn || 'H',
      degreeColumn: inspection.config.degreeColumn || 'E',
      collegeIdColumn: inspection.config.collegeIdColumn || 'F',
      paymentColumn: inspection.config.paymentColumn || 'M',
      memberCountColumn: inspection.config.memberCountColumn || 'I',
      headerRow: 1,
      dataStartRow: 2,
      configured: true,
    };

    const { teams, errors, missingIdCount, duplicateIds } = await syncTeamsFromSheet(config, forceRefresh);

    return NextResponse.json({
      success: true,
      data: {
        teams,
        lastSync: new Date().toISOString(),
        isLive: true,
        isDemo: false,
        worksheetTitle: worksheetName,
        totalLiveRecords: teams.length,
        errors,
        missingIdCount,
        duplicateIds,
        durationMs: Date.now() - startTime,
      },
      timestamp,
    });
  } catch (err: unknown) {
    if (
      err &&
      typeof err === 'object' &&
      ('digest' in err || (err instanceof Error && err.message.includes('bail out of prerendering')))
    ) {
      throw err;
    }
    console.error('Live sheets read error:', err);
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'Live Google Sheet read failed',
      data: {
        teams: [],
        isLive: true,
        isDemo: false,
      },
      timestamp,
    }, { status: 500 });
  }
}
