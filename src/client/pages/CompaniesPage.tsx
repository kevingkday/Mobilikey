import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Building2,
  Plus,
  Mail,
  Phone,
  Globe,
  MapPin,
  Users,
  UserPlus,
  UserCheck,
  Trash2,
  Flag,
  Pencil,
  ExternalLink,
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { AccessBadge, EntityAvatar } from '../components/ui/AccessBadge';
import { AnnouncementCard } from '../components/announcements/AnnouncementCard';
import {
  CompanyProfileForm,
  type CompanyFormValues,
} from '../components/companies/CompanyProfileForm';
import { useAuth } from '../lib/auth-context';
import { apiFetch } from '../lib/api';
import type { AccessLevelValue } from '../../shared/constants';
import type { AnnouncementItem, CompanyProfile } from '../../shared/types';

export function CompaniesManagementPage() {
  const { user, refreshUser, openComposeModal } = useAuth();
  const navigate = useNavigate();

  const [companies, setCompanies] = useState<CompanyProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);

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

  async function handleCreateCompany(values: CompanyFormValues) {
    const res = await apiFetch<{ companyId: string; slug: string }>('/api/companies', {
      method: 'POST',
      body: JSON.stringify({
        name: values.name,
        description: values.description,
        website: values.website,
        industry: values.industry,
        headquarters: values.headquarters,
        companySize: values.companySize,
        contactInfo: values.contactInfo,
        contactEmail: values.contactEmail,
        contactPhone: values.contactPhone,
        socialLinks: values.socialLinks,
        logoUrl: values.logoUrl.trim() || null,
      }),
    });
    await refreshUser();
    setShowCreateForm(false);
    navigate(`/c/${res.slug}`);
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
          <CompanyProfileForm
            title="New Company Profile"
            subtitle="You will be assigned as the primary Owner and Inbox Administrator. Additional administrators can be added at any time."
            submitLabel="Create Company"
            submittingLabel="Creating..."
            onSubmit={handleCreateCompany}
            onCancel={() => setShowCreateForm(false)}
          />
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
                              isFollowing: Boolean(comp.isFollowing),
                              onFollowed: loadCompanies,
                            })
                          }
                          className="inline-flex items-center gap-1 rounded bg-[#243B53] px-2.5 py-1 text-xs font-medium text-white hover:bg-[#1B2D40]"
                        >
                          <Mail className="h-3 w-3" />
                          <span>{comp.isFollowing ? 'Message' : 'Follow & Message'}</span>
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
  const { user, refreshUser, openComposeModal, openReportModal } = useAuth();

  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingCompany, setEditingCompany] = useState(false);

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

  async function handleUpdateCompany(values: CompanyFormValues) {
    if (!company) return;
    await apiFetch(`/api/companies/${company.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: values.name,
        description: values.description,
        website: values.website,
        industry: values.industry,
        headquarters: values.headquarters,
        companySize: values.companySize,
        contactInfo: values.contactInfo,
        contactEmail: values.contactEmail,
        contactPhone: values.contactPhone,
        socialLinks: values.socialLinks,
        logoUrl: values.logoUrl.trim() || null,
      }),
    });
    await Promise.all([loadCompany(), refreshUser()]);
    setEditingCompany(false);
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
                  <>
                    <button
                      type="button"
                      onClick={() => setEditingCompany((v) => !v)}
                      className="inline-flex items-center gap-1.5 rounded border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-medium text-[#1F2937] hover:bg-[#F7F9FB]"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      <span>{editingCompany ? 'Close Editor' : 'Edit Profile'}</span>
                    </button>
                    <Link
                      to={`/messages?inboxType=company&inboxId=${company.id}`}
                      className="inline-flex items-center gap-1.5 rounded bg-[#287D7D] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#1F6363]"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      <span>Open Company Inbox</span>
                    </Link>
                  </>
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
                          isFollowing: Boolean(company.isFollowing),
                          onFollowed: loadCompany,
                        })
                      }
                      className="inline-flex items-center gap-1.5 rounded bg-[#243B53] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#1B2D40]"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      <span>{company.isFollowing ? 'Message Company' : 'Follow & Message'}</span>
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

              {(company.contactEmail ||
                company.contactPhone ||
                company.contactInfo ||
                company.socialLinks?.linkedin ||
                company.socialLinks?.x ||
                company.socialLinks?.github ||
                company.socialLinks?.other) && (
                <div className="mt-4 border-t border-[#E2E8F0] pt-3 space-y-2.5">
                  {(company.contactEmail || company.contactPhone || company.contactInfo) && (
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-[#526579]">
                      {company.contactEmail && (
                        <a
                          href={`mailto:${company.contactEmail}`}
                          className="inline-flex items-center gap-1.5 font-medium text-[#243B53] hover:underline"
                        >
                          <Mail className="h-3.5 w-3.5 text-[#287D7D]" />
                          <span>{company.contactEmail}</span>
                        </a>
                      )}
                      {company.contactPhone && (
                        <a
                          href={`tel:${company.contactPhone}`}
                          className="inline-flex items-center gap-1.5 font-medium text-[#243B53] hover:underline"
                        >
                          <Phone className="h-3.5 w-3.5 text-[#287D7D]" />
                          <span>{company.contactPhone}</span>
                        </a>
                      )}
                      {company.contactInfo && (
                        <span className="text-[#64748B]">
                          <strong>Contact Note:</strong> {company.contactInfo}
                        </span>
                      )}
                    </div>
                  )}

                  {(company.socialLinks?.linkedin ||
                    company.socialLinks?.x ||
                    company.socialLinks?.github ||
                    company.socialLinks?.other) && (
                    <div className="flex flex-wrap items-center gap-2">
                      {[
                        { label: 'LinkedIn', href: company.socialLinks?.linkedin },
                        { label: 'X / Twitter', href: company.socialLinks?.x },
                        { label: 'GitHub', href: company.socialLinks?.github },
                        { label: 'Social / Link', href: company.socialLinks?.other },
                      ]
                        .filter((item): item is { label: string; href: string } =>
                          Boolean(item.href)
                        )
                        .map((item) => (
                          <a
                            key={item.label}
                            href={item.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded border border-[#E2E8F0] bg-[#F7F9FB] px-2.5 py-1 text-xs font-medium text-[#243B53] hover:border-[#243B53]/40"
                          >
                            <span>{item.label}</span>
                            <ExternalLink className="h-3 w-3 text-[#64748B]" />
                          </a>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {editingCompany && isCompanyAdmin && (
            <CompanyProfileForm
              title={`Edit ${company.name}`}
              subtitle="Update company details, logo, public contact information, and social networks."
              submitLabel="Save Changes"
              submittingLabel="Saving..."
              initialValues={{
                name: company.name,
                description: company.description,
                website: company.website,
                industry: company.industry,
                headquarters: company.headquarters,
                companySize: company.companySize,
                contactInfo: company.contactInfo,
                contactEmail: company.contactEmail,
                contactPhone: company.contactPhone,
                logoUrl: company.logoUrl || '',
                socialLinks: company.socialLinks || {},
              }}
              onSubmit={handleUpdateCompany}
              onCancel={() => setEditingCompany(false)}
            />
          )}

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

