import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearSessionCookie,
  isAdminEmail,
  loginCodeHash,
  newSessionExpiresAt,
  normalizeEmail,
  readCookie,
  requireAdmin,
  roleForEmail,
  sessionCookie,
  sessionTokenHash,
  type AppUser,
} from "../netlify/functions/lib/auth.mts";
import { emailDeliveryDiagnostic, emailDeliveryErrorMessage, normalizeGmailAppPassword } from "../netlify/functions/lib/email.mts";

const secret = "test-secret-that-is-longer-than-thirty-two-characters";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("passwordless authentication security", () => {
  it("normalizes email addresses before hashing", () => {
    expect(normalizeEmail("  Guest@Example.COM ")).toBe("guest@example.com");
    expect(loginCodeHash("Guest@Example.COM", "123456", secret)).toBe(loginCodeHash("guest@example.com", "123456", secret));
  });

  it("scopes code hashes to both address and code", () => {
    const hash = loginCodeHash("guest@example.com", "123456", secret);
    expect(hash).toHaveLength(64);
    expect(hash).not.toBe(loginCodeHash("other@example.com", "123456", secret));
    expect(hash).not.toBe(loginCodeHash("guest@example.com", "654321", secret));
  });

  it("stores a keyed hash instead of the raw session token", () => {
    const token = "raw-session-token-that-is-at-least-32-characters";
    const hash = sessionTokenHash(token, secret);
    expect(hash).toHaveLength(64);
    expect(hash).not.toContain(token);
  });

  it("sets a secure, HTTP-only production session cookie", () => {
    const request = new Request("https://harbor-home.netlify.app/api/auth/verify-code");
    const cookie = sessionCookie(request, "abc123", 3600);
    expect(cookie).toContain("hh_session=abc123");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("Max-Age=3600");
    expect(cookie).toContain("Expires=");
    expect(cookie).toContain("Priority=High");
  });

  it("keeps a returning user signed in for thirty days", () => {
    const now = new Date("2026-07-14T12:00:00.000Z");
    expect(newSessionExpiresAt(now).toISOString()).toBe("2026-08-13T12:00:00.000Z");
    expect(sessionCookie(new Request("https://harborandhome.netlify.app"), "abc123", 3600, now))
      .toContain("Expires=Tue, 14 Jul 2026 13:00:00 GMT");
  });

  it("clears sessions and safely parses cookie values", () => {
    const request = new Request("http://localhost/api/auth/sign-out", { headers: { cookie: "theme=sea; hh_session=hello%20world" } });
    expect(readCookie(request, "hh_session")).toBe("hello world");
    expect(clearSessionCookie(request)).toContain("Max-Age=0");
    expect(clearSessionCookie(request)).toContain("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
    expect(readCookie(new Request("http://localhost", { headers: { cookie: "hh_session=%ZZ" } }), "hh_session")).toBeUndefined();
  });

  it("accepts the grouped format Google shows for app passwords", () => {
    expect(normalizeGmailAppPassword("abcd efgh ijkl mnop")).toBe("abcdefghijklmnop");
    expect(normalizeGmailAppPassword("abcd\nefgh\tijkl mnop")).toBe("abcdefghijklmnop");
  });

  it("turns Gmail authentication failures into a useful, non-secret error", () => {
    const error = { code: "EAUTH", responseCode: 535, command: "AUTH PLAIN", response: "sensitive provider detail" };
    expect(emailDeliveryDiagnostic(error)).toEqual({ code: "EAUTH", responseCode: "535", command: "AUTH PLAIN" });
    expect(emailDeliveryErrorMessage(error)).toContain("new 16-character Google app password");
    expect(emailDeliveryErrorMessage(error)).not.toContain("sensitive provider detail");
  });

  it("derives host access only from configured host email addresses", () => {
    vi.stubEnv("ADMIN_EMAILS", "sam@example.test,lisa@example.test");

    expect(isAdminEmail(" Sam@EXAMPLE.test ")).toBe(true);
    expect(roleForEmail("lisa@example.test")).toBe("admin");
    expect(roleForEmail("friend@example.com")).toBe("guest");
  });

  it("rejects a forged database admin role for an email outside the host allowlist", () => {
    vi.stubEnv("ADMIN_EMAILS", "sam@example.test,lisa@example.test");
    const outsider: AppUser = {
      id: "outsider",
      email: "friend@example.com",
      name: "Friend",
      role: "admin",
      status: "active",
      relationship: "Friend",
    };

    expect(() => requireAdmin(outsider)).toThrow(Response);
    expect(() => requireAdmin({ ...outsider, email: "sam@example.test" })).not.toThrow();
  });
});
