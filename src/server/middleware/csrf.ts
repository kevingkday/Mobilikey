import type { Context, Next } from 'hono';
import type { AppContext } from '../env';
import { timingSafeEqualStr } from '../services/auth.service';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export async function csrfMiddleware(c: Context<AppContext>, next: Next) {
  if (!MUTATING_METHODS.has(c.req.method.toUpperCase())) {
    return next();
  }

  const user = c.get('user');
  // Unauthenticated endpoints (login, signup, forgot-password) do not have a session CSRF token yet
  if (!user) {
    return next();
  }

  const headerToken = c.req.header('X-CSRF-Token') || '';
  if (!headerToken || !timingSafeEqualStr(headerToken, user.csrfToken)) {
    return c.json({ error: 'Invalid or missing CSRF token' }, 403);
  }

  return next();
}

