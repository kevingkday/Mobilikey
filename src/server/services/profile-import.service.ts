import { extractText } from 'unpdf';
import { INDUSTRIES } from '../../shared/constants';

export interface ImportedProfileData {
  name: string;
  email: string;
  headline: string;
  biography: string;
  location: string;
  companyName: string;
  position: string;
  website: string;
  industry: string;
  avatarUrl: string | null;
  socialLinks: {
    linkedin?: string;
    github?: string;
    x?: string;
    other?: string;
  };
}

export interface ProfileImportResult {
  profile: ImportedProfileData;
  source: 'linkedin_url' | 'linkedin_url_partial' | 'document' | 'combined';
  notice?: string;
}

const COMMON_SECTION_HEADERS = new Set([
  'contact',
  'top skills',
  'languages',
  'certifications',
  'honors-awards',
  'publications',
  'summary',
  'about',
  'professional summary',
  'executive summary',
  'profile',
  'experience',
  'work experience',
  'professional experience',
  'employment history',
  'education',
  'skills',
  'projects',
  'curriculum vitae',
  'resume',
]);

const ROLE_KEYWORDS =
  /\b(partner|director|vp|vice president|president|chief|ceo|cto|cfo|coo|cso|ciso|founder|co-founder|principal|manager|engineer|architect|counsel|attorney|scientist|analyst|consultant|head of|lead|associate|officer|advisor|professor|doctor|specialist)\b/i;

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

export function normalizeLinkedInUrl(rawUrl: string): {
  normalizedUrl: string;
  handle: string;
} | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(withProtocol);
    if (!u.hostname.toLowerCase().includes('linkedin.com')) {
      return null;
    }
    const match = u.pathname.match(/\/in\/([a-zA-Z0-9_-]+)/i);
    if (!match) return null;
    const handle = match[1];
    return {
      normalizedUrl: `https://www.linkedin.com/in/${handle}`,
      handle,
    };
  } catch {
    return null;
  }
}

export function nameFromLinkedInHandle(handle: string): string {
  // Strip trailing hex/numeric IDs e.g. "sarah-chen-94a8b123" -> "sarah-chen"
  const cleaned = handle.replace(/-[0-9a-f]{5,}$/i, '').replace(/-\d+$/, '');
  const parts = cleaned
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  return parts.join(' ');
}

