/**
 * WhatsApp Web integration helpers for HackAdmin (LAKSHYA 2026).
 * Ensures a single persistent popup window is reused across check-ins and
 * triggers the pre-filled chat URL whenever the attendance column updates.
 */

let activePopup: Window | null = null;

/**
 * Normalizes an Indian phone number to 12 digits with the '91' country code.
 * Rules:
 * - 10 digits -> 91 + digits
 * - 11 digits starting with 0 -> 91 + digits.slice(1)
 * - 12 digits starting with 91 -> digits
 * - Any other input -> null
 */
export function normalizeIndianPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');

  if (digits.length === 10) {
    return `91${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return `91${digits.slice(1)}`;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits;
  }
  return null;
}

/**
 * Builds the official check-in notification message for the team lead.
 * Includes Indian Standard Time (Asia/Kolkata) in HH:mm 24-hour format.
 */
export function buildCheckInMessage(params: {
  leadName?: string;
  teamName: string;
  teamId: string;
}): string {
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());

  const recipient = params.leadName?.trim() || 'Team Lead';
  return `Hi ${recipient}, your team "${params.teamName}" (${params.teamId}) is checked in for LAKSHYA 2026 at ${time}. Venue: CSE Seminar Hall, SJBIT. All the best!`;
}

/**
 * Synchronously opens or reuses the dedicated WhatsApp popup window.
 * MUST be invoked synchronously during a user gesture (click/Enter) before any await
 * to avoid triggering modern browser popup blockers.
 */
export function openWhatsAppWindow(): Window | null {
  if (typeof window === 'undefined') return null;
  try {
    if (activePopup && !activePopup.closed) {
      try {
        activePopup.focus();
      } catch {}
      return activePopup;
    }
    activePopup = window.open('', 'whatsapp-web', 'width=520,height=720,left=900,top=80');
    return activePopup;
  } catch {
    return null;
  }
}

/**
 * Navigates the single persistent WhatsApp popup window to the specific chat.
 * When the attendance column updates, this triggers the URL in the SAME window
 * and brings it into focus. Handles cross-origin fallback transparently.
 */
export function loadChat(win: Window | null, phone: string, message: string): boolean {
  if (typeof window === 'undefined') return false;
  const url = `https://web.whatsapp.com/send?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(message)}`;
  const target = win || activePopup;

  try {
    if (target && !target.closed) {
      try {
        target.location.href = url;
      } catch {
        // Cross-origin boundary fallback: window.open targeting the same window name navigates it natively
        const reopened = window.open(url, 'whatsapp-web');
        if (reopened) activePopup = reopened;
      }
      try {
        target.focus();
      } catch {}
      return true;
    }

    // Open/navigate in the same named window if not already active
    const newWin = window.open(url, 'whatsapp-web', 'width=520,height=720,left=900,top=80');
    if (newWin) {
      activePopup = newWin;
      try {
        newWin.focus();
      } catch {}
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Closes the WhatsApp popup window safely if still open.
 */
export function closeWhatsAppWindow(win?: Window | null): void {
  const target = win || activePopup;
  if (target && !target.closed) {
    try {
      target.close();
    } catch {
      // Ignore cross-origin close restriction if popup was redirected
    }
  }
  if (target === activePopup) {
    activePopup = null;
  }
}
