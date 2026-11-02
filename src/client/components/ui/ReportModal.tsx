import React, { useState } from 'react';
import { X, Flag } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { apiFetch } from '../../lib/api';

const REPORT_REASONS = [
  'Engagement bait or non-business opinion commentary',
  'Unsolicited commercial spam or automated outreach',
  'Misleading or inaccurate company representation',
  'Harassment or unprofessional conduct',
  'Other policy violation',
];

export function ReportModal() {
  const { reportTarget, closeReportModal } = useAuth();
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  if (!reportTarget) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reportTarget) return;
    setError('');
    setSubmitting(true);

    try {
      await apiFetch('/api/announcements/report', {
        method: 'POST',
        body: JSON.stringify({
          targetType: reportTarget.targetType,
          targetId: reportTarget.targetId,
          reason,
          details,
        }),
      });
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Could not submit report.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    setSubmitted(false);
    setDetails('');
    setError('');
    closeReportModal();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F2937]/40 p-4">
      <div className="w-full max-w-md rounded-md border border-[#E2E8F0] bg-white shadow-lg">
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Flag className="h-4 w-4 text-[#526579]" />
            <h3 className="text-sm font-semibold text-[#1F2937]">Report Content or Account</h3>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded p-1 text-[#64748B] hover:bg-[#F7F9FB]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {submitted ? (
          <div className="p-5 space-y-4">
            <p className="text-sm text-[#1F2937]">
              Thank you. Your report regarding <strong>{reportTarget.targetLabel}</strong> has been
              logged for review by Mobilikey moderators.
            </p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleClose}
                className="rounded bg-[#243B53] px-4 py-1.5 text-xs font-medium text-white"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <p className="text-xs text-[#64748B]">
              Reporting: <span className="font-medium text-[#1F2937]">{reportTarget.targetLabel}</span>
            </p>

            {error && (
              <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-[#1F2937] mb-1">Reason</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded border border-[#E2E8F0] bg-white px-3 py-2 text-xs text-[#1F2937] focus:border-[#243B53] focus:outline-none"
              >
                {REPORT_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#1F2937] mb-1">
                Additional Context (Optional)
              </label>
              <textarea
                rows={3}
                maxLength={1000}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Provide factual context for moderation..."
                className="w-full rounded border border-[#E2E8F0] bg-white px-3 py-2 text-xs text-[#1F2937] focus:border-[#243B53] focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#E2E8F0]">
              <button
                type="button"
                onClick={handleClose}
                className="rounded border border-[#E2E8F0] px-3 py-1.5 text-xs font-medium text-[#526579]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded bg-[#243B53] px-4 py-1.5 text-xs font-medium text-white hover:bg-[#1B2D40] disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

