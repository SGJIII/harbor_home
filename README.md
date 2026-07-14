# Harbor & Home

A private, free-to-guests room-booking site for Sam and Lisa's friends and family. The public page reveals no addresses or availability. Approved users can book individual rooms for up to seven consecutive nights, and hosts manage people, categories, priority moves, blackouts, properties, parties, notifications, and audit history.

## What is implemented

- Google sign-in through Neon Auth, relationship onboarding, pending approval, suspension-safe server authorization, and admin bootstrap by exact email.
- Room-level search, immediate bookings, multi-room stays, cancellation, in-app notifications, and a seven-night limit that aggregates adjacent or overlapping stays.
- Multi-category people (`parent`, `mom`, `family`, `friend`), category blackouts, property priority ranks, ordered capacity-aware fallbacks, and all-or-nothing mom displacement.
- Private party events, room holds, revocable opaque invite tokens (only hashes are stored), event-only access, RSVPs, and optional event rooms.
- Draft-first Zillow/Airbnb metadata importer with DNS/private-network checks, redirect and response limits, manual review, versioned property specifications, and Netlify Blob photo storage.
- Transactional Postgres booking rules, checkout-exclusive occupancy, audit history, admin alerts, and a Gmail outbox whose failures never roll back a booking.
- A complete responsive demo mode for evaluating the interface before cloud accounts are connected.

## Stack and $0 hosting

The application code and libraries are open source: React, TypeScript, Vite, Drizzle, Zod, Nodemailer, Neon's JavaScript clients, and Netlify Functions. It is designed for Netlify Free plus Neon Free. No paid API is required. Keep an eye on the providers' current free-plan limits; production pauses or scales down rather than needing application-level billing logic.

## Local preview

Requires Node.js 22.13 or newer.

```bash
npm install
cp .env.example .env.local
npm run dev
```

`VITE_DEMO_MODE=true` runs entirely in the browser with seeded people, bookings, a no-parents week, and a party. Use the “Preview as” menu to test an admin, a mom, or a friend. Demo data resets on refresh and must never be used as the production data store.

Run the validation suite:

```bash
npm test
npm run build
```

## Neon production setup

1. Create a free Neon project and enable Neon Auth.
2. In Neon Auth, enable Google and add the production Netlify origin/callback shown by Neon. Neon can provide its shared Google OAuth credentials; custom Google credentials are optional.
3. Copy `.env.example` to `.env.local` and set `DATABASE_URL`, `NEON_AUTH_BASE_URL`, and `VITE_NEON_AUTH_URL` from the Neon console.
4. Set `VITE_DEMO_MODE=false` and keep `ALLOW_DEMO_AUTH=false` in production.
5. Set `ADMIN_EMAILS` to Sam and Lisa's exact Google emails, comma-separated. Their first sign-in creates active admin profiles; everyone else starts pending.
6. Apply the database migration:

```bash
npm run db:migrate
```

The migration seeds both property drafts and all default categories. Main-house room capacities remain `NULL`/draft, as required, until a host confirms them.

## Optional Gmail notifications

Set `GMAIL_USER` and `GMAIL_APP_PASSWORD` in Netlify. Use a Google app password, not the account's normal password. If these variables are absent, bookings still succeed and email remains queued; in-app notifications continue to work. Hosts can retry the outbox from the protected API.

## Netlify deployment

```bash
npx netlify login
npx netlify init
npx netlify env:import .env.production
npm run deploy
```

The included `netlify.toml` builds `dist`, deploys `netlify/functions`, routes `/api/*` to the protected API, sends SPA routes to `index.html`, and supplies security headers. Never put `DATABASE_URL`, `NEON_AUTH_BASE_URL`, Gmail credentials, or `ADMIN_EMAILS` in a `VITE_` variable.

After deployment:

1. Add the final `https://…netlify.app` URL to Neon Auth's trusted origins and Google callback settings.
2. Sign in once as Sam and Lisa and confirm both appear as admins.
3. Complete the two Rockaway main-house bedroom capacities before using them as ADU fallbacks.
4. Verify Google sign-in, a normal booking, a mom priority move, a parent blackout, a party invitation, and Gmail delivery.

## Property specifications

Versioned property files live in [`property-specs`](./property-specs). They are the durable source of truth for names, location, time zone, source links, rooms, capacity, amenities, fallbacks, and authorized images. Listing imports only create review data; live booking never depends on Zillow or Airbnb being available.

For uploaded or imported photos, record either an owned asset key or explicit reuse approval. Do not publish third-party listing photos merely because the importer found their URL.

## Important security behavior

- Every API request verifies the Neon Auth session; guest/admin checks run again on the server.
- Guests receive anonymous occupancy plus their own booking details. Only admins receive user identities or full audit/booking history.
- The booking transaction locks the request, checks blackouts before priority, plans every fallback before changing any booking, and relies on a Postgres exclusion constraint to prevent races.
- Party invitation tokens are returned only when created/rotated and stored as SHA-256 hashes. Revoked tokens cannot be redeemed.
- The importer rejects credentials, custom ports, private IP ranges, mixed public/private DNS answers, unsafe redirects, non-HTML content, slow responses, and bodies larger than 1.5 MB.

## Useful commands

- `npm run dev` — Vite demo or configured frontend.
- `npm run dev:netlify` — frontend plus Netlify Functions.
- `npm test` — unit and security contract tests.
- `npm run build` — strict TypeScript and production bundle.
- `npm run db:generate` — generate a Drizzle migration after schema changes.
- `npm run db:migrate` — apply migrations to `DATABASE_URL`.
- `npm run deploy` — deploy production to the linked Netlify site.
