import { drizzle, DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from './db/schema';

export interface Env {
  DB: D1Database;
  MEDIA_BUCKET?: R2Bucket;
  ASSETS?: Fetcher;
  ENVIRONMENT?: string;
  APP_URL?: string;
  EMAIL_PROVIDER?: string;
  EMAIL_FROM?: string;
  EMAIL_API_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
}

export interface SessionUserContext {
  id: string;
  slug: string;
  email: string;
  name: string;
  systemRole: 'user' | 'admin';
  status: 'active' | 'suspended' | 'deleted';
  sessionId: string;
  csrfToken: string;
}

export type AppVariables = {
  db: DrizzleD1Database<typeof schema>;
  user: SessionUserContext | null;
};

export type AppContext = {
  Bindings: Env;
  Variables: AppVariables;
};

export function createDb(d1: D1Database): DrizzleD1Database<typeof schema> {
  return drizzle(d1, { schema });
}

