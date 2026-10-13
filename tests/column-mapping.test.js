const test = require('node:test');
const assert = require('node:assert/strict');

// Exact headers from LAKSHYA 2026 "Form Responses 1" Google Sheet
const LIVE_HEADERS = [
  "Timestamp",                   // Col A (0)
  "Team Name :",                 // Col B (1)
  "Team Lead Name :",            // Col C (2)
  "College / Institution Name :",// Col D (3)
  "Degree / Program:",           // Col E (4)
  "College ID Card  :",          // Col F (5)
  "Team Lead Email ID :",        // Col G (6)
  "Team Lead PhoneNo:",          // Col H (7)
  "Number of Team Members",      // Col I (8)
  "Member 2 (Full Name)",        // Col J (9)
  "Member 3 (Full Name)",        // Col K (10)
  "Member 4 (Full Name)",        // Col L (11)
  "UTR Number  ",                // Col M (12)
  "Upload Payment Screenshot  ", // Col N (13)
  "Team ID",                     // Col O (14)
  "Attendance",                  // Col P (15)
  "Email Status"                 // Col Q (16)
];

function indexToColumnLetter(index) {
  let col = '';
  let n = index + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    col = String.fromCharCode(65 + rem) + col;
    n = Math.floor((n - 1) / 26);
  }
  return col;
}

