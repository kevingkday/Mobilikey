import { and, desc, eq, inArray } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import { generateId, slugify } from './auth.service';
import { canEmailClaimCompany, extractHostname, getRegistrableDomain } from '../../shared/domain';
import type {
  AnnouncementItem,
  BulkImportCompanyFollowsResult,
  CompanyFollowItem,
  CompanyFollowSource,
} from '../../shared/types';

function deriveCompanyName(identifier: string): string {
  const host = extractHostname(identifier);
  const base = host ? host.split('.')[0] : identifier;
  return base
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function deriveWebsiteFromIdentifier(identifier: string): string {
  const host = extractHostname(identifier);
  if (host) {
    return `https://${host}`;
  }
  return '';
}

function deriveSlugFromIdentifier(identifier: string, name?: string): string {
  const cleaned = identifier.trim().toLowerCase();
  if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(cleaned)) {
    return cleaned;
  }
  const host = extractHostname(cleaned);
  if (host) {
    return slugify(host.split('.')[0]) || slugify(name || 'company');
  }
  return slugify(name || cleaned) || 'company';
}

export async function insertCompanyFollowIfAbsent(
  db: DrizzleD1Database<typeof schema>,
  params: {
    followerCompanyId: string;
    followedCompanyId: string;
    source: CompanyFollowSource;
    reason?: string | null;
    sourceUrl?: string | null;
  }
): Promise<{ created: boolean; reason?: string }> {
  if (params.followerCompanyId === params.followedCompanyId) {
    return { created: false, reason: 'self_follow' };
  }

  const existing = await db
    .select({ id: schema.companyFollows.id })
    .from(schema.companyFollows)
    .where(
      and(
        eq(schema.companyFollows.followerCompanyId, params.followerCompanyId),
        eq(schema.companyFollows.followedCompanyId, params.followedCompanyId)
      )
    )
    .limit(1);

  if (existing[0]) {
    return { created: false, reason: 'duplicate' };
  }

  await db.insert(schema.companyFollows).values({
    id: generateId('cflw'),
    followerCompanyId: params.followerCompanyId,
    followedCompanyId: params.followedCompanyId,
    source: params.source,
    reason: params.reason ? params.reason.trim().slice(0, 140) : null,
    sourceUrl: params.sourceUrl ? params.sourceUrl.trim() : null,
    createdAt: Date.now(),
  });

  return { created: true };
}

export async function createCompanyFollow(
  db: DrizzleD1Database<typeof schema>,
  params: {
    followerCompanyId: string;
    followedCompanyId: string;
    source: CompanyFollowSource;
    reason?: string | null;
    sourceUrl?: string | null;
    bothWays?: boolean;
  }
): Promise<{
  created: boolean;
  reverseCreated: boolean;
  error?: string;
}> {
  if (params.followerCompanyId === params.followedCompanyId) {
    return {
      created: false,
      reverseCreated: false,
      error: 'A company cannot follow itself.',
    };
  }

  const forward = await insertCompanyFollowIfAbsent(db, params);
  if (!forward.created && forward.reason === 'duplicate' && !params.bothWays) {
    return {
      created: false,
      reverseCreated: false,
      error: 'This company is already following the selected company.',
    };
  }

  let reverseCreated = false;
  if (params.bothWays) {
    const reverse = await insertCompanyFollowIfAbsent(db, {
      followerCompanyId: params.followedCompanyId,
      followedCompanyId: params.followerCompanyId,
      source: params.source,
      reason: params.reason,
      sourceUrl: params.sourceUrl,
    });
    reverseCreated = reverse.created;
  }

  return {
    created: forward.created,
    reverseCreated,
  };
}

export async function removeCompanyFollow(
  db: DrizzleD1Database<typeof schema>,
  followerCompanyId: string,
  followedCompanyId: string
): Promise<boolean> {
  const existing = await db
    .select({ id: schema.companyFollows.id })
    .from(schema.companyFollows)
    .where(
      and(
        eq(schema.companyFollows.followerCompanyId, followerCompanyId),
        eq(schema.companyFollows.followedCompanyId, followedCompanyId)
      )
    )
    .limit(1);

  if (!existing[0]) return false;

  await db
    .delete(schema.companyFollows)
    .where(eq(schema.companyFollows.id, existing[0].id));
  return true;
}

