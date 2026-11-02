import { eq } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from '../db/schema';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export async function checkRateLimit(
  db: DrizzleD1Database<typeof schema>,
  key: string,
  maxRequests: number,
  windowMs: number,
  now = Date.now()
): Promise<RateLimitResult> {
  const existing = await db
    .select()
    .from(schema.rateLimitBuckets)
    .where(eq(schema.rateLimitBuckets.key, key))
    .limit(1);

  const row = existing[0];

  if (!row || now - row.windowStart >= windowMs) {
    if (!row) {
      await db.insert(schema.rateLimitBuckets).values({
        key,
        count: 1,
        windowStart: now,
      });
    } else {
      await db
        .update(schema.rateLimitBuckets)
        .set({ count: 1, windowStart: now })
        .where(eq(schema.rateLimitBuckets.key, key));
    }
    return {
      allowed: true,
      remaining: Math.max(0, maxRequests - 1),
      resetAt: now + windowMs,
    };
  }

  if (row.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: row.windowStart + windowMs,
    };
  }

  const nextCount = row.count + 1;
  await db
    .update(schema.rateLimitBuckets)
    .set({ count: nextCount })
    .where(eq(schema.rateLimitBuckets.key, key));

  return {
    allowed: true,
    remaining: Math.max(0, maxRequests - nextCount),
    resetAt: row.windowStart + windowMs,
  };
}

