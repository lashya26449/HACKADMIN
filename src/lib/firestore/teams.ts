import { getAdminFirestore } from '@/lib/firebase/admin';
import type { Team, CheckInOperation, AuditEntry, SyncRecord, SheetsConfig } from '@/types';

const TEAMS_COLLECTION = 'teams';
const OPERATIONS_COLLECTION = 'operations';
const AUDIT_COLLECTION = 'audit';
const SYNC_COLLECTION = 'syncs';
const CONFIG_COLLECTION = 'config';

export async function getTeams(): Promise<Team[]> {
  const db = getAdminFirestore();
  const snapshot = await db.collection(TEAMS_COLLECTION).get();
  return snapshot.docs.map(doc => doc.data() as Team);
}

export async function upsertTeam(team: Team): Promise<void> {
  const db = getAdminFirestore();
  await db.collection(TEAMS_COLLECTION).doc(team.teamId).set(team, { merge: true });
}

export async function upsertTeams(teams: Team[]): Promise<void> {
  const db = getAdminFirestore();
  const batch = db.batch();
  for (const team of teams) {
    const ref = db.collection(TEAMS_COLLECTION).doc(team.teamId);
    batch.set(ref, team, { merge: true });
  }
  await batch.commit();
}

export async function getTeamById(teamId: string): Promise<Team | null> {
  const db = getAdminFirestore();
  const doc = await db.collection(TEAMS_COLLECTION).doc(teamId).get();
  return doc.exists ? (doc.data() as Team) : null;
}

export async function markTeamPresent(teamId: string): Promise<void> {
  const db = getAdminFirestore();
  await db.collection(TEAMS_COLLECTION).doc(teamId).update({
    isPresent: true,
    attendanceValue: 'P',
    updatedAt: new Date().toISOString(),
  });
}

export async function markTeamAbsent(teamId: string): Promise<void> {
  const db = getAdminFirestore();
  await db.collection(TEAMS_COLLECTION).doc(teamId).update({
    isPresent: false,
    attendanceValue: '',
    updatedAt: new Date().toISOString(),
  });
}

export async function getLatestMarkAudit(teamId: string): Promise<{ markedBy?: string; markedAt?: string } | null> {
  try {
    const db = getAdminFirestore();
    const snapshot = await db.collection(AUDIT_COLLECTION)
      .where('teamId', '==', teamId)
      .where('status', '==', 'success')
      .orderBy('timestamp', 'desc')
      .limit(5)
      .get();

    if (snapshot.empty) return null;
    const markEntry = snapshot.docs
      .map(d => d.data() as AuditEntry)
      .find(e => e.action === 'CHECK_IN' || e.action === 'mark');

    if (!markEntry) return null;
    return {
      markedBy: markEntry.organizerEmail || markEntry.organizerUid,
      markedAt: markEntry.timestamp,
    };
  } catch {
    return null;
  }
}

export async function claimOperation(operationId: string, teamId: string, organizerUid: string): Promise<boolean> {
  const db = getAdminFirestore();
  const ref = db.collection(OPERATIONS_COLLECTION).doc(operationId);
  
  try {
    await db.runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      if (doc.exists) {
        throw new Error('Operation already claimed');
      }
      tx.set(ref, {
        operationId,
        teamId,
        organizerUid,
        status: 'processing',
        claimedAt: new Date().toISOString(),
      });
    });
    return true;
  } catch {
    return false;
  }
}

export async function checkIdempotency(idempotencyKey: string): Promise<CheckInOperation | null> {
  const db = getAdminFirestore();
  const snapshot = await db.collection(OPERATIONS_COLLECTION)
    .where('idempotencyKey', '==', idempotencyKey)
    .where('status', '==', 'success')
    .limit(1)
    .get();
  
  if (snapshot.empty) return null;
  return snapshot.docs[0].data() as CheckInOperation;
}

export async function saveOperation(operation: CheckInOperation): Promise<void> {
  const db = getAdminFirestore();
  await db.collection(OPERATIONS_COLLECTION).doc(operation.operationId).set(operation);
}

export async function appendAuditEntry(entry: AuditEntry): Promise<void> {
  const db = getAdminFirestore();
  await db.collection(AUDIT_COLLECTION).doc(entry.id).set(entry);
}

export async function getAuditEntries(limit = 100): Promise<AuditEntry[]> {
  const db = getAdminFirestore();
  const snapshot = await db.collection(AUDIT_COLLECTION)
    .orderBy('timestamp', 'desc')
    .limit(limit)
    .get();
  return snapshot.docs.map(doc => doc.data() as AuditEntry);
}

export async function saveSyncRecord(record: SyncRecord): Promise<void> {
  const db = getAdminFirestore();
  await db.collection(SYNC_COLLECTION).doc(record.id).set(record);
}

export async function getLatestSync(): Promise<SyncRecord | null> {
  const db = getAdminFirestore();
  const snapshot = await db.collection(SYNC_COLLECTION)
    .orderBy('startedAt', 'desc')
    .limit(1)
    .get();
  if (snapshot.empty) return null;
  return snapshot.docs[0].data() as SyncRecord;
}

export async function getSheetsConfig(): Promise<SheetsConfig | null> {
  const db = getAdminFirestore();
  const doc = await db.collection(CONFIG_COLLECTION).doc('sheets').get();
  return doc.exists ? (doc.data() as SheetsConfig) : null;
}

export async function saveSheetsConfig(config: SheetsConfig): Promise<void> {
  const db = getAdminFirestore();
  await db.collection(CONFIG_COLLECTION).doc('sheets').set(config);
}

export async function getPendingOperations(): Promise<CheckInOperation[]> {
  const db = getAdminFirestore();
  const snapshot = await db.collection(OPERATIONS_COLLECTION)
    .where('status', 'in', ['processing', 'pending', 'needs_reconciliation'])
    .get();
  return snapshot.docs.map(doc => doc.data() as CheckInOperation);
}
