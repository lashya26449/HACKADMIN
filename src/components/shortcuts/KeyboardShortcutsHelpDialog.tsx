'use client';
import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { isMacPlatform } from '@/hooks/useKeyboardShortcuts';
import { Keyboard, ShieldAlert, CheckCircle2, Zap } from 'lucide-react';

interface KeyboardShortcutsHelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcutsHelpDialog({
  open,
  onOpenChange,
}: KeyboardShortcutsHelpDialogProps) {
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(isMacPlatform());
  }, []);

  const modKey = isMac ? '⌘' : 'Ctrl';
  const altKey = isMac ? '⌥' : 'Alt';

  const shortcuts = [
    {
      category: 'Search & Navigation',
      items: [
        {
          keys: ['/'],
          label: 'Focus Search',
          description: 'Focus primary team search input and preserve current query.',
        },
        {
          keys: [modKey, 'K'],
          label: 'Quick Search Modal',
          description: 'Open universal quick-search palette from any page.',
        },
        {
          keys: ['↑', '↓'],
          label: 'Navigate Results',
          description: 'Cycle highlighted selection up or down through visible team cards.',
        },
        {
          keys: ['Enter'],
          label: 'Open Selected Team',
          description: 'Open confirmation or inspection details for the currently highlighted team.',
        },
        {
          keys: ['Esc'],
          label: 'Close or Clear',
          description: 'Priority: Close topmost modal → Clear search text → Clear selection.',
        },
      ],
    },
    {
      category: 'Attendance & Filtering',
      items: [
        {
          keys: [altKey, 'P'],
          label: 'Mark Selected Present',
          description: 'Opens confirmation dialog to record attendance in Column P. Requires confirmation.',
          highlight: true,
        },
        {
          keys: [altKey, 'U'],
          label: 'Filter Unmarked Teams',
          description: 'Switches filter view to show teams whose attendance is not yet marked.',
        },
        {
          keys: [altKey, 'A'],
          label: 'Show All Teams',
          description: 'Resets attendance filter to show all registered teams.',
        },
        {
          keys: [altKey, 'R'],
          label: 'Refresh Team Data',
          description: 'Synchronizes latest attendance and team data live from Google Sheets.',
        },
        {
          keys: [altKey, 'Q'],
          label: 'Toggle Quick Scan Mode',
          description: 'Activates rapid barcode/QR scanner input mode for check-in desks.',
        },
        {
          keys: [altKey, 'E'],
          label: 'Export Options',
          description: 'Opens export modal with CSV and printable ledger options.',
        },
        {
          keys: ['?'],
          label: 'Keyboard Shortcut Help',
          description: 'Opens this accessible reference panel from any screen.',
        },
      ],
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-[#0c0c0c] border border-white/10 text-[#F0F0F0] p-6 shadow-2xl rounded-2xl">
        <DialogHeader className="pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.08] border border-white/12 text-[#F0F0F0]">
              <Keyboard className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-[#F0F0F0] tracking-tight">
                Keyboard Shortcuts Reference
              </DialogTitle>
              <DialogDescription className="text-xs text-[#808080]">
                Optimized for rapid desk check-in at LAKSHYA 2026 &middot; Platform: {isMac ? 'macOS (⌘ / ⌥)' : 'Windows / Linux (Ctrl / Alt)'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 my-2 max-h-[60vh] overflow-y-auto pr-1">
          {shortcuts.map(group => (
            <div key={group.category} className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#808080] px-1">
                {group.category}
              </h3>
              <div className="grid grid-cols-1 gap-1.5">
                {group.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-white/5 bg-white/[0.025] hover:bg-white/[0.045] transition-colors gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-[#F0F0F0] flex items-center gap-1.5">
                        {item.label}
                        {item.highlight && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-medium bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
                            <Zap className="h-2.5 w-2.5" /> Core Action
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-[#808080] mt-0.5 leading-snug">
                        {item.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {item.keys.map((k, kIdx) => (
                        <kbd
                          key={kIdx}
                          className="px-2 py-1 text-xs font-mono font-semibold rounded border border-white/15 bg-white/[0.08] text-[#F0F0F0] shadow-sm min-w-[24px] text-center"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Safety & Compliance Notice */}
          <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-3 flex items-start gap-2.5 text-xs text-emerald-300">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-emerald-200">Attendance Safety Guardrail</p>
              <p className="text-[11px] text-emerald-300/80 mt-0.5 leading-relaxed">
                Pressing <kbd className="font-mono font-semibold px-1 py-0.5 bg-emerald-900/40 rounded border border-emerald-700/40 text-emerald-200">{altKey} + P</kbd> opens the explicit confirmation dialog. Attendance is confirmed only after the server verifies the Google Sheets Column P write.
              </p>
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-[#808080]">
          <span>Press <kbd className="font-mono bg-white/[0.08] px-1.5 py-0.5 rounded border border-white/10 text-white">Esc</kbd> anytime to dismiss</span>
          <span>HackAdmin LAKSHYA 2026</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
