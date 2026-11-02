import { Hono } from 'hono';
import { and, desc, eq } from 'drizzle-orm';
import type { AppContext } from '../env';
import * as schema from '../db/schema';
import { AccessService } from '../services/access.service';
import { ACCESS_LEVELS, type AccessLevelValue } from '../../shared/constants';

export const searchRoutes = new Hono<AppContext>();

searchRoutes.get('/', async (c) => {
  const db = c.get('db');
  const viewer = c.get('user');

  const q = (c.req.query('q') || '').trim().toLowerCase();
  const type = c.req.query('type') || 'all'; // 'all' | 'people' | 'companies' | 'announcements'
  const industryFilter = (c.req.query('industry') || '').trim().toLowerCase();
  const locationFilter = (c.req.query('location') || '').trim().toLowerCase();

  let people: any[] = [];
  let companies: any[] = [];
  let announcements: any[] = [];

  if (type === 'all' || type === 'people') {
    const rawUsers = await db
      .select({
        id: schema.users.id,
        slug: schema.users.slug,
        name: schema.users.name,
        headline: schema.users.headline,
        position: schema.users.position,
        companyName: schema.users.companyName,
        location: schema.users.location,
        industry: schema.users.industry,
        avatarUrl: schema.users.avatarUrl,
        isPublic: schema.users.isPublic,
      })
      .from(schema.users)
      .where(eq(schema.users.status, 'active'))
      .orderBy(desc(schema.users.createdAt))
      .limit(100);

    const matchedUsers = rawUsers.filter((u) => {
      if (!viewer && u.isPublic === 0) return false;
      if (industryFilter && !u.industry.toLowerCase().includes(industryFilter)) {
        return false;
      }
      if (locationFilter && !u.location.toLowerCase().includes(locationFilter)) {
        return false;
      }
      if (!q) return true;
      const haystack = [
        u.name,
        u.headline,
        u.position,
        u.companyName,
        u.location,
        u.industry,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });

    people = await Promise.all(
      matchedUsers.slice(0, 30).map(async (u) => {
        let viewerAccessToUser: AccessLevelValue = ACCESS_LEVELS.GENERAL;
        if (viewer && viewer.id !== u.id) {
          viewerAccessToUser = await AccessService.getAccessLevel(db, viewer.id, 'user', u.id);
        }
        return {
          ...u,
          viewerAccessToUser,
        };
      })
    );
  }

  if (type === 'all' || type === 'companies') {
    const rawCompanies = await db
      .select()
      .from(schema.companies)
      .where(eq(schema.companies.status, 'active'))
      .orderBy(desc(schema.companies.createdAt))
      .limit(100);

    const matchedCompanies = rawCompanies.filter((comp) => {
      if (industryFilter && !comp.industry.toLowerCase().includes(industryFilter)) {
        return false;
      }
      if (locationFilter && !comp.headquarters.toLowerCase().includes(locationFilter)) {
        return false;
      }
      if (!q) return true;
      const haystack = [
        comp.name,
        comp.industry,
        comp.headquarters,
        comp.description,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });

    companies = await Promise.all(
      matchedCompanies.slice(0, 30).map(async (comp) => {
        let isFollowing = false;
        let viewerAccessToCompany: AccessLevelValue = ACCESS_LEVELS.GENERAL;
        if (viewer) {
          viewerAccessToCompany = await AccessService.getAccessLevel(
            db,
            viewer.id,
            'company',
            comp.id
          );
          const flw = await db
            .select({ id: schema.follows.id })
            .from(schema.follows)
            .where(
              and(
                eq(schema.follows.followerUserId, viewer.id),
                eq(schema.follows.targetType, 'company'),
                eq(schema.follows.targetCompanyId, comp.id)
              )
            )
            .limit(1);
          isFollowing = Boolean(flw[0]);
        }
        return {
          id: comp.id,
          slug: comp.slug,
          name: comp.name,
          logoUrl: comp.logoUrl,
          industry: comp.industry,
          headquarters: comp.headquarters,
          companySize: comp.companySize,
          description: comp.description,
          isFollowing,
          viewerAccessToCompany,
        };
      })
    );
  }

  if (type === 'all' || type === 'announcements') {
    const rawAnns = await db
      .select({
        id: schema.announcements.id,
        companyId: schema.announcements.companyId,
        companyName: schema.companies.name,
        companySlug: schema.companies.slug,
        companyLogoUrl: schema.companies.logoUrl,
        companyIndustry: schema.companies.industry,
        companyHeadquarters: schema.companies.headquarters,
        authorUserId: schema.announcements.authorUserId,
        authorName: schema.users.name,
        categoryId: schema.announcements.categoryId,
        categoryName: schema.announcementCategories.name,
        categorySlug: schema.announcementCategories.slug,
        body: schema.announcements.body,
        externalUrl: schema.announcements.externalUrl,
        moderationStatus: schema.announcements.moderationStatus,
        createdAt: schema.announcements.createdAt,
      })
      .from(schema.announcements)
      .innerJoin(schema.companies, eq(schema.announcements.companyId, schema.companies.id))
      .innerJoin(
        schema.announcementCategories,
        eq(schema.announcements.categoryId, schema.announcementCategories.id)
      )
      .innerJoin(schema.users, eq(schema.announcements.authorUserId, schema.users.id))
      .where(
        and(
          eq(schema.announcements.moderationStatus, 'published'),
          eq(schema.companies.status, 'active')
        )
      )
      .orderBy(desc(schema.announcements.createdAt))
      .limit(100);

    announcements = rawAnns
      .filter((a) => {
        if (industryFilter && !a.companyIndustry.toLowerCase().includes(industryFilter)) {
          return false;
        }
        if (
          locationFilter &&
          !a.companyHeadquarters.toLowerCase().includes(locationFilter)
        ) {
          return false;
        }
        if (!q) return true;
        const haystack = [
          a.body,
          a.companyName,
          a.categoryName,
          a.companyIndustry,
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      })
      .slice(0, 30);
  }

  return c.json({ people, companies, announcements });
});
