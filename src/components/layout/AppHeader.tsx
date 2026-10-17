'use client';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Wifi, WifiOff, RefreshCw, Clock, CheckCircle2, AlertCircle, LogOut, Keyboard } from 'lucide-react';
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

const PAGE_TITLES: Record<string, string> = {
  '/admin/check-in': 'Attendance Management',
  '/admin/payments': 'Payments & Verification',
  '/admin/directory': 'Registration Directory',
  '/admin/dashboard': 'Registration Directory',
  '/admin/id-cards': 'College ID Cards Verification',
  '/admin/activity': 'Governance & Audit',
};

export function AppHeader() {
  const pathname = usePathname();
  const { user, role, signOut } = useAuth();
  const { isOnline, sheetsConnected, syncInProgress, syncNow } = useTeams();

  // Live IST Date & Time combined (Asia/Kolkata)
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
      setIstDateTime(new Intl.DateTimeFormat('en-IN', options).format(now) + ' IST');
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
  const router = useRouter();

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
    <header className="print:hidden flex h-14 shrink-0 items-center gap-2 md:gap-3 border-b border-white/10 bg-[#080808]/95 px-3 md:px-6 backdrop-blur-xl z-20 w-full">
      {/* Page Title & Brand */}
      <div className="flex items-center gap-2 shrink-0">
        <Link href="/admin/check-in" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
          <span className="font-bold text-sm tracking-tight text-[#F0F0F0]">HackAdmin</span>
        </Link>
        <span className="text-white/20 text-xs hidden xl:inline">/</span>
        <h1 className="text-xs font-medium text-[#B5B5B5] tracking-tight hidden xl:inline">{title}</h1>
      </div>

      {/* Universal Full-Width Navigation Bar */}
      <div className="flex items-center gap-1 ml-1 sm:ml-2 pl-2 border-l border-white/10 text-xs overflow-x-auto py-1 shrink min-w-0">
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
      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-2.5">
        {/* Live IST Clock */}
        {istDateTime && (
          <div className="hidden xl:flex items-center gap-1.5 text-xs text-[#B5B5B5] font-mono rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 shadow-sm">
            <Clock className="h-3.5 w-3.5 text-emerald-400" />
            <span>{istDateTime}</span>
          </div>
        )}

        {/* Browser Network Status (Online / Offline) with pulsing dot */}
        <div
          className={cn(
            'flex items-center gap-1.5 text-xs font-medium rounded-lg border px-2.5 py-1 transition-all',
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
            'flex items-center gap-1.5 text-xs font-medium rounded-lg border px-2.5 py-1 transition-all',
            sheetsConnected
              ? 'border-emerald-500/30 bg-emerald-950/40 text-emerald-300 shadow-[0_0_14px_rgba(16,185,129,0.18)]'
              : 'border-red-500/30 bg-red-950/40 text-red-300 shadow-[0_0_14px_rgba(239,68,68,0.18)]'
          )}
          title={sheetsConnected ? 'Google Sheets API connected and synchronized' : 'Google Sheets API disconnected'}
        >
          {sheetsConnected ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5 text-red-400" />
          )}
          <span className="hidden md:inline text-[11px]">
            {sheetsConnected ? 'Sheets Connected' : 'Sheets Disconnected'}
          </span>
        </div>

        {/* Sync Action */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => syncNow()}
          disabled={syncInProgress || !isOnline}
          className="h-8 px-2.5 text-xs border-white/10 hover:border-emerald-500/40 bg-white/[0.045] hover:bg-emerald-950/20 text-[#F0F0F0] hover:text-emerald-300 transition-all shadow-sm"
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
          className="h-8 px-2 text-xs border-white/10 hover:border-white/25 bg-white/[0.045] hover:bg-white/[0.09] text-[#808080] hover:text-[#F0F0F0] transition-all"
          title="Keyboard shortcuts (?)"
          aria-label="Keyboard shortcuts reference"
        >
          <Keyboard className="h-3.5 w-3.5" />
        </Button>

        {/* Real Signed-in User Info & Sign Out */}
        <div className="flex items-center gap-2 pl-2 border-l border-white/10">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-emerald-500/40 bg-gradient-to-br from-emerald-500/25 via-slate-800 to-cyan-500/25 text-xs font-bold text-white shadow-[0_0_12px_rgba(16,185,129,0.25)]">
              {user?.email ? user.email[0].toUpperCase() : 'A'}
            </div>
            <div className="hidden lg:flex flex-col">
              <span className="text-xs text-[#F0F0F0] max-w-[130px] truncate leading-tight font-medium">
                {user?.email || 'Administrator'}
              </span>
              <span className="text-[10px] text-[#808080] capitalize leading-none mt-0.5">
                {role ? role.replace('_', ' ') : 'Administrator'}
              </span>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="h-8 px-2 text-xs text-[#808080] hover:text-red-400 hover:bg-red-950/30 border border-transparent hover:border-red-800/40 transition-all rounded-lg"
            title="Sign out"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline ml-1">Sign out</span>
          </Button>
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
