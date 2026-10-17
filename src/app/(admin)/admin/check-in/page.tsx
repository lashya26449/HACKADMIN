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
import { CheckCircle2, ArrowRight, RefreshCw, MapPin, Mail } from 'lucide-react';
import { sound } from '@/lib/audio';

export default function CheckInPage() {
  const { user, role, getIdToken } = useAuth();
  const { teams, loading, isOnline, updateTeamLocally, refreshTeams, syncInProgress } = useTeams();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterValue>('all');
  const [processingTeamId, setProcessingTeamId] = useState<string | undefined>();
  const [recentActivity, setRecentActivity] = useState<AuditEntry[]>([]);

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
      // 1. Status Filter Tab
      if (filter === 'present' && !t.isPresent) return false;
      if (filter === 'not_present' && t.isPresent) return false;

      // 2. Search Bar: Team ID, Team Name, Lead Name, College
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

  // Bound selectedIndex when filtered teams change
  useEffect(() => {
    if (selectedIndex !== null && selectedIndex >= filteredTeams.length) {
      setSelectedIndex(filteredTeams.length > 0 ? filteredTeams.length - 1 : null);
    }
  }, [filteredTeams.length, selectedIndex]);

  const counts = useMemo(
    () => ({
      all: teams.length,
      present: teams.filter(t => t.isPresent).length,
      notPresent: teams.filter(t => !t.isPresent).length,
    }),
    [teams]
  );

  const isDuplicateSearch = trimmedSearch && duplicateIds.has(trimmedSearch);

  const handleCheckIn = async (teamId: string, rowIndex?: number) => {
    const team = teams.find(t => t.teamId.toLowerCase() === teamId.toLowerCase());
    if (!team) return;

    if (team.isPresent) {
      toast.info(`Team ${teamId} is already marked present.`);
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
          idempotencyKey,
          rowIndex: rowIndex ?? team.rowIndex,
          executeLiveWrite: true,
          organizerEmail: user?.email || 'Organizer',
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (data.success || res.ok) {
        // Play crisp check-in success chime
        sound.playSuccessChime();

        toast.success(
          `Team ${teamId} Checked In! Arrival mail triggered.`,
          { duration: 5000 }
        );

        // Update local state to Present
        updateTeamLocally(teamId, { isPresent: true, attendanceValue: 'P' });

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
        setAnnouncement(`Team ${teamId} Checked In! Arrival mail triggered.`);
      } else {
        sound.playWarningTone();
        // Fallback: still mark present locally so event check-in desk is never blocked
        updateTeamLocally(teamId, { isPresent: true, attendanceValue: 'P' });
        toast.warning(`Marked present locally. Note: ${data.error || 'Server sync pending'}`);
      }
    } catch {
      sound.playWarningTone();
      // Offline / network failure fallback
      updateTeamLocally(teamId, { isPresent: true, attendanceValue: 'P' });
      toast.warning(`Marked present locally (offline/network pending)`);
    } finally {
      setProcessingTeamId(undefined);
    }
  };

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
    // 4. Enter — Open Selected Team
    {
      id: 'open-selected',
      key: 'Enter',
      description: 'Open Selected Team',
      category: 'navigation',
      allowInInput: false,
      handler: () => {
        if (confirmingTeam || quickSearchOpen || helpOpen || exportOpen) return;

        if (selectedIndex !== null && filteredTeams[selectedIndex]) {
          const team = filteredTeams[selectedIndex];
          if (team.isPresent) {
            toast.info(`Team ${team.teamId} is already marked present.`);
          } else {
            setConfirmingTeam(team);
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
          toast.info(`Team ${team.teamId} is already marked present. No further action needed.`);
          return;
        }
        if (processingTeamId === team.teamId) {
          toast.warning(`Attendance operation is already pending for Team ${team.teamId}.`);
          return;
        }
        setConfirmingTeam(team);
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
          setConfirmingTeam(team);
        }}
      />

      {/* Sticky Full-Width Search & Filter Bar */}
      <div className="sticky top-0 z-30 bg-[#080808]/95 backdrop-blur-2xl py-3.5 -mx-4 px-4 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8 border-b border-white/10 transition-all space-y-3">
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

        {/* Row 2: Attendance status filter tabs (All / Present / Not Present) and counter */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FilterTabs
            value={filter}
            onChange={v => {
              setFilter(v);
              setSelectedIndex(null);
            }}
            counts={counts}
          />
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

      {/* SINGLE-COLUMN FULL-WIDTH ATTENDANCE COUNTER */}
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
                onRequestCheckIn={() => setConfirmingTeam(team)}
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

      {/* CENTRALIZED ATTENDANCE CONFIRMATION MODAL */}
      <Dialog open={Boolean(confirmingTeam)} onOpenChange={open => !open && setConfirmingTeam(null)}>
        <DialogContent className="max-w-md bg-[#101010] border-white/10 text-[#F0F0F0]">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-[#F0F0F0]">
              Confirm Team Attendance
            </DialogTitle>
            <DialogDescription className="text-xs text-[#808080]">
              This writes &apos;P&apos; directly to column P of the live Google Sheet and verifies the update.
            </DialogDescription>
          </DialogHeader>

          {confirmingTeam && (
            <div className="space-y-3">
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3.5 space-y-2 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-white/5">
                  <span className="text-[#808080]">Team ID</span>
                  <span className="font-mono font-bold text-[#F0F0F0]">{confirmingTeam.teamId}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-white/5">
                  <span className="text-[#808080]">Team Name</span>
                  <span className="font-medium text-[#F0F0F0] truncate max-w-[220px]">
                    {confirmingTeam.teamName}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-white/5">
                  <span className="text-[#808080]">Lead Name</span>
                  <span className="text-[#B5B5B5] truncate max-w-[220px]">
                    {confirmingTeam.leaderName || 'Unassigned'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-white/5">
                  <span className="text-[#808080]">College</span>
                  <span className="text-[#B5B5B5] truncate max-w-[220px]">
                    {confirmingTeam.college || 'Unlisted'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-white/5">
                  <span className="text-[#808080]">Target Row</span>
                  <span className="font-mono text-[#F0F0F0]">Row {confirmingTeam.rowIndex ?? 'Auto-detect'}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-white/5">
                  <span className="text-[#808080]">Attendance Cell</span>
                  <span className="font-mono font-bold text-emerald-400">
                    {confirmingTeam.rowIndex ? `P${confirmingTeam.rowIndex}` : 'Column P'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-[#808080]">Proposed Value</span>
                  <span className="font-mono font-bold text-emerald-400 flex items-center gap-1">
                    &apos;P&apos; <ArrowRight className="h-3 w-3 text-[#808080]" />
                  </span>
                </div>
              </div>

              {/* Venue Arrival Directions Notice */}
              <div className="rounded-xl border border-purple-500/30 bg-purple-950/20 p-3 space-y-1.5 shadow-[0_0_15px_rgba(168,85,247,0.15)]">
                <div className="flex items-center gap-2 text-purple-300 font-semibold text-xs">
                  <MapPin className="h-4 w-4 text-purple-400 shrink-0" />
                  <span>Venue Arrival Instructions</span>
                </div>
                <div className="text-[11px] space-y-0.5 pl-6 text-[#E0E0E0]">
                  <p>
                    <span className="text-[#888888]">Destination: </span>
                    <strong className="text-white">CSE Seminar Hall</strong>
                  </p>
                  <p>
                    <span className="text-[#888888]">Directions: </span>
                    <strong className="text-purple-300">Go straight and take a left</strong>
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-purple-300/80 pl-6 pt-1">
                  <Mail className="h-3 w-3 text-purple-400" />
                  <span>Arrival directions email automatically triggered to team lead</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmingTeam(null)}
              className="border-white/10 bg-white/[0.04]"
            >
              Cancel (Esc)
            </Button>
            <Button
              size="sm"
              onClick={async () => {
                if (!confirmingTeam) return;
                const target = confirmingTeam;
                setConfirmingTeam(null);
                await handleCheckIn(target.teamId, target.rowIndex);
              }}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
              Confirm &amp; Write &apos;P&apos;
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
            setConfirmingTeam(team);
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
