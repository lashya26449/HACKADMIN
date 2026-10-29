import { NextRequest, NextResponse } from 'next/server';
import { verifyServerAuth } from '@/lib/firebase/server-auth';
import {
  getTeamById, getSheetsConfig, claimOperation, checkIdempotency,
  saveOperation, appendAuditEntry, markTeamPresent, markTeamAbsent,
  getLatestMarkAudit, upsertTeam
} from '@/lib/firestore/teams';
import {
  writeAttendance, clearAttendance, resolveWorksheetTitleByGid,
  inspectAndMapHeaders, syncTeamsFromSheet, invalidateTeamsCache
} from '@/lib/sheets/service';
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

    // Safety Rule: Only super_admin and checkin_organizer may mark or undo attendance
    if (organizerRole !== 'super_admin' && organizerRole !== 'checkin_organizer') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Forbidden: Insufficient permissions for attendance operations', timestamp },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const {
      teamId,
      idempotencyKey,
      action = 'mark',
      source,
      rowIndex,
      executeLiveWrite
    } = body as {
      teamId: string;
      idempotencyKey?: string;
      action?: 'mark' | 'undo';
      source?: string;
      rowIndex?: number;
      executeLiveWrite?: boolean;
    };

    if (!teamId) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Missing teamId', timestamp }, { status: 400 });
    }

    if (action !== 'mark' && action !== 'undo') {
      return NextResponse.json<ApiResponse>({ success: false, error: `Invalid action '${action}'. Must be 'mark' or 'undo'.`, timestamp }, { status: 400 });
    }

    const trimmedTeamId = teamId.trim();
    if (!trimmedTeamId) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid Team ID', timestamp }, { status: 400 });
    }

    const operationId = generateOperationId();
    const effectiveIdempotencyKey = idempotencyKey || `${trimmedTeamId}_${action}_${Date.now()}`;

    // LIVE MODE: Direct write/clear against Google Sheets
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

        // Resolve target row and verify uniqueness
        let targetRow = rowIndex;
        const { teams } = await syncTeamsFromSheet(config);
        const matches = teams.filter(t => t.teamId.toLowerCase() === trimmedTeamId.toLowerCase());

        if (matches.length === 0) {
          return NextResponse.json<ApiResponse>({
            success: false,
            error: `Team ID '${trimmedTeamId}' not found in Google Sheet.`,
            timestamp,
          }, { status: 404 });
        }
        if (matches.length > 1) {
          return NextResponse.json<ApiResponse>({
            success: false,
            error: `Duplicate Team ID '${trimmedTeamId}' found on multiple rows (${matches.map(m => m.rowIndex).join(', ')}). Operation blocked for safety.`,
            timestamp,
          }, { status: 409 });
        }

        targetRow = matches[0].rowIndex!;
        const matchedTeam = matches[0];

        // ACTION: UNDO
        if (action === 'undo') {
          const undoResult = await clearAttendance(config, trimmedTeamId, targetRow);
          if (!undoResult.success) {
            return NextResponse.json<ApiResponse>({
              success: false,
              error: undoResult.error || 'Failed to clear attendance in Google Sheet',
              timestamp,
            }, { status: 500 });
          }

          // Invalidate cache immediately after verified clear
          invalidateTeamsCache(spreadsheetId);

          // Best-effort Firestore updates
          try {
            await markTeamAbsent(trimmedTeamId);
            const auditEntry: AuditEntry = {
              id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              teamId: trimmedTeamId,
              teamName: matchedTeam.teamName,
              organizerUid,
              organizerEmail,
              action: 'undo',
              status: 'success',
              previousValue: matchedTeam.attendanceValue || 'P',
              newValue: '',
              operationId,
              timestamp: new Date().toISOString(),
              reconciliationStatus: 'not_needed',
            };
            await appendAuditEntry(auditEntry);
          } catch (e) {
            console.warn('Firestore attendance log update failed (non-blocking):', e);
          }

          return NextResponse.json<ApiResponse<object>>({
            success: true,
            data: {
              teamId: trimmedTeamId,
              action: 'undo',
              operationId,
              verified: true,
              status: 'Not Present',
              attendanceValue: '',
              targetRow,
              targetCell: `${config.attendanceColumn}${targetRow}`,
              alreadyNotMarked: undoResult.alreadyNotMarked || false,
              isLive: true,
              durationMs: Date.now() - writeStartTime,
            },
            operationId,
            timestamp,
          });
        }

        // ACTION: MARK
        // If already marked present, don't rewrite; fetch latest mark audit if available
        if (matchedTeam.isPresent || matchedTeam.attendanceValue?.toUpperCase() === 'P' || matchedTeam.attendanceValue?.toUpperCase() === 'PRESENT') {
          const latestAudit = await getLatestMarkAudit(trimmedTeamId);
          return NextResponse.json<ApiResponse<object>>({
            success: true,
            data: {
              teamId: trimmedTeamId,
              action: 'mark',
              operationId,
              verified: true,
              alreadyMarked: true,
              markedBy: latestAudit?.markedBy,
              markedAt: latestAudit?.markedAt,
              status: 'Present',
              attendanceValue: 'P',
              targetRow,
              targetCell: `${config.attendanceColumn}${targetRow}`,
              isLive: true,
            },
            operationId,
            timestamp,
          });
        }

        // Write canonical 'P' and read-back verify
        const writeResult = await writeAttendance(config, trimmedTeamId, targetRow);
        if (!writeResult.success) {
          return NextResponse.json<ApiResponse>({
            success: false,
            error: writeResult.error || 'Failed to verify attendance write in Google Sheet',
            timestamp,
          }, { status: 500 });
        }

        // Invalidate cache immediately after verified write
        invalidateTeamsCache(spreadsheetId);

        // Best-effort Firestore updates
        try {
          await markTeamPresent(trimmedTeamId);
          const auditEntry: AuditEntry = {
            id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            teamId: trimmedTeamId,
            teamName: matchedTeam.teamName,
            organizerUid,
            organizerEmail,
            action: 'mark',
            status: 'success',
            previousValue: matchedTeam.attendanceValue || '',
            newValue: 'P',
            operationId,
            timestamp: new Date().toISOString(),
            reconciliationStatus: 'not_needed',
          };
          await appendAuditEntry(auditEntry);
        } catch (e) {
          console.warn('Firestore attendance log update failed (non-blocking):', e);
        }

        return NextResponse.json<ApiResponse<object>>({
          success: true,
          data: {
            teamId: trimmedTeamId,
            action: 'mark',
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

      } catch (err) {
        console.error('Live sheets attendance operation error:', err);
        return NextResponse.json<ApiResponse>({
          success: false,
          error: err instanceof Error ? err.message : 'Google Sheets operation failed',
          timestamp,
        }, { status: 500 });
      }
    }

    // 2. Demo / Simulated mode fallback
    if (isDemoMode()) {
      await new Promise(r => setTimeout(r, 300));
      return NextResponse.json<ApiResponse<object>>({
        success: true,
        data: {
          teamId: trimmedTeamId,
          action,
          operationId,
          verified: true,
          status: action === 'undo' ? 'Not Present' : 'Present',
          attendanceValue: action === 'undo' ? '' : 'P',
          demo: true,
        },
        operationId,
        timestamp,
      });
    }

    // 3. Fallback standard mode (Firestore-backed)
    const claimed = await claimOperation(operationId, trimmedTeamId, organizerUid);
    if (!claimed) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Operation conflict: Another organizer is currently processing check-in for this team.',
        timestamp
      }, { status: 409 });
    }

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

    if (action === 'undo') {
      if (!team.isPresent && !team.attendanceValue) {
        return NextResponse.json<ApiResponse<object>>({
          success: true,
          data: { teamId: trimmedTeamId, action: 'undo', alreadyNotMarked: true, verified: true },
          operationId,
          timestamp,
        });
      }
      await markTeamAbsent(trimmedTeamId);
      const auditEntry: AuditEntry = {
        id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        teamId: trimmedTeamId,
        teamName: team.teamName,
        organizerUid,
        organizerEmail,
        action: 'undo',
        status: 'success',
        previousValue: team.attendanceValue || 'P',
        newValue: '',
        operationId,
        timestamp: new Date().toISOString(),
        reconciliationStatus: 'not_needed',
      };
      await appendAuditEntry(auditEntry);
      return NextResponse.json<ApiResponse<object>>({
        success: true,
        data: { teamId: trimmedTeamId, action: 'undo', verified: true, attendanceValue: '' },
        operationId,
        timestamp,
      });
    }

    // Action: mark
    if (team.isPresent) {
      const latestAudit = await getLatestMarkAudit(trimmedTeamId);
      return NextResponse.json<ApiResponse<object>>({
        success: true,
        data: {
          teamId: trimmedTeamId,
          action: 'mark',
          alreadyMarked: true,
          markedBy: latestAudit?.markedBy,
          markedAt: latestAudit?.markedAt,
          verified: true,
        },
        operationId,
        timestamp,
      });
    }

    await markTeamPresent(trimmedTeamId);
    const auditEntry: AuditEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      teamId: trimmedTeamId,
      teamName: team.teamName,
      organizerUid,
      organizerEmail,
      action: 'mark',
      status: 'success',
      previousValue: '',
      newValue: 'P',
      operationId,
      timestamp: new Date().toISOString(),
      reconciliationStatus: 'not_needed',
    };
    await appendAuditEntry(auditEntry);

    return NextResponse.json<ApiResponse<object>>({
      success: true,
      data: {
        teamId: trimmedTeamId,
        action: 'mark',
        operationId,
        verified: true,
        attendanceValue: 'P',
      },
      operationId,
      timestamp,
    });

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
