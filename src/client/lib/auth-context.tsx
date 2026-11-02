import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { AuthenticatedUser, EntityType } from '../../shared/types';
import { apiFetch, setApiCsrfToken } from './api';

export interface ComposeRecipientTarget {
  type: EntityType;
  id: string;
  name: string;
  subtitle?: string;
  accessLevel?: number;
}

export interface UnreadSummary {
  personalUnread: {
    direct: number;
    recognized: number;
    general: number;
    totalPriority: number;
    totalAll: number;
  };
  unreadNotificationsCount: number;
}

interface AuthContextValue {
  user: AuthenticatedUser | null;
  loading: boolean;
  unreadSummary: UnreadSummary;
  refreshUser: () => Promise<void>;
  refreshUnread: () => Promise<void>;
  setUserDirect: (u: AuthenticatedUser | null) => void;
  logout: () => Promise<void>;
  composeTarget: ComposeRecipientTarget | null;
  openComposeModal: (target: ComposeRecipientTarget) => void;
  closeComposeModal: () => void;
  reportTarget: {
    targetType: 'announcement' | 'message' | 'user' | 'company';
    targetId: string;
    targetLabel: string;
  } | null;
  openReportModal: (target: {
    targetType: 'announcement' | 'message' | 'user' | 'company';
    targetId: string;
    targetLabel: string;
  }) => void;
  closeReportModal: () => void;
}

const defaultUnread: UnreadSummary = {
  personalUnread: { direct: 0, recognized: 0, general: 0, totalPriority: 0, totalAll: 0 },
  unreadNotificationsCount: 0,
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreadSummary, setUnreadSummary] = useState<UnreadSummary>(defaultUnread);
  const [composeTarget, setComposeTarget] = useState<ComposeRecipientTarget | null>(null);
  const [reportTarget, setReportTarget] = useState<{
    targetType: 'announcement' | 'message' | 'user' | 'company';
    targetId: string;
    targetLabel: string;
  } | null>(null);

  const setUserDirect = useCallback((u: AuthenticatedUser | null) => {
    setUser(u);
    setApiCsrfToken(u?.csrfToken || '');
  }, []);

  const refreshUnread = useCallback(async () => {
    try {
      const data = await apiFetch<UnreadSummary>('/api/messages/unread-summary');
      setUnreadSummary(data);
    } catch {
      // ignore polling errors
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const data = await apiFetch<{ user: AuthenticatedUser | null }>('/api/auth/me');
      setUserDirect(data.user);
      if (data.user) {
        await refreshUnread();
      } else {
        setUnreadSummary(defaultUnread);
      }
    } catch {
      setUserDirect(null);
    } finally {
      setLoading(false);
    }
  }, [setUserDirect, refreshUnread]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  // Lightweight polling for near-real-time message & notification badges
  useEffect(() => {
    if (!user) return;
    const timer = setInterval(() => {
      refreshUnread();
    }, 12000);
    return () => clearInterval(timer);
  }, [user, refreshUnread]);

  const logout = useCallback(async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } finally {
      setUserDirect(null);
      setUnreadSummary(defaultUnread);
    }
  }, [setUserDirect]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        unreadSummary,
        refreshUser,
        refreshUnread,
        setUserDirect,
        logout,
        composeTarget,
        openComposeModal: (target) => setComposeTarget(target),
        closeComposeModal: () => setComposeTarget(null),
        reportTarget,
        openReportModal: (target) => setReportTarget(target),
        closeReportModal: () => setReportTarget(null),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

