'use client';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Wifi, WifiOff, RefreshCw, Clock, CheckCircle2, AlertCircle, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useTeams } from '@/contexts/TeamsContext';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

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

  const title = Object.entries(PAGE_TITLES).find(([path]) => pathname.startsWith(path))?.[1] ?? 'HackAdmin';
  const isCheckInPage = pathname === '/admin/check-in';
  const isSuperAdmin = role === 'super_admin';

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-white/10 bg-[#080808]/90 px-4 md:px-6 backdrop-blur-xl z-20">
      {/* Mobile spacer for menu hamburger when sidebar is active */}
      {!isCheckInPage && <div className="w-8 md:hidden" />}

      {/* Page Title & Brand */}
      <div className="flex items-center gap-2.5">
        <Link href="/admin/check-in" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
          <span className="font-bold text-sm tracking-tight text-[#F0F0F0]">HackAdmin</span>
        </Link>
        <span className="text-white/20 text-xs">/</span>
        <h1 className="text-xs font-medium text-[#B5B5B5] tracking-tight">{title}</h1>
      </div>

      {/* If super admin on full-width check-in page, show nav shortcuts */}
      {isCheckInPage && isSuperAdmin && (
        <div className="hidden lg:flex items-center gap-1.5 ml-4 pl-4 border-l border-white/10 text-xs">
          <Link
            href="/admin/directory"
            className="px-2.5 py-1 rounded-md text-[#808080] hover:text-[#F0F0F0] hover:bg-white/[0.04] transition-colors"
          >
            Directory
          </Link>
          <Link
            href="/admin/id-cards"
            className="px-2.5 py-1 rounded-md text-[#808080] hover:text-[#F0F0F0] hover:bg-white/[0.04] transition-colors"
          >
            ID Cards
          </Link>
          <Link
            href="/admin/activity"
            className="px-2.5 py-1 rounded-md text-[#808080] hover:text-[#F0F0F0] hover:bg-white/[0.04] transition-colors"
          >
            Activity
          </Link>
        </div>
      )}

      <div className="ml-auto flex items-center gap-3">
        {/* Live IST Clock */}
        {istDateTime && (
          <div className="hidden lg:flex items-center gap-1.5 text-xs text-[#B5B5B5] font-mono rounded-lg border border-white/10 bg-white/[0.035] px-2.5 py-1">
            <Clock className="h-3.5 w-3.5 text-[#808080]" />
            <span>{istDateTime}</span>
          </div>
        )}

        {/* Browser Network Status (Online / Offline) */}
        <div
          className={cn(
            'flex items-center gap-1.5 text-xs font-medium rounded-lg border px-2 py-1',
            isOnline
              ? 'border-emerald-800/40 bg-emerald-950/40 text-emerald-300'
              : 'border-red-800/40 bg-red-950/40 text-red-300'
          )}
          title={isOnline ? 'Browser is connected to internet' : 'Browser is offline'}
        >
          {isOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline text-[11px]">{isOnline ? 'Online' : 'Offline'}</span>
        </div>

        {/* Google Sheets API Connectivity Status (Sheets Connected / Disconnected) */}
        <div
          className={cn(
            'flex items-center gap-1.5 text-xs font-medium rounded-lg border px-2 py-1',
            sheetsConnected
              ? 'border-emerald-800/40 bg-emerald-950/40 text-emerald-300'
              : 'border-red-800/40 bg-red-950/40 text-red-300'
          )}
          title={sheetsConnected ? 'Google Sheets API connected and synchronized' : 'Google Sheets API disconnected'}
        >
          {sheetsConnected ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5 text-red-400" />
          )}
          <span className="hidden sm:inline text-[11px]">
            {sheetsConnected ? 'Sheets Connected' : 'Sheets Disconnected'}
          </span>
        </div>

        {/* Sync Action */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => syncNow()}
          disabled={syncInProgress || !isOnline}
          className="h-7 px-2.5 text-xs border-white/10 bg-white/[0.045] hover:bg-white/[0.08]"
          title="Refresh registration and attendance data from Google Sheets"
        >
          <RefreshCw className={cn('h-3 w-3 mr-1.5', syncInProgress && 'animate-spin')} />
          <span className="hidden sm:inline">{syncInProgress ? 'Syncing...' : 'Sync'}</span>
        </Button>

        {/* Real Signed-in User Info & Sign Out */}
        <div className="flex items-center gap-2 pl-2 border-l border-white/10">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.08] text-xs font-semibold text-[#F0F0F0]">
              {user?.email ? user.email[0].toUpperCase() : 'A'}
            </div>
            <div className="hidden md:flex flex-col">
              <span className="text-xs text-[#F0F0F0] max-w-[140px] truncate leading-tight">
                {user?.email || 'Administrator'}
              </span>
              <span className="text-[10px] text-[#808080] capitalize leading-none">
                {role ? role.replace('_', ' ') : 'Administrator'}
              </span>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="h-7 px-2 text-xs text-[#808080] hover:text-red-400 hover:bg-red-950/20 border border-transparent hover:border-red-900/30"
            title="Sign out"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline ml-1">Sign out</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