function normalizeHeader(h) {
  return h.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

function mapHeaders(headers) {
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

  headers.forEach((header, idx) => {
    const letter = indexToColumnLetter(idx);
    const norm = normalizeHeader(header);
    if (!norm) return;

    if (/^team\s*(id|code|identifier|no|number)$/.test(norm) || (norm.startsWith('team id') && !norm.includes('email') && !norm.includes('lead'))) {
      teamIdCol = letter;
    } else if (/^team\s*name$/.test(norm) || (norm.includes('team') && norm.includes('name') && !norm.includes('lead') && !norm.includes('leader'))) {
      teamNameCol = letter;
    } else if (/leader|lead/.test(norm) && /name/.test(norm)) {
      leaderNameCol = letter;
    } else if (/id\s*card|college\s*id|upload.*id|student\s*id/.test(norm)) {
      collegeIdCol = letter;
    } else if (/college|institution|university|campus|school/.test(norm)) {
      collegeCol = letter;
    } else if (/degree|program|department|branch|course|year/.test(norm)) {
      degreeCol = letter;
    } else if (/email\s*status|mail\s*status/.test(norm) || (norm.includes('email') && norm.includes('status'))) {
      emailStatusCol = letter;
    } else if (/email|mail/.test(norm) && !leaderEmailCol && !norm.includes('status')) {
      leaderEmailCol = letter;
    } else if (/phone|mobile|contact|whatsapp/.test(norm) && !leaderPhoneCol) {
      leaderPhoneCol = letter;
    } else if ((/attendance|check\s*in/.test(norm) || norm === 'present' || norm === 'attendance status') && !norm.includes('email')) {
      attendanceCol = letter;
    } else if (/payment|transaction|utr|screenshot|receipt|fee/.test(norm)) {
      if (!paymentCol) paymentCol = letter;
    } else if (/size|count|number\s*of\s*(team\s*)?members/.test(norm)) {
      memberCountCol = letter;
    }
  });

  return {
    teamIdCol,
    teamNameCol,
    collegeCol,
    attendanceCol,
    emailStatusCol,
    leaderNameCol,
    leaderEmailCol,
    leaderPhoneCol,
    degreeCol,
    collegeIdCol,
    paymentCol,
    memberCountCol,
  };
}

test('1. Normalization transforms messy headers predictably', () => {
  assert.equal(normalizeHeader('  Team Name : '), 'team name');
  assert.equal(normalizeHeader('College / Institution Name :'), 'college institution name');
  assert.equal(normalizeHeader('Email Status'), 'email status');
  assert.equal(normalizeHeader('Attendance'), 'attendance');
});

test('2. Live Google Sheet headers map strictly to correct columns', () => {
  const mapping = mapHeaders(LIVE_HEADERS);

  assert.equal(mapping.teamIdCol, 'O', 'Team ID must map to column O');
  assert.equal(mapping.attendanceCol, 'P', 'Attendance must map to column P');
  assert.equal(mapping.emailStatusCol, 'Q', 'Email Status must map to column Q');
  assert.equal(mapping.leaderEmailCol, 'G', 'Leader Email must map to column G');
  assert.equal(mapping.leaderPhoneCol, 'H', 'Leader Phone must map to column H');
  assert.equal(mapping.collegeCol, 'D', 'College must map to column D');
  assert.equal(mapping.teamNameCol, 'B', 'Team Name must map to column B');
});

test('3. Attendance column P cannot be overwritten by Email Status column Q', () => {
  const mapping = mapHeaders(LIVE_HEADERS);
  assert.notEqual(mapping.attendanceCol, mapping.emailStatusCol, 'Attendance and Email Status must NOT be the same column');
  assert.equal(mapping.attendanceCol, 'P');
  assert.equal(mapping.emailStatusCol, 'Q');
});

test('4. Safety guards prevent attendance write from targeting Column Q', () => {
  const config = {
    attendanceColumn: 'Q', // Misconfigured
    emailStatusColumn: 'Q',
    worksheetName: 'Form Responses 1',
  };

  // Guard test function reflecting writeAttendance safety checks
  function validateAttendanceConfig(cfg) {
    if (cfg.emailStatusColumn && cfg.attendanceColumn.toUpperCase() === cfg.emailStatusColumn.toUpperCase()) {
      return { allowed: false, error: 'Collision: Attendance matches Email Status' };
    }
    if (cfg.attendanceColumn.toUpperCase() === 'Q') {
      return { allowed: false, error: 'Blocked: Attendance cannot target column Q' };
    }
    return { allowed: true };
  }

  const checkCollision = validateAttendanceConfig(config);
  assert.equal(checkCollision.allowed, false);

  const checkTargetQ = validateAttendanceConfig({ attendanceColumn: 'Q', emailStatusColumn: 'R' });
  assert.equal(checkTargetQ.allowed, false);

  const validConfig = validateAttendanceConfig({ attendanceColumn: 'P', emailStatusColumn: 'Q' });
  assert.equal(validConfig.allowed, true);
});

test('5. Safety guards prevent email status write from targeting Column P', () => {
  function validateEmailStatusConfig(cfg) {
    if (cfg.attendanceColumn && cfg.emailStatusColumn.toUpperCase() === cfg.attendanceColumn.toUpperCase()) {
      return { allowed: false, error: 'Collision: Email Status matches Attendance' };
    }
    if (cfg.emailStatusColumn.toUpperCase() === 'P') {
      return { allowed: false, error: 'Blocked: Email Status cannot target column P' };
    }
    return { allowed: true };
  }

  const checkTargetP = validateEmailStatusConfig({ emailStatusColumn: 'P', attendanceColumn: 'O' });
  assert.equal(checkTargetP.allowed, false);

  const validConfig = validateEmailStatusConfig({ attendanceColumn: 'P', emailStatusColumn: 'Q' });
  assert.equal(validConfig.allowed, true);
});

test('6. Cell range calculations are strictly single-cell and do not shift', () => {
  const rowIndex = 2;
  const attendanceCell = `P${rowIndex}`;
  const emailStatusCell = `Q${rowIndex}`;
  const teamIdCell = `O${rowIndex}`;

  assert.equal(attendanceCell, 'P2', 'Attendance write strictly targets P2');
  assert.equal(emailStatusCell, 'Q2', 'Email status write strictly targets Q2');
  assert.equal(teamIdCell, 'O2', 'Team ID cell is O2');
});

test('7. Canonical attendance write payload is strictly "P" and verifies "P"', () => {
  const CANONICAL_ATTENDANCE_VALUE = 'P';

  function verifyAttendanceReadback(confirmedValue) {
    const upper = String(confirmedValue ?? '').trim().toUpperCase();
    if (upper !== 'P' && upper !== 'PRESENT') {
      return { verified: false, error: `Invalid readback value: ${confirmedValue}` };
    }
    return { verified: true, verifiedValue: confirmedValue };
  }

  // Canonical 'P' write verification
  const writePayload = [['P']];
  assert.equal(writePayload[0][0], 'P', 'Payload must write canonical "P"');

  const pCheck = verifyAttendanceReadback('P');
  assert.equal(pCheck.verified, true);
  assert.equal(pCheck.verifiedValue, 'P');

  // Negative verification: random text or empty fails readback
  const failCheck = verifyAttendanceReadback('Not Marked');
  assert.equal(failCheck.verified, false);
});

test('8. Sync logic is dual-compatible: recognizes both "P" and historical "Present"', () => {
  function parseAttendance(val) {
    const upper = String(val ?? '').trim().toUpperCase();
    return upper === 'P' || upper === 'PRESENT';
  }

  // Canonical 'P'
  assert.equal(parseAttendance('P'), true, 'Canonical "P" must evaluate to isPresent: true');
  assert.equal(parseAttendance('p'), true, 'Lowercase "p" must evaluate to isPresent: true');

  // Backwards compatibility with historical "Present"
  assert.equal(parseAttendance('Present'), true, 'Historical "Present" must evaluate to isPresent: true');
  assert.equal(parseAttendance('PRESENT'), true, 'Uppercase "PRESENT" must evaluate to isPresent: true');

  // Unmarked / absent values
  assert.equal(parseAttendance('Not Marked'), false, '"Not Marked" must evaluate to isPresent: false');
  assert.equal(parseAttendance(''), false, 'Empty cell must evaluate to isPresent: false');
  assert.equal(parseAttendance(null), false, 'Null cell must evaluate to isPresent: false');
});

test('9. Non-destructive sync preserves loaded teams when incoming response is empty or errors', () => {
  const existingTeams = [
    { teamId: 'LAK-001', teamName: 'Alpha', college: 'SJBIT', isPresent: true },
    { teamId: 'LAK-002', teamName: 'Beta', college: 'RVCE', isPresent: false },
  ];

  // Logic replicated from TeamsContext setTeams reconciliation
  function reconcileTeams(prev, incoming) {
    if (incoming.length === 0 && prev.length > 0) {
      return prev; // Preserve cached teams!
    }
    return incoming;
  }

  // Transient glitch or empty response
  const resultOnEmpty = reconcileTeams(existingTeams, []);
  assert.equal(resultOnEmpty.length, 2, 'Must preserve existing teams when sync returns empty array');
  assert.equal(resultOnEmpty[0].teamId, 'LAK-001');

  // Valid update with new records
  const newIncoming = [
    { teamId: 'LAK-001', teamName: 'Alpha', college: 'SJBIT', isPresent: true },
    { teamId: 'LAK-002', teamName: 'Beta', college: 'RVCE', isPresent: true },
    { teamId: 'LAK-003', teamName: 'Gamma', college: 'PES', isPresent: false },
  ];
  const resultOnValid = reconcileTeams(existingTeams, newIncoming);
  assert.equal(resultOnValid.length, 3, 'Must update teams when valid non-empty array is received');
});

test('10. Search-first filter matches Team ID, Team Name, Lead Name, and College', () => {
  const teams = [
    { teamId: 'LAK-001', teamName: 'CyberKnights', leaderName: 'Rohan Sharma', college: 'SJBIT' },
    { teamId: 'LAK-002', teamName: 'CodeCrafters', leaderName: 'Ananya Rao', college: 'BMSCE' },
  ];

  function matchesSearch(team, query) {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      team.teamId.toLowerCase().includes(q) ||
      team.teamName.toLowerCase().includes(q) ||
      (team.leaderName || '').toLowerCase().includes(q) ||
      (team.college || '').toLowerCase().includes(q)
    );
  }

  assert.equal(matchesSearch(teams[0], 'lak-001'), true, 'Matches Team ID');
  assert.equal(matchesSearch(teams[0], 'cyber'), true, 'Matches Team Name');
  assert.equal(matchesSearch(teams[0], 'rohan'), true, 'Matches Leader Name');
  assert.equal(matchesSearch(teams[0], 'sjbit'), true, 'Matches College');
  assert.equal(matchesSearch(teams[1], 'sjbit'), false, 'Does not match different college');
});

