import { createHash, createHmac } from "node:crypto";
import type { NeonQueryFunction } from "@neondatabase/serverless";

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: "admin" | "guest";
  status: "pending" | "active" | "suspended";
  relationship: string;
}

export const sessionCookieName = "hh_session";

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function configuredSecret(): string {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Response(JSON.stringify({ error: "Email sign-in is not configured." }), { status: 503 });
  }
  return secret;
}

function hmac(value: string, secret = configuredSecret()): string {
  return createHmac("sha256", secret).update(value, "utf8").digest("hex");
}

export function loginCodeHash(email: string, code: string, secret?: string): string {
  return hmac(`login-code:${normalizeEmail(email)}:${code}`, secret);
}

export function sessionTokenHash(token: string, secret?: string): string {
  return hmac(`session:${token}`, secret);
}

export function requestIp(request: Request): string {
  return request.headers.get("x-nf-client-connection-ip")
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? "unknown";
}

export function requestIpHash(request: Request, secret?: string): string {
  return hmac(`request-ip:${requestIp(request)}`, secret);
}

export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) {
      try { return decodeURIComponent(value.join("=")); }
      catch { return undefined; }
    }
  }
  return undefined;
}

function isHttps(request: Request): boolean {
  return request.headers.get("x-forwarded-proto") === "https" || new URL(request.url).protocol === "https:";
}

export function sessionCookie(request: Request, token: string, maxAgeSeconds = 60 * 60 * 24 * 30): string {
  return [
    `${sessionCookieName}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    isHttps(request) ? "Secure" : "",
    `Max-Age=${maxAgeSeconds}`,
  ].filter(Boolean).join("; ");
}

export function clearSessionCookie(request: Request): string {
  return sessionCookie(request, "", 0);
}

export function isAdminEmail(email: string): boolean {
  const admins = new Set((process.env.ADMIN_EMAILS ?? "").split(",").map(normalizeEmail).filter(Boolean));
  return admins.has(normalizeEmail(email));
}

export function roleForEmail(email: string): AppUser["role"] {
  return isAdminEmail(email) ? "admin" : "guest";
}

export async function verifySession(request: Request, sql: NeonQueryFunction<false, false>): Promise<AppUser> {
  const token = readCookie(request, sessionCookieName);
  if (!token || token.length < 32) {
    throw new Response(JSON.stringify({ error: "Please sign in to continue." }), { status: 401 });
  }
  const rows = await sql`
    SELECT p.id, p.email, p.name, p.relationship, p.role, p.status, s.id AS session_id
    FROM app_sessions s JOIN profiles p ON p.id = s.profile_id
    WHERE s.token_hash = ${sessionTokenHash(token)}
      AND s.revoked_at IS NULL AND s.expires_at > now()
    LIMIT 1
  `;
  const row = rows[0] as (AppUser & { session_id: string }) | undefined;
  if (!row) throw new Response(JSON.stringify({ error: "Your sign-in expired. Request a new code." }), { status: 401 });
  await sql`UPDATE app_sessions SET last_seen_at = now() WHERE id = ${row.session_id}::uuid AND last_seen_at < now() - interval '1 hour'`;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    relationship: row.relationship,
    role: roleForEmail(row.email),
    status: row.status,
  };
}

export function requireActive(user: AppUser) {
  if (user.status !== "active") throw new Response(JSON.stringify({ error: "Your access is awaiting host approval." }), { status: 403 });
}

export function requireAdmin(user: AppUser) {
  requireActive(user);
  if (user.role !== "admin" || !isAdminEmail(user.email)) {
    throw new Response(JSON.stringify({ error: "Host access is required." }), { status: 403 });
  }
}

export function tokenHash(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
