import type {
  AvailabilityBlock,
  Booking,
  DateRange,
  Profile,
  Room,
} from "../types";

const dayMs = 86_400_000;

export function dateOnly(value: string): number {
  return Date.parse(`${value}T00:00:00Z`);
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  return Math.round((dateOnly(checkOut) - dateOnly(checkIn)) / dayMs);
}

export function rangesOverlap(a: DateRange, b: DateRange): boolean {
  return dateOnly(a.checkIn) < dateOnly(b.checkOut) && dateOnly(b.checkIn) < dateOnly(a.checkOut);
}

export function rangesTouchOrOverlap(a: DateRange, b: DateRange): boolean {
  return dateOnly(a.checkIn) <= dateOnly(b.checkOut) && dateOnly(b.checkIn) <= dateOnly(a.checkOut);
}

export function validateStayRange(range: DateRange): string | null {
  const nights = nightsBetween(range.checkIn, range.checkOut);
  if (!range.checkIn || !range.checkOut || Number.isNaN(nights)) return "Choose check-in and check-out dates.";
  if (nights < 1) return "Check-out must be after check-in.";
  if (nights > 7) return "Stays are limited to seven nights.";
  return null;
}

export function contiguousStayLength(existing: Booking[], next: DateRange): number {
  let start = dateOnly(next.checkIn);
  let end = dateOnly(next.checkOut);
  let changed = true;

  while (changed) {
    changed = false;
    for (const booking of existing.filter((item) => item.status === "confirmed" && !item.eventId)) {
      const candidate = { checkIn: booking.checkIn, checkOut: booking.checkOut };
      const current = {
        checkIn: new Date(start).toISOString().slice(0, 10),
        checkOut: new Date(end).toISOString().slice(0, 10),
      };
      if (!rangesTouchOrOverlap(current, candidate)) continue;
      const nextStart = Math.min(start, dateOnly(candidate.checkIn));
      const nextEnd = Math.max(end, dateOnly(candidate.checkOut));
      if (nextStart !== start || nextEnd !== end) {
        start = nextStart;
        end = nextEnd;
        changed = true;
      }
    }
  }

  return Math.round((end - start) / dayMs);
}

export function isProfileBlocked(
  profile: Profile,
  propertyId: string,
  range: DateRange,
  blocks: AvailabilityBlock[],
): AvailabilityBlock | undefined {
  return blocks.find(
    (block) =>
      block.propertyId === propertyId &&
      rangesOverlap(block, range) &&
      block.categoryIds.some((categoryId) => profile.categoryIds.includes(categoryId)),
  );
}

export function roomConflicts(roomId: string, range: DateRange, bookings: Booking[]): Booking[] {
  return bookings.filter(
    (booking) =>
      booking.roomId === roomId &&
      booking.status === "confirmed" &&
      rangesOverlap(booking, range),
  );
}

export function findFirstFallback(
  sourceRoom: Room,
  displaced: Booking,
  rooms: Room[],
  bookings: Booking[],
  reservedRoomIds: string[] = [],
): Room | undefined {
  return sourceRoom.fallbackIds
    .map((id) => rooms.find((room) => room.id === id))
    .find(
      (room): room is Room =>
        Boolean(room) &&
        room?.status === "active" &&
        room.capacity !== null &&
        room.capacity >= displaced.partySize &&
        !reservedRoomIds.includes(room.id) &&
        roomConflicts(room.id, displaced, bookings).length === 0,
    );
}

export function formatDateRange(checkIn: string, checkOut: string): string {
  const format = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
  return `${format.format(new Date(`${checkIn}T12:00:00`))} – ${format.format(new Date(`${checkOut}T12:00:00`))}`;
}

export function isoDateOffset(daysFromToday: number): string {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + daysFromToday);
  return date.toISOString().slice(0, 10);
}
