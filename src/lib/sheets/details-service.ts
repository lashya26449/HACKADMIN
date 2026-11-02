import { getSheetsClient } from './service';
import type { TeamDetailRecord, TeamMemberDetail } from '@/types';

export interface DetailsFetchResult {
  success: boolean;
  teams: TeamDetailRecord[];
  source: 'live_google_sheet' | 'demo_preview';
  permissionNeeded?: boolean;
  serviceAccountEmail?: string;
  spreadsheetId: string;
  error?: string;
  timestamp: string;
}

/**
 * Natural comparator for Team IDs (e.g. LAK-001, LAK-002, LAK-010, LAK-020).
 */
export function naturalSortTeamIds(a: TeamDetailRecord, b: TeamDetailRecord): number {
  return a.teamId.localeCompare(b.teamId, undefined, { numeric: true, sensitivity: 'base' });
}

export const DEMO_DETAILS_TEAMS: TeamDetailRecord[] = [
  {
    teamId: 'LAK-002',
    teamName: 'Neural Ninjas',
    college: 'RV College of Engineering',
    leaderName: 'Kavya Nair',
    leaderPhone: '9845012345',
    members: [
      { name: 'Kavya Nair', college: 'RV College of Engineering', phone: '9845012345', isLeader: true },
      { name: 'Arjun Verma', college: 'RV College of Engineering', phone: '9845012346' },
      { name: 'Sneha Kulkarni', college: 'BMS College of Engineering', phone: '9845012347' },
      { name: 'Vikram Joshi', college: 'RV College of Engineering', phone: '9845012348' },
    ],
  },
  {
    teamId: 'LAK-003',
    teamName: 'Code Crusaders',
    college: 'PES University',
    leaderName: 'Mohammed Zaid',
    leaderPhone: '9741098765',
    members: [
      { name: 'Mohammed Zaid', college: 'PES University', phone: '9741098765', isLeader: true },
      { name: 'Rahul Reddy', college: 'PES University', phone: '9741098766' },
      { name: 'Pooja Hegde', college: 'PES University', phone: '9741098767' },
    ],
  },
  {
    teamId: 'LAK-004',
    teamName: 'Byte Busters',
    college: 'MS Ramaiah Institute of Technology',
    leaderName: 'Siddharth Menon',
    leaderPhone: '9632011223',
    members: [
      { name: 'Siddharth Menon', college: 'MS Ramaiah Institute of Technology', phone: '9632011223', isLeader: true },
      { name: 'Priyanka Sen', college: 'MS Ramaiah Institute of Technology', phone: '9632011224' },
      { name: 'Aditya Bhat', college: 'MS Ramaiah Institute of Technology', phone: '9632011225' },
      { name: 'Tanvi Deshmukh', college: 'MS Ramaiah Institute of Technology', phone: '9632011226' },
    ],
  },
  {
    teamId: 'LAK-005',
    teamName: 'Quantum Quacks',
    college: 'Dayananda Sagar College',
    leaderName: 'Varun Swamy',
    leaderPhone: '9123456780',
    members: [
      { name: 'Varun Swamy', college: 'Dayananda Sagar College', phone: '9123456780', isLeader: true },
      { name: 'Megha Sundaram', college: 'Dayananda Sagar College', phone: '9123456781' },
      { name: 'Karthik Prabhu', college: 'Dayananda Sagar College', phone: '9123456782' },
    ],
  },
];

/**
 * Parses raw 2D array rows into structured TeamDetailRecords.
 */
