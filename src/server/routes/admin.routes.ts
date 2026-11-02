import { Hono } from 'hono';
import { asc, desc, eq } from 'drizzle-orm';
import type { AppContext } from '../env';
import * as schema from '../db/schema';
import { requireAdmin } from '../middleware/auth';
import { generateId, slugify } from '../services/auth.service';

export const adminRoutes = new Hono<AppContext>();

adminRoutes.use('*', requireAdmin);

adminRoutes.get('/overview', async (c) => {
  const db = c.get('db');

  const allUsers = await db
    .select({
      id: schema.users.id,
      status: schema.users.status,
      createdAt: schema.users.createdAt,
    })
    .from(schema.users);

  const allCompanies = await db
    .select({
      id: schema.companies.id,
      status: schema.companies.status,
      createdAt: schema.companies.createdAt,
    })
    .from(schema.companies);

  const allAnnouncements = await db
    .select({
      id: schema.announcements.id,
      moderationStatus: schema.announcements.moderationStatus,
    })
    .from(schema.announcements);

  // Aggregate messaging activity statistics ONLY — never expose private message bodies
  const allConversations = await db
    .select({
      id: schema.conversations.id,
      recipientType: schema.conversations.recipientType,
      createdAt: schema.conversations.createdAt,
    })
    .from(schema.conversations);

  const allMessagesCount = await db
    .select({
      id: schema.messages.id,
      createdAt: schema.messages.createdAt,
    })
    .from(schema.messages);

  const allPermissions = await db
    .select({
      accessLevel: schema.accessPermissions.accessLevel,
    })
    .from(schema.accessPermissions);

  const allReports = await db
    .select({
      id: schema.reports.id,
      targetType: schema.reports.targetType,
      status: schema.reports.status,
    })
    .from(schema.reports);

  const recentAuditLogs = await db
    .select({
      id: schema.auditLogs.id,
      actorUserId: schema.auditLogs.actorUserId,
      actorName: schema.users.name,
      action: schema.auditLogs.action,
      targetType: schema.auditLogs.targetType,
      targetId: schema.auditLogs.targetId,
      metadataJson: schema.auditLogs.metadataJson,
      createdAt: schema.auditLogs.createdAt,
    })
    .from(schema.auditLogs)
    .innerJoin(schema.users, eq(schema.auditLogs.actorUserId, schema.users.id))
    .orderBy(desc(schema.auditLogs.createdAt))
    .limit(40);

  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

  return c.json({
    stats: {
      totalUsers: allUsers.length,
      activeUsers: allUsers.filter((u) => u.status === 'active').length,
      suspendedUsers: allUsers.filter((u) => u.status === 'suspended').length,
      registrationsLast7Days: allUsers.filter((u) => u.createdAt >= sevenDaysAgo).length,
      totalCompanies: allCompanies.length,
      activeCompanies: allCompanies.filter((comp) => comp.status === 'active').length,
      totalAnnouncements: allAnnouncements.length,
      publishedAnnouncements: allAnnouncements.filter((a) => a.moderationStatus === 'published')
        .length,
      messagingActivity: {
        totalConversations: allConversations.length,
        userToUserThreads: allConversations.filter((cv) => cv.recipientType === 'user').length,
        userToCompanyThreads: allConversations.filter((cv) => cv.recipientType === 'company')
          .length,
        totalMessagesSent: allMessagesCount.length,
        messagesLast7Days: allMessagesCount.filter((m) => m.createdAt >= sevenDaysAgo).length,
        recognizedGrantsCount: allPermissions.filter((p) => p.accessLevel === 2).length,
        directGrantsCount: allPermissions.filter((p) => p.accessLevel === 3).length,
        blockedContactsCount: allPermissions.filter((p) => p.accessLevel === 0).length,
      },
      openReportsCount: allReports.filter((r) => r.status === 'open').length,
    },
    recentAuditLogs,
  });
});

adminRoutes.get('/users', async (c) => {
  const db = c.get('db');
  const rows = await db
    .select({
      id: schema.users.id,
      slug: schema.users.slug,
      email: schema.users.email,
      name: schema.users.name,
      headline: schema.users.headline,
      companyName: schema.users.companyName,
      location: schema.users.location,
      industry: schema.users.industry,
      systemRole: schema.users.systemRole,
      status: schema.users.status,
      createdAt: schema.users.createdAt,
    })
    .from(schema.users)
    .orderBy(desc(schema.users.createdAt))
    .limit(100);

  return c.json({ users: rows });
});

