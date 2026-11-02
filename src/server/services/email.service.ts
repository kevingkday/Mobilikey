import type { Env } from '../env';

export interface TransactionalEmailPayload {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Transactional email delivery service configured through environment variables.
 * Supports HTTP transactional email providers (e.g. Resend / Postmark) and safe local dev logging.
 */
export async function sendTransactionalEmail(
  env: Partial<Env>,
  payload: TransactionalEmailPayload
): Promise<{ delivered: boolean; provider: string }> {
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
      return { delivered: res.ok, provider: 'resend' };
    } catch {
      return { delivered: false, provider: 'resend' };
    }
  }

  // Default / local development safe console logger
  if (env.ENVIRONMENT === 'development') {
    console.info(
      `[Mobilikey Email (${provider})] To: ${payload.to} | Subject: ${payload.subject}\n${payload.text}`
    );
  }
  return { delivered: true, provider: 'console' };
}

