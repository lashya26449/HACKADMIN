'use client';
import { useRef } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onNavigateDown?: () => void;
  onNavigateUp?: () => void;
}

export function SearchBar({
  value,
  onChange,
  onSubmit,
  placeholder = 'Search by Team ID (e.g. LAK-001), team name, leader, college...',
  inputRef: externalInputRef,
  onNavigateDown,
  onNavigateUp,
}: SearchBarProps) {
  const internalInputRef = useRef<HTMLInputElement>(null);
  const activeInputRef = externalInputRef || internalInputRef;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      onNavigateDown?.();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      onNavigateUp?.();
    } else if (e.key === 'Enter') {
      onSubmit?.();
    } else if (e.key === 'Escape') {
      if (value) {
        e.preventDefault();
        onChange('');
      }
    }
  };

  return (
    <div className="relative w-full">
      <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#808080] pointer-events-none" />
      <Input
        ref={activeInputRef as React.RefObject<HTMLInputElement>}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full pl-10 pr-16 h-11 font-mono text-xs sm:text-sm bg-white/[0.045] border-white/12 text-[#F0F0F0] placeholder:text-[#808080] focus-visible:border-white/35 backdrop-blur-xl shadow-lg rounded-xl"
        aria-label="Search registrations"
        autoComplete="off"
        spellCheck={false}
      />
      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
        {!value && (
          <kbd
            className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-semibold rounded border border-white/10 bg-white/[0.06] text-[#808080] select-none"
            title="Press '/' to focus search"
          >
            /
          </kbd>
        )}
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="text-[#808080] hover:text-[#F0F0F0] transition-colors cursor-pointer p-1 rounded-md"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
