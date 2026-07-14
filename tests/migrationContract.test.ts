import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../drizzle/0001_family_booking.sql", import.meta.url), "utf8");
const authMigration = readFileSync(new URL("../drizzle/0002_email_code_auth.sql", import.meta.url), "utf8");

describe("database booking contract", () => {
  it("uses checkout-exclusive exclusion constraints", () => {
    expect(migration).toContain("daterange(check_in, check_out, '[)')");
    expect(migration).toContain("no_overlapping_confirmed_room_bookings");
  });

  it("keeps blackout checks before priority movement", () => {
    expect(migration.indexOf("A category blackout applies")).toBeLessThan(migration.indexOf("booking_move_plan"));
  });

  it("plans all moves before applying them", () => {
    expect(migration.indexOf("INSERT INTO booking_move_plan")).toBeLessThan(migration.indexOf("UPDATE bookings b SET"));
    expect(migration).toContain("nobody was moved. The hosts were alerted");
  });

  it("never makes the living-room couch an ADU fallback", () => {
    const fallbackSeed = migration.slice(migration.lastIndexOf("INSERT INTO room_fallbacks"));
    expect(fallbackSeed).not.toContain("30000000-0000-4000-8000-000000000004");
  });

  it("verifies one-time codes and creates hashed application sessions atomically", () => {
    const verification = authMigration.slice(authMigration.indexOf("CREATE OR REPLACE FUNCTION verify_email_login"));
    expect(verification).toContain("FOR UPDATE");
    expect(verification).toContain("attempts >= 5");
    expect(verification).toContain("SET consumed_at = now()");
    expect(verification.indexOf("SET consumed_at = now()")).toBeLessThan(verification.indexOf("INSERT INTO app_sessions"));
    expect(authMigration).toContain("token_hash text NOT NULL UNIQUE");
  });
});