export async function listCompanyFollows(
  db: DrizzleD1Database<typeof schema>,
  companyId: string
): Promise<{ follows: CompanyFollowItem[]; followedBy: CompanyFollowItem[] }> {
  const followsRows = await db
    .select({
      id: schema.companyFollows.id,
      companyId: schema.companies.id,
      slug: schema.companies.slug,
      name: schema.companies.name,
      logoUrl: schema.companies.logoUrl,
      industry: schema.companies.industry,
      website: schema.companies.website,
      isClaimed: schema.companies.isClaimed,
      source: schema.companyFollows.source,
      reason: schema.companyFollows.reason,
      sourceUrl: schema.companyFollows.sourceUrl,
      createdAt: schema.companyFollows.createdAt,
    })
    .from(schema.companyFollows)
    .innerJoin(schema.companies, eq(schema.companyFollows.followedCompanyId, schema.companies.id))
    .where(eq(schema.companyFollows.followerCompanyId, companyId))
    .orderBy(desc(schema.companyFollows.createdAt));

  const followedByRows = await db
    .select({
      id: schema.companyFollows.id,
      companyId: schema.companies.id,
      slug: schema.companies.slug,
      name: schema.companies.name,
      logoUrl: schema.companies.logoUrl,
      industry: schema.companies.industry,
      website: schema.companies.website,
      isClaimed: schema.companies.isClaimed,
      source: schema.companyFollows.source,
      reason: schema.companyFollows.reason,
      sourceUrl: schema.companyFollows.sourceUrl,
      createdAt: schema.companyFollows.createdAt,
    })
    .from(schema.companyFollows)
    .innerJoin(schema.companies, eq(schema.companyFollows.followerCompanyId, schema.companies.id))
    .where(eq(schema.companyFollows.followedCompanyId, companyId))
    .orderBy(desc(schema.companyFollows.createdAt));

  return {
    follows: followsRows.map((r) => ({
      ...r,
      isClaimed: Boolean(r.isClaimed),
      source: r.source as CompanyFollowSource,
    })),
    followedBy: followedByRows.map((r) => ({
      ...r,
      isClaimed: Boolean(r.isClaimed),
      source: r.source as CompanyFollowSource,
    })),
  };
}

export async function getFollowedCompaniesUpdates(
  db: DrizzleD1Database<typeof schema>,
  companyId: string,
  limit = 15
): Promise<AnnouncementItem[]> {
  const followedRows = await db
    .select({ followedCompanyId: schema.companyFollows.followedCompanyId })
    .from(schema.companyFollows)
    .where(eq(schema.companyFollows.followerCompanyId, companyId));

  const followedIds = followedRows.map((r) => r.followedCompanyId);
  if (followedIds.length === 0) return [];

  const rows = await db
    .select({
      id: schema.announcements.id,
      companyId: schema.announcements.companyId,
      authorUserId: schema.announcements.authorUserId,
      authorName: schema.users.name,
      authorSlug: schema.users.slug,
      authorAvatarUrl: schema.users.avatarUrl,
      authorHeadline: schema.users.headline,
      companyName: schema.companies.name,
      companySlug: schema.companies.slug,
      companyLogoUrl: schema.companies.logoUrl,
      companyIndustry: schema.companies.industry,
      categoryId: schema.announcements.categoryId,
      categorySlug: schema.announcementCategories.slug,
      categoryName: schema.announcementCategories.name,
      body: schema.announcements.body,
      externalUrl: schema.announcements.externalUrl,
      moderationStatus: schema.announcements.moderationStatus,
      createdAt: schema.announcements.createdAt,
    })
    .from(schema.announcements)
    .innerJoin(schema.users, eq(schema.announcements.authorUserId, schema.users.id))
    .innerJoin(schema.companies, eq(schema.announcements.companyId, schema.companies.id))
    .innerJoin(
      schema.announcementCategories,
      eq(schema.announcements.categoryId, schema.announcementCategories.id)
    )
    .where(
      and(
        inArray(schema.announcements.companyId, followedIds),
        eq(schema.announcements.moderationStatus, 'published')
      )
    )
    .orderBy(desc(schema.announcements.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    companyId: r.companyId,
    companyName: r.companyName,
    companySlug: r.companySlug,
    companyLogoUrl: r.companyLogoUrl,
    companyIndustry: r.companyIndustry,
    authorUserId: r.authorUserId,
    authorName: r.authorName,
    authorSlug: r.authorSlug,
    authorAvatarUrl: r.authorAvatarUrl,
    authorHeadline: r.authorHeadline,
    categoryId: r.categoryId,
    categorySlug: r.categorySlug,
    categoryName: r.categoryName,
    body: r.body,
    externalUrl: r.externalUrl,
    moderationStatus: r.moderationStatus as 'published' | 'flagged' | 'removed',
    createdAt: r.createdAt,
  }));
}

