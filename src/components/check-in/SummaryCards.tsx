'use client';
import { Users, CheckCircle2, XCircle, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { attendancePercentage } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

interface SummaryCardsProps {
  total: number;
  present: number;
  loading?: boolean;
}

export function SummaryCards({ total, present, loading }: SummaryCardsProps) {
  const notPresent = total - present;
  const pct = attendancePercentage(present, total);

  const cards = [
    {
      label: 'Total Teams',
      value: total,
      icon: Users,
      color: 'text-[#F0F0F0]',
      bg: 'bg-white/[0.05] border border-white/10',
      subtext: 'Registered entries',
    },
    {
      label: 'Present',
      value: present,
      icon: CheckCircle2,
      color: 'text-emerald-400',
      bg: 'bg-emerald-950/40 border border-emerald-800/40',
      subtext: 'Confirmed in Sheet',
    },
    {
      label: 'Not Present',
      value: notPresent,
      icon: XCircle,
      color: 'text-[#808080]',
      bg: 'bg-white/[0.04] border border-white/10',
      subtext: 'Pending check-in',
    },
    {
      label: 'Attendance Rate',
      value: `${pct}%`,
      icon: TrendingUp,
      color: 'text-[#F0F0F0]',
      bg: 'bg-white/[0.05] border border-white/10',
      subtext: `${present} of ${total} verified`,
    },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map(card => (
          <Card key={card.label} className="bg-white/[0.045] border border-white/10 text-[#F0F0F0] backdrop-blur-xl shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-[#808080]">{card.label}</p>
                  {loading ? (
                    <div className="mt-1 h-7 w-12 animate-pulse rounded bg-white/[0.08]" />
                  ) : (
                    <p className="mt-0.5 text-2xl font-bold tracking-tight text-[#F0F0F0] font-mono">{card.value}</p>
                  )}
                  <p className="text-[10px] text-[#808080] mt-0.5">{card.subtext}</p>
                </div>
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${card.bg}`}>
                  <card.icon className={`h-4.5 w-4.5 ${card.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {total > 0 && (
        <div className="flex items-center gap-3 px-1">
          <Progress value={pct} className="h-1.5 flex-1 bg-white/[0.06]" />
          <span className="text-xs font-mono text-[#808080] tabular-nums">{pct}% confirmed</span>
        </div>
      )}
    </div>
  );
}
