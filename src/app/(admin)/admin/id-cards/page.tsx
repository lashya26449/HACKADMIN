'use client';
import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, FileText, ExternalLink, RefreshCw, Eye,
  Hash, School, User, CheckCircle2, AlertCircle, ShieldAlert
} from 'lucide-react';
import { CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useTeams } from '@/contexts/TeamsContext';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/lib/firebase/auth-helpers';
import { trimTeamId, extractDriveFileId } from '@/lib/utils';
import { toast } from 'sonner';
import { SecondaryAuthGate } from '@/components/auth/SecondaryAuthGate';

export default function IdCardsPage() {
  const router = useRouter();
  const { teams, loading } = useTeams();
  const { role, loading: authLoading } = useAuth();
  const [search, setSearch] = useState('');

  const canView = hasPermission(role, 'canViewIdCards');

  useEffect(() => {
    if (!authLoading && role && !canView) {
      toast.error('Access restricted to Administrators only');
      router.replace('/admin/check-in');
    }
  }, [authLoading, role, canView, router]);

  if (!authLoading && role && !canView) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-center">
        <ShieldAlert className="h-12 w-12 text-amber-400" />
        <h2 className="text-lg font-bold text-white">Access Restricted</h2>
        <p className="text-xs text-[#808080] max-w-md">
          College ID Cards verification is restricted to Administrators only. Redirecting to Check-in Desk...
        </p>
      </div>
    );
  }

  const trimmedSearch = trimTeamId(search).toLowerCase();

  const filteredTeams = useMemo(() => {
    if (!trimmedSearch) return teams;
    return teams.filter(
      t =>
        t.teamId.toLowerCase().includes(trimmedSearch) ||
        t.teamName.toLowerCase().includes(trimmedSearch) ||
        (t.leaderName ?? '').toLowerCase().includes(trimmedSearch) ||
        (t.college ?? '').toLowerCase().includes(trimmedSearch)
    );
  }, [teams, trimmedSearch]);

  const teamsWithUploads = useMemo(() => {
    return filteredTeams.filter(t => t.collegeIdUrls && t.collegeIdUrls.length > 0);
  }, [filteredTeams]);

  const teamsWithoutUploads = useMemo(() => {
    return filteredTeams.filter(t => !t.collegeIdUrls || t.collegeIdUrls.length === 0);
  }, [filteredTeams]);

  return (
    <SecondaryAuthGate pageTitle="College ID Cards">
      <div className="space-y-5 max-w-full mx-auto pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[#F0F0F0] tracking-tight">College ID Cards Verification</h2>
          <p className="text-xs text-[#808080] mt-0.5">
            Inspect uploaded participant institutional identification documents matched strictly by Team ID.
          </p>
        </div>

        <div className="flex gap-2 text-xs">
          <span className="rounded-xl border border-emerald-500/30 bg-emerald-950/40 px-3 py-1.5 text-emerald-300 font-medium shadow-[0_0_12px_rgba(16,185,129,0.15)] flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {teamsWithUploads.length} Teams with Uploads
          </span>
          <span className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-1.5 text-[#808080]">
            {teamsWithoutUploads.length} Pending / No Upload
          </span>
        </div>
      </div>

      {/* Full-Width Search Bar */}
      <div className="relative w-full">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#808080]" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by Team ID, Team Name, Lead Name, or College..."
          className="w-full pl-10 h-11 text-xs sm:text-sm rounded-xl bg-white/[0.035] border-white/10 hover:border-white/20 focus:border-emerald-500/50 focus:shadow-[0_0_15px_rgba(16,185,129,0.15)] transition-all"
        />
      </div>

      {/* List Ledger Table */}
      <div className="card-laminated overflow-hidden shadow-2xl">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.04] text-[#909090] font-bold uppercase tracking-wider text-xs">
                  <th className="py-4 px-4 w-12 text-center">#</th>
                  <th className="py-4 px-4 w-32">Team ID</th>
                  <th className="py-4 px-4 min-w-[200px]">Team &amp; Leader</th>
                  <th className="py-4 px-4 min-w-[200px]">College / Degree</th>
                  <th className="py-4 px-4 min-w-[180px]">ID Document</th>
                  <th className="py-4 px-4 text-center w-32">Attendance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-[#F0F0F0]">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-[#808080]">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-emerald-400" />
                      <span className="text-sm">Loading registration documents...</span>
                    </td>
                  </tr>
                ) : filteredTeams.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-[#808080] text-sm">
                      <FileText className="h-8 w-8 text-[#808080] mx-auto mb-2 opacity-50" />
                      No registration matches search query &quot;{search}&quot;.
                    </td>
                  </tr>
                ) : (
                  filteredTeams.map((team, idx) => {
                    const hasUpload = team.collegeIdUrls && team.collegeIdUrls.length > 0;
                    const primaryUrl = hasUpload ? team.collegeIdUrls![0] : null;
                    const fileId = primaryUrl ? extractDriveFileId(primaryUrl) : null;
                    const directDriveUrl = fileId
                      ? `https://drive.google.com/file/d/${fileId}/view`
                      : primaryUrl || '#';

                    return (
                      <tr key={team.teamId} className="hover:bg-white/[0.03] transition-colors group">
                        {/* Sl No */}
                        <td className="py-4 px-4 text-center font-mono text-xs text-[#707070]">
                          {idx + 1}
                        </td>

                        {/* Team ID */}
                        <td className="py-4 px-4">
                          <span className="font-mono text-sm font-bold text-white bg-white/[0.08] border border-white/15 px-3 py-1 rounded-lg shadow-sm">
                            {team.teamId}
                          </span>
                        </td>

                        {/* Team Name & Leader */}
                        <td className="py-4 px-4">
                          <div className="font-bold text-base text-white group-hover:text-emerald-400 transition-colors">
                            {team.teamName}
                          </div>
                          {team.leaderName && (
                            <div className="text-sm text-[#D4D4D4] font-medium mt-0.5 flex items-center gap-1.5">
                              <User className="h-3.5 w-3.5 text-[#808080] shrink-0" />
                              <span><strong className="text-white">{team.leaderName}</strong></span>
                            </div>
                          )}
                        </td>

                        {/* College & Degree */}
                        <td className="py-4 px-4">
                          <div className="text-sm font-semibold text-white flex items-center gap-1.5">
                            <School className="h-3.5 w-3.5 text-[#808080] shrink-0" />
                            <span>{team.college || 'Institution unlisted'}</span>
                          </div>
                          {team.degree && (
                            <div className="text-xs text-[#A0A0A0] font-medium mt-0.5 ml-5">
                              {team.degree}
                            </div>
                          )}
                        </td>

                        {/* College ID Document Action (Direct link to Drive, NO POPUP) */}
                        <td className="py-4 px-4">
                          {hasUpload ? (
                            <div className="flex items-center gap-2">
                              <a
                                href={directDriveUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-illuminated inline-flex items-center gap-2 h-8.5 px-3.5 text-xs font-semibold text-white rounded-lg shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:border-emerald-500/50 hover:shadow-[0_0_20px_rgba(16,185,129,0.35)] transition-all cursor-pointer"
                                title="Open ID card directly in Google Drive (no popup)"
                              >
                                <Eye className="h-3.5 w-3.5 text-emerald-400" />
                                <span>View Document</span>
                                <ExternalLink className="h-3 w-3 text-white/60 ml-0.5" />
                              </a>
                              {team.collegeIdUrls!.length > 1 && (
                                <span className="font-mono text-[11px] text-[#808080] bg-white/[0.05] border border-white/10 px-2 py-0.5 rounded">
                                  +{team.collegeIdUrls!.length - 1} more
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-[#707070] italic flex items-center gap-1.5">
                              <AlertCircle className="h-3.5 w-3.5 text-[#606060]" />
                              No upload
                            </span>
                          )}
                        </td>

                        {/* Attendance */}
                        <td className="py-4 px-4 text-center">
                          {team.isPresent ? (
                            <Badge variant="present" className="inline-flex items-center gap-1.5 text-xs py-1 px-2.5">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                              Present
                            </Badge>
                          ) : (
                            <Badge variant="absent" className="text-xs py-1 px-2.5">
                              Not Marked
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </div>
    </div>
    </SecondaryAuthGate>
  );
}
