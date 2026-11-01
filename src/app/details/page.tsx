'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Search, Users, Phone, School, X,
  ExternalLink, Copy, Check, RefreshCw, AlertCircle
} from 'lucide-react';
import type { TeamDetailRecord, TeamMemberDetail } from '@/types';
import { toast } from 'sonner';

export default function DetailsPage() {
  const [teams, setTeams] = useState<TeamDetailRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<TeamDetailRecord | null>(null);
  const [permissionNeeded, setPermissionNeeded] = useState(false);
  const [serviceAccountEmail, setServiceAccountEmail] = useState('');
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [source, setSource] = useState<'live_google_sheet' | 'demo_preview'>('live_google_sheet');

  const fetchDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/details');
      const data = await res.json();

      if (data.success && data.teams) {
        setTeams(data.teams);
        setSource(data.source || 'live_google_sheet');
        setPermissionNeeded(Boolean(data.permissionNeeded));
        if (data.serviceAccountEmail) {
          setServiceAccountEmail(data.serviceAccountEmail);
        }
      } else {
        throw new Error(data.error || 'Failed to fetch details');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, []);

  // Filter and sort teams by search query
  const filteredTeams = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return teams;

    return teams.filter(t => {
      const matchId = t.teamId.toLowerCase().includes(q);
      const matchName = t.teamName.toLowerCase().includes(q);
      const matchCollege = t.college.toLowerCase().includes(q);
      const matchLead = t.leaderName.toLowerCase().includes(q);
      const matchPhone = t.leaderPhone.toLowerCase().includes(q);
      const matchMembers = t.members.some(m =>
        m.name.toLowerCase().includes(q) ||
        (m.college && m.college.toLowerCase().includes(q)) ||
        (m.phone && m.phone.toLowerCase().includes(q))
      );
      return matchId || matchName || matchCollege || matchLead || matchPhone || matchMembers;
    });
  }, [teams, search]);

  const copyEmail = () => {
    if (!serviceAccountEmail) return;
    navigator.clipboard.writeText(serviceAccountEmail);
    setCopiedEmail(true);
    toast.success('Service Account email copied to clipboard!');
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  const cleanPhone = (phone?: string) => {
    if (!phone) return '';
    return phone.replace(/[^\d+]/g, '');
  };

  return (
    <div className="min-h-screen bg-[#07090E] text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30">
      {/* Top Banner / Navigation */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#07090E]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center font-black text-black shadow-lg shadow-emerald-500/20">
              L
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-wide">
                LAKSHYA 2026 &middot; <span className="text-emerald-400 font-semibold">Team Directory</span>
              </h1>
              <p className="text-[11px] text-slate-400">Public Team & Member Details</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchDetails}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-all active:scale-95 disabled:opacity-50"
              title="Refresh sheet data"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </header>

      {/* Permission Needed / Instructions Notice */}
      {permissionNeeded && (
        <div className="border-b border-amber-500/30 bg-amber-950/40 backdrop-blur-md px-4 py-3">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-200">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-white">Google Sheet Access Setup Needed</p>
                <p className="text-[11px] text-amber-200/90 mt-0.5">
                  Showing verified directory layout. To connect your live sheet directly, share your spreadsheet with:
                </p>
                <code className="inline-block mt-1 px-2 py-0.5 rounded bg-black/40 border border-amber-500/30 font-mono text-[11px] text-amber-300 selection:bg-amber-500/40">
                  {serviceAccountEmail || 'hackadmin-sheets@hackadmin-lakshya-2026.iam.gserviceaccount.com'}
                </code>
              </div>
            </div>
            <button
              onClick={copyEmail}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 font-medium transition-all shrink-0 active:scale-95"
            >
              {copiedEmail ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copiedEmail ? 'Copied Email' : 'Copy Service Account Email'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full space-y-6">
        {/* Search & Stats Bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1 max-w-lg">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search Team ID, Team Name, Member, College, or Phone..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all font-sans"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white rounded-md"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-400">
            <div className="px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/10">
              Teams: <span className="font-mono font-bold text-emerald-400">{filteredTeams.length}</span> / {teams.length}
            </div>
            {source === 'live_google_sheet' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-400 font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Google Sheet
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-[11px] text-blue-300 font-medium">
                Sheet Preview Mode
              </span>
            )}
          </div>
        </div>

        {/* Loading Skeleton */}
        {loading && teams.length === 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-28 rounded-2xl bg-white/[0.02] border border-white/10 animate-pulse p-5" />
            ))}
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/30 text-red-200 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={fetchDetails} className="underline text-red-300 hover:text-white text-xs">
              Retry
            </button>
          </div>
        )}

        {/* Empty Search Result */}
        {!loading && filteredTeams.length === 0 && (
          <div className="py-16 text-center space-y-2">
            <Users className="h-8 w-8 text-slate-600 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-300">No teams matched &quot;{search}&quot;</h3>
            <p className="text-xs text-slate-500">Check the spelling or try searching by College or Member Name.</p>
          </div>
        )}

        {/* Team Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {filteredTeams.map(team => {
            const leadTel = cleanPhone(team.leaderPhone);
            return (
              <div
                key={team.teamId}
                onClick={() => setSelectedTeam(team)}
                className="group relative rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] active:bg-white/[0.08] hover:border-emerald-500/40 p-3.5 sm:p-5 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-xl hover:shadow-emerald-500/5 active:scale-[0.99] flex items-center justify-between gap-3 sm:gap-4"
              >
                {/* Left Side: Team ID and Team Name */}
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <span className="font-mono text-[11px] sm:text-xs font-bold px-2 sm:px-2.5 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 tracking-wider">
                      {team.teamId}
                    </span>
                    <span className="text-[10px] sm:text-[11px] text-slate-400 flex items-center gap-1">
                      <Users className="h-3 w-3 text-slate-500 shrink-0" />
                      <span>{team.members.length}</span>
                    </span>
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-white tracking-tight break-words sm:truncate group-hover:text-emerald-300 transition-colors">
                    {team.teamName}
                  </h3>
                </div>

                {/* Right Side: College Name in Small, Team Lead Name, and Mobile Direct Call */}
                <div className="text-right shrink-0 max-w-[48%] sm:max-w-[240px] space-y-0.5 sm:space-y-1">
                  <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium truncate" title={team.college}>
                    {team.college}
                  </p>
                  <p className="text-[11px] sm:text-xs font-semibold text-slate-200 truncate">
                    {team.leaderName}
                  </p>
                  {team.leaderPhone ? (
                    <a
                      href={`tel:${leadTel}`}
                      onClick={e => e.stopPropagation()}
                      className="inline-flex items-center gap-1 sm:gap-1.5 text-xs font-mono font-semibold text-emerald-400 hover:text-emerald-300 hover:underline pt-0.5 transition-colors active:scale-95"
                      title={`Call ${team.leaderName}`}
                    >
                      <Phone className="h-3 w-3 shrink-0" />
                      <span className="truncate">{team.leaderPhone}</span>
                    </a>
                  ) : (
                    <span className="text-[10px] sm:text-[11px] text-slate-500 italic">No phone</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* EXPANDED MODAL WITH BLUR BACKGROUND AROUND CARD (MOBILE & DESKTOP ACCESSIBLE) */}
      {selectedTeam && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in-0 duration-200"
          onClick={() => setSelectedTeam(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[90vh] sm:max-h-[85vh] flex flex-col rounded-t-[28px] sm:rounded-3xl border border-white/20 bg-[#0C1017] p-5 sm:p-7 shadow-2xl shadow-black/90 relative overflow-hidden animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200"
          >
            {/* Mobile Sheet Pull Bar */}
            <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-2 sm:hidden shrink-0" />

            {/* Top Close Button */}
            <button
              onClick={() => setSelectedTeam(null)}
              className="absolute top-4 right-4 sm:top-5 sm:right-5 h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-all active:scale-90 z-10"
              aria-label="Close modal"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Modal Header */}
            <div className="space-y-1.5 border-b border-white/10 pb-4 pr-10 shrink-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs sm:text-sm font-bold px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 tracking-wider">
                  {selectedTeam.teamId}
                </span>
                <span className="text-[11px] sm:text-xs text-slate-400 flex items-center gap-1.5 truncate max-w-[240px] sm:max-w-none">
                  <School className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                  <span className="truncate">{selectedTeam.college}</span>
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight break-words">
                {selectedTeam.teamName}
              </h2>
            </div>

            {/* Members Section (Scrollable on small screens) */}
            <div className="space-y-2.5 py-3 overflow-y-auto flex-1 min-h-0 pr-1 -mr-1">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-1">
                <span>Team Members ({selectedTeam.members.length})</span>
                <span>Contact</span>
              </div>

              <div className="divide-y divide-white/5 rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
                {selectedTeam.members.map((member: TeamMemberDetail, idx: number) => {
                  const memberTel = cleanPhone(member.phone);
                  return (
                    <div
                      key={idx}
                      className="p-3 sm:p-4 flex items-center justify-between gap-3 hover:bg-white/[0.02] transition-colors"
                    >
                      {/* Left: Member Name and College */}
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold text-white truncate">
                            {member.name}
                          </span>
                          {member.isLeader && (
                            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                              Lead
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                          {member.college || selectedTeam.college}
                        </p>
                      </div>

                      {/* Right: Mobile Number Linked to Direct Call */}
                      <div className="shrink-0 text-right">
                        {member.phone ? (
                          <a
                            href={`tel:${memberTel}`}
                            className="inline-flex items-center gap-1.5 min-h-[38px] px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 active:bg-emerald-500/30 border border-emerald-500/30 text-xs font-mono font-bold text-emerald-400 hover:text-emerald-300 transition-all active:scale-95 shadow-sm"
                            title={`Call ${member.name} directly`}
                          >
                            <Phone className="h-3.5 w-3.5 shrink-0" />
                            <span>{member.phone}</span>
                          </a>
                        ) : (
                          <span className="text-xs text-slate-500 italic px-2">No phone</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer (Cleaned: removed "Press Esc or click outside to close") */}
            <div className="pt-3 border-t border-white/10 shrink-0 flex items-center justify-end">
              <button
                onClick={() => setSelectedTeam(null)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/25 text-white font-medium text-xs transition-all active:scale-95"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
