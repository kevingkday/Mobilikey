import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Mail,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Send,
  Archive,
  Sliders,
  Flag,
  Building2,
  User,
  CheckCircle2,
  ArrowUpRight,
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { AccessBadge, EntityAvatar, formatRelativeTime } from '../components/ui/AccessBadge';
import { useAuth } from '../lib/auth-context';
import { apiFetch } from '../lib/api';
import {
  ACCESS_LEVELS,
  ACCESS_LEVEL_LABELS,
  type AccessLevelValue,
} from '../../shared/constants';
import type {
  AccessPermissionRecord,
  ConversationSummary,
  EntityType,
  InboxFolder,
  MessageItem,
} from '../../shared/types';

export function MessagesPage() {
  const { user, refreshUnread, openReportModal } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialInboxType = (searchParams.get('inboxType') as EntityType) || 'user';
  const initialInboxId = searchParams.get('inboxId') || user?.id || '';
  const initialConversationId = searchParams.get('conversationId') || '';

  const [inboxType, setInboxType] = useState<EntityType>(initialInboxType);
  const [inboxId, setInboxId] = useState<string>(initialInboxId || user?.id || '');
  const [activeTab, setActiveTab] = useState<InboxFolder | 'permissions'>('direct');

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [unreadCounts, setUnreadCounts] = useState({ general: 0, recognized: 0, direct: 0 });
  const [folderCounts, setFolderCounts] = useState<Record<InboxFolder, number>>({
    general: 0,
    recognized: 0,
    direct: 0,
    sent: 0,
    archived: 0,
  });

  const [selectedConvId, setSelectedConvId] = useState<string>(initialConversationId);
  const [activeThread, setActiveThread] = useState<{
    conversation: ConversationSummary;
    messages: MessageItem[];
  } | null>(null);

  const [permissionsList, setPermissionsList] = useState<AccessPermissionRecord[]>([]);
  const [replyBody, setReplyBody] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [updatingAccess, setUpdatingAccess] = useState(false);
  const [statusBanner, setStatusBanner] = useState('');
  const [error, setError] = useState('');
  const [loadingList, setLoadingList] = useState(false);

  const adminCompanies = (user?.managedCompanies || []).filter(
    (mc) => mc.role === 'owner' || mc.role === 'admin'
  );

  const loadInboxList = useCallback(
    async (folder: InboxFolder) => {
      if (!user) return;
      setLoadingList(true);
      try {
        const targetId = inboxType === 'company' ? inboxId : user.id;
        const data = await apiFetch<{
          conversations: ConversationSummary[];
          unreadCounts: { general: number; recognized: number; direct: number };
          folderCounts: Record<InboxFolder, number>;
        }>(
          `/api/messages/inbox?inboxType=${inboxType}&inboxId=${encodeURIComponent(
            targetId
          )}&folder=${folder}`
        );
        setConversations(data.conversations);
        setUnreadCounts(data.unreadCounts);
        setFolderCounts(data.folderCounts);
      } catch (err: any) {
        setError(err.message || 'Unable to load inbox');
      } finally {
        setLoadingList(false);
      }
    },
    [user, inboxType, inboxId]
  );

  const loadPermissionsList = useCallback(async () => {
    if (!user) return;
    try {
      const targetId = inboxType === 'company' ? inboxId : user.id;
      const data = await apiFetch<{ permissions: AccessPermissionRecord[] }>(
        `/api/messages/access?recipientType=${inboxType}&recipientId=${encodeURIComponent(
          targetId
        )}`
      );
      setPermissionsList(data.permissions);
    } catch (err: any) {
      setError(err.message || 'Unable to load access list');
    }
  }, [user, inboxType, inboxId]);

  const loadConversationThread = useCallback(
    async (convId: string) => {
      if (!convId || !user) {
        setActiveThread(null);
        return;
      }
      try {
        const targetId = inboxType === 'company' ? inboxId : user.id;
        const data = await apiFetch<{
          conversation: ConversationSummary;
          messages: MessageItem[];
        }>(
          `/api/messages/conversations/${convId}?inboxType=${inboxType}&inboxId=${encodeURIComponent(
            targetId
          )}`
        );
        setActiveThread(data);
        await refreshUnread();
      } catch (err: any) {
        setError(err.message || 'Unable to load conversation thread');
      }
    },
    [user, inboxType, inboxId, refreshUnread]
  );

  useEffect(() => {
    if (!user) return;
    if (activeTab === 'permissions') {
      loadPermissionsList();
    } else {
      loadInboxList(activeTab);
    }
  }, [user, activeTab, inboxType, inboxId, loadInboxList, loadPermissionsList]);

  useEffect(() => {
    if (selectedConvId) {
      loadConversationThread(selectedConvId);
    } else {
      setActiveThread(null);
    }
  }, [selectedConvId, loadConversationThread]);

  // Auto-select first conversation when switching folders if none selected
  useEffect(() => {
    if (
      activeTab !== 'permissions' &&
      !selectedConvId &&
      conversations.length > 0 &&
      !initialConversationId
    ) {
      setSelectedConvId(conversations[0].id);
    }
  }, [conversations, activeTab, selectedConvId, initialConversationId]);

  function handleSwitchInbox(type: EntityType, id: string) {
    setInboxType(type);
    setInboxId(id);
    setSelectedConvId('');
    setActiveThread(null);
    setSearchParams({ inboxType: type, inboxId: id });
  }

  async function handleSendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!activeThread || !replyBody.trim()) return;
    setSendingReply(true);
    setError('');

    try {
      await apiFetch(`/api/messages/conversations/${activeThread.conversation.id}/reply`, {
        method: 'POST',
        body: JSON.stringify({
          body: replyBody,
          sendAsCompanyId: inboxType === 'company' ? inboxId : null,
        }),
      });
      setReplyBody('');
      await loadConversationThread(activeThread.conversation.id);
      if (activeTab !== 'permissions') {
        await loadInboxList(activeTab);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send reply');
    } finally {
      setSendingReply(false);
    }
  }

  async function handleChangeAccessLevel(
    senderUserId: string,
    senderName: string,
    newLevel: AccessLevelValue
  ) {
    if (!user) return;
    setUpdatingAccess(true);
    setError('');
    setStatusBanner('');

    const targetRecipientId = inboxType === 'company' ? inboxId : user.id;

    try {
      await apiFetch('/api/messages/access', {
        method: 'POST',
        body: JSON.stringify({
          senderUserId,
          recipientType: inboxType,
          recipientId: targetRecipientId,
          accessLevel: newLevel,
        }),
      });

      setStatusBanner(
        `Updated ${senderName}’s access to ${ACCESS_LEVEL_LABELS[newLevel]}. Changes took effect immediately.`
      );

      if (activeThread && activeThread.conversation.counterparty.id === senderUserId) {
        await loadConversationThread(activeThread.conversation.id);
      }

      if (activeTab === 'permissions') {
        await loadPermissionsList();
      } else {
        // Switch active tab to match the new level if promoted/downgraded from current view
        const nextFolder: InboxFolder =
          newLevel === 3
            ? 'direct'
            : newLevel === 2
            ? 'recognized'
            : newLevel === 1
            ? 'general'
            : activeTab;
        setActiveTab(nextFolder);
        await loadInboxList(nextFolder);
      }
    } catch (err: any) {
      setError(err.message || 'Could not update access level');
    } finally {
      setUpdatingAccess(false);
    }
  }

  async function handleToggleArchive(convId: string, currentlyArchived: boolean) {
    if (!user) return;
    try {
      await apiFetch(`/api/messages/conversations/${convId}/archive`, {
        method: 'POST',
        body: JSON.stringify({
          archived: !currentlyArchived,
          inboxType,
          inboxId: inboxType === 'company' ? inboxId : user.id,
        }),
      });
      setSelectedConvId('');
      setActiveThread(null);
      if (activeTab !== 'permissions') {
        await loadInboxList(activeTab);
      }
    } catch (err: any) {
      setError(err.message || 'Could not update archive status');
    }
  }

  const folderTabs: Array<{
    id: InboxFolder;
    label: string;
    unread?: number;
    count: number;
  }> = [
    {
      id: 'direct',
      label: 'Direct (Level 3)',
      unread: unreadCounts.direct,
      count: folderCounts.direct,
    },
    {
      id: 'recognized',
      label: 'Recognized (Level 2)',
      unread: unreadCounts.recognized,
      count: folderCounts.recognized,
    },
    {
      id: 'general',
      label: 'General Requests (Level 1)',
      unread: unreadCounts.general,
      count: folderCounts.general,
    },
    {
      id: 'sent',
      label: 'Sent',
      count: folderCounts.sent,
    },
    {
      id: 'archived',
      label: 'Archived',
      count: folderCounts.archived,
    },
  ];

  const activeInboxLabel =
    inboxType === 'company'
      ? adminCompanies.find((c) => c.id === inboxId)?.name || 'Company Inbox'
      : `${user?.name} (Personal Inbox)`;

  return (
    <AppShell>
      <div className="space-y-4">
        {/* Header & Inbox Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-md border border-[#E2E8F0] bg-white p-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-[#1F2937]">Messages & Access Control</h1>
              <span className="rounded border border-[#E2E8F0] bg-[#F7F9FB] px-2 py-0.5 text-xs font-medium text-[#243B53]">
                {activeInboxLabel}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-[#64748B]">
              Access is directional and recipient-controlled. Replying never automatically promotes
              a sender.
            </p>
          </div>

          {adminCompanies.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-[#526579]">Active Inbox:</label>
              <select
                value={`${inboxType}:${inboxType === 'company' ? inboxId : user?.id}`}
                onChange={(e) => {
                  const [t, id] = e.target.value.split(':');
                  handleSwitchInbox(t as EntityType, id);
                }}
                className="rounded border border-[#E2E8F0] bg-[#F7F9FB] px-3 py-1.5 text-xs font-medium text-[#1F2937] focus:border-[#243B53] focus:outline-none"
              >
                <option value={`user:${user?.id}`}>Personal Inbox ({user?.name})</option>
                {adminCompanies.map((mc) => (
                  <option key={mc.id} value={`company:${mc.id}`}>
                    Company Inbox: {mc.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {statusBanner && (
          <div className="flex items-center justify-between rounded border border-[#287D7D]/30 bg-[#287D7D]/10 px-4 py-2.5 text-xs font-medium text-[#1D5E5E]">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#287D7D]" />
              {statusBanner}
            </span>
            <button
              type="button"
              onClick={() => setStatusBanner('')}
              className="text-xs underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {error && (
          <div className="rounded border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700">
            {error}
          </div>
        )}

        {/* Inbox Folder Navigation Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] bg-white px-3 pt-2 rounded-t-md border-x border-t">
          <div className="flex flex-wrap items-center gap-1">
            {folderTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    setSelectedConvId('');
                  }}
                  className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-medium transition-colors ${
                    isActive
                      ? 'border-[#243B53] text-[#243B53] font-semibold'
                      : 'border-transparent text-[#64748B] hover:text-[#1F2937]'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className="rounded bg-[#F7F9FB] px-1.5 py-0.5 text-[10px] text-[#526579]">
                    {tab.count}
                  </span>
                  {tab.unread && tab.unread > 0 ? (
                    <span className="rounded-full bg-[#287D7D] px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {tab.unread} new
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setActiveTab('permissions')}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-medium ${
              activeTab === 'permissions'
                ? 'border-[#287D7D] text-[#287D7D] font-semibold'
                : 'border-transparent text-[#526579] hover:text-[#1F2937]'
            }`}
          >
            <Sliders className="h-3.5 w-3.5" />
            <span>Access List & Blocked</span>
          </button>
        </div>

        {/* Access Permissions Directory View */}
        {activeTab === 'permissions' ? (
          <div className="rounded-b-md border border-t-0 border-[#E2E8F0] bg-white p-5">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-[#1F2937]">
                Configured Access Permissions for {activeInboxLabel}
              </h2>
              <p className="text-xs text-[#64748B]">
                Every professional not listed below holds default Level 1 (General Access). Changes
                made here take effect immediately.
              </p>
            </div>

            {permissionsList.length === 0 ? (
              <div className="rounded border border-[#E2E8F0] bg-[#F7F9FB] p-8 text-center text-xs text-[#64748B]">
                No custom Level 2, Level 3, or Blocked permissions configured yet for this inbox.
                You can promote or block contacts directly inside any conversation.
              </div>
            ) : (
              <div className="divide-y divide-[#E2E8F0] border border-[#E2E8F0] rounded">
                {permissionsList.map((perm) => (
                  <div
                    key={perm.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 hover:bg-[#F7F9FB]"
                  >
                    <div className="flex items-center gap-3">
                      <EntityAvatar
                        name={perm.senderName}
                        avatarUrl={perm.senderAvatarUrl}
                        size="md"
                      />
                      <div>
                        <Link
                          to={`/p/${perm.senderSlug}`}
                          className="text-sm font-semibold text-[#1F2937] hover:text-[#243B53] hover:underline"
                        >
                          {perm.senderName}
                        </Link>
                        <p className="text-xs text-[#64748B]">
                          {perm.senderHeadline || perm.senderCompany || 'Professional'}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <AccessBadge level={perm.accessLevel} />
                      <select
                        disabled={updatingAccess}
                        value={perm.accessLevel}
                        onChange={(e) =>
                          handleChangeAccessLevel(
                            perm.senderUserId,
                            perm.senderName,
                            Number(e.target.value) as AccessLevelValue
                          )
                        }
                        className="rounded border border-[#E2E8F0] bg-white px-2.5 py-1 text-xs font-medium text-[#1F2937] focus:border-[#243B53] focus:outline-none"
                      >
                        <option value={3}>Level 3 — Direct Access</option>
                        <option value={2}>Level 2 — Recognized Access</option>
                        <option value={1}>Level 1 — General Access</option>
                        <option value={0}>Blocked (No Access)</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Split Pane Inbox List + Conversation Thread */
          <div className="grid grid-cols-1 lg:grid-cols-12 rounded-b-md border border-t-0 border-[#E2E8F0] bg-white min-h-[560px]">
            {/* Left Column: Conversation List */}
            <div className="lg:col-span-5 border-b lg:border-b-0 lg:border-r border-[#E2E8F0] divide-y divide-[#E2E8F0]">
              {loadingList ? (
                <div className="p-6 text-center text-xs text-[#64748B]">
                  Loading conversations...
                </div>
              ) : conversations.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <Mail className="mx-auto h-6 w-6 text-[#94A3B8]" />
                  <p className="text-xs font-medium text-[#526579]">
                    No conversations in this folder.
                  </p>
                  <p className="text-[11px] text-[#64748B]">
                    {activeTab === 'direct' &&
                      'Contacts granted Level 3 Direct Access appear here.'}
                    {activeTab === 'recognized' &&
                      'Contacts granted Level 2 Recognized Access appear here.'}
                    {activeTab === 'general' &&
                      'Initial Level 1 outreach requests appear here.'}
                  </p>
                </div>
              ) : (
                conversations.map((conv) => {
                  const isSelected = conv.id === selectedConvId;
                  return (
                    <button
                      key={conv.id}
                      type="button"
                      onClick={() => setSelectedConvId(conv.id)}
                      className={`w-full text-left p-3.5 transition-colors hover:bg-[#F7F9FB] ${
                        isSelected ? 'bg-[#F7F9FB] border-l-4 border-l-[#243B53]' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <EntityAvatar
                            name={conv.counterparty.name}
                            avatarUrl={conv.counterparty.avatarUrl}
                            isCompany={conv.counterparty.type === 'company'}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`truncate text-xs ${
                                  conv.unreadCount > 0
                                    ? 'font-bold text-[#1F2937]'
                                    : 'font-semibold text-[#1F2937]'
                                }`}
                              >
                                {conv.counterparty.name}
                              </span>
                              {conv.unreadCount > 0 && (
                                <span className="h-2 w-2 rounded-full bg-[#287D7D] shrink-0" />
                              )}
                            </div>
                            <p className="truncate text-[11px] text-[#64748B]">
                              {conv.counterparty.subtitle}
                            </p>
                          </div>
                        </div>
                        <span className="shrink-0 text-[10px] text-[#64748B]">
                          {formatRelativeTime(conv.lastMessageAt)}
                        </span>
                      </div>

                      {conv.subject && (
                        <p className="mt-1.5 truncate text-xs font-medium text-[#243B53]">
                          {conv.subject}
                        </p>
                      )}

                      <p className="mt-1 line-clamp-2 text-xs text-[#526579]">
                        {conv.lastMessagePreview}
                      </p>

                      <div className="mt-2 flex items-center justify-between gap-2">
                        <AccessBadge level={conv.counterpartyAccessToInbox} size="xs" />
                        {conv.unreadCount > 0 && (
                          <span className="text-[10px] font-semibold text-[#287D7D]">
                            {conv.unreadCount} unread
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Right Column: Active Conversation Thread & In-Conversation Access Controls */}
            <div className="lg:col-span-7 flex flex-col justify-between">
              {!activeThread ? (
                <div className="flex flex-1 flex-col items-center justify-center p-10 text-center text-xs text-[#64748B]">
                  <Mail className="h-8 w-8 text-[#CBD5E1] mb-2" />
                  <p>Select a conversation to view messages and manage recipient access.</p>
                </div>
              ) : (
                <>
                  {/* Thread Header + Access Control Bar */}
                  <div className="border-b border-[#E2E8F0] p-4 space-y-3 bg-[#F7F9FB]/60">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <EntityAvatar
                          name={activeThread.conversation.counterparty.name}
                          avatarUrl={activeThread.conversation.counterparty.avatarUrl}
                          isCompany={activeThread.conversation.counterparty.type === 'company'}
                          size="md"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <Link
                              to={
                                activeThread.conversation.counterparty.type === 'company'
                                  ? `/c/${activeThread.conversation.counterparty.slug}`
                                  : `/p/${activeThread.conversation.counterparty.slug}`
                              }
                              className="text-sm font-bold text-[#1F2937] hover:text-[#243B53] hover:underline flex items-center gap-1"
                            >
                              <span>{activeThread.conversation.counterparty.name}</span>
                              <ArrowUpRight className="h-3.5 w-3.5 text-[#64748B]" />
                            </Link>
                          </div>
                          <p className="text-xs text-[#64748B]">
                            {activeThread.conversation.counterparty.subtitle}
                          </p>
                          {activeThread.conversation.subject && (
                            <p className="mt-1 text-xs font-semibold text-[#243B53]">
                              Subject: {activeThread.conversation.subject}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            handleToggleArchive(
                              activeThread.conversation.id,
                              activeThread.conversation.isArchived
                            )
                          }
                          className="inline-flex items-center gap-1 rounded border border-[#E2E8F0] bg-white px-2.5 py-1 text-xs font-medium text-[#526579] hover:bg-[#F7F9FB]"
                        >
                          <Archive className="h-3.5 w-3.5" />
                          <span>
                            {activeThread.conversation.isArchived ? 'Unarchive' : 'Archive'}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            openReportModal({
                              targetType: activeThread.conversation.counterparty.type,
                              targetId: activeThread.conversation.counterparty.id,
                              targetLabel: activeThread.conversation.counterparty.name,
                            })
                          }
                          title="Report Abuse"
                          className="rounded border border-[#E2E8F0] bg-white p-1.5 text-[#64748B] hover:text-[#1F2937]"
                        >
                          <Flag className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* In-Conversation Directional Access Controls (for User counterparties) */}
                    {activeThread.conversation.counterparty.type === 'user' && (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-[#E2E8F0] bg-white px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-medium text-[#526579]">
                            {activeThread.conversation.counterparty.name}’s Access to You:
                          </span>
                          <AccessBadge
                            level={activeThread.conversation.counterpartyAccessToInbox}
                          />
                          {inboxType === 'user' && (
                            <span className="text-[11px] text-[#64748B]">
                              (Your Access to Them: Level{' '}
                              {activeThread.conversation.inboxAccessToCounterparty})
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          {activeThread.conversation.counterpartyAccessToInbox < 2 && (
                            <button
                              type="button"
                              disabled={updatingAccess}
                              onClick={() =>
                                handleChangeAccessLevel(
                                  activeThread.conversation.counterparty.id,
                                  activeThread.conversation.counterparty.name,
                                  ACCESS_LEVELS.RECOGNIZED
                                )
                              }
                              className="rounded border border-[#243B53]/30 bg-[#243B53]/8 px-2.5 py-1 text-xs font-medium text-[#243B53] hover:bg-[#243B53] hover:text-white"
                            >
                              Grant Level 2 Access
                            </button>
                          )}

                          {activeThread.conversation.counterpartyAccessToInbox < 3 && (
                            <button
                              type="button"
                              disabled={updatingAccess}
                              onClick={() =>
                                handleChangeAccessLevel(
                                  activeThread.conversation.counterparty.id,
                                  activeThread.conversation.counterparty.name,
                                  ACCESS_LEVELS.DIRECT
                                )
                              }
                              className="rounded bg-[#287D7D] px-2.5 py-1 text-xs font-medium text-white hover:bg-[#1F6363]"
                            >
                              Grant Level 3 Access
                            </button>
                          )}

                          <select
                            aria-label="Change Access Level"
                            disabled={updatingAccess}
                            value={activeThread.conversation.counterpartyAccessToInbox}
                            onChange={(e) =>
                              handleChangeAccessLevel(
                                activeThread.conversation.counterparty.id,
                                activeThread.conversation.counterparty.name,
                                Number(e.target.value) as AccessLevelValue
                              )
                            }
                            className="rounded border border-[#E2E8F0] bg-[#F7F9FB] px-2 py-1 text-xs font-medium text-[#1F2937]"
                          >
                            <option value={1}>Level 1 — General</option>
                            <option value={2}>Level 2 — Recognized</option>
                            <option value={3}>Level 3 — Direct</option>
                            <option value={0}>Block Contact</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Message Thread History */}
                  <div className="flex-1 space-y-4 overflow-y-auto p-4 max-h-[380px]">
                    {activeThread.messages.map((msg) => {
                      const isMe = msg.senderUserId === user?.id;
                      return (
                        <div
                          key={msg.id}
                          className={`rounded-md border p-3.5 ${
                            isMe
                              ? 'border-[#CBD5E1] bg-[#F7F9FB] ml-4'
                              : 'border-[#E2E8F0] bg-white mr-4'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-[#1F2937]">
                                {msg.sentAsCompanyName
                                  ? `${msg.sentAsCompanyName} (${msg.senderName})`
                                  : msg.senderName}
                              </span>
                              {msg.sentAsCompanyName && (
                                <span className="rounded bg-[#243B53] px-1.5 py-0.5 text-[10px] font-medium text-white">
                                  Official Company Reply
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-[#64748B]">
                              {formatRelativeTime(msg.createdAt)}
                            </span>
                          </div>
                          <p className="whitespace-pre-line text-sm text-[#1F2937] leading-relaxed">
                            {msg.body}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Reply Composer */}
                  <form
                    onSubmit={handleSendReply}
                    className="border-t border-[#E2E8F0] bg-[#F7F9FB] p-4 space-y-2.5"
                  >
                    <textarea
                      rows={3}
                      required
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      placeholder={
                        inboxType === 'company'
                          ? `Reply officially on behalf of ${activeInboxLabel}...`
                          : 'Write a reply...'
                      }
                      className="w-full rounded border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#1F2937] focus:border-[#243B53] focus:outline-none"
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] text-[#64748B]">
                        Replying does not change {activeThread.conversation.counterparty.name}’s
                        access level.
                      </span>
                      <button
                        type="submit"
                        disabled={sendingReply || !replyBody.trim()}
                        className="inline-flex items-center gap-1.5 rounded bg-[#243B53] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#1B2D40] disabled:opacity-50"
                      >
                        <Send className="h-3.5 w-3.5" />
                        <span>{sendingReply ? 'Sending...' : 'Reply'}</span>
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

