import { z } from 'zod';

const optionalUrlSchema = z
  .string()
  .trim()
  .max(300)
  .refine(
    (val) => val === '' || /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(val),
    'Must be a valid http:// or https:// URL'
  );

const optionalImageUrlSchema = z
  .string()
  .trim()
  .max(200000, 'Image file is too large (please choose a smaller image)')
  .refine(
    (val) =>
      val === '' ||
      (/^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(val) && val.length <= 300) ||
      /^data:image\/(png|jpeg|jpg|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$/i.test(val),
    'Must be a valid http(s):// URL or an uploaded image file'
  );

const socialLinksSchema = z
  .object({
    linkedin: optionalUrlSchema.optional(),
    github: optionalUrlSchema.optional(),
    x: optionalUrlSchema.optional(),
    other: optionalUrlSchema.optional(),
  })
  .optional()
  .default({});

export const signUpSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().trim().email('Valid work or professional email is required').max(255),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .regex(/[A-Za-z]/, 'Password must contain at least one letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  headline: z.string().trim().max(140).optional().default(''),
  biography: z.string().trim().max(4000).optional().default(''),
  companyName: z.string().trim().max(120).optional().default(''),
  position: z.string().trim().max(120).optional().default(''),
  location: z.string().trim().max(120).optional().default(''),
  industry: z.string().trim().max(100).optional().default(''),
  website: optionalUrlSchema.optional().default(''),
  socialLinks: z
    .object({
      linkedin: optionalUrlSchema.optional(),
      github: optionalUrlSchema.optional(),
      x: optionalUrlSchema.optional(),
      other: optionalUrlSchema.optional(),
    })
    .optional()
    .default({}),
  turnstileToken: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().email('Valid email is required'),
  password: z.string().min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Valid email is required'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(16),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .regex(/[A-Za-z]/, 'Password must contain at least one letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export const experienceItemSchema = z.object({
  id: z.string().trim().min(1).max(64),
  title: z.string().trim().min(1, 'Role title is required').max(120),
  company: z.string().trim().min(1, 'Organization is required').max(120),
  location: z.string().trim().max(120).optional().default(''),
  startDate: z.string().trim().max(40).default(''),
  endDate: z.string().trim().max(40).optional().default(''),
  isCurrent: z.boolean().optional().default(false),
  description: z.string().trim().max(1500).optional().default(''),
});

export const credentialItemSchema = z.object({
  id: z.string().trim().min(1).max(64),
  title: z.string().trim().min(1, 'Credential or degree title is required').max(140),
  issuer: z.string().trim().min(1, 'Institution or issuer is required').max(120),
  year: z.string().trim().max(40).optional().default(''),
  details: z.string().trim().max(500).optional().default(''),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(100),
  headline: z.string().trim().max(140).default(''),
  biography: z.string().trim().max(4000).default(''),
  location: z.string().trim().max(120).default(''),
  companyName: z.string().trim().max(120).default(''),
  position: z.string().trim().max(120).default(''),
  website: optionalUrlSchema.default(''),
  industry: z.string().trim().max(100).default(''),
  avatarUrl: optionalUrlSchema.nullable().optional(),
  socialLinks: z
    .object({
      linkedin: optionalUrlSchema.optional(),
      github: optionalUrlSchema.optional(),
      x: optionalUrlSchema.optional(),
      other: optionalUrlSchema.optional(),
    })
    .optional()
    .default({}),
  expertise: z.array(z.string().trim().min(1).max(60)).max(15).optional(),
  highlights: z.array(z.string().trim().min(1).max(240)).max(8).optional(),
  experience: z.array(experienceItemSchema).max(20).optional(),
  credentials: z.array(credentialItemSchema).max(15).optional(),
  isPublic: z.boolean().optional(),
  allowLevel1Messages: z.boolean().optional(),
});

const optionalEmailSchema = z
  .string()
  .trim()
  .max(255)
  .refine(
    (val) => val === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
    'Must be a valid email address or left blank to use your primary account email'
  );

const emailForwardingTierSchema = z.object({
  enabled: z.boolean(),
  email: optionalEmailSchema.optional().default(''),
});

export const updateSettingsSchema = z.object({
  isPublic: z.boolean(),
  allowLevel1Messages: z.boolean(),
  emailNotifPrefs: z.object({
    directMessages: z.boolean(),
    recognizedMessages: z.boolean(),
    accessPromotions: z.boolean(),
    generalRequests: z.boolean(),
    forwarding: z
      .object({
        level1: emailForwardingTierSchema,
        level2: emailForwardingTierSchema,
        level3: emailForwardingTierSchema,
      })
      .optional(),
  }),
});

export const createCompanySchema = z.object({
  name: z.string().trim().min(2, 'Company name is required').max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug may only contain lowercase letters, numbers, and hyphens')
    .min(2)
    .max(80)
    .optional(),
  logoUrl: optionalImageUrlSchema.nullable().optional(),
  description: z.string().trim().min(10, 'Please provide a brief factual company description').max(1000),
  website: optionalUrlSchema.default(''),
  industry: z.string().trim().min(2, 'Industry is required').max(100),
  headquarters: z.string().trim().min(2, 'Headquarters location is required').max(120),
  companySize: z.string().trim().min(1).max(60),
  contactInfo: z.string().trim().max(200).default(''),
  contactEmail: optionalEmailSchema.optional().default(''),
  contactPhone: z.string().trim().max(40).optional().default(''),
  socialLinks: socialLinksSchema,
});

export const updateCompanySchema = createCompanySchema.partial().extend({
  name: z.string().trim().min(2).max(120),
});

export const addCompanyMemberSchema = z.object({
  email: z.string().trim().email('Enter a valid user email'),
  role: z.enum(['admin', 'publisher']).default('admin'),
});

export const createCompanyFollowSchema = z.object({
  followedCompanyId: z.string().trim().min(1, 'Target company is required'),
  reason: z
    .string()
    .trim()
    .max(140, 'Reason cannot exceed 140 characters')
    .optional()
    .nullable(),
  sourceUrl: optionalUrlSchema.optional().nullable(),
  bothWays: z.boolean().optional().default(false),
});

export const bulkImportFollowEntrySchema = z.object({
  company: z.string().trim().min(1, 'Followed company slug or domain is required'),
  name: z.string().trim().min(1).max(120).optional(),
  website: optionalUrlSchema.optional(),
  reason: z.string().trim().max(140, 'Reason cannot exceed 140 characters').optional().nullable(),
  source_url: optionalUrlSchema.optional().nullable(),
  both_ways: z.boolean().optional().default(false),
});

export const bulkImportCompanyItemSchema = z.object({
  company: z.string().trim().min(1, 'Source company slug or domain is required'),
  follows: z.array(bulkImportFollowEntrySchema).min(1, 'At least one follow entry is required'),
});

export const bulkImportCompanyFollowsBodySchema = z.union([
  z.array(bulkImportCompanyItemSchema),
  z.object({
    items: z.array(bulkImportCompanyItemSchema),
    dry_run: z.boolean().optional().default(false),
  }),
]);

export const bulkImportCompanyUpdateRowSchema = z.object({
  slug: z.string().trim().min(1, 'Company slug is required').max(120),
  name: z.string().trim().min(1, 'Company name is required').max(120),
  website: optionalUrlSchema.optional().default(''),
  headquarters: z.string().trim().max(120).optional().default(''),
  industry: z.string().trim().max(100).optional().default(''),
  description: z.string().trim().max(1000).optional().default(''),
  update: z
    .object({
      body: z
        .string()
        .trim()
        .min(1, 'Update body is required')
        .max(500, 'Update body cannot exceed 500 characters'),
      external_url: optionalUrlSchema.optional().nullable(),
      category: z.string().trim().max(100).optional().nullable(),
    })
    .optional()
    .nullable(),
});

export const bulkImportCompaniesBodySchema = z.union([
  z.array(z.unknown()),
  z.object({
    items: z.array(z.unknown()),
    dry_run: z.boolean().optional().default(false),
  }),
]);

export const startConversationSchema = z.object({
  recipientType: z.enum(['user', 'company']),
  recipientId: z.string().min(1),
  subject: z.string().trim().max(140).optional().default(''),
  body: z
    .string()
    .trim()
    .min(1, 'Message cannot be empty')
    .max(4000, 'Message cannot exceed 4,000 characters'),
});

export const replyMessageSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Message cannot be empty')
    .max(4000, 'Message cannot exceed 4,000 characters'),
  sendAsCompanyId: z.string().optional().nullable(),
});

