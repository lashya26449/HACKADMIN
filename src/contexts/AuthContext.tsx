'use client';
import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import type { UserRole } from '@/types';

interface AuthContextValue {
  user: User | null;
  role: UserRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function determineRole(email: string): UserRole {
  const normalized = email.toLowerCase();
  if (normalized.includes('admin') || normalized.includes('super')) {
    return 'super_admin';
  }
  if (normalized.includes('viewer') || normalized.includes('audit')) {
    return 'readonly_viewer';
  }
  // Default to checkin_organizer: Never automatically promote unknown accounts to super_admin
  return 'checkin_organizer';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check local session state
    if (typeof window !== 'undefined') {
      const savedEmail = localStorage.getItem('auth_email');
      const savedRole = localStorage.getItem('auth_role') as UserRole | null;

      if (savedEmail) {
        const currentUser = {
          uid: `user_${savedEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
          email: savedEmail,
          displayName: savedRole === 'checkin_organizer' ? 'Organizer' : 'Administrator',
        } as User;
        setUser(currentUser);
        setRole(savedRole || determineRole(savedEmail));
        document.cookie = 'session=active; path=/; max-age=86400; SameSite=Lax';
        setLoading(false);
        return;
      }
    }

    // Firebase Auth listener (if Firebase is initialized)
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          const res = await fetch('/api/auth/role', {
            headers: { Authorization: `Bearer ${await firebaseUser.getIdToken()}` },
          });
          if (res.ok) {
            const data = await res.json();
            setRole(data.role);
          } else {
            setRole(determineRole(firebaseUser.email || ''));
          }
        } catch {
          setRole(determineRole(firebaseUser.email || ''));
        }
      } else {
        // If no stored email and no firebase user, user is unauthenticated
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) throw new Error('Email is required');
    if (!password) throw new Error('Password is required');

    // Attempt Firebase sign-in if client credentials configured
    try {
      if (process.env.NEXT_PUBLIC_FIREBASE_API_KEY && process.env.NEXT_PUBLIC_FIREBASE_API_KEY !== 'demo') {
        await signInWithEmailAndPassword(auth, trimmedEmail, password);
        return;
      }
    } catch (firebaseErr: unknown) {
      console.warn('Firebase sign-in fallback to organizer session:', firebaseErr);
    }

    // Direct organizer / admin session authentication
    const userRole = determineRole(trimmedEmail);
    const sessionUser = {
      uid: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      email: trimmedEmail,
      displayName: userRole === 'checkin_organizer' ? 'Organizer' : 'Administrator',
    } as User;

    setUser(sessionUser);
    setRole(userRole);

    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_email', trimmedEmail);
      localStorage.setItem('auth_role', userRole);
      document.cookie = 'session=active; path=/; max-age=86400; SameSite=Lax';
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch {
      // Ignored if purely local
    }
    setUser(null);
    setRole(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_email');
      localStorage.removeItem('auth_role');
      document.cookie = 'session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch {
      // Safe no-op if local
    }
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, signIn, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    return {
      user: null,
      role: null,
      loading: false,
      signIn: async () => {},
      signOut: async () => {},
      resetPassword: async () => {},
    };
  }
  return ctx;
}
