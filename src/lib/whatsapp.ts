/**
 * WhatsApp integration helpers for HackAdmin (LAKSHYA 2026).
 * Defaults to the native Windows WhatsApp Desktop app (whatsapp:// protocol)
 * to completely eliminate browser reloads, new popups, and "Use Here" prompts.
 */

let activePopup: Window | null = null;

export type WhatsAppMode = 'desktop' | 'web';

/**
 * Gets the current WhatsApp delivery mode from localStorage ('desktop' | 'web').
 * Defaults to 'desktop' because WhatsApp Desktop is installed on the system.
 */
export function getWhatsAppMode(): WhatsAppMode {
  if (typeof window === 'undefined') return 'desktop';
  const saved = localStorage.getItem('hackadmin_whatsapp_mode') as WhatsAppMode | null;
  if (saved === 'desktop' || saved === 'web') {
    return saved;
  }
  return 'desktop';
}

/**
 * Persists the WhatsApp delivery mode in localStorage.
 */
export function setWhatsAppMode(mode: WhatsAppMode): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('hackadmin_whatsapp_mode', mode);
  }
}

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
 * Dispatches directly to the native Windows WhatsApp Desktop app via URI protocol.
 * Does NOT open any browser window, tab, or popup, and NEVER asks "Use Here".
 */
export function dispatchDesktopWhatsApp(phone: string, message: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const desktopUri = `whatsapp://send?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(message)}`;
    
    // Virtual anchor click triggers OS protocol handler without opening any browser window
    const link = document.createElement('a');
    link.href = desktopUri;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      try {
        if (link.parentNode) {
          link.parentNode.removeChild(link);
        }
      } catch {}
    }, 100);
    return true;
  } catch {
    return false;
  }
}

/**
 * Synchronously opens or reuses the dedicated WhatsApp popup window (only for 'web' mode).
 * In 'desktop' mode, returns null so NO browser popup is created.
 */
export function openWhatsAppWindow(): Window | null {
  if (typeof window === 'undefined') return null;
  const mode = getWhatsAppMode();
  if (mode === 'desktop') {
    return null;
  }

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
 * Triggers the pre-filled chat message.
 * - In 'desktop' mode (default): Dispatches to WhatsApp Desktop on Windows with ZERO new windows and NO "Use Here".
 * - In 'web' mode: Navigates the persistent popup window to WhatsApp Web.
 */
export function loadChat(win: Window | null, phone: string, message: string, overrideMode?: WhatsAppMode): boolean {
  if (typeof window === 'undefined') return false;
  const mode = overrideMode || getWhatsAppMode();

  // 1. Native Windows WhatsApp Desktop mode: NO new browser window, NO "Use Here"
  if (mode === 'desktop') {
    return dispatchDesktopWhatsApp(phone, message);
  }

  // 2. Web Popup Mode
  const url = `https://web.whatsapp.com/send?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(message)}`;
  const target = win || activePopup;

  try {
    if (target && !target.closed) {
      try {
        target.location.href = url;
      } catch {
        const reopened = window.open(url, 'whatsapp-web');
        if (reopened) activePopup = reopened;
      }
      try {
        target.focus();
      } catch {}
      return true;
    }

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
 * Closes the WhatsApp popup window safely if still open (in 'web' mode).
 */
export function closeWhatsAppWindow(win?: Window | null): void {
  const target = win || activePopup;
  if (target && !target.closed) {
    try {
      target.close();
    } catch {}
  }
  if (target === activePopup) {
    activePopup = null;
  }
}
