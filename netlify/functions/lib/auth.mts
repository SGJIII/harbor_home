import { createHash } from "node:crypto";
import type { NeonQueryFunction } from "@neondatabase/serverless";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
}

export interface AppUser extends SessionUser {
  role: "admin" | "guest";
  status: "pending" | "active" | "suspended";
  relationship: string;
}

function adminEmails(): Set<string> {
  return new Set((process.env.ADMIN_EMAILS ?? "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean));
}

export async function verifySession(request: Request): Promise<SessionUser> {
  if (process.env.ALLOW_DEMO_AUTH === "true") {
    const demo = request.headers.get("x-demo-user");
    if (demo) return { id: `demo:${demo.toLowerCase()}`, email: demo.toLowerCase(), name: demo.split("@")[0] };
  }

  const base = process.env.NEON_AUTH_BASE_URL?.replace(/\/$/, "");
  if (!base) throw new Response(JSON.stringify({ error: "Authentication is not configured." }), { status: 503 });
  const headers = new Headers({ Accept: "application/json" });
  const authorization = request.headers.get("authorization");
  const cookie = request.headers.get("cookie");
  if (authorization) headers.set("authorization", authorization);
  if (cookie) headers.set("cookie", cookie);

  const response = await fetch(`${base}/get-session`, { headers, signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Response(JSON.stringify({ error: "Please sign in to continue." }), { status: 401 });
  const payload = await response.json() as Record<string, unknown>;
  const nested = (payload.data ?? payload) as Record<string, unknown>;
  const raw = (nested.user ?? payload.user) as Record<string, unknown> | undefined;
  if (!raw?.id || !raw.email) throw new Response(JSON.stringify({ error: "Please sign in to continue." }), { status: 401 });
  return { id: String(raw.id), email: String(raw.email).toLowerCase(), name: String(raw.name ?? raw.email) };
}

export async function getOrCreateAppUser(sql: NeonQueryFunction<false, false>, session: SessionUser): Promise<AppUser> {
  const role = adminEmails().has(session.email) ? "admin" : "guest";
  const status = role === "admin" ? "active" : "pending";
  const rows = await sql`
    INSERT INTO profiles(id, email, name, role, status)
    VALUES (${session.id}, ${session.email}, ${session.name}, ${role}, ${status})
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      name = CASE WHEN profiles.name = '' THEN EXCLUDED.name ELSE profiles.name END,
      role = CASE WHEN EXCLUDED.role = 'admin' THEN 'admin'::app_role ELSE profiles.role END,
      status = CASE WHEN EXCLUDED.role = 'admin' THEN 'active'::access_status ELSE profiles.status END,
      updated_at = now()
    RETURNING id, email, name, relationship, role, status
  `;
  return rows[0] as AppUser;
}

export function requireActive(user: AppUser) {
  if (user.status !== "active") throw new Response(JSON.stringify({ error: "Your access is awaiting host approval." }), { status: 403 });
}

export function requireAdmin(user: AppUser) {
  requireActive(user);
  if (user.role !== "admin") throw new Response(JSON.stringify({ error: "Host access is required." }), { status: 403 });
}

export function tokenHash(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
