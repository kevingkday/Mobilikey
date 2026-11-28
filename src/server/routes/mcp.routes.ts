import { Hono } from 'hono';
import { and, asc, desc, eq, inArray, or } from 'drizzle-orm';
import type { AppContext, SessionUserContext } from '../env';
import * as schema from '../db/schema';
import { generateId, sha256Hex } from '../services/auth.service';
import { buildAuthenticatedUserPayload, parseJsonArray } from './auth.routes';
import {
  createAnnouncementSchema,
  updateAnnouncementSchema,
  updateProfileSchema,
} from '../../shared/validation';

const SUPPORTED_PROTOCOL_VERSIONS = ['2025-03-26', '2024-11-05'] as const;
const DEFAULT_PROTOCOL_VERSION = '2025-03-26';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

interface McpToolDefinition {
  name: string;
  title?: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: {
    title?: string;
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  };
}

const MCP_TOOLS: McpToolDefinition[] = [
  {
    name: 'get_my_profile',
    title: 'Get My Keylenta Profile',
    description:
      'Retrieve your authenticated Keylenta professional profile, including name, headline, biography, location, companyName, position, website, industry, socialLinks, expertise, highlights, experience, credentials, privacy settings, and affiliated companies.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    annotations: {
      title: 'Get My Profile',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: 'update_my_profile',
    title: 'Update My Keylenta Profile',
    description:
      'Update one or more fields on your Keylenta professional profile. Only the fields you provide will be updated; omitted fields keep their current values. Changing position or companyName notifies your followers with a factual career update.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 2, maxLength: 100, description: 'Full name' },
        headline: { type: 'string', maxLength: 140, description: 'Short professional headline' },
        biography: { type: 'string', maxLength: 4000, description: 'Professional biography' },
        location: { type: 'string', maxLength: 120, description: 'City, state/region, or country' },
        companyName: { type: 'string', maxLength: 120, description: 'Current company or organization' },
        position: { type: 'string', maxLength: 120, description: 'Current role or title' },
        website: { type: 'string', maxLength: 300, description: 'Personal or company website URL (http/https or empty string)' },
        industry: { type: 'string', maxLength: 100, description: 'Industry sector' },
        socialLinks: {
          type: 'object',
          description: 'Social profile URLs',
          properties: {
            linkedin: { type: 'string' },
            github: { type: 'string' },
            x: { type: 'string' },
            other: { type: 'string' },
          },
          additionalProperties: false,
        },
        expertise: {
          type: 'array',
          items: { type: 'string', minLength: 1, maxLength: 60 },
          maxItems: 15,
          description: 'List of core expertise tags',
        },
        highlights: {
          type: 'array',
          items: { type: 'string', minLength: 1, maxLength: 240 },
          maxItems: 8,
          description: 'Key career highlights',
        },
        experience: {
          type: 'array',
          maxItems: 20,
          description: 'Work experience entries',
          items: {
            type: 'object',
            required: ['id', 'title', 'company'],
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              company: { type: 'string' },
              location: { type: 'string' },
              startDate: { type: 'string' },
              endDate: { type: 'string' },
              isCurrent: { type: 'boolean' },
              description: { type: 'string' },
            },
          },
        },
        credentials: {
          type: 'array',
          maxItems: 15,
          description: 'Education, licenses, or credentials',
          items: {
            type: 'object',
            required: ['id', 'title', 'issuer'],
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              issuer: { type: 'string' },
              year: { type: 'string' },
              details: { type: 'string' },
            },
          },
        },
        isPublic: { type: 'boolean', description: 'Whether your profile is publicly visible' },
        allowLevel1Messages: {
          type: 'boolean',
          description: 'Whether Level 1 General Access messages are allowed',
        },
      },
      additionalProperties: false,
    },
    annotations: {
      title: 'Update My Profile',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: 'list_announcement_categories',
    title: 'List Announcement Categories',
    description:
      'List active Keylenta announcement (post) categories so you can choose a valid categoryId or slug when creating or updating a post.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    annotations: {
      title: 'List Announcement Categories',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: 'list_my_posts',
    title: 'List My Posts',
    description:
      'List your Keylenta posts (factual business announcements), including posts you authored and posts on companies you manage.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 50,
          description: 'Maximum number of posts to return (default 20)',
        },
      },
      additionalProperties: false,
    },
    annotations: {
      title: 'List My Posts',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: 'create_post',
    title: 'Create a Post',
    description:
      'Publish a new factual business announcement (post) on Keylenta. Posts must be 10–500 characters, contain at most 2 hashtags, and avoid engagement bait phrases.',
    inputSchema: {
      type: 'object',
      required: ['body', 'categoryId'],
      properties: {
        body: {
          type: 'string',
          minLength: 10,
          maxLength: 500,
          description: 'Factual announcement text (10–500 characters, max 2 hashtags, no engagement bait)',
        },
        categoryId: {
          type: 'string',
          minLength: 1,
          description: 'Announcement category ID or slug (call list_announcement_categories to see valid options)',
        },
        externalUrl: {
          type: ['string', 'null'],
          description: 'Optional external reference URL (http/https)',
        },
        companyId: {
          type: ['string', 'null'],
          description: 'Optional company ID to publish on behalf of (must be an authorized company member)',
        },
      },
      additionalProperties: false,
    },
    annotations: {
      title: 'Create Post',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  {
    name: 'update_post',
    title: 'Update a Post',
    description:
      'Update the text, category, or external URL of an existing Keylenta post that you authored (or manage as a company owner/admin).',
    inputSchema: {
      type: 'object',
      required: ['postId'],
      properties: {
        postId: { type: 'string', minLength: 1, description: 'ID of the post/announcement to update' },
        body: {
          type: 'string',
          minLength: 10,
          maxLength: 500,
          description: 'Updated factual announcement text (10–500 characters)',
        },
        categoryId: {
          type: 'string',
          minLength: 1,
          description: 'Updated announcement category ID or slug',
        },
        externalUrl: {
          type: ['string', 'null'],
          description: 'Updated external URL (or null / empty string to clear)',
        },
      },
      additionalProperties: false,
    },
    annotations: {
      title: 'Update Post',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: 'delete_post',
    title: 'Delete a Post',
    description:
      'Permanently delete a Keylenta post that you authored (or manage as a company owner/admin).',
    inputSchema: {
      type: 'object',
      required: ['postId'],
      properties: {
        postId: { type: 'string', minLength: 1, description: 'ID of the post/announcement to delete' },
      },
      additionalProperties: false,
    },
    annotations: {
      title: 'Delete Post',
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
];

function applyCorsHeaders(headers: Headers) {
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, Mcp-Session-Id, Mcp-Protocol-Version, Accept'
  );
  headers.set('Access-Control-Expose-Headers', 'Mcp-Session-Id');
}

function jsonRpcError(
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown
) {
  return {
    jsonrpc: '2.0' as const,
    id,
    error: {
      code,
      message,
      ...(data !== undefined ? { data } : {}),
    },
  };
}

function toolResult(data: unknown, isError = false) {
  return {
    content: [
      {
        type: 'text' as const,
        text: typeof data === 'string' ? data : JSON.stringify(data, null, 2),
      },
    ],
    ...(isError ? { isError: true } : {}),
  };
}

async function authenticateBearerToken(
  db: AppContext['Variables']['db'],
  authHeader: string | undefined
): Promise<SessionUserContext | null> {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  const rawToken = match[1].trim();
  if (!rawToken) return null;

  const tokenHash = await sha256Hex(rawToken);
  const now = Date.now();

  const rows = await db
    .select({
      tokenId: schema.apiTokens.id,
      expiresAt: schema.apiTokens.expiresAt,
      userId: usersIdCol(),
      slug: schema.users.slug,
      email: schema.users.email,
      name: schema.users.name,
      systemRole: schema.users.systemRole,
      status: schema.users.status,
    })
    .from(schema.apiTokens)
    .innerJoin(schema.users, eq(schema.apiTokens.userId, schema.users.id))
    .where(eq(schema.apiTokens.tokenHash, tokenHash))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  if (row.expiresAt !== null && row.expiresAt <= now) return null;
  if (row.status !== 'active') return null;

  await db
    .update(schema.apiTokens)
    .set({ lastUsedAt: now })
    .where(eq(schema.apiTokens.id, row.tokenId));

  return {
    id: row.userId,
    slug: row.slug,
    email: row.email,
    name: row.name,
    systemRole: row.systemRole as 'user' | 'admin',
    status: row.status as 'active' | 'suspended' | 'deleted',
    sessionId: row.tokenId,
    csrfToken: '',
  };
}

function usersIdCol() {
  return schema.users.id;
}

async function executeMcpTool(
  db: AppContext['Variables']['db'],
  user: SessionUserContext,
  name: string,
  args: Record<string, unknown>
) {
  switch (name) {
    case 'get_my_profile': {
      const profile = await buildAuthenticatedUserPayload(db, user.id, '');
      if (!profile) {
        return toolResult('Profile not found.', true);
      }
      const { csrfToken: _omit, ...safeProfile } = profile;
      return toolResult(safeProfile);
    }

    case 'update_my_profile': {
      const userRows = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, user.id))
        .limit(1);
      const current = userRows[0];
      if (!current) {
        return toolResult('User not found.', true);
      }

      let currentSocialLinks: Record<string, string | undefined> = {};
      try {
        currentSocialLinks = JSON.parse(current.socialLinksJson || '{}');
      } catch {
        currentSocialLinks = {};
      }

      const incomingSocialLinks =
        args.socialLinks && typeof args.socialLinks === 'object'
          ? { ...currentSocialLinks, ...(args.socialLinks as Record<string, unknown>) }
          : currentSocialLinks;

      const mergedPayload = {
        name: args.name !== undefined ? args.name : current.name,
        headline: args.headline !== undefined ? args.headline : current.headline,
        biography: args.biography !== undefined ? args.biography : current.biography,
        location: args.location !== undefined ? args.location : current.location,
        companyName: args.companyName !== undefined ? args.companyName : current.companyName,
        position: args.position !== undefined ? args.position : current.position,
        website: args.website !== undefined ? args.website : current.website,
        industry: args.industry !== undefined ? args.industry : current.industry,
        socialLinks: incomingSocialLinks,
        expertise:
          args.expertise !== undefined
            ? args.expertise
            : parseJsonArray<string>(current.expertiseJson),
        highlights:
          args.highlights !== undefined
            ? args.highlights
            : parseJsonArray<string>(current.highlightsJson),
        experience:
          args.experience !== undefined
            ? args.experience
            : parseJsonArray(current.experienceJson),
        credentials:
          args.credentials !== undefined
            ? args.credentials
            : parseJsonArray(current.credentialsJson),
        isPublic: args.isPublic !== undefined ? args.isPublic : current.isPublic === 1,
        allowLevel1Messages:
          args.allowLevel1Messages !== undefined
            ? args.allowLevel1Messages
            : current.allowLevel1Messages === 1,
      };

      const parsed = updateProfileSchema.safeParse(mergedPayload);
      if (!parsed.success) {
        return toolResult(
          parsed.error.issues[0]?.message || 'Invalid profile data',
          true
        );
      }

      const d = parsed.data;
      const now = Date.now();
      const roleOrCompanyChanged =
        (d.position && d.position !== current.position) ||
        (d.companyName && d.companyName !== current.companyName);

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
        .where(eq(schema.users.id, user.id));

      if (roleOrCompanyChanged && (d.position || d.companyName)) {
        const followersRows = await db
          .select({ followerUserId: schema.follows.followerUserId })
          .from(schema.follows)
          .where(
            and(
              eq(schema.follows.targetType, 'user'),
              eq(schema.follows.targetUserId, user.id)
            )
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
            referenceId: user.slug,
            createdAt: now,
          });
        }
      }

      const updated = await buildAuthenticatedUserPayload(db, user.id, '');
      if (!updated) {
        return toolResult('Profile updated.', false);
      }
      const { csrfToken: _omit, ...safeUpdated } = updated;
      return toolResult({ message: 'Profile updated successfully.', profile: safeUpdated });
    }

    case 'list_announcement_categories': {
      const categories = await db
        .select({
          id: schema.announcementCategories.id,
          slug: schema.announcementCategories.slug,
          name: schema.announcementCategories.name,
        })
        .from(schema.announcementCategories)
        .where(eq(schema.announcementCategories.isActive, 1))
        .orderBy(asc(schema.announcementCategories.sortOrder));

      return toolResult({ categories });
    }

    case 'list_my_posts': {
      const rawLimit = typeof args.limit === 'number' ? args.limit : 20;
      const limit = Math.min(Math.max(Math.floor(rawLimit), 1), 50);

      const memberCompanies = await db
        .select({ companyId: schema.companyMembers.companyId })
        .from(schema.companyMembers)
        .where(eq(schema.companyMembers.userId, user.id));
      const companyIds = memberCompanies.map((m) => m.companyId);

      const ownershipCondition =
        companyIds.length > 0
          ? or(
              eq(schema.announcements.authorUserId, user.id),
              inArray(schema.announcements.companyId, companyIds)
            )
          : eq(schema.announcements.authorUserId, user.id);

      const posts = await db
        .select({
          id: schema.announcements.id,
          body: schema.announcements.body,
          externalUrl: schema.announcements.externalUrl,
          categoryId: schema.announcements.categoryId,
          categorySlug: schema.announcementCategories.slug,
          categoryName: schema.announcementCategories.name,
          companyId: schema.announcements.companyId,
          companyName: schema.companies.name,
          moderationStatus: schema.announcements.moderationStatus,
          createdAt: schema.announcements.createdAt,
        })
        .from(schema.announcements)
        .innerJoin(
          schema.announcementCategories,
          eq(schema.announcements.categoryId, schema.announcementCategories.id)
        )
        .leftJoin(schema.companies, eq(schema.announcements.companyId, schema.companies.id))
        .where(ownershipCondition)
        .orderBy(desc(schema.announcements.createdAt))
        .limit(limit);

      return toolResult({ posts });
    }

    case 'create_post': {
      const parsed = createAnnouncementSchema.safeParse({
        companyId: args.companyId ?? null,
        categoryId: args.categoryId,
        body: args.body,
        externalUrl: args.externalUrl ?? null,
      });

      if (!parsed.success) {
        return toolResult(
          parsed.error.issues[0]?.message || 'Invalid post submission',
          true
        );
      }

      const { companyId: rawCompanyId, categoryId, body: textBody, externalUrl } = parsed.data;
      const companyId = rawCompanyId?.trim() || null;

      if (companyId) {
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
          return toolResult(
            'You are not an authorized member of this company and cannot publish on its behalf.',
            true
          );
        }
      }

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
        return toolResult(
          'Selected announcement category is invalid. Call list_announcement_categories for valid options.',
          true
        );
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

      return toolResult({
        message: 'Post published successfully.',
        announcementId,
        post: {
          id: announcementId,
          companyId,
          categoryId: catRows[0].id,
          categorySlug: catRows[0].slug,
          categoryName: catRows[0].name,
          body: textBody.trim(),
          externalUrl: externalUrl ? externalUrl.trim() : null,
          createdAt: now,
        },
      });
    }

    case 'update_post': {
      const postId = typeof args.postId === 'string' ? args.postId.trim() : '';
      if (!postId) {
        return toolResult('postId is required.', true);
      }

      const rows = await db
        .select()
        .from(schema.announcements)
        .where(eq(schema.announcements.id, postId))
        .limit(1);

      const ann = rows[0];
      if (!ann) {
        return toolResult('Post not found.', true);
      }

      let isCompanyEditor = false;
      if (ann.companyId) {
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

        isCompanyEditor =
          memberRows[0]?.role === 'owner' || memberRows[0]?.role === 'admin';
      }

      if (ann.authorUserId !== user.id && !isCompanyEditor && user.systemRole !== 'admin') {
        return toolResult('Not authorized to update this post.', true);
      }

      const parsed = updateAnnouncementSchema.safeParse({
        ...(args.categoryId !== undefined ? { categoryId: args.categoryId } : {}),
        ...(args.body !== undefined ? { body: args.body } : {}),
        ...(args.externalUrl !== undefined ? { externalUrl: args.externalUrl } : {}),
      });

      if (!parsed.success) {
        return toolResult(
          parsed.error.issues[0]?.message || 'Invalid post update',
          true
        );
      }

      const updates: Partial<typeof schema.announcements.$inferInsert> = {};

      if (parsed.data.categoryId !== undefined) {
        const catRows = await db
          .select()
          .from(schema.announcementCategories)
          .where(
            and(
              or(
                eq(schema.announcementCategories.id, parsed.data.categoryId),
                eq(schema.announcementCategories.slug, parsed.data.categoryId)
              ),
              eq(schema.announcementCategories.isActive, 1)
            )
          )
          .limit(1);

        if (!catRows[0]) {
          return toolResult('Selected announcement category is invalid.', true);
        }
        updates.categoryId = catRows[0].id;
      }

      if (parsed.data.body !== undefined) {
        updates.body = parsed.data.body.trim();
      }

      if (parsed.data.externalUrl !== undefined) {
        updates.externalUrl = parsed.data.externalUrl ? parsed.data.externalUrl.trim() : null;
      }

      await db
        .update(schema.announcements)
        .set(updates)
        .where(eq(schema.announcements.id, postId));

      const updatedRows = await db
        .select({
          id: schema.announcements.id,
          body: schema.announcements.body,
          externalUrl: schema.announcements.externalUrl,
          categoryId: schema.announcements.categoryId,
          categorySlug: schema.announcementCategories.slug,
          categoryName: schema.announcementCategories.name,
          companyId: schema.announcements.companyId,
          createdAt: schema.announcements.createdAt,
        })
        .from(schema.announcements)
        .innerJoin(
          schema.announcementCategories,
          eq(schema.announcements.categoryId, schema.announcementCategories.id)
        )
        .where(eq(schema.announcements.id, postId))
        .limit(1);

      return toolResult({
        message: 'Post updated successfully.',
        post: updatedRows[0],
      });
    }

    case 'delete_post': {
      const postId = typeof args.postId === 'string' ? args.postId.trim() : '';
      if (!postId) {
        return toolResult('postId is required.', true);
      }

      const rows = await db
        .select()
        .from(schema.announcements)
        .where(eq(schema.announcements.id, postId))
        .limit(1);

      const ann = rows[0];
      if (!ann) {
        return toolResult('Post not found.', true);
      }

      let isCompanyAdmin = false;
      if (ann.companyId) {
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

        isCompanyAdmin =
          memberRows[0]?.role === 'owner' || memberRows[0]?.role === 'admin';
      }

      if (ann.authorUserId !== user.id && !isCompanyAdmin && user.systemRole !== 'admin') {
        return toolResult('Not authorized to delete this post.', true);
      }

      await db.delete(schema.announcements).where(eq(schema.announcements.id, postId));
      return toolResult({ ok: true, deletedPostId: postId });
    }

    default:
      return null;
  }
}

