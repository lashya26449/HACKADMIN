const test = require('node:test');
const assert = require('node:assert/strict');

// Replicate naturalSortTeamIds and parseDetailsRows in JS for lightweight unit testing
function naturalSortTeamIds(a, b) {
  return a.teamId.localeCompare(b.teamId, undefined, { numeric: true, sensitivity: 'base' });
}

function parseDetailsRows(rows) {
  if (!rows || rows.length <= 1) return [];

  const headers = rows[0].map(h => String(h || '').trim());
  const normHeaders = headers.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

  const findCol = (predicate) => normHeaders.findIndex((norm, i) => predicate(norm, headers[i]));

  let teamIdIdx = findCol(n => n.includes('teamid') || n === 'id');
  let teamNameIdx = findCol(n => n.includes('teamname') || (n.includes('name') && !n.includes('lead') && !n.includes('member')));

  if (teamIdIdx === -1) teamIdIdx = 0;
  if (teamNameIdx === -1) teamNameIdx = 1;

  const leadCollegeIdx = findCol(n => n.includes('leadcollege') || (n.includes('college') && !n.includes('member2')));

  const memberMappings = [
    {
      nameIdx: findCol(n => n.includes('leadname') || n.includes('teamlead') || n.includes('member1name')),
      collegeIdx: leadCollegeIdx,
      phoneIdx: findCol(n => n.includes('leadphone') || n.includes('leadmobile') || n.includes('teamleadphone')),
      isLeader: true,
    },
    {
      nameIdx: findCol(n => n.includes('member2name') || n.includes('member2') || n.includes('m2name')),
      collegeIdx: findCol(n => n.includes('member2college') || n.includes('m2college')),
      phoneIdx: findCol(n => n.includes('member2phone') || n.includes('member2mobile') || n.includes('m2phone')),
      isLeader: false,
    },
    {
      nameIdx: findCol(n => n.includes('member3name') || n.includes('member3') || n.includes('m3name')),
      collegeIdx: findCol(n => n.includes('member3college') || n.includes('m3college')),
      phoneIdx: findCol(n => n.includes('member3phone') || n.includes('member3mobile') || n.includes('m3phone')),
      isLeader: false,
    },
  ];

  const teams = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    const teamId = String(row[teamIdIdx] || '').trim();
    const teamName = String(row[teamNameIdx] || '').trim();
    if (!teamId && !teamName) continue;

    // 001 is not a valid team
    const normId = teamId.toUpperCase().replace(/\s+/g, '');
    if (normId === 'LAK-001' || normId === 'LAK-1' || normId === '001' || normId === '1') {
      continue;
    }

    const primaryCollege = leadCollegeIdx !== -1 ? String(row[leadCollegeIdx] || '').trim() : '';
    const members = [];
    let leaderName = '';
    let leaderPhone = '';

    for (const m of memberMappings) {
      if (m.nameIdx === -1) continue;
      const name = row[m.nameIdx] ? String(row[m.nameIdx]).trim() : '';
      const college = m.collegeIdx !== -1 && row[m.collegeIdx] ? String(row[m.collegeIdx]).trim() : primaryCollege;
      const phone = m.phoneIdx !== -1 && row[m.phoneIdx] ? String(row[m.phoneIdx]).trim() : '';

      if (name) {
        members.push({ name, college: college || primaryCollege, phone, isLeader: m.isLeader });
        if (m.isLeader) {
          leaderName = name;
          leaderPhone = phone;
        }
      }
    }

    teams.push({
      teamId,
      teamName,
      college: primaryCollege || members[0]?.college || 'Institution Unlisted',
      leaderName: leaderName || 'Team Lead',
      leaderPhone,
      members,
    });
  }

  return teams.sort(naturalSortTeamIds);
}

test('1. Natural sort arranges Team IDs correctly regardless of digits (e.g. LAK-001 < LAK-002 < LAK-010)', () => {
  const unordered = [
    { teamId: 'LAK-010', teamName: 'Beta' },
    { teamId: 'LAK-002', teamName: 'Gamma' },
    { teamId: 'LAK-001', teamName: 'Alpha' },
    { teamId: 'LAK-100', teamName: 'Delta' },
    { teamId: 'LAK-005', teamName: 'Epsilon' },
  ];

  const sorted = unordered.sort(naturalSortTeamIds);
  assert.deepEqual(
    sorted.map(t => t.teamId),
    ['LAK-001', 'LAK-002', 'LAK-005', 'LAK-010', 'LAK-100']
  );
});

test('2. Parser extracts Team ID, Team Name, and member contacts correctly from 2D sheet rows', () => {
  const mockRows = [
    ['Team ID', 'Team Name', 'Team Lead Name', 'Lead College', 'Lead Phone', 'Member 2 Name', 'Member 2 College', 'Member 2 Phone'],
    ['LAK-003', 'Code Crusaders', 'Zaid Khan', 'PES', '9845012399', 'Rahul R', 'PES', '9845012398'],
    ['LAK-002', 'Neural Ninjas', 'Kavya Nair', 'RVCE', '9845012345', 'Arjun Verma', 'RVCE', '9845012346'],
  ];

  const result = parseDetailsRows(mockRows);
  assert.equal(result.length, 2);
  // Verified natural sort order: LAK-002 first, then LAK-003
  assert.equal(result[0].teamId, 'LAK-002');
  assert.equal(result[0].teamName, 'Neural Ninjas');
  assert.equal(result[0].leaderName, 'Kavya Nair');
  assert.equal(result[0].leaderPhone, '9845012345');
  assert.equal(result[0].members.length, 2);
  assert.equal(result[0].members[0].isLeader, true);
  assert.equal(result[0].members[1].name, 'Arjun Verma');

  assert.equal(result[1].teamId, 'LAK-003');
});

test('3. Team 001 / LAK-001 is recognized as invalid and filtered out from registrations', () => {
  const mockRowsWith001 = [
    ['Team ID', 'Team Name', 'Team Lead Name', 'Lead College', 'Lead Phone'],
    ['LAK-001', 'Byte Busters', 'Aarav Sharma', 'SJBIT', '9876543210'],
    ['001', 'Test Team', 'Tester', 'Test College', '9876543211'],
    ['LAK-002', 'Neural Ninjas', 'Kavya Nair', 'RVCE', '9845012345'],
  ];

  const result = parseDetailsRows(mockRowsWith001);
  assert.equal(result.length, 1, 'Only LAK-002 must be parsed; 001 and LAK-001 must be excluded');
  assert.equal(result[0].teamId, 'LAK-002');
});
