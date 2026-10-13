import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase/admin';
import { getTeams, appendAuditEntry } from '@/lib/firestore/teams';
import { isDemoMode } from '@/lib/demo-data';
import { DEMO_TEAMS } from '@/lib/demo-data';

export async function GET(request: NextRequest) {
  const timestamp = new Date().toISOString();

  try {
    let teams;
    let exporterEmail = 'demo@hackadmin.dev';

    if (!isDemoMode()) {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const token = authHeader.split('Bearer ')[1];
      const adminAuth = getAdminAuth();
      const decoded = await adminAuth.verifyIdToken(token);
      exporterEmail = decoded.email ?? 'unknown';

      const db = getAdminFirestore();
      const userDoc = await db.collection('users').doc(decoded.uid).get();
      const role = userDoc.data()?.role ?? 'readonly_viewer';

      if (role !== 'super_admin') {
        return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
      }

      teams = await getTeams();
    } else {
      teams = DEMO_TEAMS;
    }

    // Audit log
    if (!isDemoMode()) {
      await appendAuditEntry({
        id: `audit_export_${Date.now()}`,
        teamId: '*',
        organizerUid: 'system',
        organizerEmail: exporterEmail,
        action: 'EXPORT',
        status: 'success',
        timestamp,
      });
    }

    // Build CSV
    const headers = ['Team ID', 'Team Name', 'College', 'Member Count', 'Present', 'Synced At'];
    const rows = teams.map(t => [
      t.teamId,
      t.teamName,
      t.college,
      t.memberCount ?? '',
      t.isPresent ? 'Yes' : 'No',
      t.syncedAt ?? '',
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const filename = `hackadmin-export-${timestamp.split('T')[0]}.csv`;

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
