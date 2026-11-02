import { Hono } from 'hono';
import { and, eq, isNull } from 'drizzle-orm';
import type { AppContext } from '../env';
import * as schema from '../db/schema';
import {
  startConversationSchema,
  replyMessageSchema,
  setAccessLevelSchema,
} from '../../shared/validation';
import { requireAuth } from '../middleware/auth';
import { AccessControlError, AccessService } from '../services/access.service';
import { MessageService, type InboxTarget } from '../services/message.service';
import type { EntityType, InboxFolder } from '../../shared/types';

export const messagesRoutes = new Hono<AppContext>();

messagesRoutes.use('*', requireAuth);

/**
 * Lightweight polling endpoint for near-real-time badge updates.
 */
messagesRoutes.get('/unread-summary', async (c) => {
  const db = c.get('db');
  const user = c.get('user')!;

  try {
    const personal = await MessageService.listInbox(
      db,
      user.id,
      { type: 'user', id: user.id },
      'direct'
    );

    const unreadNotifs = await db
      .select({ id: schema.notifications.id })
      .from(schema.notifications)
      .where(
        and(eq(schema.notifications.userId, user.id), isNull(schema.notifications.readAt))
      );

    return c.json({
      personalUnread: {
        direct: personal.unreadCounts.direct,
        recognized: personal.unreadCounts.recognized,
        general: personal.unreadCounts.general,
        totalPriority: personal.unreadCounts.direct + personal.unreadCounts.recognized,
        totalAll:
          personal.unreadCounts.direct +
          personal.unreadCounts.recognized +
          personal.unreadCounts.general,
      },
      unreadNotificationsCount: unreadNotifs.length,
    });
  } catch (err) {
    return c.json({
      personalUnread: { direct: 0, recognized: 0, general: 0, totalPriority: 0, totalAll: 0 },
      unreadNotificationsCount: 0,
    });
  }
});

/**
 * Lists conversations in the requested inbox (personal or company) and folder.
 */
messagesRoutes.get('/inbox', async (c) => {
  const db = c.get('db');
  const user = c.get('user')!;

  const inboxType = (c.req.query('inboxType') || 'user') as EntityType;
  const inboxId = c.req.query('inboxId') || user.id;
  const folder = (c.req.query('folder') || 'direct') as InboxFolder;

  const validFolders: InboxFolder[] = ['general', 'recognized', 'direct', 'sent', 'archived'];
  const normalizedFolder = validFolders.includes(folder) ? folder : 'direct';

  try {
    const result = await MessageService.listInbox(
      db,
      user.id,
      { type: inboxType === 'company' ? 'company' : 'user', id: inboxId },
      normalizedFolder
    );
    return c.json(result);
  } catch (err) {
    if (err instanceof AccessControlError) {
      return c.json({ error: err.message }, err.statusCode as 403);
    }
    throw err;
  }
});

/**
 * Starts a new conversation or sends a message to a user or company.
 */
messagesRoutes.post('/conversations', async (c) => {
  const db = c.get('db');
  const user = c.get('user')!;

  const body = await c.req.json().catch(() => null);
  const parsed = startConversationSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message || 'Invalid message request' }, 400);
  }

  try {
    const result = await MessageService.startConversation(db, {
      senderUserId: user.id,
      recipientType: parsed.data.recipientType,
      recipientId: parsed.data.recipientId,
      subject: parsed.data.subject,
      body: parsed.data.body,
    });
    return c.json(result, 201);
  } catch (err) {
    if (err instanceof AccessControlError) {
      return c.json({ error: err.message }, err.statusCode as 403);
    }
    throw err;
  }
});

/**
 * Gets a single conversation thread and its messages.
 */
messagesRoutes.get('/conversations/:id', async (c) => {
  const db = c.get('db');
  const user = c.get('user')!;
  const conversationId = c.req.param('id');
  const inboxType = c.req.query('inboxType') as EntityType | undefined;
  const inboxId = c.req.query('inboxId');

  const inboxTarget: InboxTarget | undefined =
    inboxType && inboxId ? { type: inboxType, id: inboxId } : undefined;

  try {
    const thread = await MessageService.getConversationThread(
      db,
      user.id,
      conversationId,
      inboxTarget
    );
    return c.json(thread);
  } catch (err) {
    if (err instanceof AccessControlError) {
      return c.json({ error: err.message }, err.statusCode as 403);
    }
    throw err;
  }
});

/**
 * Replies to an existing conversation. Never auto-promotes the sender.
 */
messagesRoutes.post('/conversations/:id/reply', async (c) => {
  const db = c.get('db');
  const user = c.get('user')!;
  const conversationId = c.req.param('id');

  const body = await c.req.json().catch(() => null);
  const parsed = replyMessageSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message || 'Invalid reply' }, 400);
  }

  try {
    const result = await MessageService.replyToConversation(db, {
      actorUserId: user.id,
      conversationId,
      body: parsed.data.body,
      sendAsCompanyId: parsed.data.sendAsCompanyId,
    });
    return c.json(result, 201);
  } catch (err) {
    if (err instanceof AccessControlError) {
      return c.json({ error: err.message }, err.statusCode as 403);
    }
    throw err;
  }
});

/**
 * Archives or unarchives a conversation.
 */
messagesRoutes.post('/conversations/:id/archive', async (c) => {
  const db = c.get('db');
  const user = c.get('user')!;
  const conversationId = c.req.param('id');

  const body = await c.req.json().catch(() => ({}));
  const archived = Boolean(body?.archived);
  const inboxType = body?.inboxType as EntityType | undefined;
  const inboxId = body?.inboxId as string | undefined;

  try {
    await MessageService.setConversationArchived(
      db,
      user.id,
      conversationId,
      archived,
      inboxType && inboxId ? { type: inboxType, id: inboxId } : undefined
    );
    return c.json({ ok: true, archived });
  } catch (err) {
    if (err instanceof AccessControlError) {
      return c.json({ error: err.message }, err.statusCode as 403);
    }
    throw err;
  }
});

/**
 * Lists explicit access permissions configured for a recipient inbox (personal or company).
 */
messagesRoutes.get('/access', async (c) => {
  const db = c.get('db');
  const user = c.get('user')!;
  const recipientType = (c.req.query('recipientType') || 'user') as EntityType;
  const recipientId = c.req.query('recipientId') || user.id;

  try {
    const permissions = await AccessService.listPermissionsForRecipient(
      db,
      user.id,
      recipientType === 'company' ? 'company' : 'user',
      recipientId
    );
    return c.json({ permissions });
  } catch (err) {
    if (err instanceof AccessControlError) {
      return c.json({ error: err.message }, err.statusCode as 403);
    }
    throw err;
  }
});

/**
 * Promotes, downgrades, or blocks a sender for a specific recipient inbox.
 * Takes effect immediately.
 */
messagesRoutes.post('/access', async (c) => {
  const db = c.get('db');
  const user = c.get('user')!;

  const body = await c.req.json().catch(() => null);
  const parsed = setAccessLevelSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message || 'Invalid access level request' }, 400);
  }

  try {
    const result = await AccessService.setAccessLevel(db, {
      actorUserId: user.id,
      senderUserId: parsed.data.senderUserId,
      recipientType: parsed.data.recipientType,
      recipientId: parsed.data.recipientId,
      accessLevel: parsed.data.accessLevel,
    });
    return c.json(result);
  } catch (err) {
    if (err instanceof AccessControlError) {
      return c.json({ error: err.message }, err.statusCode as 403);
    }
    throw err;
  }
});

