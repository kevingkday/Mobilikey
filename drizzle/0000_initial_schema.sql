-- Mobilikey Initial D1 Database Migration
-- Enforces foreign keys, directional access permissions, and exclusive entity constraints.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  email_verified_at INTEGER,
  name TEXT NOT NULL,
  headline TEXT NOT NULL DEFAULT '',
  biography TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  company_name TEXT NOT NULL DEFAULT '',
  position TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  industry TEXT NOT NULL DEFAULT '',
  social_links_json TEXT NOT NULL DEFAULT '{}',
  avatar_url TEXT,
  is_public INTEGER NOT NULL DEFAULT 1,
  allow_level1_messages INTEGER NOT NULL DEFAULT 1,
  email_notif_prefs_json TEXT NOT NULL DEFAULT '{"directMessages":true,"recognizedMessages":true,"accessPromotions":true,"generalRequests":false}',
  system_role TEXT NOT NULL DEFAULT 'user' CHECK (system_role IN ('user', 'admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_name ON users(name);
CREATE INDEX IF NOT EXISTS idx_users_industry ON users(industry);
CREATE INDEX IF NOT EXISTS idx_users_location ON users(location);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token_hash TEXT NOT NULL UNIQUE,
  csrf_token TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  logo_url TEXT,
  description TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  industry TEXT NOT NULL DEFAULT '',
  headquarters TEXT NOT NULL DEFAULT '',
  company_size TEXT NOT NULL DEFAULT '1 (Solo Principal)',
  contact_info TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name);
CREATE INDEX IF NOT EXISTS idx_companies_industry ON companies(industry);
CREATE INDEX IF NOT EXISTS idx_companies_headquarters ON companies(headquarters);

CREATE TABLE IF NOT EXISTS company_members (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('owner', 'admin', 'publisher')),
  created_at INTEGER NOT NULL,
  UNIQUE(company_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_company_members_user ON company_members(user_id);

CREATE TABLE IF NOT EXISTS access_permissions (
  id TEXT PRIMARY KEY,
  sender_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('user', 'company')),
  recipient_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  recipient_company_id TEXT REFERENCES companies(id) ON DELETE CASCADE,
  access_level INTEGER NOT NULL DEFAULT 1 CHECK (access_level IN (0, 1, 2, 3)),
  granted_by_user_id TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (
    (recipient_type = 'user' AND recipient_user_id IS NOT NULL AND recipient_company_id IS NULL AND sender_user_id != recipient_user_id)
    OR
    (recipient_type = 'company' AND recipient_company_id IS NOT NULL AND recipient_user_id IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_access_user_pair
  ON access_permissions(sender_user_id, recipient_user_id)
  WHERE recipient_type = 'user';

CREATE UNIQUE INDEX IF NOT EXISTS uq_access_company_pair
  ON access_permissions(sender_user_id, recipient_company_id)
  WHERE recipient_type = 'company';

CREATE INDEX IF NOT EXISTS idx_access_recipient_user ON access_permissions(recipient_user_id, access_level);
CREATE INDEX IF NOT EXISTS idx_access_recipient_company ON access_permissions(recipient_company_id, access_level);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL DEFAULT '',
  initiator_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('user', 'company')),
  recipient_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  recipient_company_id TEXT REFERENCES companies(id) ON DELETE CASCADE,
  last_message_at INTEGER NOT NULL,
  last_message_preview TEXT NOT NULL DEFAULT '',
  last_message_sender_id TEXT NOT NULL,
  initiator_archived_at INTEGER,
  recipient_archived_at INTEGER,
  initiator_last_read_at INTEGER,
  recipient_last_read_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (
    (recipient_type = 'user' AND recipient_user_id IS NOT NULL AND recipient_company_id IS NULL AND initiator_user_id != recipient_user_id)
    OR
    (recipient_type = 'company' AND recipient_company_id IS NOT NULL AND recipient_user_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_conv_initiator ON conversations(initiator_user_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_recipient_user ON conversations(recipient_user_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_recipient_company ON conversations(recipient_company_id, last_message_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_user_id TEXT NOT NULL REFERENCES users(id),
  sent_as_company_id TEXT REFERENCES companies(id),
  body TEXT NOT NULL CHECK (length(body) >= 1 AND length(body) <= 4000),
  created_at INTEGER NOT NULL,
  read_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at ASC);

CREATE TABLE IF NOT EXISTS announcement_categories (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1
);

INSERT OR IGNORE INTO announcement_categories (id, slug, name, sort_order, is_active) VALUES
  ('cat_company_news', 'company-news', 'Company News', 1, 1),
  ('cat_product_launch', 'product-launch', 'Product Launch', 2, 1),
  ('cat_funding', 'funding', 'Funding', 3, 1),
  ('cat_contracts', 'contracts', 'Contracts', 4, 1),
  ('cat_partnerships', 'partnerships', 'Partnerships', 5, 1),
  ('cat_hiring', 'hiring', 'Hiring', 6, 1),
  ('cat_expansion', 'expansion', 'Expansion', 7, 1),
  ('cat_milestones', 'milestones', 'Milestones', 8, 1),
  ('cat_other', 'other-business-updates', 'Other Business Updates', 9, 1);

CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  author_user_id TEXT NOT NULL REFERENCES users(id),
  category_id TEXT NOT NULL REFERENCES announcement_categories(id),
  body TEXT NOT NULL CHECK (length(body) >= 1 AND length(body) <= 500),
  external_url TEXT,
  moderation_status TEXT NOT NULL DEFAULT 'published' CHECK (moderation_status IN ('published', 'flagged', 'removed')),
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_announcements_created ON announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_company ON announcements(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_category ON announcements(category_id, created_at DESC);

CREATE TABLE IF NOT EXISTS follows (
  id TEXT PRIMARY KEY,
  follower_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('user', 'company')),
  target_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  target_company_id TEXT REFERENCES companies(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  CHECK (
    (target_type = 'user' AND target_user_id IS NOT NULL AND target_company_id IS NULL AND follower_user_id != target_user_id)
    OR
    (target_type = 'company' AND target_company_id IS NOT NULL AND target_user_id IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_follows_user
  ON follows(follower_user_id, target_user_id)
  WHERE target_type = 'user';

CREATE UNIQUE INDEX IF NOT EXISTS uq_follows_company
  ON follows(follower_user_id, target_company_id)
  WHERE target_type = 'company';

CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_user_id);
CREATE INDEX IF NOT EXISTS idx_follows_target_user ON follows(target_user_id);
CREATE INDEX IF NOT EXISTS idx_follows_target_company ON follows(target_company_id);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('new_message', 'access_promoted', 'access_downgraded', 'new_follower', 'account_notice')),
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  reference_type TEXT,
  reference_id TEXT,
  read_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  reporter_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('announcement', 'message', 'user', 'company')),
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'dismissed', 'actioned')),
  reviewed_by_user_id TEXT REFERENCES users(id),
  reviewed_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, created_at DESC);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  ip_address TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  window_start INTEGER NOT NULL
);

