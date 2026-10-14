'use client';
import { useState, useRef, useEffect } from 'react';
import { QrCode, Scan, X, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { trimTeamId } from '@/lib/utils';
import type { Team } from '@/types';
import { toast } from 'sonner';

interface QuickScanBarProps {
  active: boolean;
  onToggle: (active: boolean) => void;
  teams: Team[];
  onTeamScanned: (team: Team) => void;
}

export function QuickScanBar({
  active,
  onToggle,
  teams,
  onTeamScanned,
}: QuickScanBarProps) {
  const [scanInput, setScanInput] = useState('');
  const [lastScannedTeam, setLastScannedTeam] = useState<Team | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Autofocus input whenever scan mode is activated
  useEffect(() => {
    if (active) {
      setErrorMsg(null);
      setScanInput('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [active]);

  /**
   * Safe extraction of Team ID from raw barcode / QR string
   * Handles:
   * 1. Raw Team ID: 'LAK-001'
   * 2. URL format: 'https://hackadmin.dev/teams/LAK-001'
   * 3. JSON format: '{"teamId":"LAK-001"}'
   */
  const extractTeamIdFromScan = (raw: string): string => {
    const trimmed = trimTeamId(raw);
    if (!trimmed) return '';

    // Check for JSON
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed.teamId) return String(parsed.teamId).trim();
        if (parsed.id) return String(parsed.id).trim();
      } catch {
        // Fall through to regex
      }
    }

    // Check for URL or path
    const urlMatch = trimmed.match(/(?:team|teams|check-in|id)\/([A-Za-z0-9-_]+)/i);
    if (urlMatch && urlMatch[1]) {
      return urlMatch[1].trim();
    }

    // Direct string
    return trimmed;
  };

  const processScan = (rawText: string) => {
    const candidateId = extractTeamIdFromScan(rawText);
    if (!candidateId) {
      setErrorMsg('No readable Team ID in scanned data.');
      return;
    }

    // Lookup team in active registrations
    const found = teams.find(
      t => t.teamId.toLowerCase() === candidateId.toLowerCase()
    );

    if (!found) {
      setErrorMsg(`Scanned Team ID "${candidateId}" not found in spreadsheet.`);
      toast.error(`Team "${candidateId}" not found.`);
      return;
    }

    setErrorMsg(null);
    setLastScannedTeam(found);
    setScanInput('');

    // Trigger existing team check-in confirmation flow
    onTeamScanned(found);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (scanInput.trim()) {
        processScan(scanInput);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onToggle(false);
    }
  };

  if (!active) return null;

  return (
    <div className="w-full rounded-2xl border border-emerald-500/30 bg-emerald-950/20 backdrop-blur-xl p-4 text-[#F0F0F0] shadow-xl space-y-3 transition-all animate-in fade-in-0 duration-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <Scan className="h-4 w-4 animate-pulse" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-emerald-200 tracking-tight flex items-center gap-1.5">
              Quick Scan Mode Active
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-900/50 text-emerald-300 border border-emerald-700/40">
                Alt + Q
              </span>
            </h3>
            <p className="text-[11px] text-emerald-300/70">
              Point handheld 2D barcode/QR scanner or paste Team ID code.
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => onToggle(false)}
          className="h-7 w-7 p-0 text-[#808080] hover:text-white hover:bg-white/10 rounded-lg"
          aria-label="Exit Quick Scan Mode"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="relative">
        <QrCode className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={scanInput}
          onChange={e => setScanInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Awaiting scanner input... (Scanner sends ID + Enter)"
          className="w-full pl-10 pr-24 h-11 font-mono text-xs sm:text-sm bg-black/60 border border-emerald-500/40 text-emerald-100 placeholder:text-emerald-500/50 focus:outline-none focus:border-emerald-400 rounded-xl"
          autoComplete="off"
          spellCheck={false}
        />
        <Button
          size="sm"
          onClick={() => scanInput.trim() && processScan(scanInput)}
          disabled={!scanInput.trim()}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg"
        >
          <span>Lookup</span>
          <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-red-950/40 border border-red-800/40 text-xs text-red-300">
          <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {lastScannedTeam && (
        <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.04] border border-white/10 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            <span className="font-mono font-bold text-white">{lastScannedTeam.teamId}</span>
            <span className="text-[#808080]">|</span>
            <span className="text-white truncate">{lastScannedTeam.teamName}</span>
          </div>
          <span className="text-[11px] text-[#808080]">Confirmation opened</span>
        </div>
      )}
    </div>
  );
}