export const mcpRoutes = new Hono<AppContext>();

mcpRoutes.options('/', (c) => {
  const res = new Response(null, { status: 204 });
  applyCorsHeaders(res.headers);
  return res;
});

mcpRoutes.get('/', async (c) => {
  const db = c.get('db');
  const user = await authenticateBearerToken(db, c.req.header('Authorization'));
  if (!user) {
    const res = c.json(
      jsonRpcError(
        null,
        -32001,
        'Unauthorized: Provide a valid Keylenta MCP Bearer token from Settings.'
      ),
      401
    );
    res.headers.set(
      'WWW-Authenticate',
      `Bearer realm="Keylenta MCP", resource_metadata="${new URL(c.req.url).origin}/.well-known/oauth-protected-resource"`
    );
    applyCorsHeaders(res.headers);
    return res;
  }

  const res = c.json(
    { error: 'Method Not Allowed. Send MCP JSON-RPC requests via HTTP POST.' },
    405
  );
  res.headers.set('Allow', 'POST, OPTIONS');
  applyCorsHeaders(res.headers);
  return res;
});

mcpRoutes.delete('/', (c) => {
  const res = c.json({ error: 'Method Not Allowed. This MCP endpoint is stateless.' }, 405);
  res.headers.set('Allow', 'POST, OPTIONS');
  applyCorsHeaders(res.headers);
  return res;
});