interface CompanyLookupRecord {
  id: string;
  slug: string;
  name: string;
  website: string;
}

function matchCompanyInList(
  list: CompanyLookupRecord[],
  identifier: string
): CompanyLookupRecord | undefined {
  const norm = identifier.trim().toLowerCase();
  if (!norm) return undefined;

  const bySlug = list.find((c) => c.slug.toLowerCase() === norm);
  if (bySlug) return bySlug;

  const targetHost = extractHostname(norm);
  const targetDomain = getRegistrableDomain(norm);
  if (!targetHost && !targetDomain) return undefined;

  return list.find((c) => {
    const cHost = extractHostname(c.website);
    const cDomain = getRegistrableDomain(c.website);
    return (
      (targetHost && cHost && cHost === targetHost) ||
      (targetDomain && cDomain && cDomain === targetDomain)
    );
  });
}

export interface BulkImportEntryInput {
  company: string;
  follows: Array<{
    company: string;
    name?: string;
    website?: string;
    reason?: string | null;
    source_url?: string | null;
    both_ways?: boolean;
  }>;
}

export async function bulkImportCompanyFollows(
  db: DrizzleD1Database<typeof schema>,
  items: BulkImportEntryInput[],
  options: { dryRun?: boolean } = {}
): Promise<BulkImportCompanyFollowsResult> {
  const dryRun = Boolean(options.dryRun);
  const allCompanies: CompanyLookupRecord[] = await db
    .select({
      id: schema.companies.id,
      slug: schema.companies.slug,
      name: schema.companies.name,
      website: schema.companies.website,
    })
    .from(schema.companies);

  const existingPairs = new Set<string>();
  const currentPairs = await db
    .select({
      followerCompanyId: schema.companyFollows.followerCompanyId,
      followedCompanyId: schema.companyFollows.followedCompanyId,
    })
    .from(schema.companyFollows);
  for (const p of currentPairs) {
    existingPairs.add(`${p.followerCompanyId}:${p.followedCompanyId}`);
  }

  const result: BulkImportCompanyFollowsResult = {
    dryRun,
    created: [],
    skipped: [],
    placeholdersCreated: [],
    notMatched: [],
  };

  for (const item of items) {
    const sourceCompany = matchCompanyInList(allCompanies, item.company);
    if (!sourceCompany) {
      result.notMatched.push({
        company: item.company,
        context: 'source_company',
      });
      continue;
    }

    for (const entry of item.follows) {
      let targetCompany = matchCompanyInList(allCompanies, entry.company);
      let placeholderCreated = false;

      if (!targetCompany) {
        const website =
          (entry.website && entry.website.trim()) || deriveWebsiteFromIdentifier(entry.company);
        const name =
          (entry.name && entry.name.trim()) || deriveCompanyName(entry.company) || entry.company;
        let slug = deriveSlugFromIdentifier(entry.company, name);
        if (allCompanies.some((c) => c.slug.toLowerCase() === slug.toLowerCase())) {
          slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
        }

        const now = Date.now();
        const newId = dryRun ? `dry_${slug}` : generateId('cmp');
        const placeholder: CompanyLookupRecord = {
          id: newId,
          slug,
          name,
          website,
        };

        if (!dryRun) {
          await db.insert(schema.companies).values({
            id: newId,
            slug,
            name,
            logoUrl: null,
            description: 'Company profile created from public announcement.',
            website,
            industry: '',
            headquarters: '',
            companySize: '1 (Solo Principal)',
            contactInfo: '',
            contactEmail: '',
            contactPhone: '',
            socialLinksJson: '{}',
            isClaimed: 0,
            status: 'active',
            createdAt: now,
            updatedAt: now,
          });
        }

        allCompanies.push(placeholder);
        targetCompany = placeholder;
        placeholderCreated = true;
        result.placeholdersCreated.push({ slug, name, website });
      }

      if (sourceCompany.id === targetCompany.id) {
        result.skipped.push({
          followerSlug: sourceCompany.slug,
          followedSlug: targetCompany.slug,
          reason: 'self_follow',
        });
        continue;
      }

      const forwardKey = `${sourceCompany.id}:${targetCompany.id}`;
      const bothWays = Boolean(entry.both_ways);
      const reverseKey = `${targetCompany.id}:${sourceCompany.id}`;

      const forwardExists = existingPairs.has(forwardKey);
      const reverseExists = existingPairs.has(reverseKey);

      if (forwardExists && (!bothWays || reverseExists)) {
        result.skipped.push({
          followerSlug: sourceCompany.slug,
          followedSlug: targetCompany.slug,
          reason: 'duplicate',
        });
        continue;
      }

      if (!forwardExists) {
        if (!dryRun) {
          await insertCompanyFollowIfAbsent(db, {
            followerCompanyId: sourceCompany.id,
            followedCompanyId: targetCompany.id,
            source: 'admin_seeded',
            reason: entry.reason ?? null,
            sourceUrl: entry.source_url ?? null,
          });
        }
        existingPairs.add(forwardKey);
      }

      if (bothWays && !reverseExists) {
        if (!dryRun) {
          await insertCompanyFollowIfAbsent(db, {
            followerCompanyId: targetCompany.id,
            followedCompanyId: sourceCompany.id,
            source: 'admin_seeded',
            reason: entry.reason ?? null,
            sourceUrl: entry.source_url ?? null,
          });
        }
        existingPairs.add(reverseKey);
      }

      result.created.push({
        followerSlug: sourceCompany.slug,
        followedSlug: targetCompany.slug,
        bothWays,
        placeholderCreated,
      });
    }
  }

  return result;
}

