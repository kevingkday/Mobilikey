import { Hono } from 'hono';
import { and, desc, eq, or } from 'drizzle-orm';
import type { AppContext } from '../env';
import * as schema from '../db/schema';
import {
  createCompanySchema,
  updateCompanySchema,
  addCompanyMemberSchema,
} from '../../shared/validation';
import { requireAuth } from '../middleware/auth';
import { AccessService } from '../services/access.service';
import { generateId, slugify } from '../services/auth.service';
import { ACCESS_LEVELS, type AccessLevelValue } from '../../shared/constants';
import type { CompanyMemberRole, CompanyProfile } from '../../shared/types';

export const companiesRoutes = new Hono<AppContext>();

companiesRoutes.get('/', async (c) => {
  const db = c.get('db');
  const viewer = c.get('user');

  const rows = await db
    .select()
    .from(schema.companies)
    .where(eq(schema.companies.status, 'active'))
    .orderBy(desc(schema.companies.createdAt))
    .limit(50);

  const companiesList = await Promise.all(
    rows.map(async (comp) => {
      const flwRows = await db
        .select({ id: schema.follows.id })
        .from(schema.follows)
        .where(
          and(
            eq(schema.follows.targetType, 'company'),
            eq(schema.follows.targetCompanyId, comp.id)
          )
        );

      let isFollowing = false;
      let viewerAccessToCompany: AccessLevelValue = ACCESS_LEVELS.GENERAL;
      let viewerRole: CompanyMemberRole | null = null;

      if (viewer) {
        viewerAccessToCompany = await AccessService.getAccessLevel(
          db,
          viewer.id,
          'company',
          comp.id
        );
        const myFlw = await db
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
        isFollowing = Boolean(myFlw[0]);

        const mem = await db
          .select({ role: schema.companyMembers.role })
          .from(schema.companyMembers)
          .where(
            and(
              eq(schema.companyMembers.companyId, comp.id),
              eq(schema.companyMembers.userId, viewer.id)
            )
          )
          .limit(1);
        if (mem[0]) {
          viewerRole = mem[0].role as CompanyMemberRole;
        }
      }

      return {
        id: comp.id,
        slug: comp.slug,
        name: comp.name,
        logoUrl: comp.logoUrl,
        description: comp.description,
        website: comp.website,
        industry: comp.industry,
        headquarters: comp.headquarters,
        companySize: comp.companySize,
        contactInfo: comp.contactInfo,
        status: comp.status as 'active' | 'suspended',
        createdAt: comp.createdAt,
        followerCount: flwRows.length,
        isFollowing,
        viewerAccessToCompany,
        viewerRole,
      } satisfies CompanyProfile;
    })
  );

  return c.json({ companies: companiesList });
});

companiesRoutes.post('/', requireAuth, async (c) => {
  const db = c.get('db');
  const viewer = c.get('user')!;
  const body = await c.req.json().catch(() => null);
  const parsed = createCompanySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message || 'Invalid company details' }, 400);
  }

  const d = parsed.data;
  const now = Date.now();
  const companyId = generateId('cmp');
  let slug = d.slug || slugify(d.name);

  // Ensure slug uniqueness
  const existingSlug = await db
    .select({ id: schema.companies.id })
    .from(schema.companies)
    .where(eq(schema.companies.slug, slug))
    .limit(1);
  if (existingSlug[0]) {
    slug = slugify(d.name);
  }

  await db.insert(schema.companies).values({
    id: companyId,
    slug,
    name: d.name,
    logoUrl: d.logoUrl || null,
    description: d.description,
    website: d.website,
    industry: d.industry,
    headquarters: d.headquarters,
    companySize: d.companySize,
    contactInfo: d.contactInfo,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(schema.companyMembers).values({
    id: generateId('cm'),
    companyId,
    userId: viewer.id,
    role: 'owner',
    createdAt: now,
  });

  await db.insert(schema.auditLogs).values({
    id: generateId('aud'),
    actorUserId: viewer.id,
    action: 'company_created',
    targetType: 'company',
    targetId: companyId,
    metadataJson: JSON.stringify({ name: d.name, slug }),
    createdAt: now,
  });

  return c.json({ companyId, slug }, 201);
});

