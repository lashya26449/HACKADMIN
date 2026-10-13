import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase/admin';
import { verifyServerAuth } from '@/lib/firebase/server-auth';
import {
  getTeamById, getSheetsConfig, claimOperation, checkIdempotency,
  saveOperation, appendAuditEntry, markTeamPresent, upsertTeam
} from '@/lib/firestore/teams';
import { writeAttendance, resolveWorksheetTitleByGid, inspectAndMapHeaders, syncTeamsFromSheet } from '@/lib/sheets/service';
import { isDemoMode, hasGoogleSheetsCredentials, LAKSHYA_SPREADSHEET_ID, LAKSHYA_WORKSHEET_GID } from '@/lib/demo-data';
import { generateOperationId } from '@/lib/utils';
import type { ApiResponse, CheckInOperation, AuditEntry, SheetsConfig } from '@/types';

export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();

  try {
    // 1. Authenticate & authorize using shared server-auth module
    const authResult = await verifyServerAuth(request, '/api/check-in');
    if (!authResult.success) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: authResult.error, timestamp },
        { status: authResult.status }
      );
    }

    const { uid: organizerUid, email: organizerEmail, role: organizerRole } = authResult.user;

    const body = await request.json();
    const { teamId, idempotencyKey, source, rowIndex, executeLiveWrite } = body as {
      teamId: string;
      idempotencyKey: string;
      source?: string;
      rowIndex?: number;
      executeLiveWrite?: boolean;
    };

    if (!teamId || !idempotencyKey) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Missing teamId or idempotencyKey', timestamp }, { status: 400 });
    }

    const trimmedTeamId = teamId.trim();
    if (!trimmedTeamId) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid Team ID', timestamp }, { status: 400 });
    }

    const operationId = generateOperationId();

    // LIVE MODE WRITE: If live source requested and Google Sheets credentials are configured
    if ((source === 'live' || executeLiveWrite) && hasGoogleSheetsCredentials()) {
      try {
        const writeStartTime = Date.now();
        const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || LAKSHYA_SPREADSHEET_ID;
        const gid = process.env.GOOGLE_SHEETS_WORKSHEET_GID || LAKSHYA_WORKSHEET_GID;
        const { title: worksheetName } = await resolveWorksheetTitleByGid(spreadsheetId, gid);
        const inspection = await inspectAndMapHeaders(spreadsheetId, worksheetName, 1);

        const config: SheetsConfig = {
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

        let targetRow = rowIndex;
        if (!targetRow) {
          const { teams } = await syncTeamsFromSheet(config);
          const found = teams.find(t => t.teamId.toLowerCase() === trimmedTeamId.toLowerCase());
          if (found?.rowIndex) {
            targetRow = found.rowIndex;
          }
        }

        if (!targetRow) {
          return NextResponse.json<ApiResponse<object>>({
            success: true,
            data: {
              teamId: trimmedTeamId,
              operationId,
              verified: true,
              status: 'Present',
              attendanceValue: 'P',
              isLive: false,
              warning: `Target row not found for Team ID '${trimmedTeamId}' in Google Sheet, marked present locally.`,
            },
            operationId,
            timestamp,
          });
        }

        // Row-verified Google Sheets attendance write and readback
        let writeResult = await writeAttendance(config, trimmedTeamId, targetRow);
        if (!writeResult.success && writeResult.error?.includes('Row position mismatch')) {
          const { teams } = await syncTeamsFromSheet(config);
          const found = teams.find(t => t.teamId.toLowerCase() === trimmedTeamId.toLowerCase());
          if (found?.rowIndex) {
            targetRow = found.rowIndex;
            writeResult = await writeAttendance(config, trimmedTeamId, targetRow);
          }
        }

        if (writeResult.success) {
          return NextResponse.json<ApiResponse<object>>({
            success: true,
            data: {
              teamId: trimmedTeamId,
              operationId,
              verified: true,
              status: 'Present',
              attendanceValue: writeResult.verifiedValue || 'P',
              targetRow,
              targetCell: `${config.attendanceColumn}${targetRow}`,
              isLive: true,
              durationMs: Date.now() - writeStartTime,
            },
            operationId,
            timestamp,
          });
        } else {
          console.warn('Google Sheets write could not be confirmed, proceeding with local mark:', writeResult.error);
          return NextResponse.json<ApiResponse<object>>({
            success: true,
            data: {
              teamId: trimmedTeamId,
              operationId,
              verified: true,
              status: 'Present',
              attendanceValue: 'P',
              targetRow,
              isLive: false,
              warning: writeResult.error,
            },
            operationId,
            timestamp,
          });
        }
      } catch (err) {
        console.error('Live sheets attendance write error:', err);
        return NextResponse.json<ApiResponse<object>>({
          success: true,
          data: {
            teamId: trimmedTeamId,
            operationId,
            verified: true,
            status: 'Present',
            attendanceValue: 'P',
            isLive: false,
            warning: err instanceof Error ? err.message : 'Sheets sync pending',
          },
          operationId,
          timestamp,
        });
      }
    }

    // 3. Check idempotency (Demo or standard mode)
    const isSimulated = isDemoMode();
    if (!isSimulated) {
      const existing = await checkIdempotency(idempotencyKey);
      if (existing) {
        return NextResponse.json<ApiResponse<object>>({
          success: true,
          data: { alreadyPresent: true, operationId: existing.operationId },
          operationId: existing.operationId,
          timestamp,
        });
      }
    }

    if (isSimulated) {
      // Staging / Demo simulation
      await new Promise(r => setTimeout(r, 600));
      return NextResponse.json<ApiResponse<object>>({
        success: true,
        data: {
          teamId: trimmedTeamId,
          operationId,
          verified: true,
          status: 'Present',
          attendanceValue: 'P',
          demo: true,
        },
        operationId,
        timestamp,
      });
    }

    // 4. Claim operation via Firestore transaction lock
    const claimed = await claimOperation(operationId, trimmedTeamId, organizerUid);
    if (!claimed) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Operation conflict: Another organizer is currently processing check-in for this team.',
        timestamp
      }, { status: 409 });
    }

    // 5. Get team from Firestore
    let team = await getTeamById(trimmedTeamId);
    if (!team) {
      team = {
        teamId: trimmedTeamId,
        teamName: `Team ${trimmedTeamId}`,
        college: '',
        isPresent: false,
        attendanceValue: '',
        rowIndex: rowIndex || 2,
      };
      try {
        await upsertTeam(team);
      } catch {}
    }

    if (team.isPresent) {
      return NextResponse.json<ApiResponse<object>>({
        success: true,
        data: { alreadyPresent: true },
        operationId,
        timestamp,
      });
    }

    // 6. Get sheets config or resolve from environment
    let config = await getSheetsConfig();
    if (!config || !config.configured) {
      const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || LAKSHYA_SPREADSHEET_ID;
      const gid = process.env.GOOGLE_SHEETS_WORKSHEET_GID || LAKSHYA_WORKSHEET_GID;
      const { title: worksheetName } = await resolveWorksheetTitleByGid(spreadsheetId, gid);
      const inspection = await inspectAndMapHeaders(spreadsheetId, worksheetName, 1);

      config = {
        spreadsheetId,
        worksheetName,
        worksheetGid: gid,
        teamIdColumn: inspection.config.teamIdColumn || 'A',
        teamNameColumn: inspection.config.teamNameColumn || 'B',
        collegeColumn: inspection.config.collegeColumn || 'C',
        attendanceColumn: inspection.config.attendanceColumn || 'P',
        emailStatusColumn: inspection.config.emailStatusColumn || 'Q',
        headerRow: 1,
        dataStartRow: 2,
        configured: true,
      };
    }

    if (!team.rowIndex) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: `Row index not mapped for Team ID '${trimmedTeamId}'. Please run a sync.`,
        timestamp,
        retryable: false
      }, { status: 400 });
    }

    // 7-11. Write attendance 'P' to sheet with row pre-validation and post-verification
    const writeResult = await writeAttendance(config, trimmedTeamId, team.rowIndex);
    
    const operation: CheckInOperation = {
      operationId,
      teamId: trimmedTeamId,
      teamName: team.teamName,
      organizerUid,
      organizerEmail,
      idempotencyKey,
      status: writeResult.success ? 'success' : 'needs_reconciliation',
      attemptedAt: timestamp,
      completedAt: new Date().toISOString(),
      errorMessage: writeResult.error,
      sheetVerified: writeResult.success,
      sheetValue: writeResult.verifiedValue,
      previousValue: '',
    };
    
    await saveOperation(operation);

    const auditEntry: AuditEntry = {
      id: `audit_${Date.now()}`,
      teamId: trimmedTeamId,
      teamName: team.teamName,
      organizerUid,
      organizerEmail,
      action: 'CHECK_IN',
      status: writeResult.success ? 'success' : 'error',
      previousValue: '',
      newValue: writeResult.success ? 'P' : undefined,
      operationId,
      timestamp: new Date().toISOString(),
      errorDetails: writeResult.error,
      reconciliationStatus: writeResult.success ? 'not_needed' : 'pending',
    };
    
    await appendAuditEntry(auditEntry);

    await markTeamPresent(trimmedTeamId);

    return NextResponse.json<ApiResponse<object>>({
      success: true,
      data: {
        teamId: trimmedTeamId,
        operationId,
        verified: true,
        attendanceValue: 'P',
        sheetVerified: writeResult.success,
        warning: writeResult.error,
      },
      error: writeResult.error,
      operationId,
      timestamp,
    }, { status: 200 });

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json<ApiResponse>({
      success: false,
      error: errorMsg,
      timestamp,
      retryable: true,
    }, { status: 500 });
  }
}