mcpRoutes.post('/', async (c) => {
  const db = c.get('db');
  const user = await authenticateBearerToken(db, c.req.header('Authorization'));
  if (!user) {
    const res = c.json(
      jsonRpcError(
        null,
        -32001,
        'Unauthorized: Provide a valid Keylenta MCP Bearer token from Settings.'
      ),
      401
    );
    res.headers.set(
      'WWW-Authenticate',
      `Bearer realm="Keylenta MCP", resource_metadata="${new URL(c.req.url).origin}/.well-known/oauth-protected-resource"`
    );
    applyCorsHeaders(res.headers);
    return res;
  }

  const payload = await c.req.json().catch(() => null);
  if (!payload || typeof payload !== 'object') {
    const res = c.json(jsonRpcError(null, -32700, 'Parse error: Invalid JSON payload'), 400);
    applyCorsHeaders(res.headers);
    return res;
  }

  const isBatch = Array.isArray(payload);
  const requests: JsonRpcRequest[] = isBatch ? payload : [payload];

  if (requests.length === 0) {
    const res = c.json(jsonRpcError(null, -32600, 'Invalid Request: Empty batch'), 400);
    applyCorsHeaders(res.headers);
    return res;
  }

  const responses: unknown[] = [];

  for (const req of requests) {
    if (!req || typeof req !== 'object' || req.jsonrpc !== '2.0' || typeof req.method !== 'string') {
      responses.push(jsonRpcError(req?.id ?? null, -32600, 'Invalid Request'));
      continue;
    }

    const isNotification =
      req.id === undefined || req.method.startsWith('notifications/');
    if (isNotification) {
      continue;
    }

    const id = req.id ?? null;
    const params = (req.params && typeof req.params === 'object' ? req.params : {}) as Record<
      string,
      unknown
    >;

    if (req.method === 'initialize') {
      const requestedVersion =
        typeof params.protocolVersion === 'string' ? params.protocolVersion : '';
      const protocolVersion = SUPPORTED_PROTOCOL_VERSIONS.includes(
        requestedVersion as (typeof SUPPORTED_PROTOCOL_VERSIONS)[number]
      )
        ? requestedVersion
        : DEFAULT_PROTOCOL_VERSION;

      responses.push({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion,
          capabilities: {
            tools: { listChanged: false },
          },
          serverInfo: {
            name: 'keylenta-mcp',
            version: '1.0.0',
          },
          instructions:
            'Keylenta MCP server for managing your professional profile and factual business announcements (posts). Use get_my_profile before partial updates if you want to inspect current values, and list_announcement_categories before creating or updating a post.',
        },
      });
      continue;
    }

    if (req.method === 'ping') {
      responses.push({ jsonrpc: '2.0', id, result: {} });
      continue;
    }

    if (req.method === 'tools/list') {
      responses.push({
        jsonrpc: '2.0',
        id,
        result: { tools: MCP_TOOLS },
      });
      continue;
    }

    if (req.method === 'tools/call') {
      const toolName = typeof params.name === 'string' ? params.name : '';
      const toolArgs =
        params.arguments && typeof params.arguments === 'object'
          ? (params.arguments as Record<string, unknown>)
          : {};

      const result = await executeMcpTool(db, user, toolName, toolArgs);
      if (result === null) {
        responses.push(jsonRpcError(id, -32602, `Unknown tool: ${toolName}`));
      } else {
        responses.push({ jsonrpc: '2.0', id, result });
      }
      continue;
    }

    responses.push(jsonRpcError(id, -32601, `Method not found: ${req.method}`));
  }

  // Only notifications were sent -> 202 Accepted with empty body per MCP Streamable HTTP spec
  if (responses.length === 0) {
    const res = new Response(null, { status: 202 });
    applyCorsHeaders(res.headers);
    return res;
  }

  const res = c.json(isBatch ? responses : responses[0], 200);
  applyCorsHeaders(res.headers);
  return res;
});
