'use client';
import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  CreditCard, Search, Download, Printer, ExternalLink,
  Copy, Check, AlertCircle, RefreshCw,
  Hash, School, User, Phone, CheckCircle2,
  Clock, ShieldAlert
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTeams } from '@/contexts/TeamsContext';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/lib/firebase/auth-helpers';
import { toast } from 'sonner';

type PaymentFilter = 'all' | 'utr_submitted' | 'utr_missing' | 'has_proof' | 'present';

const SPREADSHEET_BASE_URL = 'https://docs.google.com/spreadsheets/d/11xu3PH0OzCCYMDq6LGrdiy7ANcluOHUYlBXJYWMXDQs/edit#gid=1086772870';

function formatPaymentTimestamp(dateStr?: string): string {
  if (!dateStr || !dateStr.trim()) return '—';
  try {
    let d = new Date(dateStr);
    if (isNaN(d.getTime())) {
      // Handle Google Forms dates like "17/10/2026 18:52:05" or "10/17/2026 18:52:05"
      const cleaned = dateStr.trim().replace(/,/g, '');
      const parts = cleaned.split(/\s+/);
      if (parts.length >= 2) {
        const dp = parts[0].split(/[-/]/);
        const tp = parts[1].split(':');
        if (dp.length === 3 && tp.length >= 2) {
          let day = parseInt(dp[0], 10);
          let month = parseInt(dp[1], 10) - 1;
          let year = parseInt(dp[2], 10);
          if (dp[0].length === 4) {
            year = parseInt(dp[0], 10);
            month = parseInt(dp[1], 10) - 1;
            day = parseInt(dp[2], 10);
          } else if (day > 12) {
            day = parseInt(dp[0], 10);
            month = parseInt(dp[1], 10) - 1;
            year = parseInt(dp[2], 10);
          }
          let hr = parseInt(tp[0], 10) || 0;
          const min = parseInt(tp[1], 10) || 0;
          const sec = parseInt(tp[2], 10) || 0;
          const meridian = parts[2]?.toUpperCase();
          if (meridian === 'PM' && hr < 12) hr += 12;
          if (meridian === 'AM' && hr === 12) hr = 0;
          d = new Date(year, month, day, hr, min, sec);
        }
      }
    }

    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();

      let hours = d.getHours();
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const seconds = String(d.getSeconds()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      const strHours = String(hours).padStart(2, '0');

      return `${day}/${month}/${year}, ${strHours}:${minutes}:${seconds} ${ampm}`;
    }
  } catch {
    // fallback
  }
  return dateStr;
}

function formatTiming(dateStr?: string): { time: string; date: string } {
  if (!dateStr || !dateStr.trim()) return { time: '—', date: '' };
  const formatted = formatPaymentTimestamp(dateStr);
  if (formatted && formatted.includes(', ')) {
    const [dPart, tPart] = formatted.split(', ');
    return { date: dPart, time: tPart };
  }
  return { time: dateStr, date: '' };
}

