'use client';
import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Printer, Search, CheckSquare, Square, RotateCcw,
  SlidersHorizontal, CheckCircle2, Clock, Users,
  FileSpreadsheet, ShieldAlert, ChevronDown, ChevronUp,
  LayoutTemplate, ArrowUpDown
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTeams } from '@/contexts/TeamsContext';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/lib/firebase/auth-helpers';
import { cn } from '@/lib/utils';
import type { Team } from '@/types';
import { SecondaryAuthGate } from '@/components/auth/SecondaryAuthGate';

export interface ColumnDefinition {
  id: string;
  label: string;
  shortLabel: string;
  sheetCol: string;
  isMandatory?: boolean;
  align?: 'left' | 'center' | 'right';
  render: (team: Team, index: number) => React.ReactNode;
  exportValue: (team: Team, index: number) => string;
}

function formatPrintTimestamp(dateStr?: string): string {
  if (!dateStr || !dateStr.trim()) return '—';
  try {
    let d = new Date(dateStr);
    if (isNaN(d.getTime())) {
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
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      return `${day}/${month}/${year} ${hours}:${minutes} ${ampm}`;
    }
  } catch {
    // fallback
  }
  return dateStr;
}

export const ALL_PRINT_COLUMNS: ColumnDefinition[] = [
  {
    id: 'sno',
    label: 'Serial Number',
    shortLabel: 'S.No',
    sheetCol: 'Auto',
    isMandatory: true,
    align: 'center',
    render: (_, index) => <span className="font-mono text-center font-medium">{index + 1}</span>,
    exportValue: (_, index) => String(index + 1),
  },
  {
    id: 'teamId',
    label: 'Team ID',
    shortLabel: 'Team ID',
    sheetCol: 'Col O',
    align: 'center',
    render: (team) => <span className="font-mono font-bold whitespace-nowrap">{team.teamId || '—'}</span>,
    exportValue: (team) => team.teamId || '',
  },
  {
    id: 'teamName',
    label: 'Team Name',
    shortLabel: 'Team Name',
    sheetCol: 'Col B',
    align: 'left',
    render: (team) => <span className="font-semibold">{team.teamName || '—'}</span>,
    exportValue: (team) => team.teamName || '',
  },
  {
    id: 'leaderName',
    label: 'Team Lead Name',
    shortLabel: 'Lead Name',
    sheetCol: 'Col C',
    align: 'left',
    render: (team) => <span>{team.leaderName || '—'}</span>,
    exportValue: (team) => team.leaderName || '',
  },
  {
    id: 'leaderPhone',
    label: 'Team Lead Phone',
    shortLabel: 'Lead Phone',
    sheetCol: 'Col H',
    align: 'left',
    render: (team) => <span className="font-mono whitespace-nowrap">{team.leaderPhone || '—'}</span>,
    exportValue: (team) => team.leaderPhone || '',
  },
  {
    id: 'leaderEmail',
    label: 'Lead Email ID',
    shortLabel: 'Email ID',
    sheetCol: 'Col G',
    align: 'left',
    render: (team) => <span className="break-all">{team.leaderEmail || '—'}</span>,
    exportValue: (team) => team.leaderEmail || '',
  },
  {
    id: 'college',
    label: 'College / Institution',
    shortLabel: 'College',
    sheetCol: 'Col D',
    align: 'left',
    render: (team) => <span>{team.college || '—'}</span>,
    exportValue: (team) => team.college || '',
  },
  {
    id: 'degree',
    label: 'Degree / Program',
    shortLabel: 'Degree',
    sheetCol: 'Col E',
    align: 'left',
    render: (team) => <span>{team.degree || '—'}</span>,
    exportValue: (team) => team.degree || '',
  },
  {
    id: 'memberCount',
    label: 'Team Size',
    shortLabel: 'Size',
    sheetCol: 'Col I',
    align: 'center',
    render: (team) => <span className="font-mono">{team.memberCount ?? '—'}</span>,
    exportValue: (team) => String(team.memberCount ?? ''),
  },
  {
    id: 'members',
    label: 'Other Members (2, 3, 4)',
    shortLabel: 'Members',
    sheetCol: 'Cols J-L',
    align: 'left',
    render: (team) => {
      const list = (team.members || []).filter(Boolean);
      return <span>{list.length > 0 ? list.join(', ') : '—'}</span>;
    },
    exportValue: (team) => (team.members || []).filter(Boolean).join(', '),
  },
  {
    id: 'paymentRef',
    label: 'UTR / Payment Ref',
    shortLabel: 'UTR Number',
    sheetCol: 'Col M',
    align: 'left',
    render: (team) => <span className="font-mono font-medium whitespace-nowrap">{team.paymentRef || '—'}</span>,
    exportValue: (team) => team.paymentRef || '',
  },
  {
    id: 'paymentProof',
    label: 'Payment Screenshot',
    shortLabel: 'Payment Proof',
    sheetCol: 'Col N',
    align: 'center',
    render: (team) => (
      <span className={cn('text-xs font-semibold', team.paymentProofUrl ? 'text-green-700' : 'text-neutral-400')}>
        {team.paymentProofUrl ? 'Verified Proof' : 'No Proof'}
      </span>
    ),
    exportValue: (team) => (team.paymentProofUrl ? 'YES' : 'NO'),
  },
  {
    id: 'attendance',
    label: 'Attendance Status',
    shortLabel: 'Attendance',
    sheetCol: 'Col P',
    align: 'center',
    render: (team) => (
      <span className={cn('font-bold', team.isPresent ? 'text-green-700' : 'text-neutral-500')}>
        {team.isPresent ? 'PRESENT (P)' : 'ABSENT'}
      </span>
    ),
    exportValue: (team) => (team.isPresent ? 'PRESENT' : 'ABSENT'),
  },
  {
    id: 'emailStatus',
    label: 'Email Status',
    shortLabel: 'Email Status',
    sheetCol: 'Col Q',
    align: 'center',
    render: (team) => <span>{team.emailStatus || '—'}</span>,
    exportValue: (team) => team.emailStatus || '',
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp Status',
    shortLabel: 'WhatsApp',
    sheetCol: 'Col R',
    align: 'center',
    render: (team) => <span>{team.whatsappUrl ? 'Generated' : '—'}</span>,
    exportValue: (team) => (team.whatsappUrl ? 'YES' : 'NO'),
  },
  {
    id: 'registeredAt',
    label: 'Registration Time',
    shortLabel: 'Timestamp',
    sheetCol: 'Col A',
    align: 'left',
    render: (team) => <span className="whitespace-nowrap">{formatPrintTimestamp(team.registeredAt)}</span>,
    exportValue: (team) => formatPrintTimestamp(team.registeredAt),
  },
  {
    id: 'signatureBox',
    label: 'Desk Verification / Signature Box',
    shortLabel: 'Signature / Remarks',
    sheetCol: 'Manual Desk',
    align: 'center',
    render: () => (
      <div className="h-8 min-w-[70px]" />
    ),
    exportValue: () => '',
  },
];

