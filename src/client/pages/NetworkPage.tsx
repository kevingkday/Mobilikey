import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Users, Building2, Mail, UserPlus, UserCheck } from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { AccessBadge, EntityAvatar } from '../components/ui/AccessBadge';
import { useAuth } from '../lib/auth-context';
import { apiFetch } from '../lib/api';

export function NetworkPage() {
  const { openComposeModal } = useAuth();
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

  const followedUserIds = new Set(data.followedUsers.map((u) => u.id));

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="rounded-md border border-[#E2E8F0] bg-white p-4">
          <h1 className="text-lg font-bold text-[#1F2937]">My Network & Directory</h1>
          <p className="text-xs text-[#64748B]">
            Manage followed companies and professionals, and view your directional messaging access
            across the network.
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

        {loading ? (
          <div className="rounded-md border border-[#E2E8F0] bg-white p-8 text-center text-xs text-[#64748B]">
            Loading network...
          </div>
        ) : tab === 'directory' ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {data.directoryUsers.map((person) => {
              const isFollowing = followedUserIds.has(person.id);
              return (
                <div
                  key={person.id}
                  className="rounded-md border border-[#E2E8F0] bg-white p-4 flex flex-col justify-between gap-3"
                >
                  <div className="flex items-start gap-3">
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
                      <p className="text-[11px] text-[#64748B] mt-0.5">
                        {[person.location, person.industry].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E2E8F0] pt-3">
                    <AccessBadge
                      level={person.viewerAccessToUser ?? 1}
                      prefix="Your Access"
                      size="xs"
                    />
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleToggleFollow('user', person.id)}
                        className="inline-flex items-center gap-1 rounded border border-[#E2E8F0] bg-[#F7F9FB] px-2.5 py-1 text-xs font-medium text-[#526579] hover:text-[#1F2937]"
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
                            accessLevel: person.viewerAccessToUser ?? 1,
                          })
                        }
                        className="inline-flex items-center gap-1 rounded bg-[#243B53] px-2.5 py-1 text-xs font-medium text-white hover:bg-[#1B2D40]"
                      >
                        <Mail className="h-3 w-3" />
                        <span>Message</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
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
                  <button
                    type="button"
                    onClick={() => handleToggleFollow('company', comp.id)}
                    className="shrink-0 rounded border border-[#E2E8F0] px-2.5 py-1 text-xs text-[#526579] hover:bg-[#F7F9FB]"
                  >
                    Unfollow
                  </button>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {(tab === 'following' ? data.followedUsers : data.followers).map((u) => (
              <div
                key={u.id}
                className="rounded-md border border-[#E2E8F0] bg-white p-4 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <EntityAvatar name={u.name} avatarUrl={u.avatarUrl} size="md" />
                  <div className="min-w-0">
                    <Link
                      to={`/p/${u.slug}`}
                      className="text-sm font-semibold text-[#1F2937] hover:underline block truncate"
                    >
                      {u.name}
                    </Link>
                    <p className="text-xs text-[#64748B] truncate">
                      {[u.position, u.companyName].filter(Boolean).join(' · ') || u.headline}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    openComposeModal({
                      type: 'user',
                      id: u.id,
                      name: u.name,
                      subtitle: u.headline,
                    })
                  }
                  className="shrink-0 rounded bg-[#243B53] px-2.5 py-1 text-xs font-medium text-white"
                >
                  Message
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

