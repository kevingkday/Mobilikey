import type { AccessLevelValue } from './constants';

export type EntityType = 'user' | 'company';
export type UserRole = 'user' | 'admin';
export type AccountStatus = 'active' | 'suspended' | 'deleted';
export type CompanyMemberRole = 'owner' | 'admin' | 'publisher';
export type InboxFolder = 'general' | 'recognized' | 'direct' | 'sent' | 'archived';

export interface EmailForwardingTierConfig {
  enabled: boolean;
  /** Destination email for this access level (e.g. info@company.com for L1, work@ for L2, personal@ for L3). Empty string falls back to primary account email. */
  email: string;
}

export interface EmailForwardingPrefs {
  level1: EmailForwardingTierConfig;
  level2: EmailForwardingTierConfig;
  level3: EmailForwardingTierConfig;
}

export interface EmailNotifPrefs {
  directMessages: boolean;
  recognizedMessages: boolean;
  accessPromotions: boolean;
  generalRequests: boolean;
  forwarding?: EmailForwardingPrefs;
}

export interface SocialLinks {
  linkedin?: string;
  github?: string;
  x?: string;
  other?: string;
}

export interface ExperienceItem {
  id: string;
  title: string;
  company: string;
  location?: string;
  startDate: string;
  endDate?: string;
  isCurrent?: boolean;
  description?: string;
}

export interface CredentialItem {
  id: string;
  title: string;
  issuer: string;
  year?: string;
  details?: string;
}

export interface PublicUserProfile {
  id: string;
  slug: string;
  name: string;
  headline: string;
  biography: string;
  location: string;
  companyName: string;
  position: string;
  website: string;
  industry: string;
  socialLinks: SocialLinks;
  expertise: string[];
  highlights: string[];
  experience: ExperienceItem[];
  credentials: CredentialItem[];
  avatarUrl: string | null;
  isPublic: boolean;
  allowLevel1Messages: boolean;
  createdAt: number;
  viewerAccessToUser?: AccessLevelValue;
  userAccessToViewer?: AccessLevelValue;
  isFollowing?: boolean;
  followerCount?: number;
  affiliatedCompanies?: ManagedCompanySummary[];
}

export interface AuthenticatedUser extends PublicUserProfile {
  email: string;
  emailVerifiedAt: number | null;
  emailNotifPrefs: EmailNotifPrefs;
  systemRole: UserRole;
  status: AccountStatus;
  csrfToken: string;
  managedCompanies: ManagedCompanySummary[];
}

export interface ManagedCompanySummary {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  industry: string;
  role: CompanyMemberRole;
}

export type CompanyFollowSource = 'admin_seeded' | 'user';

export interface CompanyFollowItem {
  id: string;
  companyId: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  industry: string;
  website: string;
  isClaimed: boolean;
  source: CompanyFollowSource;
  reason: string | null;
  sourceUrl: string | null;
  createdAt: number;
}

export interface BulkImportCompanyFollowsResult {
  dryRun: boolean;
  created: Array<{
    followerSlug: string;
    followedSlug: string;
    bothWays: boolean;
    placeholderCreated: boolean;
  }>;
  skipped: Array<{
    followerSlug: string;
    followedSlug: string;
    reason: string;
  }>;
  placeholdersCreated: Array<{
    slug: string;
    name: string;
    website: string;
  }>;
  notMatched: Array<{
    company: string;
    context: string;
  }>;
}

export interface BulkImportCompaniesResult {
  dryRun: boolean;
  companiesCreated: number;
  companiesMatched: number;
  updatesCreated: number;
  updatesSkipped: number;
  createdCompanies: Array<{
    slug: string;
    name: string;
    website: string;
  }>;
  matchedCompanies: Array<{
    slug: string;
    name: string;
  }>;
  errors: Array<{
    row: number;
    slug?: string;
    name?: string;
    error: string;
  }>;
}

export interface CompanyProfile {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  description: string;
  website: string;
  industry: string;
  headquarters: string;
  companySize: string;
  contactInfo: string;
  contactEmail: string;
  contactPhone: string;
  socialLinks: SocialLinks;
  isClaimed: boolean;
  status: 'active' | 'suspended';
  createdAt: number;
  followerCount?: number;
  isFollowing?: boolean;
  viewerAccessToCompany?: AccessLevelValue;
  viewerRole?: CompanyMemberRole | null;
  members?: Array<{
    id: string;
    userId: string;
    userName: string;
    userSlug: string;
    userHeadline: string;
    userAvatarUrl: string | null;
    role: CompanyMemberRole;
    createdAt: number;
  }>;
  followers?: Array<{
    userId: string;
    userName: string;
    userSlug: string;
    userHeadline: string;
    userCompany: string;
    userAvatarUrl: string | null;
    followedAt: number;
    accessLevelToCompany: AccessLevelValue;
  }>;
  companyFollows?: CompanyFollowItem[];
  companyFollowedBy?: CompanyFollowItem[];
}

export interface ConversationSummary {
  id: string;
  subject: string;
  initiatorUserId: string;
  recipientType: EntityType;
  recipientUserId: string | null;
  recipientCompanyId: string | null;
  counterparty: {
    type: EntityType;
    id: string;
    slug: string;
    name: string;
    subtitle: string;
    avatarUrl: string | null;
  };
  /** Access level that the counterparty holds toward the currently viewed inbox */
  counterpartyAccessToInbox: AccessLevelValue;
  /** Access level that the currently viewed inbox (user) holds toward the counterparty */
  inboxAccessToCounterparty: AccessLevelValue;
  lastMessageAt: number;
  lastMessagePreview: string;
  lastMessageSenderId: string;
  unreadCount: number;
  isArchived: boolean;
  createdAt: number;
}

export interface MessageItem {
  id: string;
  conversationId: string;
  senderUserId: string;
  senderName: string;
  senderSlug: string;
  senderHeadline: string;
  senderAvatarUrl: string | null;
  sentAsCompanyId: string | null;
  sentAsCompanyName: string | null;
  sentAsCompanySlug: string | null;
  sentAsCompanyLogoUrl: string | null;
  body: string;
  createdAt: number;
  readAt: number | null;
}

export interface AnnouncementItem {
  id: string;
  companyId: string | null;
  companyName: string | null;
  companySlug: string | null;
  companyLogoUrl: string | null;
  companyIndustry: string | null;
  authorUserId: string;
  authorName: string;
  authorSlug: string;
  authorHeadline: string;
  authorAvatarUrl: string | null;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  body: string;
  externalUrl: string | null;
  moderationStatus: 'published' | 'flagged' | 'removed';
  createdAt: number;
  isFollowingCompany?: boolean;
  isFollowingAuthor?: boolean;
}

export interface AccessPermissionRecord {
  id: string;
  senderUserId: string;
  senderName: string;
  senderSlug: string;
  senderHeadline: string;
  senderCompany: string;
  senderAvatarUrl: string | null;
  recipientType: EntityType;
  recipientId: string;
  accessLevel: AccessLevelValue;
  grantedByUserId: string;
  updatedAt: number;
}

export interface NotificationItem {
  id: string;
  userId: string;
  type: 'new_message' | 'access_promoted' | 'access_downgraded' | 'new_follower' | 'account_notice';
  title: string;
  body: string;
  referenceType: string | null;
  referenceId: string | null;
  readAt: number | null;
  createdAt: number;
}