export default function PaymentsPage() {
  const router = useRouter();
  const { teams, loading, syncInProgress, syncNow } = useTeams();
  const { role, loading: authLoading, getIdToken } = useAuth();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<PaymentFilter>('all');
  const [copiedUtr, setCopiedUtr] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [printDate, setPrintDate] = useState('');
  const [printOrientation, setPrintOrientation] = useState<'portrait' | 'landscape'>('portrait');

  const canView = hasPermission(role, 'canViewPayments');

  useEffect(() => {
    if (!authLoading && role && !canView) {
      toast.error('Access restricted to Administrators only');
      router.replace('/admin/check-in');
    }
  }, [authLoading, role, canView, router]);

  useEffect(() => {
    setPrintDate(formatPaymentTimestamp(new Date().toISOString()));
  }, []);

  if (!authLoading && role && !canView) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-center">
        <ShieldAlert className="h-12 w-12 text-amber-400" />
        <h2 className="text-lg font-bold text-white">Access Restricted</h2>
        <p className="text-xs text-[#808080] max-w-md">
          Payments & UTR Verification is restricted to Administrators only. Redirecting to Check-in Desk...
        </p>
      </div>
    );
  }

  // Statistics
  const stats = useMemo(() => {
    const total = teams.length;
    const withUtr = teams.filter(t => t.paymentRef && t.paymentRef.trim().length > 0).length;
    const withProof = teams.filter(t => t.paymentProofUrl && t.paymentProofUrl.trim().length > 0).length;
    const present = teams.filter(t => t.isPresent).length;
    const utrPct = total > 0 ? Math.round((withUtr / total) * 100) : 0;
    const proofPct = total > 0 ? Math.round((withProof / total) * 100) : 0;

    return { total, withUtr, withProof, present, utrPct, proofPct };
  }, [teams]);

  // Filtered & Searched teams
  const filteredTeams = useMemo(() => {
    const q = search.trim().toLowerCase();

    return teams.filter(t => {
      // 1. Tab status filter
      if (filter === 'utr_submitted' && (!t.paymentRef || t.paymentRef.trim().length === 0)) return false;
      if (filter === 'utr_missing' && t.paymentRef && t.paymentRef.trim().length > 0) return false;
      if (filter === 'has_proof' && (!t.paymentProofUrl || t.paymentProofUrl.trim().length === 0)) return false;
      if (filter === 'present' && !t.isPresent) return false;

      // 2. Search query filter
      if (q) {
        const matchesId = t.teamId.toLowerCase().includes(q);
        const matchesName = t.teamName.toLowerCase().includes(q);
        const matchesUtr = (t.paymentRef || '').toLowerCase().includes(q);
        const matchesLead = (t.leaderName || '').toLowerCase().includes(q);
        const matchesPhone = (t.leaderPhone || '').toLowerCase().includes(q);
        const matchesCollege = (t.college || '').toLowerCase().includes(q);
        const matchesTimestamp = (t.registeredAt || '').toLowerCase().includes(q);
        if (!matchesId && !matchesName && !matchesUtr && !matchesLead && !matchesPhone && !matchesCollege && !matchesTimestamp) {
          return false;
        }
      }

      return true;
    });
  }, [teams, filter, search]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUtr(text);
    toast.success(`Copied ${label}: ${text}`);
    setTimeout(() => setCopiedUtr(null), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    try {
      setExporting(true);
      const headers = [
        'Sl No',
        'Team ID',
        'Team Name',
        'Leader Name',
        'Leader Phone',
        'Leader Email',
        'College',
        'UTR Number',
        'Payment Proof URL',
        'Payment Timestamp',
        'Payment Status',
      ];

      const rows = filteredTeams.map((t, idx) => [
        idx + 1,
        t.teamId,
        t.teamName,
        t.leaderName || '',
        t.leaderPhone || '',
        t.leaderEmail || '',
        t.college || '',
        t.paymentRef || 'N/A',
        t.paymentProofUrl || 'N/A',
        t.registeredAt || 'N/A',
        t.paymentStatus || (t.paymentRef ? 'Submitted' : 'Pending'),
      ]);

      const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `LAKSHYA_2026_Payments_UTR_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Payments CSV downloaded successfully');
    } catch (err) {
      toast.error('Failed to export CSV');
    } finally {
      setExporting(false);
    }
  };

  const handleSync = async () => {
    await syncNow();
  };

  return (
    <div className="space-y-6 w-full max-w-full pb-20">
      {/* PRINT-ONLY HEADER (Hidden on screen, strictly visible during window.print()) */}
      <div className="hidden print:block mb-4 border-b-2 border-black pb-3 text-black">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-bold uppercase tracking-wider text-black">
              LAKSHYA 2026 — PAYMENTS & UTR VERIFICATION
            </h1>
            <p className="text-xs text-neutral-600 mt-0.5">
              SJBIT, Bengaluru &bull; Department of Information Science & Engineering
            </p>
          </div>
          <div className="text-right text-xs text-neutral-700">
            <p className="font-semibold text-black">Printed: {printDate || 'Current'}</p>
            <p>Total Teams Listed: {filteredTeams.length}</p>
          </div>
        </div>
      </div>

      {/* SCREEN-ONLY TOOLBAR & HEADER */}
      <div className="print:hidden space-y-4">
        {/* Title & Top Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-[#F0F0F0]">Payments & UTR Verification</h1>
                <p className="text-xs text-[#808080]">
                  Track transaction references, open proof screenshots directly, and export printable ledgers.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* A4 Orientation Toggle */}
            <div className="flex items-center bg-[#141414] border border-white/10 rounded-lg p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setPrintOrientation('portrait')}
                className={cn(
                  'px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors',
                  printOrientation === 'portrait'
                    ? 'bg-emerald-600 text-white font-semibold'
                    : 'text-[#808080] hover:text-[#D0D0D0]'
                )}
                title="A4 Portrait: Fits 20 teams per page cleanly with ideal row height"
              >
                A4 Portrait (20/pg)
              </button>
              <button
                type="button"
                onClick={() => setPrintOrientation('landscape')}
                className={cn(
                  'px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors',
                  printOrientation === 'landscape'
                    ? 'bg-emerald-600 text-white font-semibold'
                    : 'text-[#808080] hover:text-[#D0D0D0]'
                )}
                title="A4 Landscape: Fits 14 teams per page with wide columns"
              >
                A4 Landscape (14/pg)
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={syncInProgress}
              className="h-9 border-white/10 bg-white/5 hover:bg-white/10 text-xs text-[#F0F0F0] gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncInProgress ? 'animate-spin' : ''}`} />
              <span>{syncInProgress ? 'Syncing...' : 'Sync Sheet'}</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={exporting || filteredTeams.length === 0}
              className="h-9 border-white/10 bg-white/5 hover:bg-white/10 text-xs text-[#F0F0F0] gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export CSV</span>
            </Button>

            <Button
              size="sm"
              onClick={handlePrint}
              disabled={filteredTeams.length === 0}
              className="h-9 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs gap-1.5 shadow-lg shadow-emerald-950/40"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print Sheet / PDF</span>
            </Button>
          </div>
        </div>

        {/* 4 Summary Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <Card className="card-laminated border border-white/10 border-t-white/20 bg-gradient-to-b from-white/[0.07] to-white/[0.02] shadow-xl hover:-translate-y-0.5 transition-all duration-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium text-[#808080] uppercase tracking-wider">Total Teams</p>
                  <p className="text-2xl font-bold text-[#F0F0F0] mt-1 font-mono">{stats.total}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                  <Hash className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-laminated border border-white/10 border-t-white/20 bg-gradient-to-b from-white/[0.07] to-white/[0.02] shadow-xl hover:-translate-y-0.5 transition-all duration-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium text-[#808080] uppercase tracking-wider">UTR Submitted</p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <p className="text-2xl font-bold text-emerald-400 font-mono">{stats.withUtr}</p>
                    <span className="text-xs text-[#808080]">({stats.utrPct}%)</span>
                  </div>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-[0_0_18px_rgba(16,185,129,0.25)]">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-laminated border border-white/10 border-t-white/20 bg-gradient-to-b from-white/[0.07] to-white/[0.02] shadow-xl hover:-translate-y-0.5 transition-all duration-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium text-[#808080] uppercase tracking-wider">Screenshots</p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <p className="text-2xl font-bold text-purple-400 font-mono">{stats.withProof}</p>
                    <span className="text-xs text-[#808080]">({stats.proofPct}%)</span>
                  </div>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 shadow-[0_0_18px_rgba(168,85,247,0.25)]">
                  <ExternalLink className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-laminated border border-white/10 border-t-white/20 bg-gradient-to-b from-white/[0.07] to-white/[0.02] shadow-xl hover:-translate-y-0.5 transition-all duration-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium text-[#808080] uppercase tracking-wider">Present at Desk</p>
                  <p className="text-2xl font-bold text-[#F0F0F0] mt-1 font-mono">{stats.present}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shadow-[0_0_18px_rgba(245,158,11,0.25)]">
                  <User className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Full-Width Search & Filter Bar */}
        <div className="flex flex-col gap-3.5 p-3.5 rounded-2xl border border-white/10 border-t-white/20 bg-gradient-to-b from-white/[0.06] to-white/[0.02] backdrop-blur-2xl shadow-xl">
          <div className="relative w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#707070]" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by UTR number, Team ID, Team Name, Leader Name, Phone, or Timing..."
              className="w-full pl-10 h-11 border-white/10 border-t-white/20 bg-white/[0.04] text-xs sm:text-sm text-[#F0F0F0] placeholder:text-[#656565] focus-visible:border-emerald-500/60 focus-visible:ring-2 focus-visible:ring-emerald-500/20 focus-visible:shadow-[0_0_20px_rgba(16,185,129,0.2)] rounded-xl transition-all"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 border-t border-white/5 pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFilter('all')}
              className={`h-7.5 px-3 text-xs rounded-lg font-medium transition-all ${filter === 'all' ? 'bg-gradient-to-b from-white/[0.16] to-white/[0.04] text-white font-semibold border border-white/20 border-t-white/35 shadow-sm' : 'text-[#808080] hover:text-white'}`}
            >
              All ({teams.length})
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFilter('utr_submitted')}
              className={`h-7.5 px-3 text-xs rounded-lg font-medium transition-all ${filter === 'utr_submitted' ? 'bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.25)]' : 'text-[#808080] hover:text-white'}`}
            >
              Has UTR ({stats.withUtr})
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFilter('utr_missing')}
              className={`h-7.5 px-3 text-xs rounded-lg font-medium transition-all ${filter === 'utr_missing' ? 'bg-red-500/20 text-red-300 font-semibold border border-red-500/40 shadow-[0_0_12px_rgba(239,68,68,0.25)]' : 'text-[#808080] hover:text-white'}`}
            >
              UTR Missing ({stats.total - stats.withUtr})
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFilter('has_proof')}
              className={`h-7.5 px-3 text-xs rounded-lg font-medium transition-all ${filter === 'has_proof' ? 'bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/40 shadow-[0_0_12px_rgba(168,85,247,0.25)]' : 'text-[#808080] hover:text-white'}`}
            >
              Screenshots ({stats.withProof})
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFilter('present')}
              className={`h-7.5 px-3 text-xs rounded-lg font-medium transition-all ${filter === 'present' ? 'bg-blue-500/20 text-blue-300 font-semibold border border-blue-500/40 shadow-[0_0_12px_rgba(59,130,246,0.25)]' : 'text-[#808080] hover:text-white'}`}
            >
              Present ({stats.present})
            </Button>
          </div>
        </div>
      </div>

      {/* SCREEN TABLE VIEW */}
      <div className="print:hidden space-y-3">
        {loading && teams.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <RefreshCw className="h-8 w-8 text-emerald-500 animate-spin mb-3" />
            <p className="text-sm font-medium text-[#F0F0F0]">Loading registration payments...</p>
          </div>
        ) : filteredTeams.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center border border-white/10 rounded-2xl bg-[#101010]/50">
            <AlertCircle className="h-8 w-8 text-amber-500 mb-2" />
            <p className="text-sm font-medium text-[#F0F0F0]">No teams match current filters</p>
            <p className="text-xs text-[#808080] mt-1">Try modifying your search or switching to "All".</p>
          </div>
        ) : (
          <div className="border border-white/10 border-t-white/20 rounded-2xl overflow-hidden bg-[#101010]/90 backdrop-blur-2xl shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] text-[#909090] text-[11px] font-semibold uppercase tracking-wider">
                    <th className="py-3 px-3.5 w-12 text-center">#</th>
                    <th className="py-3 px-3.5 w-28">Team ID</th>
                    <th className="py-3 px-4 min-w-[170px]">Team & College</th>
                    <th className="py-3 px-4 min-w-[160px]">Team Lead</th>
                    <th className="py-3 px-4 min-w-[180px]">UTR / Transaction Ref</th>
                    <th className="py-3 px-4 min-w-[180px]">Payment Timings</th>
                    <th className="py-3 px-4 min-w-[150px]">Payment Proof</th>
                    <th className="py-3 px-3.5 text-center w-24">Attendance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredTeams.map((team, idx) => {
                    const hasUtr = Boolean(team.paymentRef && team.paymentRef.trim().length > 0);
                    const hasProof = Boolean(team.paymentProofUrl && team.paymentProofUrl.trim().length > 0);
                    const timing = formatTiming(team.registeredAt);

                    return (
                      <tr key={team.teamId} className="hover:bg-white/[0.04] transition-colors group">
                        {/* Sl No */}
                        <td className="py-3.5 px-3.5 text-center text-[#606060] font-mono">
                          {idx + 1}
                        </td>

                        {/* Team ID */}
                        <td className="py-3.5 px-3.5">
                          <span className="font-mono font-bold text-sm text-white bg-gradient-to-b from-white/[0.14] to-white/[0.04] px-2.5 py-1 rounded-lg border border-white/15 border-t-white/30 shadow-sm">
                            {team.teamId}
                          </span>
                        </td>

                        {/* Team Name & College */}
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-[#F0F0F0] text-sm group-hover:text-emerald-400 transition-colors">
                            {team.teamName || 'Unnamed Team'}
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-[#808080] mt-0.5 truncate max-w-xs">
                            <School className="h-3 w-3 shrink-0 opacity-70" />
                            <span className="truncate">{team.college || 'College not specified'}</span>
                          </div>
                        </td>

                        {/* Team Lead Contact */}
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-[#E0E0E0]">
                            {team.leaderName || 'N/A'}
                          </div>
                          {team.leaderPhone && (
                            <div className="flex items-center gap-1 text-[11px] text-[#808080] mt-0.5 font-mono">
                              <Phone className="h-3 w-3 text-emerald-500/70" />
                              <a href={`tel:${team.leaderPhone}`} className="hover:text-emerald-400 hover:underline">
                                {team.leaderPhone}
                              </a>
                            </div>
                          )}
                          {team.leaderEmail && (
                            <div className="text-[10px] text-[#606060] truncate max-w-[160px]">
                              {team.leaderEmail}
                            </div>
                          )}
                        </td>

                        {/* UTR Number */}
                        <td className="py-3.5 px-4">
                          {hasUtr ? (
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-semibold text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 border-t-emerald-400/40 px-2.5 py-1 rounded-lg tracking-wider shadow-[0_0_12px_rgba(16,185,129,0.18)]">
                                {team.paymentRef}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => copyToClipboard(team.paymentRef!, 'UTR')}
                                className="h-7 w-7 text-[#808080] hover:text-white hover:bg-white/10 rounded-lg transition-all"
                                title="Copy UTR number"
                              >
                                {copiedUtr === team.paymentRef ? (
                                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] text-red-300 bg-red-500/15 border border-red-500/30 px-2.5 py-0.5 rounded-lg font-medium shadow-[0_0_10px_rgba(239,68,68,0.15)]">
                              <AlertCircle className="h-3 w-3 text-red-400" />
                              Missing UTR
                            </span>
                          )}
                        </td>

                        {/* Payment Timings */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5 text-xs text-[#E0E0E0] font-mono">
                              <Clock className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                              <span className="font-semibold">{timing.time}</span>
                            </div>
                            {timing.date && (
                              <span className="text-[10px] text-[#808080] ml-5">{timing.date}</span>
                            )}
                          </div>
                        </td>

                        {/* Payment Proof / Photo: Directly opens link everywhere with NO preview popups */}
                        <td className="py-3.5 px-4">
                          {hasProof ? (
                            <a
                              href={team.paymentProofUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 h-7.5 px-3 text-[11px] border border-purple-400/30 border-t-purple-300/50 bg-gradient-to-b from-purple-500/20 to-purple-600/10 hover:from-purple-500/30 hover:to-purple-600/20 text-purple-200 rounded-lg font-medium shadow-[0_0_15px_-3px_rgba(168,85,247,0.3)] hover:shadow-[0_0_20px_0_rgba(168,85,247,0.45)] transition-all active:scale-95"
                              title="Open payment proof screenshot in new tab (direct link, no popup)"
                            >
                              <ExternalLink className="h-3 w-3" />
                              <span>Open Proof</span>
                            </a>
                          ) : (
                            <span className="text-[11px] text-[#606060] italic">
                              No screenshot
                            </span>
                          )}
                        </td>

                        {/* Attendance */}
                        <td className="py-3.5 px-3.5 text-center">
                          {team.isPresent ? (
                            <span className="inline-flex items-center gap-1 font-mono font-bold text-xs text-emerald-300 bg-emerald-500/15 border border-emerald-500/40 border-t-emerald-400/50 px-2.5 py-1 rounded-lg shadow-[0_0_14px_rgba(16,185,129,0.2)]">
                              <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                              P
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] text-[#707070] bg-white/[0.03] border border-white/10 px-2.5 py-1 rounded-lg font-mono">
                              Absent
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Dynamic Print Styles specifically for A4 format */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 ${printOrientation};
            margin: 10mm 8mm 10mm 8mm;
          }
          html, body {
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-size: ${printOrientation === 'portrait' ? '11px' : '11.5px'} !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .h-screen, .overflow-hidden, .overflow-y-auto {
            height: auto !important;
            overflow: visible !important;
          }
          main {
            height: auto !important;
            overflow: visible !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          header, aside, nav, .print-hidden, [role="navigation"] {
            display: none !important;
          }
          .print-area {
            display: block !important;
            width: 100% !important;
          }
          table {
            width: 100% !important;
            border-collapse: collapse !important;
            page-break-inside: auto !important;
          }
          thead {
            display: table-header-group !important;
          }
          tr {
            page-break-inside: avoid !important;
            page-break-after: auto !important;
          }
          th, td {
            border: 1px solid #444444 !important;
            color: #000000 !important;
          }
          th {
            background-color: #f2f2f2 !important;
            font-weight: bold !important;
          }
        }
      `}</style>

      {/* PRINT-OPTIMIZED TABLE (Strictly styled for A4 printer / PDF output) */}
      <div className="hidden print:block text-black print-area">
        <table className="w-full text-left border-collapse border border-gray-500">
          <thead>
            <tr className="bg-gray-100 text-black font-bold border-b border-gray-500 text-xs">
              <th className="py-2 px-2 border border-gray-500 text-center w-[7%]">Verify</th>
              <th className="py-2 px-2 border border-gray-500 text-center w-[5%]">#</th>
              <th className="py-2 px-2 border border-gray-500 w-[13%]">Team ID</th>
              <th className="py-2 px-2.5 border border-gray-500 w-[24%]">Team & Lead Name</th>
              <th className="py-2 px-2.5 border border-gray-500 w-[16%]">Lead Phone</th>
              <th className="py-2 px-2.5 border border-gray-500 w-[18%] font-mono">UTR Number</th>
              <th className="py-2 px-2.5 border border-gray-500 w-[17%]">Registered At</th>
            </tr>
          </thead>
          <tbody>
            {filteredTeams.map((team, idx) => (
              <tr key={team.teamId} className="border-b border-gray-400 text-[11px]">
                {/* Independent check cube for pen tick off */}
                <td className="py-1.5 px-2 border border-gray-400 text-center align-middle">
                  <div className="w-4 h-4 border-2 border-black rounded-sm mx-auto" />
                </td>
                <td className="py-1.5 px-2 border border-gray-400 text-center font-mono align-middle">{idx + 1}</td>
                <td className="py-1.5 px-2 border border-gray-400 font-mono font-bold align-middle">{team.teamId}</td>
                <td className="py-1.5 px-2.5 border border-gray-400 align-middle">
                  <div className="font-semibold text-black leading-tight">{team.teamName || '—'}</div>
                  <div className="text-[10px] text-neutral-600 leading-tight">{team.leaderName || '—'}</div>
                </td>
                <td className="py-1.5 px-2.5 border border-gray-400 font-mono align-middle">{team.leaderPhone || '—'}</td>
                <td className="py-1.5 px-2.5 border border-gray-400 font-mono font-semibold align-middle break-all">
                  {team.paymentRef || 'MISSING'}
                </td>
                <td className="py-1.5 px-2.5 border border-gray-400 font-mono align-middle text-[10px] whitespace-nowrap">
                  {formatPaymentTimestamp(team.registeredAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Print Footer */}
        <div className="mt-6 pt-3 border-t border-gray-400 flex justify-between items-center text-xs text-neutral-600">
          <div>
            <p><strong>Total Teams Listed:</strong> {filteredTeams.length}</p>
          </div>
          <div className="text-right">
            <p className="border-t border-black pt-1 w-44 text-center">Authorized Signatory</p>
          </div>
        </div>
      </div>
    </div>
  );
}
