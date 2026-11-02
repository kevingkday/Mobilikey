import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, MailCheck } from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { useAuth } from '../lib/auth-context';
import { apiFetch } from '../lib/api';

export function SettingsPage() {
  const { user, refreshUser, setUserDirect } = useAuth();
  const navigate = useNavigate();

  const [isPublic, setIsPublic] = useState(user?.isPublic ?? true);
  const [allowLevel1Messages, setAllowLevel1Messages] = useState(
    user?.allowLevel1Messages ?? true
  );
  const [directMessages, setDirectMessages] = useState(
    user?.emailNotifPrefs?.directMessages ?? true
  );
  const [recognizedMessages, setRecognizedMessages] = useState(
    user?.emailNotifPrefs?.recognizedMessages ?? true
  );
  const [accessPromotions, setAccessPromotions] = useState(
    user?.emailNotifPrefs?.accessPromotions ?? true
  );
  const [generalRequests, setGeneralRequests] = useState(
    user?.emailNotifPrefs?.generalRequests ?? false
  );

  const [saving, setSaving] = useState(false);
  const [savedBanner, setSavedBanner] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (user) {
      setIsPublic(user.isPublic);
      setAllowLevel1Messages(user.allowLevel1Messages);
      setDirectMessages(user.emailNotifPrefs.directMessages);
      setRecognizedMessages(user.emailNotifPrefs.recognizedMessages);
      setAccessPromotions(user.emailNotifPrefs.accessPromotions);
      setGeneralRequests(user.emailNotifPrefs.generalRequests);
    }
  }, [user]);

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSavedBanner(false);
    try {
      await apiFetch('/api/users/me/settings', {
        method: 'PUT',
        body: JSON.stringify({
          isPublic,
          allowLevel1Messages,
          emailNotifPrefs: {
            directMessages,
            recognizedMessages,
            accessPromotions,
            generalRequests,
          },
        }),
      });
      await refreshUser();
      setSavedBanner(true);
    } finally {
      setSaving(false);
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
          <h1 className="text-lg font-bold text-[#1F2937]">Account, Privacy & Notification Settings</h1>
          <p className="text-xs text-[#64748B]">
            Control profile visibility, inbound Level 1 request policies, and email alerts.
          </p>
        </div>

        {savedBanner && (
          <div className="flex items-center gap-2 rounded border border-[#287D7D]/30 bg-[#287D7D]/10 px-4 py-2.5 text-xs font-medium text-[#1D5E5E]">
            <CheckCircle2 className="h-4 w-4 text-[#287D7D]" />
            <span>Settings updated.</span>
          </div>
        )}

        {/* Email Verification Status */}
        <div className="rounded-md border border-[#E2E8F0] bg-white p-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-[#1F2937]">Account Email Address</h2>
            <p className="text-xs text-[#64748B]">
              {user?.email} (Never displayed on your public profile)
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
            <h2 className="text-sm font-bold text-[#1F2937]">Privacy & Inbound Messaging</h2>

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
                  Accept Level 1 General Access Requests
                </span>
                <span className="block text-xs text-[#64748B]">
                  Allow any professional to send an initial inquiry to your low-priority General
                  Requests inbox. If disabled, only contacts you have already granted Level 2 or
                  Level 3 access can message you.
                </span>
              </div>
            </label>
          </div>

          {/* Configurable Email Notifications */}
          <div className="space-y-3 border-t border-[#E2E8F0] pt-5">
            <h2 className="text-sm font-bold text-[#1F2937]">Email Notification Preferences</h2>
            <p className="text-xs text-[#64748B]">
              Disable nonessential email notifications at any time.
            </p>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={directMessages}
                onChange={(e) => setDirectMessages(e.target.checked)}
                className="h-4 w-4 rounded border-[#CBD5E1] text-[#243B53]"
              />
              <span className="text-xs text-[#1F2937]">
                <strong>Level 3 Direct Access Messages</strong> — Immediate email notification when
                a Direct contact messages you
              </span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={recognizedMessages}
                onChange={(e) => setRecognizedMessages(e.target.checked)}
                className="h-4 w-4 rounded border-[#CBD5E1] text-[#243B53]"
              />
              <span className="text-xs text-[#1F2937]">
                <strong>Level 2 Recognized Access Messages</strong> — Email notification for
                Recognized contacts
              </span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={accessPromotions}
                onChange={(e) => setAccessPromotions(e.target.checked)}
                className="h-4 w-4 rounded border-[#CBD5E1] text-[#243B53]"
              />
              <span className="text-xs text-[#1F2937]">
                <strong>Access Level Updates</strong> — Notify me when a professional or company
                grants me Recognized or Direct Access
              </span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={generalRequests}
                onChange={(e) => setGeneralRequests(e.target.checked)}
                className="h-4 w-4 rounded border-[#CBD5E1] text-[#243B53]"
              />
              <span className="text-xs text-[#1F2937]">
                <strong>Level 1 General Requests Digest</strong> — Email notification for cold
                General Requests (off by default)
              </span>
            </label>
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

