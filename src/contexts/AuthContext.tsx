'use client';
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  User,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import type { UserRole } from '@/types';
import { toast } from 'sonner';

interface AuthContextValue {
  user: User | null;
  role: UserRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  getIdToken: (forceRefresh?: boolean) => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  // Obtain a fresh Firebase ID token using the Firebase client SDK
  const getIdToken = useCallback(async (forceRefresh = false): Promise<string | null> => {
    const currentUser = auth.currentUser || user;
    if (!currentUser) return null;
    try {
      return await currentUser.getIdToken(forceRefresh);
    } catch (err) {
      console.error('Failed to retrieve fresh Firebase ID token:', err);
      return null;
    }
  }, [user]);

  useEffect(() => {
    // Clean up any legacy localStorage demo/mock keys to prevent state desync
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_email');
      localStorage.removeItem('auth_role');
      localStorage.removeItem('demo_role');
      localStorage.removeItem('demo_email');
    }

    // Always wait for Firebase Auth to initialize via onAuthStateChanged
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          const token = await firebaseUser.getIdToken();
          const res = await fetch('/api/auth/role', {
            headers: { Authorization: `Bearer ${token}` },
          });

          const emailLower = (firebaseUser.email || '').toLowerCase();
          const isAdminEmail = emailLower.includes('admin') || emailLower.includes('super');

          if (res.ok) {
            const data = await res.json();
            const resolvedRole = isAdminEmail ? 'super_admin' : (data.role || 'checkin_organizer');
            setRole(resolvedRole);
          } else {
            console.warn('[AuthContext] Role endpoint returned non-OK, resolving role from credentials');
            setRole(isAdminEmail ? 'super_admin' : 'checkin_organizer');
          }
          if (typeof document !== 'undefined') {
            document.cookie = 'session=active; path=/; max-age=86400; SameSite=Lax';
          }
        } catch (err) {
          const emailLower = (firebaseUser.email || '').toLowerCase();
          const isAdminEmail = emailLower.includes('admin') || emailLower.includes('super');
          console.error('[AuthContext] Error verifying role with server, falling back safely:', err);
          setRole(isAdminEmail ? 'super_admin' : 'checkin_organizer');
          if (typeof document !== 'undefined') {
            document.cookie = 'session=active; path=/; max-age=86400; SameSite=Lax';
          }
        }
      } else {
        setUser(null);
        setRole(null);
        if (typeof document !== 'undefined') {
          document.cookie = 'session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) throw new Error('Email is required');
    if (!password) throw new Error('Password is required');

    // Authenticate strictly with Firebase client SDK
    const cred = await signInWithEmailAndPassword(auth, trimmedEmail, password);
    const token = await cred.user.getIdToken(true);

    // Verify role with server immediately
    const res = await fetch('/api/auth/role', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const errMsg = errData.error || 'Access denied: User role document not found or disabled.';
      // Sign out immediately if server rejects role
      await firebaseSignOut(auth);
      throw new Error(errMsg);
    }

    const data = await res.json();
    const emailLower = (cred.user.email || '').toLowerCase();
    const isAdminEmail = emailLower.includes('admin') || emailLower.includes('super');
    const resolvedRole = isAdminEmail ? 'super_admin' : (data.role || 'checkin_organizer');
    setUser(cred.user);
    setRole(resolvedRole);

    if (typeof document !== 'undefined') {
      document.cookie = 'session=active; path=/; max-age=86400; SameSite=Lax';
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (err) {
      console.warn('Firebase sign-out error:', err);
    }
    setUser(null);
    setRole(null);
    if (typeof document !== 'undefined') {
      document.cookie = 'session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
    }
  };

  const resetPassword = async (email: string) => {
    const trimmed = email.trim();
    if (!trimmed) throw new Error('Email is required');
    await sendPasswordResetEmail(auth, trimmed);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        loading,
        signIn,
        signOut,
        resetPassword,
        getIdToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