adminRoutes.patch('/users/:id/status', async (c) => {
  const db = c.get('db');
  const admin = c.get('user')!;
  const targetUserId = c.req.param('id');

  if (targetUserId === admin.id) {
    return c.json({ error: 'Administrators cannot suspend their own account.' }, 400);
  }

  const body = await c.req.json().catch(() => null);
  const status = body?.status;
  if (status !== 'active' && status !== 'suspended') {
    return c.json({ error: 'Status must be active or suspended.' }, 400);
  }

  const now = Date.now();
  await db
    .update(schema.users)
    .set({ status, updatedAt: now })
    .where(eq(schema.users.id, targetUserId));

  if (status === 'suspended') {
    await db.delete(schema.sessions).where(eq(schema.sessions.userId, targetUserId));
  }

  await db.insert(schema.auditLogs).values({
    id: generateId('aud'),
    actorUserId: admin.id,
    action: `admin_user_status_${status}`,
    targetType: 'user',
    targetId: targetUserId,
    metadataJson: JSON.stringify({ status }),
    createdAt: now,
  });

  return c.json({ ok: true, status });
});

adminRoutes.get('/companies', async (c) => {
  const db = c.get('db');
  const rows = await db
    .select()
    .from(schema.companies)
    .orderBy(desc(schema.companies.createdAt))
    .limit(100);

  return c.json({ companies: rows });
});

adminRoutes.patch('/companies/:id/status', async (c) => {
  const db = c.get('db');
  const admin = c.get('user')!;
  const companyId = c.req.param('id');

  const body = await c.req.json().catch(() => null);
  const status = body?.status;
  if (status !== 'active' && status !== 'suspended') {
    return c.json({ error: 'Status must be active or suspended.' }, 400);
  }

  const now = Date.now();
  await db
    .update(schema.companies)
    .set({ status, updatedAt: now })
    .where(eq(schema.companies.id, companyId));

  await db.insert(schema.auditLogs).values({
    id: generateId('aud'),
    actorUserId: admin.id,
    action: `admin_company_status_${status}`,
    targetType: 'company',
    targetId: companyId,
    metadataJson: JSON.stringify({ status }),
    createdAt: now,
  });

  return c.json({ ok: true, status });
});

adminRoutes.get('/reports', async (c) => {
  const db = c.get('db');
  const rows = await db
    .select({
      id: schema.reports.id,
      reporterUserId: schema.reports.reporterUserId,
      reporterName: schema.users.name,
      targetType: schema.reports.targetType,
      targetId: schema.reports.targetId,
      reason: schema.reports.reason,
      details: schema.reports.details,
      status: schema.reports.status,
      reviewedByUserId: schema.reports.reviewedByUserId,
      reviewedAt: schema.reports.reviewedAt,
      createdAt: schema.reports.createdAt,
    })
    .from(schema.reports)
    .innerJoin(schema.users, eq(schema.reports.reporterUserId, schema.users.id))
    .orderBy(desc(schema.reports.createdAt))
    .limit(100);

  // Enrich announcement reports with the announcement text; never expose un-reported private messages
  const enriched = await Promise.all(
    rows.map(async (r) => {
      let targetSummary = '';
      if (r.targetType === 'announcement') {
        const ann = await db
          .select({ body: schema.announcements.body, moderationStatus: schema.announcements.moderationStatus })
          .from(schema.announcements)
          .where(eq(schema.announcements.id, r.targetId))
          .limit(1);
        if (ann[0]) {
          targetSummary = `[${ann[0].moderationStatus.toUpperCase()}] ${ann[0].body}`;
        }
      } else if (r.targetType === 'user') {
        const u = await db
          .select({ name: schema.users.name, slug: schema.users.slug })
          .from(schema.users)
          .where(eq(schema.users.id, r.targetId))
          .limit(1);
        if (u[0]) {
          targetSummary = `User: ${u[0].name} (@${u[0].slug})`;
        }
      } else if (r.targetType === 'company') {
        const comp = await db
          .select({ name: schema.companies.name, slug: schema.companies.slug })
          .from(schema.companies)
          .where(eq(schema.companies.id, r.targetId))
          .limit(1);
        if (comp[0]) {
          targetSummary = `Company: ${comp[0].name} (@${comp[0].slug})`;
        }
      } else if (r.targetType === 'message') {
        targetSummary = `Reported Message ID: ${r.targetId} (Abuse report context only)`;
      }
      return {
        ...r,
        targetSummary,
      };
    })
  );

  return c.json({ reports: enriched });
});

