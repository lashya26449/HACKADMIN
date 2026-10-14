'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Users, FileText, CreditCard, Activity, LogOut, Menu, X, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export function AppSidebar() {
  const pathname = usePathname();
  const { user, role, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Signed out successfully');
    } catch {
      toast.error('Sign out failed');
    }
  };

  const navItems = [
    {
      href: '/admin/check-in',
      label: 'Attendance Check-in',
      icon: Users,
      description: 'Mark team attendance',
    },
    {
      href: '/admin/payments',
      label: 'Payments & UTR',
      icon: CreditCard,
      description: 'UTR and payment proof',
    },
    {
      href: '/admin/directory',
      label: 'Registration Directory',
      icon: FileText,
      description: 'Participant registry',
    },
    {
      href: '/admin/id-cards',
      label: 'College ID Cards',
      icon: Shield,
      description: 'Verify uploaded IDs',
    },
    {
      href: '/admin/activity',
      label: 'Governance & Audit',
      icon: Activity,
      description: 'Audit trail and verification',
    },
  ];

  const SidebarContent = () => (
    <div className="flex h-full flex-col bg-[#101010] text-[#F0F0F0] border-r border-white/10">
      {/* Brand Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.06] text-[#F0F0F0]">
            <Shield className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-tight text-[#F0F0F0] truncate">HackAdmin</p>
            <p className="text-[10px] text-[#808080] truncate">Event Attendance Management</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
        <div className="px-2 pb-1.5">
          <p className="text-[10px] font-semibold tracking-wider text-[#808080] uppercase">
            Workspace
          </p>
        </div>
        {navItems.map(item => {
          const active = pathname === item.href || (item.href !== '/admin/check-in' && pathname.startsWith(item.href + '/'));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-all',
                active
                  ? 'bg-white/[0.08] text-[#F0F0F0] border border-white/10 font-semibold'
                  : 'text-[#808080] hover:bg-white/[0.04] hover:text-[#B5B5B5]'
              )}
            >
              <item.icon className={cn('h-3.5 w-3.5 shrink-0', active ? 'text-[#F0F0F0]' : 'text-[#808080]')} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Session */}
      <div className="border-t border-white/10 p-3 bg-white/[0.02]">
        <div className="flex items-center gap-2 px-2 py-1.5 mb-2 rounded-lg border border-white/10 bg-white/[0.03]">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-[10px] font-semibold text-[#F0F0F0]">
            {user?.email ? user.email[0].toUpperCase() : 'A'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-[#F0F0F0] truncate">{user?.email || 'Administrator'}</p>
            <p className="text-[10px] text-[#808080] capitalize">
              {role ? role.replace('_', ' ') : 'Administrator'}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          className="w-full justify-start gap-2 text-[#808080] hover:text-red-400 hover:bg-red-950/20 h-7 text-xs border border-transparent hover:border-red-900/30"
        >
          <LogOut className="h-3 w-3" />
          Sign out
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 shrink-0 flex-col">
        <SidebarContent />
      </aside>

      {/* Mobile trigger */}
      <button
        className="md:hidden fixed top-3 left-3 z-40 flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-[#101010] text-[#F0F0F0] shadow-lg cursor-pointer"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation"
      >
        <Menu className="h-4 w-4" />
      </button>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm md:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-60 bg-[#101010] shadow-2xl md:hidden">
            <button
              className="absolute top-3.5 right-3.5 flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-[#808080] hover:text-[#F0F0F0] cursor-pointer"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <SidebarContent />
          </aside>
        </>
      )}
    </>
  );
}