export function inferIndustryFromText(text: string): string {
  const lower = text.toLowerCase();
  const rules: Array<{ industry: (typeof INDUSTRIES)[number]; keywords: string[] }> = [
    {
      industry: 'Biotechnology & Healthcare',
      keywords: [
        'biotech',
        'biotherapeutics',
        'clinical',
        'pharma',
        'oncology',
        'medical',
        'healthcare',
        'gmp',
        'fda',
        'therapeutics',
      ],
    },
    {
      industry: 'Cybersecurity',
      keywords: [
        'cybersecurity',
        'infosec',
        'scada',
        'soc',
        'zero trust',
        'threat',
        'security',
        'ciso',
        'penetration',
      ],
    },
    {
      industry: 'Logistics & Transportation',
      keywords: [
        'logistics',
        'supply chain',
        'freight',
        'intermodal',
        'shipping',
        'warehousing',
        'maritime',
        'fleet',
        'transportation',
      ],
    },
    {
      industry: 'Energy & Utilities',
      keywords: [
        'energy',
        'utility',
        'utilities',
        'grid',
        'substation',
        'solar',
        'wind',
        'battery storage',
        'power generation',
        'ferc',
        'ercot',
      ],
    },
    {
      industry: 'Financial Services',
      keywords: [
        'capital',
        'investment',
        'asset management',
        'private equity',
        'venture',
        'banking',
        'finance',
        'portfolio',
        'credit',
        'wealth',
        'fund',
      ],
    },
    {
      industry: 'Legal & Compliance',
      keywords: [
        'legal',
        'counsel',
        'attorney',
        'law',
        'regulatory',
        'compliance',
        'litigation',
        'corporate governance',
      ],
    },
    {
      industry: 'Cloud & Infrastructure',
      keywords: [
        'cloud',
        'kubernetes',
        'aws',
        'cloudflare',
        'distributed systems',
        'datacenter',
        'devops',
        'sre',
        'infrastructure',
      ],
    },
    {
      industry: 'Enterprise Software',
      keywords: [
        'saas',
        'software',
        'full-stack',
        'typescript',
        'product management',
        'b2b',
        'platform',
        'developer',
      ],
    },
    {
      industry: 'Manufacturing & Supply Chain',
      keywords: [
        'manufacturing',
        'industrial',
        'automation',
        'semiconductor',
        'robotics',
        'factory',
        'plant',
      ],
    },
    {
      industry: 'Commercial Real Estate',
      keywords: ['real estate', 'reit', 'property', 'commercial leasing', 'development'],
    },
    {
      industry: 'Telecommunications',
      keywords: ['telecom', '5g', 'fiber', 'spectrum', 'wireless', 'carrier'],
    },
    {
      industry: 'Aerospace & Defense',
      keywords: ['aerospace', 'defense', 'aviation', 'satellite', 'propulsion', 'avionics'],
    },
    {
      industry: 'Consulting & Advisory',
      keywords: ['consulting', 'advisory', 'strategy', 'management consultant'],
    },
  ];

  for (const r of rules) {
    if (r.keywords.some((kw) => lower.includes(kw))) {
      return r.industry;
    }
  }
  return '';
}

function splitRoleAndCompany(line: string): { position: string; companyName: string } | null {
  const cleaned = line.trim();
  // Pattern 1: "Position at Company"
  const atMatch = cleaned.match(/^(.{2,70}?)\s+at\s+(.{2,70})$/i);
  if (atMatch) {
    return { position: atMatch[1].trim(), companyName: atMatch[2].trim() };
  }
  // Pattern 2: "Position · Company" or "Position | Company" or "Position - Company"
  const sepMatch = cleaned.match(/^(.{2,70}?)\s+(?:·|\||—|–|-)\s+(.{2,70})$/);
  if (sepMatch && ROLE_KEYWORDS.test(sepMatch[1])) {
    return { position: sepMatch[1].trim(), companyName: sepMatch[2].trim() };
  }
  return null;
}

/**
 * Parses unstructured or semi-structured text from a LinkedIn PDF export, CV, Resume, or pasted profile text.
 */