companiesRoutes.get('/:slugOrId', async (c) => {
  const db = c.get('db');
  const viewer = c.get('user');
  const slugOrId = c.req.param('slugOrId');

  const rows = await db
    .select()
    .from(schema.companies)
    .where(
      and(
        eq(schema.companies.status, 'active'),
        or(eq(schema.companies.slug, slugOrId), eq(schema.companies.id, slugOrId))
      )
    )
    .limit(1);

  const comp = rows[0];
  if (!comp) {
    return c.json({ error: 'Company profile not found.' }, 404);
  }

  const flwRows = await db
    .select({ id: schema.follows.id })
    .from(schema.follows)
    .where(
      and(
        eq(schema.follows.targetType, 'company'),
        eq(schema.follows.targetCompanyId, comp.id)
      )
    );

  let isFollowing = false;
  let viewerAccessToCompany: AccessLevelValue = ACCESS_LEVELS.GENERAL;
  let viewerRole: CompanyMemberRole | null = null;

  if (viewer) {
    viewerAccessToCompany = await AccessService.getAccessLevel(
      db,
      viewer.id,
      'company',
      comp.id
    );
    const myFlw = await db
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
    isFollowing = Boolean(myFlw[0]);

    const mem = await db
      .select({ role: schema.companyMembers.role })
      .from(schema.companyMembers)
      .where(
        and(
          eq(schema.companyMembers.companyId, comp.id),
          eq(schema.companyMembers.userId, viewer.id)
        )
      )
      .limit(1);
    if (mem[0]) {
      viewerRole = mem[0].role as CompanyMemberRole;
    }
  }

  // Fetch company members
  const memberRows = await db
    .select({
      id: schema.companyMembers.id,
      userId: schema.users.id,
      userName: schema.users.name,
      userSlug: schema.users.slug,
      userHeadline: schema.users.headline,
      userAvatarUrl: schema.users.avatarUrl,
      role: schema.companyMembers.role,
      createdAt: schema.companyMembers.createdAt,
    })
    .from(schema.companyMembers)
    .innerJoin(schema.users, eq(schema.companyMembers.userId, schema.users.id))
    .where(eq(schema.companyMembers.companyId, comp.id));

  // If viewer is company owner or admin, also load company followers with their inbox access level
  let companyFollowers: CompanyProfile['followers'] = undefined;
  if (viewerRole === 'owner' || viewerRole === 'admin') {
    const rawFollowers = await db
      .select({
        userId: schema.users.id,
        userName: schema.users.name,
        userSlug: schema.users.slug,
        userHeadline: schema.users.headline,
        userCompany: schema.users.companyName,
        userAvatarUrl: schema.users.avatarUrl,
        followedAt: schema.follows.createdAt,
      })
      .from(schema.follows)
      .innerJoin(schema.users, eq(schema.follows.followerUserId, schema.users.id))
      .where(
        and(
          eq(schema.follows.targetType, 'company'),
          eq(schema.follows.targetCompanyId, comp.id)
        )
      )
      .orderBy(desc(schema.follows.createdAt));

    companyFollowers = await Promise.all(
      rawFollowers.map(async (f) => ({
        ...f,
        accessLevelToCompany: await AccessService.getAccessLevel(
          db,
          f.userId,
          'company',
          comp.id
        ),
      }))
    );
  }

  // Fetch recent announcements for this company
  const recentAnnouncements = await db
    .select({
      id: schema.announcements.id,
      companyId: schema.announcements.companyId,
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
    .innerJoin(
      schema.announcementCategories,
      eq(schema.announcements.categoryId, schema.announcementCategories.id)
    )
    .innerJoin(schema.users, eq(schema.announcements.authorUserId, schema.users.id))
    .where(
      and(
        eq(schema.announcements.companyId, comp.id),
        eq(schema.announcements.moderationStatus, 'published')
      )
    )
    .orderBy(desc(schema.announcements.createdAt))
    .limit(20);

  const profile: CompanyProfile = {
    id: comp.id,
    slug: comp.slug,
    name: comp.name,
    logoUrl: comp.logoUrl,
    description: comp.description,
    website: comp.website,
    industry: comp.industry,
    headquarters: comp.headquarters,
    companySize: comp.companySize,
    contactInfo: comp.contactInfo,
    status: comp.status as 'active' | 'suspended',
    createdAt: comp.createdAt,
    followerCount: flwRows.length,
    isFollowing,
    viewerAccessToCompany,
    viewerRole,
    members: memberRows.map((m) => ({
      ...m,
      role: m.role as CompanyMemberRole,
    })),
    followers: companyFollowers,
  };

  return c.json({
    company: profile,
    announcements: recentAnnouncements.map((a) => ({
      ...a,
      companyName: comp.name,
      companySlug: comp.slug,
      companyLogoUrl: comp.logoUrl,
      companyIndustry: comp.industry,
      moderationStatus: a.moderationStatus as 'published' | 'flagged' | 'removed',
      isFollowingCompany: isFollowing,
    })),
  });
});

companiesRoutes.put('/:id', requireAuth, async (c) => {
  const db = c.get('db');
  const viewer = c.get('user')!;
  const companyId = c.req.param('id')!;

  const isAdmin = await AccessService.isCompanyInboxAdmin(db, viewer.id, companyId);
  if (!isAdmin) {
    return c.json({ error: 'Only company owners and administrators may update company settings.' }, 403);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = updateCompanySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message || 'Invalid company update' }, 400);
  }

  const d = parsed.data;
  const now = Date.now();
  await db
    .update(schema.companies)
    .set({
      name: d.name,
      ...(d.logoUrl !== undefined ? { logoUrl: d.logoUrl || null } : {}),
      ...(d.description !== undefined ? { description: d.description } : {}),
      ...(d.website !== undefined ? { website: d.website } : {}),
      ...(d.industry !== undefined ? { industry: d.industry } : {}),
      ...(d.headquarters !== undefined ? { headquarters: d.headquarters } : {}),
      ...(d.companySize !== undefined ? { companySize: d.companySize } : {}),
      ...(d.contactInfo !== undefined ? { contactInfo: d.contactInfo } : {}),
      updatedAt: now,
    })
    .where(eq(schema.companies.id, companyId));

  return c.json({ ok: true });
});

