import { google, sheets_v4, drive_v3 } from 'googleapis';
import type { SheetsConfig, Team, DetectedColumn } from '@/types';
import { indexToColumnLetter, columnLetterToIndex } from '@/lib/utils';

export function getGoogleAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  
  if (!email || !rawKey) {
    throw new Error(
      'Google Service Account credentials are not configured. Please set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY in .env.local.'
    );
  }

  const key = rawKey.includes('\\n')
    ? rawKey.split('\\n').join('\n').replace(/\r/g, '')
    : rawKey.replace(/\r/g, '');

  return new google.auth.JWT({
    email,
    key,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.readonly',
    ],
  });
}

export function getSheetsClient(): sheets_v4.Sheets {
  const auth = getGoogleAuth();
  return google.sheets({ version: 'v4', auth });
}

export function getDriveClient(): drive_v3.Drive {
  const auth = getGoogleAuth();
  return google.drive({ version: 'v3', auth });
}

// In-memory caching for Google Sheets metadata and short-lived registration cache
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const worksheetTitleCache = new Map<string, CacheEntry<{ title: string; sheetId: number }>>();
const headerConfigCache = new Map<string, CacheEntry<{
  headers: string[];
  detectedColumns: DetectedColumn[];
  config: Partial<SheetsConfig>;
  hasTeamId: boolean;
  hasAttendance: boolean;
  hasEmailStatus: boolean;
}>>();
const teamsCache = new Map<string, CacheEntry<{
  teams: Team[];
  errors: string[];
  missingIdCount: number;
  duplicateIds: string[];
}>>();

const METADATA_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const TEAMS_CACHE_TTL_MS = 10 * 1000; // 10 seconds

export function invalidateTeamsCache(spreadsheetId?: string) {
  if (spreadsheetId) {
    teamsCache.delete(spreadsheetId);
  } else {
    teamsCache.clear();
  }
}

/**
 * Resolves the actual worksheet title from the given GID (sheetId).
 * Uses in-memory cache to prevent redundant spreadsheets.get calls.
 */
