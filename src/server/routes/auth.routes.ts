import { Hono } from 'hono';
import { setCookie, deleteCookie } from 'hono/cookie';
import { eq, and, gt } from 'drizzle-orm';
import type { AppContext } from '../env';
import * as schema from '../db/schema';
import {
  signUpSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../../shared/validation';
import {
  generateId,
  generateRandomToken,
  hashPassword,
  verifyPassword,
  sha256Hex,
  slugify,
} from '../services/auth.service';
import { SESSION_COOKIE_NAME, requireAuth } from '../middleware/auth';
import { checkRateLimit } from '../middleware/rateLimit';
import { RATE_LIMITS } from '../../shared/constants';
import { sendTransactionalEmail } from '../services/email.service';
import type { AuthenticatedUser, ManagedCompanySummary } from '../../shared/types';

export const authRoutes = new Hono<AppContext>();

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export async function buildAuthenticatedUserPayload(
  db: AppContext['Variables']['db'],
  userId: string,
  csrfToken: string
): Promise<AuthenticatedUser | null> {
  const rows = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  const u = rows[0];
  if (!u) return null;

  const memberships = await db
    .select({
      companyId: schema.companies.id,
      slug: schema.companies.slug,
      name: schema.companies.name,
      logoUrl: schema.companies.logoUrl,
      industry: schema.companies.industry,
      role: schema.companyMembers.role,
    })
    .from(schema.companyMembers)
    .innerJoin(schema.companies, eq(schema.companyMembers.companyId, schema.companies.id))
    .where(eq(schema.companyMembers.userId, userId));

  const managedCompanies: ManagedCompanySummary[] = memberships.map((m) => ({
    id: m.companyId,
    slug: m.slug,
    name: m.name,
    logoUrl: m.logoUrl,
    industry: m.industry,
    role: m.role as ManagedCompanySummary['role'],
  }));

  let socialLinks = {};
  try {
    socialLinks = JSON.parse(u.socialLinksJson || '{}');
  } catch {
    socialLinks = {};
  }

  let emailNotifPrefs = {
    directMessages: true,
    recognizedMessages: true,
    accessPromotions: true,
    generalRequests: false,
  };
  try {
    emailNotifPrefs = { ...emailNotifPrefs, ...JSON.parse(u.emailNotifPrefsJson || '{}') };
  } catch {
    // keep default
  }

  return {
    id: u.id,
    slug: u.slug,
    email: u.email,
    emailVerifiedAt: u.emailVerifiedAt,
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
    emailNotifPrefs,
    systemRole: u.systemRole as 'user' | 'admin',
    status: u.status as 'active' | 'suspended' | 'deleted',
    createdAt: u.createdAt,
    csrfToken,
    managedCompanies,
  };
}

authRoutes.post('/signup', async (c) => {
  const db = c.get('db');
  const ip = c.req.header('CF-Connecting-IP') || '127.0.0.1';

  const rate = await checkRateLimit(
    db,
    `auth_signup:${ip}`,
    RATE_LIMITS.AUTH_MAX_ATTEMPTS,
    RATE_LIMITS.AUTH_WINDOW_MS
  );
  if (!rate.allowed) {
    return c.json({ error: 'Too many registration attempts. Please try again later.' }, 429);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = signUpSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message || 'Invalid input' }, 400);
  }

  const {
    name,
    email,
    password,
    headline,
    biography,
    companyName,
    position,
    location,
    industry,
    website,
    socialLinks,
  } = parsed.data;
  const normalizedEmail = email.toLowerCase().trim();

  const existing = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, normalizedEmail))
    .limit(1);

  if (existing[0]) {
    return c.json({ error: 'An account with this email address already exists.' }, 409);
  }

  const now = Date.now();
  const userId = generateId('usr');
  const slug = slugify(name);
  const passwordHash = await hashPassword(password);

  await db.insert(schema.users).values({
    id: userId,
    slug,
    email: normalizedEmail,
    passwordHash,
    emailVerifiedAt: null,
    name,
    headline: headline || [position, companyName].filter(Boolean).join(' at '),
    biography: biography || '',
    location,
    companyName,
    position,
    website: website || '',
    industry,
    socialLinksJson: JSON.stringify(socialLinks || {}),
    avatarUrl: null,
    isPublic: 1,
    allowLevel1Messages: 1,
    systemRole: 'user',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  });

  // Create email verification token
  const rawVerifyToken = generateRandomToken(24);
  const verifyTokenHash = await sha256Hex(rawVerifyToken);
  await db.insert(schema.emailVerificationTokens).values({
    id: generateId('evt'),
    userId,
    tokenHash: verifyTokenHash,
    expiresAt: now + 24 * 60 * 60 * 1000,
    createdAt: now,
  });

  await sendTransactionalEmail(c.env, {
    to: normalizedEmail,
    subject: 'Welcome to Mobilikey — Verify your email address',
    text: `Hello ${name},\n\nWelcome to Mobilikey. Verify your email using code: ${rawVerifyToken}\n\nEarn access. Build connections.`,
  });

  // Create session
  const rawSessionToken = generateRandomToken(32);
  const sessionTokenHash = await sha256Hex(rawSessionToken);
  const csrfToken = generateRandomToken(24);

  await db.insert(schema.sessions).values({
    id: generateId('ses'),
    userId,
    sessionTokenHash,
    csrfToken,
    ipAddress: ip,
    userAgent: c.req.header('User-Agent') || '',
    expiresAt: now + SESSION_TTL_MS,
    createdAt: now,
  });

  const isProd = c.env.ENVIRONMENT === 'production';
  setCookie(c, SESSION_COOKIE_NAME, rawSessionToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'Lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
  });

  const userPayload = await buildAuthenticatedUserPayload(db, userId, csrfToken);
  return c.json({ user: userPayload }, 201);
});

