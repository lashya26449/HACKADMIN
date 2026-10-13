import { SearchX, Users, WifiOff, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

type EmptyVariant = 'no-teams' | 'no-match' | 'offline' | 'loading' | 'no-filter-match' | 'duplicate';

interface EmptyStateProps {
  variant: EmptyVariant;
  searchTerm?: string;
  onRetry?: () => void;
}

export function EmptyState({ variant, searchTerm, onRetry }: EmptyStateProps) {
  const configs: Record<EmptyVariant, { icon: React.ElementType; title: string; description: string; color: string }> = {
    'no-teams': { icon: Users, title: 'No teams found', description: 'Registrations will appear after synchronizing with Google Sheets.', color: 'text-[#808080]' },
    'no-match': { icon: SearchX, title: 'No matching registrations', description: searchTerm ? `No team matches "${searchTerm}". Try checking the Team ID or college name.` : 'Enter a Team ID to search.', color: 'text-[#808080]' },
    'offline': { icon: WifiOff, title: 'Offline mode', description: 'You are currently offline. Check-in operations require an active network connection.', color: 'text-red-400' },
    'loading': { icon: RefreshCw, title: 'Connecting to Google Sheets...', description: 'Fetching live registrations from the configured worksheet.', color: 'text-[#B5B5B5]' },
    'no-filter-match': { icon: SearchX, title: 'No teams in this category', description: 'No teams match the selected filter.', color: 'text-[#808080]' },
    'duplicate': { icon: AlertTriangle, title: 'Duplicate Team ID detected', description: `Multiple records share "${searchTerm}". Check-in is blocked for safety.`, color: 'text-amber-400' },
  };

  const config = configs[variant];
  const Icon = config.icon;

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center rounded-xl border border-white/10 bg-white/[0.035] backdrop-blur-xl">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] mb-3">
        <Icon className={`h-5 w-5 ${config.color}`} />
      </div>
      <h3 className="text-sm font-semibold text-[#F0F0F0] mb-1">{config.title}</h3>
      <p className="text-xs text-[#808080] max-w-sm">{config.description}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-4">
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Try again
        </Button>
      )}
    </div>
  );
}
