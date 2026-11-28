import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { and, eq, gt } from 'drizzle-orm';
import type { AppContext } from '../env';
import * as schema from '../db/schema';
import { SESSION_COOKIE_NAME } from '../middleware/auth';
import {
  generateId,
  generateRandomToken,
  sha256Hex,
  timingSafeEqualStr,
  verifyPassword,
} from '../services/auth.service';

const SCOPES_SUPPORTED = ['profile:read', 'profile:write', 'posts:read', 'posts:write'];
const ACCESS_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
const REFRESH_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days
const AUTH_CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function getOrigin(urlStr: string): string {
  return new URL(urlStr).origin;
}

function applyOAuthCors(headers: Headers) {
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function sha256Base64Url(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  const bytes = new Uint8Array(digest);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function isValidRedirectUri(uri: string): boolean {
  try {
    const u = new URL(uri);
    if (u.protocol === 'https:') return true;
    if (
      u.protocol === 'http:' &&
      (u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '[::1]')
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

async function getSessionUserFromCookie(
  db: AppContext['Variables']['db'],
  rawToken: string | undefined
) {
  if (!rawToken) return null;
  const tokenHash = await sha256Hex(rawToken);
  const now = Date.now();
  const rows = await db
    .select({
      userId: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      status: schema.users.status,
    })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.sessions.userId, schema.users.id))
    .where(and(eq(schema.sessions.sessionTokenHash, tokenHash), gt(schema.sessions.expiresAt, now)))
    .limit(1);

  const row = rows[0];
  if (!row || row.status !== 'active') return null;
  return row;
}

function renderAuthorizePage(opts: {
  clientName: string;
  clientId: string;
  redirectUri: string;
  scope: string;
  state: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  signedInUser: { name: string; email: string } | null;
  errorMessage?: string;
}): string {
  const scopeList = (opts.scope || SCOPES_SUPPORTED.join(' '))
    .split(/\s+/)
    .filter(Boolean);

  const scopeItems = scopeList
    .map((s) => `<li><code>${escapeHtml(s)}</code></li>`)
    .join('');

  const authFields = opts.signedInUser
    ? `<div class="user-box">
         Signed in as <strong>${escapeHtml(opts.signedInUser.name)}</strong> (${escapeHtml(opts.signedInUser.email)})
       </div>`
    : `<div class="field">
         <label for="email">Keylenta Email</label>
         <input id="email" name="email" type="email" required autocomplete="email" placeholder="you@company.com" />
       </div>
       <div class="field">
         <label for="password">Password</label>
         <input id="password" name="password" type="password" required autocomplete="current-password" />
       </div>`;

  const errorBanner = opts.errorMessage
    ? `<div class="error">${escapeHtml(opts.errorMessage)}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Authorize ${escapeHtml(opts.clientName)} — Keylenta</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #F7F9FB; color: #1E293B; margin: 0; padding: 24px; display: flex; min-height: 100vh; align-items: center; justify-content: center; }
    .card { background: #fff; border: 1px solid #E2E8F0; border-radius: 10px; max-width: 440px; width: 100%; padding: 28px; box-shadow: 0 4px 16px rgba(15, 23, 42, 0.06); }
    .brand { font-size: 13px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: #287D7D; margin-bottom: 8px; }
    h1 { font-size: 20px; margin: 0 0 8px; color: #0F172A; }
    p { font-size: 13px; color: #475569; line-height: 1.5; margin: 0 0 16px; }
    .scopes { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 12px 14px; margin-bottom: 18px; font-size: 12px; }
    .scopes ul { margin: 6px 0 0; padding-left: 18px; }
    .scopes li { margin: 3px 0; }
    .user-box { background: #F0FDF4; border: 1px solid #BBF7D0; color: #166534; border-radius: 6px; padding: 10px 12px; font-size: 12px; margin-bottom: 16px; }
    .error { background: #FEF2F2; border: 1px solid #FECACA; color: #991B1B; border-radius: 6px; padding: 10px 12px; font-size: 12px; margin-bottom: 16px; }
    .field { margin-bottom: 14px; }
    .field label { display: block; font-size: 12px; font-weight: 600; color: #334155; margin-bottom: 5px; }
    .field input { width: 100%; box-sizing: border-box; padding: 9px 11px; border: 1px solid #CBD5E1; border-radius: 6px; font-size: 13px; }
    .actions { display: flex; gap: 10px; margin-top: 18px; }
    button { flex: 1; padding: 10px 14px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; border: 1px solid transparent; }
    .btn-primary { background: #243B53; color: #fff; }
    .btn-primary:hover { background: #1B2D40; }
    .btn-secondary { background: #fff; color: #475569; border-color: #CBD5E1; }
    .btn-secondary:hover { background: #F8FAFC; }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand">Keylenta MCP</div>
    <h1>Authorize ${escapeHtml(opts.clientName)}</h1>
    <p><strong>${escapeHtml(opts.clientName)}</strong> is requesting permission to connect to your Keylenta account via MCP.</p>
    <div class="scopes">
      <strong>Requested permissions:</strong>
      <ul>${scopeItems}</ul>
    </div>
    ${errorBanner}
    <form method="POST" action="/oauth/authorize">
      <input type="hidden" name="client_id" value="${escapeHtml(opts.clientId)}" />
      <input type="hidden" name="redirect_uri" value="${escapeHtml(opts.redirectUri)}" />
      <input type="hidden" name="scope" value="${escapeHtml(opts.scope)}" />
      <input type="hidden" name="state" value="${escapeHtml(opts.state)}" />
      <input type="hidden" name="code_challenge" value="${escapeHtml(opts.codeChallenge)}" />
      <input type="hidden" name="code_challenge_method" value="${escapeHtml(opts.codeChallengeMethod)}" />
      ${authFields}
      <div class="actions">
        <button type="submit" name="action" value="deny" class="btn-secondary" formnovalidate>Deny</button>
        <button type="submit" name="action" value="allow" class="btn-primary">${opts.signedInUser ? 'Authorize' : 'Sign in & Authorize'}</button>
      </div>
    </form>
  </div>
</body>
</html>`;
}

export const oauthDiscoveryRoutes = new Hono<AppContext>();

oauthDiscoveryRoutes.options('/*', (c) => {
  const res = new Response(null, { status: 204 });
  applyOAuthCors(res.headers);
  return res;
});

function protectedResourceMetadata(origin: string) {
  return {
    resource: `${origin}/mcp`,
    authorization_servers: [origin],
    bearer_methods_supported: ['header'],
    scopes_supported: SCOPES_SUPPORTED,
  };
}

oauthDiscoveryRoutes.get('/oauth-protected-resource', (c) => {
  const origin = getOrigin(c.req.url);
  const res = c.json(protectedResourceMetadata(origin));
  applyOAuthCors(res.headers);
  return res;
});

oauthDiscoveryRoutes.get('/oauth-protected-resource/mcp', (c) => {
  const origin = getOrigin(c.req.url);
  const res = c.json(protectedResourceMetadata(origin));
  applyOAuthCors(res.headers);
  return res;
});

oauthDiscoveryRoutes.get('/oauth-authorization-server', (c) => {
  const origin = getOrigin(c.req.url);
  const res = c.json({
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/oauth/token`,
    registration_endpoint: `${origin}/oauth/register`,
    scopes_supported: SCOPES_SUPPORTED,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
    code_challenge_methods_supported: ['S256'],
  });
  applyOAuthCors(res.headers);
  return res;
});

export const oauthRoutes = new Hono<AppContext>();

oauthRoutes.options('/*', (c) => {
  const res = new Response(null, { status: 204 });
  applyOAuthCors(res.headers);
  return res;
});

oauthRoutes.post('/register', async (c) => {
  const db = c.get('db');
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    const res = c.json({ error: 'invalid_client_metadata', error_description: 'Invalid JSON body' }, 400);
    applyOAuthCors(res.headers);
    return res;
  }

  const rawRedirectUris = Array.isArray((body as any).redirect_uris) ? (body as any).redirect_uris : [];
  const redirectUris = rawRedirectUris.filter(
    (u: unknown): u is string => typeof u === 'string' && isValidRedirectUri(u)
  );

  if (redirectUris.length === 0) {
    const res = c.json(
      {
        error: 'invalid_redirect_uri',
        error_description: 'At least one valid https:// or localhost redirect_uri is required.',
      },
      400
    );
    applyOAuthCors(res.headers);
    return res;
  }

  const clientName =
    typeof (body as any).client_name === 'string' && (body as any).client_name.trim()
      ? (body as any).client_name.trim().slice(0, 100)
      : 'MCP Client';

  const requestedAuthMethod = (body as any).token_endpoint_auth_method;
  const tokenEndpointAuthMethod =
    requestedAuthMethod === 'client_secret_post' || requestedAuthMethod === 'client_secret_basic'
      ? requestedAuthMethod
      : 'none';

  const clientId = `kl_client_${generateRandomToken(12)}`;
  const rawSecret = tokenEndpointAuthMethod === 'none' ? null : `kl_secret_${generateRandomToken(24)}`;
  const clientSecretHash = rawSecret ? await sha256Hex(rawSecret) : null;
  const now = Date.now();

  await db.insert(schema.oauthClients).values({
    id: generateId('oac'),
    clientId,
    clientSecretHash,
    clientName,
    redirectUrisJson: JSON.stringify(redirectUris),
    tokenEndpointAuthMethod,
    createdAt: now,
  });

  const res = c.json(
    {
      client_id: clientId,
      ...(rawSecret ? { client_secret: rawSecret } : {}),
      client_id_issued_at: Math.floor(now / 1000),
      client_name: clientName,
      redirect_uris: redirectUris,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: tokenEndpointAuthMethod,
    },
    201
  );
  applyOAuthCors(res.headers);
  return res;
});

oauthRoutes.get('/authorize', async (c) => {
  const db = c.get('db');
  const responseType = c.req.query('response_type') || '';
  const clientId = c.req.query('client_id') || '';
  const redirectUri = c.req.query('redirect_uri') || '';
  const scope = c.req.query('scope') || SCOPES_SUPPORTED.join(' ');
  const state = c.req.query('state') || '';
  const codeChallenge = c.req.query('code_challenge') || '';
  const codeChallengeMethod = c.req.query('code_challenge_method') || '';

  if (responseType !== 'code') {
    return c.text('Unsupported response_type. Expected "code".', 400);
  }
  if (!clientId || !redirectUri) {
    return c.text('Missing client_id or redirect_uri.', 400);
  }
  if (!codeChallenge || codeChallengeMethod !== 'S256') {
    return c.text('PKCE with code_challenge_method=S256 is required.', 400);
  }

  const clientRows = await db
    .select()
    .from(schema.oauthClients)
    .where(eq(schema.oauthClients.clientId, clientId))
    .limit(1);
  const client = clientRows[0];
  if (!client) {
    return c.text('Unknown OAuth client_id.', 400);
  }

  let registeredUris: string[] = [];
  try {
    registeredUris = JSON.parse(client.redirectUrisJson);
  } catch {
    registeredUris = [];
  }
  if (!registeredUris.includes(redirectUri)) {
    return c.text('Invalid redirect_uri for this client.', 400);
  }

  const signedInUser = await getSessionUserFromCookie(db, getCookie(c, SESSION_COOKIE_NAME));

  return c.html(
    renderAuthorizePage({
      clientName: client.clientName,
      clientId,
      redirectUri,
      scope,
      state,
      codeChallenge,
      codeChallengeMethod,
      signedInUser,
    })
  );
});

oauthRoutes.post('/authorize', async (c) => {
  const db = c.get('db');
  const form = await c.req.parseBody();

  const clientId = String(form.client_id || '');
  const redirectUri = String(form.redirect_uri || '');
  const scope = String(form.scope || SCOPES_SUPPORTED.join(' '));
  const state = String(form.state || '');
  const codeChallenge = String(form.code_challenge || '');
  const codeChallengeMethod = String(form.code_challenge_method || '');
  const action = String(form.action || 'allow');

  const clientRows = await db
    .select()
    .from(schema.oauthClients)
    .where(eq(schema.oauthClients.clientId, clientId))
    .limit(1);
  const client = clientRows[0];
  if (!client) {
    return c.text('Unknown OAuth client_id.', 400);
  }

  let registeredUris: string[] = [];
  try {
    registeredUris = JSON.parse(client.redirectUrisJson);
  } catch {
    registeredUris = [];
  }
  if (!registeredUris.includes(redirectUri)) {
    return c.text('Invalid redirect_uri for this client.', 400);
  }

  if (action === 'deny') {
    const target = new URL(redirectUri);
    target.searchParams.set('error', 'access_denied');
    if (state) target.searchParams.set('state', state);
    return c.redirect(target.toString(), 302);
  }

  if (!codeChallenge || codeChallengeMethod !== 'S256') {
    return c.text('PKCE with code_challenge_method=S256 is required.', 400);
  }

  let authorizedUser = await getSessionUserFromCookie(db, getCookie(c, SESSION_COOKIE_NAME));

  if (!authorizedUser) {
    const email = String(form.email || '').trim().toLowerCase();
    const password = String(form.password || '');

    if (!email || !password) {
      return c.html(
        renderAuthorizePage({
          clientName: client.clientName,
          clientId,
          redirectUri,
          scope,
          state,
          codeChallenge,
          codeChallengeMethod,
          signedInUser: null,
          errorMessage: 'Please enter your Keylenta email and password.',
        }),
        401
      );
    }

    const userRows = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);
    const u = userRows[0];
    const valid = u ? await verifyPassword(password, u.passwordHash) : false;

    if (!u || !valid || u.status !== 'active') {
      return c.html(
        renderAuthorizePage({
          clientName: client.clientName,
          clientId,
          redirectUri,
          scope,
          state,
          codeChallenge,
          codeChallengeMethod,
          signedInUser: null,
          errorMessage: 'Invalid email or password.',
        }),
        401
      );
    }

    authorizedUser = {
      userId: u.id,
      name: u.name,
      email: u.email,
      status: u.status,
    };
  }

  const rawCode = `kl_code_${generateRandomToken(24)}`;
  const codeHash = await sha256Hex(rawCode);
  const now = Date.now();

  await db.insert(schema.oauthCodes).values({
    id: generateId('ocd'),
    codeHash,
    clientId,
    userId: authorizedUser.userId,
    redirectUri,
    scope,
    codeChallenge,
    codeChallengeMethod,
    expiresAt: now + AUTH_CODE_TTL_MS,
    usedAt: null,
    createdAt: now,
  });

  const target = new URL(redirectUri);
  target.searchParams.set('code', rawCode);
  if (state) target.searchParams.set('state', state);
  return c.redirect(target.toString(), 302);
});

async function parseTokenRequestBody(c: any): Promise<Record<string, string>> {
  const ct = (c.req.header('Content-Type') || '').toLowerCase();
  if (ct.includes('application/json')) {
    const json = await c.req.json().catch(() => ({}));
    const out: Record<string, string> = {};
    if (json && typeof json === 'object') {
      for (const [k, v] of Object.entries(json)) {
        if (v !== undefined && v !== null) out[k] = String(v);
      }
    }
    return out;
  }
  const form = await c.req.parseBody().catch(() => ({}));
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(form)) {
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}

oauthRoutes.post('/token', async (c) => {
  const db = c.get('db');
  const params = await parseTokenRequestBody(c);

  let clientId = params.client_id || '';
  let clientSecret = params.client_secret || '';

  const authHeader = c.req.header('Authorization') || '';
  if (authHeader.startsWith('Basic ')) {
    try {
      const decoded = atob(authHeader.slice(6).trim());
      const idx = decoded.indexOf(':');
      if (idx !== -1) {
        clientId = decodeURIComponent(decoded.slice(0, idx));
        clientSecret = decodeURIComponent(decoded.slice(idx + 1));
      }
    } catch {
      // ignore malformed Basic header
    }
  }

  const clientRows = await db
    .select()
    .from(schema.oauthClients)
    .where(eq(schema.oauthClients.clientId, clientId))
    .limit(1);
  const client = clientRows[0];
  if (!client) {
    const res = c.json({ error: 'invalid_client', error_description: 'Unknown client_id' }, 401);
    applyOAuthCors(res.headers);
    return res;
  }

  if (client.clientSecretHash) {
    const providedHash = clientSecret ? await sha256Hex(clientSecret) : '';
    if (!providedHash || !timingSafeEqualStr(providedHash, client.clientSecretHash)) {
      const res = c.json({ error: 'invalid_client', error_description: 'Invalid client_secret' }, 401);
      applyOAuthCors(res.headers);
      return res;
    }
  }

  const grantType = params.grant_type || '';
  const now = Date.now();

  if (grantType === 'authorization_code') {
    const code = params.code || '';
    const redirectUri = params.redirect_uri || '';
    const codeVerifier = params.code_verifier || '';

    if (!code || !redirectUri || !codeVerifier) {
      const res = c.json({ error: 'invalid_request', error_description: 'Missing code, redirect_uri, or code_verifier' }, 400);
      applyOAuthCors(res.headers);
      return res;
    }

    const codeHash = await sha256Hex(code);
    const codeRows = await db
      .select()
      .from(schema.oauthCodes)
      .where(eq(schema.oauthCodes.codeHash, codeHash))
      .limit(1);
    const authCode = codeRows[0];

    if (
      !authCode ||
      authCode.usedAt !== null ||
      authCode.expiresAt <= now ||
      authCode.clientId !== client.clientId ||
      authCode.redirectUri !== redirectUri
    ) {
      const res = c.json({ error: 'invalid_grant', error_description: 'Invalid or expired authorization code' }, 400);
      applyOAuthCors(res.headers);
      return res;
    }

    const computedChallenge = await sha256Base64Url(codeVerifier);
    if (!timingSafeEqualStr(computedChallenge, authCode.codeChallenge)) {
      const res = c.json({ error: 'invalid_grant', error_description: 'PKCE verification failed' }, 400);
      applyOAuthCors(res.headers);
      return res;
    }

    await db
      .update(schema.oauthCodes)
      .set({ usedAt: now })
      .where(eq(schema.oauthCodes.id, authCode.id));

    const rawAccessToken = `kl_mcp_${generateRandomToken(24)}`;
    const accessTokenHash = await sha256Hex(rawAccessToken);
    const rawRefreshToken = `kl_rt_${generateRandomToken(24)}`;
    const refreshTokenHash = await sha256Hex(rawRefreshToken);

    await db.insert(schema.apiTokens).values({
      id: generateId('tok'),
      userId: authCode.userId,
      name: `OAuth: ${client.clientName}`.slice(0, 60),
      tokenHash: accessTokenHash,
      tokenPrefix: rawAccessToken.slice(0, 15) + '...',
      lastUsedAt: null,
      expiresAt: now + ACCESS_TOKEN_TTL_SECONDS * 1000,
      createdAt: now,
    });

    await db.insert(schema.oauthRefreshTokens).values({
      id: generateId('ort'),
      tokenHash: refreshTokenHash,
      clientId: client.clientId,
      userId: authCode.userId,
      scope: authCode.scope,
      expiresAt: now + REFRESH_TOKEN_TTL_MS,
      revokedAt: null,
      createdAt: now,
    });

    const res = c.json({
      access_token: rawAccessToken,
      token_type: 'Bearer',
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
      refresh_token: rawRefreshToken,
      scope: authCode.scope,
    });
    applyOAuthCors(res.headers);
    return res;
  }

  if (grantType === 'refresh_token') {
    const refreshToken = params.refresh_token || '';
    if (!refreshToken) {
      const res = c.json({ error: 'invalid_request', error_description: 'Missing refresh_token' }, 400);
      applyOAuthCors(res.headers);
      return res;
    }

    const rtHash = await sha256Hex(refreshToken);
    const rtRows = await db
      .select()
      .from(schema.oauthRefreshTokens)
      .where(eq(schema.oauthRefreshTokens.tokenHash, rtHash))
      .limit(1);
    const rt = rtRows[0];

    if (
      !rt ||
      rt.revokedAt !== null ||
      rt.expiresAt <= now ||
      rt.clientId !== client.clientId
    ) {
      const res = c.json({ error: 'invalid_grant', error_description: 'Invalid or expired refresh_token' }, 400);
      applyOAuthCors(res.headers);
      return res;
    }

    await db
      .update(schema.oauthRefreshTokens)
      .set({ revokedAt: now })
      .where(eq(schema.oauthRefreshTokens.id, rt.id));

    const rawAccessToken = `kl_mcp_${generateRandomToken(24)}`;
    const accessTokenHash = await sha256Hex(rawAccessToken);
    const newRawRefreshToken = `kl_rt_${generateRandomToken(24)}`;
    const newRefreshTokenHash = await sha256Hex(newRawRefreshToken);

    await db.insert(schema.apiTokens).values({
      id: generateId('tok'),
      userId: rt.userId,
      name: `OAuth: ${client.clientName}`.slice(0, 60),
      tokenHash: accessTokenHash,
      tokenPrefix: rawAccessToken.slice(0, 15) + '...',
      lastUsedAt: null,
      expiresAt: now + ACCESS_TOKEN_TTL_SECONDS * 1000,
      createdAt: now,
    });

    await db.insert(schema.oauthRefreshTokens).values({
      id: generateId('ort'),
      tokenHash: newRefreshTokenHash,
      clientId: client.clientId,
      userId: rt.userId,
      scope: rt.scope,
      expiresAt: now + REFRESH_TOKEN_TTL_MS,
      revokedAt: null,
      createdAt: now,
    });

    const res = c.json({
      access_token: rawAccessToken,
      token_type: 'Bearer',
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
      refresh_token: newRawRefreshToken,
      scope: rt.scope,
    });
    applyOAuthCors(res.headers);
    return res;
  }

  const res = c.json({ error: 'unsupported_grant_type' }, 400);
  applyOAuthCors(res.headers);
  return res;
});
