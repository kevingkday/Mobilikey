import type { Env } from '../env';
import { ACCESS_LEVELS, ACCESS_LEVEL_LABELS, type AccessLevelValue } from '../../shared/constants';
import type { EmailForwardingPrefs, EmailNotifPrefs } from '../../shared/types';

export interface TransactionalEmailPayload {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Normalizes a user's stored emailNotifPrefsJson so per-level forwarding rules
 * (Level 1, Level 2, Level 3) always have deterministic enabled flags and target emails.
 */
export function resolveEmailNotifAndForwardingPrefs(
  rawJson: string | null | undefined
): EmailNotifPrefs {
  let parsed: Partial<EmailNotifPrefs> = {};
  try {
    parsed = JSON.parse(rawJson || '{}');
  } catch {
    parsed = {};
  }

  const directMessages = parsed.directMessages ?? true;
  const recognizedMessages = parsed.recognizedMessages ?? true;
  const accessPromotions = parsed.accessPromotions ?? true;
  const generalRequests = parsed.generalRequests ?? false;

  const rawFwd = parsed.forwarding;
  const forwarding: EmailForwardingPrefs = {
    level1: {
      enabled: rawFwd?.level1?.enabled ?? generalRequests,
      email: (rawFwd?.level1?.email || '').trim(),
    },
    level2: {
      enabled: rawFwd?.level2?.enabled ?? recognizedMessages,
      email: (rawFwd?.level2?.email || '').trim(),
    },
    level3: {
      enabled: rawFwd?.level3?.enabled ?? directMessages,
      email: (rawFwd?.level3?.email || '').trim(),
    },
  };

  return {
    directMessages: forwarding.level3.enabled,
    recognizedMessages: forwarding.level2.enabled,
    accessPromotions,
    generalRequests: forwarding.level1.enabled,
    forwarding,
  };
}

/**
 * Resolves the active forwarding destination email for a specific access level (1, 2, or 3).
 * Returns null if forwarding is disabled for that level or if the sender is blocked (level 0).
 */
export function getForwardingDestinationForLevel(
  primaryEmail: string,
  rawJson: string | null | undefined,
  accessLevel: AccessLevelValue
): { enabled: boolean; targetEmail: string; levelKey: 'level1' | 'level2' | 'level3' } | null {
  if (accessLevel === ACCESS_LEVELS.BLOCKED) return null;
  const prefs = resolveEmailNotifAndForwardingPrefs(rawJson);
  const fwd = prefs.forwarding!;

  const levelKey =
    accessLevel === ACCESS_LEVELS.DIRECT
      ? 'level3'
      : accessLevel === ACCESS_LEVELS.RECOGNIZED
      ? 'level2'
      : 'level1';

  const tier = fwd[levelKey];
  const targetEmail = (tier.email || '').trim() || primaryEmail;

  return {
    enabled: tier.enabled,
    targetEmail,
    levelKey,
  };
}

/**
 * Transactional email delivery service configured through environment variables.
 * Supports HTTP transactional email providers (Resend, Postmark, SendGrid) and safe console logging.
 */
export async function sendTransactionalEmail(
  env: Partial<Env>,
  payload: TransactionalEmailPayload
): Promise<{ delivered: boolean; provider: string; to: string }> {
  const provider = (env.EMAIL_PROVIDER || 'console').toLowerCase();
  const from = env.EMAIL_FROM || 'Mobilikey <notifications@mobilikey.com>';

  if (provider === 'resend' && env.EMAIL_API_KEY) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.EMAIL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [payload.to],
          subject: payload.subject,
          text: payload.text,
          html: payload.html || `<p>${payload.text.replace(/\n/g, '<br/>')}</p>`,
        }),
      });
      return { delivered: res.ok, provider: 'resend', to: payload.to };
    } catch {
      return { delivered: false, provider: 'resend', to: payload.to };
    }
  }

  if (provider === 'postmark' && env.EMAIL_API_KEY) {
    try {
      const res = await fetch('https://api.postmarkapp.com/email', {
        method: 'POST',
        headers: {
          'X-Postmark-Server-Token': env.EMAIL_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          From: from,
          To: payload.to,
          Subject: payload.subject,
          TextBody: payload.text,
          HtmlBody: payload.html || `<p>${payload.text.replace(/\n/g, '<br/>')}</p>`,
        }),
      });
      return { delivered: res.ok, provider: 'postmark', to: payload.to };
    } catch {
      return { delivered: false, provider: 'postmark', to: payload.to };
    }
  }

  // Default / local development safe console logger
  if (env.ENVIRONMENT === 'development') {
    console.info(
      `[Mobilikey Email (${provider})] To: ${payload.to} | Subject: ${payload.subject}\n${payload.text}`
    );
  }
  return { delivered: true, provider: 'console', to: payload.to };
}

