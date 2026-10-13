import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow, parseISO } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return 'Never';
  try {
    return format(parseISO(dateString), 'MMM d, yyyy HH:mm');
  } catch {
    return 'Invalid date';
  }
}

export function formatRelative(dateString: string | null | undefined): string {
  if (!dateString) return 'Never';
  try {
    return formatDistanceToNow(parseISO(dateString), { addSuffix: true });
  } catch {
    return 'Unknown';
  }
}

export function generateOperationId(): string {
  return `op_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function generateIdempotencyKey(teamId: string, organizerUid: string): string {
  const date = new Date().toISOString().split('T')[0];
  return `${teamId}_${organizerUid}_${date}`;
}

export function trimTeamId(id: string): string {
  return id.trim();
}

export function isValidTeamId(id: string): boolean {
  const trimmed = trimTeamId(id);
  return trimmed.length > 0 && trimmed.length <= 50;
}

export function columnLetterToIndex(letter: string): number {
  let col = 0;
  for (let i = 0; i < letter.length; i++) {
    col = col * 26 + letter.toUpperCase().charCodeAt(i) - 64;
  }
  return col - 1;
}

export function indexToColumnLetter(index: number): string {
  let col = '';
  let n = index + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    col = String.fromCharCode(65 + rem) + col;
    n = Math.floor((n - 1) / 26);
  }
  return col;
}

export function attendancePercentage(present: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((present / total) * 100);
}

export function extractDriveFileId(urlOrId: string | null | undefined): string | null {
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
