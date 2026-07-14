import type { AppState } from "../types";
import { isoDateOffset } from "../lib/bookingRules";

const nextFriday = (() => {
  const today = new Date();
  const days = (5 - today.getDay() + 7) % 7 || 7;
  return isoDateOffset(days);
})();

const followingMonday = (() => {
  const start = new Date(`${nextFriday}T12:00:00`);
  start.setDate(start.getDate() + 3);
  return start.toISOString().slice(0, 10);
})();

export const demoState: AppState = {
  categories: [
    { id: "parent", name: "Parent", color: "sand", description: "Parents of Sam or Lisa" },
    { id: "mom", name: "Mom", color: "coral", description: "Sam's mom or Lisa's mom" },
    { id: "family", name: "Family", color: "sea", description: "Extended family" },
    { id: "friend", name: "Friend", color: "sage", description: "Friends and chosen family" },
  ],
  profiles: [
    {
      id: "sam",
      name: "Sam",
      email: "sam@example.com",
      relationship: "Host",
      status: "active",
      role: "admin",
      categoryIds: ["family"],
    },
    {
      id: "lisa",
      name: "Lisa",
      email: "lisa@example.com",
      relationship: "Host",
      status: "active",
      role: "admin",
      categoryIds: ["family"],
    },
    {
      id: "mom-1",
      name: "Sam's mom",
      email: "mom@example.com",
      relationship: "Sam's mom",
      status: "active",
      role: "guest",
      categoryIds: ["parent", "mom", "family"],
    },
    {
      id: "maya",
      name: "Maya Chen",
      email: "maya@example.com",
      relationship: "Friend of Lisa",
      status: "active",
      role: "guest",
      categoryIds: ["friend"],
    },
    {
      id: "jordan",
      name: "Jordan Rivera",
      email: "jordan@example.com",
      relationship: "Sam's cousin",
      status: "pending",
      role: "guest",
      categoryIds: [],
    },
  ],
  properties: [
    {
      id: "rockaway",
      slug: "rockaway-house",
      name: "Rockaway House",
      eyebrow: "BEACH HOME · QUEENS, NY",
      generalLocation: "Far Rockaway, Queens",
      address: "6319 Ocean Ave S, Far Rockaway, NY 11692",
      timezone: "America/New_York",
      availableFrom: "2027-06-01",
      availableUntil: null,
      summary: "A bright beachside home with room for the whole crew, steps from the ocean and boardwalk.",
      sourceLinks: [
        {
          label: "View Zillow details",
          url: "https://www.zillow.com/homedetails/6319-Ocean-Ave-S-Far-Rockaway-NY-11692/122027290_zpid/",
          type: "zillow",
        },
      ],
      roomIds: ["adu", "downstairs", "second-spare", "living-couch"],
      status: "active",
      accent: "ocean",
    },
    {
      id: "luna",
      slug: "second-getaway",
      name: "Luna",
      eyebrow: "PLAYA PELADA · FEB–MAY 2027",
      generalLocation: "Playa Pelada, Nosara, Costa Rica",
      address: "Playa Pelada, Provincia de Guanacaste, Costa Rica",
      timezone: "America/Costa_Rica",
      availableFrom: "2027-02-15",
      availableUntil: "2027-05-02",
      summary: "An ocean-view villa near Playa Pelada with an infinity pool, two family-bookable rooms, and a third room reserved for the hosts.",
      sourceLinks: [
        {
          label: "View Airbnb listing",
          url: "https://www.airbnb.com/rooms/54020123",
          type: "airbnb",
        },
      ],
      roomIds: ["queen-loft", "lower-king"],
      status: "active",
      accent: "dune",
    },
  ],
  rooms: [
    {
      id: "adu",
      propertyId: "rockaway",
      name: "Rockaway ADU",
      description: "A private one-bedroom hideaway with its own bath and a pullout couch.",
      bed: "1 bedroom + pullout couch",
      capacity: 4,
      bathroom: "Private full bath",
      amenities: ["Private entrance", "Sleeps four", "Full bath"],
      fallbackIds: ["downstairs", "second-spare"],
      status: "active",
    },
    {
      id: "downstairs",
      propertyId: "rockaway",
      name: "Downstairs guest room",
      description: "A quiet main-house room with a full bathroom immediately next door.",
      bed: "King bed",
      capacity: 2,
      bathroom: "Full bath next door",
      amenities: ["King bed", "Main house", "Full bath next door"],
      fallbackIds: [],
      status: "active",
    },
    {
      id: "second-spare",
      propertyId: "rockaway",
      name: "Fourth-floor queen room",
      description: "A private queen bedroom on the fourth floor of the main house.",
      bed: "Queen bed",
      capacity: 2,
      bathroom: "Shared bath",
      amenities: ["Queen bed", "Main house", "Fourth floor"],
      fallbackIds: [],
      status: "active",
    },
    {
      id: "living-couch",
      propertyId: "rockaway",
      name: "Main house couch",
      description: "A non-foldout living-room couch best for kids or an easy late-night crash pad.",
      bed: "Non-foldout living-room couch",
      capacity: 3,
      bathroom: "Shared bath",
      amenities: ["Shared space", "Best for kids", "Does not fold out"],
      fallbackIds: [],
      status: "active",
    },
    {
      id: "queen-loft",
      propertyId: "luna",
      name: "Queen loft",
      description: "An airy queen-bed loft with access to the main-floor full bathroom.",
      bed: "Queen bed",
      capacity: 2,
      bathroom: "Shared main-floor full bath",
      amenities: ["Loft", "Queen bed", "Ocean-view villa", "Shared pool"],
      fallbackIds: [],
      status: "active",
    },
    {
      id: "lower-king",
      propertyId: "luna",
      name: "Lower-level king room",
      description: "A king bedroom below the main floor, sharing the downstairs full bathroom.",
      bed: "King bed",
      capacity: 2,
      bathroom: "Shared downstairs full bath",
      amenities: ["King bed", "Lower level", "Ocean-view villa", "Shared pool"],
      fallbackIds: [],
      status: "active",
    },
  ],
  bookings: [
    {
      id: "booking-maya",
      userId: "maya",
      propertyId: "rockaway",
      roomId: "adu",
      checkIn: nextFriday,
      checkOut: followingMonday,
      partySize: 2,
      status: "confirmed",
      createdAt: new Date().toISOString(),
    },
  ],
  blocks: [
    {
      id: "block-parents",
      propertyId: "rockaway",
      checkIn: isoDateOffset(35),
      checkOut: isoDateOffset(42),
      categoryIds: ["parent"],
      reason: "No parents week",
    },
  ],
  priorityRules: [
    { id: "rockaway-mom", propertyId: "rockaway", categoryId: "mom", rank: 100 },
    { id: "rockaway-family", propertyId: "rockaway", categoryId: "family", rank: 20 },
    { id: "rockaway-friend", propertyId: "rockaway", categoryId: "friend", rank: 10 },
  ],
  events: [
    {
      id: "summer-supper",
      slug: "summer-supper",
      propertyId: "rockaway",
      title: "Rockaway Summer Supper",
      description: "Beach afternoon, a long-table dinner, and an easy morning together.",
      checkIn: isoDateOffset(56),
      checkOut: isoDateOffset(58),
      roomIds: ["adu"],
      status: "published",
      inviteToken: "demo-summer-2026",
      rsvps: [],
    },
  ],
  notifications: [
    {
      id: "welcome-note",
      userId: "sam",
      title: "Rockaway is ready",
      message: "The ADU is published. Complete the main-house room details to make them bookable.",
      kind: "admin",
      read: false,
      createdAt: new Date().toISOString(),
    },
  ],
  audit: [
    {
      id: "audit-1",
      action: "Property published",
      actorName: "Sam",
      detail: "Rockaway House and the ADU are visible to approved guests.",
      createdAt: new Date().toISOString(),
    },
    {
      id: "audit-2",
      action: "Booking confirmed",
      actorName: "Maya Chen",
      detail: "Rockaway ADU reserved for the upcoming weekend.",
      createdAt: new Date().toISOString(),
    },
  ],
};

export const demoWeekend = { checkIn: nextFriday, checkOut: followingMonday };
