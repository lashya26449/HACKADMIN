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
      <TabsList className="h-9 border border-white/10 bg-white/[0.04] p-1 text-[#808080] backdrop-blur-md">
        <TabsTrigger
          value="all"
          className="text-xs px-2.5 data-[state=active]:bg-white/[0.08] data-[state=active]:text-[#F0F0F0] data-[state=active]:border data-[state=active]:border-white/10"
        >
          All
          <span className="ml-1.5 text-[10px] bg-white/[0.08] text-[#B5B5B5] rounded-full px-1.5 py-0.2 font-mono">
            {counts.all}
          </span>
        </TabsTrigger>
        <TabsTrigger
          value="present"
          className="text-xs px-2.5 data-[state=active]:bg-emerald-950/60 data-[state=active]:text-emerald-300 data-[state=active]:border data-[state=active]:border-emerald-800/40"
        >
          Present
          <span className="ml-1.5 text-[10px] bg-emerald-900/40 text-emerald-300 rounded-full px-1.5 py-0.2 font-mono">
            {counts.present}
          </span>
        </TabsTrigger>
        <TabsTrigger
          value="not_present"
          className="text-xs px-2.5 data-[state=active]:bg-white/[0.08] data-[state=active]:text-[#F0F0F0] data-[state=active]:border data-[state=active]:border-white/10"
        >
          Not Present
          <span className="ml-1.5 text-[10px] bg-white/[0.08] text-[#808080] rounded-full px-1.5 py-0.2 font-mono">
            {counts.notPresent}
          </span>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
