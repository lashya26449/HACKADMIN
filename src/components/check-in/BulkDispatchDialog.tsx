'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Zap,
  Mail,
  MessageSquare,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  Sparkles,
  Smartphone,
  MapPin,
  ExternalLink,
  Loader2,
  Users,
} from 'lucide-react';
import type { Team } from '@/types';
import { parseTeamIdInput, resolveTeamsForDispatch } from '@/lib/bulk-dispatcher';
import { getLakshyaVenue, buildAttendanceWhatsAppMessage } from '@/lib/venue';
import { normalizeIndianPhone, dispatchDesktopWhatsApp, loadChat, getWhatsAppMode } from '@/lib/whatsapp';
import { toast } from 'sonner';

interface BulkDispatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teams: Team[];
  onRefreshTeams?: () => Promise<unknown>;
  getIdToken?: () => Promise<string | null>;
}

type Step = 'input' | 'sending_emails' | 'whatsapp_queue' | 'finished';

export function BulkDispatchDialog({
  open,
  onOpenChange,
  teams,
  onRefreshTeams,
  getIdToken,
}: BulkDispatchDialogProps) {
  const [step, setStep] = useState<Step>('input');
  const [inputVal, setInputVal] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dispatchedIds, setDispatchedIds] = useState<Set<string>>(new Set());
  const [isTriggeringEmails, setIsTriggeringEmails] = useState(false);
  const [emailTriggerResult, setEmailTriggerResult] = useState<{ count: number } | null>(null);

  // Parse IDs from user input
  const parsedIds = useMemo(() => parseTeamIdInput(inputVal), [inputVal]);

  // Resolve matching Team records
  const targetTeams = useMemo(
    () => resolveTeamsForDispatch(parsedIds, teams),
    [parsedIds, teams]
  );

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setStep('input');
      setCurrentIndex(0);
      setDispatchedIds(new Set());
      setEmailTriggerResult(null);
    }
  }, [open]);

  // Keyboard shortcut: Press Enter on the WhatsApp queue step to trigger and advance
  useEffect(() => {
    if (!open || step !== 'whatsapp_queue') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        handleDispatchCurrent();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, step, currentIndex, targetTeams]);

  // Quick Preset Handlers
  const applyPreset = (preset: string) => {
    switch (preset) {
      case 'ground':
        setInputVal('LAK-002 to LAK-015, LAK-029 to LAK-038');
        break;
      case 'first':
        setInputVal('LAK-031, LAK-047 to LAK-049, LAK-064, LAK-066, LAK-070');
        break;
      case 'second':
        setInputVal('LAK-016 to LAK-028, LAK-044, LAK-068');
        break;
      case 'third':
        setInputVal('LAK-032, LAK-035, LAK-037, LAK-039 to LAK-043, LAK-045, LAK-046, LAK-050 to LAK-061, LAK-063, LAK-065, LAK-067, LAK-069, LAK-072');
        break;
      case 'fourth':
        setInputVal('LAK-062, LAK-071, LAK-073 to LAK-076');
        break;
      case 'present': {
        const presentIds = teams
          .filter(t => t.isPresent || t.attendanceValue?.toUpperCase() === 'P')
          .map(t => t.teamId)
          .join(', ');
        setInputVal(presentIds || 'No teams currently marked Present');
        break;
      }
    }
  };

  // Step 1 -> 2: Trigger Emails via bulk check-in endpoint
  const handleProceedToEmailsAndQueue = async () => {
    if (targetTeams.length === 0) {
      toast.error('Please enter at least one valid Team ID or range.');
      return;
    }

    setIsTriggeringEmails(true);
    setStep('sending_emails');

    try {
      let token: string | null = null;
      if (getIdToken) {
        try {
          token = await getIdToken();
        } catch {
          token = null;
        }
      }
      if (!token) {
        try {
          const { auth } = await import('@/lib/firebase/client');
          token = (await auth.currentUser?.getIdToken()) || null;
        } catch {
          token = null;
        }
      }
      if (!token) {
        token = 'session';
      }

      const res = await fetch('/api/check-in/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ teamIds: parsedIds }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to trigger bulk emails');
      }

      setEmailTriggerResult({ count: data.data?.count || targetTeams.length });
      toast.success(`✓ Attendance emails triggered for ${targetTeams.length} teams!`);

      if (onRefreshTeams) {
        onRefreshTeams().catch(() => {});
      }

      // Transition smoothly into WhatsApp Queue
      setTimeout(() => {
        setIsTriggeringEmails(false);
        setCurrentIndex(0);
        setStep('whatsapp_queue');
      }, 700);

    } catch (err) {
      setIsTriggeringEmails(false);
      setStep('input');
      toast.error(err instanceof Error ? err.message : 'Error triggering emails');
    }
  };

  // Dispatch single team in WhatsApp and advance queue
  const currentTeam = targetTeams[currentIndex];
  const currentVenue = currentTeam ? getLakshyaVenue(currentTeam.teamId) : null;
  const currentPhone = currentTeam ? normalizeIndianPhone(currentTeam.leaderPhone) : null;
  const currentMessage = currentTeam
    ? buildAttendanceWhatsAppMessage(currentTeam.teamName, currentTeam.teamId, currentVenue)
    : '';

  const handleDispatchCurrent = () => {
    if (!currentTeam) return;

    if (currentPhone) {
      const mode = getWhatsAppMode();
      loadChat(null, currentPhone, currentMessage, mode);
      setDispatchedIds(prev => new Set([...prev, currentTeam.teamId]));
      toast.success(`Dispatched ${currentTeam.teamId} to WhatsApp Desktop!`);
    } else {
      toast.info(`Team ${currentTeam.teamId} has no phone number. Skipping...`);
    }

    if (currentIndex + 1 < targetTeams.length) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setStep('finished');
    }
  };

  const handleSkip = () => {
    if (currentIndex + 1 < targetTeams.length) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setStep('finished');
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-[#0D0D0D] border border-white/15 text-white shadow-2xl rounded-3xl p-6 sm:p-7 max-h-[92vh] overflow-y-auto font-sans">
        
        {/* MODAL HEADER */}
        <DialogHeader className="border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
              <Zap className="h-5 w-5" />
            </span>
            <div>
              <DialogTitle className="text-lg sm:text-xl font-black text-white tracking-tight">
                Bulk Dispatch — Email &amp; WhatsApp Queue
              </DialogTitle>
              <DialogDescription className="text-xs text-[#808080] mt-0.5">
                Enter team IDs or ranges &bull; Automatically triggers official venue emails then launches WhatsApp queue
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* STEP 1: INPUT TEAM IDS & RANGES */}
        {step === 'input' && (
          <div className="space-y-4 py-3">
            {/* Quick Preset Buttons */}
            <div>
              <label className="text-[11px] font-semibold text-[#808080] uppercase tracking-wider block mb-2">
                Quick Allotment Presets:
              </label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => applyPreset('ground')}
                  className="px-2.5 py-1 text-xs rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-neutral-300 font-medium transition-all"
                >
                  Ground (CS-1, CS-2, ST)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('first')}
                  className="px-2.5 py-1 text-xs rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-neutral-300 font-medium transition-all"
                >
                  1st Floor (VTU)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('second')}
                  className="px-2.5 py-1 text-xs rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-neutral-300 font-medium transition-all"
                >
                  2nd Floor (CV Raman / Edison)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('third')}
                  className="px-2.5 py-1 text-xs rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-neutral-300 font-medium transition-all"
                >
                  3rd Floor (Edward / Ramanujacharya / Tim)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('fourth')}
                  className="px-2.5 py-1 text-xs rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-neutral-300 font-medium transition-all"
                >
                  4th Floor (Linus Torvalds)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('present')}
                  className="px-2.5 py-1 text-xs rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-semibold transition-all"
                >
                  All Checked In
                </button>
              </div>
            </div>

            {/* Range / Textarea Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-200 flex items-center justify-between">
                <span>Enter Team IDs or Ranges:</span>
                <span className="text-[11px] text-[#707070] font-normal">
                  e.g. <code className="text-neutral-400">2-10</code>, <code className="text-neutral-400">LAK-016 to LAK-021</code>, <code className="text-neutral-400">29, 30</code>
                </span>
              </label>
              <textarea
                value={inputVal}
                onChange={e => setInputVal(e.target.value)}
                rows={3}
                placeholder="Type or paste IDs (e.g. 2-8, LAK-009 to LAK-015, 29, 33)..."
                className="w-full rounded-2xl bg-white/[0.04] border border-white/15 p-3.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-white focus:ring-1 focus:ring-white/20 font-mono"
              />
            </div>

            {/* Live Matched Teams Preview */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-neutral-300 flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-emerald-400" />
                  Matched Teams ({targetTeams.length})
                </span>
                <span className="text-[11px] text-[#707070]">
                  {targetTeams.filter(t => normalizeIndianPhone(t.leaderPhone)).length} with phone
                </span>
              </div>

              {targetTeams.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto pr-1">
                  {targetTeams.map(t => {
                    const venue = getLakshyaVenue(t.teamId);
                    return (
                      <span
                        key={t.teamId}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-white/[0.06] border border-white/15 text-white font-mono"
                        title={`${t.teamName} · ${venue ? `${venue.venue} (${venue.floor})` : 'Pending'}`}
                      >
                        <span className="font-bold text-amber-300">{t.teamId}</span>
                        <span className="text-[#909090] max-w-[100px] truncate">{t.teamName}</span>
                        {venue && (
                          <span className="text-[10px] text-emerald-400 font-sans">
                            &bull; {venue.venue}
                          </span>
                        )}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-[#606060] italic">
                  No teams matched yet. Enter numbers, ranges, or select a preset above.
                </p>
              )}
            </div>

            {/* Workflow Notice */}
            <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/25 flex items-start gap-2.5 text-xs text-purple-200">
              <Mail className="h-4 w-4 text-purple-400 shrink-0 mt-0.5" />
              <span>
                <strong>Workflow:</strong> Clicking below triggers official venue emails via Google Sheets, then opens the sequential WhatsApp Desktop Queue.
              </span>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="border-white/15 bg-white/[0.04] text-neutral-300 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                onClick={handleProceedToEmailsAndQueue}
                disabled={targetTeams.length === 0}
                className="bg-amber-600 hover:bg-amber-500 text-black font-black shadow-[0_0_20px_rgba(245,158,11,0.3)] transition-all"
              >
                <Zap className="h-4 w-4 mr-1.5" />
                1. Trigger Emails &amp; Start WhatsApp Queue ({targetTeams.length})
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* STEP: SENDING EMAILS SPINNER */}
        {step === 'sending_emails' && (
          <div className="py-16 text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-amber-400" />
            <p className="text-base font-bold text-white">Triggering Venue Emails...</p>
            <p className="text-xs text-[#808080] max-w-sm mx-auto">
              Updating attendance in Google Sheets to trigger official venue allocation emails for {targetTeams.length} teams.
            </p>
          </div>
        )}

        {/* STEP 2: WHATSAPP QUEUE */}
        {step === 'whatsapp_queue' && currentTeam && (
          <div className="space-y-4 py-2 animate-in fade-in-0 duration-150">
            {/* Progress Header */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-[#808080]">
                <span>
                  Team <strong className="text-white font-mono text-sm">{currentIndex + 1}</strong> of{' '}
                  <strong className="text-white font-mono text-sm">{targetTeams.length}</strong>
                </span>
                <span className="font-mono text-emerald-400">
                  {Math.round(((currentIndex + 1) / targetTeams.length) * 100)}%
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${((currentIndex + 1) / targetTeams.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Active Team Card */}
            <div className="rounded-3xl border border-white/20 bg-white/[0.04] backdrop-blur-2xl p-5 sm:p-6 space-y-4 shadow-xl">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs sm:text-sm font-black px-3 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300">
                      {currentTeam.teamId}
                    </span>
                    <span className="text-xs text-[#808080] truncate">{currentTeam.college}</span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight truncate">
                    {currentTeam.teamName}
                  </h3>
                  <p className="text-xs text-neutral-300">
                    Lead: <strong className="text-white">{currentTeam.leaderName || 'Team Lead'}</strong> &bull; Phone:{' '}
                    <span className="font-mono font-bold text-emerald-400">
                      {currentTeam.leaderPhone || 'No phone'}
                    </span>
                  </p>
                </div>

                {/* Allotted Room Badge */}
                {currentVenue && (
                  <div className="text-right shrink-0 p-3 rounded-2xl bg-white/[0.05] border border-white/15">
                    <span className="text-[10px] uppercase font-mono text-[#808080] block">Allotted Lab</span>
                    <span className="text-base sm:text-lg font-black text-white font-mono block">
                      {currentVenue.venue}
                    </span>
                    <span className="text-xs font-semibold text-purple-300 block">{currentVenue.floor}</span>
                  </div>
                )}
              </div>

              {/* Message Preview Box */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-semibold text-[#707070] uppercase tracking-wider block">
                  Dispatched WhatsApp Message:
                </span>
                <div className="p-3 rounded-xl bg-black/60 border border-white/10 font-mono text-xs text-neutral-200 whitespace-pre-wrap leading-relaxed select-all">
                  {currentMessage}
                </div>
              </div>
            </div>

            {/* Queue Controls */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevious}
                  disabled={currentIndex === 0}
                  className="border-white/15 bg-white/[0.04] text-neutral-300 hover:text-white"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSkip}
                  className="border-white/15 bg-white/[0.04] text-neutral-300 hover:text-white"
                >
                  Skip
                </Button>
              </div>

              {/* Primary Dispatch & Advance Button */}
              <Button
                onClick={handleDispatchCurrent}
                disabled={!currentPhone}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow-[0_0_20px_rgba(16,185,129,0.35)] py-5 px-6 text-sm"
              >
                <Smartphone className="h-4 w-4 mr-2" />
                Open WhatsApp &amp; Next (Enter ↵)
                <ChevronRight className="h-4 w-4 ml-1.5" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP: FINISHED */}
        {step === 'finished' && (
          <div className="py-12 text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="h-16 w-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto text-emerald-400">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-black text-white">Bulk Dispatch Complete!</h3>
              <p className="text-xs text-[#808080] max-w-sm mx-auto">
                Triggered emails and completed WhatsApp queue for {targetTeams.length} teams.
              </p>
            </div>

            <div className="pt-4 flex items-center justify-center gap-3">
              <Button
                variant="outline"
                onClick={() => setStep('input')}
                className="border-white/15 bg-white/[0.04] text-neutral-300 hover:text-white"
              >
                <RotateCcw className="h-4 w-4 mr-1.5" />
                Dispatch Another Batch
              </Button>
              <Button
                onClick={() => onOpenChange(false)}
                className="bg-white text-black font-bold hover:bg-neutral-200"
              >
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
