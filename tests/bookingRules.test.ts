import { describe, expect, it } from "vitest";
import {
  contiguousStayLength,
  findFirstFallback,
  isProfileBlocked,
  nightsBetween,
  rangesOverlap,
  roomConflicts,
  validateStayRange,
} from "../src/lib/bookingRules";
import type { AvailabilityBlock, Booking, Profile, Room } from "../src/types";

const profile: Profile = { id: "mom", name: "A Mom", email: "mom@example.com", relationship: "Mom", status: "active", role: "guest", categoryIds: ["mom", "parent"] };
const booking = (overrides: Partial<Booking> = {}): Booking => ({ id: crypto.randomUUID(), userId: "guest", propertyId: "rockaway", roomId: "adu", checkIn: "2026-08-01", checkOut: "2026-08-04", partySize: 2, status: "confirmed", createdAt: "2026-07-01T00:00:00Z", ...overrides });
const room = (overrides: Partial<Room>): Room => ({ id: "room", propertyId: "rockaway", name: "Room", description: "", bed: "Queen", capacity: 2, bathroom: "Shared", amenities: [], fallbackIds: [], status: "active", ...overrides });

describe("date occupancy", () => {
  it("excludes checkout from conflicts", () => {
    expect(rangesOverlap({ checkIn: "2026-08-01", checkOut: "2026-08-04" }, { checkIn: "2026-08-04", checkOut: "2026-08-06" })).toBe(false);
    expect(roomConflicts("adu", { checkIn: "2026-08-04", checkOut: "2026-08-06" }, [booking()])).toHaveLength(0);
  });

  it("validates one through seven nights", () => {
    expect(nightsBetween("2026-08-01", "2026-08-08")).toBe(7);
    expect(validateStayRange({ checkIn: "2026-08-01", checkOut: "2026-08-08" })).toBeNull();
    expect(validateStayRange({ checkIn: "2026-08-01", checkOut: "2026-08-09" })).toMatch(/seven/);
  });

  it("aggregates adjacent and overlapping reservations", () => {
    const existing = [booking({ checkIn: "2026-08-01", checkOut: "2026-08-04" }), booking({ roomId: "downstairs", checkIn: "2026-08-04", checkOut: "2026-08-06" })];
    expect(contiguousStayLength(existing, { checkIn: "2026-08-06", checkOut: "2026-08-08" })).toBe(7);
    expect(contiguousStayLength(existing, { checkIn: "2026-08-06", checkOut: "2026-08-09" })).toBe(8);
  });
});

describe("categories and blackouts", () => {
  it("blocks a mom through parent membership", () => {
    const blocks: AvailabilityBlock[] = [{ id: "no-parents", propertyId: "rockaway", checkIn: "2026-08-01", checkOut: "2026-08-08", categoryIds: ["parent"], reason: "No parents week" }];
    expect(isProfileBlocked(profile, "rockaway", { checkIn: "2026-08-03", checkOut: "2026-08-05" }, blocks)?.reason).toBe("No parents week");
  });

  it("does not apply unrelated property blocks", () => {
    const blocks: AvailabilityBlock[] = [{ id: "no-parents", propertyId: "other", checkIn: "2026-08-01", checkOut: "2026-08-08", categoryIds: ["parent"], reason: "No parents week" }];
    expect(isProfileBlocked(profile, "rockaway", { checkIn: "2026-08-03", checkOut: "2026-08-05" }, blocks)).toBeUndefined();
  });
});

describe("ordered fallback rooms", () => {
  const source = room({ id: "adu", capacity: 4, fallbackIds: ["first", "second"] });
  const first = room({ id: "first", capacity: 1 });
  const second = room({ id: "second", capacity: 3 });

  it("skips an undersized fallback and keeps configured order", () => {
    expect(findFirstFallback(source, booking({ partySize: 2 }), [source, first, second], [])?.id).toBe("second");
  });

  it("skips occupied and already allocated fallbacks", () => {
    const occupied = booking({ roomId: "first", partySize: 1 });
    expect(findFirstFallback(source, booking({ partySize: 1 }), [source, first, second], [occupied])?.id).toBe("second");
    expect(findFirstFallback(source, booking({ partySize: 1 }), [source, first, second], [], ["first"])?.id).toBe("second");
  });

  it("never invents an unconfigured couch fallback", () => {
    const couch = room({ id: "couch", capacity: 2 });
    expect(findFirstFallback(source, booking({ partySize: 4 }), [source, first, second, couch], [])).toBeUndefined();
  });
});
