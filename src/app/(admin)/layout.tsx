'use client';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { AppHeader } from '@/components/layout/AppHeader';
import { TeamsProvider } from '@/contexts/TeamsContext';
import { hasPermission } from '@/lib/firebase/auth-helpers';
import { toast } from 'sonner';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace('/login');
      return;
    }

    // Role-based route guard: checkin_organizer has access ONLY to check-in
    if (role === 'checkin_organizer') {
      if (pathname !== '/admin/check-in') {
        toast.error('Access restricted to Check-in Desk only');
        router.replace('/admin/check-in');
      }
    } else if (role === 'readonly_viewer') {
      if (pathname === '/admin/check-in') {
        toast.error('Auditor / Viewer accounts cannot access the Check-in Desk');
        router.replace('/admin/directory');
      }
    }
  }, [user, role, loading, pathname, router]);

  return (
    <TeamsProvider>
      <div className="flex flex-col min-h-screen w-full bg-[#080808] text-[#F0F0F0] antialiased print:h-auto print:bg-white print:text-black">
        <div className="print:hidden sticky top-0 z-50 w-full">
          <AppHeader />
        </div>
        <main className="flex-1 w-full min-w-0 p-4 md:p-6 lg:p-8 bg-[#080808] print:p-0 print:bg-white">
          {children}
        </main>
      </div>
    </TeamsProvider>
  );
}