export const PRESETS: Record<string, { label: string; desc: string; columns: string[] }> = {
  attendance: {
    label: '📋 Attendance Sign-in Sheet',
    desc: 'Desk check-in list with Lead contact, Team Members, and physical signature box',
    columns: ['sno', 'teamId', 'teamName', 'leaderName', 'leaderPhone', 'members', 'signatureBox'],
  },
  foodKit: {
    label: '🍱 Kit & Food Token Desk',
    desc: 'Distribution counter sheet with Team Size, Attendance status, and Verification check',
    columns: ['sno', 'teamId', 'teamName', 'memberCount', 'attendance', 'signatureBox'],
  },
  accounts: {
    label: '💳 Accounts & UTR Audit',
    desc: 'Payment verification roster with Lead Name, Phone, and UTR Number',
    columns: ['sno', 'teamId', 'teamName', 'leaderName', 'leaderPhone', 'paymentRef', 'paymentProof', 'attendance'],
  },
  college: {
    label: '🏛️ College & Degree Directory',
    desc: 'Institutional breakdown with Degree, College Name, and Team Lead details',
    columns: ['sno', 'teamId', 'teamName', 'leaderName', 'leaderPhone', 'college', 'degree'],
  },
  master: {
    label: '🌐 Full Master Roster (All Columns)',
    desc: 'Complete export of all Google Sheet columns for full recordkeeping',
    columns: ALL_PRINT_COLUMNS.map(c => c.id),
  },
};

