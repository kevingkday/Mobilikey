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
import { forwardInboundMessageToEmail } from '../services/email.service';
import { buildAuthenticatedUserPayload, parseJsonArray } from './auth.routes';
import type { PublicUserProfile } from '../../shared/types';
import { ACCESS_LEVELS, type AccessLevelValue } from '../../shared/constants';
import { checkRateLimit } from '../middleware/rateLimit';
import {
  extractTextFromDocumentBuffer,
  importProfileFromLinkedInUrl,
  mergeImportedProfiles,
  parseProfileDocumentText,
  type ImportedProfileData,
} from '../services/profile-import.service';

export const usersRoutes = new Hono<AppContext>();

/**
 * Imports professional profile data from a LinkedIn public URL, an uploaded PDF/CV/DOCX/TXT document,
 * or pasted profile/resume text. Available on both Sign Up and My Profile pages.
 */
usersRoutes.post('/import-profile', async (c) => {
  const db = c.get('db');
  const ip = c.req.header('CF-Connecting-IP') || '127.0.0.1';

  const rate = await checkRateLimit(db, `import_prof:${ip}`, 20, 15 * 60 * 1000);
  if (!rate.allowed) {
    return c.json({ error: 'Too many profile import requests. Please wait a few minutes.' }, 429);
  }

  let linkedinUrl = '';
  let rawText = '';
  let uploadedFileText = '';
  let uploadedFileName = '';

  const contentType = c.req.header('Content-Type') || '';
  if (contentType.includes('multipart/form-data')) {
    const formData = await c.req.formData().catch(() => null);
    if (!formData) {
      return c.json({ error: 'Invalid form data upload.' }, 400);
    }
    linkedinUrl = String(formData.get('linkedinUrl') || '').trim();
    rawText = String(formData.get('rawText') || '').trim();

    const file = formData.get('file');
    if (file && typeof file === 'object' && 'arrayBuffer' in file) {
      const f = file as File;
      if (f.size > 5 * 1024 * 1024) {
        return c.json({ error: 'Uploaded document must be under 5 MB.' }, 400);
      }
      uploadedFileName = f.name || 'document.pdf';
      const buf = await f.arrayBuffer();
      uploadedFileText = await extractTextFromDocumentBuffer(buf, uploadedFileName, f.type || '');
    }
  } else {
    const body = await c.req.json().catch(() => ({}));
    linkedinUrl = String(body?.linkedinUrl || '').trim();
    rawText = String(body?.rawText || '').trim();
  }

  if (!linkedinUrl && !rawText && !uploadedFileText) {
    return c.json(
      {
        error:
          'Provide a LinkedIn public profile URL, upload a PDF/CV/DOCX file, or paste your profile text.',
      },
      400
    );
  }

  let combinedProfile: ImportedProfileData = {
    name: '',
    email: '',
    headline: '',
    biography: '',
    location: '',
    companyName: '',
    position: '',
    website: '',
    industry: '',
    avatarUrl: null,
    socialLinks: {},
  };

  const notices: string[] = [];
  let source: 'linkedin_url' | 'linkedin_url_partial' | 'document' | 'combined' = 'document';

  if (linkedinUrl) {
    try {
      const urlResult = await importProfileFromLinkedInUrl(linkedinUrl);
      combinedProfile = mergeImportedProfiles(combinedProfile, urlResult.profile);
      source = urlResult.source;
      if (urlResult.notice) {
        notices.push(urlResult.notice);
      }
    } catch (err: any) {
      return c.json({ error: err.message || 'Invalid LinkedIn URL' }, 400);
    }
  }

  const combinedDocText = [uploadedFileText, rawText].filter(Boolean).join('\n\n').trim();
  if (combinedDocText) {
    const docProfile = parseProfileDocumentText(combinedDocText);
    combinedProfile = mergeImportedProfiles(combinedProfile, docProfile);
    source = linkedinUrl ? 'combined' : 'document';
    notices.push(
      uploadedFileName
        ? `Extracted profile details from ${uploadedFileName}. Review the imported fields below.`
        : 'Extracted profile details from your pasted text. Review the imported fields below.'
    );
  }

  return c.json({
    profile: combinedProfile,
    source,
    notice: notices.join(' '),
  });
});

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

  // Enrich followed users, followers, and directory users with directional access levels
  const enrichUserAccess = async <T extends { id: string }>(u: T) => {
    const viewerAccessToUser = await AccessService.getAccessLevel(db, viewer.id, 'user', u.id);
    const userAccessToViewer = await AccessService.getAccessLevel(db, u.id, 'user', viewer.id);
    return {
      ...u,
      viewerAccessToUser,
      userAccessToViewer,
    };
  };

  const [enrichedFollowedUsers, enrichedFollowers, enrichedDirectory] = await Promise.all([
    Promise.all(followedUsers.map(enrichUserAccess)),
    Promise.all(followers.map(enrichUserAccess)),
    Promise.all(directoryUsers.map(enrichUserAccess)),
  ]);

  return c.json({
    followedCompanies,
    followedUsers: enrichedFollowedUsers,
    followers: enrichedFollowers,
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

  // Check if position or companyName changed so we can notify followers with a factual career update
  const prevRows = await db
    .select({
      companyName: schema.users.companyName,
      position: schema.users.position,
    })
    .from(schema.users)
    .where(eq(schema.users.id, viewer.id))
    .limit(1);

  const prev = prevRows[0];
  const roleOrCompanyChanged =
    prev &&
    ((d.position && d.position !== prev.position) ||
      (d.companyName && d.companyName !== prev.companyName));

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
      ...(d.expertise !== undefined ? { expertiseJson: JSON.stringify(d.expertise) } : {}),
      ...(d.highlights !== undefined ? { highlightsJson: JSON.stringify(d.highlights) } : {}),
      ...(d.experience !== undefined ? { experienceJson: JSON.stringify(d.experience) } : {}),
      ...(d.credentials !== undefined ? { credentialsJson: JSON.stringify(d.credentials) } : {}),
      ...(d.isPublic !== undefined ? { isPublic: d.isPublic ? 1 : 0 } : {}),
      ...(d.allowLevel1Messages !== undefined
        ? { allowLevel1Messages: d.allowLevel1Messages ? 1 : 0 }
        : {}),
      updatedAt: now,
    })
    .where(eq(schema.users.id, viewer.id));

  if (roleOrCompanyChanged && (d.position || d.companyName)) {
    const followersRows = await db
      .select({ followerUserId: schema.follows.followerUserId })
      .from(schema.follows)
      .where(
        and(eq(schema.follows.targetType, 'user'), eq(schema.follows.targetUserId, viewer.id))
      );

    const roleSummary = [d.position, d.companyName].filter(Boolean).join(' at ');
    for (const flw of followersRows) {
      await db.insert(schema.notifications).values({
        id: generateId('ntf'),
        userId: flw.followerUserId,
        type: 'account_notice',
        title: `Career Update: ${d.name} is now ${roleSummary}.`,
        body: d.headline || 'Factual role update from a professional you follow.',
        referenceType: 'user',
        referenceId: viewer.slug,
        createdAt: now,
      });
    }
  }

  const updated = await buildAuthenticatedUserPayload(db, viewer.id, viewer.csrfToken);
  return c.json({ user: updated });
});

