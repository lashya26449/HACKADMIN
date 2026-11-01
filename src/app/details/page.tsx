'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Search, Users, Phone, School, X,
  Copy, Check, RefreshCw, AlertCircle
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
    <div className="min-h-screen bg-black text-white flex flex-col font-sans selection:bg-white selection:text-black">
      {/* Top Banner / Header (Black & White Frosted Glass) */}
      <header className="sticky top-0 z-30 border-b border-white/15 bg-black/70 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 sm:h-20 flex items-center justify-between gap-4">
          <div className="flex items-center">
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Lakshya Team Directory
              </h1>
              <p className="text-xs sm:text-sm text-neutral-400 font-medium">Public Team & Member Details</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchDetails}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-white/10 hover:bg-white/20 active:bg-white/30 border border-white/20 text-white transition-all active:scale-95 disabled:opacity-50"
              title="Refresh sheet data"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </header>

      {/* Permission Needed / Instructions Notice (Monochrome Frosted Glass) */}
      {permissionNeeded && (
        <div className="border-b border-white/20 bg-white/[0.04] backdrop-blur-xl px-4 py-3.5">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs sm:text-sm text-neutral-200">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-white shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-white text-sm">Google Sheet Sharing Setup</p>
                <p className="text-xs sm:text-sm text-neutral-300 mt-0.5">
                  Showing directory preview layout. To connect your live sheet, share your Google Spreadsheet as Viewer with:
                </p>
                <code className="inline-block mt-1.5 px-2.5 py-1 rounded-lg bg-black/60 border border-white/25 font-mono text-xs sm:text-sm text-white font-semibold">
                  {serviceAccountEmail || 'hackadmin-sheets@hackadmin-lakshya-2026.iam.gserviceaccount.com'}
                </code>
              </div>
            </div>
            <button
              onClick={copyEmail}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white text-black font-bold text-xs sm:text-sm hover:bg-neutral-200 transition-all shrink-0 active:scale-95 shadow-md"
            >
              {copiedEmail ? <Check className="h-4 w-4 text-black" /> : <Copy className="h-4 w-4 text-black" />}
              <span>{copiedEmail ? 'Copied Email' : 'Copy Service Account Email'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8 flex-1 w-full space-y-5 sm:space-y-7">
        {/* Search & Stats Bar */}
        <div className="flex flex-col sm:flex-row gap-3.5 items-stretch sm:items-center justify-between">
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search Team ID, Team Name, Member, College, or Phone..."
              className="w-full pl-12 pr-11 py-3 sm:py-3.5 rounded-2xl bg-white/[0.06] backdrop-blur-xl border border-white/20 text-base sm:text-lg text-white placeholder-neutral-500 focus:outline-none focus:border-white focus:ring-2 focus:ring-white/25 transition-all font-sans"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1.5 text-neutral-400 hover:text-white rounded-lg active:scale-90"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs sm:text-sm text-neutral-300">
            <div className="px-3.5 py-2 rounded-xl bg-white/[0.06] backdrop-blur-xl border border-white/15 font-medium">
              Teams: <span className="font-mono font-extrabold text-white text-sm sm:text-base">{filteredTeams.length}</span> / {teams.length}
            </div>
            {source === 'live_google_sheet' ? (
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-xs sm:text-sm text-emerald-400 font-bold shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                Live Sheet
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/15 text-xs sm:text-sm text-neutral-300 font-medium">
                Preview Mode
              </span>
            )}
          </div>
        </div>

        {/* Loading Skeleton */}
        {loading && teams.length === 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 w-full">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-32 rounded-3xl bg-white/[0.04] backdrop-blur-xl border border-white/10 animate-pulse p-6" />
            ))}
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="p-5 rounded-2xl bg-white/[0.06] backdrop-blur-xl border border-white/20 text-white text-sm sm:text-base flex items-center justify-between">
            <span>{error}</span>
            <button onClick={fetchDetails} className="underline text-white font-bold hover:text-neutral-300 text-sm">
              Retry
            </button>
          </div>
        )}

        {/* Empty Search Result */}
        {!loading && filteredTeams.length === 0 && (
          <div className="py-20 text-center space-y-3">
            <Users className="h-10 w-10 text-neutral-500 mx-auto" />
            <h3 className="text-base sm:text-lg font-bold text-white">No teams matched &quot;{search}&quot;</h3>
            <p className="text-xs sm:text-sm text-neutral-400">Check the spelling or try searching by College or Member Name.</p>
          </div>
        )}

        {/* Team Cards: Strictly 1 card per row on mobile & tablet (<1024px), dynamic 2-column on desktop (>=1024px) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 w-full">
          {filteredTeams.map(team => {
            const leadTel = cleanPhone(team.leaderPhone);
            return (
              <div
                key={team.teamId}
                onClick={() => setSelectedTeam(team)}
                className="group relative rounded-3xl border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] active:bg-white/[0.12] hover:border-white/40 backdrop-blur-2xl p-4 sm:p-6 transition-all duration-200 cursor-pointer shadow-[0_8px_32px_0_rgba(0,0,0,0.45)] hover:shadow-[0_12px_40px_0_rgba(255,255,255,0.08)] active:scale-[0.99] flex items-center justify-between gap-4"
              >
                {/* Left Side: Team ID and Team Name (Large, Ultra-Legible) */}
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs sm:text-sm font-black px-3 py-1 rounded-lg bg-white/10 border border-white/25 text-white tracking-widest shadow-inner">
                      {team.teamId}
                    </span>
                    <span className="text-xs sm:text-sm text-neutral-400 font-semibold flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
                      <span>{team.members.length} {team.members.length === 1 ? 'member' : 'members'}</span>
                    </span>
                  </div>
                  <h3 className="text-lg sm:text-2xl font-black text-white tracking-tight break-words group-hover:text-neutral-100 transition-colors">
                    {team.teamName}
                  </h3>
                </div>

                {/* Right Side: College Name in Small, Team Lead Name, and Mobile Direct Call */}
                <div className="text-right shrink-0 max-w-[48%] sm:max-w-[260px] space-y-1.5">
                  <p className="text-xs sm:text-sm text-neutral-300 font-medium truncate" title={team.college}>
                    {team.college}
                  </p>
                  <p className="text-sm sm:text-base font-bold text-white truncate">
                    {team.leaderName}
                  </p>
                  {team.leaderPhone ? (
                    <a
                      href={`tel:${leadTel}`}
                      onClick={e => e.stopPropagation()}
                      className="inline-flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/30 border border-white/25 text-xs sm:text-sm font-mono font-bold text-white transition-all active:scale-95 shadow-sm"
                      title={`Call ${team.leaderName}`}
                    >
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{team.leaderPhone}</span>
                    </a>
                  ) : (
                    <span className="text-xs text-neutral-500 italic">No phone</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* EXPANDED MODAL: FROSTED GLASS PURE BLACK & WHITE */}
      {selectedTeam && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/85 backdrop-blur-2xl animate-in fade-in-0 duration-200"
          onClick={() => setSelectedTeam(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[90vh] sm:max-h-[85vh] flex flex-col rounded-t-[32px] sm:rounded-3xl border border-white/25 bg-neutral-950/95 backdrop-blur-3xl p-5 sm:p-8 shadow-[0_20px_70px_rgba(0,0,0,0.9)] relative overflow-hidden animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-200"
          >
            {/* Mobile Pull Bar */}
            <div className="w-12 h-1 bg-white/30 rounded-full mx-auto mb-3 sm:hidden shrink-0" />

            {/* Top Close Button */}
            <button
              onClick={() => setSelectedTeam(null)}
              className="absolute top-5 right-5 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center text-white transition-all active:scale-90 z-10"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Modal Header */}
            <div className="space-y-2 border-b border-white/15 pb-5 pr-12 shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-sm sm:text-base font-black px-3.5 py-1.5 rounded-xl bg-white/15 border border-white/30 text-white tracking-widest">
                  {selectedTeam.teamId}
                </span>
                <span className="text-xs sm:text-sm text-neutral-300 font-medium flex items-center gap-1.5 truncate max-w-[240px] sm:max-w-none">
                  <School className="h-4 w-4 text-neutral-400 shrink-0" />
                  <span className="truncate">{selectedTeam.college}</span>
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight break-words">
                {selectedTeam.teamName}
              </h2>
            </div>

            {/* Members Section */}
            <div className="space-y-3 py-4 overflow-y-auto flex-1 min-h-0 pr-1 -mr-1">
              <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-neutral-400 uppercase tracking-wider px-1">
                <span>Team Members ({selectedTeam.members.length})</span>
                <span>Contact</span>
              </div>

              <div className="divide-y divide-white/10 rounded-2xl border border-white/15 bg-white/[0.03] backdrop-blur-xl overflow-hidden">
                {selectedTeam.members.map((member: TeamMemberDetail, idx: number) => {
                  const memberTel = cleanPhone(member.phone);
                  return (
                    <div
                      key={idx}
                      className="p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-white/[0.04] transition-colors"
                    >
                      {/* Left: Member Name and College */}
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-base sm:text-lg font-black text-white truncate">
                            {member.name}
                          </span>
                          {member.isLeader && (
                            <span className="text-[10px] sm:text-xs font-mono font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-white text-black shrink-0">
                              Lead
                            </span>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm text-neutral-300 truncate">
                          {member.college || selectedTeam.college}
                        </p>
                      </div>

                      {/* Right: Mobile Number Linked to Direct Call */}
                      <div className="shrink-0 text-right">
                        {member.phone ? (
                          <a
                            href={`tel:${memberTel}`}
                            className="inline-flex items-center gap-2 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl bg-white text-black hover:bg-neutral-200 active:bg-neutral-300 text-xs sm:text-sm font-mono font-extrabold transition-all active:scale-95 shadow-md"
                            title={`Call ${member.name} directly`}
                          >
                            <Phone className="h-3.5 w-3.5 shrink-0" />
                            <span>{member.phone}</span>
                          </a>
                        ) : (
                          <span className="text-xs sm:text-sm text-neutral-500 italic px-2">No phone</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer (Cleaned: No extra text) */}
            <div className="pt-4 border-t border-white/15 shrink-0 flex items-center justify-end">
              <button
                onClick={() => setSelectedTeam(null)}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-white text-black font-extrabold text-sm hover:bg-neutral-200 active:bg-neutral-300 transition-all active:scale-95 shadow-md"
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
