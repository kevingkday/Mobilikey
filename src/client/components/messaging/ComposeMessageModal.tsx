import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Send, Info } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { apiFetch } from '../../lib/api';
import { AccessBadge } from '../ui/AccessBadge';
import { ACCESS_LEVEL_DESCRIPTIONS, type AccessLevelValue } from '../../../shared/constants';

export function ComposeMessageModal() {
  const { composeTarget, closeComposeModal, refreshUnread } = useAuth();
  const navigate = useNavigate();

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!composeTarget) return null;

  const accessLevel = (composeTarget.accessLevel ?? 1) as AccessLevelValue;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!composeTarget) return;
    setError('');
    setSubmitting(true);

    try {
      const res = await apiFetch<{ conversationId: string }>('/api/messages/conversations', {
        method: 'POST',
        body: JSON.stringify({
          recipientType: composeTarget.type,
          recipientId: composeTarget.id,
          subject,
          body,
        }),
      });
      await refreshUnread();
      setSubject('');
      setBody('');
      closeComposeModal();
      navigate(`/messages?conversationId=${res.conversationId}`);
    } catch (err: any) {
      setError(err.message || 'Unable to send message');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F2937]/40 p-4">
      <div className="w-full max-w-lg rounded-md border border-[#E2E8F0] bg-white shadow-lg">
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-3.5">
          <div>
            <h3 className="text-sm font-semibold text-[#1F2937]">
              Message {composeTarget.name}
            </h3>
            {composeTarget.subtitle && (
              <p className="text-xs text-[#64748B]">{composeTarget.subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={closeComposeModal}
            className="rounded p-1 text-[#64748B] hover:bg-[#F7F9FB] hover:text-[#1F2937]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="rounded border border-[#E2E8F0] bg-[#F7F9FB] p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-[#526579]">
                Your Current Access to {composeTarget.name}:
              </span>
              <AccessBadge level={accessLevel} />
            </div>
            <p className="mt-1.5 flex items-start gap-1.5 text-xs text-[#64748B]">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[#526579]" />
              <span>{ACCESS_LEVEL_DESCRIPTIONS[accessLevel]}</span>
            </p>
          </div>

          {error && (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[#1F2937] mb-1">
              Subject <span className="text-[#64748B] font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              maxLength={140}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Concise business context (e.g. Q4 Supply Agreement)"
              className="w-full rounded border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#1F2937] focus:border-[#243B53] focus:outline-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-[#1F2937]">Message</label>
              <span className="text-[11px] text-[#64748B]">{body.length} / 4000</span>
            </div>
            <textarea
              required
              rows={5}
              maxLength={4000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={
                accessLevel === 1
                  ? 'Write a concise, relevant message. Level 1 General Requests appear in the recipient’s requests inbox until they recognize your contact.'
                  : 'Write your message...'
              }
              className="w-full rounded border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#1F2937] focus:border-[#243B53] focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E2E8F0]">
            <button
              type="button"
              onClick={closeComposeModal}
              className="rounded border border-[#E2E8F0] bg-white px-3.5 py-1.5 text-xs font-medium text-[#526579] hover:bg-[#F7F9FB]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !body.trim() || accessLevel === 0}
              className="inline-flex items-center gap-1.5 rounded bg-[#243B53] px-4 py-1.5 text-xs font-medium text-white hover:bg-[#1B2D40] disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              {submitting ? 'Sending...' : 'Send Message'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

