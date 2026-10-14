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
            variant="outline"
            size="sm"
            onClick={() => syncNow()}
            disabled={syncInProgress}
            className="h-8 text-xs border-white/10"
          >
            <RefreshCw className={`h-3 w-3 mr-1.5 ${syncInProgress ? 'animate-spin' : ''}`} />
            Sync Sheet
          </Button>

          {canExport && (
            <Button
              size="sm"
              onClick={handleExportCSV}
              disabled={exporting || filteredTeams.length === 0}
              className="h-8 text-xs"
            >
              <Download className="h-3 w-3 mr-1.5" />
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
            className="pl-9 h-9 text-xs"
          />
        </div>

        {colleges.length > 0 && (
          <div className="w-full sm:w-52">
            <Select value={collegeFilter} onValueChange={setCollegeFilter}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="All Colleges" />
              </SelectTrigger>
              <SelectContent>
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

        <div className="w-full sm:w-40">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Attendance</SelectItem>
              <SelectItem value="present">Present Only</SelectItem>
              <SelectItem value="absent">Not Marked</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Directory Table */}
      <Card className="border-white/10 bg-white/[0.045] backdrop-blur-xl overflow-hidden shadow-2xl">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03] text-[#808080] font-medium">
                  <th className="py-3 px-4">Team ID</th>
                  <th className="py-3 px-4">Team &amp; Leader</th>
                  <th className="py-3 px-4">College</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Payment UTR</th>
                  <th className="py-3 px-4 text-center">Attendance</th>
                  <th className="py-3 px-4 text-center">Row</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-[#F0F0F0]">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-[#808080]">
                      <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-[#808080]" />
                      Loading registrations from Google Sheets...
                    </td>
                  </tr>
                ) : filteredTeams.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-[#808080]">
                      No registrations match the selected search or filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredTeams.map(team => (
                    <tr key={team.teamId} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-[#F0F0F0]">
                        <span className="bg-white/[0.06] border border-white/10 px-2 py-0.5 rounded">
                          {team.teamId}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-[#F0F0F0]">{team.teamName}</div>
                        {team.leaderName && (
                          <div className="text-[11px] text-[#808080]">Lead: {team.leaderName}</div>
                        )}
                        {team.memberCount && (
                          <div className="text-[10px] text-[#808080]">{team.memberCount} members</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-[#B5B5B5]">
                        <div className="truncate max-w-[200px]">{team.college || 'Unlisted'}</div>
                        {team.degree && <div className="text-[10px] text-[#808080]">{team.degree}</div>}
                      </td>
                      <td className="py-3 px-4 text-[#808080] font-mono text-[11px]">
                        {team.leaderPhone && <div>{team.leaderPhone}</div>}
                        {team.leaderEmail && <div className="text-[10px] truncate max-w-[180px]">{team.leaderEmail}</div>}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-[#B5B5B5]">
                        {team.paymentRef || '—'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {team.isPresent ? (
                          <Badge variant="present" className="inline-flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                            Present (P)
                          </Badge>
                        ) : (
                          <Badge variant="absent">Not Marked</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-[#808080] text-[11px]">
                        {team.rowIndex ?? '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
