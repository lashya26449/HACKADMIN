'use client';
import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useTeams } from '@/contexts/TeamsContext';
import { SearchBar } from '@/components/check-in/SearchBar';
import { FilterTabs, type FilterValue } from '@/components/check-in/FilterTabs';
import { TeamCard } from '@/components/check-in/TeamCard';
import { EmptyState } from '@/components/check-in/EmptyState';
import { OfflineBanner } from '@/components/check-in/OfflineBanner';
import { RecentActivity } from '@/components/check-in/RecentActivity';
import { hasPermission } from '@/lib/firebase/auth-helpers';
import { trimTeamId, generateIdempotencyKey } from '@/lib/utils';
import type { AuditEntry } from '@/types';

export default function CheckInPage() {
  const { user, role } = useAuth();
  const { teams, loading, isOnline, updateTeamLocally, refreshTeams } = useTeams();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterValue>('all');
  const [processingTeamId, setProcessingTeamId] = useState<string | undefined>();
  const [recentActivity, setRecentActivity] = useState<AuditEntry[]>([]);

  const canCheckIn = hasPermission(role, 'canCheckIn');
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
    if (!canCheckIn) {
      toast.error('Permission denied: You do not have check-in rights.');
      return;
    }
    if (!isOnline) {
      toast.error('Cannot check in while offline');
      return;
    }
    if (duplicateIds.has(teamId.toLowerCase())) {
      toast.error(`Blocked: Duplicate Team ID ${teamId} found in spreadsheet.`);
      return;
    }

    const team = teams.find(t => t.teamId.toLowerCase() === teamId.toLowerCase());
    if (!team) return;

    if (team.isPresent) {
      toast.info(`Team ${teamId} is already marked present.`);
      return;
    }

    setProcessingTeamId(teamId);

    try {
      const idempotencyKey = generateIdempotencyKey(teamId, user?.uid ?? 'organizer');
      const res = await fetch('/api/check-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer session',
          'x-user-email': user?.email || 'Administrator',
        },
        body: JSON.stringify({
          teamId,
          idempotencyKey,
          rowIndex: rowIndex ?? team.rowIndex,
          executeLiveWrite: true,
          organizerEmail: user?.email || 'Administrator',
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success(`Team ${teamId} attendance verified & written to Column P!`);

        // Update local state ONLY after backend verifies the Google Sheets write
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
      } else {
        throw new Error(data.error ?? 'Check-in failed');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Check-in write failed';
      toast.error(msg);
      throw err;
    } finally {
      setProcessingTeamId(undefined);
    }
  };

  return (
    <div className="space-y-4 w-full max-w-full pb-16">
      {/* Offline Alert */}
      {!isOnline && <OfflineBanner />}

      {/* Sticky Full-Width Search & Filter Bar */}
      <div className="sticky top-0 z-30 bg-[#080808]/95 backdrop-blur-2xl py-3.5 -mx-4 px-4 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8 border-b border-white/10 transition-all space-y-3">
        {/* Row 1: Full-width search bar extending across entire workspace */}
        <div className="w-full">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search by Team ID (e.g. LAK-001), team name, leader, college..."
          />
        </div>

        {/* Row 2: Attendance status filter tabs (All / Present / Not Present) and counter */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FilterTabs value={filter} onChange={setFilter} counts={counts} />
          <div className="hidden sm:flex items-center gap-2 text-xs text-[#808080]">
            <span>Showing <strong className="text-[#F0F0F0] font-mono">{filteredTeams.length}</strong> of <strong className="text-[#F0F0F0] font-mono">{teams.length}</strong> teams</span>
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
              refreshTeams();
            }}
          />
        ) : (
          <div className="w-full flex flex-col space-y-2.5">
            {filteredTeams.map(team => (
              <TeamCard
                key={team.teamId}
                team={team}
                onCheckIn={handleCheckIn}
                canCheckIn={canCheckIn}
                processingTeamId={processingTeamId}
                isDuplicate={duplicateIds.has(team.teamId.toLowerCase())}
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
    </div>
  );
}
