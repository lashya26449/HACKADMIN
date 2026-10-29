'use client';
import { useState } from 'react';
import {
  CheckCircle2, Loader2, AlertTriangle, ArrowRight, MapPin, Mail, MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import type { Team } from '@/types';
import { cn } from '@/lib/utils';
import { normalizeIndianPhone, buildCheckInMessage } from '@/lib/whatsapp';

interface TeamCardProps {
  team: Team;
  onCheckIn: (teamId: string, rowIndex?: number) => Promise<void>;
  canCheckIn: boolean;
  processingTeamId?: string;
  isDuplicate?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
  onRequestCheckIn?: () => void;
}

export function TeamCard({
  team,
  onCheckIn,
  canCheckIn,
  processingTeamId,
  isDuplicate,
  isSelected,
  onSelect,
  onRequestCheckIn,
}: TeamCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const isProcessing = processingTeamId === team.teamId;
  const isPresent = Boolean(team.isPresent);

  // Target cell calculation for Google Sheet (Attendance is Column P)
  const targetRow = team.rowIndex ?? 'Auto-detect';
  const targetCell = team.rowIndex ? `P${team.rowIndex}` : 'Column P';

  const handleConfirm = async () => {
    setLocalError(null);
    setDialogOpen(false);
    try {
      await onCheckIn(team.teamId, team.rowIndex);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Check-in failed');
    }
  };

  const cleanPhone = normalizeIndianPhone(team.leaderPhone);
  const waChatUrl = cleanPhone
    ? `https://web.whatsapp.com/send?phone=${encodeURIComponent(cleanPhone)}&text=${encodeURIComponent(
        buildCheckInMessage({
          leadName: team.leaderName,
          teamName: team.teamName,
          teamId: team.teamId,
        })
      )}`
    : (team.whatsappUrl || null);

  return (
    <>
      <div
        id={`team-card-${team.teamId}`}
        onClick={onSelect}
        className={cn(
          'w-full rounded-2xl border border-white/10 border-t-white/20 bg-gradient-to-b from-white/[0.06] to-white/[0.02] backdrop-blur-2xl text-[#F0F0F0] shadow-[0_8px_24px_-6px_rgba(0,0,0,0.6)] transition-all duration-200 cursor-pointer',
          'p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4',
          'hover:border-white/20 hover:border-t-white/35 hover:shadow-[0_12px_32px_-6px_rgba(0,0,0,0.8),0_0_20px_-6px_rgba(16,185,129,0.12)] hover:-translate-y-0.5',
          isSelected && 'ring-2 ring-emerald-500/80 border-emerald-500/60 bg-emerald-950/15 shadow-[0_0_25px_rgba(16,185,129,0.25)]',
          isPresent && !isSelected && 'border-emerald-500/30 border-t-emerald-400/40 bg-emerald-950/20',
          isPresent && isSelected && 'border-emerald-500/80 bg-emerald-950/30',
          isProcessing && 'border-cyan-500/40 ring-1 ring-cyan-500/30',
          localError && 'border-red-500/40 bg-red-950/20',
          isDuplicate && 'border-amber-500/40 bg-amber-950/20'
        )}
      >
        {/* LEFT AREA — TEAM IDENTIFICATION */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 min-w-0">
            {/* 1. Team ID Badge */}
            <span className="font-mono text-xs font-bold text-white bg-gradient-to-b from-white/[0.14] to-white/[0.04] border border-white/15 border-t-white/30 px-2.5 py-1 rounded-lg shrink-0 tracking-wider shadow-sm">
              {team.teamId}
            </span>

            {isSelected && (
              <span className="hidden sm:inline-flex items-center gap-1 font-mono text-[10px] text-emerald-300 bg-emerald-950/90 px-2 py-0.5 rounded-md border border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.25)] animate-in fade-in-0 font-medium">
                Selected &middot; Enter / Alt+P
              </span>
            )}

            <span className="text-white/20 hidden sm:inline select-none">|</span>

            {/* 2. Team Name */}
            <span className="text-sm font-semibold text-[#F0F0F0] truncate max-w-[220px] lg:max-w-[320px] tracking-tight" title={team.teamName}>
              {team.teamName || 'Untitled Team'}
            </span>

            <span className="text-white/20 hidden sm:inline select-none">|</span>

            {/* 3. Team Lead Name */}
            <span className="text-xs font-medium text-[#C8C8C8] truncate max-w-[180px]" title={team.leaderName}>
              {team.leaderName || 'Lead Unassigned'}
            </span>

            <span className="text-white/20 hidden sm:inline select-none">|</span>

            {/* 4. College Name */}
            <span className="text-xs text-[#808080] truncate max-w-[240px] lg:max-w-[360px]" title={team.college}>
              {team.college || 'Institution Unlisted'}
            </span>
          </div>

          {/* Warnings / Errors */}
          {isDuplicate && (
            <div className="mt-2 text-xs text-amber-300 bg-amber-950/40 border border-amber-800/40 px-2.5 py-1 rounded-md flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              <span>Duplicate Team ID detected in spreadsheet. Attendance writes are blocked for safety.</span>
            </div>
          )}
          {localError && (
            <div className="mt-2 text-xs text-red-300 bg-red-950/40 border border-red-800/40 px-2.5 py-1 rounded-md flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />
              <span>{localError}</span>
            </div>
          )}
        </div>

        {/* MIDDLE & RIGHT AREAS: Status + Action on Desktop / Mobile */}
        <div className="flex items-center justify-between md:justify-end gap-3 sm:gap-4 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-white/5">
          {/* MIDDLE AREA — ATTENDANCE STATUS */}
          <div className="shrink-0">
            {isPresent ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold font-mono tracking-wider bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                PRESENT
              </span>
            ) : isProcessing ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium font-mono bg-blue-950/40 border border-blue-500/40 text-blue-300 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0 text-cyan-400" />
                VERIFYING...
              </span>
            ) : (
              <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium font-mono tracking-wider bg-white/[0.03] border border-white/10 text-[#757575]">
                NOT PRESENT
              </span>
            )}
          </div>

          {/* RIGHT AREA — ATTENDANCE ACTION */}
          <div className="shrink-0 min-w-[130px] flex justify-end">
            {isPresent ? (
              <div className="flex items-center gap-2">
                {waChatUrl && (
                  <a
                    href={waChatUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold bg-[#25D366]/15 hover:bg-[#25D366]/25 text-[#25D366] border border-[#25D366]/40 transition-all shadow-[0_0_12px_rgba(37,211,102,0.15)] hover:shadow-[0_0_18px_rgba(37,211,102,0.3)] active:scale-95"
                    title={`Ping ${team.leaderName || 'Lead'} on WhatsApp`}
                  >
                    <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                    <span className="hidden sm:inline">WhatsApp</span>
                  </a>
                )}
                <Button
                  size="sm"
                  disabled
                  className="h-9 px-3 text-xs font-semibold bg-white/[0.03] border border-white/10 text-[#606060] opacity-50 cursor-not-allowed rounded-lg"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 text-emerald-500" />
                  Present
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {waChatUrl && (
                  <a
                    href={waChatUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold bg-[#25D366]/15 hover:bg-[#25D366]/25 text-[#25D366] border border-[#25D366]/40 transition-all shadow-[0_0_12px_rgba(37,211,102,0.15)] hover:shadow-[0_0_18px_rgba(37,211,102,0.3)] active:scale-95 shrink-0"
                    title={`Open WhatsApp chat with ${team.leaderName || 'Lead'}`}
                  >
                    <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                    <span className="hidden sm:inline">WhatsApp</span>
                  </a>
                )}
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCheckIn(team.teamId, team.rowIndex);
                  }}
                  disabled={isProcessing || !canCheckIn || isDuplicate}
                  className="h-9 px-4 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg border border-emerald-400/30 border-t-emerald-300/50 shadow-[0_0_20px_-3px_rgba(16,185,129,0.4)] hover:shadow-[0_0_28px_0_rgba(16,185,129,0.55)] active:scale-95 transition-all"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      Marking...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                      MARK PRESENT
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className="max-w-md bg-[#101010] border-white/10 text-[#F0F0F0]"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleConfirm();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-[#F0F0F0]">
              Confirm Team Attendance
            </DialogTitle>
            <DialogDescription className="text-xs text-[#808080]">
              This writes &apos;P&apos; directly to column P of the live Google Sheet and verifies the update.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3.5 space-y-2 text-xs">
            <div className="flex justify-between items-center py-1 border-b border-white/5">
              <span className="text-[#808080]">Team ID</span>
              <span className="font-mono font-bold text-[#F0F0F0]">{team.teamId}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-white/5">
              <span className="text-[#808080]">Team Name</span>
              <span className="font-medium text-[#F0F0F0] truncate max-w-[220px]">{team.teamName}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-white/5">
              <span className="text-[#808080]">Lead Name</span>
              <span className="text-[#B5B5B5] truncate max-w-[220px]">{team.leaderName || 'Unassigned'}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-white/5">
              <span className="text-[#808080]">College</span>
              <span className="text-[#B5B5B5] truncate max-w-[220px]">{team.college || 'Unlisted'}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-white/5">
              <span className="text-[#808080]">Target Row</span>
              <span className="font-mono text-[#F0F0F0]">Row {targetRow}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-white/5">
              <span className="text-[#808080]">Attendance Cell</span>
              <span className="font-mono font-bold text-emerald-400">{targetCell}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-[#808080]">Proposed Value</span>
              <span className="font-mono font-bold text-emerald-400 flex items-center gap-1">
                &apos;P&apos; <ArrowRight className="h-3 w-3 text-[#808080]" />
              </span>
            </div>
          </div>

          {/* Venue Arrival Directions Notice */}
          <div className="rounded-xl border border-purple-500/30 bg-purple-950/20 p-3 space-y-1.5 shadow-[0_0_15px_rgba(168,85,247,0.15)]">
            <div className="flex items-center gap-2 text-purple-300 font-semibold text-xs">
              <MapPin className="h-4 w-4 text-purple-400 shrink-0" />
              <span>Venue Arrival Instructions</span>
            </div>
            <div className="text-[11px] space-y-0.5 pl-6 text-[#E0E0E0]">
              <p>
                <span className="text-[#888888]">Destination: </span>
                <strong className="text-white">CSE Seminar Hall</strong>
              </p>
              <p>
                <span className="text-[#888888]">Directions: </span>
                <strong className="text-purple-300">Go straight and take a left</strong>
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-purple-300/80 pl-6 pt-1">
              <Mail className="h-3 w-3 text-purple-400" />
              <span>Arrival directions email automatically triggered to team lead</span>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)} className="border-white/10 bg-white/[0.04] text-[#A0A0A0] hover:text-white">
              Cancel (Esc)
            </Button>
            <Button
              size="sm"
              autoFocus
              onClick={handleConfirm}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-[0_0_15px_rgba(16,185,129,0.3)]"
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
              Confirm &amp; Write &apos;P&apos; (Enter ↵)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
