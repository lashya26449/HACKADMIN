'use client';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Download, FileText, CheckCircle2, CreditCard, Printer, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface ExportOptionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canExport?: boolean;
}

export function ExportOptionsDialog({
  open,
  onOpenChange,
  canExport = true,
}: ExportOptionsDialogProps) {
  const [exporting, setExporting] = useState<string | null>(null);
  const router = useRouter();

  const handleExport = async (type: string, filename: string) => {
    if (!canExport) {
      toast.error('You do not have permission to export data.');
      return;
    }

    try {
      setExporting(type);
      const res = await fetch(`/api/export?type=${type}`);
      if (!res.ok) {
        throw new Error('Export request failed');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success(`${filename} exported successfully!`);
      onOpenChange(false);
    } catch {
      toast.error('Failed to generate export file.');
    } finally {
      setExporting(null);
    }
  };

  const handleOpenPrintView = () => {
    onOpenChange(false);
    router.push('/admin/payments');
    setTimeout(() => {
      window.print();
    }, 600);
  };

  const getTodayStr = () => {
    try {
      return new Date().toISOString().split('T')[0];
    } catch {
      return 'export';
    }
  };

  const exportItems = [
    {
      id: 'all',
      title: 'Full Registrations CSV',
      description: 'Complete registration list with Team IDs, leader details, college, and attendance.',
      icon: FileText,
      action: () => handleExport('all', `hackadmin-registrations-${getTodayStr()}.csv`),
    },
    {
      id: 'present',
      title: 'Verified Attendance CSV (Column P)',
      description: 'Only teams marked present at the check-in desk for event entry and kits.',
      icon: CheckCircle2,
      action: () => handleExport('present', `hackadmin-attendance-present-${getTodayStr()}.csv`),
    },
    {
      id: 'payments',
      title: 'Payments & UTR Roster CSV',
      description: 'Transaction references, UTR numbers, and payment verification links.',
      icon: CreditCard,
      action: () => handleExport('payments', `hackadmin-payments-utr-${getTodayStr()}.csv`),
    },
    {
      id: 'print',
      title: 'Printable Official Ledger (A4)',
      description: 'Open the formatted printable desk ledger with organizer verification sign-off blocks.',
      icon: Printer,
      action: handleOpenPrintView,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-[#0c0c0c] border border-white/10 text-[#F0F0F0] p-6 shadow-2xl rounded-2xl">
        <DialogHeader className="pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.08] border border-white/12 text-[#F0F0F0]">
              <Download className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-[#F0F0F0] tracking-tight">
                Export Options
              </DialogTitle>
              <DialogDescription className="text-xs text-[#808080]">
                Shortcut: <kbd className="font-mono bg-white/[0.08] px-1.5 py-0.2 rounded text-white">Alt + E</kbd> &middot; Select output format
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-2.5 my-3">
          {exportItems.map(item => (
            <div
              key={item.id}
              onClick={item.action}
              className="flex items-start gap-3 p-3 rounded-xl border border-white/5 bg-white/[0.025] hover:bg-white/[0.06] hover:border-white/15 cursor-pointer transition-all group"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] border border-white/10 group-hover:bg-white/[0.1] text-white">
                {exporting === item.id ? (
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                ) : (
                  <item.icon className="h-4 w-4 text-[#B5B5B5] group-hover:text-white" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-white group-hover:text-white">
                  {item.title}
                </p>
                <p className="text-[11px] text-[#808080] mt-0.5 leading-snug">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-[#808080]">
          <span>Press <kbd className="font-mono bg-white/[0.08] px-1 py-0.5 rounded text-white">Esc</kbd> to cancel</span>
          <span>Authorized export only</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
