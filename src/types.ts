export type AccessStatus = "pending" | "active" | "suspended";
export type BookingStatus = "confirmed" | "moved" | "cancelled";

export interface Category {
  id: string;
  name: string;
  color: string;
  description: string;
}

export interface Profile {
  id: string;
  name: string;
  email: string;
  relationship: string;
  status: AccessStatus;
  role: "admin" | "guest";
  categoryIds: string[];
}

export interface SourceLink {
  label: string;
  url: string;
  type: "zillow" | "airbnb" | "other";
}

export interface Room {
  id: string;
  propertyId: string;
  name: string;
  description: string;
  bed: string;
  capacity: number | null;
  bathroom: string;
  amenities: string[];
  fallbackIds: string[];
  status: "active" | "draft";
}

export interface Property {
  id: string;
  slug: string;
  name: string;
  eyebrow: string;
  generalLocation: string;
  address: string;
  timezone: string;
  summary: string;
  sourceLinks: SourceLink[];
  roomIds: string[];
  status: "active" | "draft";
  accent: "ocean" | "dune";
}

export interface Booking {
  id: string;
  userId: string;
  propertyId: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  partySize: number;
  status: BookingStatus;
  eventId?: string;
  movedFromRoomId?: string;
  createdAt: string;
}

export interface AvailabilityBlock {
  id: string;
  propertyId: string;
  checkIn: string;
  checkOut: string;
  categoryIds: string[];
  reason: string;
}

export interface PriorityRule {
  id: string;
  propertyId: string;
  categoryId: string;
  rank: number;
}

export interface PartyRsvp {
  userId: string;
  status: "attending" | "not-attending";
  partySize: number;
  roomIds: string[];
}

export interface PartyEvent {
  id: string;
  slug: string;
  propertyId: string;
  title: string;
  description: string;
  checkIn: string;
  checkOut: string;
  roomIds: string[];
  status: "draft" | "published";
  inviteToken: string;
  rsvps: PartyRsvp[];
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  kind: "booking" | "move" | "event" | "admin";
  read: boolean;
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  action: string;
  actorName: string;
  detail: string;
  createdAt: string;
}

export interface AppState {
  categories: Category[];
  profiles: Profile[];
  properties: Property[];
  rooms: Room[];
  bookings: Booking[];
  blocks: AvailabilityBlock[];
  priorityRules: PriorityRule[];
  events: PartyEvent[];
  notifications: AppNotification[];
  audit: AuditEntry[];
}

export interface DateRange {
  checkIn: string;
  checkOut: string;
}