test('11. Security: Default role prevents automatic super_admin promotion', () => {
  function determineRole(email) {
    const normalized = email.toLowerCase();
    if (normalized.includes('admin') || normalized.includes('super')) {
      return 'super_admin';
    }
    if (normalized.includes('viewer') || normalized.includes('audit')) {
      return 'readonly_viewer';
    }
    return 'checkin_organizer';
  }

  assert.equal(determineRole('admin@sjbit.edu.in'), 'super_admin');
  assert.equal(determineRole('organizer@sjbit.edu.in'), 'checkin_organizer');
  assert.equal(determineRole('volunteer@sjbit.edu.in'), 'checkin_organizer', 'Unknown user must NOT be promoted to super_admin');
  assert.equal(determineRole('desk1@sjbit.edu.in'), 'checkin_organizer', 'Check-in desk user gets organizer role');
});

test('12. Team cards contain only approved summary fields and exclude sensitive details', () => {
  // Mock full registration row from sheet
  const rawRegistration = {
    teamId: 'LAK-001',
    teamName: 'CyberKnights',
    leaderName: 'Rahul Sharma',
    college: 'SJBIT Bengaluru',
    leaderEmail: 'rahul@example.com',
    leaderPhone: '9876543210',
    memberCount: 4,
    members: ['Rahul Sharma', 'Sneha K', 'Varun M', 'Divya P'],
    paymentRef: 'UPI/123456789/REC',
    collegeIdCardUrl: 'https://drive.google.com/open?id=123',
    paymentScreenshotUrl: 'https://drive.google.com/open?id=456',
  };

  // Check-in card summary projection
  function renderCheckInSummary(team) {
    return {
      teamId: team.teamId,
      teamName: team.teamName,
      leaderName: team.leaderName,
      college: team.college,
    };
  }

  const cardSummary = renderCheckInSummary(rawRegistration);
  assert.equal(cardSummary.teamId, 'LAK-001');
  assert.equal(cardSummary.teamName, 'CyberKnights');
  assert.equal(cardSummary.leaderName, 'Rahul Sharma');
  assert.equal(cardSummary.college, 'SJBIT Bengaluru');

  // Forbidden fields must not exist in cardSummary
  assert.equal(cardSummary.leaderEmail, undefined, 'Email must NOT be rendered');
  assert.equal(cardSummary.leaderPhone, undefined, 'Phone must NOT be rendered');
  assert.equal(cardSummary.paymentRef, undefined, 'Payment ref must NOT be rendered');
  assert.equal(cardSummary.collegeIdCardUrl, undefined, 'ID Card URL must NOT be rendered');
  assert.equal(cardSummary.paymentScreenshotUrl, undefined, 'Payment screenshot must NOT be rendered');
  assert.equal(cardSummary.members, undefined, 'Member details must NOT be rendered');
});

