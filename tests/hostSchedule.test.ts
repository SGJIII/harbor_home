import { describe, expect, it } from "vitest";
import { hostScheduleBookings, stayPhase } from "../src/lib/hostSchedule";
import type { Booking } from "../src/types";

const booking = (overrides: Partial<Booking> = {}): Booking => ({
  id: crypto.randomUUID(),
  userId: "guest",
  propertyId: "rockaway",
  roomId: "adu",
  checkIn: "2027-06-10",
  checkOut: "2027-06-13",
  partySize: 2,
  status: "confirmed",
  createdAt: "2027-01-01T00:00:00Z",
  ...overrides,
});

describe("host occupancy schedule", () => {
  it("shows current and future confirmed stays in chronological order", () => {
    const stays = hostScheduleBookings([
      booking({ id: "future", checkIn: "2027-06-20", checkOut: "2027-06-22" }),
      booking({ id: "current", checkIn: "2027-06-08", checkOut: "2027-06-12" }),
      booking({ id: "cancelled", status: "cancelled" }),
      booking({ id: "past", checkIn: "2027-05-01", checkOut: "2027-05-03" }),
    ], { propertyId: "all", timing: "upcoming", today: "2027-06-10" });

    expect(stays.map((stay) => stay.id)).toEqual(["current", "future"]);
  });

  it("filters the schedule by property and past stays", () => {
    const stays = hostScheduleBookings([
      booking({ id: "rockaway-past", checkIn: "2027-05-01", checkOut: "2027-05-03" }),
      booking({ id: "luna-past", propertyId: "luna", checkIn: "2027-04-01", checkOut: "2027-04-03" }),
      booking({ id: "luna-future", propertyId: "luna" }),
    ], { propertyId: "luna", timing: "past", today: "2027-06-10" });

    expect(stays.map((stay) => stay.id)).toEqual(["luna-past"]);
  });

  it("labels checkout as past because checkout is not an occupied night", () => {
    const stay = booking({ checkIn: "2027-06-08", checkOut: "2027-06-10" });
    expect(stayPhase(stay, "2027-06-09")).toBe("in-house");
    expect(stayPhase(stay, "2027-06-10")).toBe("past");
  });
});
