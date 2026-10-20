'use client';
import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Download, RefreshCw, Search, CheckCircle2,
  XCircle, Filter, FileSpreadsheet, Hash, Users, School,
  Phone, Mail, ShieldAlert, ExternalLink, Calendar,
  CreditCard, Shield, ChevronRight, X, MessageSquare
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTeams } from '@/contexts/TeamsContext';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/lib/firebase/auth-helpers';
import { cn } from '@/lib/utils';
import type { Team } from '@/types';
import { toast } from 'sonner';

export default function RegistrationDirectoryPage() {
  const router = useRouter();
  const { teams, loading, syncInProgress, syncNow } = useTeams();
  const { role, loading: authLoading } = useAuth();
  const [search, setSearch] = useState('');
  const [collegeFilter, setCollegeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [exporting, setExporting] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);

  // Access permissions based on user role
  const canViewDirectory = hasPermission(role, 'canViewDirectory');
  const canExport = hasPermission(role, 'canExport');

  useEffect(() => {
    if (!authLoading && role && !canViewDirectory) {
      toast.error('Access restricted to Administrators only');
      router.replace('/admin/check-in');
    }
  }, [authLoading, role, canViewDirectory, router]);

  if (!authLoading && role && !canViewDirectory) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-center">
        <ShieldAlert className="h-12 w-12 text-amber-400" />
        <h2 className="text-lg font-bold text-white">Access Restricted</h2>
        <p className="text-xs text-[#808080] max-w-md">
          Registration Directory is restricted to Administrators. Redirecting to Check-in Desk...
        </p>
      </div>
    );
  }

  const colleges = useMemo(() => {
    const set = new Set<string>();
    teams.forEach(t => {
      if (t.college && t.college.trim()) set.add(t.college.trim());
    });
    return Array.from(set).sort();
  }, [teams]);

  const filteredTeams = useMemo(() => {
    return teams.filter(t => {
      if (statusFilter === 'present' && !t.isPresent) return false;
      if (statusFilter === 'absent' && t.isPresent) return false;
      if (collegeFilter !== 'all' && t.college !== collegeFilter) return false;

      if (search.trim()) {
        const query = search.trim().toLowerCase();
        const mId = t.teamId.toLowerCase().includes(query);
        const mName = t.teamName.toLowerCase().includes(query);
        const mLead = (t.leaderName ?? '').toLowerCase().includes(query);
        const mCollege = (t.college ?? '').toLowerCase().includes(query);
        const mPhone = (t.leaderPhone ?? '').toLowerCase().includes(query);
        const mEmail = (t.leaderEmail ?? '').toLowerCase().includes(query);
        if (!mId && !mName && !mLead && !mCollege && !mPhone && !mEmail) return false;
      }
      return true;
    });
  }, [teams, statusFilter, collegeFilter, search]);

  const handleExportCSV = () => {
    if (!canExport) {
      toast.error('Permission denied to export data.');
      return;
    }
    try {
      setExporting(true);
      const headers = [
        'Team ID',
        'Team Name',
        'Team Lead',
        'College / Institution',
        'Degree',
        'Phone',
        'Email',
        'Members',
        'Attendance',
      ];

      const rows = filteredTeams.map(t => [
        `"${t.teamId}"`,
        `"${(t.teamName || '').replace(/"/g, '""')}"`,
        `"${(t.leaderName || '').replace(/"/g, '""')}"`,
        `"${(t.college || '').replace(/"/g, '""')}"`,
        `"${(t.degree || '').replace(/"/g, '""')}"`,
        `"${t.leaderPhone || ''}"`,
        `"${t.leaderEmail || ''}"`,
        `"${t.members ? t.members.join('; ') : ''}"`,
        `"${t.isPresent ? 'Present' : 'Not Marked'}"`,
      ]);

      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `hackadmin-registrations-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Registration Directory exported to CSV');
    } catch (err) {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[#F0F0F0] tracking-tight">Registration Directory</h2>
          <p className="text-xs text-[#808080] mt-0.5">
            Participant ledger ({teams.length} registrations) &bull; Click any team or press Enter to inspect full details
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncNow()}
            disabled={syncInProgress}
            className="h-8.5 text-xs text-[#F0F0F0] border-white/10 bg-white/[0.04] hover:bg-white/[0.08]"
          >
            <RefreshCw className={`h-3 w-3 mr-1.5 ${syncInProgress ? 'animate-spin text-emerald-400' : 'text-[#808080]'}`} />
            Sync Sheet
          </Button>

          {canExport && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={exporting || filteredTeams.length === 0}
              className="h-8.5 text-xs text-[#F0F0F0] border-white/10 bg-white/[0.04] hover:bg-white/[0.08]"
            >
              <Download className="h-3 w-3 mr-1.5 text-purple-400" />
              Export CSV
            </Button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#808080]" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by Team ID, team name, lead, college, phone, email..."
            className="pl-9 h-10 text-xs rounded-xl bg-white/[0.035] border-white/10 hover:border-white/20 focus:border-emerald-500/50 text-[#F0F0F0] placeholder:text-[#606060]"
          />
        </div>

        {colleges.length > 0 && (
          <div className="w-full sm:w-56">
            <Select value={collegeFilter} onValueChange={setCollegeFilter}>
              <SelectTrigger className="h-10 text-xs rounded-xl bg-white/[0.035] border-white/10 hover:border-white/20 focus:border-emerald-500/50 text-[#E0E0E0]">
                <SelectValue placeholder="All Colleges" />
              </SelectTrigger>
              <SelectContent className="bg-[#101010] border-white/15 backdrop-blur-2xl text-white">
                <SelectItem value="all">All Colleges ({teams.length})</SelectItem>
                {colleges.map(col => (
                  <SelectItem key={col} value={col}>
                    {col}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="w-full sm:w-44">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-10 text-xs rounded-xl bg-white/[0.035] border-white/10 hover:border-white/20 focus:border-emerald-500/50 text-[#E0E0E0]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent className="bg-[#101010] border-white/15 backdrop-blur-2xl text-white">
              <SelectItem value="all">All Attendance</SelectItem>
              <SelectItem value="present">Present Only</SelectItem>
              <SelectItem value="absent">Not Marked</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Directory Table / Navigation Cards */}
      <div className="card-laminated overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.04] text-[#909090] font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4 w-[12%]">Team ID</th>
                  <th className="py-3 px-4 w-[30%] min-w-[220px]">Team &amp; Lead Name</th>
                  <th className="py-3 px-4 w-[28%] min-w-[200px]">College / Degree</th>
                  <th className="py-3 px-4 w-[20%] min-w-[170px]">Contact Info</th>
                  <th className="py-3 px-4 w-[10%] text-center">Attendance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-[#F0F0F0]">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-16 text-center text-[#808080]">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-emerald-400" />
                      <span className="text-sm">Loading registrations from Google Sheets...</span>
                    </td>
                  </tr>
                ) : filteredTeams.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-16 text-center text-[#808080] text-sm">
                      No registrations match the selected search or filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredTeams.map(team => {
                    const memberCount = team.memberCount || ((team.members || []).filter(Boolean).length + 1) || 4;

                    return (
                      <tr
                        key={team.teamId}
                        tabIndex={0}
                        role="button"
                        onClick={() => setSelectedTeam(team)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedTeam(team);
                          }
                        }}
                        className="hover:bg-white/[0.06] focus:bg-white/[0.08] focus:outline-none focus:ring-1 focus:ring-emerald-500/50 cursor-pointer transition-all group"
                        title="Click or press Enter to view full team details"
                      >
                        {/* 1. Team ID (Strictly non-wrapping) */}
                        <td className="py-3 px-4 align-top">
                          <span className="font-mono text-xs font-bold text-white bg-white/[0.08] border border-white/15 px-2.5 py-1 rounded-lg shadow-sm whitespace-nowrap inline-block">
                            {team.teamId}
                          </span>
                        </td>

                        {/* 2. Team Name on top, Lead Name in next line, Team Count badge */}
                        <td className="py-3 px-4 align-top">
                          <div className="font-semibold text-sm text-white group-hover:text-emerald-400 transition-colors leading-tight">
                            {team.teamName || 'Unnamed Team'}
                          </div>
                          <div className="text-xs text-[#909090] mt-0.5 leading-tight">
                            {team.leaderName || 'Lead: Not specified'}
                          </div>
                          <div className="mt-1">
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-300/90 bg-emerald-950/40 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                              <Users className="h-2.5 w-2.5" />
                              {memberCount} Members
                            </span>
                          </div>
                        </td>

                        {/* 3. College on top, Degree in next line */}
                        <td className="py-3 px-4 align-top">
                          <div className="font-medium text-xs text-[#E0E0E0] leading-tight">
                            {team.college || 'College not specified'}
                          </div>
                          <div className="text-[11px] text-[#808080] mt-0.5 leading-tight">
                            {team.degree || 'Degree not specified'}
                          </div>
                        </td>

                        {/* 4. Contact Info: Top Number, Bottom Email directly under number */}
                        <td className="py-3 px-4 align-top">
                          {team.leaderPhone ? (
                            <div className="font-mono text-xs font-semibold text-[#E0E0E0] flex items-center gap-1">
                              <Phone className="h-3 w-3 text-emerald-400 shrink-0" />
                              <span className="whitespace-nowrap">{team.leaderPhone}</span>
                            </div>
                          ) : (
                            <div className="text-xs text-[#707070] italic">No phone</div>
                          )}
                          {team.leaderEmail ? (
                            <div className="text-[10px] text-[#808080] mt-0.5 truncate max-w-[200px]" title={team.leaderEmail}>
                              {team.leaderEmail}
                            </div>
                          ) : null}
                        </td>

                        {/* 5. Attendance Status */}
                        <td className="py-3 px-4 text-center align-middle">
                          {team.isPresent ? (
                            <Badge variant="present" className="inline-flex items-center gap-1 text-[11px] py-0.5 px-2">
                              <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                              Present
                            </Badge>
                          ) : (
                            <Badge variant="absent" className="text-[11px] py-0.5 px-2">
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

      {/* POPUP VIEW: Full Team Details Dialog */}
      <Dialog open={Boolean(selectedTeam)} onOpenChange={open => !open && setSelectedTeam(null)}>
        {selectedTeam && (
          <DialogContent className="max-w-2xl bg-[#101010] border border-white/15 text-white shadow-2xl rounded-2xl p-6 max-h-[88vh] overflow-y-auto">
            <DialogHeader className="border-b border-white/10 pb-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-white bg-emerald-500/20 border border-emerald-500/40 px-3 py-1 rounded-lg">
                    {selectedTeam.teamId}
                  </span>
                  <DialogTitle className="text-lg font-bold text-white">
                    {selectedTeam.teamName || 'Unnamed Team'}
                  </DialogTitle>
                </div>

                {selectedTeam.isPresent ? (
                  <Badge variant="present" className="inline-flex items-center gap-1.5 text-xs py-1 px-3">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    Present (P)
                  </Badge>
                ) : (
                  <Badge variant="absent" className="text-xs py-1 px-3">
                    Not Marked
                  </Badge>
                )}
              </div>
              <DialogDescription className="text-xs text-[#808080] mt-1">
                Full synchronized Google Sheets record for this registration.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-3 text-xs">
              {/* Leader & Contact Box */}
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5 space-y-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">Team Leader Details</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="text-[#808080] text-[11px]">Leader Name:</span>
                    <p className="font-semibold text-white text-sm">{selectedTeam.leaderName || '—'}</p>
                  </div>
                  <div>
                    <span className="text-[#808080] text-[11px]">Phone Number:</span>
                    <p className="font-mono font-medium text-white">
                      {selectedTeam.leaderPhone ? (
                        <a href={`tel:${selectedTeam.leaderPhone}`} className="hover:text-emerald-400 hover:underline">
                          {selectedTeam.leaderPhone}
                        </a>
                      ) : '—'}
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-[#808080] text-[11px]">Email ID:</span>
                    <p className="text-white">
                      {selectedTeam.leaderEmail ? (
                        <a href={`mailto:${selectedTeam.leaderEmail}`} className="hover:text-emerald-400 hover:underline">
                          {selectedTeam.leaderEmail}
                        </a>
                      ) : '—'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Institution Box */}
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5 space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">Institution & Program</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="text-[#808080] text-[11px]">College / Institution:</span>
                    <p className="font-semibold text-white">{selectedTeam.college || '—'}</p>
                  </div>
                  <div>
                    <span className="text-[#808080] text-[11px]">Degree / Program:</span>
                    <p className="text-white">{selectedTeam.degree || '—'}</p>
                  </div>
                </div>
              </div>

              {/* Members Box */}
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">Team Members</p>
                  <span className="text-[10px] font-mono text-[#808080]">
                    Total Size: {selectedTeam.memberCount || (selectedTeam.members?.length || 0) + 1}
                  </span>
                </div>
                {selectedTeam.members && selectedTeam.members.filter(Boolean).length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {selectedTeam.members.filter(Boolean).map((member, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.04] border border-white/5">
                        <span className="text-[10px] font-mono text-emerald-400 font-bold">M{idx + 2}</span>
                        <span className="text-white font-medium">{member}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-neutral-500 italic">No additional member names recorded.</p>
                )}
              </div>

              {/* Financial & Document Links */}
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5 space-y-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">Payment & Verification Documents</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="text-[#808080] text-[11px]">UTR / Payment Ref:</span>
                    <p className="font-mono font-bold text-white tracking-wider">
                      {selectedTeam.paymentRef || 'Not Submitted'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[#808080] text-[11px]">Payment Proof Screenshot:</span>
                    <p className="pt-0.5">
                      {selectedTeam.paymentProofUrl ? (
                        <a
                          href={selectedTeam.paymentProofUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-purple-300 hover:text-purple-200 underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          View Uploaded Proof
                        </a>
                      ) : (
                        <span className="text-[#707070] italic">None uploaded</span>
                      )}
                    </p>
                  </div>

                  {/* College ID Cards */}
                  <div className="sm:col-span-2 pt-1 border-t border-white/5">
                    <span className="text-[#808080] text-[11px]">College ID Cards:</span>
                    {selectedTeam.collegeIdUrls && selectedTeam.collegeIdUrls.length > 0 ? (
                      <div className="flex flex-wrap gap-2 mt-1">
                        {selectedTeam.collegeIdUrls.map((url, i) => (
                          <a
                            key={i}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] bg-white/[0.05] border border-white/10 hover:bg-white/10 text-[#D0D0D0]"
                          >
                            <ExternalLink className="h-3 w-3 text-emerald-400" />
                            ID Document #{i + 1}
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[#707070] italic mt-0.5">No college ID document uploaded</p>
                    )}
                  </div>
                </div>
              </div>

              {/* WhatsApp & Timestamp Footer */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-[#707070]">
                {selectedTeam.registeredAt && (
                  <span>Registered: {selectedTeam.registeredAt}</span>
                )}
                {selectedTeam.whatsappUrl && (
                  <a
                    href={selectedTeam.whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 underline font-medium"
                  >
                    <MessageSquare className="h-3 w-3" />
                    Open WhatsApp Confirmation Link
                  </a>
                )}
              </div>
            </div>

            <DialogFooter className="border-t border-white/10 pt-3 flex justify-between sm:justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedTeam(null)}
                className="border-white/10 text-white hover:bg-white/10"
              >
                Close (Esc)
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
