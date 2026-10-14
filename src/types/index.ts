export type UserRole = 'super_admin' | 'checkin_organizer' | 'readonly_viewer';

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  disabled: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

export interface Team {
  teamId: string;
  teamName: string;
  college: string;
  leaderName?: string;
  leaderEmail?: string;
  leaderPhone?: string;
  degree?: string;
  memberCount?: number;
  members?: string[];
  collegeIdUrls?: string[];
  paymentRef?: string;
  paymentStatus?: string;
  paymentProofUrl?: string;
  provisionalIdAssigned?: boolean;
  isPresent: boolean;
  attendanceValue?: string;
  emailStatus?: string;
  rowIndex?: number;
  registeredAt?: string;
  updatedAt?: string;
  syncedAt?: string;
}

export type OperationStatus =
  | 'idle'
  | 'processing'
  | 'success'
  | 'warning'
  | 'error'
  | 'pending'
  | 'needs_reconciliation';

export interface CheckInOperation {
  operationId: string;
  teamId: string;
  teamName: string;
  organizerUid: string;
  organizerEmail: string;
  idempotencyKey: string;
  status: OperationStatus;
  attemptedAt: string;
  completedAt?: string;
  errorMessage?: string;
  sheetVerified?: boolean;
  sheetValue?: string;
  previousValue?: string;
  retryCount?: number;
}

export interface AuditEntry {
  id: string;
  teamId: string;
  teamName?: string;
  organizerUid: string;
  organizerEmail: string;
  action: string;
  status: OperationStatus;
  previousValue?: string;
  newValue?: string;
  operationId?: string;
  timestamp: string;
  errorDetails?: string;
  reconciliationStatus?: 'pending' | 'resolved' | 'not_needed';
}

export interface SyncRecord {
  id: string;
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'success' | 'partial' | 'failed';
  newRecords: number;
  updatedRecords: number;
  totalRecords: number;
  errors: string[];
  triggeredBy: 'scheduled' | 'manual';
  triggeredByEmail?: string;
}

export interface DetectedColumn {
  letter: string;
  index: number;
  headerName: string;
  purpose: string;
}

export interface SheetsConfig {
  spreadsheetId: string;
  worksheetName: string;
  worksheetGid?: string;
  teamIdColumn: string;
  teamNameColumn: string;
  collegeColumn: string;
  attendanceColumn: string;
  emailStatusColumn?: string;
  leaderNameColumn?: string;
  leaderEmailColumn?: string;
  leaderPhoneColumn?: string;
  degreeColumn?: string;
  collegeIdColumn?: string;
  paymentColumn?: string;
  utrColumn?: string;
  paymentScreenshotColumn?: string;
  memberCountColumn?: string;
  headerRow: number;
  dataStartRow: number;
  configured: boolean;
  validatedAt?: string;
  hasTeamIdColumn?: boolean;
  hasAttendanceColumn?: boolean;
  hasEmailStatusColumn?: boolean;
  detectedColumns?: DetectedColumn[];
}

export interface ReadinessCheck {
  id: string;
  name: string;
  status: 'passed' | 'warning' | 'failed' | 'not_checked';
  message: string;
  action?: string;
  checkedAt?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  operationId?: string;
  timestamp: string;
  retryable?: boolean;
  reconciliationNeeded?: boolean;
}

export interface SyncHealth {
  isConnected: boolean;
  lastSuccessfulSync: string | null;
  lastAttemptedSync: string | null;
  nextScheduledSync: string | null;
  pendingOperations: number;
  discrepancies: Discrepancy[];
}

export interface Discrepancy {
  id: string;
  teamId: string;
  type: 'missing_id' | 'duplicate_id' | 'invalid_attendance' | 'column_mismatch' | 'attendance_mismatch';
  severity: 'critical' | 'warning' | 'info';
  description: string;
  detectedAt: string;
  recommendedAction: string;
  resolved: boolean;
}