export function parseProfileDocumentText(rawText: string): ImportedProfileData {
  const result: ImportedProfileData = {
    name: '',
    email: '',
    headline: '',
    biography: '',
    location: '',
    companyName: '',
    position: '',
    website: '',
    industry: '',
    avatarUrl: null,
    socialLinks: {},
  };

  if (!rawText || !rawText.trim()) {
    return result;
  }

  // Check if rawText is JSON (e.g., JSON Resume standard)
  if (rawText.trim().startsWith('{')) {
    try {
      const json = JSON.parse(rawText);
      const basics = json.basics || json;
      result.name = basics.name || '';
      result.email = basics.email || '';
      result.headline = basics.label || basics.headline || '';
      result.biography = (basics.summary || basics.biography || '').slice(0, 1000);
      result.website = basics.url || basics.website || '';
      if (basics.location) {
        result.location =
          typeof basics.location === 'string'
            ? basics.location
            : [basics.location.city, basics.location.region, basics.location.countryCode]
                .filter(Boolean)
                .join(', ');
      }
      if (Array.isArray(json.work) && json.work[0]) {
        result.position = json.work[0].position || json.work[0].title || '';
        result.companyName = json.work[0].name || json.work[0].company || '';
      }
      result.industry = inferIndustryFromText(rawText);
      return result;
    } catch {
      // fall through to text parser
    }
  }

  // Extract email
  const emailMatch = rawText.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/);
  if (emailMatch) {
    result.email = emailMatch[0].toLowerCase();
  }

  // Extract LinkedIn URL
  const liMatch = rawText.match(
    /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([a-zA-Z0-9_-]+)/i
  );
  if (liMatch) {
    result.socialLinks.linkedin = `https://www.linkedin.com/in/${liMatch[1]}`;
  }

  // Extract GitHub URL
  const ghMatch = rawText.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_-]+)/i);
  if (ghMatch) {
    result.socialLinks.github = `https://github.com/${ghMatch[1]}`;
  }

  // Extract external website URL (excluding linkedin/github)
  const urlMatches = rawText.match(/https?:\/\/[^\s)>\]"']+/gi) || [];
  for (const u of urlMatches) {
    const lower = u.toLowerCase();
    if (!lower.includes('linkedin.com') && !lower.includes('github.com')) {
      result.website = u.replace(/[.,;]+$/, '');
      break;
    }
  }

  // Normalize lines
  const lines = rawText
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 0 && !/^page \d+ of \d+$/i.test(l));

  // Filter out LinkedIn PDF sidebar noise lines when scanning for the header block
  const candidateHeaderLines = lines.filter((l) => {
    const lower = l.toLowerCase();
    if (COMMON_SECTION_HEADERS.has(lower)) return false;
    if (lower.includes('linkedin.com/in/')) return false;
    if (lower.includes('(linkedin)')) return false;
    if (lower.includes('@')) return false;
    if (/^\+?\d[\d\s().-]{7,}$/.test(l)) return false; // phone number
    return true;
  });

  // 1. Identify Name
  for (let i = 0; i < Math.min(candidateHeaderLines.length, 8); i++) {
    const line = candidateHeaderLines[i];
    // Name is typically 2-4 words, 4-55 chars, without numbers or URLs
    if (
      line.length >= 4 &&
      line.length <= 55 &&
      !/\d/.test(line) &&
      !ROLE_KEYWORDS.test(line) &&
      line.split(' ').length >= 2 &&
      line.split(' ').length <= 5
    ) {
      result.name = line.replace(/,\s*(Ph\.?D\.?|MBA|CFA|PE|MD|Esq\.?)$/i, (m) => m);
      break;
    }
  }
  if (!result.name && candidateHeaderLines[0] && candidateHeaderLines[0].length <= 60) {
    result.name = candidateHeaderLines[0];
  }

  // 2. Identify Headline & Role/Company near the top
  const nameIdx = lines.indexOf(result.name);
  const searchStart = nameIdx >= 0 ? nameIdx + 1 : 0;

  for (let i = searchStart; i < Math.min(lines.length, searchStart + 10); i++) {
    const line = lines[i];
    const lower = line.toLowerCase();
    if (COMMON_SECTION_HEADERS.has(lower)) break;
    if (lower.includes('@') || lower.includes('linkedin.com')) continue;

    // Check if it's a location line (e.g. "New York, NY", "Boston, Massachusetts, United States", "Greater Chicago Area")
    if (
      !result.location &&
      (/^[A-Z][a-zA-Z .'-]+,\s*[A-Z]{2}(?:\s+\d{5})?$/.test(line) ||
        /^[A-Z][a-zA-Z .'-]+,\s*[A-Z][a-zA-Z .'-]+(?:,\s*[A-Z][a-zA-Z .'-]+)?$/.test(line) ||
        /\b(metropolitan area|greater .* area|united states|united kingdom|canada)\b/i.test(line)) &&
      line.length <= 65 &&
      !ROLE_KEYWORDS.test(line)
    ) {
      result.location = line;
      continue;
    }

    if (!result.headline && (ROLE_KEYWORDS.test(line) || line.includes(' at ') || line.includes(' · ') || line.includes(' | '))) {
      result.headline = line.slice(0, 140);
      const split = splitRoleAndCompany(line);
      if (split) {
        result.position = split.position;
        result.companyName = split.companyName;
      }
    }
  }

  // 3. Scan sections for Summary/About and Experience
  let activeSection: 'none' | 'summary' | 'experience' = 'none';
  const summaryLines: string[] = [];
  const experienceLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lower = line.toLowerCase().replace(/[:—-]+$/, '').trim();

    if (
      lower === 'summary' ||
      lower === 'about' ||
      lower === 'professional summary' ||
      lower === 'executive summary' ||
      lower === 'profile'
    ) {
      activeSection = 'summary';
      continue;
    }

    if (
      lower === 'experience' ||
      lower === 'work experience' ||
      lower === 'professional experience' ||
      lower === 'employment history'
    ) {
      activeSection = 'experience';
      continue;
    }

    if (
      lower === 'education' ||
      lower === 'skills' ||
      lower === 'certifications' ||
      lower === 'publications' ||
      lower === 'honors-awards'
    ) {
      activeSection = 'none';
      continue;
    }

    if (activeSection === 'summary') {
      summaryLines.push(line);
    } else if (activeSection === 'experience') {
      experienceLines.push(line);
    }
  }

  if (summaryLines.length > 0) {
    result.biography = summaryLines.join(' ').slice(0, 1000).trim();
  }

  // Parse Experience section if position or companyName not yet populated
  if (experienceLines.length > 0 && (!result.position || !result.companyName)) {
    for (let i = 0; i < Math.min(experienceLines.length, 6); i++) {
      const expLine = experienceLines[i];
      const split = splitRoleAndCompany(expLine);
      if (split) {
        if (!result.position) result.position = split.position;
        if (!result.companyName) result.companyName = split.companyName;
        break;
      }
      // In LinkedIn PDF export, Experience starts with:
      // Line 0: Company Name (e.g. "Northstar Infrastructure Partners")
      // Line 1: Position Title (e.g. "Managing Partner")
      // Line 2: Date range (e.g. "January 2021 - Present (5 years)")
      if (
        i + 1 < experienceLines.length &&
        ROLE_KEYWORDS.test(experienceLines[i + 1]) &&
        experienceLines[i].length <= 70
      ) {
        if (!result.companyName) result.companyName = experienceLines[i];
        if (!result.position) result.position = experienceLines[i + 1];
        break;
      }
      if (
        i + 1 < experienceLines.length &&
        ROLE_KEYWORDS.test(expLine) &&
        experienceLines[i + 1].length <= 70
      ) {
        if (!result.position) result.position = expLine;
        if (!result.companyName) result.companyName = experienceLines[i + 1];
        break;
      }
    }
  }

  // Fallback biography from body paragraphs if no explicit Summary header existed
  if (!result.biography) {
    const longParagraphs = lines.filter((l) => l.length >= 85 && !l.includes('linkedin.com'));
    if (longParagraphs.length > 0) {
      result.biography = longParagraphs.slice(0, 3).join(' ').slice(0, 1000);
    }
  }

  if (!result.headline && (result.position || result.companyName)) {
    result.headline = [result.position, result.companyName].filter(Boolean).join(' at ');
  }

  result.industry = inferIndustryFromText(rawText);

  return result;
}

/**
 * Parses HTML string from a public LinkedIn profile page (OpenGraph + JSON-LD + meta tags).
 */
export function parseLinkedInPublicHtml(
  html: string,
  normalizedUrl: string,
  handle: string
): ImportedProfileData {
  const profile: ImportedProfileData = {
    name: nameFromLinkedInHandle(handle),
    email: '',
    headline: '',
    biography: '',
    location: '',
    companyName: '',
    position: '',
    website: '',
    industry: '',
    avatarUrl: null,
    socialLinks: {
      linkedin: normalizedUrl,
    },
  };

  // 1. Check JSON-LD scripts for Person schema
  const ldMatches =
    html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) ||
    [];
  for (const scriptBlock of ldMatches) {
    const inner = scriptBlock
      .replace(/^<script[^>]*>/i, '')
      .replace(/<\/script>$/i, '')
      .trim();
    try {
      const parsed = JSON.parse(inner);
      const nodes = Array.isArray(parsed)
        ? parsed
        : parsed['@graph']
        ? parsed['@graph']
        : [parsed];
      for (const node of nodes) {
        if (node && (node['@type'] === 'Person' || node.jobTitle || node.worksFor)) {
          if (node.name) profile.name = decodeHtmlEntities(String(node.name));
          if (node.jobTitle) {
            profile.position = decodeHtmlEntities(
              Array.isArray(node.jobTitle) ? node.jobTitle[0] : String(node.jobTitle)
            );
          }
          if (node.worksFor) {
            const wf = Array.isArray(node.worksFor) ? node.worksFor[0] : node.worksFor;
            if (wf?.name) profile.companyName = decodeHtmlEntities(String(wf.name));
          }
          if (node.address) {
            const addr = node.address;
            profile.location = decodeHtmlEntities(
              typeof addr === 'string'
                ? addr
                : [addr.addressLocality, addr.addressRegion, addr.addressCountry]
                    .filter(Boolean)
                    .join(', ')
            );
          }
          if (node.description) {
            profile.biography = decodeHtmlEntities(String(node.description)).slice(0, 1000);
          }
          if (node.image?.contentUrl && !String(node.image.contentUrl).includes('ghost')) {
            profile.avatarUrl = String(node.image.contentUrl);
          }
        }
      }
    } catch {
      // ignore malformed JSON-LD
    }
  }

  // 2. Extract OpenGraph / Meta tags
  const getMeta = (attrName: string): string => {
    const regex = new RegExp(
      `<meta[^>]+(?:property|name)=["']${attrName}["'][^>]+content=["']([^"']+)["']|<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${attrName}["']`,
      'i'
    );
    const m = html.match(regex);
    return m ? decodeHtmlEntities(m[1] || m[2] || '') : '';
  };

  const titleTagMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const rawTitle =
    getMeta('og:title') ||
    getMeta('twitter:title') ||
    (titleTagMatch ? decodeHtmlEntities(titleTagMatch[1]) : '');

  // LinkedIn title format: "Sarah Chen - Managing Partner - Northstar Infrastructure | LinkedIn"
  if (rawTitle && !rawTitle.toLowerCase().startsWith('sign in') && !rawTitle.toLowerCase().startsWith('linkedin')) {
    const cleanedTitle = rawTitle.replace(/\s*\|\s*LinkedIn.*$/i, '').trim();
    const parts = cleanedTitle.split(/\s+-\s+|\s+–\s+|\s+—\s+/);
    if (parts.length >= 1 && parts[0].length <= 60) {
      profile.name = parts[0].trim();
    }
    if (parts.length === 2) {
      profile.headline = parts[1].trim();
      const split = splitRoleAndCompany(parts[1]);
      if (split) {
        if (!profile.position) profile.position = split.position;
        if (!profile.companyName) profile.companyName = split.companyName;
      } else if (!profile.position) {
        profile.position = parts[1].trim();
      }
    } else if (parts.length >= 3) {
      if (!profile.position) profile.position = parts[1].trim();
      if (!profile.companyName) profile.companyName = parts[2].trim();
      profile.headline = `${profile.position} at ${profile.companyName}`;
    }
  }

  const rawDesc = getMeta('og:description') || getMeta('description');
  if (rawDesc) {
    // LinkedIn meta description often contains: "summary... · Experience: Company · Education: ... · Location: New York"
    const locMatch = rawDesc.match(/Location:\s*([^·.|]+)/i);
    if (locMatch && !profile.location) {
      profile.location = locMatch[1].trim();
    }
    const expMatch = rawDesc.match(/Experience:\s*([^·.|]+)/i);
    if (expMatch && !profile.companyName) {
      profile.companyName = expMatch[1].trim();
    }
    const cleanBio = rawDesc
      .split(/\s*·\s*(?:Experience|Education|Location|500\+|Connections):/i)[0]
      .trim();
    if (cleanBio && !profile.biography && !cleanBio.toLowerCase().startsWith('view ') && cleanBio.length > 20) {
      profile.biography = cleanBio.slice(0, 1000);
    }
  }

  const ogImage = getMeta('og:image');
  if (
    ogImage &&
    !profile.avatarUrl &&
    !ogImage.includes('static.licdn.com') &&
    !ogImage.includes('ghost')
  ) {
    profile.avatarUrl = ogImage;
  }

  if (!profile.headline && (profile.position || profile.companyName)) {
    profile.headline = [profile.position, profile.companyName].filter(Boolean).join(' at ');
  }

  profile.industry = inferIndustryFromText(
    [profile.headline, profile.companyName, profile.biography].join(' ')
  );

  return profile;
}

