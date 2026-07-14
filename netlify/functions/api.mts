import { randomBytes, randomInt } from "node:crypto";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { getStore } from "@netlify/blobs";
import sharp from "sharp";
import { z } from "zod";
import { emailDeliveryDiagnostic, emailDeliveryErrorMessage, flushEmailOutbox, sendEmailNow } from "./lib/email.mts";
import {
  clearSessionCookie,
  isAdminEmail,
  loginCodeHash,
  normalizeEmail,
  readCookie,
  requestIpHash,
  requireActive,
  requireAdmin,
  sessionCookie,
  sessionCookieName,
  sessionTokenHash,
  tokenHash,
  verifySession,
  type AppUser,
} from "./lib/auth.mts";
import { importListing } from "./lib/importer.mts";

const jsonHeaders = { "Content-Type": "application/json", "Cache-Control": "no-store" };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: jsonHeaders });
const jsonWithHeaders = (value: unknown, status: number, headers: Record<string, string>) => new Response(JSON.stringify(value), { status, headers: { ...jsonHeaders, ...headers } });

function database() {
  if (!process.env.DATABASE_URL) throw new Response(JSON.stringify({ error: "Database is not configured." }), { status: 503 });
  return neon(process.env.DATABASE_URL);
}

async function body<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  const raw = await request.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new Response(JSON.stringify({ error: parsed.error.issues[0]?.message ?? "Invalid request." }), { status: 400 });
  return parsed.data;
}

function routePath(request: Request): string {
  const pathname = new URL(request.url).pathname;
  const marker = "/.netlify/functions/api/";
  if (pathname.includes(marker)) return pathname.slice(pathname.indexOf(marker) + marker.length);
  if (pathname.startsWith("/api/")) return pathname.slice(5);
  return "";
}

const dateRangeSchema = z.object({
  checkIn: z.iso.date(),
  checkOut: z.iso.date(),
});