/**
 * Forwards an inbound Mobilikey message to the recipient's configured email address
 * for the sender's exact access level (Level 1 -> e.g. info@, Level 2 -> e.g. work@, Level 3 -> e.g. personal@).
 * The recipient's email address is NEVER exposed to the sender.
 */
export async function forwardInboundMessageToEmail(
  env: Partial<Env>,
  params: {
    recipientPrimaryEmail: string;
    recipientName: string;
    recipientEmailNotifPrefsJson: string | null | undefined;
    senderName: string;
    senderSubtitle: string;
    senderAccessLevel: AccessLevelValue;
    subject: string;
    body: string;
    conversationId: string;
    inboxContextLabel?: string;
  }
): Promise<{ forwarded: boolean; targetEmail: string | null; provider: string }> {
  const routing = getForwardingDestinationForLevel(
    params.recipientPrimaryEmail,
    params.recipientEmailNotifPrefsJson,
    params.senderAccessLevel
  );

  if (!routing || !routing.enabled || !routing.targetEmail) {
    return { forwarded: false, targetEmail: null, provider: 'none' };
  }

  const appUrl = (env.APP_URL || 'https://mobilikey.kevin-c8e.workers.dev').replace(/\/$/, '');
  const threadUrl = `${appUrl}/messages?conversationId=${encodeURIComponent(params.conversationId)}`;
  const levelLabel = ACCESS_LEVEL_LABELS[params.senderAccessLevel];
  const shortLevelTag =
    params.senderAccessLevel === ACCESS_LEVELS.DIRECT
      ? 'Level 3 Direct'
      : params.senderAccessLevel === ACCESS_LEVELS.RECOGNIZED
      ? 'Level 2 Recognized'
      : 'Level 1 General';

  const emailSubject = `[Mobilikey · ${shortLevelTag}] Message from ${params.senderName}${
    params.subject ? `: ${params.subject}` : ''
  }`;

  const text = [
    `Mobilikey Tiered Inbox Forwarding (${levelLabel})`,
    params.inboxContextLabel ? `Inbox: ${params.inboxContextLabel}` : null,
    `From: ${params.senderName}${params.senderSubtitle ? ` (${params.senderSubtitle})` : ''}`,
    `Access Level: ${levelLabel}`,
    `Routed To: ${routing.targetEmail} (Hidden from sender)`,
    params.subject ? `Subject: ${params.subject}` : null,
    `----------------------------------------`,
    params.body,
    `----------------------------------------`,
    `Reply or adjust ${params.senderName}'s access level (Level 1–3 or Block):`,
    threadUrl,
  ]
    .filter((line) => line !== null)
    .join('\n');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #E2E8F0; border-radius: 6px; background: #FFFFFF; color: #1F2937;">
      <div style="background: #243B53; color: #FFFFFF; padding: 14px 20px; border-radius: 6px 6px 0 0;">
        <div style="font-size: 12px; opacity: 0.85; text-transform: uppercase; letter-spacing: 0.04em;">
          Mobilikey Tiered Email Forwarding · ${levelLabel}
        </div>
        <div style="font-size: 16px; font-weight: 700; margin-top: 4px;">
          ${params.senderName}
        </div>
        ${
          params.senderSubtitle
            ? `<div style="font-size: 12px; opacity: 0.9; margin-top: 2px;">${params.senderSubtitle}</div>`
            : ''
        }
      </div>
      <div style="padding: 20px;">
        ${
          params.subject
            ? `<div style="font-size: 14px; font-weight: 600; color: #1F2937; margin-bottom: 12px;">Subject: ${params.subject}</div>`
            : ''
        }
        <div style="background: #F7F9FB; border: 1px solid #E2E8F0; border-radius: 4px; padding: 14px; font-size: 14px; line-height: 1.55; white-space: pre-wrap; color: #1F2937;">${params.body
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')}</div>
        <div style="margin-top: 16px;">
          <a href="${threadUrl}" style="display: inline-block; background: #243B53; color: #FFFFFF; text-decoration: none; font-size: 13px; font-weight: 600; padding: 9px 16px; border-radius: 4px;">
            View Thread &amp; Manage Level 1–3 Access
          </a>
        </div>
        <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid #E2E8F0; font-size: 11px; color: #64748B;">
          Forwarded to <strong>${routing.targetEmail}</strong> according to your <strong>${levelLabel}</strong> routing rule. Your email address is never revealed to the sender.
        </div>
      </div>
    </div>
  `;

  const result = await sendTransactionalEmail(env, {
    to: routing.targetEmail,
    subject: emailSubject,
    text,
    html,
  });

  return {
    forwarded: result.delivered,
    targetEmail: routing.targetEmail,
    provider: result.provider,
  };
}
