import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Shield,
  Users,
  Building2,
  Flag,
  Tag,
  Activity,
  Lock,
} from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { formatRelativeTime } from '../../components/ui/AccessBadge';
import { useAuth } from '../../lib/auth-context';
import { apiFetch } from '../../lib/api';
import type {
  BulkImportCompaniesResult,
  BulkImportCompanyFollowsResult,
} from '../../../shared/types';

export function AdminDashboardPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'overview' | 'users' | 'companies' | 'reports' | 'categories'>(
    'overview'
  );

  const [overview, setOverview] = useState<any>(null);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [companiesList, setCompaniesList] = useState<any[]>([]);
  const [reportsList, setReportsList] = useState<any[]>([]);
  const [categoriesList, setCategoriesList] = useState<any[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [loading, setLoading] = useState(true);
  const [bulkJson, setBulkJson] = useState('');
  const [bulkDryRun, setBulkDryRun] = useState(true);
  const [bulkError, setBulkError] = useState('');
  const [bulkResult, setBulkResult] = useState<BulkImportCompanyFollowsResult | null>(null);
  const [bulkRunning, setBulkRunning] = useState(false);

  const [companiesJson, setCompaniesJson] = useState('');
  const [companiesDryRun, setCompaniesDryRun] = useState(true);
  const [companiesError, setCompaniesError] = useState('');
  const [companiesResult, setCompaniesResult] = useState<BulkImportCompaniesResult | null>(null);
  const [companiesRunning, setCompaniesRunning] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'overview') {
        const res = await apiFetch('/api/admin/overview');
        setOverview(res);
      } else if (tab === 'users') {
        const res = await apiFetch('/api/admin/users');
        setUsersList(res.users || []);
      } else if (tab === 'companies') {
        const res = await apiFetch('/api/admin/companies');
        setCompaniesList(res.companies || []);
      } else if (tab === 'reports') {
        const res = await apiFetch('/api/admin/reports');
        setReportsList(res.reports || []);
      } else if (tab === 'categories') {
        const res = await apiFetch('/api/admin/categories');
        setCategoriesList(res.categories || []);
      }
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    if (user?.systemRole === 'admin') {
      loadData();
    }
  }, [user, loadData]);

  if (!user || user.systemRole !== 'admin') {
    return (
      <AppShell>
        <div className="rounded-md border border-[#E2E8F0] bg-white p-8 text-center">
          <p className="text-sm font-semibold text-[#1F2937]">
            Administrator authorization is required to view this page.
          </p>
        </div>
      </AppShell>
    );
  }

  async function handleToggleUserStatus(userId: string, currentStatus: string) {
    const nextStatus = currentStatus === 'active' ? 'suspended' : 'active';
    await apiFetch(`/api/admin/users/${userId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: nextStatus }),
    });
    await loadData();
  }

  async function handleToggleCompanyStatus(companyId: string, currentStatus: string) {
    const nextStatus = currentStatus === 'active' ? 'suspended' : 'active';
    await apiFetch(`/api/admin/companies/${companyId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: nextStatus }),
    });
    await loadData();
  }

  async function handleReviewReport(
    reportId: string,
    status: 'reviewed' | 'dismissed' | 'actioned',
    removeContent = false
  ) {
    await apiFetch(`/api/admin/reports/${reportId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, removeContent }),
    });
    await loadData();
  }

  async function handleAddCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    await apiFetch('/api/admin/categories', {
      method: 'POST',
      body: JSON.stringify({
        name: newCategoryName.trim(),
        sortOrder: categoriesList.length + 1,
      }),
    });
    setNewCategoryName('');
    await loadData();
  }

  async function handleToggleCategory(catId: string, isActive: number) {
    await apiFetch(`/api/admin/categories/${catId}`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: isActive !== 1 }),
    });
    await loadData();
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="rounded-md border border-[#E2E8F0] bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h1 className="text-lg font-bold text-[#1F2937]">Platform Administration</h1>
              <p className="text-xs text-[#64748B]">
                Manage accounts, companies, announcement categories, and moderation reports.
              </p>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded border border-[#243B53]/20 bg-[#F7F9FB] px-3 py-1 text-xs font-medium text-[#243B53]">
              <Lock className="h-3.5 w-3.5 text-[#287D7D]" />
              <span>Privacy Enforced: Private messages are not accessible to admins</span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 border-t border-[#E2E8F0] pt-3">
            {[
              { id: 'overview', label: 'Admin Overview', icon: Activity },
              { id: 'users', label: 'Users', icon: Users },
              { id: 'companies', label: 'Companies', icon: Building2 },
              { id: 'reports', label: 'Content & Abuse Reports', icon: Flag },
              { id: 'categories', label: 'Announcement Categories', icon: Tag },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id as any)}
                  className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium ${
                    tab === item.id
                      ? 'bg-[#243B53] text-white'
                      : 'bg-[#F7F9FB] text-[#526579] hover:text-[#1F2937]'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <div className="rounded-md border border-[#E2E8F0] bg-white p-8 text-center text-xs text-[#64748B]">
            Loading administrative data...
          </div>
        ) : tab === 'overview' && overview ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-md border border-[#E2E8F0] bg-white p-4">
                <span className="text-xs text-[#64748B]">Active Professionals</span>
                <p className="mt-1 text-2xl font-bold text-[#1F2937]">
                  {overview.stats.activeUsers}
                </p>
                <span className="text-[11px] text-[#287D7D]">
                  +{overview.stats.registrationsLast7Days} last 7 days
                </span>
              </div>
              <div className="rounded-md border border-[#E2E8F0] bg-white p-4">
                <span className="text-xs text-[#64748B]">Active Companies</span>
                <p className="mt-1 text-2xl font-bold text-[#1F2937]">
                  {overview.stats.activeCompanies}
                </p>
                <span className="text-[11px] text-[#64748B]">
                  {overview.stats.publishedAnnouncements} announcements
                </span>
              </div>
              <div className="rounded-md border border-[#E2E8F0] bg-white p-4">
                <span className="text-xs text-[#64748B]">Messaging Activity</span>
                <p className="mt-1 text-2xl font-bold text-[#1F2937]">
                  {overview.stats.messagingActivity.totalMessagesSent}
                </p>
                <span className="text-[11px] text-[#64748B]">
                  across {overview.stats.messagingActivity.totalConversations} threads
                </span>
              </div>
              <div className="rounded-md border border-[#E2E8F0] bg-white p-4">
                <span className="text-xs text-[#64748B]">Earned Access Grants</span>
                <p className="mt-1 text-2xl font-bold text-[#287D7D]">
                  {overview.stats.messagingActivity.directGrantsCount +
                    overview.stats.messagingActivity.recognizedGrantsCount}
                </p>
                <span className="text-[11px] text-[#64748B]">
                  {overview.stats.messagingActivity.directGrantsCount} Direct ·{' '}
                  {overview.stats.messagingActivity.recognizedGrantsCount} Recognized
                </span>
              </div>
            </div>

            {/* Audit Logs */}
            <div className="rounded-md border border-[#E2E8F0] bg-white p-5">
              <h2 className="text-sm font-bold text-[#1F2937] mb-3">
                Security & Administrative Audit Log
              </h2>
              <div className="divide-y divide-[#E2E8F0] border border-[#E2E8F0] rounded">
                {(overview.recentAuditLogs || []).map((log: any) => (
                  <div
                    key={log.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 text-xs"
                  >
                    <div>
                      <span className="font-semibold text-[#1F2937]">{log.actorName}</span>{' '}
                      <span className="font-mono text-[11px] text-[#243B53] bg-[#F7F9FB] px-1.5 py-0.5 rounded border border-[#E2E8F0]">
                        {log.action}
                      </span>{' '}
                      <span className="text-[#64748B]">
                        on {log.targetType} ({log.targetId})
                      </span>
                    </div>
                    <span className="text-[11px] text-[#64748B]">
                      {formatRelativeTime(log.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : tab === 'users' ? (
          <div className="rounded-md border border-[#E2E8F0] bg-white overflow-hidden">
            <div className="divide-y divide-[#E2E8F0]">
              {usersList.map((u) => (
                <div
                  key={u.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-[#F7F9FB]"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/p/${u.slug}`}
                        className="text-sm font-semibold text-[#1F2937] hover:underline"
                      >
                        {u.name}
                      </Link>
                      <span className="rounded border border-[#E2E8F0] px-2 py-0.5 text-[10px] font-medium uppercase text-[#526579]">
                        {u.systemRole}
                      </span>
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                          u.status === 'active'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-red-50 text-red-800 border border-red-200'
                        }`}
                      >
                        {u.status}
                      </span>
                    </div>
                    <p className="text-xs text-[#64748B]">
                      {u.email} · {u.headline || u.companyName}
                    </p>
                  </div>

                  {u.id !== user.id && u.status !== 'deleted' && (
                    <button
                      type="button"
                      onClick={() => handleToggleUserStatus(u.id, u.status)}
                      className={`rounded px-3 py-1 text-xs font-medium ${
                        u.status === 'active'
                          ? 'border border-red-300 bg-red-50 text-red-800 hover:bg-red-100'
                          : 'bg-[#243B53] text-white'
                      }`}
                    >
                      {u.status === 'active' ? 'Suspend Account' : 'Reactivate Account'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : tab === 'companies' ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-md border border-[#E2E8F0] bg-white p-5 space-y-3">
                <div>
                  <h2 className="text-sm font-bold text-[#1F2937]">
                    Bulk Import Unclaimed Companies & Updates
                  </h2>
                  <p className="text-xs text-[#64748B]">
                    Paste a JSON array of companies with optional public announcements. Matches
                    existing companies by slug or domain without changing their profile.
                  </p>
                </div>
                <textarea
                  rows={5}
                  value={companiesJson}
                  onChange={(e) => setCompaniesJson(e.target.value)}
                  placeholder='[{"slug":"luminaryx","name":"LUMINARYX","website":"https://luminaryx.ca","headquarters":"Golden, BC","industry":"AI / GovTech","update":{"body":"Launched new municipal AI workflow.","external_url":"https://example.com/article"}}]'
                  className="w-full rounded border border-[#E2E8F0] px-3 py-2 font-mono text-xs"
                />
                {companiesError && (
                  <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {companiesError}
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="inline-flex items-center gap-2 text-xs text-[#526579]">
                    <input
                      type="checkbox"
                      checked={companiesDryRun}
                      onChange={(e) => setCompaniesDryRun(e.target.checked)}
                      className="rounded border-[#CBD5E1]"
                    />
                    <span>Dry run (preview summary without writing)</span>
                  </label>
                  <button
                    type="button"
                    disabled={companiesRunning || !companiesJson.trim()}
                    onClick={async () => {
                      setCompaniesError('');
                      setCompaniesResult(null);
                      let parsed: unknown;
                      try {
                        parsed = JSON.parse(companiesJson);
                      } catch {
                        setCompaniesError('Invalid JSON syntax.');
                        return;
                      }
                      setCompaniesRunning(true);
                      try {
                        const res = await apiFetch<BulkImportCompaniesResult>(
                          `/api/admin/companies/import?dry_run=${companiesDryRun ? 'true' : 'false'}`,
                          {
                            method: 'POST',
                            body: JSON.stringify(parsed),
                          }
                        );
                        setCompaniesResult(res);
                        if (!companiesDryRun) {
                          await loadData();
                        }
                      } catch (err: any) {
                        setCompaniesError(err.message || 'Bulk import failed');
                      } finally {
                        setCompaniesRunning(false);
                      }
                    }}
                    className="rounded bg-[#243B53] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#1B2D40] disabled:opacity-50"
                  >
                    {companiesRunning
                      ? 'Running...'
                      : companiesDryRun
                        ? 'Preview Import'
                        : 'Run Import'}
                  </button>
                </div>
                {companiesResult && (
                  <div className="rounded border border-[#E2E8F0] bg-[#F7F9FB] p-3 text-xs space-y-1.5">
                    <div className="font-semibold text-[#1F2937]">
                      {companiesResult.dryRun ? 'Dry-Run Summary' : 'Import Summary'}:{' '}
                      {companiesResult.companiesCreated} companies created ·{' '}
                      {companiesResult.companiesMatched} matched ·{' '}
                      {companiesResult.updatesCreated} updates created ·{' '}
                      {companiesResult.updatesSkipped} skipped
                    </div>
                    {companiesResult.errors.length > 0 && (
                      <div className="text-red-700 space-y-0.5">
                        <div className="font-semibold">
                          Errors ({companiesResult.errors.length}):
                        </div>
                        {companiesResult.errors.map((err, idx) => (
                          <p key={idx}>
                            Row {err.row + 1}
                            {err.slug ? ` (${err.slug})` : ''}: {err.error}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="rounded-md border border-[#E2E8F0] bg-white p-5 space-y-3">
                <div>
                  <h2 className="text-sm font-bold text-[#1F2937]">Bulk Import Company Follows</h2>
                  <p className="text-xs text-[#64748B]">
                    Paste a JSON array of company follow rules. Matches by slug or website domain and
                    creates unclaimed placeholder pages for missing followed companies.
                  </p>
                </div>
              <textarea
                rows={5}
                value={bulkJson}
                onChange={(e) => setBulkJson(e.target.value)}
                placeholder='[{"company":"rise-automation","follows":[{"company":"bdc-capital","name":"BDC Capital","website":"https://bdc.ca","reason":"Led their pre-seed","both_ways":true}]}]'
                className="w-full rounded border border-[#E2E8F0] px-3 py-2 font-mono text-xs"
              />
              {bulkError && (
                <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {bulkError}
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="inline-flex items-center gap-2 text-xs text-[#526579]">
                  <input
                    type="checkbox"
                    checked={bulkDryRun}
                    onChange={(e) => setBulkDryRun(e.target.checked)}
                    className="rounded border-[#CBD5E1]"
                  />
                  <span>Dry run (preview summary without writing)</span>
                </label>
                <button
                  type="button"
                  disabled={bulkRunning || !bulkJson.trim()}
                  onClick={async () => {
                    setBulkError('');
                    setBulkResult(null);
                    let parsed: unknown;
                    try {
                      parsed = JSON.parse(bulkJson);
                    } catch {
                      setBulkError('Invalid JSON syntax.');
                      return;
                    }
                    setBulkRunning(true);
                    try {
                      const res = await apiFetch<BulkImportCompanyFollowsResult>(
                        `/api/admin/company-follows/import?dry_run=${bulkDryRun ? 'true' : 'false'}`,
                        {
                          method: 'POST',
                          body: JSON.stringify(parsed),
                        }
                      );
                      setBulkResult(res);
                      if (!bulkDryRun) {
                        await loadData();
                      }
                    } catch (err: any) {
                      setBulkError(err.message || 'Bulk import failed');
                    } finally {
                      setBulkRunning(false);
                    }
                  }}
                  className="rounded bg-[#243B53] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#1B2D40] disabled:opacity-50"
                >
                  {bulkRunning ? 'Running...' : bulkDryRun ? 'Preview Import' : 'Run Import'}
                </button>
              </div>
              {bulkResult && (
                <div className="rounded border border-[#E2E8F0] bg-[#F7F9FB] p-3 text-xs space-y-1.5">
                  <div className="font-semibold text-[#1F2937]">
                    {bulkResult.dryRun ? 'Dry-Run Summary' : 'Import Summary'}:{' '}
                    {bulkResult.created.length} created · {bulkResult.skipped.length} skipped ·{' '}
                    {bulkResult.placeholdersCreated.length} placeholders ·{' '}
                    {bulkResult.notMatched.length} not matched
                  </div>
                  {bulkResult.placeholdersCreated.length > 0 && (
                    <p className="text-[#526579]">
                      Placeholders:{' '}
                      {bulkResult.placeholdersCreated
                        .map((p) => `${p.name} (${p.slug})`)
                        .join(', ')}
                    </p>
                  )}
                  {bulkResult.notMatched.length > 0 && (
                    <p className="text-red-700">
                      Not matched: {bulkResult.notMatched.map((m) => m.company).join(', ')}
                    </p>
                  )}
                </div>
              )}
              </div>
            </div>

            <div className="rounded-md border border-[#E2E8F0] bg-white divide-y divide-[#E2E8F0]">
            {companiesList.map((comp) => (
              <div
                key={comp.id}
                className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-[#F7F9FB]"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/c/${comp.slug}`}
                      className="text-sm font-semibold text-[#1F2937] hover:underline"
                    >
                      {comp.name}
                    </Link>
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        comp.status === 'active'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-red-50 text-red-800 border border-red-200'
                      }`}
                    >
                      {comp.status}
                    </span>
                  </div>
                  <p className="text-xs text-[#64748B]">
                    {comp.industry} · {comp.headquarters} · {comp.companySize}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleToggleCompanyStatus(comp.id, comp.status)}
                  className={`rounded px-3 py-1 text-xs font-medium ${
                    comp.status === 'active'
                      ? 'border border-red-300 bg-red-50 text-red-800 hover:bg-red-100'
                      : 'bg-[#243B53] text-white'
                  }`}
                >
                  {comp.status === 'active' ? 'Suspend Company' : 'Reactivate Company'}
                </button>
              </div>
            ))}
            </div>
          </div>
        ) : tab === 'reports' ? (
          <div className="rounded-md border border-[#E2E8F0] bg-white divide-y divide-[#E2E8F0]">
            {reportsList.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#64748B]">
                No moderation or abuse reports in queue.
              </div>
            ) : (
              reportsList.map((rep) => (
                <div key={rep.id} className="p-4 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-[#243B53] px-2 py-0.5 text-[10px] font-semibold uppercase text-white">
                        {rep.targetType}
                      </span>
                      <span className="text-xs font-semibold text-[#1F2937]">{rep.reason}</span>
                      <span className="rounded border border-[#E2E8F0] bg-[#F7F9FB] px-2 py-0.5 text-[10px] uppercase text-[#526579]">
                        Status: {rep.status}
                      </span>
                    </div>
                    <span className="text-[11px] text-[#64748B]">
                      Reported by {rep.reporterName} · {formatRelativeTime(rep.createdAt)}
                    </span>
                  </div>

                  {rep.targetSummary && (
                    <div className="rounded border border-[#E2E8F0] bg-[#F7F9FB] p-2.5 text-xs text-[#1F2937]">
                      {rep.targetSummary}
                    </div>
                  )}

                  {rep.details && (
                    <p className="text-xs text-[#526579]">Reporter Notes: {rep.details}</p>
                  )}

                  {rep.status === 'open' && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleReviewReport(rep.id, 'dismissed', false)}
                        className="rounded border border-[#E2E8F0] px-2.5 py-1 text-xs font-medium text-[#526579] hover:bg-[#F7F9FB]"
                      >
                        Dismiss Report
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReviewReport(rep.id, 'reviewed', false)}
                        className="rounded border border-[#243B53] px-2.5 py-1 text-xs font-medium text-[#243B53]"
                      >
                        Mark Reviewed
                      </button>
                      {rep.targetType === 'announcement' && (
                        <button
                          type="button"
                          onClick={() => handleReviewReport(rep.id, 'actioned', true)}
                          className="rounded bg-red-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-800"
                        >
                          Remove Announcement & Action Report
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="rounded-md border border-[#E2E8F0] bg-white p-5 space-y-4">
            <form onSubmit={handleAddCategory} className="flex items-center gap-2">
              <input
                type="text"
                required
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="New announcement category name..."
                className="flex-1 rounded border border-[#E2E8F0] px-3 py-1.5 text-xs text-[#1F2937]"
              />
              <button
                type="submit"
                className="rounded bg-[#243B53] px-3.5 py-1.5 text-xs font-semibold text-white"
              >
                Add Category
              </button>
            </form>

            <div className="divide-y divide-[#E2E8F0] border border-[#E2E8F0] rounded">
              {categoriesList.map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center justify-between px-3.5 py-2.5 text-xs"
                >
                  <div>
                    <span className="font-semibold text-[#1F2937]">{cat.name}</span>{' '}
                    <span className="text-[#64748B]">({cat.slug})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleCategory(cat.id, cat.isActive)}
                    className={`rounded px-2.5 py-1 text-xs font-medium ${
                      cat.isActive === 1
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {cat.isActive === 1 ? 'Active' : 'Disabled'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