export const setAccessLevelSchema = z.object({
  senderUserId: z.string().min(1),
  recipientType: z.enum(['user', 'company']),
  recipientId: z.string().min(1),
  accessLevel: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
});

export const announcementBodySchema = z
  .string()
  .trim()
  .min(10, 'Announcement must be at least 10 characters')
  .max(500, 'Announcements are strictly limited to 500 characters')
  .refine((val) => {
    const hashtags = val.match(/#[a-zA-Z0-9_]+/g) || [];
    return hashtags.length <= 2;
  }, 'Hashtag stuffing is not permitted (maximum 2 hashtags)')
  .refine((val) => {
    const lower = val.toLowerCase();
    const engagementBaitPatterns = [
      'agree?',
      'thoughts?',
      'comment below',
      'like and share',
      'drop a comment',
      'repost this',
    ];
    return !engagementBaitPatterns.some((p) => lower.includes(p));
  }, 'Announcements must be factual business updates without engagement bait phrases.');

export const createAnnouncementSchema = z.object({
  companyId: z.string().trim().optional().nullable(),
  categoryId: z.string().min(1, 'Category is required'),
  body: announcementBodySchema,
  externalUrl: optionalUrlSchema.optional().nullable(),
});

export const updateAnnouncementSchema = z
  .object({
    categoryId: z.string().min(1, 'Category is required').optional(),
    body: announcementBodySchema.optional(),
    externalUrl: optionalUrlSchema.optional().nullable(),
  })
  .refine(
    (val) =>
      val.categoryId !== undefined ||
      val.body !== undefined ||
      val.externalUrl !== undefined,
    'Provide at least one field (body, categoryId, or externalUrl) to update'
  );

export const createApiTokenSchema = z.object({
  name: z.string().trim().min(1, 'Token name is required').max(60, 'Token name cannot exceed 60 characters'),
  expiresInDays: z.number().int().min(1).max(365).optional().nullable(),
});

export const createReportSchema = z.object({
  targetType: z.enum(['announcement', 'message', 'user', 'company']),
  targetId: z.string().min(1),
  reason: z.string().trim().min(3, 'Reason is required').max(120),
  details: z.string().trim().max(1000).optional().default(''),
});

export const toggleFollowSchema = z.object({
  targetType: z.enum(['user', 'company']),
  targetId: z.string().min(1),
});

