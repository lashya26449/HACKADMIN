'use client';
import { CheckCircle2, XCircle, Clock } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { AuditEntry } from '@/types';
import { formatRelative } from '@/lib/utils';

interface RecentActivityProps {
  entries: AuditEntry[];
}

export function RecentActivity({ entries }: RecentActivityProps) {
  if (entries.length === 0) {
    return (
      <Card className="border-white/10 bg-white/[0.045] backdrop-blur-xl shadow-lg">
        <CardHeader className="pb-3 border-b border-white/5">
          <CardTitle className="text-sm font-semibold text-[#F0F0F0] flex items-center justify-between">
            <span>Recent Check-ins</span>
            <span className="text-[11px] font-normal text-[#808080]">Event log</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Clock className="h-6 w-6 text-[#808080] mb-2" />
            <p className="text-xs text-[#808080] font-medium">No check-ins recorded yet</p>
            <p className="text-[11px] text-[#808080] mt-0.5">Checked-in teams will appear here in real time</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-white/10 bg-white/[0.045] backdrop-blur-xl shadow-lg">
      <CardHeader className="pb-3 border-b border-white/5">
        <CardTitle className="text-sm font-semibold text-[#F0F0F0] flex items-center justify-between">
          <span>Recent Check-ins</span>
          <span className="text-[11px] font-mono text-[#B5B5B5] bg-white/[0.05] border border-white/10 px-2 py-0.5 rounded">
            {entries.length} logged
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-72">
          <div className="space-y-0 divide-y divide-white/5">
            {entries.map(entry => (
              <div key={entry.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors">
                {entry.status === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-[#F0F0F0]">{entry.teamId}</span>
                    {entry.teamName && (
                      <span className="text-xs text-[#B5B5B5] truncate">{entry.teamName}</span>
                    )}
                  </div>
                  <p className="text-[10px] text-[#808080] mt-0.5">
                    by {entry.organizerEmail || 'Administrator'} &middot; {formatRelative(entry.timestamp)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
