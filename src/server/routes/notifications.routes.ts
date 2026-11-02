import { Hono } from 'hono';
import { and, desc, eq, isNull } from 'drizzle-orm';
import type { AppContext } from '../env';
import * as schema from '../db/schema';
import { requireAuth } from '../middleware/auth';

export const notificationsRoutes = new Hono<AppContext>();

notificationsRoutes.use('*', requireAuth);

notificationsRoutes.get('/', async (c) => {
  const db = c.get('db');
  const user = c.get('user')!;

  const rows = await db
    .select()
    .from(schema.notifications)
    .where(eq(schema.notifications.userId, user.id))
    .orderBy(desc(schema.notifications.createdAt))
    .limit(50);

  return c.json({ notifications: rows });
});

notificationsRoutes.post('/:id/read', async (c) => {
  const db = c.get('db');
  const user = c.get('user')!;
  const id = c.req.param('id');

  await db
    .update(schema.notifications)
    .set({ readAt: Date.now() })
    .where(and(eq(schema.notifications.id, id), eq(schema.notifications.userId, user.id)));

  return c.json({ ok: true });
});

notificationsRoutes.post('/read-all', async (c) => {
  const db = c.get('db');
  const user = c.get('user')!;

  await db
    .update(schema.notifications)
    .set({ readAt: Date.now() })
    .where(
      and(eq(schema.notifications.userId, user.id), isNull(schema.notifications.readAt))
    );

  return c.json({ ok: true });
});

