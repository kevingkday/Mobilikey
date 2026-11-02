import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull().unique(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    emailVerifiedAt: integer('email_verified_at'),
    name: text('name').notNull(),
    headline: text('headline').notNull().default(''),
    biography: text('biography').notNull().default(''),
    location: text('location').notNull().default(''),
    companyName: text('company_name').notNull().default(''),
    position: text('position').notNull().default(''),
    website: text('website').notNull().default(''),
    industry: text('industry').notNull().default(''),
    socialLinksJson: text('social_links_json').notNull().default('{}'),
    avatarUrl: text('avatar_url'),
    isPublic: integer('is_public').notNull().default(1),
    allowLevel1Messages: integer('allow_level1_messages').notNull().default(1),
    emailNotifPrefsJson: text('email_notif_prefs_json')
      .notNull()
      .default(
        '{"directMessages":true,"recognizedMessages":true,"accessPromotions":true,"generalRequests":false}'
      ),
    systemRole: text('system_role').notNull().default('user'), // 'user' | 'admin'
    status: text('status').notNull().default('active'), // 'active' | 'suspended' | 'deleted'
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    index('idx_users_name').on(table.name),
    index('idx_users_industry').on(table.industry),
    index('idx_users_location').on(table.location),
    index('idx_users_status').on(table.status),
  ]
);

export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sessionTokenHash: text('session_token_hash').notNull().unique(),
    csrfToken: text('csrf_token').notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    expiresAt: integer('expires_at').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [index('idx_sessions_user_id').on(table.userId)]
);

export const emailVerificationTokens = sqliteTable('email_verification_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: integer('expires_at').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const passwordResetTokens = sqliteTable('password_reset_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: integer('expires_at').notNull(),
  usedAt: integer('used_at'),
  createdAt: integer('created_at').notNull(),
});

export const companies = sqliteTable(
  'companies',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    logoUrl: text('logo_url'),
    description: text('description').notNull().default(''),
    website: text('website').notNull().default(''),
    industry: text('industry').notNull().default(''),
    headquarters: text('headquarters').notNull().default(''),
    companySize: text('company_size').notNull().default('1 (Solo Principal)'),
    contactInfo: text('contact_info').notNull().default(''),
    status: text('status').notNull().default('active'), // 'active' | 'suspended'
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    index('idx_companies_name').on(table.name),
    index('idx_companies_industry').on(table.industry),
    index('idx_companies_headquarters').on(table.headquarters),
  ]
);

export const companyMembers = sqliteTable(
  'company_members',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('admin'), // 'owner' | 'admin' | 'publisher'
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('uq_company_member').on(table.companyId, table.userId),
    index('idx_company_members_user').on(table.userId),
  ]
);

/**
 * Directional Messaging Access Permissions
 * sender_user_id -> (recipient_type, recipient_user_id | recipient_company_id)
 * access_level: 0 = Blocked, 1 = General, 2 = Recognized, 3 = Direct
 */
