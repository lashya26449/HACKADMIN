import { NextRequest, NextResponse } from 'next/server';
import { resolveWorksheetTitleByGid, provisionTeamIds } from '@/lib/sheets/service';
import { hasGoogleSheetsCredentials, isDemoMode } from '@/lib/demo-data';
import { appendAuditEntry } from '@/lib/firestore/teams';

export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || '11xu3PH0OzCCYMDq6LGrdiy7ANcluOHUYlBXJYWMXDQs';
  const gid = process.env.GOOGLE_SHEETS_WORKSHEET_GID || '1086772870';

  const body = await request.json().catch(() => ({}));
  const teamIdColumn = (body.teamIdColumn || 'A').toUpperCase();
  const prefix = body.prefix || 'LAK-';

  if (!hasGoogleSheetsCredentials() || isDemoMode()) {
    // In demo mode or without credentials, simulate safe provisioning
    return NextResponse.json({
      success: true,
      demo: true,
      provisionedCount: 12,
      prefix,
      assignedMap: [
        { rowIndex: 2, teamId: `${prefix}001` },
        { rowIndex: 3, teamId: `${prefix}002` },
        { rowIndex: 4, teamId: `${prefix}003` },
      ],
      message: 'Demo mode: Team IDs are already provisioned with prefix LAK-001 to LAK-012.',
      timestamp,
    });
  }

  try {
    const { title: worksheetName } = await resolveWorksheetTitleByGid(spreadsheetId, gid);

    const result = await provisionTeamIds(
      spreadsheetId,
      worksheetName,
      teamIdColumn,
      1,
      2,
      prefix
    );

    // Audit log
    try {
      await appendAuditEntry({
        id: `audit_prov_${Date.now()}`,
        teamId: '*',
        organizerUid: 'system',
        organizerEmail: 'admin@hackadmin.dev',
        action: 'PROVISION_TEAM_IDS',
        status: result.errors.length > 0 ? 'warning' : 'success',
        newValue: `${result.provisionedCount} IDs (${prefix})`,
        timestamp,
        errorDetails: result.errors.join('; ') || undefined,
      });
    } catch {
      // Non-blocking firestore write
    }

    return NextResponse.json({
      success: result.errors.length === 0,
      provisionedCount: result.provisionedCount,
      assignedMap: result.assignedMap,
      errors: result.errors,
      timestamp,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Provisioning failed',
      timestamp,
    }, { status: 500 });
  }
}
