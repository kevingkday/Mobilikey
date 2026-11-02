import { Hono } from 'hono';
import { and, asc, desc, eq, inArray, or } from 'drizzle-orm';
import type { AppContext } from '../env';
import * as schema from '../db/schema';
import { createAnnouncementSchema, createReportSchema } from '../../shared/validation';
import { requireAuth } from '../middleware/auth';
import { generateId } from '../services/auth.service';
import type { AnnouncementItem } from '../../shared/types';

export const announcementsRoutes = new Hono<AppContext>();

announcementsRoutes.get('/categories', async (c) => {
  const db = c.get('db');
  const categories = await db
    .select()
    .from(schema.announcementCategories)
    .where(eq(schema.announcementCategories.isActive, 1))
    .orderBy(asc(schema.announcementCategories.sortOrder));

  return c.json({ categories });
});

announcementsRoutes.get('/', async (c) => {
  const db = c.get('db');
  const viewer = c.get('user');
  const feedMode = c.req.query('feed') || 'public'; // 'following' | 'public'
  const categorySlug = c.req.query('category') || '';
  const companyId = c.req.query('companyId') || '';

  let followedCompanyIds: string[] = [];
  let followedUserIds: string[] = [];

  if (feedMode === 'following' && viewer) {
    const flwRows = await db
      .select()
      .from(schema.follows)
      .where(eq(schema.follows.followerUserId, viewer.id));

    for (const f of flwRows) {
      if (f.targetType === 'company' && f.targetCompanyId) {
        followedCompanyIds.push(f.targetCompanyId);
      } else if (f.targetType === 'user' && f.targetUserId) {
        followedUserIds.push(f.targetUserId);
      }
    }
  }

  const rows = await db
    .select({
      id: schema.announcements.id,
      companyId: schema.announcements.companyId,
      companyName: schema.companies.name,
      companySlug: schema.companies.slug,
      companyLogoUrl: schema.companies.logoUrl,
      companyIndustry: schema.companies.industry,
      companyStatus: schema.companies.status,
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

  const filtered = rows.filter((r) => {
    if (categorySlug && r.categorySlug !== categorySlug && r.categoryId !== categorySlug) {
      return false;
    }
    if (companyId && r.companyId !== companyId) {
      return false;
    }
    if (feedMode === 'following' && viewer) {
      return (
        followedCompanyIds.includes(r.companyId) ||
        followedUserIds.includes(r.authorUserId)
      );
    }
    return true;
  });

  const announcements: AnnouncementItem[] = filtered.map((r) => ({
    id: r.id,
    companyId: r.companyId,
    companyName: r.companyName,
    companySlug: r.companySlug,
    companyLogoUrl: r.companyLogoUrl,
    companyIndustry: r.companyIndustry,
    authorUserId: r.authorUserId,
    authorName: r.authorName,
    categoryId: r.categoryId,
    categoryName: r.categoryName,
    categorySlug: r.categorySlug,
    body: r.body,
    externalUrl: r.externalUrl,
    moderationStatus: r.moderationStatus as AnnouncementItem['moderationStatus'],
    createdAt: r.createdAt,
  }));

  return c.json({ announcements });
});

announcementsRoutes.post('/', requireAuth, async (c) => {
  const db = c.get('db');
  const user = c.get('user')!;

  const body = await c.req.json().catch(() => null);
  const parsed = createAnnouncementSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: parsed.error.issues[0]?.message || 'Invalid announcement submission' },
      400
    );
  }

  const { companyId, categoryId, body: textBody, externalUrl } = parsed.data;

  // Verify user is an authorized member ('owner', 'admin', or 'publisher') of this company
  const memberRows = await db
    .select()
    .from(schema.companyMembers)
    .where(
      and(
        eq(schema.companyMembers.companyId, companyId),
        eq(schema.companyMembers.userId, user.id)
      )
    )
    .limit(1);

  if (!memberRows[0]) {
    return c.json(
      { error: 'You are not an authorized member of this company and cannot publish on its behalf.' },
      403
    );
  }

  // Verify category is active
  const catRows = await db
    .select()
    .from(schema.announcementCategories)
    .where(
      and(
        or(
          eq(schema.announcementCategories.id, categoryId),
          eq(schema.announcementCategories.slug, categoryId)
        ),
        eq(schema.announcementCategories.isActive, 1)
      )
    )
    .limit(1);

  if (!catRows[0]) {
    return c.json({ error: 'Selected announcement category is invalid.' }, 400);
  }

  const now = Date.now();
  const announcementId = generateId('ann');

  await db.insert(schema.announcements).values({
    id: announcementId,
    companyId,
    authorUserId: user.id,
    categoryId: catRows[0].id,
    body: textBody.trim(),
    externalUrl: externalUrl ? externalUrl.trim() : null,
    moderationStatus: 'published',
    createdAt: now,
  });

  return c.json({ announcementId }, 201);
});

announcementsRoutes.delete('/:id', requireAuth, async (c) => {
  const db = c.get('db');
  const user = c.get('user')!;
  const id = c.req.param('id')!;

  const rows = await db
    .select()
    .from(schema.announcements)
    .where(eq(schema.announcements.id, id))
    .limit(1);

  const ann = rows[0];
  if (!ann) {
    return c.json({ error: 'Announcement not found.' }, 404);
  }

  const memberRows = await db
    .select()
    .from(schema.companyMembers)
    .where(
      and(
        eq(schema.companyMembers.companyId, ann.companyId),
        eq(schema.companyMembers.userId, user.id)
      )
    )
    .limit(1);

  const isCompanyAdmin =
    memberRows[0]?.role === 'owner' || memberRows[0]?.role === 'admin';

  if (ann.authorUserId !== user.id && !isCompanyAdmin && user.systemRole !== 'admin') {
    return c.json({ error: 'Not authorized to remove this announcement.' }, 403);
  }

  await db.delete(schema.announcements).where(eq(schema.announcements.id, id));
  return c.json({ ok: true });
});

announcementsRoutes.post('/report', requireAuth, async (c) => {
  const db = c.get('db');
  const user = c.get('user')!;

  const body = await c.req.json().catch(() => null);
  const parsed = createReportSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message || 'Invalid report details' }, 400);
  }

  const now = Date.now();
  const reportId = generateId('rep');

  await db.insert(schema.reports).values({
    id: reportId,
    reporterUserId: user.id,
    targetType: parsed.data.targetType,
    targetId: parsed.data.targetId,
    reason: parsed.data.reason,
    details: parsed.data.details,
    status: 'open',
    createdAt: now,
  });

  return c.json(
    {
      reportId,
      message: 'Report submitted for moderation review.',
    },
    201
  );
});