export async function claimCompanyPage(
  db: DrizzleD1Database<typeof schema>,
  params: {
    companyId: string;
    userId: string;
    userEmail: string;
  }
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const compRows = await db
    .select()
    .from(schema.companies)
    .where(eq(schema.companies.id, params.companyId))
    .limit(1);

  if (!compRows[0]) {
    return { ok: false, status: 404, error: 'Company page not found.' };
  }

  const comp = compRows[0];
  if (comp.isClaimed) {
    return { ok: false, status: 400, error: 'This company page has already been claimed.' };
  }

  const domainCheck = canEmailClaimCompany(params.userEmail, comp.website);
  if (!domainCheck.allowed) {
    return {
      ok: false,
      status: 403,
      error: domainCheck.reason || 'Email domain does not match this company.',
    };
  }

  const existingMember = await db
    .select({ id: schema.companyMembers.id })
    .from(schema.companyMembers)
    .where(
      and(
        eq(schema.companyMembers.companyId, comp.id),
        eq(schema.companyMembers.userId, params.userId)
      )
    )
    .limit(1);

  const now = Date.now();
  if (!existingMember[0]) {
    await db.insert(schema.companyMembers).values({
      id: generateId('cm'),
      companyId: comp.id,
      userId: params.userId,
      role: 'owner',
      createdAt: now,
    });
  }

  await db
    .update(schema.companies)
    .set({ isClaimed: 1, updatedAt: now })
    .where(eq(schema.companies.id, comp.id));

  return { ok: true };
}

export async function assignCompanyOwner(
  db: DrizzleD1Database<typeof schema>,
  params: {
    companyId: string;
    userEmail: string;
  }
): Promise<{ ok: true; userId: string } | { ok: false; status: number; error: string }> {
  const compRows = await db
    .select({ id: schema.companies.id })
    .from(schema.companies)
    .where(eq(schema.companies.id, params.companyId))
    .limit(1);

  if (!compRows[0]) {
    return { ok: false, status: 404, error: 'Company page not found.' };
  }

  const userRows = await db
    .select({ id: schema.users.id, status: schema.users.status })
    .from(schema.users)
    .where(eq(schema.users.email, params.userEmail.trim().toLowerCase()))
    .limit(1);

  if (!userRows[0] || userRows[0].status !== 'active') {
    return {
      ok: false,
      status: 404,
      error: 'No active Keylenta account found with that email address.',
    };
  }

  const existingMember = await db
    .select({ id: schema.companyMembers.id })
    .from(schema.companyMembers)
    .where(
      and(
        eq(schema.companyMembers.companyId, params.companyId),
        eq(schema.companyMembers.userId, userRows[0].id)
      )
    )
    .limit(1);

  const now = Date.now();
  if (existingMember[0]) {
    await db
      .update(schema.companyMembers)
      .set({ role: 'owner' })
      .where(eq(schema.companyMembers.id, existingMember[0].id));
  } else {
    await db.insert(schema.companyMembers).values({
      id: generateId('cm'),
      companyId: params.companyId,
      userId: userRows[0].id,
      role: 'owner',
      createdAt: now,
    });
  }

  await db
    .update(schema.companies)
    .set({ isClaimed: 1, updatedAt: now })
    .where(eq(schema.companies.id, params.companyId));

  return { ok: true, userId: userRows[0].id };
}
