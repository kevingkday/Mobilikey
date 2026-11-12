import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  MapPin,
  Briefcase,
  Globe,
  Mail,
  UserPlus,
  UserCheck,
  Flag,
  CheckCircle2,
  ExternalLink,
  Building2,
  Linkedin,
  Github,
  Award,
  Sparkles,
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { AccessBadge, EntityAvatar } from '../components/ui/AccessBadge';
import { ProfileImportCard } from '../components/profile/ProfileImportCard';
import { useAuth } from '../lib/auth-context';
import { apiFetch } from '../lib/api';
import { INDUSTRIES, type AccessLevelValue } from '../../shared/constants';
import type { PublicUserProfile } from '../../shared/types';

export function MyProfilePage() {
  const { user, refreshUser } = useAuth();

  const [name, setName] = useState(user?.name || '');
  const [headline, setHeadline] = useState(user?.headline || '');
  const [biography, setBiography] = useState(user?.biography || '');
  const [location, setLocation] = useState(user?.location || '');
  const [companyName, setCompanyName] = useState(user?.companyName || '');
  const [position, setPosition] = useState(user?.position || '');
  const [website, setWebsite] = useState(user?.website || '');
  const [industry, setIndustry] = useState(user?.industry || INDUSTRIES[0]);
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [linkedin, setLinkedin] = useState(user?.socialLinks?.linkedin || '');
  const [github, setGithub] = useState(user?.socialLinks?.github || '');
  const [saving, setSaving] = useState(false);
  const [savedBanner, setSavedBanner] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      setName(user.name);
      setHeadline(user.headline);
      setBiography(user.biography);
      setLocation(user.location);
      setCompanyName(user.companyName);
      setPosition(user.position);
      setWebsite(user.website);
      setIndustry(user.industry || INDUSTRIES[0]);
      setAvatarUrl(user.avatarUrl || '');
      setLinkedin(user.socialLinks?.linkedin || '');
      setGithub(user.socialLinks?.github || '');
    }
  }, [user]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSavedBanner(false);
    setError('');

    try {
      await apiFetch('/api/users/me', {
        method: 'PUT',
        body: JSON.stringify({
          name,
          headline,
          biography,
          location,
          companyName,
          position,
          website,
          industry,
          avatarUrl: avatarUrl.trim() || null,
          socialLinks: {
            linkedin: linkedin.trim() || undefined,
            github: github.trim() || undefined,
          },
        }),
      });
      await refreshUser();
      setSavedBanner(true);
    } catch (err: any) {
      setError(err.message || 'Could not update profile');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[#E2E8F0] bg-white p-4">
          <div>
            <h1 className="text-lg font-bold text-[#1F2937]">My Professional Profile</h1>
            <p className="text-xs text-[#64748B]">
              Maintain your factual professional credentials and directory listing.
            </p>
          </div>
          {user && (
            <Link
              to={`/p/${user.slug}`}
              className="inline-flex items-center gap-1.5 rounded border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs font-medium text-[#243B53] hover:bg-[#F7F9FB]"
            >
              <span>View Public Profile</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>

        {savedBanner && (
          <div className="flex items-center gap-2 rounded border border-[#287D7D]/30 bg-[#287D7D]/10 px-4 py-2.5 text-xs font-medium text-[#1D5E5E]">
            <CheckCircle2 className="h-4 w-4 text-[#287D7D]" />
            <span>Profile changes saved.</span>
          </div>
        )}

        {error && (
          <div className="rounded border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700">
            {error}
          </div>
        )}

        <ProfileImportCard
          onImport={(imported) => {
            if (imported.name) setName(imported.name);
            if (imported.headline) setHeadline(imported.headline);
            if (imported.biography) setBiography(imported.biography);
            if (imported.location) setLocation(imported.location);
            if (imported.companyName) setCompanyName(imported.companyName);
            if (imported.position) setPosition(imported.position);
            if (imported.website) setWebsite(imported.website);
            if (imported.industry) setIndustry(imported.industry);
            if (imported.avatarUrl) setAvatarUrl(imported.avatarUrl);
            if (imported.socialLinks?.linkedin) setLinkedin(imported.socialLinks.linkedin);
            if (imported.socialLinks?.github) setGithub(imported.socialLinks.github);
          }}
        />

        <form
          onSubmit={handleSave}
          className="rounded-md border border-[#E2E8F0] bg-white p-5 sm:p-6 space-y-5"
        >
          <div className="flex items-center gap-4 pb-4 border-b border-[#E2E8F0]">
            <EntityAvatar name={name} avatarUrl={avatarUrl || null} size="xl" />
            <div className="flex-1">
              <label className="block text-xs font-medium text-[#1F2937] mb-1">
                Profile Photograph URL (Optional)
              </label>
              <input
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://example.com/photo.jpg"
                className="w-full rounded border border-[#E2E8F0] px-3 py-1.5 text-xs text-[#1F2937]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-[#1F2937] mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded border border-[#E2E8F0] px-3 py-2 text-sm text-[#1F2937]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#1F2937] mb-1">
                Professional Headline
              </label>
              <input
                type="text"
                maxLength={140}
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                className="w-full rounded border border-[#E2E8F0] px-3 py-2 text-sm text-[#1F2937]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-[#1F2937] mb-1">Company</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full rounded border border-[#E2E8F0] px-3 py-2 text-sm text-[#1F2937]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#1F2937] mb-1">Position</label>
              <input
                type="text"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                className="w-full rounded border border-[#E2E8F0] px-3 py-2 text-sm text-[#1F2937]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-[#1F2937] mb-1">Industry</label>
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full rounded border border-[#E2E8F0] bg-white px-3 py-2 text-xs text-[#1F2937]"
              >
                {INDUSTRIES.map((ind) => (
                  <option key={ind} value={ind}>
                    {ind}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#1F2937] mb-1">Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full rounded border border-[#E2E8F0] px-3 py-2 text-sm text-[#1F2937]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#1F2937] mb-1">Website</label>
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://company.com"
                className="w-full rounded border border-[#E2E8F0] px-3 py-2 text-sm text-[#1F2937]"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-[#1F2937]">
                Executive / Professional Biography
              </label>
              <span className="text-[11px] text-[#64748B]">
                {biography.length} / 4,000 characters
              </span>
            </div>
            <textarea
              rows={8}
              maxLength={4000}
              value={biography}
              onChange={(e) => setBiography(e.target.value)}
              placeholder="Comprehensive summary of your executive focus, experience, notable accomplishments, and technical or industry background..."
              className="w-full rounded border border-[#E2E8F0] px-3 py-2 text-sm text-[#1F2937] focus:border-[#287D7D] focus:ring-1 focus:ring-[#287D7D] transition-colors leading-relaxed"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 border-t border-[#E2E8F0] pt-4">
            <div>
              <label className="block text-xs font-medium text-[#1F2937] mb-1">
                Optional Social Link (LinkedIn / Directory URL)
              </label>
              <input
                type="url"
                value={linkedin}
                onChange={(e) => setLinkedin(e.target.value)}
                placeholder="https://..."
                className="w-full rounded border border-[#E2E8F0] px-3 py-1.5 text-xs text-[#1F2937]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1F2937] mb-1">
                Optional Technical / GitHub URL
              </label>
              <input
                type="url"
                value={github}
                onChange={(e) => setGithub(e.target.value)}
                placeholder="https://..."
                className="w-full rounded border border-[#E2E8F0] px-3 py-1.5 text-xs text-[#1F2937]"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded bg-[#243B53] px-5 py-2 text-xs font-semibold text-white hover:bg-[#1B2D40] disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}

export function PublicProfilePage() {
  const { slug } = useParams<{ slug: string }>();
  const { user, openComposeModal, openReportModal } = useAuth();

  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingAccess, setUpdatingAccess] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch<{ profile: PublicUserProfile }>(`/api/users/${slug}`);
      setProfile(res.profile);
    } catch (err: any) {
      setError(err.message || 'Profile not found');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // Update dynamic document title and meta description for SEO & OpenGraph
  useEffect(() => {
    if (!profile) return;
    const originalTitle = document.title;
    const pageTitle = `${profile.name} — ${profile.headline || profile.position || 'Professional Profile'} | Mobilikey`;
    document.title = pageTitle;

    // OpenGraph & Meta description
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      document.head.appendChild(metaDesc);
    }
    const cleanBio = profile.biography ? profile.biography.replace(/\s+/g, ' ').slice(0, 160) : '';
    const descContent = cleanBio || `${profile.name}'s verified professional credentials, industry leadership, and contact access on Mobilikey.`;
    metaDesc.setAttribute('content', descContent);

    // JSON-LD structured data for Google Rich Results (Person schema)
    const scriptId = 'mobilikey-person-schema';
    let scriptTag = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!scriptTag) {
      scriptTag = document.createElement('script');
      scriptTag.id = scriptId;
      scriptTag.type = 'application/ld+json';
      document.head.appendChild(scriptTag);
    }
    const sameAsList: string[] = [];
    if (profile.socialLinks?.linkedin) sameAsList.push(profile.socialLinks.linkedin);
    if (profile.socialLinks?.github) sameAsList.push(profile.socialLinks.github);
    if (profile.website) sameAsList.push(profile.website);

    scriptTag.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: profile.name,
      jobTitle: profile.position || profile.headline,
      worksFor: profile.companyName ? { '@type': 'Organization', name: profile.companyName } : undefined,
      description: descContent,
      url: window.location.href,
      sameAs: sameAsList.length > 0 ? sameAsList : undefined,
    });

    return () => {
      document.title = originalTitle;
      const s = document.getElementById(scriptId);
      if (s) s.remove();
    };
  }, [profile]);

  async function handleToggleFollow() {
    if (!profile || !user) return;
    try {
      await apiFetch('/api/users/follow', {
        method: 'POST',
        body: JSON.stringify({ targetType: 'user', targetId: profile.id }),
      });
      await loadProfile();
    } catch {
      // ignore
    }
  }

  async function handleSetTheirAccessToMe(newLevel: AccessLevelValue) {
    if (!profile || !user) return;
    setUpdatingAccess(true);
    try {
      await apiFetch('/api/messages/access', {
        method: 'POST',
        body: JSON.stringify({
          senderUserId: profile.id,
          recipientType: 'user',
          recipientId: user.id,
          accessLevel: newLevel,
        }),
      });
      await loadProfile();
    } finally {
      setUpdatingAccess(false);
    }
  }

  return (
    <AppShell>
      {loading ? (
        <div className="rounded-md border border-[#E2E8F0] bg-white p-8 text-center text-xs text-[#64748B]">
          Loading professional profile...
        </div>
      ) : error || !profile ? (
        <div className="rounded-md border border-[#E2E8F0] bg-white p-8 text-center space-y-2">
          <p className="text-sm font-semibold text-[#1F2937]">{error || 'Profile not found'}</p>
          <Link to="/search" className="text-xs font-medium text-[#287D7D] hover:underline">
            Return to Directory Search
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-md border border-[#E2E8F0] bg-white p-6">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <EntityAvatar name={profile.name} avatarUrl={profile.avatarUrl} size="xl" />
                <div>
                  <h1 className="text-xl font-bold text-[#1F2937]">{profile.name}</h1>
                  <p className="mt-0.5 text-sm font-medium text-[#243B53]">
                    {profile.headline ||
                      [profile.position, profile.companyName].filter(Boolean).join(' at ')}
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[#64748B]">
                    {(profile.position || profile.companyName) && (
                      <span className="inline-flex items-center gap-1">
                        <Briefcase className="h-3.5 w-3.5" />
                        {[profile.position, profile.companyName].filter(Boolean).join(' · ')}
                      </span>
                    )}
                    {profile.location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {profile.location}
                      </span>
                    )}
                    {profile.industry && <span>· {profile.industry}</span>}
                    <span>· {profile.followerCount ?? 0} followers</span>
                  </div>

                  {profile.website && (
                    <div className="mt-2">
                      <a
                        href={profile.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-[#287D7D] hover:underline"
                      >
                        <Globe className="h-3.5 w-3.5" />
                        <span>{profile.website}</span>
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {user && user.id !== profile.id && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleToggleFollow}
                    className="inline-flex items-center gap-1.5 rounded border border-[#E2E8F0] bg-[#F7F9FB] px-3 py-1.5 text-xs font-medium text-[#1F2937] hover:border-[#CBD5E1]"
                  >
                    {profile.isFollowing ? (
                      <>
                        <UserCheck className="h-3.5 w-3.5 text-[#287D7D]" />
                        <span>Following</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-3.5 w-3.5" />
                        <span>Follow</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      openComposeModal({
                        type: 'user',
                        id: profile.id,
                        name: profile.name,
                        subtitle: profile.headline,
                        accessLevel: profile.viewerAccessToUser ?? 1,
                        isFollowing: Boolean(profile.isFollowing),
                        onFollowed: loadProfile,
                      })
                    }
                    className="inline-flex items-center gap-1.5 rounded bg-[#243B53] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#1B2D40]"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    <span>{profile.isFollowing ? 'Message' : 'Follow & Message'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      openReportModal({
                        targetType: 'user',
                        targetId: profile.id,
                        targetLabel: profile.name,
                      })
                    }
                    title="Report account"
                    className="rounded border border-[#E2E8F0] p-1.5 text-[#64748B] hover:text-[#1F2937]"
                  >
                    <Flag className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Directional Access Status Bar */}
            {user && user.id !== profile.id && (
              <div className="mt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded border border-[#E2E8F0] bg-[#F7F9FB] p-3.5">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5 text-xs text-[#526579]">
                    <span>Your Messaging Access to {profile.name}:</span>
                    <AccessBadge level={profile.viewerAccessToUser ?? 1} />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-[#526579]">
                    {profile.name}’s Access to Your Inbox:
                  </span>
                  <select
                    disabled={updatingAccess}
                    value={profile.userAccessToViewer ?? 1}
                    onChange={(e) =>
                      handleSetTheirAccessToMe(Number(e.target.value) as AccessLevelValue)
                    }
                    className="rounded border border-[#E2E8F0] bg-white px-2.5 py-1 text-xs font-medium text-[#1F2937]"
                  >
                    <option value={1}>Level 1 — General Access</option>
                    <option value={2}>Level 2 — Recognized Access</option>
                    <option value={3}>Level 3 — Direct Access</option>
                    <option value={0}>Blocked</option>
                  </select>
                </div>
              </div>
            )}

            {/* Executive / Professional Summary */}
            {profile.biography && (
              <div className="mt-6 border-t border-[#E2E8F0] pt-5">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-[#287D7D]" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[#475569]">
                    Executive & Professional Background
                  </h2>
                </div>
                <div className="prose prose-sm max-w-none text-[#1F2937]">
                  <p className="whitespace-pre-line text-sm leading-relaxed text-[#334155] bg-[#F8FAFC] border border-[#E2E8F0]/70 rounded-md p-4">
                    {profile.biography}
                  </p>
                </div>
              </div>
            )}

            {/* Organizations & Affiliated Companies */}
            {profile.affiliatedCompanies && profile.affiliatedCompanies.length > 0 && (
              <div className="mt-6 border-t border-[#E2E8F0] pt-5">
                <div className="flex items-center gap-2 mb-3">
                  <Building2 className="h-4 w-4 text-[#287D7D]" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[#475569]">
                    Managed & Affiliated Organizations
                  </h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {profile.affiliatedCompanies.map((c) => (
                    <Link
                      key={c.id}
                      to={`/companies`}
                      className="flex items-center justify-between p-3 rounded-md border border-[#E2E8F0] bg-[#FFFFFF] hover:border-[#CBD5E1] hover:bg-[#F8FAFC] transition-colors group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {c.logoUrl ? (
                          <img
                            src={c.logoUrl}
                            alt={c.name}
                            className="h-9 w-9 rounded border border-[#E2E8F0] object-cover"
                          />
                        ) : (
                          <div className="h-9 w-9 rounded border border-[#CBD5E1] bg-[#F1F5F9] flex items-center justify-center font-bold text-xs text-[#475569]">
                            {c.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[#1F2937] group-hover:text-[#287D7D] truncate">
                            {c.name}
                          </p>
                          <p className="text-[11px] text-[#64748B] capitalize">{c.role} · {c.industry}</p>
                        </div>
                      </div>
                      <ExternalLink className="h-3.5 w-3.5 text-[#94A3B8] group-hover:text-[#287D7D] shrink-0 ml-2" />
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Verified Digital Footprint & Channels */}
            {(profile.socialLinks?.linkedin || profile.socialLinks?.github || profile.website) && (
              <div className="mt-6 border-t border-[#E2E8F0] pt-5">
                <div className="flex items-center gap-2 mb-3">
                  <Award className="h-4 w-4 text-[#287D7D]" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[#475569]">
                    Verified Footprint & Directory Links
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  {profile.socialLinks?.linkedin && (
                    <a
                      href={profile.socialLinks.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#CBD5E1] bg-white text-xs font-medium text-[#0A66C2] hover:bg-[#F0F7FF] transition-colors"
                    >
                      <Linkedin className="h-3.5 w-3.5" />
                      <span>LinkedIn Profile</span>
                      <ExternalLink className="h-3 w-3 opacity-60" />
                    </a>
                  )}
                  {profile.socialLinks?.github && (
                    <a
                      href={profile.socialLinks.github}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#CBD5E1] bg-white text-xs font-medium text-[#24292F] hover:bg-[#F6F8FA] transition-colors"
                    >
                      <Github className="h-3.5 w-3.5" />
                      <span>GitHub</span>
                      <ExternalLink className="h-3 w-3 opacity-60" />
                    </a>
                  )}
                  {profile.website && (
                    <a
                      href={profile.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#CBD5E1] bg-white text-xs font-medium text-[#287D7D] hover:bg-[#F2FBFB] transition-colors"
                    >
                      <Globe className="h-3.5 w-3.5" />
                      <span>{profile.website.replace(/^https?:\/\/(www\.)?/, '')}</span>
                      <ExternalLink className="h-3 w-3 opacity-60" />
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}