companiesRoutes.post('/:id/members', requireAuth, async (c) => {
  const db = c.get('db');
  const viewer = c.get('user')!;
  const companyId = c.req.param('id')!;

  const isAdmin = await AccessService.isCompanyInboxAdmin(db, viewer.id, companyId);
  if (!isAdmin) {
    return c.json({ error: 'Only company owners and administrators can add team members.' }, 403);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = addCompanyMemberSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message || 'Invalid member details' }, 400);
  }

  const targetEmail = parsed.data.email.toLowerCase().trim();
  const userRows = await db
    .select()
    .from(schema.users)
    .where(and(eq(schema.users.email, targetEmail), eq(schema.users.status, 'active')))
    .limit(1);

  const targetUser = userRows[0];
  if (!targetUser) {
    return c.json(
      { error: 'No active Mobilikey professional account found with that email address.' },
      404
    );
  }

  const existing = await db
    .select()
    .from(schema.companyMembers)
    .where(
      and(
        eq(schema.companyMembers.companyId, companyId),
        eq(schema.companyMembers.userId, targetUser.id)
      )
    )
    .limit(1);

  if (existing[0]) {
    await db
      .update(schema.companyMembers)
      .set({ role: parsed.data.role })
      .where(eq(schema.companyMembers.id, existing[0].id));
    return c.json({ ok: true, updated: true });
  }

  await db.insert(schema.companyMembers).values({
    id: generateId('cm'),
    companyId,
    userId: targetUser.id,
    role: parsed.data.role,
    createdAt: Date.now(),
  });

  return c.json({ ok: true, added: true }, 201);
});

companiesRoutes.delete('/:id/members/:memberId', requireAuth, async (c) => {
  const db = c.get('db');
  const viewer = c.get('user')!;
  const companyId = c.req.param('id')!;
  const memberId = c.req.param('memberId')!;

  const isAdmin = await AccessService.isCompanyInboxAdmin(db, viewer.id, companyId);
  if (!isAdmin) {
    return c.json({ error: 'Only company owners and administrators can remove team members.' }, 403);
  }

  const targetMem = await db
    .select()
    .from(schema.companyMembers)
    .where(
      and(
        eq(schema.companyMembers.id, memberId),
        eq(schema.companyMembers.companyId, companyId)
      )
    )
    .limit(1);

  if (!targetMem[0]) {
    return c.json({ error: 'Member not found.' }, 404);
  }

  if (targetMem[0].role === 'owner') {
    return c.json({ error: 'Cannot remove the primary company owner.' }, 400);
  }

  await db.delete(schema.companyMembers).where(eq(schema.companyMembers.id, memberId));
  return c.json({ ok: true });
});