export const accessPermissions = sqliteTable(
  'access_permissions',
  {
    id: text('id').primaryKey(),
    senderUserId: text('sender_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    recipientType: text('recipient_type').notNull(), // 'user' | 'company'
    recipientUserId: text('recipient_user_id').references(() => users.id, { onDelete: 'cascade' }),
    recipientCompanyId: text('recipient_company_id').references(() => companies.id, {
      onDelete: 'cascade',
    }),
    accessLevel: integer('access_level').notNull().default(1), // 0, 1, 2, 3
    grantedByUserId: text('granted_by_user_id')
      .notNull()
      .references(() => users.id),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    index('idx_access_sender_user').on(table.senderUserId, table.recipientUserId),
    index('idx_access_sender_company').on(table.senderUserId, table.recipientCompanyId),
    index('idx_access_recipient_user').on(table.recipientUserId, table.accessLevel),
    index('idx_access_recipient_company').on(table.recipientCompanyId, table.accessLevel),
  ]
);

export const conversations = sqliteTable(
  'conversations',
  {
    id: text('id').primaryKey(),
    subject: text('subject').notNull().default(''),
    initiatorUserId: text('initiator_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    recipientType: text('recipient_type').notNull(), // 'user' | 'company'
    recipientUserId: text('recipient_user_id').references(() => users.id, { onDelete: 'cascade' }),
    recipientCompanyId: text('recipient_company_id').references(() => companies.id, {
      onDelete: 'cascade',
    }),
    lastMessageAt: integer('last_message_at').notNull(),
    lastMessagePreview: text('last_message_preview').notNull().default(''),
    lastMessageSenderId: text('last_message_sender_id').notNull(),
    initiatorArchivedAt: integer('initiator_archived_at'),
    recipientArchivedAt: integer('recipient_archived_at'),
    initiatorLastReadAt: integer('initiator_last_read_at'),
    recipientLastReadAt: integer('recipient_last_read_at'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    index('idx_conv_initiator').on(table.initiatorUserId, table.lastMessageAt),
    index('idx_conv_recipient_user').on(table.recipientUserId, table.lastMessageAt),
    index('idx_conv_recipient_company').on(table.recipientCompanyId, table.lastMessageAt),
  ]
);

export const messages = sqliteTable(
  'messages',
  {
    id: text('id').primaryKey(),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    senderUserId: text('sender_user_id')
      .notNull()
      .references(() => users.id),
    sentAsCompanyId: text('sent_as_company_id').references(() => companies.id),
    body: text('body').notNull(),
    createdAt: integer('created_at').notNull(),
    readAt: integer('read_at'),
  },
  (table) => [index('idx_messages_conv').on(table.conversationId, table.createdAt)]
);

export const announcementCategories = sqliteTable('announcement_categories', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: integer('is_active').notNull().default(1),
});

export const announcements = sqliteTable(
  'announcements',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    authorUserId: text('author_user_id')
      .notNull()
      .references(() => users.id),
    categoryId: text('category_id')
      .notNull()
      .references(() => announcementCategories.id),
    body: text('body').notNull(),
    externalUrl: text('external_url'),
    moderationStatus: text('moderation_status').notNull().default('published'), // 'published' | 'flagged' | 'removed'
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    index('idx_announcements_created').on(table.createdAt),
    index('idx_announcements_company').on(table.companyId, table.createdAt),
    index('idx_announcements_category').on(table.categoryId, table.createdAt),
  ]
);

export const follows = sqliteTable(
  'follows',
  {
    id: text('id').primaryKey(),
    followerUserId: text('follower_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    targetType: text('target_type').notNull(), // 'user' | 'company'
    targetUserId: text('target_user_id').references(() => users.id, { onDelete: 'cascade' }),
    targetCompanyId: text('target_company_id').references(() => companies.id, {
      onDelete: 'cascade',
    }),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    index('idx_follows_follower').on(table.followerUserId),
    index('idx_follows_target_user').on(table.targetUserId),
    index('idx_follows_target_company').on(table.targetCompanyId),
  ]
);

export const notifications = sqliteTable(
  'notifications',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(), // 'new_message' | 'access_promoted' | 'access_downgraded' | 'new_follower' | 'account_notice'
    title: text('title').notNull(),
    body: text('body').notNull().default(''),
    referenceType: text('reference_type'),
    referenceId: text('reference_id'),
    readAt: integer('read_at'),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [index('idx_notifications_user').on(table.userId, table.createdAt)]
);

export const reports = sqliteTable(
  'reports',
  {
    id: text('id').primaryKey(),
    reporterUserId: text('reporter_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    targetType: text('target_type').notNull(), // 'announcement' | 'message' | 'user' | 'company'
    targetId: text('target_id').notNull(),
    reason: text('reason').notNull(),
    details: text('details').notNull().default(''),
    status: text('status').notNull().default('open'), // 'open' | 'reviewed' | 'dismissed' | 'actioned'
    reviewedByUserId: text('reviewed_by_user_id').references(() => users.id),
    reviewedAt: integer('reviewed_at'),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [index('idx_reports_status').on(table.status, table.createdAt)]
);

export const auditLogs = sqliteTable(
  'audit_logs',
  {
    id: text('id').primaryKey(),
    actorUserId: text('actor_user_id')
      .notNull()
      .references(() => users.id),
    action: text('action').notNull(),
    targetType: text('target_type').notNull(),
    targetId: text('target_id').notNull(),
    metadataJson: text('metadata_json').notNull().default('{}'),
    ipAddress: text('ip_address'),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [index('idx_audit_logs_created').on(table.createdAt)]
);

export const rateLimitBuckets = sqliteTable('rate_limit_buckets', {
  key: text('key').primaryKey(),
  count: integer('count').notNull().default(0),
  windowStart: integer('window_start').notNull(),
});