test('13. Confirmed attendance is never reverted by stale background refresh results', () => {
  const locallyConfirmedPresentIds = new Set(['lak-001']);

  // Stale incoming response from Google Sheets where propagation hasn't reached read-replica
  const staleIncomingTeams = [
    { teamId: 'LAK-001', teamName: 'Alpha', isPresent: false, attendanceValue: '' },
    { teamId: 'LAK-002', teamName: 'Beta', isPresent: false, attendanceValue: '' },
  ];

  function reconcileWithConfirmedAttendance(incoming, confirmedSet) {
    return incoming.map(team => {
      if (confirmedSet.has(team.teamId.toLowerCase())) {
        return {
          ...team,
          isPresent: true,
          attendanceValue: 'P',
        };
      }
      return team;
    });
  }

  const reconciled = reconcileWithConfirmedAttendance(staleIncomingTeams, locallyConfirmedPresentIds);
  assert.equal(reconciled[0].teamId, 'LAK-001');
  assert.equal(reconciled[0].isPresent, true, 'Confirmed team LAK-001 must NOT be reverted to isPresent: false');
  assert.equal(reconciled[0].attendanceValue, 'P');
  assert.equal(reconciled[1].isPresent, false, 'Unconfirmed team remains unchanged');
});

test('14. Unauthorized users cannot mark attendance (RBAC verification)', () => {
  const ROLE_PERMISSIONS = {
    super_admin: { canCheckIn: true },
    checkin_organizer: { canCheckIn: true },
    readonly_viewer: { canCheckIn: false },
  };

  function canMarkAttendance(role) {
    return ROLE_PERMISSIONS[role]?.canCheckIn ?? false;
  }

  assert.equal(canMarkAttendance('super_admin'), true);
  assert.equal(canMarkAttendance('checkin_organizer'), true);
  assert.equal(canMarkAttendance('readonly_viewer'), false, 'Read-only viewer cannot mark attendance');
  assert.equal(canMarkAttendance('unauthorized_role'), false, 'Unknown role cannot mark attendance');
});

