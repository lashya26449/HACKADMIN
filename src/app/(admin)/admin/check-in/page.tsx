'use client';
import { useState, useMemo, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useTeams } from '@/contexts/TeamsContext';
import { SearchBar } from '@/components/check-in/SearchBar';
import { FilterTabs, type FilterValue } from '@/components/check-in/FilterTabs';
import { TeamCard } from '@/components/check-in/TeamCard';
import { EmptyState } from '@/components/check-in/EmptyState';
import { OfflineBanner } from '@/components/check-in/OfflineBanner';
import { RecentActivity } from '@/components/check-in/RecentActivity';
import { QuickScanBar } from '@/components/check-in/QuickScanBar';
import { KeyboardShortcutsHelpDialog } from '@/components/shortcuts/KeyboardShortcutsHelpDialog';
import { QuickSearchDialog } from '@/components/shortcuts/QuickSearchDialog';
import { ExportOptionsDialog } from '@/components/export/ExportOptionsDialog';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { hasPermission } from '@/lib/firebase/auth-helpers';
import { trimTeamId, generateIdempotencyKey } from '@/lib/utils';
import {
  openWhatsAppWindow, loadChat, closeWhatsAppWindow,
  normalizeIndianPhone, buildCheckInMessage
} from '@/lib/whatsapp';
import type { AuditEntry, Team } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2, ArrowRight, RefreshCw, MapPin, Mail, MessageSquare,
  Undo2, Clock, AlertTriangle, Smartphone
} from 'lucide-react';
import { sound } from '@/lib/audio';

interface RecentlyMarkedTeam {
  teamId: string;
  teamName: string;
  leaderName?: string;
  leaderPhone?: string;
  markedAt: number;
}

