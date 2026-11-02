import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Building2,
  Plus,
  Mail,
  Globe,
  MapPin,
  Users,
  UserPlus,
  UserCheck,
  Trash2,
  Flag,
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { AccessBadge, EntityAvatar } from '../components/ui/AccessBadge';
import { AnnouncementCard } from '../components/announcements/AnnouncementCard';
import { useAuth } from '../lib/auth-context';
import { apiFetch } from '../lib/api';
import { INDUSTRIES, COMPANY_SIZES, type AccessLevelValue } from '../../shared/constants';
import type { AnnouncementItem, CompanyProfile } from '../../shared/types';

export function CompaniesManagementPage() {
  const { user, refreshUser, openComposeModal } = useAuth();
  const navigate = useNavigate();

  const [companies, setCompanies] = useState<CompanyProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Create form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [industry, setIndustry] = useState<string>(INDUSTRIES[0]);
  const [headquarters, setHeadquarters] = useState('');
  const [companySize, setCompanySize] = useState<string>(COMPANY_SIZES[0]);
  const [contactInfo, setContactInfo] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const loadCompanies = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ companies: CompanyProfile[] }>('/api/companies');
      setCompanies(res.companies || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  async function handleCreateCompany(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setCreating(true);
    try {
      const res = await apiFetch<{ companyId: string; slug: string }>('/api/companies', {
        method: 'POST',
        body: JSON.stringify({
          name,
          description,
          website,
          industry,
          headquarters,
          companySize,
          contactInfo,
          logoUrl: logoUrl.trim() || null,
        }),
      });
      await refreshUser();
      setShowCreateForm(false);
      navigate(`/c/${res.slug}`);
    } catch (err: any) {
      setError(err.message || 'Could not create company profile');
    } finally {
      setCreating(false);
    }
  }

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[#E2E8F0] bg-white p-4">
          <div>
            <h1 className="text-lg font-bold text-[#1F2937]">
              Company Profiles & Administration
            </h1>
            <p className="text-xs text-[#64748B]">
              Create and administer company profiles, publish factual announcements, and manage
              three-level company inboxes. Supports solo principals and large organizations.
            </p>
          </div>
          {user && (
            <button
              type="button"
              onClick={() => setShowCreateForm((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded bg-[#243B53] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1B2D40]"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create Company Profile</span>
            </button>
          )}
        </div>

        {/* Create Company Form */}
        {showCreateForm && (
          <form
            onSubmit={handleCreateCompany}
            className="rounded-md border border-[#243B53]/30 bg-white p-5 sm:p-6 space-y-4"
          >
            <div className="border-b border-[#E2E8F0] pb-3">
              <h2 className="text-sm font-bold text-[#1F2937]">New Company Profile</h2>
              <p className="text-xs text-[#64748B]">
                You will be assigned as the primary Owner and Inbox Administrator. Additional
                administrators can be added at any time.
              </p>
            </div>

            {error && (
              <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-[#1F2937] mb-1">
                  Company Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Northstar Infrastructure Partners"
                  className="w-full rounded border border-[#E2E8F0] px-3 py-2 text-sm text-[#1F2937]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1F2937] mb-1">Industry *</label>
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
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-medium text-[#1F2937] mb-1">
                  Headquarters Location *
                </label>
                <input
                  type="text"
                  required
                  value={headquarters}
                  onChange={(e) => setHeadquarters(e.target.value)}
                  placeholder="New York, NY"
                  className="w-full rounded border border-[#E2E8F0] px-3 py-2 text-sm text-[#1F2937]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1F2937] mb-1">
                  Company Size *
                </label>
                <select
                  value={companySize}
                  onChange={(e) => setCompanySize(e.target.value)}
                  className="w-full rounded border border-[#E2E8F0] bg-white px-3 py-2 text-xs text-[#1F2937]"
                >
                  {COMPANY_SIZES.map((sz) => (
                    <option key={sz} value={sz}>
                      {sz}
                    </option>
                  ))}
                </select>
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
              <label className="block text-xs font-medium text-[#1F2937] mb-1">
                Factual Company Description *
              </label>
              <textarea
                required
                rows={3}
                minLength={10}
                maxLength={1000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what the company builds, operates, or provides..."
                className="w-full rounded border border-[#E2E8F0] px-3 py-2 text-sm text-[#1F2937]"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-[#1F2937] mb-1">
                  Public Contact Information (Optional)
                </label>
                <input
                  type="text"
                  value={contactInfo}
                  onChange={(e) => setContactInfo(e.target.value)}
                  placeholder="Institutional Inquiries · New York Office"
                  className="w-full rounded border border-[#E2E8F0] px-3 py-2 text-xs text-[#1F2937]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1F2937] mb-1">
                  Company Logo URL (Optional)
                </label>
                <input
                  type="url"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://company.com/logo.png"
                  className="w-full rounded border border-[#E2E8F0] px-3 py-2 text-xs text-[#1F2937]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#E2E8F0]">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="rounded border border-[#E2E8F0] px-3.5 py-1.5 text-xs font-medium text-[#526579]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                className="rounded bg-[#243B53] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#1B2D40]"
              >
                {creating ? 'Creating...' : 'Create Company'}
              </button>
            </div>
          </form>
        )}

        {/* User's Managed Companies */}
        {user && user.managedCompanies.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-bold text-[#1F2937]">
              Companies You Administer ({user.managedCompanies.length})
            </h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {user.managedCompanies.map((mc) => (
                <div
                  key={mc.id}
                  className="rounded-md border border-[#243B53]/25 bg-white p-4 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <EntityAvatar name={mc.name} avatarUrl={mc.logoUrl} isCompany size="md" />
                    <div className="min-w-0">
                      <Link
                        to={`/c/${mc.slug}`}
                        className="text-sm font-semibold text-[#1F2937] hover:underline block truncate"
                      >
                        {mc.name}
                      </Link>
                      <p className="text-xs text-[#64748B]">
                        {mc.industry} · Role: <span className="capitalize font-medium">{mc.role}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {(mc.role === 'owner' || mc.role === 'admin') && (
                      <Link
                        to={`/messages?inboxType=company&inboxId=${mc.id}`}
                        className="rounded bg-[#287D7D] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1F6363]"
                      >
                        Company Inbox
                      </Link>
                    )}
                    <Link
                      to={`/c/${mc.slug}`}
                      className="rounded border border-[#E2E8F0] px-3 py-1.5 text-xs font-medium text-[#243B53] hover:bg-[#F7F9FB]"
                    >
                      Manage
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* All Companies Directory */}
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-[#1F2937]">
            Verified Company Directory ({companies.length})
          </h2>
          {loading ? (
            <div className="rounded-md border border-[#E2E8F0] bg-white p-8 text-center text-xs text-[#64748B]">
              Loading companies...
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {companies.map((comp) => (
                <div
                  key={comp.id}
                  className="rounded-md border border-[#E2E8F0] bg-white p-4 flex flex-col justify-between gap-3"
                >
                  <div className="flex items-start gap-3">
                    <Link to={`/c/${comp.slug}`}>
                      <EntityAvatar name={comp.name} avatarUrl={comp.logoUrl} isCompany size="md" />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/c/${comp.slug}`}
                        className="text-sm font-semibold text-[#1F2937] hover:text-[#243B53] hover:underline block truncate"
                      >
                        {comp.name}
                      </Link>
                      <p className="text-xs text-[#64748B]">
                        {[comp.industry, comp.headquarters, comp.companySize]
                          .filter(Boolean)
                          .join(' · ')}
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
                      <Link
                        to={`/c/${comp.slug}`}
                        className="rounded border border-[#E2E8F0] px-2.5 py-1 text-xs font-medium text-[#526579] hover:bg-[#F7F9FB]"
                      >
                        View Page
                      </Link>
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
      </div>
    </AppShell>
  );
}

export function PublicCompanyPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user, openComposeModal, openReportModal } = useAuth();

  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Admin member management
  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState<'admin' | 'publisher'>('admin');
  const [memberError, setMemberError] = useState('');

  const loadCompany = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    try {
      const res = await apiFetch<{
        company: CompanyProfile;
        announcements: AnnouncementItem[];
      }>(`/api/companies/${slug}`);
      setCompany(res.company);
      setAnnouncements(res.announcements || []);
    } catch (err: any) {
      setError(err.message || 'Company not found');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadCompany();
  }, [loadCompany]);

  async function handleToggleFollow() {
    if (!company || !user) return;
    await apiFetch('/api/users/follow', {
      method: 'POST',
      body: JSON.stringify({ targetType: 'company', targetId: company.id }),
    });
    await loadCompany();
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    if (!company) return;
    setMemberError('');
    try {
      await apiFetch(`/api/companies/${company.id}/members`, {
        method: 'POST',
        body: JSON.stringify({ email: memberEmail, role: memberRole }),
      });
      setMemberEmail('');
      await loadCompany();
    } catch (err: any) {
      setMemberError(err.message || 'Could not add member');
    }
  }

  async function handleRemoveMember(memberId: string) {
    if (!company) return;
    try {
      await apiFetch(`/api/companies/${company.id}/members/${memberId}`, {
        method: 'DELETE',
      });
      await loadCompany();
    } catch {
      // ignore
    }
  }

  async function handleSetFollowerCompanyAccess(
    followerUserId: string,
    newLevel: AccessLevelValue
  ) {
    if (!company) return;
    try {
      await apiFetch('/api/messages/access', {
        method: 'POST',
        body: JSON.stringify({
          senderUserId: followerUserId,
          recipientType: 'company',
          recipientId: company.id,
          accessLevel: newLevel,
        }),
      });
      await loadCompany();
    } catch {
      // ignore
    }
  }

  const isCompanyAdmin =
    company?.viewerRole === 'owner' || company?.viewerRole === 'admin';

  return (
    <AppShell>
      {loading ? (
        <div className="rounded-md border border-[#E2E8F0] bg-white p-8 text-center text-xs text-[#64748B]">
          Loading company profile...
        </div>
      ) : error || !company ? (
        <div className="rounded-md border border-[#E2E8F0] bg-white p-8 text-center space-y-2">
          <p className="text-sm font-semibold text-[#1F2937]">{error || 'Company not found'}</p>
          <Link to="/companies" className="text-xs font-medium text-[#287D7D] hover:underline">
            Return to Companies Directory
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Company Header Card */}
          <div className="rounded-md border border-[#E2E8F0] bg-white p-6">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <EntityAvatar
                  name={company.name}
                  avatarUrl={company.logoUrl}
                  isCompany
                  size="xl"
                />
                <div>
                  <h1 className="text-xl font-bold text-[#1F2937]">{company.name}</h1>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[#64748B]">
                    <span className="font-medium text-[#243B53]">{company.industry}</span>
                    {company.headquarters && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {company.headquarters}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {company.companySize}
                    </span>
                    <span>· {company.followerCount ?? 0} followers</span>
                  </div>

                  {company.website && (
                    <div className="mt-2">
                      <a
                        href={company.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-[#287D7D] hover:underline"
                      >
                        <Globe className="h-3.5 w-3.5" />
                        <span>{company.website}</span>
                      </a>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {isCompanyAdmin && (
                  <Link
                    to={`/messages?inboxType=company&inboxId=${company.id}`}
                    className="inline-flex items-center gap-1.5 rounded bg-[#287D7D] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#1F6363]"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    <span>Open Company Inbox</span>
                  </Link>
                )}

                {user && (
                  <>
                    <button
                      type="button"
                      onClick={handleToggleFollow}
                      className="inline-flex items-center gap-1.5 rounded border border-[#E2E8F0] bg-[#F7F9FB] px-3 py-1.5 text-xs font-medium text-[#1F2937]"
                    >
                      {company.isFollowing ? (
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
                          type: 'company',
                          id: company.id,
                          name: company.name,
                          subtitle: company.industry,
                          accessLevel: company.viewerAccessToCompany ?? 1,
                        })
                      }
                      className="inline-flex items-center gap-1.5 rounded bg-[#243B53] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#1B2D40]"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      <span>Message Company</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        openReportModal({
                          targetType: 'company',
                          targetId: company.id,
                          targetLabel: company.name,
                        })
                      }
                      title="Report company"
                      className="rounded border border-[#E2E8F0] p-1.5 text-[#64748B]"
                    >
                      <Flag className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {user && (
              <div className="mt-4 flex items-center justify-between rounded border border-[#E2E8F0] bg-[#F7F9FB] px-3.5 py-2.5 text-xs text-[#526579]">
                <span>Your Messaging Access to {company.name}:</span>
                <AccessBadge level={company.viewerAccessToCompany ?? 1} />
              </div>
            )}

            <div className="mt-4 border-t border-[#E2E8F0] pt-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1.5">
                About {company.name}
              </h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-[#1F2937]">
                {company.description}
              </p>
              {company.contactInfo && (
                <p className="mt-3 text-xs text-[#64748B]">
                  <strong>Contact Context:</strong> {company.contactInfo}
                </p>
              )}
            </div>
          </div>

          {/* Authorized Administrators & Team Section */}
          <div className="rounded-md border border-[#E2E8F0] bg-white p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-[#1F2937]">
                  Authorized Company Representatives
                </h2>
                <p className="text-xs text-[#64748B]">
                  Note: Access granted to {company.name}’s company inbox never automatically grants
                  access to any representative’s personal inbox.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(company.members || []).map((mem) => (
                <div
                  key={mem.id}
                  className="flex items-center justify-between rounded border border-[#E2E8F0] p-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <EntityAvatar name={mem.userName} avatarUrl={mem.userAvatarUrl} size="sm" />
                    <div className="min-w-0">
                      <Link
                        to={`/p/${mem.userSlug}`}
                        className="text-xs font-semibold text-[#1F2937] hover:underline block truncate"
                      >
                        {mem.userName}
                      </Link>
                      <p className="text-[11px] text-[#64748B] truncate">
                        {mem.userHeadline} · <span className="capitalize">{mem.role}</span>
                      </p>
                    </div>
                  </div>
                  {isCompanyAdmin && mem.role !== 'owner' && (
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(mem.id)}
                      className="rounded p-1 text-[#64748B] hover:text-red-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {isCompanyAdmin && (
              <form
                onSubmit={handleAddMember}
                className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 border-t border-[#E2E8F0] pt-3"
              >
                <input
                  type="email"
                  required
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  placeholder="Add team member by Mobilikey email..."
                  className="flex-1 rounded border border-[#E2E8F0] px-3 py-1.5 text-xs text-[#1F2937]"
                />
                <select
                  value={memberRole}
                  onChange={(e) => setMemberRole(e.target.value as 'admin' | 'publisher')}
                  className="rounded border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-xs text-[#1F2937]"
                >
                  <option value="admin">Inbox & Profile Admin</option>
                  <option value="publisher">Announcement Publisher Only</option>
                </select>
                <button
                  type="submit"
                  className="rounded bg-[#243B53] px-3.5 py-1.5 text-xs font-semibold text-white"
                >
                  Add Authorized Member
                </button>
              </form>
            )}
            {memberError && <p className="text-xs text-red-700">{memberError}</p>}
          </div>

          {/* Company Followers & Direct Inbox Access Grants (Visible to Company Admins) */}
          {isCompanyAdmin && company.followers && (
            <div className="rounded-md border border-[#E2E8F0] bg-white p-5 space-y-4">
              <div>
                <h2 className="text-sm font-bold text-[#1F2937]">
                  Company Followers ({company.followers.length})
                </h2>
                <p className="text-xs text-[#64748B]">
                  Professionals following {company.name}’s announcements. You can proactively grant
                  Recognized (Level 2) or Direct (Level 3) access to {company.name}’s company inbox.
                </p>
              </div>

              {company.followers.length === 0 ? (
                <p className="text-xs text-[#64748B]">
                  No professionals are following this company yet.
                </p>
              ) : (
                <div className="divide-y divide-[#E2E8F0] border border-[#E2E8F0] rounded">
                  {company.followers.map((flw) => (
                    <div
                      key={flw.userId}
                      className="flex flex-wrap items-center justify-between gap-3 p-3 hover:bg-[#F7F9FB]"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <EntityAvatar
                          name={flw.userName}
                          avatarUrl={flw.userAvatarUrl}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <Link
                            to={`/p/${flw.userSlug}`}
                            className="text-xs font-semibold text-[#1F2937] hover:underline block truncate"
                          >
                            {flw.userName}
                          </Link>
                          <p className="text-[11px] text-[#64748B] truncate">
                            {flw.userHeadline || flw.userCompany}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <AccessBadge level={flw.accessLevelToCompany} size="xs" />
                        <select
                          aria-label={`Set ${flw.userName} access to ${company.name}`}
                          value={flw.accessLevelToCompany}
                          onChange={(e) =>
                            handleSetFollowerCompanyAccess(
                              flw.userId,
                              Number(e.target.value) as AccessLevelValue
                            )
                          }
                          className="rounded border border-[#E2E8F0] bg-white px-2 py-1 text-xs font-medium text-[#1F2937]"
                        >
                          <option value={1}>Level 1 — General</option>
                          <option value={2}>Level 2 — Recognized</option>
                          <option value={3}>Level 3 — Direct</option>
                          <option value={0}>Blocked</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Company Announcements */}
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-[#1F2937]">
              Announcements by {company.name} ({announcements.length})
            </h2>
            {announcements.length === 0 ? (
              <div className="rounded-md border border-[#E2E8F0] bg-white p-6 text-xs text-[#64748B]">
                No announcements published yet.
              </div>
            ) : (
              <div className="space-y-3">
                {announcements.map((ann) => (
                  <AnnouncementCard key={ann.id} announcement={ann} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}

