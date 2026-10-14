import type { UserRole } from '@/types';

export const ROLE_PERMISSIONS = {
  super_admin: {
    canCheckIn: true,
    canViewDirectory: true,
    canViewIdCards: true,
    canViewPayments: true,
    canViewAudit: true,
    canExport: true,
    canManageStaff: true,
    canConfigureSheets: true,
    canTriggerSync: true,
    canReconcile: true,
  },
  checkin_organizer: {
    canCheckIn: true,
    canViewDirectory: true,
    canViewIdCards: true,
    canViewPayments: true,
    canViewAudit: true,
    canExport: true,
    canManageStaff: false,
    canConfigureSheets: false,
    canTriggerSync: true,
    canReconcile: false,
  },
  readonly_viewer: {
    canCheckIn: false,
    canViewDirectory: true,
    canViewIdCards: true,
    canViewPayments: true,
    canViewAudit: true,
    canExport: true,
    canManageStaff: false,
    canConfigureSheets: false,
    canTriggerSync: false,
    canReconcile: false,
  },
} as const;

export type Permission = keyof (typeof ROLE_PERMISSIONS)['super_admin'];

export function hasPermission(role: UserRole | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.[permission] ?? false;
}

export function getRoleLabel(role: UserRole | null | undefined): string {
  if (!role) return 'Administrator';
  const labels: Record<UserRole, string> = {
    super_admin: 'Administrator',
    checkin_organizer: 'Check-in Organizer',
    readonly_viewer: 'Auditor / Viewer',
  };
  return labels[role] ?? 'Administrator';
}
