import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, MailCheck, Mail, Send, Shield } from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { AccessBadge } from '../components/ui/AccessBadge';
import { useAuth } from '../lib/auth-context';
import { apiFetch } from '../lib/api';

export function SettingsPage() {
  const { user, refreshUser, setUserDirect } = useAuth();
  const navigate = useNavigate();

  const [isPublic, setIsPublic] = useState(user?.isPublic ?? true);
  const [allowLevel1Messages, setAllowLevel1Messages] = useState(
    user?.allowLevel1Messages ?? true
  );
  const [accessPromotions, setAccessPromotions] = useState(
    user?.emailNotifPrefs?.accessPromotions ?? true
  );

  // Per-level email forwarding state (Level 1, Level 2, Level 3)
  const [level1Enabled, setLevel1Enabled] = useState(
    user?.emailNotifPrefs?.forwarding?.level1?.enabled ??
      user?.emailNotifPrefs?.generalRequests ??
      false
  );
  const [level1Email, setLevel1Email] = useState(
    user?.emailNotifPrefs?.forwarding?.level1?.email || ''
  );

  const [level2Enabled, setLevel2Enabled] = useState(
    user?.emailNotifPrefs?.forwarding?.level2?.enabled ??
      user?.emailNotifPrefs?.recognizedMessages ??
      true
  );
  const [level2Email, setLevel2Email] = useState(
    user?.emailNotifPrefs?.forwarding?.level2?.email || ''
  );

  const [level3Enabled, setLevel3Enabled] = useState(
    user?.emailNotifPrefs?.forwarding?.level3?.enabled ??
      user?.emailNotifPrefs?.directMessages ??
      true
  );
  const [level3Email, setLevel3Email] = useState(
    user?.emailNotifPrefs?.forwarding?.level3?.email || ''
  );

  const [saving, setSaving] = useState(false);
  const [savedBanner, setSavedBanner] = useState('');
  const [errorBanner, setErrorBanner] = useState('');
  const [testingLevel, setTestingLevel] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (user) {
      setIsPublic(user.isPublic);
      setAllowLevel1Messages(user.allowLevel1Messages);
      setAccessPromotions(user.emailNotifPrefs.accessPromotions);

      setLevel1Enabled(
        user.emailNotifPrefs.forwarding?.level1?.enabled ??
          user.emailNotifPrefs.generalRequests ??
          false
      );
      setLevel1Email(user.emailNotifPrefs.forwarding?.level1?.email || '');

      setLevel2Enabled(
        user.emailNotifPrefs.forwarding?.level2?.enabled ??
          user.emailNotifPrefs.recognizedMessages ??
          true
      );
      setLevel2Email(user.emailNotifPrefs.forwarding?.level2?.email || '');

      setLevel3Enabled(
        user.emailNotifPrefs.forwarding?.level3?.enabled ??
          user.emailNotifPrefs.directMessages ??
          true
      );
      setLevel3Email(user.emailNotifPrefs.forwarding?.level3?.email || '');
    }
  }, [user]);

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSavedBanner('');
    setErrorBanner('');
    try {
      await apiFetch('/api/users/me/settings', {
        method: 'PUT',
        body: JSON.stringify({
          isPublic,
          allowLevel1Messages,
          emailNotifPrefs: {
            directMessages: level3Enabled,
            recognizedMessages: level2Enabled,
            accessPromotions,
            generalRequests: level1Enabled,
            forwarding: {
              level1: {
                enabled: level1Enabled,
                email: level1Email.trim(),
              },
              level2: {
                enabled: level2Enabled,
                email: level2Email.trim(),
              },
              level3: {
                enabled: level3Enabled,
                email: level3Email.trim(),
              },
            },
          },
        }),
      });
      await refreshUser();
      setSavedBanner('Account, privacy, and per-level email forwarding settings saved.');
    } catch (err: any) {
      setErrorBanner(err.message || 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  }

  async function handleTestForwarding(level: 1 | 2 | 3) {
    setTestingLevel(level);
    setSavedBanner('');
    setErrorBanner('');
    try {
      // Save current settings first so the test uses the latest inputs
      await apiFetch('/api/users/me/settings', {
        method: 'PUT',
        body: JSON.stringify({
          isPublic,
          allowLevel1Messages,
          emailNotifPrefs: {
            directMessages: level3Enabled,
            recognizedMessages: level2Enabled,
            accessPromotions,
            generalRequests: level1Enabled,
            forwarding: {
              level1: { enabled: level1Enabled, email: level1Email.trim() },
              level2: { enabled: level2Enabled, email: level2Email.trim() },
              level3: { enabled: level3Enabled, email: level3Email.trim() },
            },
          },
        }),
      });
      await refreshUser();

      const res = await apiFetch<{ targetEmail: string; level: number }>(
        '/api/users/me/test-forwarding',
        {
          method: 'POST',
          body: JSON.stringify({ level }),
        }
      );
      setSavedBanner(
        `Level ${res.level} test forwarding message routed to ${res.targetEmail}.`
      );
    } catch (err: any) {
      setErrorBanner(err.message || 'Could not send test forwarding email.');
    } finally {
      setTestingLevel(null);
    }
  }

  async function handleVerifyEmail() {
    await apiFetch('/api/auth/verify-email', { method: 'POST' });
    await refreshUser();
  }

  async function handleDeleteAccount() {
    await apiFetch('/api/users/me', { method: 'DELETE' });
    setUserDirect(null);
    navigate('/');
  }

  return (
    <AppShell>
      <div className="space-y-5 max-w-2xl">
        <div className="rounded-md border border-[#E2E8F0] bg-white p-4">
          <h1 className="text-lg font-bold text-[#1F2937]">
            Account, Privacy & Per-Level Email Forwarding
          </h1>
          <p className="text-xs text-[#64748B]">
            Control profile visibility, inbound Level 1 request policies, and custom email
            forwarding addresses for each access level (Level 1, Level 2, and Level 3).
          </p>
        </div>

        {savedBanner && (
          <div className="flex items-center gap-2 rounded border border-[#287D7D]/30 bg-[#287D7D]/10 px-4 py-2.5 text-xs font-medium text-[#1D5E5E]">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-[#287D7D]" />
            <span>{savedBanner}</span>
          </div>
        )}

        {errorBanner && (
          <div className="rounded border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-medium text-red-700">
            {errorBanner}
          </div>
        )}

        {/* Email Verification Status */}
        <div className="rounded-md border border-[#E2E8F0] bg-white p-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-[#1F2937]">Primary Account Email</h2>
            <p className="text-xs text-[#64748B]">
              {user?.email} (Never displayed on your public profile or revealed to senders)
            </p>
          </div>
          {user?.emailVerifiedAt ? (
            <span className="inline-flex items-center gap-1 rounded border border-[#287D7D]/30 bg-[#287D7D]/10 px-2.5 py-1 text-xs font-medium text-[#1D5E5E]">
              <MailCheck className="h-3.5 w-3.5" />
              Verified
            </span>
          ) : (
            <button
              type="button"
              onClick={handleVerifyEmail}
              className="rounded border border-[#243B53] px-3 py-1.5 text-xs font-medium text-[#243B53] hover:bg-[#243B53] hover:text-white"
            >
              Confirm Email Verification
            </button>
          )}
        </div>

        <form
          onSubmit={handleSaveSettings}
          className="rounded-md border border-[#E2E8F0] bg-white p-5 space-y-6"
        >
          {/* Privacy & Inbound Access Controls */}
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-[#1F2937]">Privacy & Follower Access Rules</h2>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-[#CBD5E1] text-[#243B53]"
              />
              <div>
                <span className="block text-xs font-semibold text-[#1F2937]">
                  Public Directory Visibility
                </span>
                <span className="block text-xs text-[#64748B]">
                  Allow your professional profile to be viewed publicly. When disabled, only
                  signed-in Mobilikey members can view your profile.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={allowLevel1Messages}
                onChange={(e) => setAllowLevel1Messages(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-[#CBD5E1] text-[#243B53]"
              />
              <div>
                <span className="block text-xs font-semibold text-[#1F2937]">
                  Accept Level 1 General Access Messages from Followers
                </span>
                <span className="block text-xs text-[#64748B]">
                  Professionals must follow you before messaging and start at Level 1 (General
                  Access) by default. You can promote or downgrade any follower between Level 1,
                  Level 2, and Level 3 in My Network → Followers.
                </span>
              </div>
            </label>
          </div>

          {/* Per-Level Email Forwarding Routing */}
          <div className="space-y-4 border-t border-[#E2E8F0] pt-5">
            <div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-[#243B53]" />
                <h2 className="text-sm font-bold text-[#1F2937]">
                  Per-Level Email Forwarding (Tiered Inbox Routing)
                </h2>
              </div>
              <p className="mt-1 text-xs text-[#64748B] leading-relaxed">
                Choose whether inbound Mobilikey messages are forwarded to your email, and assign a
                <strong> different destination email for each access level</strong> (for example,{' '}
                <code>info@company.com</code> for Level 1, a work inbox for Level 2, and your
                personal or executive email for Level 3). Senders never see your forwarding email
                addresses.
              </p>
            </div>

            {/* Level 3 Direct Access Tier */}
            <div className="rounded-md border border-[#243B53]/25 bg-[#F7F9FB] p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AccessBadge level={3} />
                  <span className="text-xs font-semibold text-[#1F2937]">
                    Trusted Peers & Executive Contacts
                  </span>
                </div>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={level3Enabled}
                    onChange={(e) => setLevel3Enabled(e.target.checked)}
                    className="h-4 w-4 rounded border-[#CBD5E1] text-[#243B53]"
                  />
                  <span className="text-xs font-semibold text-[#1F2937]">
                    Forward Level 3 to Email
                  </span>
                </label>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="flex-1">
                  <label className="block text-[11px] font-medium text-[#526579] mb-1">
                    Level 3 Forwarding Email (e.g. personal or direct VIP email)
                  </label>
                  <input
                    type="email"
                    disabled={!level3Enabled}
                    value={level3Email}
                    onChange={(e) => setLevel3Email(e.target.value)}
                    placeholder={`Default: ${user?.email || 'your primary email'}`}
                    className="w-full rounded border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs text-[#1F2937] focus:border-[#243B53] focus:outline-none disabled:bg-[#F1F5F9] disabled:text-[#94A3B8]"
                  />
                </div>
                <div className="sm:pt-4">
                  <button
                    type="button"
                    disabled={!level3Enabled || testingLevel === 3}
                    onClick={() => handleTestForwarding(3)}
                    className="inline-flex items-center gap-1 rounded border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs font-medium text-[#243B53] hover:bg-[#F7F9FB] disabled:opacity-50"
                  >
                    <Send className="h-3 w-3" />
                    <span>{testingLevel === 3 ? 'Sending...' : 'Test Level 3'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Level 2 Recognized Access Tier */}
            <div className="rounded-md border border-[#287D7D]/25 bg-[#F7F9FB] p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AccessBadge level={2} />
                  <span className="text-xs font-semibold text-[#1F2937]">
                    Known Industry Counterparties
                  </span>
                </div>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={level2Enabled}
                    onChange={(e) => setLevel2Enabled(e.target.checked)}
                    className="h-4 w-4 rounded border-[#CBD5E1] text-[#243B53]"
                  />
                  <span className="text-xs font-semibold text-[#1F2937]">
                    Forward Level 2 to Email
                  </span>
                </label>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="flex-1">
                  <label className="block text-[11px] font-medium text-[#526579] mb-1">
                    Level 2 Forwarding Email (e.g. secondary work or deals@ email)
                  </label>
                  <input
                    type="email"
                    disabled={!level2Enabled}
                    value={level2Email}
                    onChange={(e) => setLevel2Email(e.target.value)}
                    placeholder={`Default: ${user?.email || 'your primary email'}`}
                    className="w-full rounded border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs text-[#1F2937] focus:border-[#243B53] focus:outline-none disabled:bg-[#F1F5F9] disabled:text-[#94A3B8]"
                  />
                </div>
                <div className="sm:pt-4">
                  <button
                    type="button"
                    disabled={!level2Enabled || testingLevel === 2}
                    onClick={() => handleTestForwarding(2)}
                    className="inline-flex items-center gap-1 rounded border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs font-medium text-[#243B53] hover:bg-[#F7F9FB] disabled:opacity-50"
                  >
                    <Send className="h-3 w-3" />
                    <span>{testingLevel === 2 ? 'Sending...' : 'Test Level 2'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Level 1 General Access Tier */}
            <div className="rounded-md border border-[#E2E8F0] bg-[#F7F9FB] p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AccessBadge level={1} />
                  <span className="text-xs font-semibold text-[#1F2937]">
                    New Followers & General Outreach
                  </span>
                </div>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={level1Enabled}
                    onChange={(e) => setLevel1Enabled(e.target.checked)}
                    className="h-4 w-4 rounded border-[#CBD5E1] text-[#243B53]"
                  />
                  <span className="text-xs font-semibold text-[#1F2937]">
                    Forward Level 1 to Email
                  </span>
                </label>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="flex-1">
                  <label className="block text-[11px] font-medium text-[#526579] mb-1">
                    Level 1 Forwarding Email (e.g. info@company.com or intake inbox)
                  </label>
                  <input
                    type="email"
                    disabled={!level1Enabled}
                    value={level1Email}
                    onChange={(e) => setLevel1Email(e.target.value)}
                    placeholder={`e.g. info@yourdomain.com (or leave blank for ${user?.email || 'primary email'})`}
                    className="w-full rounded border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs text-[#1F2937] focus:border-[#243B53] focus:outline-none disabled:bg-[#F1F5F9] disabled:text-[#94A3B8]"
                  />
                </div>
                <div className="sm:pt-4">
                  <button
                    type="button"
                    disabled={!level1Enabled || testingLevel === 1}
                    onClick={() => handleTestForwarding(1)}
                    className="inline-flex items-center gap-1 rounded border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs font-medium text-[#243B53] hover:bg-[#F7F9FB] disabled:opacity-50"
                  >
                    <Send className="h-3 w-3" />
                    <span>{testingLevel === 1 ? 'Sending...' : 'Test Level 1'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Additional Notification Preferences */}
            <div className="pt-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={accessPromotions}
                  onChange={(e) => setAccessPromotions(e.target.checked)}
                  className="h-4 w-4 rounded border-[#CBD5E1] text-[#243B53]"
                />
                <span className="text-xs text-[#1F2937]">
                  <strong>Access Level Updates</strong> — Notify me when a professional or company
                  grants me Recognized (Level 2) or Direct (Level 3) Access
                </span>
              </label>
            </div>

            <div className="flex items-start gap-2 rounded border border-[#E2E8F0] bg-white p-3 text-[11px] text-[#64748B]">
              <Shield className="h-4 w-4 shrink-0 text-[#287D7D] mt-0.5" />
              <span>
                <strong>Privacy Guarantee:</strong> When a message is forwarded to your Level 1,
                Level 2, or Level 3 email address, the sender never sees which email address
                received it. If you downgrade a contact from Level 3 back to Level 1, their future
                messages immediately route to your Level 1 rule instead.
              </span>
            </div>
          </div>

          <div className="flex justify-end border-t border-[#E2E8F0] pt-4">
            <button
              type="submit"
              disabled={saving}
              className="rounded bg-[#243B53] px-5 py-2 text-xs font-semibold text-white hover:bg-[#1B2D40]"
            >
              {saving ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </form>

        {/* Account Deletion Workflow */}
        <div className="rounded-md border border-red-200 bg-white p-5 space-y-3">
          <div className="flex items-center gap-2 text-red-800">
            <AlertTriangle className="h-4 w-4" />
            <h2 className="text-sm font-bold">Account Deletion</h2>
          </div>
          <p className="text-xs text-[#526579]">
            Permanently deactivate your Mobilikey account, revoke active sessions, and scrub your
            public profile details.
          </p>
          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="rounded border border-red-300 bg-red-50 px-3.5 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-100"
            >
              Delete My Account
            </button>
          ) : (
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleDeleteAccount}
                className="rounded bg-red-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-800"
              >
                Confirm Permanent Deletion
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="rounded border border-[#E2E8F0] px-3 py-1.5 text-xs text-[#526579]"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
