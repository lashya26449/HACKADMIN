'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { AppHeader } from '@/components/layout/AppHeader';
import { TeamsProvider } from '@/contexts/TeamsContext';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  return (
    <TeamsProvider>
      <div className="flex flex-col min-h-screen w-full bg-[#080808] text-[#F0F0F0] antialiased print:h-auto print:bg-white print:text-black">
        <div className="print:hidden sticky top-0 z-30 w-full">
          <AppHeader />
        </div>
        <main className="flex-1 w-full min-w-0 p-4 md:p-6 lg:p-8 bg-[#080808] print:p-0 print:bg-white">
          {children}
        </main>
      </div>
    </TeamsProvider>
  );
}
