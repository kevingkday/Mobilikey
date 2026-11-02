import { Hono } from 'hono';
import { deleteCookie } from 'hono/cookie';
import { and, desc, eq, ne, or } from 'drizzle-orm';
import type { AppContext } from '../env';
import * as schema from '../db/schema';
import {
  updateProfileSchema,
  updateSettingsSchema,
  toggleFollowSchema,
} from '../../shared/validation';
import { requireAuth, SESSION_COOKIE_NAME } from '../middleware/auth';
import { AccessService } from '../services/access.service';
import { generateId } from '../services/auth.service';
import { buildAuthenticatedUserPayload } from './auth.routes';
import type { PublicUserProfile } from '../../shared/types';
import { ACCESS_LEVELS, type AccessLevelValue } from '../../shared/constants';

export const usersRoutes = new Hono<AppContext>();

usersRoutes.get('/network/overview', requireAuth, async (c) => {
  const db = c.get('db');
  const viewer = c.get('user')!;

  // Followed companies
  const followedCompanies = await db
    .select({
      id: schema.companies.id,
      slug: schema.companies.slug,
      name: schema.companies.name,
      logoUrl: schema.companies.logoUrl,
      industry: schema.companies.industry,
      headquarters: schema.companies.headquarters,
      description: schema.companies.description,
    })
    .from(schema.follows)
    .innerJoin(schema.companies, eq(schema.follows.targetCompanyId, schema.companies.id))
    .where(
      and(
        eq(schema.follows.followerUserId, viewer.id),
        eq(schema.follows.targetType, 'company')
      )
    );

  // Followed people
  const followedUsers = await db
    .select({
      id: schema.users.id,
      slug: schema.users.slug,
      name: schema.users.name,
      headline: schema.users.headline,
      companyName: schema.users.companyName,
      position: schema.users.position,
      location: schema.users.location,
      industry: schema.users.industry,
      avatarUrl: schema.users.avatarUrl,
    })
    .from(schema.follows)
    .innerJoin(schema.users, eq(schema.follows.targetUserId, schema.users.id))
    .where(
      and(
        eq(schema.follows.followerUserId, viewer.id),
        eq(schema.follows.targetType, 'user')
      )
    );

  // Followers (people following the current viewer)
  const followers = await db
    .select({
      id: schema.users.id,
      slug: schema.users.slug,
      name: schema.users.name,
      headline: schema.users.headline,
      companyName: schema.users.companyName,
      position: schema.users.position,
      location: schema.users.location,
      avatarUrl: schema.users.avatarUrl,
    })
    .from(schema.follows)
    .innerJoin(schema.users, eq(schema.follows.followerUserId, schema.users.id))
    .where(
      and(eq(schema.follows.targetType, 'user'), eq(schema.follows.targetUserId, viewer.id))
    );

  // Directory discovery (active public professionals)
  const directoryUsers = await db
    .select({
      id: schema.users.id,
      slug: schema.users.slug,
      name: schema.users.name,
      headline: schema.users.headline,
      companyName: schema.users.companyName,
      position: schema.users.position,
      location: schema.users.location,
      industry: schema.users.industry,
      avatarUrl: schema.users.avatarUrl,
    })
    .from(schema.users)
    .where(and(eq(schema.users.status, 'active'), ne(schema.users.id, viewer.id)))
    .orderBy(desc(schema.users.createdAt))
    .limit(20);

  // Enrich directory users with directional access levels
  const enrichedDirectory = await Promise.all(
    directoryUsers.map(async (u) => {
      const viewerAccessToUser = await AccessService.getAccessLevel(
        db,
        viewer.id,
        'user',
        u.id
      );
      const userAccessToViewer = await AccessService.getAccessLevel(
        db,
        u.id,
        'user',
        viewer.id
      );
      return {
        ...u,
        viewerAccessToUser,
        userAccessToViewer,
      };
    })
  );

  return c.json({
    followedCompanies,
    followedUsers,
    followers,
    directoryUsers: enrichedDirectory,
  });
});

usersRoutes.post('/follow', requireAuth, async (c) => {
  const db = c.get('db');
  const viewer = c.get('user')!;
  const body = await c.req.json().catch(() => null);
  const parsed = toggleFollowSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid follow request' }, 400);
  }

  const { targetType, targetId } = parsed.data;
  if (targetType === 'user' && targetId === viewer.id) {
    return c.json({ error: 'You cannot follow yourself.' }, 400);
  }

  const condition =
    targetType === 'user'
      ? and(
          eq(schema.follows.followerUserId, viewer.id),
          eq(schema.follows.targetType, 'user'),
          eq(schema.follows.targetUserId, targetId)
        )
      : and(
          eq(schema.follows.followerUserId, viewer.id),
          eq(schema.follows.targetType, 'company'),
          eq(schema.follows.targetCompanyId, targetId)
        );

  const existing = await db.select().from(schema.follows).where(condition).limit(1);

  if (existing[0]) {
    await db.delete(schema.follows).where(eq(schema.follows.id, existing[0].id));
    return c.json({ following: false });
  }

  const now = Date.now();
  await db.insert(schema.follows).values({
    id: generateId('flw'),
    followerUserId: viewer.id,
    targetType,
    targetUserId: targetType === 'user' ? targetId : null,
    targetCompanyId: targetType === 'company' ? targetId : null,
    createdAt: now,
  });

  if (targetType === 'user') {
    await db.insert(schema.notifications).values({
      id: generateId('ntf'),
      userId: targetId,
      type: 'new_follower',
      title: `${viewer.name} is now following your professional updates.`,
      body: '',
      referenceType: 'user',
      referenceId: viewer.slug,
      createdAt: now,
    });
  }

  return c.json({ following: true });
});