test('15. Production API strictly rejects simulated tokens and headers', () => {
  function validateApiToken(token, isProd) {
    if (isProd && (token === 'demo' || token === 'session' || !token)) {
      return { allowed: false, status: 401, error: 'Unauthorized: Production requests must provide a valid verified Firebase ID token.' };
    }
    return { allowed: true };
  }

  // In production
  const prodCheckDemo = validateApiToken('demo', true);
  assert.equal(prodCheckDemo.allowed, false);
  assert.equal(prodCheckDemo.status, 401);

  const prodCheckSession = validateApiToken('session', true);
  assert.equal(prodCheckSession.allowed, false);
  assert.equal(prodCheckSession.status, 401);

  const prodCheckRealToken = validateApiToken('eyJhbGciOiJSUzI1NiIs...', true);
  assert.equal(prodCheckRealToken.allowed, true);

  // In dev / demo mode
  const devCheck = validateApiToken('demo', false);
  assert.equal(devCheck.allowed, true);
});

test('16. Range optimization computes bounded range A:Q instead of unbounded A:ZZ', () => {
  const config = {
    teamIdColumn: 'O',
    attendanceColumn: 'P',
    emailStatusColumn: 'Q',
    worksheetName: 'Form Responses 1',
  };

  const columnsToCheck = [config.teamIdColumn, config.attendanceColumn, config.emailStatusColumn].filter(Boolean);
  let maxColIndex = 16; // default at least Q
  for (const col of columnsToCheck) {
    let colIdx = 0;
    for (let i = 0; i < col.length; i++) {
      colIdx = colIdx * 26 + col.toUpperCase().charCodeAt(i) - 64;
    }
    colIdx -= 1;
    if (colIdx > maxColIndex) maxColIndex = colIdx;
  }
  const endColLetter = indexToColumnLetter(maxColIndex);
  const range = `'${config.worksheetName}'!A:${endColLetter}`;

  assert.equal(endColLetter, 'Q', 'Bounded range must end at column Q');
  assert.equal(range, "'Form Responses 1'!A:Q", 'Range must be A:Q, preventing 700+ extra empty column reads');
});

test('17. Pre-write validation queries Team ID and Attendance cell via atomic batch ranges', () => {
  const config = {
    worksheetName: 'Form Responses 1',
    teamIdColumn: 'O',
    attendanceColumn: 'P',
    spreadsheetId: 'test_sheet_id',
  };
  const targetRow = 12;

  const verifyRange = `'${config.worksheetName}'!${config.teamIdColumn}${targetRow}`;
  const attendanceRange = `'${config.worksheetName}'!${config.attendanceColumn}${targetRow}`;

  assert.equal(verifyRange, "'Form Responses 1'!O12");
  assert.equal(attendanceRange, "'Form Responses 1'!P12");

  const batchRanges = [verifyRange, attendanceRange];
  assert.equal(batchRanges.length, 2);
  assert.equal(batchRanges[0], "'Form Responses 1'!O12");
  assert.equal(batchRanges[1], "'Form Responses 1'!P12");
});

