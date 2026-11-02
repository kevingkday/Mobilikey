import type { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { eq, and, gt } from 'drizzle-orm';
import type { AppContext } from '../env';
import { sessions, users } from '../db/schema';
import { sha256Hex } from '../services/auth.service';

export const SESSION_COOKIE_NAME = 'mobilikey_session';

export async function sessionMiddleware(c: Context<AppContext>, next: Next) {
  c.set('user', null);
  const rawToken = getCookie(c, SESSION_COOKIE_NAME);
  if (!rawToken) {
    return next();
  }

  try {
    const tokenHash = await sha256Hex(rawToken);
    const now = Date.now();
    const db = c.get('db');

    const rows = await db
      .select({
        sessionId: sessions.id,
        csrfToken: sessions.csrfToken,
        expiresAt: sessions.expiresAt,
        userId: users.id,
        slug: users.slug,
        email: users.email,
        name: users.name,
        systemRole: users.systemRole,
        status: users.status,
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(and(eq(sessions.sessionTokenHash, tokenHash), gt(sessions.expiresAt, now)))
      .limit(1);

    const row = rows[0];
    if (row && row.status === 'active') {
      c.set('user', {
        id: row.userId,
        slug: row.slug,
        email: row.email,
        name: row.name,
        systemRole: row.systemRole as 'user' | 'admin',
        status: row.status as 'active' | 'suspended' | 'deleted',
        sessionId: row.sessionId,
        csrfToken: row.csrfToken,
      });
    }
  } catch {
    // Proceed unauthenticated if database not yet migrated or token invalid
  }

  return next();
}

export async function requireAuth(c: Context<AppContext>, next: Next) {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }
  if (user.status !== 'active') {
    return c.json({ error: 'Account is suspended or inactive' }, 403);
  }
  return next();
}

export async function requireAdmin(c: Context<AppContext>, next: Next) {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }
  if (user.systemRole !== 'admin') {
    return c.json({ error: 'Administrator privileges required' }, 403);
  }
  return next();
}

