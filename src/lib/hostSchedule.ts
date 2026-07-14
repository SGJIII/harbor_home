import type { Booking } from "../types";

export type StayTiming = "upcoming" | "past" | "all";
export type StayPhase = "in-house" | "upcoming" | "past";

export interface HostScheduleFilters {
  propertyId: string;
  timing: StayTiming;
  today: string;
}

export function stayPhase(booking: Booking, today: string): StayPhase {
  if (booking.checkIn <= today && booking.checkOut > today) return "in-house";
  return booking.checkIn > today ? "upcoming" : "past";
}

export function hostScheduleBookings(bookings: Booking[], filters: HostScheduleFilters): Booking[] {
  return bookings
    .filter((booking) => booking.status === "confirmed")
    .filter((booking) => filters.propertyId === "all" || booking.propertyId === filters.propertyId)
    .filter((booking) => {
      if (filters.timing === "all") return true;
      if (filters.timing === "past") return booking.checkOut <= filters.today;
      return booking.checkOut > filters.today;
    })
    .sort((left, right) => left.checkIn.localeCompare(right.checkIn)
      || left.checkOut.localeCompare(right.checkOut)
      || left.propertyId.localeCompare(right.propertyId)
      || left.roomId.localeCompare(right.roomId));
}