/**
 * Fetches a LinkedIn Public URL with timeout and falls back gracefully if LinkedIn returns HTTP 999 / Authwall.
 */
export async function importProfileFromLinkedInUrl(
  rawUrl: string
): Promise<ProfileImportResult> {
  const parsed = normalizeLinkedInUrl(rawUrl);
  if (!parsed) {
    throw new Error(
      'Please enter a valid LinkedIn profile URL (e.g. https://www.linkedin.com/in/your-name).'
    );
  }

  const { normalizedUrl, handle } = parsed;
  const fallbackProfile: ImportedProfileData = {
    name: nameFromLinkedInHandle(handle),
    email: '',
    headline: '',
    biography: '',
    location: '',
    companyName: '',
    position: '',
    website: '',
    industry: '',
    avatarUrl: null,
    socialLinks: {
      linkedin: normalizedUrl,
    },
  };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    const res = await fetch(normalizedUrl, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok || res.url.includes('/authwall') || res.url.includes('/login')) {
      return {
        profile: fallbackProfile,
        source: 'linkedin_url_partial',
        notice:
          'LinkedIn restricted automated profile reading for this URL. We linked your LinkedIn URL and extracted your name from your handle—upload your LinkedIn PDF or CV/Resume to auto-fill the remaining fields.',
      };
    }

    const html = await res.text();
    const extracted = parseLinkedInPublicHtml(html, normalizedUrl, handle);
    const hasDetails = Boolean(extracted.headline || extracted.companyName || extracted.biography);

    return {
      profile: extracted,
      source: hasDetails ? 'linkedin_url' : 'linkedin_url_partial',
      notice: hasDetails
        ? 'Imported public metadata from your LinkedIn URL. Review the fields below or upload a PDF/CV to add more detail.'
        : 'Linked your LinkedIn URL and name. Upload your LinkedIn PDF or CV/Resume to auto-fill your headline, role, and bio.',
    };
  } catch {
    return {
      profile: fallbackProfile,
      source: 'linkedin_url_partial',
      notice:
        'Linked your LinkedIn URL and extracted your name from your handle. Upload a PDF/CV or paste your profile text to populate the remaining fields.',
    };
  }
}