usersRoutes.put('/me', requireAuth, async (c) => {
  const db = c.get('db');
  const viewer = c.get('user')!;
  const body = await c.req.json().catch(() => null);
  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message || 'Invalid profile data' }, 400);
  }

  const d = parsed.data;
  const now = Date.now();
  await db
    .update(schema.users)
    .set({
      name: d.name,
      headline: d.headline,
      biography: d.biography,
      location: d.location,
      companyName: d.companyName,
      position: d.position,
      website: d.website,
      industry: d.industry,
      ...(d.avatarUrl !== undefined ? { avatarUrl: d.avatarUrl || null } : {}),
      socialLinksJson: JSON.stringify(d.socialLinks || {}),
      ...(d.isPublic !== undefined ? { isPublic: d.isPublic ? 1 : 0 } : {}),
      ...(d.allowLevel1Messages !== undefined
        ? { allowLevel1Messages: d.allowLevel1Messages ? 1 : 0 }
        : {}),
      updatedAt: now,
    })
    .where(eq(schema.users.id, viewer.id));

  const updated = await buildAuthenticatedUserPayload(db, viewer.id, viewer.csrfToken);
  return c.json({ user: updated });
});

usersRoutes.put('/me/settings', requireAuth, async (c) => {
  const db = c.get('db');
  const viewer = c.get('user')!;
  const body = await c.req.json().catch(() => null);
  const parsed = updateSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid settings data' }, 400);
  }

  const d = parsed.data;
  const now = Date.now();
  await db
    .update(schema.users)
    .set({
      isPublic: d.isPublic ? 1 : 0,
      allowLevel1Messages: d.allowLevel1Messages ? 1 : 0,
      emailNotifPrefsJson: JSON.stringify(d.emailNotifPrefs),
      updatedAt: now,
    })
    .where(eq(schema.users.id, viewer.id));

  const updated = await buildAuthenticatedUserPayload(db, viewer.id, viewer.csrfToken);
  return c.json({ user: updated });
});

usersRoutes.delete('/me', requireAuth, async (c) => {
  const db = c.get('db');
  const viewer = c.get('user')!;
  const now = Date.now();

  await db
    .update(schema.users)
    .set({
      status: 'deleted',
      name: 'Deleted Professional',
      email: `deleted_${viewer.id}@deleted.mobilikey.invalid`,
      headline: '',
      biography: '',
      website: '',
      socialLinksJson: '{}',
      avatarUrl: null,
      isPublic: 0,
      updatedAt: now,
    })
    .where(eq(schema.users.id, viewer.id));

  await db.delete(schema.sessions).where(eq(schema.sessions.userId, viewer.id));

  await db.insert(schema.auditLogs).values({
    id: generateId('aud'),
    actorUserId: viewer.id,
    action: 'account_self_deleted',
    targetType: 'user',
    targetId: viewer.id,
    metadataJson: '{}',
    createdAt: now,
  });

  deleteCookie(c, SESSION_COOKIE_NAME, { path: '/' });
  return c.json({ ok: true });
});

usersRoutes.get('/:slugOrId', async (c) => {
  const db = c.get('db');
  const viewer = c.get('user');
  const slugOrId = c.req.param('slugOrId');

  const rows = await db
    .select()
    .from(schema.users)
    .where(
      and(
        eq(schema.users.status, 'active'),
        or(eq(schema.users.slug, slugOrId), eq(schema.users.id, slugOrId))
      )
    )
    .limit(1);

  const u = rows[0];
  if (!u) {
    return c.json({ error: 'Profile not found.' }, 404);
  }

  // Respect privacy setting: if profile is not public, require authentication
  if (u.isPublic === 0 && !viewer) {
    return c.json(
      { error: 'This professional profile is visible to signed-in Mobilikey members only.' },
      403
    );
  }

  let socialLinks = {};
  try {
    socialLinks = JSON.parse(u.socialLinksJson || '{}');
  } catch {
    socialLinks = {};
  }

  const followersRows = await db
    .select({ id: schema.follows.id })
    .from(schema.follows)
    .where(and(eq(schema.follows.targetType, 'user'), eq(schema.follows.targetUserId, u.id)));

  let viewerAccessToUser: AccessLevelValue = ACCESS_LEVELS.GENERAL;
  let userAccessToViewer: AccessLevelValue = ACCESS_LEVELS.GENERAL;
  let isFollowing = false;

  if (viewer && viewer.id !== u.id) {
    viewerAccessToUser = await AccessService.getAccessLevel(db, viewer.id, 'user', u.id);
    userAccessToViewer = await AccessService.getAccessLevel(db, u.id, 'user', viewer.id);
    const flw = await db
      .select({ id: schema.follows.id })
      .from(schema.follows)
      .where(
        and(
          eq(schema.follows.followerUserId, viewer.id),
          eq(schema.follows.targetType, 'user'),
          eq(schema.follows.targetUserId, u.id)
        )
      )
      .limit(1);
    isFollowing = Boolean(flw[0]);
  }

  // Note: email is NEVER exposed on public profile responses
  const profile: PublicUserProfile = {
    id: u.id,
    slug: u.slug,
    name: u.name,
    headline: u.headline,
    biography: u.biography,
    location: u.location,
    companyName: u.companyName,
    position: u.position,
    website: u.website,
    industry: u.industry,
    socialLinks,
    avatarUrl: u.avatarUrl,
    isPublic: u.isPublic === 1,
    allowLevel1Messages: u.allowLevel1Messages === 1,
    createdAt: u.createdAt,
    viewerAccessToUser,
    userAccessToViewer,
    isFollowing,
    followerCount: followersRows.length,
  };

  return c.json({ profile });
});
