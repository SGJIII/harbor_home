import { describe, expect, it } from "vitest";
import {
  contiguousStayLength,
  findFirstFallback,
  formatAvailabilityWindow,
  isProfileBlocked,
  nightsBetween,
  rangesOverlap,
  reservedRoomCount,
  roomConflicts,
  propertyAvailabilityError,
  validateStayRange,
} from "../src/lib/bookingRules";
import type { AvailabilityBlock, Booking, Profile, Property, Room } from "../src/types";

const profile: Profile = { id: "mom", name: "A Mom", email: "mom@example.com", relationship: "Mom", status: "active", role: "guest", categoryIds: ["mom", "parent"] };
const booking = (overrides: Partial<Booking> = {}): Booking => ({ id: crypto.randomUUID(), userId: "guest", propertyId: "rockaway", roomId: "adu", checkIn: "2026-08-01", checkOut: "2026-08-04", partySize: 2, status: "confirmed", createdAt: "2026-07-01T00:00:00Z", ...overrides });
const room = (overrides: Partial<Room>): Room => ({ id: "room", propertyId: "rockaway", name: "Room", description: "", bed: "Queen", capacity: 2, bathroom: "Shared", amenities: [], fallbackIds: [], status: "active", ...overrides });
const property = (overrides: Partial<Property> = {}): Property => ({ id: "property", slug: "property", name: "Property", eyebrow: "", generalLocation: "", address: "", timezone: "America/New_York", availableFrom: null, availableUntil: null, summary: "", sourceLinks: [], roomIds: [], status: "active", accent: "ocean", ...overrides });

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

  it("counts anonymous occupied rooms for the selected property and dates", () => {
    const bookings = [
      booking({ roomId: "adu" }),
      booking({ id: crypto.randomUUID(), roomId: "downstairs" }),
      booking({ id: crypto.randomUUID(), roomId: "elsewhere", propertyId: "other" }),
      booking({ id: crypto.randomUUID(), roomId: "later", checkIn: "2026-08-04", checkOut: "2026-08-06" }),
    ];
    expect(reservedRoomCount("rockaway", { checkIn: "2026-08-01", checkOut: "2026-08-04" }, bookings)).toBe(2);
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

describe("property booking windows", () => {
  it("allows stays fully inside a finite rental window", () => {
    const rental = property({ availableFrom: "2027-02-15", availableUntil: "2027-05-02" });
    expect(propertyAvailabilityError(rental, { checkIn: "2027-02-15", checkOut: "2027-02-22" })).toBeNull();
    expect(propertyAvailabilityError(rental, { checkIn: "2027-04-29", checkOut: "2027-05-02" })).toBeNull();
  });

  it("rejects stays that cross either property boundary", () => {
    const rental = property({ availableFrom: "2027-02-15", availableUntil: "2027-05-02" });
    expect(propertyAvailabilityError(rental, { checkIn: "2027-02-14", checkOut: "2027-02-16" })).toMatch(/Feb 15/);
    expect(propertyAvailabilityError(rental, { checkIn: "2027-05-01", checkOut: "2027-05-03" })).toMatch(/May 2/);
  });

  it("supports an open-ended readiness date", () => {
    const rockaway = property({ availableFrom: "2027-06-01" });
    expect(formatAvailabilityWindow(rockaway)).toBe("Available beginning Jun 1, 2027");
    expect(propertyAvailabilityError(rockaway, { checkIn: "2027-05-31", checkOut: "2027-06-02" })).not.toBeNull();
    expect(propertyAvailabilityError(rockaway, { checkIn: "2027-06-01", checkOut: "2027-06-03" })).toBeNull();
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