/**
 * Extracts plain text from an uploaded PDF, DOCX, TXT, MD, RTF, or JSON file buffer.
 */
export async function extractTextFromDocumentBuffer(
  buffer: ArrayBuffer,
  fileName: string,
  mimeType = ''
): Promise<string> {
  const lowerName = fileName.toLowerCase();
  const bytes = new Uint8Array(buffer);

  // 1. PDF File (.pdf or %PDF- header)
  const isPdf =
    lowerName.endsWith('.pdf') ||
    mimeType === 'application/pdf' ||
    (bytes.length > 4 &&
      bytes[0] === 0x25 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x44 &&
      bytes[3] === 0x46);

  if (isPdf) {
    try {
      const { text } = await extractText(bytes, { mergePages: false });
      const joined = Array.isArray(text) ? text.join('\n') : String(text || '');
      if (joined.trim().length > 10) {
        return joined;
      }
    } catch {
      // Fall through to raw PDF text literal scanner
    }
    return extractPdfTextFallback(bytes);
  }

  // 2. DOCX File (.docx / PK zip header)
  const isDocx =
    lowerName.endsWith('.docx') ||
    mimeType.includes('officedocument.wordprocessingml.document');
  if (isDocx) {
    const docxText = await extractDocxText(bytes);
    if (docxText.trim()) return docxText;
  }

  // 3. Plain text / Markdown / JSON / RTF
  const raw = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  if (lowerName.endsWith('.rtf') || raw.startsWith('{\\rtf')) {
    return raw
      .replace(/\\par\b/g, '\n')
      .replace(/\\[a-z]+\d*\s?/gi, '')
      .replace(/[{}]/g, '')
      .trim();
  }
  return raw;
}

