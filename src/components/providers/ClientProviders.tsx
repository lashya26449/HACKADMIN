'use client';
import React from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import { Toaster } from 'sonner';

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      {children}
      <Toaster position="top-right" richColors closeButton />
    </AuthProvider>
  );
}
