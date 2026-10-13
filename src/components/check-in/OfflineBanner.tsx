'use client';
import { WifiOff } from 'lucide-react';

export function OfflineBanner() {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-red-800/40 bg-red-950/30 backdrop-blur-xl px-4 py-2.5 text-xs text-red-300">
      <WifiOff className="h-4 w-4 shrink-0 text-red-400" />
      <p>
        <strong className="font-semibold text-red-200">You are offline.</strong> Attendance writes to Google Sheets are disabled until network connectivity is restored.
      </p>
    </div>
  );
}
