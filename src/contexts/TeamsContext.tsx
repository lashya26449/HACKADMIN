'use client';
import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import type { Team, SyncHealth } from '@/types';
import { toast } from 'sonner';

interface TeamsContextValue {
  teams: Team[];
  loading: boolean;
  syncHealth: SyncHealth | null;
  lastSync: string | null;
  syncInProgress: boolean;
  error: string | null;
  sheetsConnected: boolean;
  liveSheetTitle: string | null;
  refreshTeams: (silent?: boolean) => Promise<boolean>;
  syncNow: () => Promise<void>;
  updateTeamLocally: (teamId: string, updates: Partial<Team>) => void;
  isOnline: boolean;
}

const TeamsContext = createContext<TeamsContextValue | null>(null);

export function TeamsProvider({ children }: { children: React.ReactNode }) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncInProgress, setSyncInProgress] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncHealth, setSyncHealth] = useState<SyncHealth | null>(null);
  const [liveSheetTitle, setLiveSheetTitle] = useState<string | null>(null);
  const [sheetsConnected, setSheetsConnected] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inFlightRef = useRef(false);
  const hasLoadedOnce = useRef(false);
  const locallyConfirmedPresentIds = useRef<Set<string>>(new Set());

  // Monitor browser network online/offline state
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Fetch live registrations strictly from Google Sheets
  // Safe: Non-destructive, deduplicated, preserves in-memory cache on network glitch,
  // and prevents stale cache results from reverting confirmed attendance updates.
  const refreshTeams = useCallback(async (silent = false, force = false): Promise<boolean> => {
    if (inFlightRef.current) {
      return false;
    }
    inFlightRef.current = true;
    setSyncInProgress(true);

    // Only set loading to true on very first load before any teams exist
    if (!hasLoadedOnce.current) {
      setLoading(true);
    }

    try {
      const url = force ? '/api/teams?force=true' : '/api/teams';
      const res = await fetch(url, {
        headers: { 'Cache-Control': 'no-cache' },
      });
      const json = await res.json();

      if (json.success && json.data) {
        const incomingTeams: Team[] = json.data.teams ?? [];
        // Preserve previous teams if empty glitch occurs, otherwise update
        setTeams(prev => {
          if (incomingTeams.length === 0 && prev.length > 0) {
            return prev;
          }
          // Reconcile: Never allow a stale background refresh to revert a confirmed check-in
          return incomingTeams.map(incoming => {
            if (locallyConfirmedPresentIds.current.has(incoming.teamId.toLowerCase())) {
              return {
                ...incoming,
                isPresent: true,
                attendanceValue: 'P',
              };
            }
            return incoming;
          });
        });
        setLastSync(json.data.lastSync ?? new Date().toISOString());
        setLiveSheetTitle(json.data.worksheetTitle ?? 'Form Responses 1');
        setSheetsConnected(true);
        setError(null);
        hasLoadedOnce.current = true;
        return true;
      } else {
        setSheetsConnected(false);
        const errMsg = json.error ?? 'Could not connect to Google Sheet.';
        setError(errMsg);
        // CRITICAL: NEVER clear teams on sync failure
        return false;
      }
    } catch (err) {
      setSheetsConnected(false);
      const errMsg = err instanceof Error ? err.message : 'Failed to connect to Google Sheet';
      setError(errMsg);
      // CRITICAL: NEVER clear teams on sync failure
      return false;
    } finally {
      inFlightRef.current = false;
      setSyncInProgress(false);
      setLoading(false);
      hasLoadedOnce.current = true;
    }
  }, []);

  // Initial load
  useEffect(() => {
    refreshTeams();
  }, [refreshTeams]);

  // Periodic polling every 30 seconds (non-destructive)
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      if (typeof navigator !== 'undefined' && navigator.onLine && !inFlightRef.current) {
        refreshTeams(true);
      }
    }, 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [refreshTeams]);

  // Manual sync trigger (forces fresh read from Google Sheets)
  const syncNow = useCallback(async () => {
    if (!isOnline) {
      toast.error('Cannot sync while offline');
      return;
    }
    const success = await refreshTeams(false, true);
    if (success) {
      toast.success('Synchronized with live Google Sheet');
    } else {
      toast.error('Sync failed: Could not connect to Google Sheet');
    }
  }, [isOnline, refreshTeams]);

  const updateTeamLocally = useCallback((teamId: string, updates: Partial<Team>) => {
    if (updates.isPresent) {
      locallyConfirmedPresentIds.current.add(teamId.toLowerCase());
    }
    setTeams(prev => prev.map(t => t.teamId.toLowerCase() === teamId.toLowerCase() ? { ...t, ...updates } : t));
  }, []);

  return (
    <TeamsContext.Provider
      value={{
        teams,
        loading,
        syncHealth,
        lastSync,
        syncInProgress,
        error,
        sheetsConnected,
        liveSheetTitle,
        refreshTeams,
        syncNow,
        updateTeamLocally,
        isOnline,
      }}
    >
      {children}
    </TeamsContext.Provider>
  );
}

export function useTeams() {
  const ctx = useContext(TeamsContext);
  if (!ctx) {
    return {
      teams: [],
      loading: false,
      syncHealth: null,
      lastSync: null,
      syncInProgress: false,
      error: null,
      sheetsConnected: false,
      liveSheetTitle: null,
      refreshTeams: async () => false,
      syncNow: async () => {},
      updateTeamLocally: () => {},
      isOnline: true,
    };
  }
  return ctx;
}