function extractPdfTextFallback(bytes: Uint8Array): string {
  const rawLatin1 = new TextDecoder('latin1').decode(bytes);
  const chunks: string[] = [];
  const literalRegex = /\(([^()\\]*(?:\\.[^()\\]*)*)\)\s*Tj/g;
  let m: RegExpExecArray | null;
  while ((m = literalRegex.exec(rawLatin1)) !== null) {
    chunks.push(
      m[1]
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\\(/g, '(')
        .replace(/\\\)/g, ')')
    );
  }
  return chunks.join('\n');
}

async function extractDocxText(bytes: Uint8Array): Promise<string> {
  // Scan local file headers in the ZIP container for "word/document.xml"
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;
  while (offset + 30 < bytes.length) {
    const sig = view.getUint32(offset, true);
    if (sig !== 0x04034b50) {
      offset++;
      continue;
    }
    const compressionMethod = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const fileNameLen = view.getUint16(offset + 26, true);
    const extraLen = view.getUint16(offset + 28, true);
    const entryName = new TextDecoder().decode(
      bytes.subarray(offset + 30, offset + 30 + fileNameLen)
    );
    const dataStart = offset + 30 + fileNameLen + extraLen;

    if (entryName === 'word/document.xml' && dataStart + compressedSize <= bytes.length) {
      const slice = bytes.subarray(dataStart, dataStart + compressedSize);
      let xml = '';
      if (compressionMethod === 0) {
        xml = new TextDecoder().decode(slice);
      } else if (compressionMethod === 8 && typeof DecompressionStream !== 'undefined') {
        try {
          const ds = new DecompressionStream('deflate-raw');
          const writer = ds.writable.getWriter();
          writer.write(slice as unknown as BufferSource);
          writer.close();
          const decompressed = await new Response(ds.readable).arrayBuffer();
          xml = new TextDecoder().decode(decompressed);
        } catch {
          return '';
        }
      }
      if (xml) {
        return xml
          .replace(/<\/w:p>/g, '\n')
          .replace(/<[^>]+>/g, '')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .trim();
      }
    }
    offset = dataStart + Math.max(1, compressedSize);
  }
  return '';
}

export function mergeImportedProfiles(
  base: ImportedProfileData,
  overlay: ImportedProfileData
): ImportedProfileData {
  return {
    name: overlay.name || base.name,
    email: overlay.email || base.email,
    headline: overlay.headline || base.headline,
    biography: overlay.biography || base.biography,
    location: overlay.location || base.location,
    companyName: overlay.companyName || base.companyName,
    position: overlay.position || base.position,
    website: overlay.website || base.website,
    industry: overlay.industry || base.industry,
    avatarUrl: overlay.avatarUrl || base.avatarUrl,
    socialLinks: {
      ...base.socialLinks,
      ...overlay.socialLinks,
    },
  };
}
