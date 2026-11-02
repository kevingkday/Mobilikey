import React, { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Mail, Building2, UserPlus, UserCheck, MapPin, Briefcase } from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { AccessBadge, EntityAvatar } from '../components/ui/AccessBadge';
import { AnnouncementCard } from '../components/announcements/AnnouncementCard';
import { useAuth } from '../lib/auth-context';
import { apiFetch } from '../lib/api';
import { INDUSTRIES } from '../../shared/constants';

export function SearchPage() {
  const { user, openComposeModal } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [q, setQ] = useState(searchParams.get('q') || '');
  const [type, setType] = useState<'all' | 'people' | 'companies' | 'announcements'>(
    (searchParams.get('type') as any) || 'all'
  );
  const [industry, setIndustry] = useState(searchParams.get('industry') || '');
  const [location, setLocation] = useState(searchParams.get('location') || '');

  const [results, setResults] = useState<{
    people: any[];
    companies: any[];
    announcements: any[];
  }>({ people: [], companies: [], announcements: [] });
  const [loading, setLoading] = useState(false);

  const runSearch = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      if (type !== 'all') params.set('type', type);
      if (industry) params.set('industry', industry);
      if (location.trim()) params.set('location', location.trim());

      const data = await apiFetch<{
        people: any[];
        companies: any[];
        announcements: any[];
      }>(`/api/search?${params.toString()}`);
      setResults(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [q, type, industry, location]);

  useEffect(() => {
    runSearch();
  }, [runSearch]);

  async function handleToggleFollowCompany(companyId: string) {
    if (!user) return;
    try {
      await apiFetch('/api/users/follow', {
        method: 'POST',
        body: JSON.stringify({ targetType: 'company', targetId: companyId }),
      });
      await runSearch();
    } catch {
      // ignore
    }
  }

  return (
    <AppShell>
      <div className="space-y-5">
        {/* Search Controls Card */}
        <div className="rounded-md border border-[#E2E8F0] bg-white p-4 sm:p-5 space-y-4">
          <div>
            <h1 className="text-lg font-bold text-[#1F2937]">Search & Professional Discovery</h1>
            <p className="text-xs text-[#64748B]">
              Search professionals, companies, industries, locations, and factual business
              announcements.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
            <div className="sm:col-span-5 relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#64748B]" />
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name, company, title, or keyword..."
                className="w-full rounded border border-[#E2E8F0] pl-9 pr-3 py-2 text-xs text-[#1F2937] focus:border-[#243B53] focus:outline-none"
              />
            </div>

            <div className="sm:col-span-4">
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full rounded border border-[#E2E8F0] bg-white px-3 py-2 text-xs text-[#1F2937] focus:border-[#243B53] focus:outline-none"
              >
                <option value="">All Industries</option>
                {INDUSTRIES.map((ind) => (
                  <option key={ind} value={ind}>
                    {ind}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-3">
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Location (e.g. New York)"
                className="w-full rounded border border-[#E2E8F0] px-3 py-2 text-xs text-[#1F2937] focus:border-[#243B53] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 border-t border-[#E2E8F0] pt-3">
            {(['all', 'people', 'companies', 'announcements'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`rounded px-3 py-1 text-xs font-medium capitalize ${
                  type === t
                    ? 'bg-[#243B53] text-white'
                    : 'bg-[#F7F9FB] text-[#526579] hover:text-[#1F2937]'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="rounded-md border border-[#E2E8F0] bg-white p-8 text-center text-xs text-[#64748B]">
            Searching directory...
          </div>
        ) : (
          <div className="space-y-6">
            {/* People Results */}
            {(type === 'all' || type === 'people') && (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-[#1F2937]">
                    Professionals ({results.people.length})
                  </h2>
                </div>
                {results.people.length === 0 ? (
                  <div className="rounded-md border border-[#E2E8F0] bg-white p-6 text-xs text-[#64748B]">
                    No professionals matched your criteria.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {results.people.map((person) => (
                      <div
                        key={person.id}
                        className="rounded-md border border-[#E2E8F0] bg-white p-4 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <Link to={`/p/${person.slug}`}>
                            <EntityAvatar
                              name={person.name}
                              avatarUrl={person.avatarUrl}
                              size="md"
                            />
                          </Link>
                          <div className="min-w-0">
                            <Link
                              to={`/p/${person.slug}`}
                              className="text-sm font-semibold text-[#1F2937] hover:text-[#243B53] hover:underline block truncate"
                            >
                              {person.name}
                            </Link>
                            <p className="text-xs text-[#526579] truncate">
                              {[person.position, person.companyName]
                                .filter(Boolean)
                                .join(' · ') || person.headline}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[#64748B]">
                              {person.location && (
                                <span className="inline-flex items-center gap-0.5">
                                  <MapPin className="h-3 w-3" />
                                  {person.location}
                                </span>
                              )}
                              {person.industry && <span>· {person.industry}</span>}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <Link
                            to={`/p/${person.slug}`}
                            className="text-[11px] font-medium text-[#287D7D] hover:underline"
                          >
                            View Profile
                          </Link>
                          {user && user.id !== person.id && (
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
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Company Results */}
            {(type === 'all' || type === 'companies') && (
              <section className="space-y-3">
                <h2 className="text-sm font-bold text-[#1F2937]">
                  Companies ({results.companies.length})
                </h2>
                {results.companies.length === 0 ? (
                  <div className="rounded-md border border-[#E2E8F0] bg-white p-6 text-xs text-[#64748B]">
                    No companies matched your criteria.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {results.companies.map((comp) => (
                      <div
                        key={comp.id}
                        className="rounded-md border border-[#E2E8F0] bg-white p-4 flex flex-col justify-between gap-3"
                      >
                        <div className="flex items-start gap-3">
                          <Link to={`/c/${comp.slug}`}>
                            <EntityAvatar
                              name={comp.name}
                              avatarUrl={comp.logoUrl}
                              isCompany
                              size="md"
                            />
                          </Link>
                          <div className="min-w-0 flex-1">
                            <Link
                              to={`/c/${comp.slug}`}
                              className="text-sm font-semibold text-[#1F2937] hover:text-[#243B53] hover:underline block truncate"
                            >
                              {comp.name}
                            </Link>
                            <p className="text-xs text-[#64748B]">
                              {[comp.industry, comp.headquarters].filter(Boolean).join(' · ')}
                            </p>
                            <p className="mt-1.5 line-clamp-2 text-xs text-[#526579]">
                              {comp.description}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 border-t border-[#E2E8F0] pt-3">
                          <AccessBadge
                            level={comp.viewerAccessToCompany ?? 1}
                            prefix="Your Access"
                            size="xs"
                          />
                          <div className="flex items-center gap-1.5">
                            {user && (
                              <button
                                type="button"
                                onClick={() => handleToggleFollowCompany(comp.id)}
                                className="inline-flex items-center gap-1 rounded border border-[#E2E8F0] bg-[#F7F9FB] px-2.5 py-1 text-xs font-medium text-[#526579] hover:text-[#1F2937]"
                              >
                                {comp.isFollowing ? (
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
                            )}
                            {user && (
                              <button
                                type="button"
                                onClick={() =>
                                  openComposeModal({
                                    type: 'company',
                                    id: comp.id,
                                    name: comp.name,
                                    subtitle: comp.industry,
                                    accessLevel: comp.viewerAccessToCompany ?? 1,
                                  })
                                }
                                className="inline-flex items-center gap-1 rounded bg-[#243B53] px-2.5 py-1 text-xs font-medium text-white hover:bg-[#1B2D40]"
                              >
                                <Mail className="h-3 w-3" />
                                <span>Message</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Announcements Results */}
            {(type === 'all' || type === 'announcements') && (
              <section className="space-y-3">
                <h2 className="text-sm font-bold text-[#1F2937]">
                  Announcements ({results.announcements.length})
                </h2>
                {results.announcements.length === 0 ? (
                  <div className="rounded-md border border-[#E2E8F0] bg-white p-6 text-xs text-[#64748B]">
                    No announcements matched your criteria.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {results.announcements.map((ann) => (
                      <AnnouncementCard key={ann.id} announcement={ann} />
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