adminRoutes.patch('/reports/:id', async (c) => {
  const db = c.get('db');
  const admin = c.get('user')!;
  const reportId = c.req.param('id');

  const body = await c.req.json().catch(() => null);
  const status = body?.status as 'reviewed' | 'dismissed' | 'actioned';
  const removeContent = Boolean(body?.removeContent);

  if (!['reviewed', 'dismissed', 'actioned'].includes(status)) {
    return c.json({ error: 'Invalid report status' }, 400);
  }

  const repRows = await db
    .select()
    .from(schema.reports)
    .where(eq(schema.reports.id, reportId))
    .limit(1);

  if (!repRows[0]) {
    return c.json({ error: 'Report not found.' }, 404);
  }

  const now = Date.now();
  await db
    .update(schema.reports)
    .set({
      status,
      reviewedByUserId: admin.id,
      reviewedAt: now,
    })
    .where(eq(schema.reports.id, reportId));

  if (removeContent && repRows[0].targetType === 'announcement') {
    await db
      .update(schema.announcements)
      .set({ moderationStatus: 'removed' })
      .where(eq(schema.announcements.id, repRows[0].targetId));
  }

  await db.insert(schema.auditLogs).values({
    id: generateId('aud'),
    actorUserId: admin.id,
    action: `admin_report_${status}`,
    targetType: repRows[0].targetType,
    targetId: repRows[0].targetId,
    metadataJson: JSON.stringify({ reportId, status, removeContent }),
    createdAt: now,
  });

  return c.json({ ok: true });
});

adminRoutes.get('/categories', async (c) => {
  const db = c.get('db');
  const categories = await db
    .select()
    .from(schema.announcementCategories)
    .orderBy(asc(schema.announcementCategories.sortOrder));

  return c.json({ categories });
});

adminRoutes.post('/categories', async (c) => {
  const db = c.get('db');
  const admin = c.get('user')!;
  const body = await c.req.json().catch(() => null);
  const name = (body?.name || '').trim();
  const sortOrder = Number(body?.sortOrder || 10);

  if (name.length < 2 || name.length > 60) {
    return c.json({ error: 'Category name must be between 2 and 60 characters.' }, 400);
  }

  const id = `cat_${slugify(name).replace(/-/g, '_')}`;
  const slug = slugify(name);

  await db.insert(schema.announcementCategories).values({
    id,
    slug,
    name,
    sortOrder,
    isActive: 1,
  });

  await db.insert(schema.auditLogs).values({
    id: generateId('aud'),
    actorUserId: admin.id,
    action: 'admin_category_created',
    targetType: 'category',
    targetId: id,
    metadataJson: JSON.stringify({ name, slug }),
    createdAt: Date.now(),
  });

  return c.json({ id, slug, name }, 201);
});

adminRoutes.patch('/categories/:id', async (c) => {
  const db = c.get('db');
  const admin = c.get('user')!;
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => null);

  const isActive = body?.isActive !== undefined ? (body.isActive ? 1 : 0) : undefined;
  const name = body?.name ? String(body.name).trim() : undefined;

  await db
    .update(schema.announcementCategories)
    .set({
      ...(isActive !== undefined ? { isActive } : {}),
      ...(name ? { name } : {}),
    })
    .where(eq(schema.announcementCategories.id, id));

  await db.insert(schema.auditLogs).values({
    id: generateId('aud'),
    actorUserId: admin.id,
    action: 'admin_category_updated',
    targetType: 'category',
    targetId: id,
    metadataJson: JSON.stringify({ isActive, name }),
    createdAt: Date.now(),
  });

  return c.json({ ok: true });
});

