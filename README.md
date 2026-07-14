# Harbor & Home

A private room-booking site for Sam and Lisa's friends and family. The public page reveals no addresses, listing links, room details, or availability. Approved guests can reserve individual rooms for up to seven consecutive nights; hosts manage people, categories, priority moves, blackouts, properties, parties, notifications, and audit history.

## What is implemented

- Passwordless email-code sign-in, relationship onboarding, host approval, revocable server sessions, and automatic host bootstrap from exact email addresses. It does not use Google OAuth or Google Cloud Console.
- Room-level search, immediate bookings, multi-room stays, cancellation, in-app notifications, and a seven-night limit that combines adjacent or overlapping stays.
- Multi-category guests (`parent`, `mom`, `family`, `friend`), category blackouts, property priority ranks, ordered capacity-aware fallbacks, and all-or-nothing priority displacement.
- Private parties with room holds, revocable opaque invitations, event-only access, RSVPs, and optional event rooms.
- Draft-first Zillow/Airbnb metadata import with SSRF defenses, manual review, versioned property specs, and optimized Netlify Blob photo storage.
- Transactional Postgres booking rules, checkout-exclusive occupancy, audit history, admin alerts, and a retrying email outbox.
- A responsive local demo for evaluating the complete interface before cloud accounts are connected.

## Stack and cost

The application code and libraries are open source: React, TypeScript, Vite, Drizzle, Zod, Nodemailer, Neon’s Postgres client, and Netlify Functions. It is designed for Netlify Free and Neon Free. Email is sent from a Gmail account through standard SMTP. No paid auth or SMS service is required.

Phone-number login is intentionally not included: reliable SMS delivery needs a carrier gateway and is not sustainably free. Email codes provide the same passwordless experience without Google OAuth.

## Local preview

Requires Node.js 22.13 or newer.

```bash
npm install
cp .env.example .env.local
npm run dev
```

`VITE_DEMO_MODE=true` runs entirely in the browser with seeded users, bookings, a no-parents week, and a party. Use the “Preview as” menu to test an admin, a mom, or a friend. Set it to `false` when running the full application through `npm run dev:netlify`.

Validate the project with:

```bash
npm test
npm run build
```

## Production setup

### 1. Create the Neon database

Create a free Neon Postgres project, copy its pooled connection string, and set it as `DATABASE_URL`. Neon Auth is not used. Apply the schema once:

```bash
DATABASE_URL='postgresql://...' npm run db:migrate
```

The migration seeds the default categories, Rockaway, and the hidden second property. The two main-house bedroom capacities remain draft until a host confirms them.

### 2. Configure passwordless email

Use a Gmail account that Sam or Lisa controls. Turn on two-step verification and create an app password in the Google Account security page. This is ordinary Gmail SMTP setup; it does not require a Google Cloud project, OAuth client, or billing account.

Configure these server-only Netlify variables:

```dotenv
DATABASE_URL=postgresql://...
AUTH_SECRET=<at least 32 random characters>
ADMIN_EMAILS=sam@example.com,lisa@example.com
GMAIL_USER=host@gmail.com
GMAIL_APP_PASSWORD=<16-character app password>
VITE_DEMO_MODE=false
```

Generate a strong session secret with `openssl rand -hex 32`. Never expose `DATABASE_URL`, `AUTH_SECRET`, `ADMIN_EMAILS`, or Gmail credentials in a variable beginning with `VITE_`.

Sign-in codes are cryptographically random, expire after ten minutes, work once, and are stored only as keyed hashes. Requests are rate-limited by email and IP. Successful sign-in sets a 30-day `HttpOnly`, `SameSite=Lax`, secure production cookie; signing out revokes it in Postgres.

### 3. Connect Netlify

Import [SGJIII/harbor_home](https://github.com/SGJIII/harbor_home) in Netlify, keep the detected settings from `netlify.toml`, and add the variables above under Site configuration → Environment variables. Deploy from `main`.

The included configuration builds `dist`, deploys `netlify/functions`, routes `/api/*` to the protected API, supports SPA routes, and sends security headers. No OAuth callback configuration is needed.

After the first deployment:

1. Request a code using each exact email in `ADMIN_EMAILS`; those accounts become active hosts automatically.
2. Confirm the two Rockaway main-house bedroom capacities before publishing them as ADU fallbacks.
3. Approve a test guest and verify a booking, priority move, parent blackout, party invitation, and email notification.

## Property specifications

Versioned property files live in [`property-specs`](./property-specs). They are the durable source of truth for names, location, time zone, source links, rooms, capacity, amenities, fallbacks, and authorized images. Listing imports create drafts for review; live booking never depends on Zillow or Airbnb remaining accessible.

Do not publish third-party listing photos merely because the importer found a URL. Record an owned asset key or explicit reuse approval first.

## Security behavior

- Every protected API request verifies the hashed, revocable application session and repeats guest/admin authorization server-side.
- Pending and suspended users cannot access the ordinary booking calendar. Party invitations grant access only to their event.
- Guests receive anonymous occupancy plus their own booking details. Only hosts receive identities and full booking/audit history.
- Booking transactions lock the request, check blackouts before priority, plan every fallback before moving anyone, and use a Postgres exclusion constraint to prevent room races.
- Party invitation tokens are stored as SHA-256 hashes; rotation immediately revokes prior links.
- The importer rejects credentials, custom ports, private IPs, unsafe redirects, non-HTML responses, timeouts, and bodies over 1.5 MB.

## Useful commands

- `npm run dev` — browser-only demo.
- `npm run dev:netlify` — frontend plus Netlify Functions and configured services.
- `npm test` — rule and security contract tests.
- `npm run build` — strict TypeScript and production bundle.
- `npm run db:migrate` — apply migrations to `DATABASE_URL`.
- `npm run deploy` — deploy to a linked Netlify site.
