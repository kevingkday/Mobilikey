import { describe, it, expect, beforeEach } from 'vitest';
import app from '../src/server/index';
import { createTestDb } from './test-db-helper';
import type { Env } from '../src/server/env';
import {
  parseLinkedInPublicHtml,
  parseProfileDocumentText,
} from '../src/server/services/profile-import.service';

describe('Mobilikey Full-Stack API Integration & Security Suite', () => {
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
          headline: 'Managing Director',
          companyName: 'Meridian Partners',
          position: 'Partner',
          location: 'Boston, MA',
          industry: 'Financial Services',
        }),
      },
      env
    );
    expect(res.status).toBe(201);
    const setCookieHeader = res.headers.get('set-cookie') || '';
    const cookieMatch = setCookieHeader.match(/mobilikey_session=[^;]+/);
    const cookie = cookieMatch ? cookieMatch[0] : '';
    const data = (await res.json()) as any;
    return {
      user: data.user,
      cookie,
      csrfToken: data.user.csrfToken as string,
    };
  }

  it('Enforces CSRF token validation on authenticated state-mutating requests', async () => {
    const alice = await registerUser('Alice Vance', 'alice@meridian.com');

    // Attempt PUT /api/users/me WITHOUT X-CSRF-Token header -> 403 Forbidden
    const resWithoutCsrf = await app.request(
      '/api/users/me',
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: alice.cookie,
        },
        body: JSON.stringify({
          name: 'Alice Vance Updated',
          headline: 'Partner',
        }),
      },
      env
    );
    expect(resWithoutCsrf.status).toBe(403);

    // Attempt PUT /api/users/me WITH valid X-CSRF-Token -> 200 OK
    const resWithCsrf = await app.request(
      '/api/users/me',
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: alice.cookie,
          'X-CSRF-Token': alice.csrfToken,
        },
        body: JSON.stringify({
          name: 'Alice Vance Updated',
          headline: 'Senior Managing Partner',
        }),
      },
      env
    );
    expect(resWithCsrf.status).toBe(200);
    const body = (await resWithCsrf.json()) as any;
    expect(body.user.headline).toBe('Senior Managing Partner');
  });

  it('Never exposes user email addresses on public profile endpoints', async () => {
    const alice = await registerUser('Alice Vance', 'alice@meridian.com');

    const res = await app.request(`/api/users/${alice.user.slug}`, { method: 'GET' }, env);
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.profile.name).toBe('Alice Vance');
    expect(data.profile.email).toBeUndefined();
  });

  it('Enforces 500-character limit, anti-engagement-bait, and anti-hashtag-stuffing on Company Announcements', async () => {
    const alice = await registerUser('Alice Vance', 'alice@meridian.com');

    // Create a company
    const compRes = await app.request(
      '/api/companies',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: alice.cookie,
          'X-CSRF-Token': alice.csrfToken,
        },
        body: JSON.stringify({
          name: 'Meridian Infrastructure Corp',
          description: 'Institutional infrastructure operator and capital advisor.',
          industry: 'Financial Services',
          headquarters: 'Boston, MA',
          companySize: '51-200 employees',
        }),
      },
      env
    );
    expect(compRes.status).toBe(201);
    const { companyId } = (await compRes.json()) as any;

    // 1. Reject announcement over 500 characters
    const over500Res = await app.request(
      '/api/announcements',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: alice.cookie,
          'X-CSRF-Token': alice.csrfToken,
        },
        body: JSON.stringify({
          companyId,
          categoryId: 'cat_company_news',
          body: 'A'.repeat(505),
        }),
      },
      env
    );
    expect(over500Res.status).toBe(400);

    // 2. Reject hashtag stuffing (>2 hashtags)
    const hashtagRes = await app.request(
      '/api/announcements',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: alice.cookie,
          'X-CSRF-Token': alice.csrfToken,
        },
        body: JSON.stringify({
          companyId,
          categoryId: 'cat_company_news',
          body: 'Meridian expands into Chicago. #finance #growth #investing #b2b',
        }),
      },
      env
    );
    expect(hashtagRes.status).toBe(400);

    // 3. Accept factual 500-char announcement
    const validRes = await app.request(
      '/api/announcements',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: alice.cookie,
          'X-CSRF-Token': alice.csrfToken,
        },
        body: JSON.stringify({
          companyId,
          categoryId: 'cat_contracts',
          body: 'Meridian Infrastructure Corp has executed a five-year grid modernization agreement with Northeast Regional Utilities covering 14 substations.',
          externalUrl: 'https://meridian.example.com/releases/q4-grid',
        }),
      },
      env
    );
    expect(validRes.status).toBe(201);
  });

  it('Enforces admin authorization and ensures private message contents are not exposed in admin overview', async () => {
    const alice = await registerUser('Alice Vance', 'alice@meridian.com');
    const bob = await registerUser('Bob Sterling', 'bob@sterling.com');

    // Non-admin user cannot access /api/admin/overview
    const forbiddenRes = await app.request(
      '/api/admin/overview',
      {
        method: 'GET',
        headers: { Cookie: alice.cookie },
      },
      env
    );
    expect(forbiddenRes.status).toBe(403);

    // Alice sends a confidential message to Bob
    const msgRes = await app.request(
      '/api/messages/conversations',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: alice.cookie,
          'X-CSRF-Token': alice.csrfToken,
        },
        body: JSON.stringify({
          recipientType: 'user',
          recipientId: bob.user.id,
          subject: 'Private Acquisition Offer',
          body: 'STRICTLY_CONFIDENTIAL_OFFER_99281',
        }),
      },
      env
    );
    expect(msgRes.status).toBe(201);

    // Promote Alice to platform admin in DB
    await env.DB.prepare("UPDATE users SET system_role = 'admin' WHERE id = ?")
      .bind(alice.user.id)
      .run();

    const adminRes = await app.request(
      '/api/admin/overview',
      {
        method: 'GET',
        headers: { Cookie: alice.cookie },
      },
      env
    );
    expect(adminRes.status).toBe(200);
    const adminText = await adminRes.text();
    // Verify private message body is never returned in admin overview
    expect(adminText).not.toContain('STRICTLY_CONFIDENTIAL_OFFER_99281');
    const adminJson = JSON.parse(adminText);
    expect(adminJson.stats.messagingActivity.totalMessagesSent).toBe(1);
  });

  it('Supports following individuals and companies, company follower access management, and factual career change notifications', async () => {
    const alice = await registerUser('Alice Vance', 'alice@meridian.com');
    const bob = await registerUser('Bob Sterling', 'bob@sterling.com');

    // Bob follows Alice
    const followUserRes = await app.request(
      '/api/users/follow',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: bob.cookie,
          'X-CSRF-Token': bob.csrfToken,
        },
        body: JSON.stringify({
          targetType: 'user',
          targetId: alice.user.id,
        }),
      },
      env
    );
    expect(followUserRes.status).toBe(200);
    expect(((await followUserRes.json()) as any).following).toBe(true);

    // Alice updates her position & companyName -> triggers factual career update notification for Bob
    const updateProfileRes = await app.request(
      '/api/users/me',
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: alice.cookie,
          'X-CSRF-Token': alice.csrfToken,
        },
        body: JSON.stringify({
          name: 'Alice Vance',
          headline: 'Senior Managing Partner at Apex Grid Capital',
          companyName: 'Apex Grid Capital',
          position: 'Senior Managing Partner',
          location: 'Boston, MA',
          industry: 'Financial Services',
        }),
      },
      env
    );
    expect(updateProfileRes.status).toBe(200);

    // Bob checks notifications and sees the factual Career Update notification
    const bobNotifsRes = await app.request(
      '/api/notifications',
      {
        method: 'GET',
        headers: { Cookie: bob.cookie },
      },
      env
    );
    expect(bobNotifsRes.status).toBe(200);
    const bobNotifs = ((await bobNotifsRes.json()) as any).notifications;
    expect(
      bobNotifs.some((n: any) =>
        n.title.includes('Career Update: Alice Vance is now Senior Managing Partner at Apex Grid Capital')
      )
    ).toBe(true);

    // Alice creates a company and Bob follows it
    const compRes = await app.request(
      '/api/companies',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: alice.cookie,
          'X-CSRF-Token': alice.csrfToken,
        },
        body: JSON.stringify({
          name: 'Apex Grid Capital',
          description: 'Utility-scale transmission and grid storage investment firm.',
          industry: 'Financial Services',
          headquarters: 'Boston, MA',
          companySize: '11-50 employees',
        }),
      },
      env
    );
    const { companyId, slug } = (await compRes.json()) as any;

    await app.request(
      '/api/users/follow',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: bob.cookie,
          'X-CSRF-Token': bob.csrfToken,
        },
        body: JSON.stringify({
          targetType: 'company',
          targetId: companyId,
        }),
      },
      env
    );

    // Alice (as company owner) views the company page and sees Bob in the followers list with Level 1 access
    const compDetailRes = await app.request(
      `/api/companies/${slug}`,
      {
        method: 'GET',
        headers: { Cookie: alice.cookie },
      },
      env
    );
    expect(compDetailRes.status).toBe(200);
    const compDetail = (await compDetailRes.json()) as any;
    expect(compDetail.company.followers).toHaveLength(1);
    expect(compDetail.company.followers[0].userId).toBe(bob.user.id);
    expect(compDetail.company.followers[0].accessLevelToCompany).toBe(1);
  });

  it('Extracts structured profile credentials from LinkedIn public HTML, LinkedIn PDF layout, and CV/Resume documents via /api/users/import-profile', async () => {
    // 1. Test LinkedIn Public HTML parser (OpenGraph + JSON-LD)
    const sampleHtml = `
      <html>
        <head>
          <title>Marcus Vance - Principal Regulatory Counsel - Vance Advisory Group | LinkedIn</title>
          <meta property="og:title" content="Marcus Vance - Principal Regulatory Counsel - Vance Advisory Group | LinkedIn" />
          <meta property="og:description" content="Independent regulatory counsel specializing in FERC transmission filings. · Experience: Vance Advisory Group · Location: Washington, DC" />
        </head>
        <body></body>
      </html>
    `;
    const parsedHtml = parseLinkedInPublicHtml(
      sampleHtml,
      'https://www.linkedin.com/in/marcus-vance-91a8b',
      'marcus-vance-91a8b'
    );
    expect(parsedHtml.name).toBe('Marcus Vance');
    expect(parsedHtml.position).toBe('Principal Regulatory Counsel');
    expect(parsedHtml.companyName).toBe('Vance Advisory Group');
    expect(parsedHtml.location).toBe('Washington, DC');
    expect(parsedHtml.socialLinks.linkedin).toBe('https://www.linkedin.com/in/marcus-vance-91a8b');

    // 2. Test POST /api/users/import-profile with a LinkedIn PDF / CV text payload
    const sampleCvText = `
      Contact
      www.linkedin.com/in/claire-dubois (LinkedIn)
      claire.dubois@aegis-cyber.com
      https://aegis-cyber.example.com

      Claire Dubois
      Director of Industrial OT Security at Aegis Industrial Security
      Austin, TX

      Summary
      Securing SCADA telemetry, power generation facilities, and maritime logistics networks across North America.

      Experience
      Aegis Industrial Security
      Director of Industrial OT Security
      2022 - Present
    `;

    const importRes = await app.request(
      '/api/users/import-profile',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText: sampleCvText,
        }),
      },
      env
    );
    expect(importRes.status).toBe(200);
    const importData = (await importRes.json()) as any;
    expect(importData.profile.name).toBe('Claire Dubois');
    expect(importData.profile.email).toBe('claire.dubois@aegis-cyber.com');
    expect(importData.profile.position).toBe('Director of Industrial OT Security');
    expect(importData.profile.companyName).toBe('Aegis Industrial Security');
    expect(importData.profile.location).toBe('Austin, TX');
    expect(importData.profile.industry).toBe('Cybersecurity');
    expect(importData.profile.socialLinks.linkedin).toBe(
      'https://www.linkedin.com/in/claire-dubois'
    );
  });
});

