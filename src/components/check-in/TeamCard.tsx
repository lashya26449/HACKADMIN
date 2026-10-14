'use client';
import { useState } from 'react';
import {
  CheckCircle2, Loader2, AlertTriangle, ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import type { Team } from '@/types';
import { cn } from '@/lib/utils';

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

  return (
    <>
      <div
        id={`team-card-${team.teamId}`}
        onClick={onSelect}
        className={cn(
          'w-full rounded-xl border border-white/10 bg-white/[0.045] backdrop-blur-xl text-[#F0F0F0] shadow-md transition-all duration-200 cursor-pointer',
          'p-3.5 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4',
          isSelected && 'ring-2 ring-emerald-500/70 border-emerald-500/60 bg-white/[0.08] shadow-emerald-950/40 shadow-lg',
          isPresent && !isSelected && 'border-emerald-800/40 bg-emerald-950/20',
          isPresent && isSelected && 'border-emerald-500/80 bg-emerald-950/30',
          isProcessing && 'border-white/30 ring-1 ring-white/20',
          localError && 'border-red-800/50 bg-red-950/20',
          isDuplicate && 'border-amber-800/50 bg-amber-950/20'
        )}
      >
        {/* LEFT AREA — TEAM IDENTIFICATION */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 min-w-0">
            {/* 1. Team ID */}
            <span className="font-mono text-xs font-bold text-[#F0F0F0] bg-white/[0.08] border border-white/12 px-2.5 py-1 rounded-md shrink-0 tracking-wide">
              {team.teamId}
            </span>

            {isSelected && (
              <span className="hidden sm:inline-flex items-center gap-1 font-mono text-[10px] text-emerald-300 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/40 animate-in fade-in-0">
                Selected &middot; Enter / Alt+P
              </span>
            )}

            <span className="text-white/20 hidden sm:inline select-none">|</span>

            {/* 2. Team Name */}
            <span className="text-sm font-semibold text-[#F0F0F0] truncate max-w-[220px] lg:max-w-[320px]" title={team.teamName}>
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
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold bg-emerald-950/60 border border-emerald-800/60 text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                PRESENT
              </span>
            ) : isProcessing ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium bg-blue-950/40 border border-blue-800/40 text-blue-300">
                <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                VERIFYING...
              </span>
            ) : (
              <span className="inline-flex items-center px-3 py-1 rounded-md text-xs font-medium bg-white/[0.04] border border-white/10 text-[#808080]">
                NOT PRESENT
              </span>
            )}
          </div>

          {/* RIGHT AREA — ATTENDANCE ACTION */}
          <div className="shrink-0 min-w-[130px] flex justify-end">
            {isPresent ? (
              <Button
                size="sm"
                disabled
                className="h-9 px-4 text-xs font-semibold bg-white/[0.03] border border-white/10 text-[#808080] opacity-50 cursor-not-allowed"
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 text-emerald-500" />
                Present
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => onRequestCheckIn ? onRequestCheckIn() : setDialogOpen(true)}
                disabled={isProcessing || !canCheckIn || isDuplicate}
                className="h-9 px-4 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md active:scale-95 transition-all"
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
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md bg-[#101010] border-white/10 text-[#F0F0F0]">
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

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)} className="border-white/10 bg-white/[0.04]">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirm}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
              Confirm &amp; Write &apos;P&apos;
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
