'use client';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { AppHeader } from '@/components/layout/AppHeader';
import { TeamsProvider } from '@/contexts/TeamsContext';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);



  const isCheckInPage = pathname === '/admin/check-in';

  return (
    <TeamsProvider>
      <div className="flex h-screen overflow-hidden bg-[#080808] text-[#F0F0F0] antialiased">
        {!isCheckInPage && <AppSidebar />}
        <div className="flex flex-1 flex-col overflow-hidden w-full min-w-0">
          <AppHeader />
          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-[#080808] w-full min-w-0">
            {children}
          </main>
        </div>
      </div>
    </TeamsProvider>
  );
}
