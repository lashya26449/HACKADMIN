'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Search, Hash, CheckCircle2, User, School, ArrowRight, X } from 'lucide-react';
import { useTeams } from '@/contexts/TeamsContext';
import { trimTeamId } from '@/lib/utils';
import type { Team } from '@/types';

interface QuickSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTeam?: (team: Team) => void;
}

export function QuickSearchDialog({
  open,
  onOpenChange,
  onSelectTeam,
}: QuickSearchDialogProps) {
  const { teams } = useTeams();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input when dialog opens
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const trimmedQuery = trimTeamId(query).toLowerCase();

  const filteredTeams = useMemo(() => {
    if (!trimmedQuery) {
      return teams.slice(0, 10); // Show top 10 by default
    }
    return teams.filter(t => {
      const matchId = t.teamId.toLowerCase().includes(trimmedQuery);
      const matchName = t.teamName.toLowerCase().includes(trimmedQuery);
      const matchLead = (t.leaderName ?? '').toLowerCase().includes(trimmedQuery);
      const matchCollege = (t.college ?? '').toLowerCase().includes(trimmedQuery);
      const matchUtr = (t.paymentRef ?? '').toLowerCase().includes(trimmedQuery);
      return matchId || matchName || matchLead || matchCollege || matchUtr;
    }).slice(0, 20); // Limit to 20 for snappy performance
  }, [teams, trimmedQuery]);

  // Keep selected index within bounds
  useEffect(() => {
    if (selectedIndex >= filteredTeams.length) {
      setSelectedIndex(Math.max(0, filteredTeams.length - 1));
    }
  }, [filteredTeams.length, selectedIndex]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll('[data-team-item]');
    if (items[selectedIndex]) {
      items[selectedIndex].scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < filteredTeams.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : filteredTeams.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = filteredTeams[selectedIndex];
      if (selected) {
        onOpenChange(false);
        onSelectTeam?.(selected);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (query) {
        setQuery('');
      } else {
        onOpenChange(false);
      }
    }
  };

  const handleItemClick = (team: Team) => {
    onOpenChange(false);
    onSelectTeam?.(team);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl bg-[#0c0c0c] border border-white/10 text-[#F0F0F0] p-0 overflow-hidden shadow-2xl rounded-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Quick Search</DialogTitle>
        </DialogHeader>

        {/* Search Input Bar */}
        <div className="relative flex items-center border-b border-white/10 px-4 py-3 bg-white/[0.02]">
          <Search className="h-4 w-4 text-[#808080] shrink-0 mr-3 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a Team ID (e.g. LAK-001), team name, leader, college..."
            className="w-full bg-transparent text-sm text-[#F0F0F0] placeholder:text-[#808080] focus:outline-none font-mono"
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-[#808080] hover:text-[#F0F0F0] rounded-md transition-colors"
              aria-label="Clear query"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          className="max-h-[380px] overflow-y-auto p-2 space-y-1"
          role="listbox"
          aria-label="Search results"
        >
          {filteredTeams.length === 0 ? (
            <div className="py-10 text-center text-xs text-[#808080]">
              No teams matching &quot;{query}&quot;
            </div>
          ) : (
            filteredTeams.map((team, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={team.teamId}
                  data-team-item
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleItemClick(team)}
                  className={`flex items-center justify-between p-2.5 rounded-xl transition-colors cursor-pointer text-xs ${
                    isSelected
                      ? 'bg-white/[0.1] text-white border border-white/15'
                      : 'text-[#B5B5B5] hover:bg-white/[0.04] border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-white/[0.08] text-[#F0F0F0] border border-white/10 shrink-0">
                      {team.teamId}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[#F0F0F0] truncate">{team.teamName}</p>
                      <p className="text-[11px] text-[#808080] truncate mt-0.5 flex items-center gap-2">
                        {team.leaderName && (
                          <span className="flex items-center gap-1 shrink-0">
                            <User className="h-3 w-3 text-[#808080]" />
                            {team.leaderName}
                          </span>
                        )}
                        {team.college && (
                          <span className="flex items-center gap-1 truncate">
                            <School className="h-3 w-3 text-[#808080] shrink-0" />
                            {team.college}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    {team.isPresent ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/40">
                        <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                        PRESENT
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-white/[0.04] text-[#808080] border border-white/10">
                        NOT PRESENT
                      </span>
                    )}
                    {isSelected && (
                      <ArrowRight className="h-3.5 w-3.5 text-white/70" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Navigation Hints */}
        <div className="px-4 py-2 border-t border-white/10 bg-white/[0.02] flex items-center justify-between text-[11px] text-[#808080]">
          <div className="flex items-center gap-3">
            <span><kbd className="font-mono bg-white/[0.08] px-1 py-0.5 rounded text-white">↑</kbd> <kbd className="font-mono bg-white/[0.08] px-1 py-0.5 rounded text-white">↓</kbd> navigate</span>
            <span><kbd className="font-mono bg-white/[0.08] px-1 py-0.5 rounded text-white">Enter</kbd> select</span>
            <span><kbd className="font-mono bg-white/[0.08] px-1 py-0.5 rounded text-white">Esc</kbd> close</span>
          </div>
          <span>{filteredTeams.length} results</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
