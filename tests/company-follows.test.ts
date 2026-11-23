import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './test-db-helper';
import * as schema from '../src/server/db/schema';
import { eq } from 'drizzle-orm';
import {
  bulkImportCompanyFollows,
  claimCompanyPage,
  createCompanyFollow,
  getFollowedCompaniesUpdates,
  listCompanyFollows,
  removeCompanyFollow,
} from '../src/server/services/company-follows.service';
import { canEmailClaimCompany } from '../src/shared/domain';

describe('Company-to-Company Follows, Bulk Import & Domain Claiming', () => {
  let db: ReturnType<typeof createTestDb>['db'];

  beforeEach(async () => {
    const setup = createTestDb();
    db = setup.db;
    const now = Date.now();

    await db.insert(schema.users).values([
      {
        id: 'usr_jane',
        slug: 'jane-rise',
        email: 'jane@riseautomation.ca',
        passwordHash: 'hash',
        emailVerifiedAt: now,
        name: 'Jane Rise',
        systemRole: 'user',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'usr_gmail',
        slug: 'bob-gmail',
        email: 'bob@gmail.com',
        passwordHash: 'hash',
        emailVerifiedAt: now,
        name: 'Bob Gmail',
        systemRole: 'user',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'usr_other',
        slug: 'alice-other',
        email: 'alice@othercorp.com',
        passwordHash: 'hash',
        emailVerifiedAt: now,
        name: 'Alice Other',
        systemRole: 'user',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
    ]);

    await db.insert(schema.companies).values([
      {
        id: 'cmp_rise',
        slug: 'rise-automation',
        name: 'Rise Automation',
        website: 'https://www.riseautomation.ca',
        isClaimed: 0,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'cmp_bdc',
        slug: 'bdc-capital',
        name: 'BDC Capital',
        website: 'https://bdc.ca',
        isClaimed: 1,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
    ]);

    await db
      .insert(schema.announcementCategories)
      .values({
        id: 'cat_funding',
        slug: 'funding',
        name: 'Funding',
        sortOrder: 1,
        isActive: 1,
      })
      .onConflictDoNothing();
  });

  it('prevents self-follows and duplicate follows', async () => {
    const selfRes = await createCompanyFollow(db, {
      followerCompanyId: 'cmp_rise',
      followedCompanyId: 'cmp_rise',
      source: 'admin_seeded',
    });
    expect(selfRes.created).toBe(false);
    expect(selfRes.error).toBeDefined();

    const first = await createCompanyFollow(db, {
      followerCompanyId: 'cmp_rise',
      followedCompanyId: 'cmp_bdc',
      source: 'admin_seeded',
      reason: 'Led their pre-seed',
    });
    expect(first.created).toBe(true);

    const dup = await createCompanyFollow(db, {
      followerCompanyId: 'cmp_rise',
      followedCompanyId: 'cmp_bdc',
      source: 'admin_seeded',
    });
    expect(dup.created).toBe(false);
    expect(dup.error).toBeDefined();
  });

  it('creates follows in both directions when bothWays is true', async () => {
    const res = await createCompanyFollow(db, {
      followerCompanyId: 'cmp_rise',
      followedCompanyId: 'cmp_bdc',
      source: 'admin_seeded',
      reason: 'Portfolio company',
      bothWays: true,
    });

    expect(res.created).toBe(true);
    expect(res.reverseCreated).toBe(true);

    const riseLists = await listCompanyFollows(db, 'cmp_rise');
    expect(riseLists.follows).toHaveLength(1);
    expect(riseLists.follows[0].slug).toBe('bdc-capital');
    expect(riseLists.followedBy).toHaveLength(1);
    expect(riseLists.followedBy[0].slug).toBe('bdc-capital');
  });

  it('supports bulk import dry_run, real placeholder creation with name/website, and unmatched reporting', async () => {
    const payload = [
      {
        company: 'rise-automation',
        follows: [
          {
            company: 'bdc.ca',
            reason: 'Led their pre-seed',
            source_url: 'https://betakit.com/example',
            both_ways: true,
          },
          {
            company: 'maple-ventures',
            name: 'Maple Ventures',
            website: 'https://mapleventures.ca',
            reason: 'Co-investor',
          },
          {
            company: 'northstar.io',
          },
        ],
      },
      {
        company: 'non-existent-source',
        follows: [{ company: 'bdc-capital' }],
      },
    ];

    // 1. Dry run should not write anything
    const drySummary = await bulkImportCompanyFollows(db, payload, { dryRun: true });
    expect(drySummary.dryRun).toBe(true);
    expect(drySummary.created).toHaveLength(3);
    expect(drySummary.placeholdersCreated).toHaveLength(2);
    expect(drySummary.placeholdersCreated[0].name).toBe('Maple Ventures');
    expect(drySummary.placeholdersCreated[1].name).toBe('Northstar');
    expect(drySummary.notMatched).toEqual([
      { company: 'non-existent-source', context: 'source_company' },
    ]);

    const afterDry = await listCompanyFollows(db, 'cmp_rise');
    expect(afterDry.follows).toHaveLength(0);

    // 2. Real import persists placeholders and follows
    const realSummary = await bulkImportCompanyFollows(db, payload, { dryRun: false });
    expect(realSummary.dryRun).toBe(false);
    expect(realSummary.created).toHaveLength(3);
    expect(realSummary.placeholdersCreated).toHaveLength(2);

    const riseLists = await listCompanyFollows(db, 'cmp_rise');
    expect(riseLists.follows).toHaveLength(3);

    const mapleRows = await db
      .select()
      .from(schema.companies)
      .where(eq(schema.companies.slug, 'maple-ventures'));
    expect(mapleRows[0]).toBeDefined();
    expect(mapleRows[0].name).toBe('Maple Ventures');
    expect(mapleRows[0].website).toBe('https://mapleventures.ca');
    expect(mapleRows[0].isClaimed).toBe(0);
  });

  it('verifies email domain on claiming (match, www/subdomain, mismatch, free-mail rejection)', () => {
    expect(canEmailClaimCompany('jane@riseautomation.ca', 'https://www.riseautomation.ca').allowed).toBe(
      true
    );
    expect(canEmailClaimCompany('jane@mail.riseautomation.ca', 'https://www.riseautomation.ca').allowed).toBe(
      true
    );

    const mismatch = canEmailClaimCompany('alice@othercorp.com', 'https://www.riseautomation.ca');
    expect(mismatch.allowed).toBe(false);
    expect(mismatch.reason).toBe('Sign in with an email at riseautomation.ca to claim this page.');

    for (const free of ['gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'icloud.com', 'proton.me']) {
      const res = canEmailClaimCompany(`user@${free}`, 'https://www.riseautomation.ca');
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe('Sign in with an email at riseautomation.ca to claim this page.');
    }
  });

  it('preserves admin-seeded follows on claim, lets owner remove/add, and sends zero notifications', async () => {
    await createCompanyFollow(db, {
      followerCompanyId: 'cmp_rise',
      followedCompanyId: 'cmp_bdc',
      source: 'admin_seeded',
      reason: 'Led their seed round',
    });

    // Wrong domain fails
    const badClaim = await claimCompanyPage(db, {
      companyId: 'cmp_rise',
      userId: 'usr_gmail',
      userEmail: 'bob@gmail.com',
    });
    expect(badClaim.ok).toBe(false);

    // Matching domain succeeds
    const goodClaim = await claimCompanyPage(db, {
      companyId: 'cmp_rise',
      userId: 'usr_jane',
      userEmail: 'jane@riseautomation.ca',
    });
    expect(goodClaim.ok).toBe(true);

    const riseComp = await db
      .select()
      .from(schema.companies)
      .where(eq(schema.companies.id, 'cmp_rise'));
    expect(riseComp[0].isClaimed).toBe(1);

    // Seeded follow is preserved
    let riseLists = await listCompanyFollows(db, 'cmp_rise');
    expect(riseLists.follows).toHaveLength(1);
    expect(riseLists.follows[0].source).toBe('admin_seeded');

    // Feed shows updates from followed company
    await db.insert(schema.announcements).values({
      id: 'ann_1',
      companyId: 'cmp_bdc',
      authorUserId: 'usr_other',
      categoryId: 'cat_funding',
      body: 'BDC Capital announced a new seed fund.',
      moderationStatus: 'published',
      createdAt: Date.now(),
    });
    const updates = await getFollowedCompaniesUpdates(db, 'cmp_rise');
    expect(updates).toHaveLength(1);
    expect(updates[0].companySlug).toBe('bdc-capital');

    // Claimed owner can remove the seeded follow
    const removed = await removeCompanyFollow(db, 'cmp_rise', 'cmp_bdc');
    expect(removed).toBe(true);
    riseLists = await listCompanyFollows(db, 'cmp_rise');
    expect(riseLists.follows).toHaveLength(0);

    // Zero notifications generated
    const notifs = await db.select().from(schema.notifications);
    expect(notifs).toHaveLength(0);
  });
});
