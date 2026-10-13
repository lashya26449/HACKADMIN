import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ClientProviders } from '@/components/providers/ClientProviders';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'HackAdmin — Event Attendance Management',
  description: 'Private administration dashboard for event registration and attendance management',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-[#080808] text-[#F0F0F0] antialiased min-h-screen selection:bg-white/20 selection:text-white`}>
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}