authRoutes.post('/login', async (c) => {
  const db = c.get('db');
  const ip = c.req.header('CF-Connecting-IP') || '127.0.0.1';

  const rate = await checkRateLimit(
    db,
    `auth_login:${ip}`,
    RATE_LIMITS.AUTH_MAX_ATTEMPTS,
    RATE_LIMITS.AUTH_WINDOW_MS
  );
  if (!rate.allowed) {
    return c.json({ error: 'Too many login attempts. Please wait 15 minutes.' }, 429);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Valid email and password are required.' }, 400);
  }

  const normalizedEmail = parsed.data.email.toLowerCase().trim();
  const rows = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, normalizedEmail))
    .limit(1);

  const user = rows[0];
  if (!user) {
    return c.json({ error: 'Invalid email or password.' }, 401);
  }

  if (user.status !== 'active') {
    return c.json({ error: 'This account has been suspended or deactivated.' }, 403);
  }

  const valid = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!valid) {
    return c.json({ error: 'Invalid email or password.' }, 401);
  }

  const now = Date.now();
  const rawSessionToken = generateRandomToken(32);
  const sessionTokenHash = await sha256Hex(rawSessionToken);
  const csrfToken = generateRandomToken(24);

  await db.insert(schema.sessions).values({
    id: generateId('ses'),
    userId: user.id,
    sessionTokenHash,
    csrfToken,
    ipAddress: ip,
    userAgent: c.req.header('User-Agent') || '',
    expiresAt: now + SESSION_TTL_MS,
    createdAt: now,
  });

  const isProd = c.env.ENVIRONMENT === 'production';
  setCookie(c, SESSION_COOKIE_NAME, rawSessionToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'Lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
  });

  const userPayload = await buildAuthenticatedUserPayload(db, user.id, csrfToken);
  return c.json({ user: userPayload });
});

authRoutes.post('/logout', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  if (user?.sessionId) {
    await db.delete(schema.sessions).where(eq(schema.sessions.id, user.sessionId));
  }
  deleteCookie(c, SESSION_COOKIE_NAME, { path: '/' });
  return c.json({ ok: true });
});

authRoutes.get('/me', async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ user: null });
  }
  const db = c.get('db');
  const payload = await buildAuthenticatedUserPayload(db, user.id, user.csrfToken);
  return c.json({ user: payload });
});

authRoutes.post('/forgot-password', async (c) => {
  const db = c.get('db');
  const body = await c.req.json().catch(() => null);
  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Please provide a valid email address.' }, 400);
  }

  const normalizedEmail = parsed.data.email.toLowerCase().trim();
  const rows = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, normalizedEmail))
    .limit(1);

  let devResetToken: string | undefined;
  if (rows[0] && rows[0].status === 'active') {
    const rawToken = generateRandomToken(24);
    const tokenHash = await sha256Hex(rawToken);
    const now = Date.now();

    await db.insert(schema.passwordResetTokens).values({
      id: generateId('prt'),
      userId: rows[0].id,
      tokenHash,
      expiresAt: now + 60 * 60 * 1000, // 1 hour
      createdAt: now,
    });

    await sendTransactionalEmail(c.env, {
      to: normalizedEmail,
      subject: 'Mobilikey — Password Reset Instructions',
      text: `Hello ${rows[0].name},\n\nUse the following reset token to set a new password: ${rawToken}\nThis token expires in 60 minutes.`,
    });

    if (c.env.ENVIRONMENT !== 'production') {
      devResetToken = rawToken;
    }
  }

  return c.json({
    message:
      'If an account exists for that email address, password reset instructions have been sent.',
    ...(devResetToken ? { devResetToken } : {}),
  });
});

authRoutes.post('/reset-password', async (c) => {
  const db = c.get('db');
  const body = await c.req.json().catch(() => null);
  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message || 'Invalid reset request' }, 400);
  }

  const tokenHash = await sha256Hex(parsed.data.token.trim());
  const now = Date.now();
  const rows = await db
    .select()
    .from(schema.passwordResetTokens)
    .where(
      and(
        eq(schema.passwordResetTokens.tokenHash, tokenHash),
        gt(schema.passwordResetTokens.expiresAt, now)
      )
    )
    .limit(1);

  const tokenRecord = rows[0];
  if (!tokenRecord || tokenRecord.usedAt) {
    return c.json({ error: 'Invalid or expired password reset token.' }, 400);
  }

  const newHash = await hashPassword(parsed.data.newPassword);
  await db
    .update(schema.users)
    .set({ passwordHash: newHash, updatedAt: now })
    .where(eq(schema.users.id, tokenRecord.userId));

  await db
    .update(schema.passwordResetTokens)
    .set({ usedAt: now })
    .where(eq(schema.passwordResetTokens.id, tokenRecord.id));

  // Revoke existing sessions on password reset
  await db.delete(schema.sessions).where(eq(schema.sessions.userId, tokenRecord.userId));

  return c.json({ ok: true, message: 'Password has been updated. You may now sign in.' });
});

authRoutes.post('/verify-email', requireAuth, async (c) => {
  const db = c.get('db');
  const user = c.get('user')!;
  const now = Date.now();
  await db
    .update(schema.users)
    .set({ emailVerifiedAt: now, updatedAt: now })
    .where(eq(schema.users.id, user.id));
  return c.json({ ok: true, emailVerifiedAt: now });
});

