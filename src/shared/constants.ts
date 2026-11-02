export const ACCESS_LEVELS = {
  BLOCKED: 0,
  GENERAL: 1,
  RECOGNIZED: 2,
  DIRECT: 3,
} as const;

export type AccessLevelValue = (typeof ACCESS_LEVELS)[keyof typeof ACCESS_LEVELS];

export const ACCESS_LEVEL_LABELS: Record<AccessLevelValue, string> = {
  0: 'Blocked',
  1: 'Level 1 — General Access',
  2: 'Level 2 — Recognized Access',
  3: 'Level 3 — Direct Access',
};

export const ACCESS_LEVEL_SHORT_LABELS: Record<AccessLevelValue, string> = {
  0: 'Blocked',
  1: 'Level 1 · General',
  2: 'Level 2 · Recognized',
  3: 'Level 3 · Direct',
};

export const ACCESS_LEVEL_DESCRIPTIONS: Record<AccessLevelValue, string> = {
  0: 'Contact is blocked and cannot send messages to this inbox.',
  1: 'Default access. Messages appear in the low-priority General Requests folder.',
  2: 'Recognized contact. Messages appear in the Recognized inbox.',
  3: 'Direct contact. Messages appear in the Priority Direct inbox and trigger standard notifications.',
};

export const ANNOUNCEMENT_CATEGORIES = [
  { id: 'cat_company_news', slug: 'company-news', name: 'Company News', sortOrder: 1 },
  { id: 'cat_product_launch', slug: 'product-launch', name: 'Product Launch', sortOrder: 2 },
  { id: 'cat_funding', slug: 'funding', name: 'Funding', sortOrder: 3 },
  { id: 'cat_contracts', slug: 'contracts', name: 'Contracts', sortOrder: 4 },
  { id: 'cat_partnerships', slug: 'partnerships', name: 'Partnerships', sortOrder: 5 },
  { id: 'cat_hiring', slug: 'hiring', name: 'Hiring', sortOrder: 6 },
  { id: 'cat_expansion', slug: 'expansion', name: 'Expansion', sortOrder: 7 },
  { id: 'cat_milestones', slug: 'milestones', name: 'Milestones', sortOrder: 8 },
  { id: 'cat_other', slug: 'other-business-updates', name: 'Other Business Updates', sortOrder: 9 },
] as const;

export const INDUSTRIES = [
  'Financial Services',
  'Enterprise Software',
  'Cloud & Infrastructure',
  'Manufacturing & Supply Chain',
  'Biotechnology & Healthcare',
  'Energy & Utilities',
  'Legal & Compliance',
  'Logistics & Transportation',
  'Commercial Real Estate',
  'Cybersecurity',
  'Telecommunications',
  'Consulting & Advisory',
  'Aerospace & Defense',
  'Other',
] as const;

export const COMPANY_SIZES = [
  '1 (Solo Principal)',
  '2-10 employees',
  '11-50 employees',
  '51-200 employees',
  '201-1,000 employees',
  '1,000+ employees',
] as const;

export const RATE_LIMITS = {
  AUTH_WINDOW_MS: 15 * 60 * 1000,
  AUTH_MAX_ATTEMPTS: 15,
  LEVEL1_OUTREACH_HOURLY_MAX: 5,
  LEVEL1_OUTREACH_DAILY_MAX: 15,
  MESSAGE_SEND_MINUTE_MAX: 20,
} as const;

