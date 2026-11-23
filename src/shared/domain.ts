/**
 * Domain normalization and email-to-company claiming verification helpers.
 */

export const FREE_EMAIL_DOMAINS = new Set<string>([
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'yahoo.com',
  'ymail.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'proton.me',
  'protonmail.com',
  'pm.me',
  'aol.com',
  'mail.com',
  'gmx.com',
  'gmx.net',
  'zoho.com',
  'tutanota.com',
  'tuta.io',
  'fastmail.com',
]);

const MULTI_PART_TLDS = new Set<string>([
  'co.uk',
  'org.uk',
  'ac.uk',
  'gov.uk',
  'com.au',
  'net.au',
  'org.au',
  'co.nz',
  'co.jp',
  'co.in',
  'com.br',
  'com.mx',
  'co.za',
  'qc.ca',
  'on.ca',
  'bc.ca',
  'ab.ca',
]);

/**
 * Extracts and normalizes a hostname from a URL or domain string (lowercase, strips leading www.).
 */
export function extractHostname(urlOrDomain: string | null | undefined): string | null {
  const raw = (urlOrDomain || '').trim().toLowerCase();
  if (!raw) return null;

  try {
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const parsed = new URL(withScheme);
    let host = parsed.hostname.toLowerCase().replace(/\.+$/, '');
    if (host.startsWith('www.')) {
      host = host.slice(4);
    }
    if (!host || !host.includes('.')) return null;
    return host;
  } catch {
    return null;
  }
}

/**
 * Returns the registrable domain (e.g. "app.riseautomation.ca" -> "riseautomation.ca").
 */
export function getRegistrableDomain(urlOrDomain: string | null | undefined): string | null {
  const host = extractHostname(urlOrDomain);
  if (!host) return null;

  const parts = host.split('.').filter(Boolean);
  if (parts.length <= 2) return parts.join('.');

  const lastTwo = parts.slice(-2).join('.');
  if (MULTI_PART_TLDS.has(lastTwo) && parts.length >= 3) {
    return parts.slice(-3).join('.');
  }
  return lastTwo;
}

/**
 * Checks whether a user's email address is eligible to claim a company page
 * based on its website domain.
 */
export function canEmailClaimCompany(
  userEmail: string,
  companyWebsite: string | null | undefined
): { allowed: boolean; companyDomain: string | null; reason?: string } {
  const companyDomain = getRegistrableDomain(companyWebsite);
  if (!companyDomain) {
    return {
      allowed: false,
      companyDomain: null,
      reason: 'This company page does not have a website domain configured for self-service claiming.',
    };
  }

  const emailParts = (userEmail || '').trim().toLowerCase().split('@');
  if (emailParts.length !== 2 || !emailParts[1]) {
    return {
      allowed: false,
      companyDomain,
      reason: `Sign in with an email at ${companyDomain} to claim this page.`,
    };
  }

  const emailHost = emailParts[1].replace(/^www\./, '');
  const emailDomain = getRegistrableDomain(emailHost);

  if (!emailDomain || FREE_EMAIL_DOMAINS.has(emailHost) || FREE_EMAIL_DOMAINS.has(emailDomain)) {
    return {
      allowed: false,
      companyDomain,
      reason: `Sign in with an email at ${companyDomain} to claim this page.`,
    };
  }

  if (emailDomain !== companyDomain) {
    return {
      allowed: false,
      companyDomain,
      reason: `Sign in with an email at ${companyDomain} to claim this page.`,
    };
  }

  return { allowed: true, companyDomain };
}
