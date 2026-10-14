'use client';
import { useState, useMemo, useRef, useEffect } from 'react';
import {
  CreditCard, Search, Download, Printer, ExternalLink,
  Copy, Check, FileCheck, AlertCircle, RefreshCw,
  Hash, School, User, Phone, Mail, CheckCircle2, XCircle,
  Eye, Image as ImageIcon, ArrowUpDown
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { useTeams } from '@/contexts/TeamsContext';
import { useAuth } from '@/contexts/AuthContext';
import { extractDriveFileId, formatRelative } from '@/lib/utils';
import { toast } from 'sonner';

type PaymentFilter = 'all' | 'utr_submitted' | 'utr_missing' | 'has_proof' | 'present';

export default function PaymentsPage() {
  const { teams, loading, lastSync, syncInProgress, syncNow } = useTeams();
  const { getIdToken } = useAuth();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<PaymentFilter>('all');
  const [copiedUtr, setCopiedUtr] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<{
    teamId: string;
    teamName: string;
    utr?: string;
    url: string;
  } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [printDate, setPrintDate] = useState('');

  useEffect(() => {
    setPrintDate(new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
  }, []);

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
        if (!matchesId && !matchesName && !matchesUtr && !matchesLead && !matchesPhone && !matchesCollege) {
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
        'Payment Status',
        'Attendance',
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
        t.paymentStatus || (t.paymentRef ? 'Submitted' : 'Pending'),
        t.isPresent ? 'Present (P)' : 'Absent',
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
      {/* PRINT-ONLY HEADER (Hidden on screen, visible during window.print()) */}
      <div className="hidden print:block mb-6 border-b-2 border-black pb-4 text-black">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold uppercase tracking-wider">LAKSHYA 2026 — Payment & UTR Verification Registry</h1>
            <p className="text-xs text-gray-600 mt-1">Official Event Ledger for Accounts & Counter Audit</p>
          </div>
          <div className="text-right text-xs text-gray-700">
            <p><strong>Generated:</strong> {printDate || 'Current'} IST</p>
            <p><strong>Total Teams:</strong> {filteredTeams.length}</p>
            <p><strong>UTR Verified:</strong> {stats.withUtr} ({stats.utrPct}%)</p>
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
                  Track transaction references, inspect payment screenshots, and export printable ledgers.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
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
          <Card className="border-white/10 bg-[#121212]/80 backdrop-blur-xl">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium text-[#808080] uppercase tracking-wider">Total Teams</p>
                  <p className="text-2xl font-bold text-[#F0F0F0] mt-1 font-mono">{stats.total}</p>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
                  <Hash className="h-4 w-4" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-[#121212]/80 backdrop-blur-xl">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium text-[#808080] uppercase tracking-wider">UTR Submitted</p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <p className="text-2xl font-bold text-emerald-400 font-mono">{stats.withUtr}</p>
                    <span className="text-xs text-[#808080]">({stats.utrPct}%)</span>
                  </div>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-[#121212]/80 backdrop-blur-xl">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium text-[#808080] uppercase tracking-wider">Screenshots</p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <p className="text-2xl font-bold text-purple-400 font-mono">{stats.withProof}</p>
                    <span className="text-xs text-[#808080]">({stats.proofPct}%)</span>
                  </div>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400">
                  <ImageIcon className="h-4 w-4" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-[#121212]/80 backdrop-blur-xl">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium text-[#808080] uppercase tracking-wider">Present at Desk</p>
                  <p className="text-2xl font-bold text-[#F0F0F0] mt-1 font-mono">{stats.present}</p>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <User className="h-4 w-4" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-xl border border-white/10 bg-[#101010]/90 backdrop-blur-xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#808080]" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by UTR number, Team ID, Team Name, Leader Name, or Phone..."
              className="pl-9 h-9 border-white/10 bg-white/5 text-xs text-[#F0F0F0] placeholder:text-[#606060] focus-visible:ring-emerald-500/50"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFilter('all')}
              className={`h-8 px-2.5 text-xs rounded-lg ${filter === 'all' ? 'bg-white/15 text-white font-medium' : 'text-[#808080] hover:text-white'}`}
            >
              All ({teams.length})
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFilter('utr_submitted')}
              className={`h-8 px-2.5 text-xs rounded-lg ${filter === 'utr_submitted' ? 'bg-emerald-500/20 text-emerald-400 font-medium' : 'text-[#808080] hover:text-white'}`}
            >
              Has UTR ({stats.withUtr})
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFilter('utr_missing')}
              className={`h-8 px-2.5 text-xs rounded-lg ${filter === 'utr_missing' ? 'bg-red-500/20 text-red-400 font-medium' : 'text-[#808080] hover:text-white'}`}
            >
              UTR Missing ({stats.total - stats.withUtr})
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFilter('has_proof')}
              className={`h-8 px-2.5 text-xs rounded-lg ${filter === 'has_proof' ? 'bg-purple-500/20 text-purple-400 font-medium' : 'text-[#808080] hover:text-white'}`}
            >
              Screenshots ({stats.withProof})
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFilter('present')}
              className={`h-8 px-2.5 text-xs rounded-lg ${filter === 'present' ? 'bg-blue-500/20 text-blue-400 font-medium' : 'text-[#808080] hover:text-white'}`}
            >
              Present ({stats.present})
            </Button>
          </div>
        </div>
      </div>

      {/* SCREEN TABLE / CARDS VIEW */}
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
          <div className="border border-white/10 rounded-2xl overflow-hidden bg-[#101010]/80 backdrop-blur-xl shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5 text-[#808080] font-medium">
                    <th className="py-3 px-3.5 w-12 text-center">#</th>
                    <th className="py-3 px-3.5 w-28">Team ID</th>
                    <th className="py-3 px-4 min-w-[180px]">Team & College</th>
                    <th className="py-3 px-4 min-w-[170px]">Team Lead</th>
                    <th className="py-3 px-4 min-w-[200px]">UTR / Transaction Ref</th>
                    <th className="py-3 px-4 min-w-[150px]">Payment Proof</th>
                    <th className="py-3 px-3.5 text-center w-28">Attendance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredTeams.map((team, idx) => {
                    const hasUtr = Boolean(team.paymentRef && team.paymentRef.trim().length > 0);
                    const hasProof = Boolean(team.paymentProofUrl && team.paymentProofUrl.trim().length > 0);

                    return (
                      <tr key={team.teamId} className="hover:bg-white/[0.03] transition-colors group">
                        {/* Sl No */}
                        <td className="py-3.5 px-3.5 text-center text-[#606060] font-mono">
                          {idx + 1}
                        </td>

                        {/* Team ID */}
                        <td className="py-3.5 px-3.5">
                          <span className="font-mono font-bold text-sm text-[#F0F0F0] bg-white/5 px-2 py-1 rounded-md border border-white/10">
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
                              <span className="font-mono font-semibold text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-md tracking-wider">
                                {team.paymentRef}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => copyToClipboard(team.paymentRef!, 'UTR')}
                                className="h-7 w-7 text-[#808080] hover:text-white hover:bg-white/10"
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
                            <span className="inline-flex items-center gap-1 text-[11px] text-red-400/80 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-md font-medium">
                              <AlertCircle className="h-3 w-3" />
                              Missing UTR
                            </span>
                          )}
                        </td>

                        {/* Payment Proof / Photo */}
                        <td className="py-3.5 px-4">
                          {hasProof ? (
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedPhoto({
                                  teamId: team.teamId,
                                  teamName: team.teamName,
                                  utr: team.paymentRef,
                                  url: team.paymentProofUrl!,
                                })}
                                className="h-7 px-2.5 text-[11px] border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 gap-1.5 rounded-md font-medium"
                              >
                                <Eye className="h-3 w-3" />
                                View Photo
                              </Button>

                              <a
                                href={team.paymentProofUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#808080] hover:text-white p-1"
                                title="Open in Google Drive"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            </div>
                          ) : (
                            <span className="text-[11px] text-[#606060] italic">
                              No screenshot
                            </span>
                          )}
                        </td>

                        {/* Attendance */}
                        <td className="py-3.5 px-3.5 text-center">
                          {team.isPresent ? (
                            <span className="inline-flex items-center gap-1 font-mono font-bold text-xs text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                              <CheckCircle2 className="h-3 w-3" />
                              P
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] text-[#707070] bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
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

      {/* PRINT-OPTIMIZED TABLE (Strictly styled for printer / PDF output) */}
      <div className="hidden print:block text-black">
        <table className="w-full text-left text-[11px] border-collapse border border-gray-400">
          <thead>
            <tr className="bg-gray-100 text-black font-bold border-b border-gray-400">
              <th className="py-2 px-2 border border-gray-400 text-center w-8">#</th>
              <th className="py-2 px-2 border border-gray-400 w-24">Team ID</th>
              <th className="py-2 px-2 border border-gray-400">Team Name</th>
              <th className="py-2 px-2 border border-gray-400">Leader Name</th>
              <th className="py-2 px-2 border border-gray-400">Phone</th>
              <th className="py-2 px-2 border border-gray-400">College</th>
              <th className="py-2 px-2 border border-gray-400 font-mono">UTR Number</th>
              <th className="py-2 px-2 border border-gray-400 text-center w-16">Attendance</th>
              <th className="py-2 px-2 border border-gray-400 text-center w-24">Sign / Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredTeams.map((team, idx) => (
              <tr key={team.teamId} className="border-b border-gray-300 page-break-inside-avoid">
                <td className="py-1.5 px-2 border border-gray-300 text-center font-mono">{idx + 1}</td>
                <td className="py-1.5 px-2 border border-gray-300 font-mono font-bold">{team.teamId}</td>
                <td className="py-1.5 px-2 border border-gray-300 font-semibold">{team.teamName}</td>
                <td className="py-1.5 px-2 border border-gray-300">{team.leaderName || '—'}</td>
                <td className="py-1.5 px-2 border border-gray-300 font-mono">{team.leaderPhone || '—'}</td>
                <td className="py-1.5 px-2 border border-gray-300">{team.college || '—'}</td>
                <td className="py-1.5 px-2 border border-gray-300 font-mono font-semibold">
                  {team.paymentRef || 'MISSING'}
                </td>
                <td className="py-1.5 px-2 border border-gray-300 text-center font-bold">
                  {team.isPresent ? 'P' : '—'}
                </td>
                <td className="py-1.5 px-2 border border-gray-300 text-center">
                  <span className="text-gray-400 text-[9px]">Verified [ &nbsp; ]</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Print Footer */}
        <div className="mt-8 pt-4 border-t border-gray-400 flex justify-between items-center text-xs text-gray-600">
          <div>
            <p><strong>Total Teams Listed:</strong> {filteredTeams.length}</p>
          </div>
          <div className="text-right">
            <p className="border-t border-black pt-1 w-48 text-center">Authorized Signatory</p>
          </div>
        </div>
      </div>

      {/* SCREENSHOT PREVIEW MODAL */}
      <Dialog open={Boolean(selectedPhoto)} onOpenChange={open => !open && setSelectedPhoto(null)}>
        <DialogContent className="max-w-3xl border-white/10 bg-[#121212] text-[#F0F0F0] p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white flex items-center justify-between">
              <span>Payment Screenshot — {selectedPhoto?.teamId}</span>
              {selectedPhoto?.utr && (
                <span className="text-xs font-mono font-normal bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded">
                  UTR: {selectedPhoto.utr}
                </span>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#808080]">
              {selectedPhoto?.teamName}
            </DialogDescription>
          </DialogHeader>

          {selectedPhoto && (
            <div className="space-y-4 mt-2">
              <div className="relative rounded-xl overflow-hidden border border-white/10 bg-black/60 max-h-[65vh] flex items-center justify-center p-2">
                {/* Check if drive link can be rendered through direct image or preview iframe */}
                {selectedPhoto.url.includes('drive.google.com') ? (
                  <iframe
                    src={selectedPhoto.url.replace('/view', '/preview').replace('/edit', '/preview')}
                    className="w-full h-[55vh] border-0 rounded-lg"
                    title={`Payment proof for ${selectedPhoto.teamId}`}
                    allow="autoplay"
                  />
                ) : (
                  <img
                    src={selectedPhoto.url}
                    alt={`Payment proof for ${selectedPhoto.teamId}`}
                    className="max-h-[55vh] w-auto object-contain rounded-lg"
                  />
                )}
              </div>

              <div className="flex items-center justify-between pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => selectedPhoto.utr && copyToClipboard(selectedPhoto.utr, 'UTR')}
                  disabled={!selectedPhoto.utr}
                  className="h-8 border-white/10 bg-white/5 hover:bg-white/10 text-xs text-[#F0F0F0] gap-1.5"
                >
                  <Copy className="h-3 w-3" />
                  <span>Copy UTR</span>
                </Button>

                <Button
                  asChild
                  size="sm"
                  className="h-8 bg-emerald-600 hover:bg-emerald-500 text-white text-xs gap-1.5"
                >
                  <a href={selectedPhoto.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3 w-3" />
                    <span>Open in Google Drive</span>
                  </a>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
