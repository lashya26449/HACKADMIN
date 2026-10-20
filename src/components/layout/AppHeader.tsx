'use client';
import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Wifi, WifiOff, RefreshCw, Clock, CheckCircle2, AlertCircle, LogOut, Keyboard, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useTeams } from '@/contexts/TeamsContext';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { KeyboardShortcutsHelpDialog } from '@/components/shortcuts/KeyboardShortcutsHelpDialog';
import { QuickSearchDialog } from '@/components/shortcuts/QuickSearchDialog';
import { ExportOptionsDialog } from '@/components/export/ExportOptionsDialog';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useRouter } from 'next/navigation';
import { hasPermission } from '@/lib/firebase/auth-helpers';

const PAGE_TITLES: Record<string, string> = {
  '/admin/check-in': 'Attendance Management',
  '/admin/print': 'Print Desk & Ledger',
  '/admin/payments': 'Payments & Verification',
  '/admin/directory': 'Registration Directory',
  '/admin/dashboard': 'Registration Directory',
  '/admin/id-cards': 'College ID Cards Verification',
  '/admin/activity': 'Governance & Audit',
};

export function AppHeader() {
  const pathname = usePathname();
  const { user, role, signOut } = useAuth();
  const { teams, isOnline, sheetsConnected, syncInProgress, syncNow } = useTeams();

  // Live Attendance Counts for Header (Suggestion 10)
  const totalTeams = teams.length;
  const presentTeams = teams.filter(t => t.isPresent).length;
  const presentPercent = totalTeams > 0 ? Math.round((presentTeams / totalTeams) * 100) : 0;

  // Live Date & Time combined (Asia/Kolkata) without trailing IST
  const [istDateTime, setIstDateTime] = useState<string>('');

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      };
      setIstDateTime(new Intl.DateTimeFormat('en-IN', options).format(now));
    };

    updateDateTime();
    const interval = setInterval(updateDateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Signed out successfully');
    } catch {
      toast.error('Sign out failed');
    }
  };

  const [headerHelpOpen, setHeaderHelpOpen] = useState(false);
  const [headerQuickSearchOpen, setHeaderQuickSearchOpen] = useState(false);
  const [headerExportOpen, setHeaderExportOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Handle outside click & Escape key to close the user dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [dropdownOpen]);

  const title = Object.entries(PAGE_TITLES).find(([path]) => pathname.startsWith(path))?.[1] ?? 'HackAdmin';
  const isCheckInPage = pathname === '/admin/check-in';

  // Global shortcuts for pages other than /admin/check-in
  useKeyboardShortcuts([
    {
      id: 'header-quick-search',
      key: 'k',
      ctrlOrCmd: true,
      description: 'Quick Search Modal',
      category: 'navigation',
      allowInInput: true,
      handler: () => setHeaderQuickSearchOpen(true),
    },
    {
      id: 'header-help',
      key: '?',
      description: 'Keyboard Shortcuts Reference',
      category: 'help',
      allowInInput: false,
      handler: () => setHeaderHelpOpen(true),
    },
    {
      id: 'header-refresh',
      key: 'r',
      alt: true,
      description: 'Refresh Team Data',
      category: 'attendance',
      allowInInput: true,
      handler: () => syncNow(),
    },
    {
      id: 'header-export',
      key: 'e',
      alt: true,
      description: 'Export Options',
      category: 'attendance',
      allowInInput: true,
      handler: () => setHeaderExportOpen(true),
    },
  ], !isCheckInPage);

  return (
    <header className="print:hidden relative flex h-14 shrink-0 items-center gap-2 md:gap-3 border-b border-white/10 bg-[#080808]/95 px-3 md:px-6 backdrop-blur-xl z-50 w-full">
      {/* Page Title & Brand */}
      <div className="flex items-center gap-2 shrink-0">
        <Link href="/admin/check-in" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
          <span className="font-bold text-sm tracking-tight text-[#F0F0F0]">HackAdmin</span>
        </Link>
        <span className="text-white/20 text-xs hidden xl:inline">/</span>
        <h1 className="text-xs font-medium text-[#B5B5B5] tracking-tight hidden xl:inline">{title}</h1>
      </div>

      {/* Role-Filtered Navigation Bar */}
      <div className="flex items-center gap-1 ml-1 sm:ml-2 pl-2 border-l border-white/10 text-xs overflow-x-auto py-1 shrink min-w-0">
        {hasPermission(role, 'canCheckIn') && (
          <Link
            href="/admin/check-in"
            className={cn(
              "px-3 py-1.5 rounded-lg transition-all duration-200 whitespace-nowrap font-medium",
              pathname === '/admin/check-in'
                ? "bg-gradient-to-b from-white/[0.16] to-white/[0.04] text-white font-semibold border border-white/20 border-t-white/40 shadow-[0_2px_12px_rgba(0,0,0,0.5),0_0_16px_rgba(16,185,129,0.18)]"
                : "text-[#888888] hover:text-[#F0F0F0] hover:bg-white/[0.06]"
            )}
          >
            Check-in
          </Link>
        )}
        {hasPermission(role, 'canPrint') && (
          <Link
            href="/admin/print"
            className={cn(
              "px-3 py-1.5 rounded-lg transition-all duration-200 whitespace-nowrap font-medium",
              pathname.startsWith('/admin/print')
                ? "bg-gradient-to-b from-white/[0.16] to-white/[0.04] text-white font-semibold border border-white/20 border-t-white/40 shadow-[0_2px_12px_rgba(0,0,0,0.5),0_0_16px_rgba(16,185,129,0.18)]"
                : "text-[#888888] hover:text-[#F0F0F0] hover:bg-white/[0.06]"
            )}
          >
            Print
          </Link>
        )}
        {hasPermission(role, 'canViewPayments') && (
          <Link
            href="/admin/payments"
            className={cn(
              "px-3 py-1.5 rounded-lg transition-all duration-200 whitespace-nowrap font-medium",
              pathname.startsWith('/admin/payments')
                ? "bg-gradient-to-b from-white/[0.16] to-white/[0.04] text-white font-semibold border border-white/20 border-t-white/40 shadow-[0_2px_12px_rgba(0,0,0,0.5),0_0_16px_rgba(16,185,129,0.18)]"
                : "text-[#888888] hover:text-[#F0F0F0] hover:bg-white/[0.06]"
            )}
          >
            Payments & UTR
          </Link>
        )}
        {hasPermission(role, 'canViewDirectory') && (
          <Link
            href="/admin/directory"
            className={cn(
              "px-3 py-1.5 rounded-lg transition-all duration-200 whitespace-nowrap font-medium",
              pathname.startsWith('/admin/directory')
                ? "bg-gradient-to-b from-white/[0.16] to-white/[0.04] text-white font-semibold border border-white/20 border-t-white/40 shadow-[0_2px_12px_rgba(0,0,0,0.5),0_0_16px_rgba(16,185,129,0.18)]"
                : "text-[#888888] hover:text-[#F0F0F0] hover:bg-white/[0.06]"
            )}
          >
            Directory
          </Link>
        )}
        {hasPermission(role, 'canViewIdCards') && (
          <Link
            href="/admin/id-cards"
            className={cn(
              "px-3 py-1.5 rounded-lg transition-all duration-200 whitespace-nowrap font-medium",
              pathname.startsWith('/admin/id-cards')
                ? "bg-gradient-to-b from-white/[0.16] to-white/[0.04] text-white font-semibold border border-white/20 border-t-white/40 shadow-[0_2px_12px_rgba(0,0,0,0.5),0_0_16px_rgba(16,185,129,0.18)]"
                : "text-[#888888] hover:text-[#F0F0F0] hover:bg-white/[0.06]"
            )}
          >
            ID Cards
          </Link>
        )}
        {hasPermission(role, 'canViewAudit') && (
          <Link
            href="/admin/activity"
            className={cn(
              "px-3 py-1.5 rounded-lg transition-all duration-200 whitespace-nowrap font-medium",
              pathname.startsWith('/admin/activity')
                ? "bg-gradient-to-b from-white/[0.16] to-white/[0.04] text-white font-semibold border border-white/20 border-t-white/40 shadow-[0_2px_12px_rgba(0,0,0,0.5),0_0_16px_rgba(16,185,129,0.18)]"
                : "text-[#888888] hover:text-[#F0F0F0] hover:bg-white/[0.06]"
            )}
          >
            Activity
          </Link>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-2.5">
        {/* Suggestion 10: Live Desk Attendance Counter Bar */}
        {totalTeams > 0 && (
          <div
            className="flex items-center gap-2 text-xs font-mono rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 shadow-sm shrink-0"
            title={`Live Event Attendance: ${presentTeams} of ${totalTeams} teams checked in (${presentPercent}%)`}
          >
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[#888888] hidden sm:inline text-[11px]">Present:</span>
              <span className="font-bold text-emerald-400">{presentTeams}</span>
              <span className="text-[#666666]">/</span>
              <span className="text-[#B5B5B5]">{totalTeams}</span>
              <span className="text-[10px] text-emerald-400/90 font-semibold bg-emerald-950/60 border border-emerald-800/40 px-1.5 py-0.5 rounded hidden xs:inline">
                {presentPercent}%
              </span>
            </div>
            {/* Mini visual progress bar */}
            <div className="w-10 sm:w-14 h-1.5 rounded-full bg-white/10 overflow-hidden hidden md:block">
              <div
                className="h-full bg-emerald-400 rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                style={{ width: `${presentPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Live Clock & Date */}
        {istDateTime && (
          <div className="hidden xl:flex items-center gap-1.5 text-xs text-[#B5B5B5] font-mono rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 shadow-sm shrink-0 whitespace-nowrap">
            <Clock className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            <span>{istDateTime}</span>
          </div>
        )}

        {/* Browser Network Status (Online / Offline) with pulsing dot */}
        <div
          className={cn(
            'flex items-center gap-1.5 text-xs font-medium rounded-lg border px-2.5 py-1 transition-all shrink-0 whitespace-nowrap',
            isOnline
              ? 'border-emerald-500/30 bg-emerald-950/40 text-emerald-300 shadow-[0_0_14px_rgba(16,185,129,0.18)]'
              : 'border-red-500/30 bg-red-950/40 text-red-300 shadow-[0_0_14px_rgba(239,68,68,0.18)]'
          )}
          title={isOnline ? 'Browser is connected to internet' : 'Browser is offline'}
        >
          <span className="relative flex h-2 w-2">
            {isOnline ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </>
            ) : (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </>
            )}
          </span>
          <span className="hidden sm:inline text-[11px] font-medium">{isOnline ? 'Online' : 'Offline'}</span>
        </div>

        {/* Google Sheets API Connectivity Status */}
        <div
          className={cn(
            'flex items-center gap-1.5 text-xs font-medium rounded-lg border px-2.5 py-1 transition-all shrink-0 whitespace-nowrap',
            sheetsConnected
              ? 'border-emerald-500/30 bg-emerald-950/40 text-emerald-300 shadow-[0_0_14px_rgba(16,185,129,0.18)]'
              : 'border-red-500/30 bg-red-950/40 text-red-300 shadow-[0_0_14px_rgba(239,68,68,0.18)]'
          )}
          title={sheetsConnected ? 'Google Sheets API connected and synchronized' : 'Google Sheets API disconnected'}
        >
          {sheetsConnected ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
          )}
          <span className="hidden xl:inline text-[11px]">
            {sheetsConnected ? 'Sheets Connected' : 'Sheets Disconnected'}
          </span>
        </div>

        {/* Sync Action */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => syncNow()}
          disabled={syncInProgress || !isOnline}
          className="h-8 px-2.5 text-xs border-white/10 hover:border-emerald-500/40 bg-white/[0.045] hover:bg-emerald-950/20 text-[#F0F0F0] hover:text-emerald-300 transition-all shadow-sm shrink-0"
          title="Refresh registration and attendance data from Google Sheets (Alt + R)"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', syncInProgress && 'animate-spin text-emerald-400')} />
          <span className="hidden sm:inline ml-1.5">{syncInProgress ? 'Syncing...' : 'Sync'}</span>
        </Button>

        {/* Keyboard Shortcuts Reference Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setHeaderHelpOpen(true)}
          className="h-8 px-2 text-xs border-white/10 hover:border-white/25 bg-white/[0.045] hover:bg-white/[0.09] text-[#808080] hover:text-[#F0F0F0] transition-all shrink-0"
          title="Keyboard shortcuts (?)"
          aria-label="Keyboard shortcuts reference"
        >
          <Keyboard className="h-3.5 w-3.5" />
        </Button>

        {/* User Email & Sign Out Dropdown Menu */}
        <div className="relative pl-2 border-l border-white/10 shrink-0" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownOpen(prev => !prev)}
            aria-expanded={dropdownOpen}
            aria-haspopup="true"
            className={cn(
              "flex items-center gap-2 px-2.5 py-1.5 rounded-xl border transition-all duration-200 outline-none select-none cursor-pointer",
              dropdownOpen
                ? "bg-white/[0.12] border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.2)] text-white"
                : "border-white/10 bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/20 text-[#E0E0E0]"
            )}
            title="User account details & sign out"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-emerald-500/40 bg-gradient-to-br from-emerald-500/25 via-slate-800 to-cyan-500/25 text-xs font-bold text-white shadow-[0_0_10px_rgba(16,185,129,0.25)]">
              {user?.email ? user.email[0].toUpperCase() : 'A'}
            </div>
            <span className="text-xs font-medium max-w-[110px] sm:max-w-[150px] md:max-w-[180px] truncate leading-tight">
              {user?.email || 'admin@hackadmin.dev'}
            </span>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 text-[#888888] transition-transform duration-200 shrink-0",
                dropdownOpen && "rotate-180 text-white"
              )}
            />
          </button>

          {/* Floating Dropdown Menu - Smooth pop animation anchored top-right without glitching */}
          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-white/15 bg-[#0C0C0C]/98 backdrop-blur-2xl p-2 shadow-[0_12px_40px_rgba(0,0,0,0.85),0_0_20px_rgba(16,185,129,0.12)] z-[100] animate-dropdown">
              <div className="px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/5 mb-1">
                <p className="text-[10px] font-mono text-[#808080] uppercase tracking-wider">Signed in as</p>
                <p className="text-xs font-semibold text-[#F0F0F0] truncate mt-0.5" title={user?.email || 'admin@hackadmin.dev'}>
                  {user?.email || 'admin@hackadmin.dev'}
                </p>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  <span className="text-[10px] font-medium text-emerald-300 capitalize">
                    {role ? role.replace('_', ' ') : 'Administrator'}
                  </span>
                </div>
              </div>

              <div className="h-px bg-white/10 my-1" />

              <button
                type="button"
                onClick={() => {
                  setDropdownOpen(false);
                  handleSignOut();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-950/40 border border-transparent hover:border-red-800/40 rounded-lg transition-all cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign out</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {!isCheckInPage && (
        <>
          <KeyboardShortcutsHelpDialog open={headerHelpOpen} onOpenChange={setHeaderHelpOpen} />
          <QuickSearchDialog
            open={headerQuickSearchOpen}
            onOpenChange={setHeaderQuickSearchOpen}
            onSelectTeam={() => {
              router.push('/admin/check-in');
            }}
          />
          <ExportOptionsDialog open={headerExportOpen} onOpenChange={setHeaderExportOpen} />
        </>
      )}
    </header>
  );
}