export default function PrintPage() {
  const router = useRouter();
  const { teams, loading: teamsLoading } = useTeams();
  const { role, loading: authLoading } = useAuth();

  const canPrint = hasPermission(role, 'canPrint');

  // Permission Guard
  useEffect(() => {
    if (!authLoading && role && !canPrint) {
      router.replace('/admin/check-in');
    }
  }, [authLoading, role, canPrint, router]);

  // Selected Columns state (Default: Attendance Preset)
  const [selectedColumnIds, setSelectedColumnIds] = useState<string[]>([
    'sno',
    'teamId',
    'teamName',
    'leaderName',
    'leaderPhone',
    'members',
    'signatureBox',
  ]);

  // Orientation setting: 'auto' | 'portrait' | 'landscape'
  const [orientationMode, setOrientationMode] = useState<'auto' | 'portrait' | 'landscape'>('auto');

  // Filters & Sorting
  const [searchTerm, setSearchTerm] = useState('');
  const [attendanceFilter, setAttendanceFilter] = useState<'all' | 'present' | 'absent'>('all');
  const [collegeFilter, setCollegeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'teamId' | 'teamName' | 'registeredAt' | 'college'>('teamId');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [isColumnPanelOpen, setIsColumnPanelOpen] = useState(true);

  // Document Header Title & Subtitle (Manually Editable)
  const [documentTitle, setDocumentTitle] = useState('LAKSHYA 2026 — Official Registration & Desk Ledger');
  const [documentSubtitle, setDocumentSubtitle] = useState('SJBIT, Bengaluru • Department of Information Science & Engineering');

  // Live print date and time
  const [printDate, setPrintDate] = useState<string>('');
  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      setPrintDate(
        new Intl.DateTimeFormat('en-IN', {
          timeZone: 'Asia/Kolkata',
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        }).format(now)
      );
    };
    updateDateTime();
    const interval = setInterval(updateDateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Compute Effective Orientation
  const effectiveOrientation = useMemo<'portrait' | 'landscape'>(() => {
    if (orientationMode === 'portrait') return 'portrait';
    if (orientationMode === 'landscape') return 'landscape';
    // Auto mode: <= 5 columns -> portrait, > 5 columns -> landscape
    return selectedColumnIds.length <= 5 ? 'portrait' : 'landscape';
  }, [orientationMode, selectedColumnIds.length]);

  // Unique colleges for filter dropdown
  const collegesList = useMemo(() => {
    const set = new Set<string>();
    teams.forEach(t => {
      if (t.college && t.college.trim()) set.add(t.college.trim());
    });
    return Array.from(set).sort();
  }, [teams]);

  // Filtered & Sorted Teams
  const processedTeams = useMemo(() => {
    let result = [...teams];

    // Attendance Filter
    if (attendanceFilter === 'present') {
      result = result.filter(t => t.isPresent);
    } else if (attendanceFilter === 'absent') {
      result = result.filter(t => !t.isPresent);
    }

    // College Filter
    if (collegeFilter !== 'all') {
      result = result.filter(t => t.college?.trim() === collegeFilter);
    }

    // Search Filter
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter(t =>
        t.teamId.toLowerCase().includes(q) ||
        (t.teamName && t.teamName.toLowerCase().includes(q)) ||
        (t.leaderName && t.leaderName.toLowerCase().includes(q)) ||
        (t.leaderPhone && t.leaderPhone.toLowerCase().includes(q)) ||
        (t.college && t.college.toLowerCase().includes(q)) ||
        (t.paymentRef && t.paymentRef.toLowerCase().includes(q))
      );
    }

    // Sorting
    result.sort((a, b) => {
      let valA = '';
      let valB = '';

      if (sortBy === 'teamId') {
        // Natural numeric sort for IDs like LAK-001 vs LAK-024
        const numA = parseInt(a.teamId.replace(/\D/g, '') || '0', 10);
        const numB = parseInt(b.teamId.replace(/\D/g, '') || '0', 10);
        if (numA !== numB) {
          return sortDirection === 'asc' ? numA - numB : numB - numA;
        }
        valA = a.teamId;
        valB = b.teamId;
      } else if (sortBy === 'teamName') {
        valA = a.teamName || '';
        valB = b.teamName || '';
      } else if (sortBy === 'college') {
        valA = a.college || '';
        valB = b.college || '';
      } else if (sortBy === 'registeredAt') {
        valA = a.registeredAt || '';
        valB = b.registeredAt || '';
      }

      const cmp = valA.localeCompare(valB, undefined, { sensitivity: 'base' });
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [teams, attendanceFilter, collegeFilter, searchTerm, sortBy, sortDirection]);

  // Toggle single column
  const toggleColumn = (colId: string) => {
    if (colId === 'sno') return; // Serial number is mandatory
    setSelectedColumnIds(prev =>
      prev.includes(colId) ? prev.filter(id => id !== colId) : [...prev, colId]
    );
  };

  // Apply preset
  const applyPreset = (presetKey: string) => {
    const preset = PRESETS[presetKey];
    if (preset) {
      setSelectedColumnIds(preset.columns);
    }
  };

  // Select / Deselect All
  const selectAllColumns = () => {
    setSelectedColumnIds(ALL_PRINT_COLUMNS.map(c => c.id));
  };
  const deselectAllColumns = () => {
    setSelectedColumnIds(['sno', 'teamId', 'teamName']);
  };

  // Active columns in order
  const activeColumns = useMemo(() => {
    return ALL_PRINT_COLUMNS.filter(col => selectedColumnIds.includes(col.id));
  }, [selectedColumnIds]);

  // Dynamic Font & Cell Padding sizing based on column count
  const tableFontSizeClass = useMemo(() => {
    const count = activeColumns.length;
    if (count <= 4) return 'text-xs md:text-sm';
    if (count <= 7) return 'text-[11px] md:text-xs';
    if (count <= 10) return 'text-[10px] md:text-[11px]';
    return 'text-[9px] md:text-[10px]';
  }, [activeColumns.length]);

  const cellPaddingClass = useMemo(() => {
    const count = activeColumns.length;
    if (count <= 4) return 'py-2 px-3';
    if (count <= 7) return 'py-1.5 px-2';
    return 'py-1 px-1.5';
  }, [activeColumns.length]);

  if (authLoading || (!canPrint && role)) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          <p className="text-xs text-[#808080]">Verifying permissions...</p>
        </div>
      </div>
    );
  }

  return (
    <SecondaryAuthGate pageTitle="Print Desk & Ledger">
      <div className="space-y-6 pb-20">
      {/* Dynamic Print CSS Setup */}
      <style jsx global>{`
        @media print {
          @page {
            size: ${effectiveOrientation};
            margin: 8mm 6mm 8mm 6mm;
          }
          body {
            background: #ffffff !important;
            color: #000000 !important;
            font-size: 11px !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          nav, aside, header, footer, .print-hidden, .app-sidebar, [role="navigation"] {
            display: none !important;
          }
          main {
            overflow: visible !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .print-area {
            display: block !important;
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
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
            border: 1px solid #333333 !important;
            color: #000000 !important;
          }
          th {
            background-color: #f1f1f1 !important;
            font-weight: bold !important;
          }
        }
      `}</style>

      {/* Screen-Only Header & Actions */}
      <div className="print:hidden space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.06] text-[#F0F0F0]">
                <Printer className="h-4 w-4" />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-[#F0F0F0]">Print Desk & Ledger</h1>
            </div>
            <p className="text-xs text-[#808080] mt-1">
              Select any spreadsheet columns, customize filters, and automatically format high-density printable reports.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => window.print()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm gap-2"
            >
              <Printer className="h-4 w-4" />
              <span>Print Ledger (Ctrl+P)</span>
            </Button>
          </div>
        </div>

        {/* Presets Bar */}
        <Card className="border-white/10 bg-[#141414]">
          <CardContent className="p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <LayoutTemplate className="h-4 w-4 text-emerald-400" />
                <span className="text-xs font-semibold text-[#F0F0F0]">Quick Presets:</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {Object.entries(PRESETS).map(([key, p]) => (
                  <Button
                    key={key}
                    variant="ghost"
                    size="sm"
                    onClick={() => applyPreset(key)}
                    className="h-7 text-xs px-2.5 bg-white/[0.04] hover:bg-white/[0.1] text-[#D0D0D0] border border-white/10"
                    title={p.desc}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Column Selector Accordion */}
        <Card className="border-white/10 bg-[#141414]">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsColumnPanelOpen(!isColumnPanelOpen)}
                className="flex items-center gap-2 text-xs font-semibold text-[#F0F0F0] hover:text-white"
              >
                <SlidersHorizontal className="h-4 w-4 text-emerald-400" />
                <span>Select Columns to Print ({selectedColumnIds.length} of {ALL_PRINT_COLUMNS.length} active)</span>
                {isColumnPanelOpen ? <ChevronUp className="h-3.5 w-3.5 text-[#808080]" /> : <ChevronDown className="h-3.5 w-3.5 text-[#808080]" />}
              </button>

              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={selectAllColumns}
                  className="text-emerald-400 hover:text-emerald-300 font-medium"
                >
                  Select All
                </button>
                <span className="text-[#404040]">|</span>
                <button
                  type="button"
                  onClick={deselectAllColumns}
                  className="text-[#808080] hover:text-[#B5B5B5]"
                >
                  Reset Defaults
                </button>
              </div>
            </div>

            {isColumnPanelOpen && (
              <div className="pt-2 border-t border-white/5 space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                  {ALL_PRINT_COLUMNS.map(col => {
                    const isChecked = selectedColumnIds.includes(col.id);
                    const isLocked = col.isMandatory;
                    return (
                      <button
                        type="button"
                        key={col.id}
                        disabled={isLocked}
                        onClick={() => toggleColumn(col.id)}
                        className={cn(
                          'flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-left text-xs transition-all',
                          isChecked
                            ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                            : 'bg-white/[0.02] border-white/5 text-[#808080] hover:bg-white/[0.05] hover:text-[#B5B5B5]',
                          isLocked && 'opacity-80 cursor-not-allowed bg-white/[0.05] text-[#A0A0A0]'
                        )}
                      >
                        {isChecked ? (
                          <CheckSquare className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <Square className="h-3.5 w-3.5 text-[#606060] shrink-0" />
                        )}
                        <span className="truncate">{col.label}</span>
                        {col.isMandatory && (
                          <span className="ml-auto text-[9px] bg-white/10 px-1 py-0.2 rounded text-[#A0A0A0]">Req</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Orientation Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/5 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-[#808080]">Print Orientation:</span>
                    <span className="font-semibold text-emerald-400 uppercase tracking-wider">
                      {effectiveOrientation}
                    </span>
                    <span className="text-[10px] text-[#606060]">
                      ({orientationMode === 'auto'
                        ? `Auto: ${selectedColumnIds.length <= 5 ? '≤ 5 cols (Portrait)' : '> 5 cols (Landscape)'}`
                        : `Forced ${orientationMode}`})
                    </span>
                  </div>

                  <div className="flex items-center gap-1 bg-white/[0.05] p-1 rounded-md border border-white/10">
                    <button
                      type="button"
                      onClick={() => setOrientationMode('auto')}
                      className={cn(
                        'px-2 py-0.5 rounded text-[11px] font-medium transition-colors',
                        orientationMode === 'auto' ? 'bg-emerald-600 text-white' : 'text-[#808080] hover:text-[#D0D0D0]'
                      )}
                    >
                      Auto
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrientationMode('portrait')}
                      className={cn(
                        'px-2 py-0.5 rounded text-[11px] font-medium transition-colors',
                        orientationMode === 'portrait' ? 'bg-emerald-600 text-white' : 'text-[#808080] hover:text-[#D0D0D0]'
                      )}
                    >
                      Portrait
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrientationMode('landscape')}
                      className={cn(
                        'px-2 py-0.5 rounded text-[11px] font-medium transition-colors',
                        orientationMode === 'landscape' ? 'bg-emerald-600 text-white' : 'text-[#808080] hover:text-[#D0D0D0]'
                      )}
                    >
                      Landscape
                    </button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Filters and Controls */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#808080]" />
            <Input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search ID, Team, Lead, Phone, College, UTR..."
              className="pl-9 h-9 text-xs bg-[#141414] border-white/10 text-[#F0F0F0] placeholder:text-[#606060]"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#808080] hover:text-white"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Attendance Toggle */}
            <div className="flex items-center bg-[#141414] border border-white/10 rounded-md p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setAttendanceFilter('all')}
                className={cn(
                  'px-2.5 py-1 rounded transition-colors',
                  attendanceFilter === 'all' ? 'bg-white/10 text-white font-medium' : 'text-[#808080] hover:text-[#D0D0D0]'
                )}
              >
                All ({teams.length})
              </button>
              <button
                type="button"
                onClick={() => setAttendanceFilter('present')}
                className={cn(
                  'px-2.5 py-1 rounded transition-colors',
                  attendanceFilter === 'present' ? 'bg-emerald-500/20 text-emerald-300 font-medium' : 'text-[#808080] hover:text-[#D0D0D0]'
                )}
              >
                Present ({teams.filter(t => t.isPresent).length})
              </button>
              <button
                type="button"
                onClick={() => setAttendanceFilter('absent')}
                className={cn(
                  'px-2.5 py-1 rounded transition-colors',
                  attendanceFilter === 'absent' ? 'bg-amber-500/20 text-amber-300 font-medium' : 'text-[#808080] hover:text-[#D0D0D0]'
                )}
              >
                Absent ({teams.filter(t => !t.isPresent).length})
              </button>
            </div>

            {/* College Dropdown */}
            {collegesList.length > 0 && (
              <select
                value={collegeFilter}
                onChange={e => setCollegeFilter(e.target.value)}
                className="h-9 px-2 text-xs bg-[#141414] border border-white/10 rounded-md text-[#D0D0D0] focus:outline-none"
              >
                <option value="all">All Colleges ({collegesList.length})</option>
                {collegesList.map(col => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
            )}

            {/* Sort Toggle */}
            <div className="flex items-center gap-1 bg-[#141414] border border-white/10 rounded-md px-2 h-9 text-xs">
              <ArrowUpDown className="h-3 w-3 text-[#808080]" />
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="bg-transparent text-[#D0D0D0] focus:outline-none text-xs cursor-pointer"
              >
                <option value="teamId">Sort: Team ID</option>
                <option value="teamName">Sort: Team Name</option>
                <option value="college">Sort: College</option>
                <option value="registeredAt">Sort: Registered Time</option>
              </select>
              <button
                type="button"
                onClick={() => setSortDirection(d => (d === 'asc' ? 'desc' : 'asc'))}
                className="px-1 text-[#808080] hover:text-white uppercase font-bold text-[10px]"
                title="Toggle Asc/Desc"
              >
                {sortDirection}
              </button>
            </div>
          </div>
        </div>

        {/* Live Filter Summary Bar */}
        <div className="flex items-center justify-between text-xs text-[#808080] px-1">
          <div>
            Showing <strong className="text-white">{processedTeams.length}</strong> of{' '}
            <strong className="text-[#A0A0A0]">{teams.length}</strong> teams
            {searchTerm && <span> matching &ldquo;{searchTerm}&rdquo;</span>}
            {attendanceFilter !== 'all' && <span> ({attendanceFilter} only)</span>}
            {collegeFilter !== 'all' && <span> from {collegeFilter}</span>}
          </div>
          <div className="text-[11px] text-[#606060]">
            Format: {effectiveOrientation.toUpperCase()} &bull; {activeColumns.length} Columns
          </div>
        </div>
      </div>

      {/* PRINT AREA (Active for both screen preview and @media print) */}
      <div className="print-area bg-white text-black p-4 md:p-6 rounded-lg shadow-sm border border-neutral-300 print:border-none print:shadow-none print:p-0">
        {/* Printable Official Document Header */}
        <div className="border-b-2 border-black pb-3 mb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <input
                type="text"
                value={documentTitle}
                onChange={e => setDocumentTitle(e.target.value)}
                placeholder="Enter Document Heading..."
                className="w-full font-bold uppercase tracking-tight text-lg md:text-xl text-black bg-transparent border-b border-dashed border-neutral-300 hover:border-neutral-500 focus:border-black focus:outline-none transition-colors py-0.5 print:border-none print:p-0"
                title="Click to edit document heading"
              />
              <input
                type="text"
                value={documentSubtitle}
                onChange={e => setDocumentSubtitle(e.target.value)}
                placeholder="Enter Subtitle..."
                className="w-full text-xs text-neutral-600 bg-transparent border-b border-dashed border-neutral-200 hover:border-neutral-400 focus:border-black focus:outline-none transition-colors py-0.5 mt-0.5 print:border-none print:p-0"
                title="Click to edit document subtitle"
              />
            </div>
            <div className="text-right text-[11px] text-neutral-600 shrink-0">
              <p className="font-semibold text-black whitespace-nowrap">Printed: {printDate}</p>
            </div>
          </div>
        </div>

        {/* Table Content */}
        {teamsLoading ? (
          <div className="py-12 text-center text-xs text-neutral-500">Loading registrations from database...</div>
        ) : processedTeams.length === 0 ? (
          <div className="py-12 text-center text-xs text-neutral-500">
            No teams found matching current search or filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className={cn('w-full border-collapse text-left', tableFontSizeClass)}>
              <thead>
                <tr className="bg-neutral-100 border border-black">
                  {activeColumns.map(col => (
                    <th
                      key={col.id}
                      className={cn(
                        'border border-black font-bold uppercase tracking-wider text-black',
                        cellPaddingClass,
                        col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'
                      )}
                    >
                      {col.shortLabel}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {processedTeams.map((team, idx) => (
                  <tr
                    key={team.teamId || idx}
                    className={cn(
                      'border border-black hover:bg-neutral-50',
                      idx % 2 === 1 ? 'bg-neutral-50/50' : 'bg-white'
                    )}
                  >
                    {activeColumns.map(col => (
                      <td
                        key={col.id}
                        className={cn(
                          'border border-black text-black align-middle',
                          cellPaddingClass,
                          col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'
                        )}
                      >
                        {col.render(team, idx)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Printable Document Footer */}
        <div className="mt-4 pt-2 border-t border-neutral-300 flex items-center justify-between text-[10px] text-neutral-500">
          <span>LAKSHYA 2026 Event Administration &bull; Confidential &bull; Authorized Staff Only</span>
          <span>Total Records: {processedTeams.length}</span>
        </div>
      </div>
    </div>
    </SecondaryAuthGate>
  );
}