usersRoutes.put('/me/settings', requireAuth, async (c) => {
  const db = c.get('db');
  const viewer = c.get('user')!;
  const body = await c.req.json().catch(() => null);
  const parsed = updateSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: parsed.error.issues[0]?.message || 'Invalid settings data' },
      400
    );
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

usersRoutes.post('/me/test-forwarding', requireAuth, async (c) => {
  const db = c.get('db');
  const viewer = c.get('user')!;
  const body = await c.req.json().catch(() => ({}));
  const level = Number(body?.level);
  if (![1, 2, 3].includes(level)) {
    return c.json({ error: 'Select a valid access level (1, 2, or 3).' }, 400);
  }

  const userRows = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, viewer.id))
    .limit(1);
  if (!userRows[0]) {
    return c.json({ error: 'User not found.' }, 404);
  }

  const result = await forwardInboundMessageToEmail(c.env, {
    recipientPrimaryEmail: userRows[0].email,
    recipientName: userRows[0].name,
    recipientEmailNotifPrefsJson: userRows[0].emailNotifPrefsJson,
    senderName: 'Mobilikey Routing Verification',
    senderSubtitle: 'System Test · Tiered Inbox Forwarding',
    senderAccessLevel: level as AccessLevelValue,
    subject: `Level ${level} Forwarding Verification`,
    body: `This is a test message confirming your Level ${level} email forwarding rule on Mobilikey.`,
    conversationId: 'test_routing',
  });

  if (!result.forwarded || !result.targetEmail) {
    return c.json(
      {
        error: `Email forwarding is currently disabled for Level ${level}. Enable the toggle and save your settings first.`,
      },
      400
    );
  }

  return c.json({
    ok: true,
    level,
    targetEmail: result.targetEmail,
    provider: result.provider,
  });
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

  // Load verified affiliated companies for public profile
  const affiliatedCompanies = await db
    .select({
      companyId: schema.companies.id,
      id: schema.companies.id,
      slug: schema.companies.slug,
      name: schema.companies.name,
      logoUrl: schema.companies.logoUrl,
      industry: schema.companies.industry,
      role: schema.companyMembers.role,
    })
    .from(schema.companyMembers)
    .innerJoin(schema.companies, eq(schema.companyMembers.companyId, schema.companies.id))
    .where(eq(schema.companyMembers.userId, u.id));

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
    expertise: parseJsonArray(u.expertiseJson),
    highlights: parseJsonArray(u.highlightsJson),
    experience: parseJsonArray(u.experienceJson),
    credentials: parseJsonArray(u.credentialsJson),
    avatarUrl: u.avatarUrl,
    isPublic: u.isPublic === 1,
    allowLevel1Messages: u.allowLevel1Messages === 1,
    createdAt: u.createdAt,
    viewerAccessToUser,
    userAccessToViewer,
    isFollowing,
    followerCount: followersRows.length,
    affiliatedCompanies: affiliatedCompanies.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      logoUrl: c.logoUrl,
      industry: c.industry,
      role: c.role as any,
    })),
  };

  return c.json({ profile });
});
