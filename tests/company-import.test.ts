import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import app from '../src/server/index';
import { createTestDb } from './test-db-helper';
import * as schema from '../src/server/db/schema';
import type { Env } from '../src/server/env';

describe('Admin Bulk Import for Unclaimed Companies & Updates', () => {
  let env: Env;
  let db: ReturnType<typeof createTestDb>['db'];

  beforeEach(() => {
    const setup = createTestDb();
    db = setup.db;
    env = {
      DB: setup.d1,
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
          headline: 'Operator',
          companyName: 'Test Org',
          position: 'Lead',
          location: 'Vancouver, BC',
          industry: 'Technology',
        }),
      },
      env
    );
    expect(res.status).toBe(201);
    const setCookie = res.headers.get('set-cookie') || '';
    const sessionMatch = setCookie.match(/keylenta_session=[^;]+/);
    const data = (await res.json()) as any;
    return {
      user: data.user as { id: string; email: string; name: string },
      cookie: sessionMatch ? sessionMatch[0] : '',
      csrfToken: data.user.csrfToken as string,
    };
  }

  async function promoteToAdmin(userId: string) {
    await env.DB.prepare("UPDATE users SET system_role = 'admin' WHERE id = ?")
      .bind(userId)
      .run();
  }

  it('returns 403 for non-admin users', async () => {
    const alice = await registerUser('Alice Regular', 'alice@example.com');

    const res = await app.request(
      '/api/admin/companies/import',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: alice.cookie,
          'X-CSRF-Token': alice.csrfToken,
        },
        body: JSON.stringify([
          {
            slug: 'luminaryx',
            name: 'LUMINARYX',
            website: 'https://luminaryx.ca',
            update: {
              body: 'Luminaryx launched a municipal AI workflow.',
              external_url: 'https://luminaryx.ca/news/launch',
            },
          },
        ]),
      },
      env
    );

    expect(res.status).toBe(403);
  });

  it('creates an unclaimed company with no members and publishes the update as the admin without sending notifications', async () => {
    const admin = await registerUser('Admin User', 'admin@keylenta.com');
    await promoteToAdmin(admin.user.id);

    const res = await app.request(
      '/api/admin/companies/import',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: admin.cookie,
          'X-CSRF-Token': admin.csrfToken,
        },
        body: JSON.stringify([
          {
            slug: 'luminaryx',
            name: 'LUMINARYX',
            website: 'https://luminaryx.ca',
            headquarters: 'Golden, BC',
            industry: 'AI / GovTech',
            description: 'AI workflow tools for local governments.',
            update: {
              body: 'LUMINARYX deployed its permitting assistant across three BC municipalities.',
              external_url: 'https://luminaryx.ca/press/bc-rollout',
              category: 'product-launch',
            },
          },
        ]),
      },
      env
    );

    expect(res.status).toBe(200);
    const summary = (await res.json()) as any;
    expect(summary.dryRun).toBe(false);
    expect(summary.companiesCreated).toBe(1);
    expect(summary.companiesMatched).toBe(0);
    expect(summary.updatesCreated).toBe(1);
    expect(summary.updatesSkipped).toBe(0);
    expect(summary.errors).toHaveLength(0);

    const compRows = await db
      .select()
      .from(schema.companies)
      .where(eq(schema.companies.slug, 'luminaryx'));
    expect(compRows).toHaveLength(1);
    expect(compRows[0].name).toBe('LUMINARYX');
    expect(compRows[0].isClaimed).toBe(0);
    expect(compRows[0].headquarters).toBe('Golden, BC');
    expect(compRows[0].industry).toBe('AI / GovTech');

    const members = await db
      .select()
      .from(schema.companyMembers)
      .where(eq(schema.companyMembers.companyId, compRows[0].id));
    expect(members).toHaveLength(0);

    const anns = await db
      .select()
      .from(schema.announcements)
      .where(eq(schema.announcements.companyId, compRows[0].id));
    expect(anns).toHaveLength(1);
    expect(anns[0].authorUserId).toBe(admin.user.id);
    expect(anns[0].moderationStatus).toBe('published');
    expect(anns[0].externalUrl).toBe('https://luminaryx.ca/press/bc-rollout');
    expect(anns[0].categoryId).toBe('cat_product_launch');

    const notifs = await db.select().from(schema.notifications);
    expect(notifs).toHaveLength(0);
  });

  it('matches existing company by normalized website domain without modifying its profile', async () => {
    const admin = await registerUser('Admin User', 'admin@keylenta.com');
    await promoteToAdmin(admin.user.id);

    const now = Date.now();
    await db.insert(schema.companies).values({
      id: 'cmp_existing',
      slug: 'existing-co',
      name: 'Existing Co Original Name',
      website: 'https://www.luminaryx.ca',
      headquarters: 'Victoria, BC',
      industry: 'Original Industry',
      description: 'Original description',
      isClaimed: 1,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });

    const res = await app.request(
      '/api/admin/companies/import',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: admin.cookie,
          'X-CSRF-Token': admin.csrfToken,
        },
        body: JSON.stringify([
          {
            slug: 'different-slug',
            name: 'LUMINARYX NEW NAME',
            website: 'https://app.luminaryx.ca/about',
            headquarters: 'Golden, BC',
            industry: 'AI / GovTech',
            description: 'Should not overwrite existing',
            update: {
              body: 'Announced new provincial contract.',
              external_url: 'https://example.com/news',
            },
          },
        ]),
      },
      env
    );

    expect(res.status).toBe(200);
    const summary = (await res.json()) as any;
    expect(summary.companiesCreated).toBe(0);
    expect(summary.companiesMatched).toBe(1);
    expect(summary.updatesCreated).toBe(1);
    expect(summary.errors).toHaveLength(0);

    const compRows = await db
      .select()
      .from(schema.companies)
      .where(eq(schema.companies.id, 'cmp_existing'));
    expect(compRows[0].slug).toBe('existing-co');
    expect(compRows[0].name).toBe('Existing Co Original Name');
    expect(compRows[0].headquarters).toBe('Victoria, BC');
    expect(compRows[0].description).toBe('Original description');

    const anns = await db
      .select()
      .from(schema.announcements)
      .where(eq(schema.announcements.companyId, 'cmp_existing'));
    expect(anns).toHaveLength(1);
  });

  it('rejects update bodies over 500 characters and reports per-row errors', async () => {
    const admin = await registerUser('Admin User', 'admin@keylenta.com');
    await promoteToAdmin(admin.user.id);

    const res = await app.request(
      '/api/admin/companies/import',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: admin.cookie,
          'X-CSRF-Token': admin.csrfToken,
        },
        body: JSON.stringify([
          {
            slug: 'too-long-co',
            name: 'Too Long Co',
            website: 'https://toolong.ca',
            update: {
              body: 'A'.repeat(501),
              external_url: 'https://toolong.ca/news',
            },
          },
        ]),
      },
      env
    );

    expect(res.status).toBe(200);
    const summary = (await res.json()) as any;
    expect(summary.companiesCreated).toBe(0);
    expect(summary.updatesCreated).toBe(0);
    expect(summary.errors).toHaveLength(1);
    expect(summary.errors[0].row).toBe(0);
    expect(summary.errors[0].error).toContain('500');

    const compRows = await db
      .select()
      .from(schema.companies)
      .where(eq(schema.companies.slug, 'too-long-co'));
    expect(compRows).toHaveLength(0);
  });

  it('skips duplicate updates with identical body for the same company', async () => {
    const admin = await registerUser('Admin User', 'admin@keylenta.com');
    await promoteToAdmin(admin.user.id);

    const payload = [
      {
        slug: 'luminaryx',
        name: 'LUMINARYX',
        website: 'https://luminaryx.ca',
        update: {
          body: 'LUMINARYX raised a seed round to expand municipal AI tooling.',
          external_url: 'https://luminaryx.ca/seed',
        },
      },
    ];

    const firstRes = await app.request(
      '/api/admin/companies/import',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: admin.cookie,
          'X-CSRF-Token': admin.csrfToken,
        },
        body: JSON.stringify(payload),
      },
      env
    );
    expect(firstRes.status).toBe(200);
    const firstSummary = (await firstRes.json()) as any;
    expect(firstSummary.companiesCreated).toBe(1);
    expect(firstSummary.updatesCreated).toBe(1);

    const secondRes = await app.request(
      '/api/admin/companies/import',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: admin.cookie,
          'X-CSRF-Token': admin.csrfToken,
        },
        body: JSON.stringify(payload),
      },
      env
    );
    expect(secondRes.status).toBe(200);
    const secondSummary = (await secondRes.json()) as any;
    expect(secondSummary.companiesCreated).toBe(0);
    expect(secondSummary.companiesMatched).toBe(1);
    expect(secondSummary.updatesCreated).toBe(0);
    expect(secondSummary.updatesSkipped).toBe(1);
  });

  it('dry_run=true returns the summary without writing to the database', async () => {
    const admin = await registerUser('Admin User', 'admin@keylenta.com');
    await promoteToAdmin(admin.user.id);

    const res = await app.request(
      '/api/admin/companies/import?dry_run=true',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: admin.cookie,
          'X-CSRF-Token': admin.csrfToken,
        },
        body: JSON.stringify([
          {
            slug: 'dryrun-co',
            name: 'DryRun Co',
            website: 'https://dryrun.ca',
            update: {
              body: 'Dry run announcement body.',
              external_url: 'https://dryrun.ca/news',
            },
          },
        ]),
      },
      env
    );

    expect(res.status).toBe(200);
    const summary = (await res.json()) as any;
    expect(summary.dryRun).toBe(true);
    expect(summary.companiesCreated).toBe(1);
    expect(summary.updatesCreated).toBe(1);
    expect(summary.errors).toHaveLength(0);

    const compRows = await db
      .select()
      .from(schema.companies)
      .where(eq(schema.companies.slug, 'dryrun-co'));
    expect(compRows).toHaveLength(0);

    const annRows = await db.select().from(schema.announcements);
    expect(annRows).toHaveLength(0);
  });
});
