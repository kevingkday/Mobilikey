# Mobilikey

> **Earn access. Build connections.**

Mobilikey (`mobilikey.com`) is a simplified, high-credibility professional networking and business communications application built on **Cloudflare Workers**, **Cloudflare D1 (SQLite)**, **Drizzle ORM**, **React**, **TypeScript**, and **Tailwind CSS**.

Its primary differentiator is a **directional, recipient-controlled three-level messaging access system** (`Level 1 — General Access`, `Level 2 — Recognized Access`, `Level 3 — Direct Access`, plus `Blocked`) paired with a chronological feed of **factual 500-character company announcements**.

---

## Core Architecture & Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Lucide Icons
- **Backend**: Cloudflare Workers (Hono API router + static asset serving)
- **Database**: Cloudflare D1 (SQLite) with Drizzle ORM & SQL migrations (`drizzle/`)
- **Authentication**: PBKDF2-SHA256 password hashing (Web Crypto API), HTTP-only `SameSite=Lax` session cookies, and synchronizer CSRF tokens (`X-CSRF-Token`)
- **Validation**: Shared Zod schemas (`src/shared/validation.ts`)
- **Testing**: Vitest integration & authorization test suite (`tests/`)

---

## Three-Level Messaging Access System

Every individual professional and company inbox controls who can contact them and where those messages appear:

1. **Level 1 — General Access (Default)**:
   - Default access level for all users.
   - Messages arrive in the recipient’s low-priority **General Requests** inbox (subject to anti-spam rate limits).
2. **Level 2 — Recognized Access**:
   - Explicitly granted by the recipient (`user` or `company` administrator).
   - Messages arrive in the **Recognized** inbox.
3. **Level 3 — Direct Access**:
   - Explicitly granted by the recipient.
   - Messages arrive in the recipient’s priority **Direct** inbox and trigger standard notifications.
4. **Key Invariants**:
   - **Independent & Directional**: Having Level 3 access to Sarah does not grant Sarah Level 3 access to you, nor does it affect your access to any other user or company.
   - **Replies Never Auto-Promote**: Replying to a Level 1 or Level 2 thread never automatically promotes the sender’s access level.
   - **Company vs. Personal Isolation**: Access granted to a company inbox (`recipient_type = 'company'`) never grants access to the personal inboxes of its administrators (`recipient_type = 'user'`).
   - **Immediate Effect**: Promotions, downgrades, and blocks take effect immediately across all inbox views.

---

## Local Development Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Local Environment Variables
Copy `.dev.vars.example` to `.dev.vars`:
```bash
cp .dev.vars.example .dev.vars
```

### 3. Apply D1 Migrations & Seed Local Database
```bash
npm run db:setup:local
```
This runs:
- `npm run db:migrate:local` (`wrangler d1 migrations apply mobilikey-db --local`)
- `npm run db:seed:local` (`wrangler d1 execute mobilikey-db --local --file=./drizzle/seed.sql`)

### 4. Seeded Demo Accounts (Local Dev)
All seeded accounts share the password `Mobilikey2026!`:
- **Sarah Chen** (`sarah.chen@northstar-infra.com`) — Managing Partner at Northstar Infrastructure Partners & Platform Administrator
- **John Miller** (`john.miller@vanguard-logistics.com`) — VP Supply Chain at Vanguard Global Logistics
- **Dr. Elena Rostova** (`elena.rostova@helion-bio.com`) — Chief Scientific Officer at Helion Biotherapeutics
- **Marcus Vance** (`marcus@vance-advisory.com`) — Principal at Vance Advisory Group (Solo Principal Company)
- **Claire Dubois** (`claire.dubois@aegis-cyber.com`) — Director of Industrial OT Security

### 5. Start Local Development Server
```bash
npm run dev
```
- Frontend Vite server: `http://localhost:5173` (proxies `/api/*` to Wrangler Worker on `:8787`)
- Or build and preview unified Worker + static assets on `:8787`:
```bash
npm run preview
```

---

## Automated Testing & Verification

Run the automated test suite verifying all messaging, directional access, CSRF, and announcement validation rules:
```bash
npm test
```

Run TypeScript type-checking and production build:
```bash
npm run check
npm run build
```

---

## Production Deployment (Cloudflare Workers + D1)

1. Create your production D1 database in Cloudflare:
   ```bash
   npx wrangler d1 create mobilikey-db
   ```
2. Update `database_id` in `wrangler.jsonc` with the returned D1 UUID.
3. Apply migrations to the remote D1 database:
   ```bash
   npm run db:migrate:remote
   ```
4. Build and deploy to Cloudflare Workers:
   ```bash
   npm run deploy
   ```