async function loadState(sql: NeonQueryFunction<false, false>, user: AppUser) {
  const isAdmin = user.role === "admin";
  const [categoryRows, profileRows, membershipRows, propertyRows, roomRows, fallbackRows, bookingRows, blockRows, blockCategoryRows, priorityRows, eventRows, eventRoomRows, eventAccessRows, rsvpRows, rsvpRoomRows, notificationRows, auditRows] = await Promise.all([
    sql`SELECT id, slug, name, description, color FROM categories ORDER BY name`,
    isAdmin ? sql`SELECT id, email, name, relationship, status, role FROM profiles ORDER BY (id = ${user.id}) DESC, created_at` : sql`SELECT id, email, name, relationship, status, role FROM profiles WHERE id = ${user.id}`,
    isAdmin ? sql`SELECT profile_id, category_id FROM profile_categories` : sql`SELECT profile_id, category_id FROM profile_categories WHERE profile_id = ${user.id}`,
    user.status === "active" ? sql`SELECT * FROM properties WHERE status = 'active' OR ${isAdmin}` : sql`SELECT p.* FROM properties p WHERE EXISTS (SELECT 1 FROM events e JOIN event_access ea ON ea.event_id = e.id WHERE e.property_id = p.id AND ea.profile_id = ${user.id})`,
    user.status === "active" ? sql`SELECT r.* FROM rooms r JOIN properties p ON p.id = r.property_id WHERE p.status = 'active' OR ${isAdmin}` : sql`SELECT r.* FROM rooms r WHERE EXISTS (SELECT 1 FROM event_rooms er JOIN event_access ea ON ea.event_id = er.event_id WHERE er.room_id = r.id AND ea.profile_id = ${user.id})`,
    sql`SELECT source_room_id, fallback_room_id, position FROM room_fallbacks ORDER BY position`,
    isAdmin ? sql`SELECT * FROM bookings ORDER BY created_at DESC` : sql`SELECT b.*, CASE WHEN b.profile_id = ${user.id} THEN b.profile_id ELSE 'occupied' END AS visible_profile_id FROM bookings b WHERE b.status = 'confirmed'`,
    user.status === "active" ? sql`SELECT * FROM availability_blocks` : sql`SELECT * FROM availability_blocks WHERE false`,
    user.status === "active" ? sql`SELECT block_id, category_id FROM block_categories` : sql`SELECT block_id, category_id FROM block_categories WHERE false`,
    user.status === "active" ? sql`SELECT * FROM property_priorities` : sql`SELECT * FROM property_priorities WHERE false`,
    isAdmin ? sql`SELECT * FROM events WHERE status <> 'cancelled'` : user.status === "active" ? sql`SELECT * FROM events WHERE status = 'published'` : sql`SELECT e.* FROM events e JOIN event_access ea ON ea.event_id = e.id WHERE e.status = 'published' AND ea.profile_id = ${user.id}`,
    isAdmin ? sql`SELECT * FROM event_rooms` : sql`SELECT er.* FROM event_rooms er JOIN events e ON e.id = er.event_id WHERE e.status = 'published'`,
    isAdmin ? sql`SELECT event_id, profile_id FROM event_access` : sql`SELECT event_id, profile_id FROM event_access WHERE profile_id = ${user.id}`,
    isAdmin ? sql`SELECT * FROM event_rsvps` : sql`SELECT * FROM event_rsvps WHERE profile_id = ${user.id}`,
    isAdmin ? sql`SELECT * FROM event_rsvp_rooms` : sql`SELECT * FROM event_rsvp_rooms WHERE profile_id = ${user.id}`,
    sql`SELECT * FROM notifications WHERE profile_id = ${user.id} ORDER BY created_at DESC`,
    isAdmin ? sql`SELECT a.*, p.name AS actor_name FROM audit_log a LEFT JOIN profiles p ON p.id = a.actor_id ORDER BY a.created_at DESC LIMIT 250` : sql`SELECT * FROM audit_log WHERE false`,
  ]);

  const memberships = membershipRows as Array<Record<string, string>>;
  const fallbacks = fallbackRows as Array<Record<string, string | number>>;
  const eventRooms = eventRoomRows as Array<Record<string, string>>;
  const eventAccessList = eventAccessRows as Array<Record<string, string>>;
  const rsvps = rsvpRows as Array<Record<string, string | number>>;
  const rsvpRooms = rsvpRoomRows as Array<Record<string, string>>;
  const roomsByProperty = roomRows as Array<Record<string, unknown>>;
  return {
    categories: (categoryRows as Array<Record<string, string>>).map((row) => ({ id: row.id, name: row.name, description: row.description, color: row.color })),
    profiles: (profileRows as Array<Record<string, string>>).map((row) => ({ id: row.id, email: row.email, name: row.name, relationship: row.relationship, status: row.status, role: row.role, categoryIds: memberships.filter((item) => item.profile_id === row.id).map((item) => item.category_id) })),
    properties: (propertyRows as Array<Record<string, unknown>>).map((row) => ({ id: row.id, slug: row.slug, name: row.name, eyebrow: row.eyebrow, generalLocation: row.general_location, address: row.address, timezone: row.timezone, summary: row.summary, sourceLinks: row.source_links, roomIds: roomsByProperty.filter((room) => room.property_id === row.id).map((room) => room.id), status: row.status, accent: row.accent })),
    rooms: roomsByProperty.map((row) => ({ id: row.id, propertyId: row.property_id, name: row.name, description: row.description, bed: row.bed, capacity: row.capacity, bathroom: row.bathroom, amenities: row.amenities, fallbackIds: fallbacks.filter((item) => item.source_room_id === row.id).map((item) => item.fallback_room_id), status: row.status })),
    bookings: (bookingRows as Array<Record<string, unknown>>).map((row) => ({ id: row.id, userId: isAdmin ? row.profile_id : row.visible_profile_id, propertyId: row.property_id, roomId: row.room_id, checkIn: row.check_in, checkOut: row.check_out, partySize: row.party_size, status: row.status, eventId: row.event_id ?? undefined, movedFromRoomId: row.moved_from_room_id ?? undefined, createdAt: row.created_at })),
    blocks: (blockRows as Array<Record<string, unknown>>).map((row) => ({ id: row.id, propertyId: row.property_id, checkIn: row.check_in, checkOut: row.check_out, reason: row.reason, categoryIds: (blockCategoryRows as Array<Record<string, string>>).filter((item) => item.block_id === row.id).map((item) => item.category_id) })),
    priorityRules: (priorityRows as Array<Record<string, unknown>>).map((row) => ({ id: `${row.property_id}:${row.category_id}`, propertyId: row.property_id, categoryId: row.category_id, rank: row.rank })),
    events: (eventRows as Array<Record<string, unknown>>).map((row) => { const canSee = isAdmin || eventAccessList.some((item) => item.event_id === row.id && item.profile_id === user.id); return { id: row.id, slug: canSee ? row.slug : `held-${row.id}`, propertyId: row.property_id, title: canSee ? row.title : "Private gathering", description: canSee ? row.description : "", checkIn: row.check_in, checkOut: row.check_out, roomIds: eventRooms.filter((item) => item.event_id === row.id).map((item) => item.room_id), status: row.status, inviteToken: "", rsvps: canSee ? rsvps.filter((item) => item.event_id === row.id).map((item) => ({ userId: item.profile_id, status: item.status, partySize: item.party_size, roomIds: rsvpRooms.filter((room) => room.event_id === row.id && room.profile_id === item.profile_id).map((room) => room.room_id) })) : [] }; }),
    notifications: (notificationRows as Array<Record<string, unknown>>).map((row) => ({ id: row.id, userId: row.profile_id, title: row.title, message: row.message, kind: row.kind, read: row.read, createdAt: row.created_at })),
    audit: (auditRows as Array<Record<string, unknown>>).map((row) => ({ id: row.id, action: row.action, actorName: row.actor_name ?? "System", detail: typeof row.detail === "object" ? JSON.stringify(row.detail) : String(row.detail ?? ""), createdAt: row.created_at })),
  };
}