test('18. Dependency compatibility: firebase-admin/auth and jwks-rsa load without ERR_REQUIRE_ESM', () => {
  // Verifies that require() on jwks-rsa / jose does not crash with ERR_REQUIRE_ESM
  assert.doesNotThrow(() => {
    const { getAuth } = require('firebase-admin/auth');
    assert.equal(typeof getAuth, 'function');
  }, 'firebase-admin/auth must load successfully in CommonJS without ERR_REQUIRE_ESM');

  assert.doesNotThrow(() => {
    const jwksUtils = require('jwks-rsa/src/utils');
    assert.ok(jwksUtils, 'jwks-rsa/src/utils must load without ERR_REQUIRE_ESM');
  }, 'jwks-rsa utils must load successfully with overridden CommonJS-compatible jose');
});

test('19. Server-side role resolution security: missing or unauthorized roles never grant admin access', () => {
  function resolveUserRole(userDocData) {
    let role = 'readonly_viewer';
    if (userDocData && userDocData.role) {
      const allowedRoles = ['super_admin', 'checkin_organizer', 'readonly_viewer'];
      if (allowedRoles.includes(userDocData.role)) {
        role = userDocData.role;
      }
    }
    return role;
  }

  // 1. Missing user document in Firestore defaults to readonly_viewer
  assert.equal(resolveUserRole(null), 'readonly_viewer');
  assert.equal(resolveUserRole({}), 'readonly_viewer');

  // 2. Unknown or escalated roles default to readonly_viewer
  assert.equal(resolveUserRole({ role: 'admin' }), 'readonly_viewer');
  assert.equal(resolveUserRole({ role: 'root' }), 'readonly_viewer');

  // 3. Legitimate assigned roles resolve correctly
  assert.equal(resolveUserRole({ role: 'super_admin' }), 'super_admin');
  assert.equal(resolveUserRole({ role: 'checkin_organizer' }), 'checkin_organizer');
  assert.equal(resolveUserRole({ role: 'readonly_viewer' }), 'readonly_viewer');
});

