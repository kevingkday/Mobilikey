import { describe, it, expect, beforeEach } from 'vitest';
import app from '../src/server/index';
import { createTestDb } from './test-db-helper';
import type { Env } from '../src/server/env';

describe('Keylenta MCP Server & Personal Access Tokens', () => {
  let env: Env;

  beforeEach(() => {
    const { d1 } = createTestDb();
    env = {
      DB: d1,
      ENVIRONMENT: 'development',
      APP_URL: 'http://localhost:5173',
      EMAIL_PROVIDER: 'console',
    };
  });

  async function registerUser(name: string, email: string, password = 'Password123') {
    const res = await app.request(
      '/api/auth/signup',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          password,
          headline: 'VP of Product',
          companyName: 'Meridian Partners',
          position: 'VP of Product',
          location: 'Boston, MA',
          industry: 'Financial Services',
        }),
      },
      env
    );
    expect(res.status).toBe(201);
    const setCookieHeader = res.headers.get('set-cookie') || '';
    const cookieMatch = setCookieHeader.match(/keylenta_session=[^;]+/);
    const cookie = cookieMatch ? cookieMatch[0] : '';
    const data = (await res.json()) as any;
    return {
      user: data.user,
      cookie,
      csrfToken: data.user.csrfToken as string,
    };
  }

  async function createMcpToken(cookie: string, csrfToken: string, name = 'ChatGPT') {
    const res = await app.request(
      '/api/users/me/tokens',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: cookie,
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({ name }),
      },
      env
    );
    expect(res.status).toBe(201);
    return (await res.json()) as {
      token: { id: string; name: string; tokenPrefix: string };
      rawToken: string;
    };
  }

  async function mcpCall(token: string | null, body: unknown) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return app.request(
      '/mcp',
      {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      },
      env
    );
  }

  it('Handles CORS preflight and rejects unauthenticated /mcp requests with 401', async () => {
    const optRes = await app.request('/mcp', { method: 'OPTIONS' }, env);
    expect(optRes.status).toBe(204);
    expect(optRes.headers.get('Access-Control-Allow-Origin')).toBe('*');

    const noAuthRes = await mcpCall(null, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {},
    });
    expect(noAuthRes.status).toBe(401);
    expect(noAuthRes.headers.get('WWW-Authenticate')).toContain('Bearer');

    const badAuthRes = await mcpCall('kl_mcp_invalidtoken', {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {},
    });
    expect(badAuthRes.status).toBe(401);
  });

  it('Supports MCP handshake (initialize, notifications/initialized, ping, tools/list)', async () => {
    const alice = await registerUser('Alice Vance', 'alice@meridian.com');
    const { rawToken } = await createMcpToken(alice.cookie, alice.csrfToken, 'ChatGPT');

    const initRes = await mcpCall(rawToken, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2025-03-26', clientInfo: { name: 'ChatGPT', version: '1.0' } },
    });
    expect(initRes.status).toBe(200);
    const initJson = (await initRes.json()) as any;
    expect(initJson.result.protocolVersion).toBe('2025-03-26');
    expect(initJson.result.serverInfo.name).toBe('keylenta-mcp');
    expect(initJson.result.capabilities.tools).toBeDefined();

    const notifRes = await mcpCall(rawToken, {
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    });
    expect(notifRes.status).toBe(202);

    const pingRes = await mcpCall(rawToken, { jsonrpc: '2.0', id: 2, method: 'ping' });
    expect(pingRes.status).toBe(200);
    expect(((await pingRes.json()) as any).result).toEqual({});

    const listRes = await mcpCall(rawToken, { jsonrpc: '2.0', id: 3, method: 'tools/list' });
    expect(listRes.status).toBe(200);
    const tools = ((await listRes.json()) as any).result.tools;
    const toolNames = tools.map((t: any) => t.name);
    expect(toolNames).toEqual([
      'get_my_profile',
      'update_my_profile',
      'list_announcement_categories',
      'list_my_posts',
      'create_post',
      'update_post',
      'delete_post',
    ]);
  });

  it('Reads and partially updates user profile via MCP without clobbering omitted fields', async () => {
    const alice = await registerUser('Alice Vance', 'alice@meridian.com');
    const { rawToken } = await createMcpToken(alice.cookie, alice.csrfToken, 'Claude');

    // Partial update: only headline and expertise
    const updateRes = await mcpCall(rawToken, {
      jsonrpc: '2.0',
      id: 10,
      method: 'tools/call',
      params: {
        name: 'update_my_profile',
        arguments: {
          headline: 'Chief Product Officer at Meridian Partners',
          expertise: ['Enterprise SaaS', 'AI Strategy'],
        },
      },
    });
    expect(updateRes.status).toBe(200);
    const updateJson = (await updateRes.json()) as any;
    expect(updateJson.result.isError).toBeUndefined();
    const parsed = JSON.parse(updateJson.result.content[0].text);
    expect(parsed.profile.headline).toBe('Chief Product Officer at Meridian Partners');
    // Omitted fields must be preserved
    expect(parsed.profile.name).toBe('Alice Vance');
    expect(parsed.profile.companyName).toBe('Meridian Partners');
    expect(parsed.profile.location).toBe('Boston, MA');
    expect(parsed.profile.expertise).toEqual(['Enterprise SaaS', 'AI Strategy']);

    // Verify via get_my_profile
    const getRes = await mcpCall(rawToken, {
      jsonrpc: '2.0',
      id: 11,
      method: 'tools/call',
      params: { name: 'get_my_profile', arguments: {} },
    });
    const getJson = (await getRes.json()) as any;
    const fetched = JSON.parse(getJson.result.content[0].text);
    expect(fetched.headline).toBe('Chief Product Officer at Meridian Partners');
    expect(fetched.email).toBe('alice@meridian.com');
  });

  it('Creates, lists, updates, and deletes posts via MCP and enforces validation & ownership', async () => {
    const alice = await registerUser('Alice Vance', 'alice@meridian.com');
    const bob = await registerUser('Bob Sterling', 'bob@sterling.com');
    const aliceToken = (await createMcpToken(alice.cookie, alice.csrfToken, 'ChatGPT')).rawToken;
    const bobToken = (await createMcpToken(bob.cookie, bob.csrfToken, 'ChatGPT')).rawToken;

    // 1. List categories
    const catRes = await mcpCall(aliceToken, {
      jsonrpc: '2.0',
      id: 20,
      method: 'tools/call',
      params: { name: 'list_announcement_categories', arguments: {} },
    });
    const categories = JSON.parse(((await catRes.json()) as any).result.content[0].text).categories;
    expect(categories.length).toBeGreaterThan(0);
    const categorySlug = categories[0].slug;

    // 2. Reject engagement bait
    const baitRes = await mcpCall(aliceToken, {
      jsonrpc: '2.0',
      id: 21,
      method: 'tools/call',
      params: {
        name: 'create_post',
        arguments: {
          categoryId: categorySlug,
          body: 'We launched our new enterprise platform today! Thoughts?',
        },
      },
    });
    const baitJson = (await baitRes.json()) as any;
    expect(baitJson.result.isError).toBe(true);
    expect(baitJson.result.content[0].text).toContain('engagement bait');

    // 3. Create valid post
    const createRes = await mcpCall(aliceToken, {
      jsonrpc: '2.0',
      id: 22,
      method: 'tools/call',
      params: {
        name: 'create_post',
        arguments: {
          categoryId: categorySlug,
          body: 'Meridian Partners published our Q4 infrastructure reliability report.',
          externalUrl: 'https://meridian.example.com/q4-report',
        },
      },
    });
    const createJson = (await createRes.json()) as any;
    expect(createJson.result.isError).toBeUndefined();
    const created = JSON.parse(createJson.result.content[0].text);
    const postId = created.announcementId;
    expect(postId).toBeTruthy();

    // 4. List Alice's posts
    const listRes = await mcpCall(aliceToken, {
      jsonrpc: '2.0',
      id: 23,
      method: 'tools/call',
      params: { name: 'list_my_posts', arguments: { limit: 10 } },
    });
    const posts = JSON.parse(((await listRes.json()) as any).result.content[0].text).posts;
    expect(posts.length).toBe(1);
    expect(posts[0].id).toBe(postId);

    // 5. Bob cannot update or delete Alice's post
    const bobUpdateRes = await mcpCall(bobToken, {
      jsonrpc: '2.0',
      id: 24,
      method: 'tools/call',
      params: {
        name: 'update_post',
        arguments: { postId, body: 'Unauthorized edit attempt by another user.' },
      },
    });
    expect(((await bobUpdateRes.json()) as any).result.isError).toBe(true);

    // 6. Alice updates her post
    const updateRes = await mcpCall(aliceToken, {
      jsonrpc: '2.0',
      id: 25,
      method: 'tools/call',
      params: {
        name: 'update_post',
        arguments: {
          postId,
          body: 'Meridian Partners published our updated Q4 infrastructure reliability report.',
        },
      },
    });
    const updated = JSON.parse(((await updateRes.json()) as any).result.content[0].text);
    expect(updated.post.body).toContain('updated Q4');

    // 7. Alice deletes her post
    const delRes = await mcpCall(aliceToken, {
      jsonrpc: '2.0',
      id: 26,
      method: 'tools/call',
      params: { name: 'delete_post', arguments: { postId } },
    });
    const deleted = JSON.parse(((await delRes.json()) as any).result.content[0].text);
    expect(deleted.ok).toBe(true);
    expect(deleted.deletedPostId).toBe(postId);
  });

  it('Revoking an MCP token immediately blocks /mcp access', async () => {
    const alice = await registerUser('Alice Vance', 'alice@meridian.com');
    const { token, rawToken } = await createMcpToken(alice.cookie, alice.csrfToken, 'Cursor');

    const okRes = await mcpCall(rawToken, { jsonrpc: '2.0', id: 1, method: 'ping' });
    expect(okRes.status).toBe(200);

    const revokeRes = await app.request(
      `/api/users/me/tokens/${token.id}`,
      {
        method: 'DELETE',
        headers: {
          Cookie: alice.cookie,
          'X-CSRF-Token': alice.csrfToken,
        },
      },
      env
    );
    expect(revokeRes.status).toBe(200);

    const blockedRes = await mcpCall(rawToken, { jsonrpc: '2.0', id: 2, method: 'ping' });
    expect(blockedRes.status).toBe(401);
  });

  it('Supports OAuth 2.1 discovery, Dynamic Client Registration, PKCE authorization, and token refresh for ChatGPT', async () => {
    const alice = await registerUser('Alice Vance', 'alice@meridian.com');

    // 1. 401 on /mcp advertises resource_metadata
    const unauthRes = await mcpCall(null, { jsonrpc: '2.0', id: 1, method: 'ping' });
    expect(unauthRes.status).toBe(401);
    expect(unauthRes.headers.get('WWW-Authenticate')).toContain('resource_metadata=');

    // 2. Discovery metadata endpoints
    const prRes = await app.request(
      'https://www.keylenta.com/.well-known/oauth-protected-resource',
      { method: 'GET' },
      env
    );
    expect(prRes.status).toBe(200);
    const prJson = (await prRes.json()) as any;
    expect(prJson.resource).toBe('https://www.keylenta.com/mcp');
    expect(prJson.authorization_servers).toEqual(['https://www.keylenta.com']);

    const asRes = await app.request(
      'https://www.keylenta.com/.well-known/oauth-authorization-server',
      { method: 'GET' },
      env
    );
    expect(asRes.status).toBe(200);
    const asJson = (await asRes.json()) as any;
    expect(asJson.registration_endpoint).toBe('https://www.keylenta.com/oauth/register');
    expect(asJson.authorization_endpoint).toBe('https://www.keylenta.com/oauth/authorize');
    expect(asJson.token_endpoint).toBe('https://www.keylenta.com/oauth/token');
    expect(asJson.code_challenge_methods_supported).toEqual(['S256']);

    // 3. Dynamic Client Registration (DCR)
    const redirectUri = 'https://chatgpt.com/connector/oauth/abc123';
    const regRes = await app.request(
      'https://www.keylenta.com/oauth/register',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name: 'ChatGPT',
          redirect_uris: [redirectUri],
          token_endpoint_auth_method: 'none',
        }),
      },
      env
    );
    expect(regRes.status).toBe(201);
    const regJson = (await regRes.json()) as any;
    expect(regJson.client_id).toMatch(/^kl_client_/);

    // 4. PKCE S256 challenge
    const codeVerifier = 'test_pkce_verifier_string_with_sufficient_entropy_123456';
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
    const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // 5. GET /oauth/authorize renders consent page
    const authGetRes = await app.request(
      `https://www.keylenta.com/oauth/authorize?response_type=code&client_id=${encodeURIComponent(
        regJson.client_id
      )}&redirect_uri=${encodeURIComponent(
        redirectUri
      )}&state=xyz&code_challenge=${encodeURIComponent(
        codeChallenge
      )}&code_challenge_method=S256`,
      { method: 'GET', headers: { Cookie: alice.cookie } },
      env
    );
    expect(authGetRes.status).toBe(200);
    const html = await authGetRes.text();
    expect(html).toContain('Authorize ChatGPT');
    expect(html).toContain('Alice Vance');

    // 6. POST /oauth/authorize approves & redirects with code
    const authPostBody = new URLSearchParams({
      client_id: regJson.client_id,
      redirect_uri: redirectUri,
      scope: 'profile:read profile:write posts:read posts:write',
      state: 'xyz',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      action: 'allow',
    });
    const authPostRes = await app.request(
      'https://www.keylenta.com/oauth/authorize',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: alice.cookie,
        },
        body: authPostBody.toString(),
      },
      env
    );
    expect(authPostRes.status).toBe(302);
    const loc = new URL(authPostRes.headers.get('Location')!);
    expect(loc.origin + loc.pathname).toBe(redirectUri);
    expect(loc.searchParams.get('state')).toBe('xyz');
    const authCode = loc.searchParams.get('code')!;
    expect(authCode).toMatch(/^kl_code_/);

    // 7. POST /oauth/token exchanges code + verifier for access_token & refresh_token
    const tokenRes = await app.request(
      'https://www.keylenta.com/oauth/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: authCode,
          redirect_uri: redirectUri,
          client_id: regJson.client_id,
          code_verifier: codeVerifier,
        }).toString(),
      },
      env
    );
    expect(tokenRes.status).toBe(200);
    const tokenJson = (await tokenRes.json()) as any;
    expect(tokenJson.token_type).toBe('Bearer');
    expect(tokenJson.access_token).toMatch(/^kl_mcp_/);
    expect(tokenJson.refresh_token).toMatch(/^kl_rt_/);

    // 8. Access token works on /mcp
    const mcpRes = await mcpCall(tokenJson.access_token, {
      jsonrpc: '2.0',
      id: 99,
      method: 'tools/call',
      params: { name: 'get_my_profile', arguments: {} },
    });
    expect(mcpRes.status).toBe(200);
    const profileData = JSON.parse(((await mcpRes.json()) as any).result.content[0].text);
    expect(profileData.email).toBe('alice@meridian.com');

    // 9. Refresh token rotation works
    const refreshRes = await app.request(
      'https://www.keylenta.com/oauth/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: tokenJson.refresh_token,
          client_id: regJson.client_id,
        }).toString(),
      },
      env
    );
    expect(refreshRes.status).toBe(200);
    const refreshJson = (await refreshRes.json()) as any;
    expect(refreshJson.access_token).toMatch(/^kl_mcp_/);
    expect(refreshJson.access_token).not.toBe(tokenJson.access_token);
  });
});