export function parseDetailsRows(rows: string[][]): TeamDetailRecord[] {
  if (!rows || rows.length <= 1) return [];

  const headers = rows[0].map(h => String(h || '').trim());
  const normHeaders = headers.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

  // Helper to find header index
  const findCol = (predicate: (norm: string, orig: string) => boolean) => {
    return normHeaders.findIndex((norm, i) => predicate(norm, headers[i]));
  };

  // Find Team ID and Team Name
  let teamIdIdx = findCol(n => n.includes('teamid') || n === 'id');
  let teamNameIdx = findCol(n => n.includes('teamname') || (n.includes('name') && !n.includes('lead') && !n.includes('member')));

  // Fallbacks if headers are simple
  if (teamIdIdx === -1) teamIdIdx = 0;
  if (teamNameIdx === -1) teamNameIdx = 1;

  // Detect members dynamically
  // Each member can have Name, College, and Phone/Mobile
  interface MemberColMapping {
    nameIdx: number;
    collegeIdx: number;
    phoneIdx: number;
    isLeader: boolean;
  }

  const memberMappings: MemberColMapping[] = [];

  // Check for Lead / Member 1
  const leadNameIdx = findCol(n => n.includes('leadname') || n.includes('teamlead') || (n.includes('leader') && !n.includes('phone') && !n.includes('college')) || n.includes('member1name'));
  const leadCollegeIdx = findCol(n => n.includes('leadcollege') || (n.includes('college') && !n.includes('member2') && !n.includes('member3') && !n.includes('member4')));
  const leadPhoneIdx = findCol(n => n.includes('leadphone') || n.includes('leadmobile') || n.includes('teamleadphone') || (n.includes('phone') && !n.includes('member2') && !n.includes('member3') && !n.includes('member4')));

  if (leadNameIdx !== -1) {
    memberMappings.push({
      nameIdx: leadNameIdx,
      collegeIdx: leadCollegeIdx,
      phoneIdx: leadPhoneIdx,
      isLeader: true,
    });
  }

  // Detect Member 2, 3, 4, 5...
  for (let m = 2; m <= 6; m++) {
    const numStr = String(m);
    const mNameIdx = findCol(n => (n.includes(`member${numStr}`) || n.includes(`m${numStr}`)) && (n.includes('name') || !n.includes('phone')));
    const mCollegeIdx = findCol(n => (n.includes(`member${numStr}`) || n.includes(`m${numStr}`)) && n.includes('college'));
    const mPhoneIdx = findCol(n => (n.includes(`member${numStr}`) || n.includes(`m${numStr}`)) && (n.includes('phone') || n.includes('mobile')));

    if (mNameIdx !== -1 || mCollegeIdx !== -1 || mPhoneIdx !== -1) {
      memberMappings.push({
        nameIdx: mNameIdx,
        collegeIdx: mCollegeIdx !== -1 ? mCollegeIdx : leadCollegeIdx,
        phoneIdx: mPhoneIdx,
        isLeader: false,
      });
    }
  }

  // Fallback: If no explicit member mappings found, check if columns follow a pattern [ID, Name, Lead, College, Phone, ...]
  if (memberMappings.length === 0) {
    memberMappings.push({
      nameIdx: 2,
      collegeIdx: 3,
      phoneIdx: 4,
      isLeader: true,
    });
    for (let c = 5; c < headers.length; c += 3) {
      memberMappings.push({
        nameIdx: c,
        collegeIdx: c + 1 < headers.length ? c + 1 : 3,
        phoneIdx: c + 2 < headers.length ? c + 2 : -1,
        isLeader: false,
      });
    }
  }

  const teams: TeamDetailRecord[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    const teamId = String(row[teamIdIdx] || '').trim();
    const teamName = String(row[teamNameIdx] || '').trim();

    if (!teamId && !teamName) continue;

    // 001 is reserved/not a valid team
    const normId = teamId.toUpperCase().replace(/\s+/g, '');
    if (normId === 'LAK-001' || normId === 'LAK-1' || normId === '001' || normId === '1') {
      continue;
    }

    const primaryCollege = leadCollegeIdx !== -1 ? String(row[leadCollegeIdx] || '').trim() : '';

    const members: TeamMemberDetail[] = [];
    let leaderName = '';
    let leaderPhone = '';

    for (const m of memberMappings) {
      const name = m.nameIdx !== -1 && row[m.nameIdx] ? String(row[m.nameIdx]).trim() : '';
      const college = m.collegeIdx !== -1 && row[m.collegeIdx] ? String(row[m.collegeIdx]).trim() : primaryCollege;
      const phone = m.phoneIdx !== -1 && row[m.phoneIdx] ? String(row[m.phoneIdx]).trim() : '';

      if (name) {
        members.push({
          name,
          college: college || primaryCollege,
          phone,
          isLeader: m.isLeader,
        });

        if (m.isLeader) {
          leaderName = name;
          leaderPhone = phone;
        }
      }
    }

    if (!leaderName && members.length > 0) {
      leaderName = members[0].name;
      leaderPhone = members[0].phone || '';
      members[0].isLeader = true;
    }

    teams.push({
      teamId: teamId || `TEAM-${r}`,
      teamName: teamName || 'Untitled Team',
      college: primaryCollege || members[0]?.college || 'Institution Unlisted',
      leaderName: leaderName || 'Team Lead',
      leaderPhone: leaderPhone || '',
      members,
      rowIndex: r + 1,
    });
  }

  return teams.sort(naturalSortTeamIds);
}

/**
 * Fetches and parses team details from the new Google Sheet.
 */
export async function fetchTeamDetails(): Promise<DetailsFetchResult> {
  const timestamp = new Date().toISOString();
  const spreadsheetId = process.env.DETAILS_SHEETS_SPREADSHEET_ID || '1wdKWeAypkBVIZLVl9A5kcHBDgqH55Ndj2xldGIerVrA';
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || 'hackadmin-sheets@hackadmin-lakshya-2026.iam.gserviceaccount.com';

  try {
    const sheets = getSheetsClient();
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const firstSheetTitle = meta.data.sheets?.[0]?.properties?.title || 'Sheet1';

    const valuesRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${firstSheetTitle}'!A:Z`,
    });

    const rawRows = (valuesRes.data.values as string[][]) || [];
    const parsedTeams = parseDetailsRows(rawRows);

    return {
      success: true,
      teams: parsedTeams,
      source: 'live_google_sheet',
      spreadsheetId,
      timestamp,
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const isPermissionError = errorMessage.includes('The caller does not have permission') ||
      errorMessage.includes('permission') ||
      errorMessage.includes('403');

    // Return demo preview data with permission instructions
    return {
      success: true,
      teams: DEMO_DETAILS_TEAMS.sort(naturalSortTeamIds),
      source: 'demo_preview',
      permissionNeeded: isPermissionError,
      serviceAccountEmail,
      spreadsheetId,
      error: errorMessage,
      timestamp,
    };
  }
}
