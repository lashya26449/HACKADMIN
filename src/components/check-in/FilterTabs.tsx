'use client';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export type FilterValue = 'all' | 'present' | 'not_present';

interface FilterTabsProps {
  value: FilterValue;
  onChange: (value: FilterValue) => void;
  counts: { all: number; present: number; notPresent: number };
}

export function FilterTabs({ value, onChange, counts }: FilterTabsProps) {
  return (
    <Tabs value={value} onValueChange={v => onChange(v as FilterValue)}>
      <TabsList className="h-10 border border-white/10 bg-white/[0.035] p-1 text-[#808080] backdrop-blur-xl rounded-xl shadow-inner">
        <TabsTrigger
          value="all"
          className="text-xs px-3 py-1.5 rounded-lg transition-all duration-200 data-[state=active]:bg-white/[0.12] data-[state=active]:text-white data-[state=active]:border data-[state=active]:border-white/20 data-[state=active]:shadow-[0_2px_10px_rgba(0,0,0,0.5)]"
        >
          All
          <span className="ml-1.5 text-[10px] bg-white/[0.08] text-[#B5B5B5] rounded-full px-2 py-0.5 font-mono">
            {counts.all}
          </span>
        </TabsTrigger>
        <TabsTrigger
          value="present"
          className="text-xs px-3 py-1.5 rounded-lg transition-all duration-200 data-[state=active]:bg-emerald-950/70 data-[state=active]:text-emerald-300 data-[state=active]:border data-[state=active]:border-emerald-500/50 data-[state=active]:shadow-[0_0_15px_rgba(16,185,129,0.25)]"
        >
          Present
          <span className="ml-1.5 text-[10px] bg-emerald-900/60 text-emerald-300 rounded-full px-2 py-0.5 font-mono border border-emerald-500/20">
            {counts.present}
          </span>
        </TabsTrigger>
        <TabsTrigger
          value="not_present"
          className="text-xs px-3 py-1.5 rounded-lg transition-all duration-200 data-[state=active]:bg-amber-950/60 data-[state=active]:text-amber-300 data-[state=active]:border data-[state=active]:border-amber-500/40 data-[state=active]:shadow-[0_0_15px_rgba(245,158,11,0.2)]"
        >
          Not Present
          <span className="ml-1.5 text-[10px] bg-amber-900/40 text-amber-300 rounded-full px-2 py-0.5 font-mono border border-amber-500/20">
            {counts.notPresent}
          </span>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
