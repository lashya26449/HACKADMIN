import { NextRequest, NextResponse } from 'next/server';
import { resolveWorksheetTitleByGid, inspectAndMapHeaders } from '@/lib/sheets/service';
import { hasGoogleSheetsCredentials } from '@/lib/demo-data';

export async function GET(request: NextRequest) {
  const timestamp = new Date().toISOString();
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || '11xu3PH0OzCCYMDq6LGrdiy7ANcluOHUYlBXJYWMXDQs';
  const gid = process.env.GOOGLE_SHEETS_WORKSHEET_GID || '1086772870';

  if (!hasGoogleSheetsCredentials()) {
    return NextResponse.json({
      success: false,
      configured: false,
      error: 'Google Service Account credentials missing in .env.local (GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY).',
      spreadsheetId,
      gid,
      requiredAction: 'Add your Google Service Account email and private key to .env.local, then share the spreadsheet (11xu3PH0OzCCYMDq6LGrdiy7ANcluOHUYlBXJYWMXDQs) with the service account email as Editor.',
      timestamp,
    }, { status: 400 });
  }

  try {
    // 1. Resolve sheet title from GID
    const { title: worksheetName, sheetId } = await resolveWorksheetTitleByGid(spreadsheetId, gid);

    // 2. Inspect headers
    const inspection = await inspectAndMapHeaders(spreadsheetId, worksheetName, 1);

    return NextResponse.json({
      success: true,
      configured: true,
      spreadsheetId,
      gid,
      worksheetName,
      sheetId,
      headers: inspection.headers,
      detectedColumns: inspection.detectedColumns,
      mapping: inspection.config,
      hasTeamIdColumn: inspection.hasTeamId,
      hasAttendanceColumn: inspection.hasAttendance,
      hasEmailStatusColumn: inspection.hasEmailStatus,
      timestamp,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Failed to inspect Google Sheet';
    return NextResponse.json({
      success: false,
      error: errorMsg,
      spreadsheetId,
      gid,
      timestamp,
    }, { status: 500 });
  }
}
