'use client';
import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, FileText, ExternalLink, Download, AlertCircle,
  Eye, Hash, School, User, CheckCircle2, ShieldAlert
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { useTeams } from '@/contexts/TeamsContext';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/lib/firebase/auth-helpers';
import { trimTeamId, extractDriveFileId } from '@/lib/utils';

export default function IdCardsPage() {
  const router = useRouter();
  const { teams, loading } = useTeams();
  const { role } = useAuth();
  const [search, setSearch] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<{
    teamId: string;
    teamName: string;
    url: string;
    fileId: string | null;
  } | null>(null);

  // Access permissions
  const canViewIdCards = true;

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
    <div className="space-y-5 max-w-7xl mx-auto pb-12">
      <div>
        <h2 className="text-base font-semibold text-[#F0F0F0] tracking-tight">College ID Cards Verification</h2>
        <p className="text-xs text-[#808080] mt-0.5">
          Inspect uploaded participant institutional identification documents matched strictly by Team ID.
        </p>
      </div>

      {/* Search and Summary */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#808080]" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by Team ID or Team Name..."
            className="pl-9 h-10 text-xs rounded-xl bg-white/[0.035] border-white/10 hover:border-white/20 focus:border-emerald-500/50 focus:shadow-[0_0_15px_rgba(16,185,129,0.15)] transition-all"
          />
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

      {/* Grid of Teams with College ID uploads */}
      {loading ? (
        <div className="p-12 text-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500/30 border-t-emerald-400 mx-auto mb-2" />
          <p className="text-xs text-[#808080]">Loading registration documents...</p>
        </div>
      ) : filteredTeams.length === 0 ? (
        <div className="card-laminated p-8 text-center">
          <FileText className="h-8 w-8 text-[#808080] mx-auto mb-2" />
          <p className="text-sm font-semibold text-[#F0F0F0]">No teams found</p>
          <p className="text-xs text-[#808080] mt-1">No registration matches search query &quot;{search}&quot;.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTeams.map(team => {
            const hasUpload = team.collegeIdUrls && team.collegeIdUrls.length > 0;
            const primaryUrl = hasUpload ? team.collegeIdUrls![0] : null;
            const fileId = primaryUrl ? extractDriveFileId(primaryUrl) : null;

            return (
              <div
                key={team.teamId}
                className="card-laminated flex flex-col justify-between text-[#F0F0F0]"
              >
                <CardHeader className="p-4 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1 font-mono text-xs font-bold text-[#F0F0F0] bg-white/[0.08] border border-white/15 px-2.5 py-0.5 rounded-md shadow-inner">
                      <Hash className="h-3 w-3 text-[#808080]" />
                      {team.teamId}
                    </div>
                    {team.isPresent ? (
                      <Badge variant="present" className="text-[10px] flex items-center gap-1">
                        <CheckCircle2 className="h-2.5 w-2.5" /> Present
                      </Badge>
                    ) : (
                      <Badge variant="absent" className="text-[10px]">Not Present</Badge>
                    )}
                  </div>
                  <CardTitle className="text-sm mt-2.5 truncate font-semibold text-[#F0F0F0]">
                    {team.teamName}
                  </CardTitle>
                  <CardDescription className="text-xs flex items-center gap-1 truncate text-[#808080] mt-0.5">
                    <School className="h-3 w-3 shrink-0" />
                    {team.college || 'Institution unlisted'}
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-4 pt-0 space-y-3">
                  {team.leaderName && (
                    <div className="text-xs text-[#B5B5B5] flex items-center gap-1.5 bg-white/[0.025] border border-white/5 p-2 rounded-lg">
                      <User className="h-3.5 w-3.5 text-[#808080] shrink-0" />
                      <span className="truncate">Lead: <strong className="text-[#F0F0F0]">{team.leaderName}</strong></span>
                      {team.degree && <span className="text-[10px] text-[#808080] truncate">({team.degree})</span>}
                    </div>
                  )}

                  {hasUpload ? (
                    <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3 space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-[#F0F0F0] flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5 text-emerald-400" />
                          College ID Card
                        </span>
                        <span className="text-[10px] text-[#808080] font-mono bg-white/[0.05] px-1.5 py-0.5 rounded">
                          {team.collegeIdUrls!.length} file{team.collegeIdUrls!.length > 1 ? 's' : ''}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          size="sm"
                          variant="illuminated"
                          className="h-8 text-xs flex-1 text-[#F0F0F0] hover:border-emerald-500/40 hover:shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                          onClick={() =>
                            setSelectedDoc({
                              teamId: team.teamId,
                              teamName: team.teamName,
                              url: primaryUrl!,
                              fileId,
                            })
                          }
                        >
                          <Eye className="h-3 w-3 mr-1 text-emerald-400" />
                          View Document
                        </Button>

                        <a
                          href={fileId ? `https://drive.google.com/file/d/${fileId}/view` : primaryUrl!}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-illuminated inline-flex items-center justify-center h-8 w-8 rounded-lg text-[#B5B5B5] hover:text-[#F0F0F0] hover:border-white/25 transition-all"
                          title="Open original Drive file"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-3 flex items-center gap-2 text-xs text-[#808080]">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0 text-[#808080]" />
                      <span>No ID upload recorded for this team.</span>
                    </div>
                  )}
                </CardContent>
              </div>
            );
          })}
        </div>
      )}

      {/* ID Card Document Modal */}
      <Dialog open={Boolean(selectedDoc)} onOpenChange={open => !open && setSelectedDoc(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="font-mono text-xs bg-white/[0.08] border border-white/10 px-2 py-0.5 rounded text-[#F0F0F0]">
                {selectedDoc?.teamId}
              </span>
              <span className="truncate">{selectedDoc?.teamName} — College ID</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-[#808080]">
              Authentic identity document from Google Forms registration response
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-white/10 bg-[#080808] overflow-hidden flex items-center justify-center min-h-[300px] p-2">
            {selectedDoc?.fileId ? (
              <iframe
                src={`https://drive.google.com/file/d/${selectedDoc.fileId}/preview`}
                title={`ID Card for ${selectedDoc.teamId}`}
                className="w-full h-[400px] rounded border-0 bg-[#080808]"
                allow="autoplay"
              />
            ) : (
              <div className="p-8 text-center text-[#808080]">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs">Document link: {selectedDoc?.url}</p>
                <a
                  href={selectedDoc?.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-xs text-white underline underline-offset-4"
                >
                  <ExternalLink className="h-3 w-3" /> Open in Google Drive
                </a>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-[#808080] pt-2">
            <span className="font-mono truncate max-w-sm">
              Ref: {selectedDoc?.fileId || selectedDoc?.url}
            </span>
            <div className="flex gap-2">
              <a
                href={selectedDoc?.fileId ? `https://drive.google.com/file/d/${selectedDoc.fileId}/view` : selectedDoc?.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#F0F0F0] text-[#080808] hover:bg-white text-xs font-semibold"
              >
                <ExternalLink className="h-3 w-3" />
                Open in Google Drive
              </a>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
