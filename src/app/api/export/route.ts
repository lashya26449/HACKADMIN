import { NextRequest, NextResponse } from 'next/server';
import { verifyServerAuth } from '@/lib/firebase/server-auth';
import { getTeams, appendAuditEntry } from '@/lib/firestore/teams';
import { isDemoMode, DEMO_TEAMS, LAKSHYA_SPREADSHEET_ID, LAKSHYA_WORKSHEET_GID, hasGoogleSheetsCredentials } from '@/lib/demo-data';
import { syncTeamsFromSheet, resolveWorksheetTitleByGid, inspectAndMapHeaders } from '@/lib/sheets/service';
import type { Team, SheetsConfig } from '@/types';

export async function GET(request: NextRequest) {
  const timestamp = new Date().toISOString();
  const searchParams = request.nextUrl.searchParams;
  const exportType = searchParams.get('type') || 'all';

  try {
    let teams: Team[] = [];
    let exporterEmail = 'admin@hackadmin.dev';

    if (!isDemoMode()) {
      const authResult = await verifyServerAuth(request, '/api/export');
      if (authResult.success) {
        exporterEmail = authResult.user.email || 'organizer';
      }

      // Try fetching live teams from Google Sheets first if credentials exist
      if (hasGoogleSheetsCredentials()) {
        try {
          const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || LAKSHYA_SPREADSHEET_ID;
          const gid = process.env.GOOGLE_SHEETS_WORKSHEET_GID || LAKSHYA_WORKSHEET_GID;
          const { title: worksheetName } = await resolveWorksheetTitleByGid(spreadsheetId, gid);
          const inspection = await inspectAndMapHeaders(spreadsheetId, worksheetName, 1);
          const config: SheetsConfig = {
            ...inspection.config,
            spreadsheetId,
            worksheetName,
            worksheetGid: gid,
            teamIdColumn: inspection.config.teamIdColumn || 'O',
            teamNameColumn: inspection.config.teamNameColumn || 'B',
            collegeColumn: inspection.config.collegeColumn || 'D',
            attendanceColumn: inspection.config.attendanceColumn || 'P',
            emailStatusColumn: inspection.config.emailStatusColumn || 'Q',
            headerRow: 1,
            dataStartRow: 2,
            configured: true,
          };
          const sheetResult = await syncTeamsFromSheet(config);
          if (sheetResult.teams.length > 0) {
            teams = sheetResult.teams;
          }
        } catch {
          // Fall back to Firestore
        }
      }

      if (teams.length === 0) {
        teams = await getTeams();
      }
    } else {
      teams = DEMO_TEAMS;
    }

    // Audit log
    if (!isDemoMode()) {
      try {
        await appendAuditEntry({
          id: `audit_export_${Date.now()}`,
          teamId: '*',
          organizerUid: 'system',
          organizerEmail: exporterEmail,
          action: `EXPORT_${exportType.toUpperCase()}`,
          status: 'success',
          timestamp,
        });
      } catch {}
    }

    let headers: string[];
    let rows: (string | number)[][];

    if (exportType === 'payments') {
      headers = [
        'Sl No',
        'Team ID',
        'Team Name',
        'Leader Name',
        'Leader Phone',
        'Leader Email',
        'College',
        'UTR Number',
        'Payment Proof URL',
        'Payment Status',
        'Attendance',
      ];
      rows = teams.map((t, idx) => [
        idx + 1,
        t.teamId,
        t.teamName,
        t.leaderName || '',
        t.leaderPhone || '',
        t.leaderEmail || '',
        t.college || '',
        t.paymentRef || 'N/A',
        t.paymentProofUrl || 'N/A',
        t.paymentStatus || (t.paymentRef ? 'Submitted' : 'Pending'),
        t.isPresent ? 'Present (P)' : 'Absent',
      ]);
    } else {
      headers = [
        'Sl No',
        'Team ID',
        'Team Name',
        'Leader Name',
        'Leader Phone',
        'Leader Email',
        'College',
        'Members Count',
        'UTR Number',
        'Attendance',
        'Synced At',
      ];
      rows = teams.map((t, idx) => [
        idx + 1,
        t.teamId,
        t.teamName,
        t.leaderName || '',
        t.leaderPhone || '',
        t.leaderEmail || '',
        t.college,
        t.memberCount ?? '',
        t.paymentRef || 'N/A',
        t.isPresent ? 'Present (P)' : 'Absent',
        t.syncedAt ?? '',
      ]);
    }

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const filename = `hackadmin-${exportType}-${timestamp.split('T')[0]}.csv`;

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
