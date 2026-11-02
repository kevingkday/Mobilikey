import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Newspaper, Building2, Filter, Send } from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { AnnouncementCard } from '../components/announcements/AnnouncementCard';
import { useAuth } from '../lib/auth-context';
import { apiFetch } from '../lib/api';
import { ANNOUNCEMENT_CATEGORIES } from '../../shared/constants';
import type { AnnouncementItem } from '../../shared/types';

export function FeedPage({ publicOnly = false }: { publicOnly?: boolean }) {
  const { user } = useAuth();
  const [feedMode, setFeedMode] = useState<'public' | 'following'>('public');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Composer state for users with managed companies
  const [showComposer, setShowComposer] = useState(false);
  const [companyId, setCompanyId] = useState(user?.managedCompanies[0]?.id || '');
  const [categoryId, setCategoryId] = useState<string>(ANNOUNCEMENT_CATEGORIES[0].id);
  const [body, setBody] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [composerError, setComposerError] = useState('');

  useEffect(() => {
    if (user?.managedCompanies.length && !companyId) {
      setCompanyId(user.managedCompanies[0].id);
    }
  }, [user, companyId]);

  const loadAnnouncements = useCallback(async () => {
    setLoading(true);
    try {
      const mode = publicOnly || !user ? 'public' : feedMode;
      const params = new URLSearchParams({ feed: mode });
      if (selectedCategory) params.set('category', selectedCategory);
      const res = await apiFetch<{ announcements: AnnouncementItem[] }>(
        `/api/announcements?${params.toString()}`
      );
      setAnnouncements(res.announcements || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [publicOnly, user, feedMode, selectedCategory]);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  async function handlePublish(e: React.FormEvent) {
    e.preventDefault();
    setComposerError('');
    setPublishing(true);

    try {
      await apiFetch('/api/announcements', {
        method: 'POST',
        body: JSON.stringify({
          companyId,
          categoryId,
          body,
          externalUrl: externalUrl.trim() || null,
        }),
      });
      setBody('');
      setExternalUrl('');
      setShowComposer(false);
      await loadAnnouncements();
    } catch (err: any) {
      setComposerError(err.message || 'Could not publish announcement');
    } finally {
      setPublishing(false);
    }
  }

  async function handleDeleteAnnouncement(id: string) {
    try {
      await apiFetch(`/api/announcements/${id}`, { method: 'DELETE' });
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    } catch {
      // ignore
    }
  }

  const rightSidebar = (
    <div className="space-y-4">
      <div className="rounded-md border border-[#E2E8F0] bg-white p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[#243B53]">
          Editorial Standards
        </h3>
        <p className="mt-2 text-xs leading-relaxed text-[#526579]">
          Mobilikey announcements are strictly factual business updates limited to 500 characters.
        </p>
        <ul className="mt-2.5 space-y-1.5 text-xs text-[#64748B]">
          <li>• Product launches & milestones</li>
          <li>• Funding, contracts & partnerships</li>
          <li>• Executive & technical hiring</li>
          <li>• No opinion essays or engagement bait</li>
          <li>• Maximum 2 hashtags permitted</li>
        </ul>
      </div>

      {user && user.managedCompanies.length === 0 && (
        <div className="rounded-md border border-[#E2E8F0] bg-white p-4">
          <h3 className="text-xs font-semibold text-[#1F2937]">Publish Company News</h3>
          <p className="mt-1 text-xs text-[#64748B]">
            Create a company profile for your organization or solo practice to publish official
            announcements.
          </p>
          <Link
            to="/companies"
            className="mt-3 inline-flex items-center gap-1.5 rounded border border-[#243B53] px-3 py-1.5 text-xs font-medium text-[#243B53] hover:bg-[#243B53] hover:text-white"
          >
            <Building2 className="h-3.5 w-3.5" />
            <span>Create Company Profile</span>
          </Link>
        </div>
      )}
    </div>
  );

  return (
    <AppShell rightSidebar={rightSidebar}>
      <div className="space-y-4">
        {/* Header & Feed Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-md border border-[#E2E8F0] bg-white p-4">
          <div>
            <h1 className="text-lg font-bold text-[#1F2937]">
              Company Announcements Feed
            </h1>
            <p className="text-xs text-[#64748B]">
              Chronological, factual business updates without social clutter.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {user && !publicOnly && (
              <div className="inline-flex rounded border border-[#E2E8F0] bg-[#F7F9FB] p-0.5">
                <button
                  type="button"
                  onClick={() => setFeedMode('public')}
                  className={`rounded px-3 py-1 text-xs font-medium ${
                    feedMode === 'public'
                      ? 'bg-[#243B53] text-white'
                      : 'text-[#526579] hover:text-[#1F2937]'
                  }`}
                >
                  Public Feed
                </button>
                <button
                  type="button"
                  onClick={() => setFeedMode('following')}
                  className={`rounded px-3 py-1 text-xs font-medium ${
                    feedMode === 'following'
                      ? 'bg-[#243B53] text-white'
                      : 'text-[#526579] hover:text-[#1F2937]'
                  }`}
                >
                  Following
                </button>
              </div>
            )}

            {user && user.managedCompanies.length > 0 && (
              <button
                type="button"
                onClick={() => setShowComposer((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded bg-[#243B53] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#1B2D40]"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Publish Announcement</span>
              </button>
            )}
          </div>
        </div>

        {/* Publish Announcement Composer */}
        {showComposer && user && user.managedCompanies.length > 0 && (
          <form
            onSubmit={handlePublish}
            className="rounded-md border border-[#243B53]/30 bg-white p-5 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <h2 className="text-sm font-semibold text-[#1F2937]">
                Publish Official Company Announcement
              </h2>
              <span className="text-xs text-[#64748B]">Maximum 500 characters</span>
            </div>

            {composerError && (
              <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {composerError}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-[#1F2937] mb-1">
                  Publishing Company
                </label>
                <select
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  className="w-full rounded border border-[#E2E8F0] bg-white px-3 py-2 text-xs text-[#1F2937]"
                >
                  {user.managedCompanies.map((mc) => (
                    <option key={mc.id} value={mc.id}>
                      {mc.name} ({mc.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1F2937] mb-1">
                  Announcement Category
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full rounded border border-[#E2E8F0] bg-white px-3 py-2 text-xs text-[#1F2937]"
                >
                  {ANNOUNCEMENT_CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-[#1F2937]">
                  Factual Announcement Text
                </label>
                <span
                  className={`text-xs font-medium ${
                    body.length > 480 ? 'text-amber-700' : 'text-[#64748B]'
                  }`}
                >
                  {body.length} / 500
                </span>
              </div>
              <textarea
                required
                rows={4}
                maxLength={500}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="State the factual business update concisely (e.g., product release, contract award, new facility, or key hire)..."
                className="w-full rounded border border-[#E2E8F0] px-3 py-2 text-sm text-[#1F2937] focus:border-[#243B53] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#1F2937] mb-1">
                External Reference Link <span className="text-[#64748B] font-normal">(Optional)</span>
              </label>
              <input
                type="url"
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                placeholder="https://company.com/press/release"
                className="w-full rounded border border-[#E2E8F0] px-3 py-2 text-xs text-[#1F2937] focus:border-[#243B53] focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#E2E8F0]">
              <button
                type="button"
                onClick={() => setShowComposer(false)}
                className="rounded border border-[#E2E8F0] px-3 py-1.5 text-xs font-medium text-[#526579]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={publishing || body.trim().length < 10}
                className="inline-flex items-center gap-1.5 rounded bg-[#243B53] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#1B2D40] disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                <span>{publishing ? 'Publishing...' : 'Publish Announcement'}</span>
              </button>
            </div>
          </form>
        )}

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto rounded-md border border-[#E2E8F0] bg-white p-2.5">
          <Filter className="h-3.5 w-3.5 text-[#64748B] shrink-0 ml-1 mr-1" />
          <button
            type="button"
            onClick={() => setSelectedCategory('')}
            className={`shrink-0 rounded px-2.5 py-1 text-xs font-medium ${
              selectedCategory === ''
                ? 'bg-[#243B53] text-white'
                : 'bg-[#F7F9FB] text-[#526579] hover:text-[#1F2937]'
            }`}
          >
            All Categories
          </button>
          {ANNOUNCEMENT_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.slug)}
              className={`shrink-0 rounded px-2.5 py-1 text-xs font-medium ${
                selectedCategory === cat.slug
                  ? 'bg-[#243B53] text-white'
                  : 'bg-[#F7F9FB] text-[#526579] hover:text-[#1F2937]'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Announcements List */}
        {loading ? (
          <div className="rounded-md border border-[#E2E8F0] bg-white p-8 text-center text-xs text-[#64748B]">
            Loading announcements...
          </div>
        ) : announcements.length === 0 ? (
          <div className="rounded-md border border-[#E2E8F0] bg-white p-10 text-center space-y-2">
            <Newspaper className="mx-auto h-7 w-7 text-[#94A3B8]" />
            <p className="text-sm font-medium text-[#1F2937]">No announcements found</p>
            <p className="text-xs text-[#64748B]">
              {feedMode === 'following'
                ? 'Follow companies and professionals in the directory to see their updates here, or switch to the Public Feed.'
                : 'No announcements match the selected category filter.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {announcements.map((ann) => (
              <AnnouncementCard
                key={ann.id}
                announcement={ann}
                onDelete={handleDeleteAnnouncement}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

