import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase/admin';
import {
  getTeamById, getSheetsConfig, claimOperation, checkIdempotency,
  saveOperation, appendAuditEntry, markTeamPresent
} from '@/lib/firestore/teams';
import { writeAttendance, resolveWorksheetTitleByGid, inspectAndMapHeaders, syncTeamsFromSheet } from '@/lib/sheets/service';
import { isDemoMode, hasGoogleSheetsCredentials, LAKSHYA_SPREADSHEET_ID, LAKSHYA_WORKSHEET_GID } from '@/lib/demo-data';
import { generateOperationId } from '@/lib/utils';
import type { ApiResponse, CheckInOperation, AuditEntry, SheetsConfig } from '@/types';

export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();

  try {
    // 1. Authenticate
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized', timestamp }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    
    const body = await request.json();
    const { teamId, idempotencyKey, source, rowIndex, executeLiveWrite, organizerEmail: clientEmail } = body as {
      teamId: string;
      idempotencyKey: string;
      source?: string;
      rowIndex?: number;
      executeLiveWrite?: boolean;
      organizerEmail?: string;
    };

    let organizerUid: string;
    let organizerEmail: string;
    let organizerRole: string;

    const isProd = process.env.NODE_ENV === 'production';
    if (isProd && (token === 'demo' || token === 'session')) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Unauthorized: Production requests must provide a valid verified Firebase ID token.',
        timestamp,
      }, { status: 401 });
    }

    const isSimulated = !isProd && (isDemoMode() || !hasGoogleSheetsCredentials() || token === 'demo' || token === 'session' || !process.env.FIREBASE_ADMIN_PROJECT_ID);

    if (isSimulated) {
      organizerUid = 'organizer-session';
      organizerEmail = clientEmail || request.headers.get('x-user-email') || 'Organizer';
      organizerRole = 'checkin_organizer';
    } else {
      if (!process.env.FIREBASE_ADMIN_PROJECT_ID) {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: 'Server configuration error: Firebase Admin credentials not configured.',
          timestamp,
        }, { status: 500 });
      }
      const adminAuth = getAdminAuth();
      const decoded = await adminAuth.verifyIdToken(token);
      organizerUid = decoded.uid;
      organizerEmail = decoded.email ?? 'Organizer';

      // 2. Validate role strictly from Firestore users collection
      const db = getAdminFirestore();
      const userDoc = await db.collection('users').doc(organizerUid).get();
      organizerRole = userDoc.data()?.role ?? 'readonly_viewer';
    }

    if (organizerRole === 'readonly_viewer') {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Permission denied: Read-only viewers cannot mark attendance.',
        timestamp,
      }, { status: 403 });
    }

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
          return NextResponse.json<ApiResponse>({
            success: false,
            error: `Target row not found for Team ID '${trimmedTeamId}' in Google Sheet.`,
            timestamp,
          }, { status: 404 });
        }

        // Row-verified Google Sheets attendance write and readback
        const writeResult = await writeAttendance(config, trimmedTeamId, targetRow);
        if (!writeResult.success) {
          return NextResponse.json<ApiResponse>({
            success: false,
            error: writeResult.error || 'Attendance write verification failed in Google Sheets.',
            timestamp,
          }, { status: 500 });
        }

        return NextResponse.json<ApiResponse<object>>({
          success: true,
          data: {
            teamId: trimmedTeamId,
            operationId,
            verified: true,
            status: 'Present',
            attendanceValue: writeResult.verifiedValue || 'Present',
            targetRow,
            targetCell: `${config.attendanceColumn}${targetRow}`,
            isLive: true,
            durationMs: Date.now() - writeStartTime,
          },
          operationId,
          timestamp,
        });
      } catch (err) {
        console.error('Live sheets attendance write error:', err);
        return NextResponse.json<ApiResponse>({
          success: false,
          error: err instanceof Error ? err.message : 'Failed to write attendance to Google Sheet',
          timestamp,
        }, { status: 500 });
      }
    }

    // 3. Check idempotency (Demo or standard mode)
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
      await appendAuditEntry({
        id: `audit_${Date.now()}`,
        teamId: trimmedTeamId,
        organizerUid,
        organizerEmail,
        action: 'CHECK_IN',
        status: 'error',
        errorDetails: `Team ID ${trimmedTeamId} not found in synchronized registrations`,
        operationId,
        timestamp,
      });
      return NextResponse.json<ApiResponse>({
        success: false,
        error: `Team ID '${trimmedTeamId}' not found in registrations.`,
        timestamp,
        operationId
      }, { status: 404 });
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

    if (writeResult.success) {
      await markTeamPresent(trimmedTeamId);
    }

    return NextResponse.json<ApiResponse<object>>({
      success: writeResult.success,
      data: {
        teamId: trimmedTeamId,
        operationId,
        verified: writeResult.success,
        attendanceValue: 'P',
      },
      error: writeResult.error,
      operationId,
      timestamp,
      retryable: !writeResult.success,
      reconciliationNeeded: !writeResult.success,
    }, { status: writeResult.success ? 200 : 500 });

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