export async function resolveWorksheetTitleByGid(
  spreadsheetId: string,
  gid: string | number,
  forceRefresh: boolean = false
): Promise<{ title: string; sheetId: number }> {
  const cacheKey = `${spreadsheetId}:${gid}`;
  const now = Date.now();

  if (!forceRefresh && worksheetTitleCache.has(cacheKey)) {
    const entry = worksheetTitleCache.get(cacheKey)!;
    if (now - entry.timestamp < METADATA_CACHE_TTL_MS) {
      return entry.data;
    }
  }

  const sheets = getSheetsClient();
  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const numericGid = Number(gid);
    const target = meta.data.sheets?.find(
      s => s.properties?.sheetId === numericGid
    );

    if (target?.properties?.title) {
      const result = {
        title: target.properties.title,
        sheetId: target.properties.sheetId ?? 0,
      };
      worksheetTitleCache.set(cacheKey, { data: result, timestamp: now });
      return result;
    }

    // If specific GID wasn't found, return first sheet with warning
    const firstSheet = meta.data.sheets?.[0];
    if (firstSheet?.properties?.title) {
      return {
        title: firstSheet.properties.title,
        sheetId: firstSheet.properties.sheetId ?? 0,
      };
    }

    throw new Error(`Worksheet with GID ${gid} not found in spreadsheet.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('The caller does not have permission') || message.includes('403')) {
      const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || 'your service account';
      throw new Error(
        `Permission Denied: The Google Spreadsheet (${spreadsheetId}) is not shared with ${email}. Please open the Google Sheet, click Share, and grant ${email} Editor access.`
      );
    }
    throw error;
  }
}

/**
 * Normalizes header string: converts to lower case, replaces punctuation with spaces, collapses whitespace.
 */
export function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Inspects the spreadsheet headers and performs intelligent dynamic column auto-mapping.
 * Normalized header matching prevents ambiguous word collisions (e.g. Email Status vs Attendance).
 */
export async function inspectAndMapHeaders(
  spreadsheetId: string,
  worksheetName: string,
  headerRow: number = 1,
  forceRefresh: boolean = false
): Promise<{
  headers: string[];
  detectedColumns: DetectedColumn[];
  config: Partial<SheetsConfig>;
  hasTeamId: boolean;
  hasAttendance: boolean;
  hasEmailStatus: boolean;
}> {
  const cacheKey = `${spreadsheetId}:${worksheetName}:${headerRow}`;
  const now = Date.now();

  if (!forceRefresh && headerConfigCache.has(cacheKey)) {
    const entry = headerConfigCache.get(cacheKey)!;
    if (now - entry.timestamp < METADATA_CACHE_TTL_MS) {
      return entry.data;
    }
  }

  const sheets = getSheetsClient();
  const range = `'${worksheetName}'!${headerRow}:${headerRow}`;
  
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  const rawHeaders = (response.data.values?.[0] ?? []).map(String);
  const detectedColumns: DetectedColumn[] = [];

  let teamIdCol = '';
  let teamNameCol = '';
  let leaderNameCol = '';
  let leaderEmailCol = '';
  let leaderPhoneCol = '';
  let collegeCol = '';
  let degreeCol = '';
  let attendanceCol = '';
  let emailStatusCol = '';
  let collegeIdCol = '';
  let paymentCol = '';
  let memberCountCol = '';

  rawHeaders.forEach((header, idx) => {
    const letter = indexToColumnLetter(idx);
    const norm = normalizeHeader(header);
    if (!norm) return;

    let purpose = 'General';

    // 1. Team ID (strict: must NOT be email id or college id)
    if (/^team\s*(id|code|identifier|no|number)$/.test(norm) || (norm.startsWith('team id') && !norm.includes('email') && !norm.includes('lead'))) {
      teamIdCol = letter;
      purpose = 'Team ID';
    }
    // 2. Team Name
    else if (/^team\s*name$/.test(norm) || (norm.includes('team') && norm.includes('name') && !norm.includes('lead') && !norm.includes('leader'))) {
      teamNameCol = letter;
      purpose = 'Team Name';
    }
    // 3. Leader Name
    else if (/leader|lead/.test(norm) && /name/.test(norm)) {
      leaderNameCol = letter;
      purpose = 'Team Leader Name';
    }
    // 4. College ID Card Upload
    else if (/id\s*card|college\s*id|upload.*id|student\s*id/.test(norm)) {
      collegeIdCol = letter;
      purpose = 'College ID Upload';
    }
    // 5. College / Institution
    else if (/college|institution|university|campus|school/.test(norm)) {
      collegeCol = letter;
      purpose = 'College / Institution';
    }
    // 6. Degree / Program
    else if (/degree|program|department|branch|course|year/.test(norm)) {
      degreeCol = letter;
      purpose = 'Degree / Branch';
    }
    // 7. Email Status (explicit: email + status, e.g. "Email Status")
    else if (/email\s*status|mail\s*status/.test(norm) || (norm.includes('email') && norm.includes('status'))) {
      emailStatusCol = letter;
      purpose = 'Email Status';
    }
    // 8. Leader Email (contains email/mail, but strictly NOT email status)
    else if (/email|mail/.test(norm) && !leaderEmailCol && !norm.includes('status')) {
      leaderEmailCol = letter;
      purpose = 'Leader Email';
    }
    // 9. Leader Phone
    else if (/phone|mobile|contact|whatsapp/.test(norm) && !leaderPhoneCol) {
      leaderPhoneCol = letter;
      purpose = 'Leader Phone';
    }
    // 10. Attendance Status (strictly matches attendance, present, check-in, but NEVER email status)
    else if ((/attendance|check\s*in/.test(norm) || norm === 'present' || norm === 'attendance status') && !norm.includes('email')) {
      attendanceCol = letter;
      purpose = 'Attendance Status';
    }
    // 11. Payment
    else if (/payment|transaction|utr|screenshot|receipt|fee/.test(norm)) {
      if (!paymentCol) paymentCol = letter;
      purpose = 'Payment Info';
    }
    // 12. Member Count
    else if (/size|count|number\s*of\s*(team\s*)?members/.test(norm)) {
      memberCountCol = letter;
      purpose = 'Member Count';
    }
    // 13. Team Members
    else if (/member\s*\d/.test(norm)) {
      purpose = 'Team Member';
    }

    detectedColumns.push({
      letter,
      index: idx,
      headerName: header.trim(),
      purpose,
    });
  });

  const result = {
    headers: rawHeaders,
    detectedColumns,
    config: {
      teamIdColumn: teamIdCol,
      teamNameColumn: teamNameCol,
      collegeColumn: collegeCol,
      attendanceColumn: attendanceCol,
      emailStatusColumn: emailStatusCol,
      leaderNameColumn: leaderNameCol,
      leaderEmailColumn: leaderEmailCol,
      leaderPhoneColumn: leaderPhoneCol,
      degreeColumn: degreeCol,
      collegeIdColumn: collegeIdCol,
      paymentColumn: paymentCol,
      memberCountColumn: memberCountCol,
      headerRow,
      dataStartRow: headerRow + 1,
    },
    hasTeamId: Boolean(teamIdCol),
    hasAttendance: Boolean(attendanceCol),
    hasEmailStatus: Boolean(emailStatusCol),
  };

  headerConfigCache.set(cacheKey, { data: result, timestamp: Date.now() });

  return result;
}

/**
 * Reads all registration rows and synchronizes teams based solely on Team ID.
 * Narrowed to required columns (A to highest detected column, e.g. Q) and cached for short duration.
 */
export async function syncTeamsFromSheet(
  config: SheetsConfig,
  forceRefresh: boolean = false
): Promise<{
  teams: Team[];
  errors: string[];
  missingIdCount: number;
  duplicateIds: string[];
}> {
  const cacheKey = `${config.spreadsheetId}:${config.worksheetName}`;
  const now = Date.now();

  if (!forceRefresh && teamsCache.has(cacheKey)) {
    const entry = teamsCache.get(cacheKey)!;
    if (now - entry.timestamp < TEAMS_CACHE_TTL_MS) {
      return entry.data;
    }
  }

  const sheets = getSheetsClient();
  const errors: string[] = [];

  // Determine the maximum column needed instead of reading all 702 columns (A:ZZ)
  const columnsToCheck = [
    config.teamIdColumn,
    config.teamNameColumn,
    config.collegeColumn,
    config.leaderNameColumn,
    config.leaderEmailColumn,
    config.leaderPhoneColumn,
    config.degreeColumn,
    config.attendanceColumn,
    config.emailStatusColumn,
    config.collegeIdColumn,
    config.paymentColumn,
    config.memberCountColumn,
  ].filter((col): col is string => Boolean(col));

  let maxColIndex = 16; // default at least Q (index 16)
  for (const col of columnsToCheck) {
    const idx = columnLetterToIndex(col);
    if (idx > maxColIndex) maxColIndex = idx;
  }
  const endColLetter = indexToColumnLetter(maxColIndex);

  const range = `'${config.worksheetName}'!A:${endColLetter}`;
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: config.spreadsheetId,
    range,
  });

  const rows = response.data.values ?? [];
  if (rows.length === 0) {
    const emptyResult = { teams: [], errors: ['No data found in spreadsheet'], missingIdCount: 0, duplicateIds: [] };
    teamsCache.set(cacheKey, { data: emptyResult, timestamp: Date.now() });
    return emptyResult;
  }

  const teamIdIdx = config.teamIdColumn ? columnLetterToIndex(config.teamIdColumn) : -1;
  const teamNameIdx = config.teamNameColumn ? columnLetterToIndex(config.teamNameColumn) : -1;
  const collegeIdx = config.collegeColumn ? columnLetterToIndex(config.collegeColumn) : -1;
  const leaderNameIdx = config.leaderNameColumn ? columnLetterToIndex(config.leaderNameColumn) : -1;
  const leaderEmailIdx = config.leaderEmailColumn ? columnLetterToIndex(config.leaderEmailColumn) : -1;
  const leaderPhoneIdx = config.leaderPhoneColumn ? columnLetterToIndex(config.leaderPhoneColumn) : -1;
  const degreeIdx = config.degreeColumn ? columnLetterToIndex(config.degreeColumn) : -1;
  const attendanceIdx = config.attendanceColumn ? columnLetterToIndex(config.attendanceColumn) : -1;
  const emailStatusIdx = config.emailStatusColumn ? columnLetterToIndex(config.emailStatusColumn) : -1;
  const collegeIdIdx = config.collegeIdColumn ? columnLetterToIndex(config.collegeIdColumn) : -1;
  const paymentIdx = config.paymentColumn ? columnLetterToIndex(config.paymentColumn) : -1;
  const memberCountIdx = config.memberCountColumn ? columnLetterToIndex(config.memberCountColumn) : -1;

  const seenIds = new Map<string, number[]>();
  const dataRows = rows.slice(config.dataStartRow - 1);

  const teams: Team[] = [];
  let missingIdCount = 0;

  dataRows.forEach((row, idx) => {
    const rowNumber = idx + config.dataStartRow;
    const rawTeamId = teamIdIdx >= 0 ? String(row[teamIdIdx] ?? '').trim() : '';

    if (!rawTeamId) {
      missingIdCount++;
      return;
    }

    if (!seenIds.has(rawTeamId)) seenIds.set(rawTeamId, []);
    seenIds.get(rawTeamId)!.push(rowNumber);

    const attendanceValue = attendanceIdx >= 0 ? String(row[attendanceIdx] ?? '').trim() : '';
    const rawCollegeId = collegeIdIdx >= 0 ? String(row[collegeIdIdx] ?? '').trim() : '';
    const collegeIdUrls = rawCollegeId
      ? rawCollegeId.split(/[\s,;|\n]+/).filter(u => u.startsWith('http'))
      : [];

    const paymentVal = paymentIdx >= 0 ? String(row[paymentIdx] ?? '').trim() : '';

    const attendanceUpper = attendanceValue.toUpperCase();
    const isPresent = attendanceUpper === 'P' || attendanceUpper === 'PRESENT';

    // Collect all member names (Leader + Member 2, 3, 4)
    const members: string[] = [];
    if (leaderNameIdx >= 0) {
      const lName = String(row[leaderNameIdx] ?? '').trim();
      if (lName) members.push(`${lName} (Lead)`);
    }
    rows[0]?.forEach((colHeader, cIdx) => {
      const hNorm = String(colHeader ?? '').toLowerCase();
      if (hNorm.includes('member') && !hNorm.includes('number of')) {
        const mVal = String(row[cIdx] ?? '').trim();
        if (mVal && !members.includes(mVal)) {
          members.push(mVal);
        }
      }
    });

    const emailStatus = emailStatusIdx >= 0 ? String(row[emailStatusIdx] ?? '').trim() : undefined;

    teams.push({
      teamId: rawTeamId,
      teamName: teamNameIdx >= 0 ? String(row[teamNameIdx] ?? '').trim() : `Team ${rawTeamId}`,
      college: collegeIdx >= 0 ? String(row[collegeIdx] ?? '').trim() : '',
      leaderName: leaderNameIdx >= 0 ? String(row[leaderNameIdx] ?? '').trim() : undefined,
      leaderEmail: leaderEmailIdx >= 0 ? String(row[leaderEmailIdx] ?? '').trim() : undefined,
      leaderPhone: leaderPhoneIdx >= 0 ? String(row[leaderPhoneIdx] ?? '').trim() : undefined,
      degree: degreeIdx >= 0 ? String(row[degreeIdx] ?? '').trim() : undefined,
      memberCount: memberCountIdx >= 0 ? parseInt(String(row[memberCountIdx] ?? '0')) || (members.length || undefined) : (members.length || undefined),
      members: members.length > 0 ? members : undefined,
      collegeIdUrls: collegeIdUrls.length > 0 ? collegeIdUrls : (rawCollegeId ? [rawCollegeId] : undefined),
      paymentRef: paymentVal || undefined,
      paymentStatus: paymentVal ? 'Submitted' : 'Pending',
      isPresent,
      attendanceValue,
      emailStatus: emailStatus || undefined,
      rowIndex: rowNumber,
      syncedAt: new Date().toISOString(),
    });
  });

  const duplicateIds: string[] = [];
  for (const [id, rowNums] of seenIds.entries()) {
    if (rowNums.length > 1) {
      duplicateIds.push(id);
      errors.push(`Duplicate Team ID '${id}' found on rows: ${rowNums.join(', ')}`);
    }
  }

  const result = { teams, errors, missingIdCount, duplicateIds };
  teamsCache.set(cacheKey, { data: result, timestamp: Date.now() });
  return result;
}

/**
 * Controlled, collision-safe Team ID provisioning workflow.
 * Generates unique IDs like 'LAK-001' and writes them to the specified Team ID column.
 */
export async function provisionTeamIds(
  spreadsheetId: string,
  worksheetName: string,
  teamIdColumnLetter: string,
  headerRow: number = 1,
  dataStartRow: number = 2,
  prefix: string = 'LAK-'
): Promise<{
  provisionedCount: number;
  assignedMap: { rowIndex: number; teamId: string }[];
  errors: string[];
}> {
  const sheets = getSheetsClient();
  const errors: string[] = [];

  // Read full range to determine existing max sequence number and empty rows
  const range = `'${worksheetName}'!A:ZZ`;
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  const rows = response.data.values ?? [];
  const teamIdColIdx = columnLetterToIndex(teamIdColumnLetter);
  const dataRows = rows.slice(dataStartRow - 1);

  // Scan existing IDs to find maximum sequence number
  let maxSeq = 0;
  dataRows.forEach(row => {
    const existingId = String(row[teamIdColIdx] ?? '').trim();
    if (existingId.startsWith(prefix)) {
      const numPart = parseInt(existingId.replace(prefix, ''), 10);
      if (!isNaN(numPart) && numPart > maxSeq) {
        maxSeq = numPart;
      }
    }
  });

  // Provision IDs for rows that are missing one
  const assignedMap: { rowIndex: number; teamId: string }[] = [];
  const updates: { range: string; values: string[][] }[] = [];

  dataRows.forEach((row, idx) => {
    const rowNum = idx + dataStartRow;
    const existingId = String(row[teamIdColIdx] ?? '').trim();

    // Check if this row actually has registration data
    const hasData = row.some(cell => String(cell).trim().length > 0);
    if (!hasData) return;

    if (!existingId) {
      maxSeq++;
      const paddedNum = String(maxSeq).padStart(3, '0');
      const newId = `${prefix}${paddedNum}`;

      assignedMap.push({ rowIndex: rowNum, teamId: newId });
      updates.push({
        range: `'${worksheetName}'!${teamIdColumnLetter}${rowNum}`,
        values: [[newId]],
      });
    }
  });

  if (updates.length === 0) {
    return { provisionedCount: 0, assignedMap: [], errors: [] };
  }

  // Batch update assigned Team IDs
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: updates,
    },
  });

  // Re-read and verify each written value
  for (const item of assignedMap) {
    const verifyRange = `'${worksheetName}'!${teamIdColumnLetter}${item.rowIndex}`;
    const check = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: verifyRange,
    });
    const verifiedVal = String(check.data.values?.[0]?.[0] ?? '').trim();
    if (verifiedVal !== item.teamId) {
      errors.push(`Verification failed for row ${item.rowIndex}: expected ${item.teamId}, found ${verifiedVal}`);
    }
  }

  return {
    provisionedCount: assignedMap.length,
    assignedMap,
    errors,
  };
}

/**
 * Re-reads row, verifies Team ID uniqueness & position, then safely writes 'P' to attendance cell.
 */
export async function writeAttendance(
  config: SheetsConfig,
  teamId: string,
  rowIndex: number
): Promise<{ success: boolean; verifiedValue?: string; error?: string }> {
  if (!config.attendanceColumn) {
    return { success: false, error: 'Attendance column is not configured in SheetsConfig.' };
  }

  // CRITICAL SAFETY GUARD: Confirm attendance write CANNOT target email status column
  if (config.emailStatusColumn && config.attendanceColumn.toUpperCase() === config.emailStatusColumn.toUpperCase()) {
    return {
      success: false,
      error: `Safety Guard Violation: Attendance column '${config.attendanceColumn}' matches email status column '${config.emailStatusColumn}'. Write aborted to prevent data corruption.`,
    };
  }
  if (config.attendanceColumn.toUpperCase() === 'Q') {
    return {
      success: false,
      error: `Safety Guard Violation: Attendance write attempted to target Column Q (Email Status). Attendance must write strictly to Column P.`,
    };
  }

  const sheets = getSheetsClient();

  try {
    // 1 & 2. Atomic batch read of Team ID and Attendance cell (halves read round-trips)
    const verifyRange = `'${config.worksheetName}'!${config.teamIdColumn}${rowIndex}`;
    const attendanceRange = `'${config.worksheetName}'!${config.attendanceColumn}${rowIndex}`;

    const batchRes = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: config.spreadsheetId,
      ranges: [verifyRange, attendanceRange],
    });

    const valueRanges = batchRes.data.valueRanges ?? [];
    const actualTeamId = String(valueRanges[0]?.values?.[0]?.[0] ?? '').trim();
    if (actualTeamId.toLowerCase() !== teamId.toLowerCase()) {
      return {
        success: false,
        error: `Row position mismatch: Expected Team ID '${teamId}' at row ${rowIndex}, but found '${actualTeamId}'.`,
      };
    }

    const currentValue = String(valueRanges[1]?.values?.[0]?.[0] ?? '').trim();
    if (currentValue.toUpperCase() === 'PRESENT' || currentValue.toUpperCase() === 'P') {
      return { success: true, verifiedValue: currentValue };
    }

    // 3. Write canonical 'P'
    await sheets.spreadsheets.values.update({
      spreadsheetId: config.spreadsheetId,
      range: attendanceRange,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [['P']] },
    });

    // 4. Verify the written value from Google Sheets
    const confirmResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: config.spreadsheetId,
      range: attendanceRange,
    });
    const confirmedValue = String(confirmResponse.data.values?.[0]?.[0] ?? '').trim();

    if (confirmedValue.toUpperCase() !== 'P' && confirmedValue.toUpperCase() !== 'PRESENT') {
      return {
        success: false,
        error: `Verification failed: Attendance cell read back '${confirmedValue}' instead of canonical 'P'.`,
      };
    }

    // Invalidate cached teams so subsequent fetch sees updated attendance
    invalidateTeamsCache(config.spreadsheetId);

    return { success: true, verifiedValue: confirmedValue };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown Google Sheets error during attendance write.',
    };
  }
}

/**
 * Safely writes email status (SENT, FAILED, PENDING) strictly to the configured emailStatusColumn.
 * Guarantees that updating email status CANNOT overwrite Attendance (Column P).
 */
export async function writeEmailStatus(
  config: SheetsConfig,
  teamId: string,
  rowIndex: number,
  status: 'SENT' | 'FAILED' | 'PENDING' | string
): Promise<{ success: boolean; verifiedValue?: string; error?: string }> {
  if (!config.emailStatusColumn) {
    return { success: false, error: 'Email status column is not configured in SheetsConfig.' };
  }

  // CRITICAL SAFETY GUARD: Confirm email status write CANNOT target attendance column
  if (config.attendanceColumn && config.emailStatusColumn.toUpperCase() === config.attendanceColumn.toUpperCase()) {
    return {
      success: false,
      error: `Safety Guard Violation: Email status column '${config.emailStatusColumn}' matches attendance column '${config.attendanceColumn}'. Write aborted to prevent data corruption.`,
    };
  }
  if (config.emailStatusColumn.toUpperCase() === 'P') {
    return {
      success: false,
      error: `Safety Guard Violation: Email status write attempted to target Column P (Attendance). Email status must write strictly to Column Q.`,
    };
  }

  const sheets = getSheetsClient();

  try {
    // 1. Re-validate Team ID at target row
    const verifyRange = `'${config.worksheetName}'!${config.teamIdColumn}${rowIndex}`;
    const verifyResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: config.spreadsheetId,
      range: verifyRange,
    });

    const actualTeamId = String(verifyResponse.data.values?.[0]?.[0] ?? '').trim();
    if (actualTeamId !== teamId) {
      return {
        success: false,
        error: `Row position mismatch: Expected Team ID '${teamId}' at row ${rowIndex}, but found '${actualTeamId}'.`,
      };
    }

    // 2. Target email status cell
    const emailRange = `'${config.worksheetName}'!${config.emailStatusColumn}${rowIndex}`;

    // 3. Write status to email column
    await sheets.spreadsheets.values.update({
      spreadsheetId: config.spreadsheetId,
      range: emailRange,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[status]] },
    });

    // 4. Verify the written value from Google Sheets
    const confirmResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: config.spreadsheetId,
      range: emailRange,
    });
    const confirmedValue = String(confirmResponse.data.values?.[0]?.[0] ?? '').trim();

    if (confirmedValue.toUpperCase() !== status.toUpperCase()) {
      return {
        success: false,
        error: `Verification failed: Email status cell read back '${confirmedValue}' instead of '${status}'.`,
      };
    }

    return { success: true, verifiedValue: confirmedValue };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown Google Sheets error during email status write.',
    };
  }
}

/**
 * Extracts Google Drive file ID from a Drive URL or reference.
 */
export function extractDriveFileId(urlOrId: string): string | null {
  if (!urlOrId) return null;
  const trimmed = urlOrId.trim();

  // Already a raw alphanumeric file ID
  if (/^[a-zA-Z0-9_-]{25,}$/.test(trimmed)) {
    return trimmed;
  }

  // Matching drive.google.com/file/d/{id} or /open?id={id} or /d/{id}
  const match = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/) ||
                trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);

  return match ? match[1] : null;
}