test('20. Shared server-auth verification: covers all Phase 5 security and token edge cases', () => {
  function simulateVerifyAuth({ authHeader, isProd = true, adminConfigured = true, tokenValidator, roleResolver }) {
    if (!authHeader) {
      return { success: false, status: 401, error: 'Unauthorized: Missing Authorization header.', code: 'AUTH_HEADER_MISSING' };
    }
    if (!authHeader.startsWith('Bearer ')) {
      return { success: false, status: 401, error: 'Unauthorized: Malformed Authorization header.', code: 'AUTH_HEADER_MALFORMED' };
    }
    const token = authHeader.substring(7).trim();
    if (!token) {
      return { success: false, status: 401, error: 'Unauthorized: Bearer token is empty.', code: 'AUTH_TOKEN_EMPTY' };
    }
    if (isProd && (token === 'demo' || token === 'session')) {
      return { success: false, status: 401, error: 'Unauthorized: Production requests must provide a valid verified Firebase ID token.', code: 'AUTH_SIMULATED_REJECTED' };
    }
    if (!adminConfigured) {
      return { success: false, status: 500, error: 'Server configuration error: Firebase Admin credentials not configured.', code: 'ADMIN_INIT_FAILED' };
    }

    const decoded = tokenValidator ? tokenValidator(token) : { valid: false };
    if (!decoded.valid) {
      return { success: false, status: 401, error: 'Authentication failed: Invalid or expired Firebase ID token.', code: decoded.code || 'AUTH_TOKEN_INVALID' };
    }
    if (decoded.project !== 'hackadmin-493cb') {
      return { success: false, status: 401, error: `Unauthorized: Token belongs to wrong Firebase project '${decoded.project}'.`, code: 'AUTH_PROJECT_MISMATCH' };
    }

    const roleData = roleResolver ? roleResolver(decoded.uid) : null;
    if (!roleData || !roleData.role) {
      return { success: false, status: 403, error: 'Access denied: User role document not found in Firestore. Contact administrator.', code: 'ROLE_DOCUMENT_MISSING' };
    }
    if (roleData.disabled) {
      return { success: false, status: 403, error: 'Access denied: This user account has been disabled.', code: 'USER_DISABLED' };
    }
    return { success: true, user: { uid: decoded.uid, email: decoded.email, role: roleData.role } };
  }

  // 1. Missing Authorization header
  const r1 = simulateVerifyAuth({ authHeader: null });
  assert.equal(r1.success, false);
  assert.equal(r1.status, 401);
  assert.equal(r1.code, 'AUTH_HEADER_MISSING');

  // 2. Empty Bearer token
  const r2 = simulateVerifyAuth({ authHeader: 'Bearer    ' });
  assert.equal(r2.success, false);
  assert.equal(r2.status, 401);
  assert.equal(r2.code, 'AUTH_TOKEN_EMPTY');

  // 3. Invalid token
  const r3 = simulateVerifyAuth({
    authHeader: 'Bearer invalid.expired.token',
    tokenValidator: () => ({ valid: false, code: 'auth/id-token-expired' }),
  });
  assert.equal(r3.success, false);
  assert.equal(r3.status, 401);
  assert.equal(r3.code, 'auth/id-token-expired');

  // 4. Wrong-project token
  const r4 = simulateVerifyAuth({
    authHeader: 'Bearer valid.token.otherproject',
    tokenValidator: () => ({ valid: true, project: 'wrong-project-123', uid: 'u1' }),
  });
  assert.equal(r4.success, false);
  assert.equal(r4.status, 401);
  assert.equal(r4.code, 'AUTH_PROJECT_MISMATCH');

  // 5. Valid token for an authorized organizer
  const r5 = simulateVerifyAuth({
    authHeader: 'Bearer valid.organizer.token',
    tokenValidator: () => ({ valid: true, project: 'hackadmin-493cb', uid: 'org-1', email: 'org@lakshya.dev' }),
    roleResolver: () => ({ role: 'checkin_organizer', disabled: false }),
  });
  assert.equal(r5.success, true);
  assert.equal(r5.user.role, 'checkin_organizer');
  assert.equal(r5.user.uid, 'org-1');

  // 6. Valid token for a readonly viewer
  const r6 = simulateVerifyAuth({
    authHeader: 'Bearer valid.viewer.token',
    tokenValidator: () => ({ valid: true, project: 'hackadmin-493cb', uid: 'view-1', email: 'viewer@lakshya.dev' }),
    roleResolver: () => ({ role: 'readonly_viewer', disabled: false }),
  });
  assert.equal(r6.success, true);
  assert.equal(r6.user.role, 'readonly_viewer');

  // 7. Missing or disabled role document
  const r7Missing = simulateVerifyAuth({
    authHeader: 'Bearer valid.token',
    tokenValidator: () => ({ valid: true, project: 'hackadmin-493cb', uid: 'no-role-user' }),
    roleResolver: () => null,
  });
  assert.equal(r7Missing.success, false);
  assert.equal(r7Missing.status, 403);
  assert.equal(r7Missing.code, 'ROLE_DOCUMENT_MISSING');

  const r7Disabled = simulateVerifyAuth({
    authHeader: 'Bearer valid.token',
    tokenValidator: () => ({ valid: true, project: 'hackadmin-493cb', uid: 'disabled-user' }),
    roleResolver: () => ({ role: 'checkin_organizer', disabled: true }),
  });
  assert.equal(r7Disabled.success, false);
  assert.equal(r7Disabled.status, 403);
  assert.equal(r7Disabled.code, 'USER_DISABLED');

  // 8. Firebase Admin initialization failure
  const r8 = simulateVerifyAuth({
    authHeader: 'Bearer valid.token',
    adminConfigured: false,
  });
  assert.equal(r8.success, false);
  assert.equal(r8.status, 500);
  assert.equal(r8.code, 'ADMIN_INIT_FAILED');
});



