import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCheck, ShieldCheck, Mail, UserPlus } from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { formatRelativeTime } from '../components/ui/AccessBadge';
import { useAuth } from '../lib/auth-context';
import { apiFetch } from '../lib/api';
import type { NotificationItem } from '../../shared/types';

export function NotificationsPage() {
  const { refreshUnread } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ notifications: NotificationItem[] }>('/api/notifications');
      setNotifications(res.notifications || []);
      await refreshUnread();
    } finally {
      setLoading(false);
    }
  }, [refreshUnread]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  async function handleMarkAllRead() {
    await apiFetch('/api/notifications/read-all', { method: 'POST' });
    await loadNotifications();
  }

  async function handleMarkOneRead(id: string) {
    await apiFetch(`/api/notifications/${id}/read`, { method: 'POST' });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, readAt: Date.now() } : n))
    );
    await refreshUnread();
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-md border border-[#E2E8F0] bg-white p-4">
          <div>
            <h1 className="text-lg font-bold text-[#1F2937]">Notifications</h1>
            <p className="text-xs text-[#64748B]">
              Factual updates on messaging access changes, direct messages, and followers.
            </p>
          </div>
          {notifications.some((n) => !n.readAt) && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="inline-flex items-center gap-1.5 rounded border border-[#E2E8F0] bg-[#F7F9FB] px-3 py-1.5 text-xs font-medium text-[#243B53] hover:bg-white"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              <span>Mark All Read</span>
            </button>
          )}
        </div>

        {loading ? (
          <div className="rounded-md border border-[#E2E8F0] bg-white p-8 text-center text-xs text-[#64748B]">
            Loading notifications...
          </div>
        ) : notifications.length === 0 ? (
          <div className="rounded-md border border-[#E2E8F0] bg-white p-10 text-center space-y-2">
            <Bell className="mx-auto h-6 w-6 text-[#94A3B8]" />
            <p className="text-xs font-medium text-[#526579]">No notifications yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#E2E8F0] rounded-md border border-[#E2E8F0] bg-white">
            {notifications.map((n) => {
              const isUnread = !n.readAt;
              return (
                <div
                  key={n.id}
                  onClick={() => isUnread && handleMarkOneRead(n.id)}
                  className={`flex items-start justify-between gap-3 p-4 transition-colors ${
                    isUnread ? 'bg-[#F7F9FB]' : 'bg-white'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded border border-[#E2E8F0] bg-white text-[#243B53]">
                      {n.type === 'access_promoted' || n.type === 'access_downgraded' ? (
                        <ShieldCheck className="h-3.5 w-3.5 text-[#287D7D]" />
                      ) : n.type === 'new_message' ? (
                        <Mail className="h-3.5 w-3.5" />
                      ) : (
                        <UserPlus className="h-3.5 w-3.5" />
                      )}
                    </div>
                    <div>
                      <p
                        className={`text-xs ${
                          isUnread ? 'font-bold text-[#1F2937]' : 'font-medium text-[#1F2937]'
                        }`}
                      >
                        {n.title}
                      </p>
                      {n.body && <p className="mt-0.5 text-xs text-[#526579]">{n.body}</p>}
                      {n.referenceType === 'conversation' && n.referenceId && (
                        <Link
                          to={`/messages?conversationId=${n.referenceId}`}
                          className="mt-1 inline-block text-xs font-medium text-[#287D7D] hover:underline"
                        >
                          Open Conversation →
                        </Link>
                      )}
                    </div>
                  </div>

                  <span className="shrink-0 text-[11px] text-[#64748B]">
                    {formatRelativeTime(n.createdAt)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}

