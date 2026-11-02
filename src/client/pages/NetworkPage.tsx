import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Mail, UserPlus, UserCheck, CheckCircle2 } from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { AccessBadge, EntityAvatar } from '../components/ui/AccessBadge';
import { useAuth } from '../lib/auth-context';
import { apiFetch } from '../lib/api';
import { ACCESS_LEVEL_LABELS, type AccessLevelValue } from '../../shared/constants';

export function NetworkPage() {
  const { user, openComposeModal } = useAuth();
  const [data, setData] = useState<{
    followedCompanies: any[];
    followedUsers: any[];
    followers: any[];
    directoryUsers: any[];
  }>({
    followedCompanies: [],
    followedUsers: [],
    followers: [],
    directoryUsers: [],
  });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'directory' | 'companies' | 'following' | 'followers'>(
    'directory'
  );
  const [statusBanner, setStatusBanner] = useState('');

  const loadNetwork = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/users/network/overview');
      setData(res);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNetwork();
  }, [loadNetwork]);

  async function handleToggleFollow(targetType: 'user' | 'company', targetId: string) {
    try {
      await apiFetch('/api/users/follow', {
        method: 'POST',
        body: JSON.stringify({ targetType, targetId }),
      });
      await loadNetwork();
    } catch {
      // ignore
    }
  }

  async function handleSetUserAccessToMyInbox(
    senderUserId: string,
    senderName: string,
    newLevel: AccessLevelValue
  ) {
    if (!user) return;
    setStatusBanner('');
    try {
      await apiFetch('/api/messages/access', {
        method: 'POST',
        body: JSON.stringify({
          senderUserId,
          recipientType: 'user',
          recipientId: user.id,
          accessLevel: newLevel,
        }),
      });
      setStatusBanner(
        `Updated ${senderName}’s access to your inbox to ${ACCESS_LEVEL_LABELS[newLevel]}.`
      );
      await loadNetwork();
    } catch {
      // ignore
    }
  }

  const followedUserIds = new Set(data.followedUsers.map((u) => u.id));

  function renderPersonCard(person: any) {
    const isFollowing = followedUserIds.has(person.id);
    const theirAccessToMe = (person.userAccessToViewer ?? 1) as AccessLevelValue;
    const myAccessToThem = (person.viewerAccessToUser ?? 1) as AccessLevelValue;

    return (
      <div
        key={person.id}
        className="rounded-md border border-[#E2E8F0] bg-white p-4 flex flex-col justify-between gap-3"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <Link to={`/p/${person.slug}`}>
              <EntityAvatar name={person.name} avatarUrl={person.avatarUrl} size="md" />
            </Link>
            <div className="min-w-0 flex-1">
              <Link
                to={`/p/${person.slug}`}
                className="text-sm font-semibold text-[#1F2937] hover:text-[#243B53] hover:underline block truncate"
              >
                {person.name}
              </Link>
              <p className="text-xs text-[#526579] truncate">
                {[person.position, person.companyName].filter(Boolean).join(' · ') ||
                  person.headline}
              </p>
              {person.location && (
                <p className="text-[11px] text-[#64748B] mt-0.5">
                  {[person.location, person.industry].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => handleToggleFollow('user', person.id)}
              className={`inline-flex items-center gap-1 rounded border px-2.5 py-1 text-xs font-medium ${
                isFollowing
                  ? 'border-[#287D7D]/30 bg-[#287D7D]/10 text-[#1D5E5E]'
                  : 'border-[#E2E8F0] bg-[#F7F9FB] text-[#526579] hover:text-[#1F2937]'
              }`}
            >
              {isFollowing ? (
                <>
                  <UserCheck className="h-3 w-3 text-[#287D7D]" />
                  <span>Following</span>
                </>
              ) : (
                <>
                  <UserPlus className="h-3 w-3" />
                  <span>Follow</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() =>
                openComposeModal({
                  type: 'user',
                  id: person.id,
                  name: person.name,
                  subtitle: [person.position, person.companyName]
                    .filter(Boolean)
                    .join(' · '),
                  accessLevel: myAccessToThem,
                })
              }
              className="inline-flex items-center gap-1 rounded bg-[#243B53] px-2.5 py-1 text-xs font-medium text-white hover:bg-[#1B2D40]"
            >
              <Mail className="h-3 w-3" />
              <span>Message</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E2E8F0] pt-3">
          <AccessBadge level={myAccessToThem} prefix="Your Access" size="xs" />

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-[#64748B]">Their Access to You:</span>
            <select
              aria-label={`Set ${person.name} access to your inbox`}
              value={theirAccessToMe}
              onChange={(e) =>
                handleSetUserAccessToMyInbox(
                  person.id,
                  person.name,
                  Number(e.target.value) as AccessLevelValue
                )
              }
              className="rounded border border-[#E2E8F0] bg-[#F7F9FB] px-2 py-0.5 text-[11px] font-medium text-[#1F2937] focus:border-[#243B53] focus:outline-none"
            >
              <option value={1}>Level 1 · General</option>
              <option value={2}>Level 2 · Recognized</option>
              <option value={3}>Level 3 · Direct</option>
              <option value={0}>Blocked</option>
            </select>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="rounded-md border border-[#E2E8F0] bg-white p-4">
          <h1 className="text-lg font-bold text-[#1F2937]">My Network & Directory</h1>
          <p className="text-xs text-[#64748B]">
            Manage followed companies and professionals, and configure directional messaging access
            for your followers and contacts.
          </p>

          <div className="mt-4 flex flex-wrap gap-2 border-t border-[#E2E8F0] pt-3">
            <button
              type="button"
              onClick={() => setTab('directory')}
              className={`rounded px-3 py-1.5 text-xs font-medium ${
                tab === 'directory'
                  ? 'bg-[#243B53] text-white'
                  : 'bg-[#F7F9FB] text-[#526579] hover:text-[#1F2937]'
              }`}
            >
              Professional Directory ({data.directoryUsers.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('companies')}
              className={`rounded px-3 py-1.5 text-xs font-medium ${
                tab === 'companies'
                  ? 'bg-[#243B53] text-white'
                  : 'bg-[#F7F9FB] text-[#526579] hover:text-[#1F2937]'
              }`}
            >
              Followed Companies ({data.followedCompanies.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('following')}
              className={`rounded px-3 py-1.5 text-xs font-medium ${
                tab === 'following'
                  ? 'bg-[#243B53] text-white'
                  : 'bg-[#F7F9FB] text-[#526579] hover:text-[#1F2937]'
              }`}
            >
              Followed Professionals ({data.followedUsers.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('followers')}
              className={`rounded px-3 py-1.5 text-xs font-medium ${
                tab === 'followers'
                  ? 'bg-[#243B53] text-white'
                  : 'bg-[#F7F9FB] text-[#526579] hover:text-[#1F2937]'
              }`}
            >
              Followers ({data.followers.length})
            </button>
          </div>
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

        {loading ? (
          <div className="rounded-md border border-[#E2E8F0] bg-white p-8 text-center text-xs text-[#64748B]">
            Loading network...
          </div>
        ) : tab === 'directory' ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {data.directoryUsers.map(renderPersonCard)}
          </div>
        ) : tab === 'companies' ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {data.followedCompanies.length === 0 ? (
              <div className="col-span-2 rounded-md border border-[#E2E8F0] bg-white p-8 text-center text-xs text-[#64748B]">
                You are not following any companies yet. Explore companies in the Directory.
              </div>
            ) : (
              data.followedCompanies.map((comp) => (
                <div
                  key={comp.id}
                  className="rounded-md border border-[#E2E8F0] bg-white p-4 flex items-start justify-between gap-3"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <EntityAvatar name={comp.name} avatarUrl={comp.logoUrl} isCompany size="md" />
                    <div className="min-w-0">
                      <Link
                        to={`/c/${comp.slug}`}
                        className="text-sm font-semibold text-[#1F2937] hover:underline block truncate"
                      >
                        {comp.name}
                      </Link>
                      <p className="text-xs text-[#64748B]">
                        {comp.industry} · {comp.headquarters}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs text-[#526579]">{comp.description}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleFollow('company', comp.id)}
                      className="rounded border border-[#E2E8F0] px-2.5 py-1 text-xs text-[#526579] hover:bg-[#F7F9FB]"
                    >
                      Unfollow
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        openComposeModal({
                          type: 'company',
                          id: comp.id,
                          name: comp.name,
                          subtitle: comp.industry,
                        })
                      }
                      className="inline-flex items-center gap-1 rounded bg-[#243B53] px-2.5 py-1 text-xs font-medium text-white"
                    >
                      <Mail className="h-3 w-3" />
                      <span>Message</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {(tab === 'following' ? data.followedUsers : data.followers).length === 0 ? (
              <div className="col-span-2 rounded-md border border-[#E2E8F0] bg-white p-8 text-center text-xs text-[#64748B]">
                {tab === 'following'
                  ? 'You are not following any professionals yet.'
                  : 'No followers yet.'}
              </div>
            ) : (
              (tab === 'following' ? data.followedUsers : data.followers).map(renderPersonCard)
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
