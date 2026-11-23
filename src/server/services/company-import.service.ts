import { asc, eq } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import { generateId } from './auth.service';
import { extractHostname, getRegistrableDomain } from '../../shared/domain';
import { bulkImportCompanyUpdateRowSchema } from '../../shared/validation';
import type { BulkImportCompaniesResult } from '../../shared/types';

interface CompanyLookupRecord {
  id: string;
  slug: string;
  name: string;
  website: string;
}

function findMatchingCompany(
  list: CompanyLookupRecord[],
  slug: string,
  website: string
): CompanyLookupRecord | undefined {
  const normSlug = slug.trim().toLowerCase();
  if (normSlug) {
    const bySlug = list.find((c) => c.slug.toLowerCase() === normSlug);
    if (bySlug) return bySlug;
  }

  const targetHost = extractHostname(website);
  const targetDomain = getRegistrableDomain(website);
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

/**
 * Bulk-imports unclaimed company pages and optional public announcements.
 * Matches existing companies by slug or normalized website domain without modifying
 * existing profiles, skips duplicate announcement bodies per company, and never sends
 * emails or notifications.
 */
export async function bulkImportCompaniesWithUpdates(
  db: DrizzleD1Database<typeof schema>,
  rawRows: unknown[],
  options: { adminUserId: string; dryRun?: boolean }
): Promise<BulkImportCompaniesResult> {
  const dryRun = Boolean(options.dryRun);

  const allCompanies: CompanyLookupRecord[] = await db
    .select({
      id: schema.companies.id,
      slug: schema.companies.slug,
      name: schema.companies.name,
      website: schema.companies.website,
    })
    .from(schema.companies);

  const activeCategories = await db
    .select({
      id: schema.announcementCategories.id,
      slug: schema.announcementCategories.slug,
    })
    .from(schema.announcementCategories)
    .where(eq(schema.announcementCategories.isActive, 1))
    .orderBy(asc(schema.announcementCategories.sortOrder));

  const defaultCategory =
    activeCategories.find((c) => c.slug === 'company-news') ?? activeCategories[0];

  const existingAnnouncements = await db
    .select({
      companyId: schema.announcements.companyId,
      body: schema.announcements.body,
    })
    .from(schema.announcements);

  const bodiesByCompany = new Map<string, Set<string>>();
  for (const ann of existingAnnouncements) {
    if (!ann.companyId) continue;
    let set = bodiesByCompany.get(ann.companyId);
    if (!set) {
      set = new Set<string>();
      bodiesByCompany.set(ann.companyId, set);
    }
    set.add(ann.body.trim());
  }

  const result: BulkImportCompaniesResult = {
    dryRun,
    companiesCreated: 0,
    companiesMatched: 0,
    updatesCreated: 0,
    updatesSkipped: 0,
    createdCompanies: [],
    matchedCompanies: [],
    errors: [],
  };

  for (let rowIndex = 0; rowIndex < rawRows.length; rowIndex++) {
    const rawRow = rawRows[rowIndex];
    const rowMeta =
      rawRow && typeof rawRow === 'object'
        ? {
            slug: typeof (rawRow as any).slug === 'string' ? (rawRow as any).slug : undefined,
            name: typeof (rawRow as any).name === 'string' ? (rawRow as any).name : undefined,
          }
        : {};

    const parsed = bulkImportCompanyUpdateRowSchema.safeParse(rawRow);
    if (!parsed.success) {
      result.errors.push({
        row: rowIndex,
        ...rowMeta,
        error: parsed.error.issues[0]?.message || 'Invalid company import row',
      });
      continue;
    }

    const row = parsed.data;
    const normalizedSlug = row.slug
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48);
    if (!normalizedSlug) {
      result.errors.push({
        row: rowIndex,
        slug: row.slug,
        name: row.name,
        error: 'Company slug is invalid',
      });
      continue;
    }

    // Validate category before creating/mutating anything for this row
    let resolvedCategoryId: string | null = null;
    if (row.update) {
      const requestedCategory = row.update.category?.trim();
      if (requestedCategory) {
        const matchedCat = activeCategories.find(
          (c) =>
            c.slug.toLowerCase() === requestedCategory.toLowerCase() ||
            c.id === requestedCategory
        );
        if (!matchedCat) {
          result.errors.push({
            row: rowIndex,
            slug: normalizedSlug,
            name: row.name,
            error: `Unknown or inactive category "${requestedCategory}"`,
          });
          continue;
        }
        resolvedCategoryId = matchedCat.id;
      } else {
        if (!defaultCategory) {
          result.errors.push({
            row: rowIndex,
            slug: normalizedSlug,
            name: row.name,
            error: 'No active announcement categories available',
          });
          continue;
        }
        resolvedCategoryId = defaultCategory.id;
      }
    }

    let company = findMatchingCompany(allCompanies, normalizedSlug, row.website);
    if (company) {
      result.companiesMatched++;
      result.matchedCompanies.push({ slug: company.slug, name: company.name });
    } else {
      const now = Date.now();
      const newId = dryRun ? `dry_${normalizedSlug}` : generateId('cmp');
      const created: CompanyLookupRecord = {
        id: newId,
        slug: normalizedSlug,
        name: row.name,
        website: row.website,
      };

      if (!dryRun) {
        await db.insert(schema.companies).values({
          id: newId,
          slug: normalizedSlug,
          name: row.name,
          logoUrl: null,
          description: row.description,
          website: row.website,
          industry: row.industry,
          headquarters: row.headquarters,
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

      allCompanies.push(created);
      company = created;
      result.companiesCreated++;
      result.createdCompanies.push({
        slug: created.slug,
        name: created.name,
        website: created.website,
      });
    }

    if (row.update && resolvedCategoryId) {
      const trimmedBody = row.update.body.trim();
      let companyBodies = bodiesByCompany.get(company.id);
      if (!companyBodies) {
        companyBodies = new Set<string>();
        bodiesByCompany.set(company.id, companyBodies);
      }

      if (companyBodies.has(trimmedBody)) {
        result.updatesSkipped++;
        continue;
      }

      if (!dryRun) {
        await db.insert(schema.announcements).values({
          id: generateId('ann'),
          companyId: company.id,
          authorUserId: options.adminUserId,
          categoryId: resolvedCategoryId,
          body: trimmedBody,
          externalUrl: row.update.external_url ? row.update.external_url.trim() : null,
          moderationStatus: 'published',
          createdAt: Date.now(),
        });
      }

      companyBodies.add(trimmedBody);
      result.updatesCreated++;
    }
  }

  return result;
}