async function handle(request: Request) {
  const sql = database();
  const path = routePath(request);

  if (request.method === "POST" && path === "auth/request-code") {
    const data = await body(request, z.object({ email: z.string().trim().email().max(254) }));
    const email = normalizeEmail(data.email);
    const ipHash = requestIpHash(request);
    const recent = await sql`
      SELECT
        count(*) FILTER (WHERE email = ${email})::int AS email_count,
        count(*) FILTER (WHERE request_ip_hash = ${ipHash})::int AS ip_count
      FROM login_codes WHERE created_at > now() - interval '15 minutes'
    `;
    const counts = recent[0] as { email_count: number; ip_count: number };
    if (counts.email_count >= 3 || counts.ip_count >= 10) {
      return json({ error: "Too many codes were requested. Wait 15 minutes and try again." }, 429);
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    await sql`UPDATE login_codes SET consumed_at = now() WHERE email = ${email} AND consumed_at IS NULL`;
    const rows = await sql`
      INSERT INTO login_codes(email, code_hash, request_ip_hash, expires_at)
      VALUES (${email}, ${loginCodeHash(email, code)}, ${ipHash}, now() + interval '10 minutes')
      RETURNING id
    `;
    try {
      await sendEmailNow({
        to: email,
        subject: `${code} is your Harbor & Home sign-in code`,
        text: `Your Harbor & Home sign-in code is ${code}.\n\nIt expires in 10 minutes and can be used once. If you did not request it, you can ignore this email.`,
      });
    } catch (error) {
      console.log("Sign-in email delivery diagnostic", emailDeliveryDiagnostic(error));
      await sql`DELETE FROM login_codes WHERE id = ${rows[0].id}::uuid`;
      return json({ error: emailDeliveryErrorMessage(error) }, 503);
    }
    await sql`DELETE FROM login_codes WHERE expires_at < now() - interval '1 day'`;
    return json({ ok: true, email });
  }

  if (request.method === "POST" && path === "auth/verify-code") {
    const data = await body(request, z.object({ email: z.string().trim().email().max(254), code: z.string().regex(/^\d{6}$/, "Enter the six-digit code.") }));
    const email = normalizeEmail(data.email);
    const rawToken = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000).toISOString();
    const rows = await sql`
      SELECT verify_email_login(
        ${email},
        ${loginCodeHash(email, data.code)},
        ${sessionTokenHash(rawToken)},
        ${expiresAt}::timestamptz,
        ${isAdminEmail(email)}
      ) AS result
    `;
    const result = rows[0]?.result as { ok: boolean; error?: string } | undefined;
    if (!result?.ok) return json({ error: result?.error ?? "That code is invalid or expired." }, 401);
    return jsonWithHeaders({ ok: true }, 200, { "Set-Cookie": sessionCookie(request, rawToken) });
  }

  if (request.method === "POST" && path === "auth/sign-out") {
    const token = readCookie(request, sessionCookieName);
    if (token) await sql`UPDATE app_sessions SET revoked_at = now() WHERE token_hash = ${sessionTokenHash(token)} AND revoked_at IS NULL`;
    return jsonWithHeaders({ ok: true }, 200, { "Set-Cookie": clearSessionCookie(request) });
  }

  const user = await verifySession(request, sql);

  if (request.method === "GET" && path === "bootstrap") return json({ state: await loadState(sql, user) });

  if (request.method === "POST" && path === "profile/onboarding") {
    const data = await body(request, z.object({ name: z.string().trim().min(2).max(120), relationship: z.string().trim().min(2).max(300) }));
    await sql`UPDATE profiles SET name = ${data.name}, relationship = ${data.relationship}, status = CASE WHEN role = 'admin' THEN status ELSE 'pending'::access_status END, updated_at = now() WHERE id = ${user.id}`;
    await sql`INSERT INTO audit_log(actor_id, action, subject_type, subject_id, detail) VALUES (${user.id}, 'access_requested', 'profile', ${user.id}, ${JSON.stringify(data)}::jsonb)`;
    return json({ ok: true });
  }

  if (request.method === "POST" && path === "events/redeem") {
    const data = await body(request, z.object({ token: z.string().min(24), slug: z.string().min(1) }));
    const rows = await sql`SELECT e.id FROM event_invites i JOIN events e ON e.id = i.event_id WHERE i.token_hash = ${tokenHash(data.token)} AND i.revoked_at IS NULL AND e.slug = ${data.slug} AND e.status = 'published'`;
    if (!rows[0]) return json({ error: "This invitation is invalid or has been revoked." }, 404);
    await sql`INSERT INTO event_access(event_id, profile_id) VALUES (${rows[0].id}::uuid, ${user.id}) ON CONFLICT DO NOTHING`;
    await sql`INSERT INTO audit_log(actor_id, action, subject_type, subject_id, detail) VALUES (${user.id}, 'event_invitation_redeemed', 'event', ${String(rows[0].id)}, '{}')`;
    return json({ ok: true });
  }

  if (request.method === "GET" && path === "photos") {
    requireActive(user);
    const key = new URL(request.url).searchParams.get("key");
    if (!key || !/^[0-9a-f-]+\/[0-9a-f-]+\.webp$/i.test(key)) return json({ error: "Invalid photo key." }, 400);
    const stored = await getStore("property-photos").getWithMetadata(key, { type: "arrayBuffer" });
    if (!stored) return json({ error: "Photo not found." }, 404);
    return new Response(stored.data, { headers: { "Content-Type": "image/webp", "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" } });
  }

  if (request.method === "POST" && path === "bookings") {
    requireActive(user);
    const data = await body(request, dateRangeSchema.extend({ roomId: z.uuid(), partySize: z.number().int().min(1).max(30) }));
    const rows = await sql`SELECT book_standard(${user.id}, ${data.roomId}::uuid, ${data.checkIn}::date, ${data.checkOut}::date, ${data.partySize}) AS result`;
    const result = rows[0]?.result as { ok: boolean; error?: string } | undefined;
    if (!result?.ok) return json({ error: result?.error ?? "Booking could not be completed." }, 409);
    await flushEmailOutbox(sql).catch(() => undefined);
    return json(result, 201);
  }

  const bookingMatch = path.match(/^bookings\/([0-9a-f-]+)$/i);
  if (request.method === "DELETE" && bookingMatch) {
    requireActive(user);
    const id = bookingMatch[1];
    const rows = await sql`UPDATE bookings SET status = 'cancelled', cancelled_at = now(), updated_at = now() WHERE id = ${id}::uuid AND (profile_id = ${user.id} OR ${user.role === "admin"}) AND status = 'confirmed' RETURNING id, profile_id`;
    if (!rows[0]) return json({ error: "Booking was not found or cannot be cancelled." }, 404);
    const details = await sql`SELECT b.profile_id, p.email, r.name AS room_name, b.check_in, b.check_out FROM bookings b JOIN profiles p ON p.id = b.profile_id JOIN rooms r ON r.id = b.room_id WHERE b.id = ${id}::uuid`;
    if (details[0]) {
      await sql`INSERT INTO notifications(profile_id, title, message, kind) VALUES (${String(details[0].profile_id)}, 'Stay cancelled', ${`${details[0].room_name} is no longer reserved for ${details[0].check_in} through ${details[0].check_out}.`}, 'booking')`;
      await sql`INSERT INTO email_outbox(recipient, subject, text_body) VALUES (${String(details[0].email)}, 'Stay cancelled', ${`${details[0].room_name} is no longer reserved for ${details[0].check_in} through ${details[0].check_out}.`})`;
    }
    await sql`INSERT INTO audit_log(actor_id, action, subject_type, subject_id, detail) VALUES (${user.id}, 'booking_cancelled', 'booking', ${id}, '{}')`;
    await flushEmailOutbox(sql).catch(() => undefined);
    return json({ ok: true });
  }

  const rsvpMatch = path.match(/^events\/([0-9a-f-]+)\/rsvp$/i);
  if (request.method === "POST" && rsvpMatch) {
    const eventId = rsvpMatch[1];
    const data = await body(request, z.object({ status: z.enum(["attending", "not-attending"]), partySize: z.number().int().min(1).max(30), roomIds: z.array(z.uuid()).max(8) }));
    const rooms = data.status === "attending" ? data.roomIds : [];
    const rows = await sql`SELECT rsvp_event(${eventId}::uuid, ${user.id}, ${data.status}::rsvp_status, ${data.partySize}, ${rooms}::uuid[]) AS result`;
    const result = rows[0]?.result as { ok: boolean; error?: string } | undefined;
    return result?.ok ? json(result) : json({ error: result?.error ?? "RSVP failed." }, 409);
  }

  requireAdmin(user);

  const approveMatch = path.match(/^admin\/users\/([^/]+)\/approve$/);
  if (request.method === "POST" && approveMatch) {
    const data = await body(request, z.object({ categoryIds: z.array(z.uuid()).min(1) }));
    const profileId = decodeURIComponent(approveMatch[1]);
    await sql`UPDATE profiles SET status = 'active', updated_at = now() WHERE id = ${profileId}`;
    await sql`DELETE FROM profile_categories WHERE profile_id = ${profileId}`;
    for (const categoryId of data.categoryIds) await sql`INSERT INTO profile_categories(profile_id, category_id) VALUES (${profileId}, ${categoryId}::uuid) ON CONFLICT DO NOTHING`;
    await sql`INSERT INTO audit_log(actor_id, action, subject_type, subject_id, detail) VALUES (${user.id}, 'access_approved', 'profile', ${profileId}, ${JSON.stringify({ categoryIds: data.categoryIds })}::jsonb)`;
    await sql`INSERT INTO notifications(profile_id, title, message, kind) VALUES (${profileId}, 'Booking access approved', 'Sam or Lisa approved your family room booking access.', 'admin')`;
    await sql`INSERT INTO email_outbox(recipient, subject, text_body) SELECT email, 'Booking access approved', 'Sam or Lisa approved your Harbor & Home booking access.' FROM profiles WHERE id = ${profileId}`;
    await flushEmailOutbox(sql).catch(() => undefined);
    return json({ ok: true });
  }

  const categoryMembershipMatch = path.match(/^admin\/users\/([^/]+)\/categories$/);
  if (request.method === "PUT" && categoryMembershipMatch) {
    const data = await body(request, z.object({ categoryIds: z.array(z.uuid()) }));
    const profileId = decodeURIComponent(categoryMembershipMatch[1]);
    await sql`DELETE FROM profile_categories WHERE profile_id = ${profileId}`;
    for (const categoryId of data.categoryIds) await sql`INSERT INTO profile_categories(profile_id, category_id) VALUES (${profileId}, ${categoryId}::uuid) ON CONFLICT DO NOTHING`;
    await sql`INSERT INTO audit_log(actor_id, action, subject_type, subject_id, detail) VALUES (${user.id}, 'profile_categories_changed', 'profile', ${profileId}, ${JSON.stringify({ categoryIds: data.categoryIds })}::jsonb)`;
    return json({ ok: true });
  }

  if (request.method === "POST" && path === "admin/categories") {
    const data = await body(request, z.object({ name: z.string().trim().min(2).max(60), description: z.string().trim().max(300).default(""), color: z.enum(["sand", "coral", "sea", "sage"]).default("sea") }));
    const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const rows = await sql`INSERT INTO categories(slug, name, description, color) VALUES (${slug}, ${data.name}, ${data.description}, ${data.color}) RETURNING id`;
    await sql`INSERT INTO audit_log(actor_id, action, subject_type, subject_id, detail) VALUES (${user.id}, 'category_created', 'category', ${String(rows[0].id)}, ${JSON.stringify(data)}::jsonb)`;
    return json({ ok: true, id: rows[0].id }, 201);
  }

  if (request.method === "POST" && path === "admin/properties") {
    const data = await body(request, z.object({ name: z.string().trim().min(2).max(120), generalLocation: z.string().trim().max(300).default(""), address: z.string().trim().max(500).default(""), timezone: z.string().trim().min(3).max(100).default("America/New_York"), summary: z.string().max(2_000).default("") }));
    const slug = `${data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80)}-${randomBytes(3).toString("hex")}`;
    const rows = await sql`INSERT INTO properties(slug, name, general_location, address, timezone, summary, status) VALUES (${slug}, ${data.name}, ${data.generalLocation}, ${data.address}, ${data.timezone}, ${data.summary}, 'draft') RETURNING id`;
    await sql`INSERT INTO audit_log(actor_id, action, subject_type, subject_id, detail) VALUES (${user.id}, 'property_created', 'property', ${String(rows[0].id)}, ${JSON.stringify(data)}::jsonb)`;
    return json({ ok: true, id: rows[0].id, slug }, 201);
  }

  const newRoomMatch = path.match(/^admin\/properties\/([0-9a-f-]+)\/rooms$/i);
  if (request.method === "POST" && newRoomMatch) {
    const data = await body(request, z.object({ name: z.string().trim().min(2).max(120), description: z.string().max(2_000).default(""), bed: z.string().max(300).default("Details needed"), capacity: z.number().int().min(1).max(30).nullable().default(null), bathroom: z.string().max(300).default("Details needed") }));
    const slug = `${data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80)}-${randomBytes(2).toString("hex")}`;
    const rows = await sql`INSERT INTO rooms(property_id, slug, name, description, bed, capacity, bathroom, status) VALUES (${newRoomMatch[1]}::uuid, ${slug}, ${data.name}, ${data.description}, ${data.bed}, ${data.capacity}, ${data.bathroom}, 'draft') RETURNING id`;
    await sql`INSERT INTO audit_log(actor_id, action, subject_type, subject_id, detail) VALUES (${user.id}, 'room_created', 'room', ${String(rows[0].id)}, ${JSON.stringify(data)}::jsonb)`;
    return json({ ok: true, id: rows[0].id, slug }, 201);
  }

  if (request.method === "PUT" && path === "admin/priorities") {
    const data = await body(request, z.object({ propertyId: z.uuid(), categoryId: z.uuid(), rank: z.number().int().min(0).max(10_000) }));
    await sql`INSERT INTO property_priorities(property_id, category_id, rank) VALUES (${data.propertyId}::uuid, ${data.categoryId}::uuid, ${data.rank}) ON CONFLICT (property_id, category_id) DO UPDATE SET rank = EXCLUDED.rank`;
    await sql`INSERT INTO audit_log(actor_id, action, subject_type, subject_id, detail) VALUES (${user.id}, 'priority_changed', 'property', ${data.propertyId}, ${JSON.stringify(data)}::jsonb)`;
    return json({ ok: true });
  }

  const fallbackMatch = path.match(/^admin\/rooms\/([0-9a-f-]+)\/fallbacks$/i);
  if (request.method === "PUT" && fallbackMatch) {
    const data = await body(request, z.object({ fallbackIds: z.array(z.uuid()).max(20) }));
    const valid = await sql`SELECT r.id FROM rooms source JOIN rooms r ON r.property_id = source.property_id WHERE source.id = ${fallbackMatch[1]}::uuid AND r.id = ANY(${data.fallbackIds}::uuid[]) AND r.id <> source.id`;
    if (valid.length !== data.fallbackIds.length) return json({ error: "Fallback rooms must belong to the same property." }, 400);
    await sql`DELETE FROM room_fallbacks WHERE source_room_id = ${fallbackMatch[1]}::uuid`;
    for (const [index, fallbackId] of data.fallbackIds.entries()) await sql`INSERT INTO room_fallbacks(source_room_id, fallback_room_id, position) VALUES (${fallbackMatch[1]}::uuid, ${fallbackId}::uuid, ${index + 1})`;
    await sql`INSERT INTO audit_log(actor_id, action, subject_type, subject_id, detail) VALUES (${user.id}, 'fallbacks_changed', 'room', ${fallbackMatch[1]}, ${JSON.stringify(data)}::jsonb)`;
    return json({ ok: true });
  }

  if (request.method === "POST" && path === "admin/blocks") {
    const data = await body(request, dateRangeSchema.extend({ propertyId: z.uuid(), categoryIds: z.array(z.uuid()).min(1), reason: z.string().trim().min(2).max(300) }));
    const rows = await sql`INSERT INTO availability_blocks(property_id, check_in, check_out, reason, created_by) VALUES (${data.propertyId}::uuid, ${data.checkIn}::date, ${data.checkOut}::date, ${data.reason}, ${user.id}) RETURNING id`;
    for (const categoryId of data.categoryIds) await sql`INSERT INTO block_categories(block_id, category_id) VALUES (${rows[0].id}::uuid, ${categoryId}::uuid)`;
    await sql`INSERT INTO audit_log(actor_id, action, subject_type, subject_id, detail) VALUES (${user.id}, 'blackout_created', 'availability_block', ${String(rows[0].id)}, ${JSON.stringify(data)}::jsonb)`;
    return json({ ok: true, id: rows[0].id }, 201);
  }

  if (request.method === "POST" && path === "admin/events") {
    const data = await body(request, dateRangeSchema.extend({ title: z.string().trim().min(2).max(160), description: z.string().max(2_000).default(""), propertyId: z.uuid(), roomIds: z.array(z.uuid()).min(1), publish: z.boolean().default(false) }));
    const slug = `${data.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80)}-${randomBytes(3).toString("hex")}`;
    const token = randomBytes(32).toString("base64url");
    const rows = await sql`INSERT INTO events(slug, property_id, title, description, check_in, check_out, created_by) VALUES (${slug}, ${data.propertyId}::uuid, ${data.title}, ${data.description}, ${data.checkIn}::date, ${data.checkOut}::date, ${user.id}) RETURNING id`;
    for (const roomId of data.roomIds) await sql`INSERT INTO event_rooms(event_id, room_id) VALUES (${rows[0].id}::uuid, ${roomId}::uuid)`;
    await sql`INSERT INTO event_invites(event_id, token_hash) VALUES (${rows[0].id}::uuid, ${tokenHash(token)})`;
    if (data.publish) {
      const published = await sql`SELECT publish_event(${rows[0].id}::uuid, ${user.id}) AS result`;
      const result = published[0].result as { ok: boolean; error?: string };
      if (!result.ok) return json({ error: result.error, id: rows[0].id }, 409);
    }
    return json({ ok: true, id: rows[0].id, slug, inviteToken: token }, 201);
  }

  const rotateMatch = path.match(/^admin\/events\/([0-9a-f-]+)\/rotate-invite$/i);
  if (request.method === "POST" && rotateMatch) {
    const token = randomBytes(32).toString("base64url");
    await sql`UPDATE event_invites SET revoked_at = now() WHERE event_id = ${rotateMatch[1]}::uuid AND revoked_at IS NULL`;
    await sql`INSERT INTO event_invites(event_id, token_hash) VALUES (${rotateMatch[1]}::uuid, ${tokenHash(token)})`;
    await sql`INSERT INTO audit_log(actor_id, action, subject_type, subject_id, detail) VALUES (${user.id}, 'event_invitation_rotated', 'event', ${rotateMatch[1]}, '{}')`;
    return json({ ok: true, inviteToken: token });
  }

  const publishMatch = path.match(/^admin\/events\/([0-9a-f-]+)\/publish$/i);
  if (request.method === "POST" && publishMatch) {
    const rows = await sql`SELECT publish_event(${publishMatch[1]}::uuid, ${user.id}) AS result`;
    const result = rows[0]?.result as { ok: boolean; error?: string } | undefined;
    return result?.ok ? json(result) : json({ error: result?.error ?? "Event could not be published." }, 409);
  }

  if (request.method === "POST" && path === "admin/properties/import") {
    const data = await body(request, z.object({ url: z.url().max(2_000) }));
    const draft = await importListing(data.url);
    const name = draft.name || "Imported property";
    const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70) || "imported-property"}-${randomBytes(3).toString("hex")}`;
    const links = [{ label: `Source ${draft.sourceType} listing`, url: draft.sourceUrl, type: draft.sourceType }];
    const rows = await sql`INSERT INTO properties(slug, name, summary, source_links, status) VALUES (${slug}, ${name}, ${draft.description}, ${JSON.stringify(links)}::jsonb, 'draft') RETURNING id`;
    await sql`INSERT INTO audit_log(actor_id, action, subject_type, subject_id, detail) VALUES (${user.id}, 'property_imported_as_draft', 'property', ${String(rows[0].id)}, ${JSON.stringify({ sourceUrl: draft.sourceUrl, sourceType: draft.sourceType, importedImageUrls: draft.imageUrls })}::jsonb)`;
    return json({ draft, propertyId: rows[0].id }, 201);
  }

  const roomMatch = path.match(/^admin\/rooms\/([0-9a-f-]+)$/i);
  if (request.method === "PATCH" && roomMatch) {
    const data = await body(request, z.object({ name: z.string().trim().min(2).max(120).optional(), description: z.string().max(2_000).optional(), bed: z.string().max(300).optional(), capacity: z.number().int().min(1).max(30).nullable().optional(), bathroom: z.string().max(300).optional(), amenities: z.array(z.string().max(100)).max(30).optional(), status: z.enum(["draft", "active"]).optional() }));
    if (data.status === "active" && !data.capacity) return json({ error: "A room needs a confirmed capacity before publication." }, 400);
    const rows = await sql`UPDATE rooms SET
      name = COALESCE(${data.name ?? null}, name),
      description = COALESCE(${data.description ?? null}, description),
      bed = COALESCE(${data.bed ?? null}, bed),
      capacity = CASE WHEN ${data.capacity === undefined} THEN capacity ELSE ${data.capacity ?? null} END,
      bathroom = COALESCE(${data.bathroom ?? null}, bathroom),
      amenities = COALESCE(${data.amenities ? JSON.stringify(data.amenities) : null}::jsonb, amenities),
      status = COALESCE(${data.status ?? null}::publish_status, status), updated_at = now()
      WHERE id = ${roomMatch[1]}::uuid RETURNING id`;
    if (!rows[0]) return json({ error: "Room not found." }, 404);
    await sql`INSERT INTO audit_log(actor_id, action, subject_type, subject_id, detail) VALUES (${user.id}, 'room_updated', 'room', ${roomMatch[1]}, ${JSON.stringify(data)}::jsonb)`;
    return json({ ok: true });
  }

  const propertyMatch = path.match(/^admin\/properties\/([0-9a-f-]+)$/i);
  if (request.method === "PATCH" && propertyMatch) {
    const data = await body(request, z.object({ name: z.string().trim().min(2).max(120).optional(), generalLocation: z.string().max(300).optional(), address: z.string().max(500).optional(), timezone: z.string().max(100).optional(), summary: z.string().max(2_000).optional(), status: z.enum(["draft", "active"]).optional() }));
    const rows = await sql`UPDATE properties SET name = COALESCE(${data.name ?? null}, name), general_location = COALESCE(${data.generalLocation ?? null}, general_location), address = COALESCE(${data.address ?? null}, address), timezone = COALESCE(${data.timezone ?? null}, timezone), summary = COALESCE(${data.summary ?? null}, summary), status = COALESCE(${data.status ?? null}::publish_status, status), version = version + 1, updated_at = now() WHERE id = ${propertyMatch[1]}::uuid RETURNING id`;
    if (!rows[0]) return json({ error: "Property not found." }, 404);
    await sql`INSERT INTO audit_log(actor_id, action, subject_type, subject_id, detail) VALUES (${user.id}, 'property_updated', 'property', ${propertyMatch[1]}, ${JSON.stringify(data)}::jsonb)`;
    return json({ ok: true });
  }

  const photoMatch = path.match(/^admin\/properties\/([0-9a-f-]+)\/photos$/i);
  if (request.method === "POST" && photoMatch) {
    const contentType = request.headers.get("content-type") ?? "";
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(contentType)) return json({ error: "Upload a JPEG, PNG, WebP, or AVIF image." }, 415);
    const bytes = await request.arrayBuffer();
    if (bytes.byteLength > 5_000_000) return json({ error: "Photos must be 5 MB or smaller." }, 413);
    let optimized: Buffer;
    try { optimized = await sharp(Buffer.from(bytes), { limitInputPixels: 40_000_000 }).rotate().resize({ width: 2_000, height: 2_000, fit: "inside", withoutEnlargement: true }).webp({ quality: 82, effort: 4 }).toBuffer(); }
    catch { return json({ error: "The uploaded file is not a valid supported image." }, 400); }
    const key = `${photoMatch[1]}/${crypto.randomUUID()}.webp`;
    await getStore("property-photos").set(key, Uint8Array.from(optimized).buffer, { metadata: { contentType: "image/webp", originalContentType: contentType } });
    await sql`UPDATE properties SET image_keys = image_keys || ${JSON.stringify([key])}::jsonb, updated_at = now() WHERE id = ${photoMatch[1]}::uuid`;
    return json({ ok: true, key }, 201);
  }

  if (request.method === "POST" && path === "admin/email/retry") return json(await flushEmailOutbox(sql, 25));
  return json({ error: "Not found." }, 404);
}

export default async function handler(request: Request) {
  try {
    return await handle(request);
  } catch (error) {
    if (error instanceof Response) return new Response(error.body, { status: error.status, headers: { ...jsonHeaders, ...Object.fromEntries(error.headers) } });
    console.error(error);
    return json({ error: "Unexpected server error." }, 500);
  }
}

export const config = { path: ["/api/*"] };
