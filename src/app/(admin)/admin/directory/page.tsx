'use client';
import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Download, RefreshCw, Search, CheckCircle2,
  XCircle, Filter, FileSpreadsheet, Hash, Users, School, Phone, Mail, ShieldAlert
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { formatRelative } from '@/lib/utils';
import { toast } from 'sonner';

export default function RegistrationDirectoryPage() {
  const router = useRouter();
  const { teams, loading, lastSync, syncInProgress, syncNow } = useTeams();
  const { role } = useAuth();
  const [search, setSearch] = useState('');
  const [collegeFilter, setCollegeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [exporting, setExporting] = useState(false);

  // Access permissions
  const canViewDirectory = true;
  const canExport = true;

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
        'Payment Ref',
        'Attendance',
        'Row',
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
        `"${t.paymentRef || ''}"`,
        `"${t.isPresent ? 'Present' : 'Not Marked'}"`,
        t.rowIndex || '',
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
            Synchronized entries from live Google Sheet ({teams.length} total registrations)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="illuminated"
            size="sm"
            onClick={() => syncNow()}
            disabled={syncInProgress}
            className="h-8.5 text-xs text-[#F0F0F0] hover:border-emerald-500/40 hover:shadow-[0_0_15px_rgba(16,185,129,0.2)]"
          >
            <RefreshCw className={`h-3 w-3 mr-1.5 ${syncInProgress ? 'animate-spin text-emerald-400' : 'text-[#808080]'}`} />
            Sync Sheet
          </Button>

          {canExport && (
            <Button
              variant="illuminated"
              size="sm"
              onClick={handleExportCSV}
              disabled={exporting || filteredTeams.length === 0}
              className="h-8.5 text-xs text-[#F0F0F0] hover:border-purple-500/40 hover:shadow-[0_0_15px_rgba(168,85,247,0.2)]"
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
            className="pl-9 h-10 text-xs rounded-xl bg-white/[0.035] border-white/10 hover:border-white/20 focus:border-emerald-500/50 focus:shadow-[0_0_15px_rgba(16,185,129,0.15)] transition-all"
          />
        </div>

        {colleges.length > 0 && (
          <div className="w-full sm:w-56">
            <Select value={collegeFilter} onValueChange={setCollegeFilter}>
              <SelectTrigger className="h-10 text-xs rounded-xl bg-white/[0.035] border-white/10 hover:border-white/20 focus:border-emerald-500/50">
                <SelectValue placeholder="All Colleges" />
              </SelectTrigger>
              <SelectContent className="bg-[#101010] border-white/15 backdrop-blur-2xl">
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
            <SelectTrigger className="h-10 text-xs rounded-xl bg-white/[0.035] border-white/10 hover:border-white/20 focus:border-emerald-500/50">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent className="bg-[#101010] border-white/15 backdrop-blur-2xl">
              <SelectItem value="all">All Attendance</SelectItem>
              <SelectItem value="present">Present Only</SelectItem>
              <SelectItem value="absent">Not Marked</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Directory Table */}
      <div className="card-laminated overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.04] text-[#909090] font-bold uppercase tracking-wider text-xs">
                  <th className="py-4 px-4">Team ID</th>
                  <th className="py-4 px-4 min-w-[200px]">Team &amp; Leader</th>
                  <th className="py-4 px-4 min-w-[200px]">College / Degree</th>
                  <th className="py-4 px-4 min-w-[180px]">Contact Info</th>
                  <th className="py-4 px-4 min-w-[160px]">Payment UTR</th>
                  <th className="py-4 px-4 text-center">Attendance</th>
                  <th className="py-4 px-4 text-center">Row</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-[#F0F0F0]">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-[#808080]">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-emerald-400" />
                      <span className="text-sm">Loading registrations from Google Sheets...</span>
                    </td>
                  </tr>
                ) : filteredTeams.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-[#808080] text-sm">
                      No registrations match the selected search or filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredTeams.map(team => (
                    <tr key={team.teamId} className="hover:bg-white/[0.03] transition-colors group">
                      <td className="py-4 px-4">
                        <span className="font-mono text-sm font-bold text-white bg-white/[0.08] border border-white/15 px-3 py-1 rounded-lg shadow-sm">
                          {team.teamId}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="font-bold text-base text-white group-hover:text-emerald-400 transition-colors">
                          {team.teamName}
                        </div>
                        {team.leaderName && (
                          <div className="text-sm text-[#D4D4D4] font-medium mt-0.5">
                            <span className="text-[#808080]">Lead:</span> {team.leaderName}
                          </div>
                        )}
                        {team.memberCount && (
                          <div className="mt-1">
                            <span className="text-xs font-medium text-emerald-300 bg-emerald-950/50 border border-emerald-500/30 px-2 py-0.5 rounded-md inline-flex items-center gap-1 font-mono">
                              <Users className="h-3 w-3" />
                              {team.memberCount} members
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <div className="text-sm font-semibold text-white">
                          {team.college || 'Unlisted'}
                        </div>
                        {team.degree && (
                          <div className="text-xs text-[#A0A0A0] font-medium mt-0.5">
                            {team.degree}
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        {team.leaderPhone && (
                          <div className="font-mono text-sm font-bold text-white flex items-center gap-1.5">
                            <Phone className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                            {team.leaderPhone}
                          </div>
                        )}
                        {team.leaderEmail && (
                          <div className="text-xs text-[#A0A0A0] mt-1 truncate max-w-[220px] flex items-center gap-1.5">
                            <Mail className="h-3 w-3 text-[#707070] shrink-0" />
                            {team.leaderEmail}
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        {team.paymentRef ? (
                          <span className="font-mono text-xs sm:text-sm font-semibold text-emerald-300 bg-emerald-950/40 border border-emerald-500/30 px-2.5 py-1 rounded-lg inline-block">
                            {team.paymentRef}
                          </span>
                        ) : (
                          <span className="text-xs text-[#707070] italic">None</span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-center">
                        {team.isPresent ? (
                          <Badge variant="present" className="inline-flex items-center gap-1.5 text-xs py-1 px-2.5">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                            Present (P)
                          </Badge>
                        ) : (
                          <Badge variant="absent" className="text-xs py-1 px-2.5">
                            Not Marked
                          </Badge>
                        )}
                      </td>
                      <td className="py-4 px-4 text-center font-mono font-bold text-xs text-[#A0A0A0]">
                        {team.rowIndex ?? '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </div>
    </div>
  );
}
