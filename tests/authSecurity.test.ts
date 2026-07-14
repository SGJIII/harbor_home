import { describe, expect, it } from "vitest";
import {
  clearSessionCookie,
  loginCodeHash,
  normalizeEmail,
  readCookie,
  sessionCookie,
  sessionTokenHash,
} from "../netlify/functions/lib/auth.mts";
import { normalizeGmailAppPassword } from "../netlify/functions/lib/email.mts";

const secret = "test-secret-that-is-longer-than-thirty-two-characters";

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
  });

  it("clears sessions and safely parses cookie values", () => {
    const request = new Request("http://localhost/api/auth/sign-out", { headers: { cookie: "theme=sea; hh_session=hello%20world" } });
    expect(readCookie(request, "hh_session")).toBe("hello world");
    expect(clearSessionCookie(request)).toContain("Max-Age=0");
    expect(readCookie(new Request("http://localhost", { headers: { cookie: "hh_session=%ZZ" } }), "hh_session")).toBeUndefined();
  });

  it("accepts the grouped format Google shows for app passwords", () => {
    expect(normalizeGmailAppPassword("abcd efgh ijkl mnop")).toBe("abcdefghijklmnop");
    expect(normalizeGmailAppPassword("abcd\nefgh\tijkl mnop")).toBe("abcdefghijklmnop");
  });
});