export default function CheckInPage() {
  const { user, role, getIdToken } = useAuth();
  const { teams, loading, isOnline, updateTeamLocally, refreshTeams, syncInProgress } = useTeams();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterValue>('all');
  const [processingTeamId, setProcessingTeamId] = useState<string | undefined>();
  const [recentActivity, setRecentActivity] = useState<AuditEntry[]>([]);

  // Auto-open WhatsApp setting (persisted in localStorage)
  const [autoOpenWhatsApp, setAutoOpenWhatsApp] = useState<boolean>(true);

  // Recently marked session list (last 10 teams)
  const [recentlyMarked, setRecentlyMarked] = useState<RecentlyMarkedTeam[]>([]);
  const [undoConfirmTeam, setUndoConfirmTeam] = useState<RecentlyMarkedTeam | null>(null);

  // Active 5-second Undo ref for toast & Ctrl+Z
  const activeUndoRef = useRef<{
    teamId: string;
    waWindow: Window | null;
    toastId: string | number;
    timeoutId: ReturnType<typeof setTimeout>;
  } | null>(null);

  // Load auto-open setting on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('hackadmin_auto_open_whatsapp');
      if (saved !== null) {
        setAutoOpenWhatsApp(saved === 'true');
      }
    }
  }, []);

  const toggleAutoOpenWhatsApp = () => {
    setAutoOpenWhatsApp(prev => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('hackadmin_auto_open_whatsapp', String(next));
      }
      toast.info(`Auto-open WhatsApp popup: ${next ? 'ENABLED' : 'DISABLED'}`);
      return next;
    });
  };

  // Keyboard navigation & dialog states
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [confirmingTeam, setConfirmingTeam] = useState<Team | null>(null);
  const [quickScanActive, setQuickScanActive] = useState(false);
  const [quickSearchOpen, setQuickSearchOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  const searchInputRef = useRef<HTMLInputElement>(null);
  const canCheckIn = role ? hasPermission(role, 'canCheckIn') : true;
  const canExport = role ? hasPermission(role, 'canExport') : true;
  const trimmedSearch = trimTeamId(search).toLowerCase();

  // Duplicate Team ID detection
  const duplicateIds = useMemo(() => {
    const counts = new Map<string, number>();
    teams.forEach(t => {
      const idKey = t.teamId.toLowerCase();
      counts.set(idKey, (counts.get(idKey) ?? 0) + 1);
    });
    return new Set([...counts.entries()].filter(([, n]) => n > 1).map(([id]) => id));
  }, [teams]);

  // Filtered registrations: local search + attendance filter tabs only
  const filteredTeams = useMemo(() => {
    return teams.filter(t => {
      if (filter === 'present' && !t.isPresent) return false;
      if (filter === 'not_present' && t.isPresent) return false;

      if (trimmedSearch) {
        const matchesId = t.teamId.toLowerCase().includes(trimmedSearch);
        const matchesName = t.teamName.toLowerCase().includes(trimmedSearch);
        const matchesLead = (t.leaderName ?? '').toLowerCase().includes(trimmedSearch);
        const matchesCollege = (t.college ?? '').toLowerCase().includes(trimmedSearch);
        if (!matchesId && !matchesName && !matchesLead && !matchesCollege) {
          return false;
        }
      }

      return true;
    });
  }, [teams, filter, trimmedSearch]);

  // Auto-select exact match or single result so Enter works instantly
  useEffect(() => {
    if (!trimmedSearch) {
      if (selectedIndex !== null && selectedIndex >= filteredTeams.length) {
        setSelectedIndex(filteredTeams.length > 0 ? filteredTeams.length - 1 : null);
      }
      return;
    }

    if (filteredTeams.length === 1) {
      setSelectedIndex(0);
      return;
    }

    if (filteredTeams.length > 1) {
      const exactIdx = filteredTeams.findIndex(t => {
        const idLower = t.teamId.toLowerCase();
        const normId = idLower.replace(/^(?:lak-?)?0*/i, '');
        const normQuery = trimmedSearch.replace(/^(?:lak-?)?0*/i, '');
        return idLower === trimmedSearch || (normQuery.length > 0 && normId === normQuery);
      });
      if (exactIdx >= 0) {
        setSelectedIndex(exactIdx);
        return;
      }
    }

    if (selectedIndex === null && filteredTeams.length > 0) {
      setSelectedIndex(0);
    } else if (selectedIndex !== null && selectedIndex >= filteredTeams.length) {
      setSelectedIndex(filteredTeams.length > 0 ? 0 : null);
    }
  }, [filteredTeams, trimmedSearch, selectedIndex]);

  const counts = useMemo(
    () => ({
      all: teams.length,
      present: teams.filter(t => t.isPresent).length,
      notPresent: teams.filter(t => !t.isPresent).length,
    }),
    [teams]
  );

  const isDuplicateSearch = trimmedSearch && duplicateIds.has(trimmedSearch);

  // Undo attendance action
  const handleUndo = async (teamId: string, popupWindow?: Window | null) => {
    // 1. Immediately close WhatsApp window if open
    if (popupWindow) {
      closeWhatsAppWindow(popupWindow);
    }
    if (activeUndoRef.current?.teamId === teamId) {
      if (activeUndoRef.current.waWindow) {
        closeWhatsAppWindow(activeUndoRef.current.waWindow);
      }
      toast.dismiss(activeUndoRef.current.toastId);
      clearTimeout(activeUndoRef.current.timeoutId);
      activeUndoRef.current = null;
    }

    // 2. Unsend warning notification
    toast.warning(
      <div className="flex flex-col gap-1">
        <div className="font-semibold text-white">Attendance Undone for Team {teamId}</div>
        <div className="text-[11px] text-amber-200">
          Note: If the WhatsApp message was already sent, it cannot be unsent.
        </div>
      </div>,
      { duration: 6000 }
    );

    // 3. Optimistic local revert
    updateTeamLocally(teamId, { isPresent: false, attendanceValue: '' });
    setRecentlyMarked(prev => prev.filter(t => t.teamId.toLowerCase() !== teamId.toLowerCase()));
    setAnnouncement(`Attendance undone for Team ${teamId}`);

    // 4. Server authoritative call
    try {
      let token = await getIdToken();
      if (!token) {
        try {
          const { auth } = await import('@/lib/firebase/client');
          token = (await auth.currentUser?.getIdToken()) || null;
        } catch {
          token = null;
        }
      }
      if (!token) token = 'session';

      const res = await fetch('/api/check-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'x-user-email': user?.email || 'Organizer',
        },
        body: JSON.stringify({
          teamId,
          action: 'undo',
          executeLiveWrite: true,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        toast.error(`Undo failed on server: ${data.error || 'Unknown error'}`);
        refreshTeams();
      } else {
        const entry: AuditEntry = {
          id: `entry_${Date.now()}`,
          teamId,
          organizerUid: user?.uid ?? 'organizer',
          organizerEmail: user?.email ?? 'Administrator',
          action: 'UNDO',
          status: 'success',
          timestamp: new Date().toISOString(),
        };
        setRecentActivity(prev => [entry, ...prev].slice(0, 30));
      }
    } catch (err) {
      toast.error(`Undo network error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      refreshTeams();
    }
  };

  // Check-In Action
  const handleCheckIn = async (teamId: string, rowIndex?: number) => {
    // CRITICAL: Synchronously open WhatsApp popup window BEFORE first await to avoid popup blockers
    let waWindow: Window | null = null;
    if (autoOpenWhatsApp) {
      waWindow = openWhatsAppWindow();
    }

    const team = teams.find(t => t.teamId.toLowerCase() === teamId.toLowerCase());
    if (!team) {
      if (waWindow) closeWhatsAppWindow(waWindow);
      return;
    }

    if (team.isPresent) {
      if (waWindow) closeWhatsAppWindow(waWindow);
      toast.info(
        <div className="flex flex-col gap-1">
          <div className="font-semibold text-white">Team {teamId} Already Checked In</div>
          <div className="text-[11px] text-[#A0A0A0]">
            This team was already marked Present. No further action needed.
          </div>
        </div>,
        { duration: 4000 }
      );
      setSearch('');
      setTimeout(() => searchInputRef.current?.focus(), 50);
      return;
    }

    let token = await getIdToken();
    if (!token) {
      try {
        const { auth } = await import('@/lib/firebase/client');
        token = (await auth.currentUser?.getIdToken()) || null;
      } catch {
        token = null;
      }
    }
    if (!token) {
      token = 'session';
    }

    setProcessingTeamId(teamId);

    try {
      const idempotencyKey = generateIdempotencyKey(teamId, user?.uid ?? 'organizer');
      const res = await fetch('/api/check-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'x-user-email': user?.email || 'Organizer',
        },
        body: JSON.stringify({
          teamId,
          action: 'mark',
          idempotencyKey,
          rowIndex: rowIndex ?? team.rowIndex,
          executeLiveWrite: true,
          organizerEmail: user?.email || 'Organizer',
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (data.success || res.ok) {
        sound.playSuccessChime();

        if (data.data?.alreadyMarked) {
          if (waWindow) closeWhatsAppWindow(waWindow);
          toast.info(`Team ${teamId} was already marked Present.`);
          updateTeamLocally(teamId, { isPresent: true, attendanceValue: 'P' });
          setSearch('');
          setTimeout(() => searchInputRef.current?.focus(), 60);
          return;
        }

        // Update local state to Present
        updateTeamLocally(teamId, { isPresent: true, attendanceValue: 'P' });

        // Add to session's recently marked list (up to 10)
        const now = Date.now();
        setRecentlyMarked(prev => [
          {
            teamId,
            teamName: team.teamName,
            leaderName: team.leaderName,
            leaderPhone: team.leaderPhone,
            markedAt: now,
          },
          ...prev.filter(t => t.teamId.toLowerCase() !== teamId.toLowerCase()),
        ].slice(0, 10));

        // Populate WhatsApp Web chat in popup window
        const cleanPhone = normalizeIndianPhone(team.leaderPhone);
        if (cleanPhone && waWindow) {
          const waMsg = buildCheckInMessage({
            leadName: team.leaderName,
            teamName: team.teamName,
            teamId: team.teamId,
          });
          loadChat(waWindow, cleanPhone, waMsg);
        } else if (waWindow) {
          closeWhatsAppWindow(waWindow);
        }

        // Show 5-second Sonner toast with Undo action
        const capturedWaWindow = waWindow;
        const toastId = toast.success(
          <div className="flex flex-col gap-1">
            <div className="font-semibold text-white">Team {teamId} Checked In!</div>
            <div className="text-[11px] text-[#A0A0A0]">
              Press Ctrl+Z or click Undo within 5s to revert.
            </div>
          </div>,
          {
            duration: 5000,
            action: {
              label: 'Undo',
              onClick: () => handleUndo(teamId, capturedWaWindow),
            },
          }
        );

        if (activeUndoRef.current?.timeoutId) {
          clearTimeout(activeUndoRef.current.timeoutId);
        }
        const timeoutId = setTimeout(() => {
          if (activeUndoRef.current?.teamId === teamId) {
            activeUndoRef.current = null;
          }
        }, 5000);

        activeUndoRef.current = {
          teamId,
          waWindow: capturedWaWindow,
          toastId,
          timeoutId,
        };

        const entry: AuditEntry = {
          id: `entry_${Date.now()}`,
          teamId,
          teamName: team.teamName,
          organizerUid: user?.uid ?? 'organizer',
          organizerEmail: user?.email ?? 'Administrator',
          action: 'CHECK_IN',
          status: 'success',
          timestamp: new Date().toISOString(),
        };
        setRecentActivity(prev => [entry, ...prev].slice(0, 30));
        setAnnouncement(`Team ${teamId} Checked In!`);

        setSearch('');
        setSelectedIndex(null);
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 60);
      } else {
        if (waWindow) closeWhatsAppWindow(waWindow);
        sound.playWarningTone();
        toast.error(`Check-in failed: ${data.error || 'Server sync error'}`);
      }
    } catch {
      if (waWindow) closeWhatsAppWindow(waWindow);
      sound.playWarningTone();
      toast.error('Network failure during check-in');
    } finally {
      setProcessingTeamId(undefined);
    }
  };

  // Ctrl+Z / Cmd+Z Keydown Listener for active 5s undo
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        if (activeUndoRef.current) {
          e.preventDefault();
          const { teamId, waWindow } = activeUndoRef.current;
          handleUndo(teamId, waWindow);
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // 12 PRODUCTION KEYBOARD SHORTCUTS IMPLEMENTATION
  useKeyboardShortcuts([
    // 1. / — Focus Search
    {
      id: 'focus-search',
      key: '/',
      description: 'Focus Search',
      category: 'navigation',
      allowInInput: false,
      handler: () => {
        searchInputRef.current?.focus();
        setAnnouncement('Search focused');
      },
    },
    // 2. Ctrl + K / Cmd + K — Quick Search Modal
    {
      id: 'quick-search',
      key: 'k',
      ctrlOrCmd: true,
      description: 'Quick Search Modal',
      category: 'navigation',
      allowInInput: true,
      handler: () => {
        setQuickSearchOpen(true);
      },
    },
    // 3a. ArrowDown — Navigate Next Team
    {
      id: 'navigate-down',
      key: 'ArrowDown',
      description: 'Navigate Next Team',
      category: 'navigation',
      allowInInput: false,
      handler: () => {
        if (filteredTeams.length === 0) return;
        setSelectedIndex(prev => {
          const next = prev === null || prev >= filteredTeams.length - 1 ? 0 : prev + 1;
          const nextTeam = filteredTeams[next];
          if (nextTeam) {
            document.getElementById(`team-card-${nextTeam.teamId}`)?.scrollIntoView({ block: 'nearest' });
            setAnnouncement(`Selected team ${nextTeam.teamId}, ${nextTeam.teamName}`);
          }
          return next;
        });
      },
    },
    // 3b. ArrowUp — Navigate Previous Team
    {
      id: 'navigate-up',
      key: 'ArrowUp',
      description: 'Navigate Previous Team',
      category: 'navigation',
      allowInInput: false,
      handler: () => {
        if (filteredTeams.length === 0) return;
        setSelectedIndex(prev => {
          const next = prev === null || prev <= 0 ? filteredTeams.length - 1 : prev - 1;
          const nextTeam = filteredTeams[next];
          if (nextTeam) {
            document.getElementById(`team-card-${nextTeam.teamId}`)?.scrollIntoView({ block: 'nearest' });
            setAnnouncement(`Selected team ${nextTeam.teamId}, ${nextTeam.teamName}`);
          }
          return next;
        });
      },
    },
    // 4. Enter — Mark Selected Team Present directly
    {
      id: 'open-selected',
      key: 'Enter',
      description: 'Mark Selected Team Present',
      category: 'attendance',
      allowInInput: false,
      handler: () => {
        if (confirmingTeam || undoConfirmTeam || quickSearchOpen || helpOpen || exportOpen) return;

        if (selectedIndex !== null && filteredTeams[selectedIndex]) {
          const team = filteredTeams[selectedIndex];
          if (team.isPresent) {
            toast.info(`Team ${team.teamId} is already marked present.`);
          } else {
            handleCheckIn(team.teamId, team.rowIndex);
          }
        }
      },
    },
    // 5. Escape — Close or Clear
    {
      id: 'close-or-clear',
      key: 'Escape',
      description: 'Close or Clear',
      category: 'navigation',
      allowInInput: true,
      handler: () => {
        if (helpOpen) { setHelpOpen(false); return; }
        if (quickSearchOpen) { setQuickSearchOpen(false); return; }
        if (exportOpen) { setExportOpen(false); return; }
        if (confirmingTeam) { setConfirmingTeam(null); return; }
        if (undoConfirmTeam) { setUndoConfirmTeam(null); return; }
        if (quickScanActive) { setQuickScanActive(false); return; }

        if (search) {
          setSearch('');
          setAnnouncement('Search query cleared');
          return;
        }

        if (selectedIndex !== null) {
          setSelectedIndex(null);
          setAnnouncement('Selection cleared');
        }
      },
    },
    // 6. Alt + P — Mark Selected Team Present
    {
      id: 'mark-present',
      key: 'p',
      alt: true,
      description: 'Mark Selected Team Present',
      category: 'attendance',
      allowInInput: true,
      handler: () => {
        if (!canCheckIn) {
          toast.error('You do not have permission to mark attendance.');
          return;
        }
        if (selectedIndex === null || !filteredTeams[selectedIndex]) {
          toast.warning('No team selected. Use ↑ / ↓ to select a team first.');
          return;
        }
        const team = filteredTeams[selectedIndex];
        if (team.isPresent) {
          toast.info(`Team ${team.teamId} is already marked present.`);
          return;
        }
        if (processingTeamId === team.teamId) {
          toast.warning(`Attendance operation is already pending for Team ${team.teamId}.`);
          return;
        }
        handleCheckIn(team.teamId, team.rowIndex);
      },
    },
    // 7. Alt + U — Filter Unmarked Teams
    {
      id: 'filter-unmarked',
      key: 'u',
      alt: true,
      description: 'Filter Unmarked Teams',
      category: 'attendance',
      allowInInput: true,
      handler: () => {
        setFilter('not_present');
        setSelectedIndex(null);
        toast.info('Filter active: Showing Not Present teams (Alt + U)');
        setAnnouncement('Filter set to Not Present teams');
      },
    },
    // 8. Alt + A — Show All Teams
    {
      id: 'filter-all',
      key: 'a',
      alt: true,
      description: 'Show All Teams',
      category: 'attendance',
      allowInInput: true,
      handler: () => {
        setFilter('all');
        setSelectedIndex(null);
        toast.info('Filter reset: Showing All teams (Alt + A)');
        setAnnouncement('Filter reset to All teams');
      },
    },
    // 9. Alt + R — Refresh Team Data
    {
      id: 'refresh-data',
      key: 'r',
      alt: true,
      description: 'Refresh Team Data',
      category: 'attendance',
      allowInInput: true,
      handler: async () => {
        if (syncInProgress) {
          toast.warning('A refresh is already in progress.');
          return;
        }
        toast.loading('Synchronizing live registrations from Google Sheets...', { id: 'refresh-sync' });
        try {
          const ok = await refreshTeams(false, true);
          if (ok) {
            toast.success('Live registrations synchronized successfully!', { id: 'refresh-sync' });
            setAnnouncement('Registrations synchronized with Google Sheets');
          } else {
            toast.error('Sync failed or returned empty data.', { id: 'refresh-sync' });
          }
        } catch {
          toast.error('Network error during synchronization.', { id: 'refresh-sync' });
        }
      },
    },
    // 10. Alt + Q — Toggle Quick Scan Mode
    {
      id: 'quick-scan',
      key: 'q',
      alt: true,
      description: 'Toggle Quick Scan Mode',
      category: 'attendance',
      allowInInput: true,
      handler: () => {
        setQuickScanActive(prev => {
          const next = !prev;
          toast.info(next ? 'Quick Scan Mode Active (Alt + Q)' : 'Quick Scan Mode Deactivated');
          setAnnouncement(next ? 'Quick scan mode active' : 'Quick scan mode closed');
          return next;
        });
      },
    },
    // 11. Alt + E — Export Options
    {
      id: 'export-options',
      key: 'e',
      alt: true,
      description: 'Export Options',
      category: 'attendance',
      allowInInput: true,
      handler: () => {
        setExportOpen(true);
      },
    },
    // 12. ? — Keyboard Shortcut Help
    {
      id: 'help',
      key: '?',
      description: 'Keyboard Shortcuts Help',
      category: 'help',
      allowInInput: false,
      handler: () => {
        setHelpOpen(true);
      },
    },
  ]);

  return (
    <div className="space-y-4 w-full max-w-full pb-16">
      {/* Screen Reader Live Announcement Region */}
      <div className="sr-only" aria-live="polite">
        {announcement}
      </div>

      {/* Offline Alert */}
      {!isOnline && <OfflineBanner />}

      {/* Quick Scan Handheld / Barcode Bar */}
      <QuickScanBar
        active={quickScanActive}
        onToggle={setQuickScanActive}
        teams={teams}
        onTeamScanned={team => {
          handleCheckIn(team.teamId, team.rowIndex);
        }}
      />

      {/* Sticky Full-Width Search & Filter Bar */}
      <div className="sticky top-14 z-20 bg-[#080808]/95 backdrop-blur-2xl py-3.5 -mx-4 px-4 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8 border-b border-white/10 transition-all space-y-3">
        {/* Row 1: Full-width search bar extending across entire workspace */}
        <div className="w-full">
          <SearchBar
            inputRef={searchInputRef}
            value={search}
            onChange={val => {
              setSearch(val);
              setSelectedIndex(null);
            }}
            onNavigateDown={() => {
              if (filteredTeams.length > 0) {
                setSelectedIndex(0);
                document.getElementById(`team-card-${filteredTeams[0].teamId}`)?.scrollIntoView({ block: 'nearest' });
              }
            }}
            onNavigateUp={() => {
              if (filteredTeams.length > 0) {
                const last = filteredTeams.length - 1;
                setSelectedIndex(last);
                document.getElementById(`team-card-${filteredTeams[last].teamId}`)?.scrollIntoView({ block: 'nearest' });
              }
            }}
            placeholder="Search by Team ID (e.g. LAK-001), team name, leader, college... (Press '/' to focus)"
          />
        </div>

        {/* Row 2: Attendance status filter tabs, Auto-WhatsApp switch, and counter */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FilterTabs
            value={filter}
            onChange={v => {
              setFilter(v);
              setSelectedIndex(null);
            }}
            counts={counts}
          />

          <div className="flex items-center gap-3">
            {/* WhatsApp Auto-Popup Switch */}
            <button
              onClick={toggleAutoOpenWhatsApp}
              title="Automatically open WhatsApp Web popup upon verified check-in"
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                autoOpenWhatsApp
                  ? 'bg-[#25D366]/15 border-[#25D366]/40 text-[#25D366] shadow-[0_0_12px_rgba(37,211,102,0.15)]'
                  : 'bg-white/[0.04] border-white/10 text-[#808080] hover:text-[#B0B0B0]'
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Auto WhatsApp:</span>
              <span className="font-semibold">{autoOpenWhatsApp ? 'ON' : 'OFF'}</span>
            </button>

            <div className="flex items-center gap-3 text-xs text-[#808080]">
              <span>
                Showing <strong className="text-[#F0F0F0] font-mono">{filteredTeams.length}</strong> of{' '}
                <strong className="text-[#F0F0F0] font-mono">{teams.length}</strong> teams
              </span>
              {selectedIndex !== null && filteredTeams[selectedIndex] && (
                <span className="hidden md:inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 font-mono text-[11px]">
                  Nav: {filteredTeams[selectedIndex].teamId} [{selectedIndex + 1}/{filteredTeams.length}]
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* RECENTLY MARKED SESSION HISTORY BAR (< 60s instant undo, > 60s confirmation) */}
      {recentlyMarked.length > 0 && (
        <div className="w-full rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-xl p-3.5 space-y-2.5 shadow-sm">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 font-medium text-[#E0E0E0]">
              <Clock className="h-4 w-4 text-emerald-400" />
              <span>Recently Checked In ({recentlyMarked.length})</span>
              <span className="text-[11px] text-[#707070] hidden sm:inline">&middot; Undo directly within 60s</span>
            </div>
            <span className="text-[11px] text-[#606060] font-mono">Session History</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {recentlyMarked.map(item => {
              const isRecent = Date.now() - item.markedAt <= 60000;
              const phone = normalizeIndianPhone(item.leaderPhone);
              const waChatUrl = phone
                ? `https://web.whatsapp.com/send?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(
                    buildCheckInMessage({
                      leadName: item.leaderName,
                      teamName: item.teamName,
                      teamId: item.teamId,
                    })
                  )}`
                : null;

              return (
                <div
                  key={item.teamId}
                  className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/60 px-2.5 py-1.5 text-xs text-[#E0E0E0] shadow-sm"
                >
                  <span className="font-mono font-bold text-emerald-400">{item.teamId}</span>
                  <span className="truncate max-w-[130px] text-[#B0B0B0]" title={item.teamName}>
                    {item.teamName}
                  </span>
                  {phone && (
                    <button
                      type="button"
                      onClick={() => {
                        loadChat(null, phone, buildCheckInMessage({
                          leadName: item.leaderName,
                          teamName: item.teamName,
                          teamId: item.teamId,
                        }));
                      }}
                      title="Open WhatsApp chat in the same window"
                      className="text-[#25D366] hover:text-[#25D366]/80 p-0.5 rounded hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (isRecent) {
                        handleUndo(item.teamId);
                      } else {
                        setUndoConfirmTeam(item);
                      }
                    }}
                    className="h-6 px-1.5 text-[11px] text-[#A0A0A0] hover:text-amber-300 hover:bg-amber-950/30"
                  >
                    <Undo2 className="h-3 w-3 mr-1" />
                    Undo
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SINGLE-COLUMN FULL-WIDTH ATTENDANCE LIST */}
      <div className="w-full">
        {loading && teams.length === 0 ? (
          <EmptyState variant="loading" />
        ) : isDuplicateSearch ? (
          <EmptyState variant="duplicate" searchTerm={trimmedSearch} />
        ) : filteredTeams.length === 0 ? (
          <EmptyState
            variant={search ? 'no-match' : filter !== 'all' ? 'no-filter-match' : 'no-teams'}
            searchTerm={search}
            onRetry={() => {
              setSearch('');
              setFilter('all');
              setSelectedIndex(null);
              refreshTeams();
            }}
          />
        ) : (
          <div className="w-full flex flex-col space-y-2.5" role="list" aria-label="Team registrations">
            {filteredTeams.map((team, idx) => (
              <TeamCard
                key={team.teamId}
                team={team}
                onCheckIn={handleCheckIn}
                canCheckIn={canCheckIn}
                processingTeamId={processingTeamId}
                isDuplicate={duplicateIds.has(team.teamId.toLowerCase())}
                isSelected={selectedIndex === idx}
                onSelect={() => setSelectedIndex(idx)}
                onRequestCheckIn={() => handleCheckIn(team.teamId, team.rowIndex)}
              />
            ))}
          </div>
        )}
      </div>

      {/* RECENT CHECK-INS EVENT LOG */}
      {recentActivity.length > 0 && (
        <div className="w-full pt-8 border-t border-white/10">
          <RecentActivity entries={recentActivity} />
        </div>
      )}

      {/* ATTENDANCE UNDO CONFIRMATION MODAL (> 60 seconds) */}
      <Dialog open={Boolean(undoConfirmTeam)} onOpenChange={open => !open && setUndoConfirmTeam(null)}>
        <DialogContent className="max-w-md bg-[#101010] border-white/10 text-[#F0F0F0]">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-amber-400 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Confirm Attendance Undo
            </DialogTitle>
            <DialogDescription className="text-xs text-[#808080]">
              This attendance mark was registered more than 60 seconds ago. Reverting will clear Attendance in Google Sheets and mark the team absent.
            </DialogDescription>
          </DialogHeader>

          {undoConfirmTeam && (
            <div className="space-y-2.5 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-white/5">
                <span className="text-[#808080]">Team ID</span>
                <span className="font-mono font-bold text-[#F0F0F0]">{undoConfirmTeam.teamId}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-white/5">
                <span className="text-[#808080]">Team Name</span>
                <span className="font-medium text-[#F0F0F0] truncate max-w-[220px]">
                  {undoConfirmTeam.teamName}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-[#808080]">Time Since Check-in</span>
                <span className="font-mono text-amber-300">
                  {Math.round((Date.now() - undoConfirmTeam.markedAt) / 1000)}s ago
                </span>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setUndoConfirmTeam(null)}
              className="border-white/10 bg-white/[0.04] text-[#A0A0A0] hover:text-white"
            >
              Cancel (Esc)
            </Button>
            <Button
              size="sm"
              onClick={async () => {
                if (!undoConfirmTeam) return;
                const target = undoConfirmTeam;
                setUndoConfirmTeam(null);
                await handleUndo(target.teamId);
              }}
              className="bg-red-600 hover:bg-red-500 text-white font-semibold"
            >
              <Undo2 className="h-3.5 w-3.5 mr-1" />
              Confirm Undo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QUICK SEARCH COMMAND PALETTE MODAL (Ctrl+K / Cmd+K) */}
      <QuickSearchDialog
        open={quickSearchOpen}
        onOpenChange={setQuickSearchOpen}
        onSelectTeam={team => {
          const idx = filteredTeams.findIndex(t => t.teamId.toLowerCase() === team.teamId.toLowerCase());
          if (idx >= 0) {
            setSelectedIndex(idx);
            document.getElementById(`team-card-${team.teamId}`)?.scrollIntoView({ block: 'nearest' });
          }
          if (team.isPresent) {
            toast.info(`Team ${team.teamId} is already marked present.`);
          } else {
            handleCheckIn(team.teamId, team.rowIndex);
          }
        }}
      />

      {/* KEYBOARD SHORTCUTS REFERENCE MODAL (?) */}
      <KeyboardShortcutsHelpDialog
        open={helpOpen}
        onOpenChange={setHelpOpen}
      />

      {/* EXPORT OPTIONS MODAL (Alt+E) */}
      <ExportOptionsDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        canExport={canExport}
      />
    </div>
  );
}
