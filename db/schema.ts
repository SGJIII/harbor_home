import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const accessStatus = pgEnum("access_status", ["pending", "active", "suspended"]);
export const appRole = pgEnum("app_role", ["admin", "guest"]);
export const publishStatus = pgEnum("publish_status", ["draft", "active"]);
export const bookingStatus = pgEnum("booking_status", ["confirmed", "moved", "cancelled"]);
export const eventStatus = pgEnum("event_status", ["draft", "published", "cancelled"]);
export const rsvpStatus = pgEnum("rsvp_status", ["attending", "not-attending"]);

export const profiles = pgTable("profiles", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  relationship: text("relationship").notNull().default(""),
  status: accessStatus("status").notNull().default("pending"),
  role: appRole("role").notNull().default("guest"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("profiles_email_uq").on(table.email)]);

export const loginCodes = pgTable("login_codes", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull(),
  codeHash: text("code_hash").notNull(),
  requestIpHash: text("request_ip_hash").notNull(),
  attempts: integer("attempts").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("login_codes_email_created_idx").on(table.email, table.createdAt)]);

export const appSessions = pgTable("app_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  profileId: text("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("app_sessions_token_hash_uq").on(table.tokenHash),
  index("app_sessions_profile_idx").on(table.profileId, table.expiresAt),
]);

export const categories = pgTable("categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  color: text("color").notNull().default("sea"),
}, (table) => [uniqueIndex("categories_slug_uq").on(table.slug)]);

export const profileCategories = pgTable("profile_categories", {
  profileId: text("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  categoryId: uuid("category_id").notNull().references(() => categories.id, { onDelete: "cascade" }),
}, (table) => [primaryKey({ columns: [table.profileId, table.categoryId] })]);

export const properties = pgTable("properties", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  eyebrow: text("eyebrow").notNull().default(""),
  generalLocation: text("general_location").notNull().default(""),
  address: text("address").notNull().default(""),
  timezone: text("timezone").notNull().default("America/New_York"),
  summary: text("summary").notNull().default(""),
  sourceLinks: jsonb("source_links").notNull().$type<Array<{ label: string; url: string; type: string }>>().default([]),
  imageKeys: jsonb("image_keys").notNull().$type<string[]>().default([]),
  status: publishStatus("status").notNull().default("draft"),
  accent: text("accent").notNull().default("ocean"),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("properties_slug_uq").on(table.slug)]);

export const rooms = pgTable("rooms", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id").notNull().references(() => properties.id, { onDelete: "cascade" }),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  bed: text("bed").notNull().default(""),
  capacity: integer("capacity"),
  bathroom: text("bathroom").notNull().default(""),
  amenities: jsonb("amenities").notNull().$type<string[]>().default([]),
  status: publishStatus("status").notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("rooms_property_slug_uq").on(table.propertyId, table.slug),
  index("rooms_property_idx").on(table.propertyId),
]);

export const propertyPriorities = pgTable("property_priorities", {
  propertyId: uuid("property_id").notNull().references(() => properties.id, { onDelete: "cascade" }),
  categoryId: uuid("category_id").notNull().references(() => categories.id, { onDelete: "cascade" }),
  rank: integer("rank").notNull().default(0),
}, (table) => [primaryKey({ columns: [table.propertyId, table.categoryId] })]);

export const roomFallbacks = pgTable("room_fallbacks", {
  sourceRoomId: uuid("source_room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
  fallbackRoomId: uuid("fallback_room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
}, (table) => [
  primaryKey({ columns: [table.sourceRoomId, table.fallbackRoomId] }),
  uniqueIndex("room_fallback_position_uq").on(table.sourceRoomId, table.position),
]);

export const availabilityBlocks = pgTable("availability_blocks", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id").notNull().references(() => properties.id, { onDelete: "cascade" }),
  checkIn: date("check_in").notNull(),
  checkOut: date("check_out").notNull(),
  reason: text("reason").notNull(),
  createdBy: text("created_by").references(() => profiles.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("blocks_property_dates_idx").on(table.propertyId, table.checkIn, table.checkOut)]);

export const blockCategories = pgTable("block_categories", {
  blockId: uuid("block_id").notNull().references(() => availabilityBlocks.id, { onDelete: "cascade" }),
  categoryId: uuid("category_id").notNull().references(() => categories.id, { onDelete: "cascade" }),
}, (table) => [primaryKey({ columns: [table.blockId, table.categoryId] })]);

export const events = pgTable("events", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull(),
  propertyId: uuid("property_id").notNull().references(() => properties.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  checkIn: date("check_in").notNull(),
  checkOut: date("check_out").notNull(),
  status: eventStatus("status").notNull().default("draft"),
  createdBy: text("created_by").references(() => profiles.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("events_slug_uq").on(table.slug)]);

export const eventRooms = pgTable("event_rooms", {
  eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  roomId: uuid("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
}, (table) => [primaryKey({ columns: [table.eventId, table.roomId] })]);

export const eventInvites = pgTable("event_invites", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("event_invites_token_hash_uq").on(table.tokenHash)]);

export const eventAccess = pgTable("event_access", {
  eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  profileId: text("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [primaryKey({ columns: [table.eventId, table.profileId] })]);

export const eventRsvps = pgTable("event_rsvps", {
  eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  profileId: text("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  status: rsvpStatus("status").notNull(),
  partySize: integer("party_size").notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [primaryKey({ columns: [table.eventId, table.profileId] })]);

export const bookings = pgTable("bookings", {
  id: uuid("id").defaultRandom().primaryKey(),
  profileId: text("profile_id").notNull().references(() => profiles.id, { onDelete: "restrict" }),
  propertyId: uuid("property_id").notNull().references(() => properties.id, { onDelete: "restrict" }),
  roomId: uuid("room_id").notNull().references(() => rooms.id, { onDelete: "restrict" }),
  eventId: uuid("event_id").references(() => events.id, { onDelete: "set null" }),
  checkIn: date("check_in").notNull(),
  checkOut: date("check_out").notNull(),
  partySize: integer("party_size").notNull(),
  status: bookingStatus("status").notNull().default("confirmed"),
  movedFromRoomId: uuid("moved_from_room_id").references(() => rooms.id),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("bookings_room_dates_idx").on(table.roomId, table.checkIn, table.checkOut),
  index("bookings_profile_dates_idx").on(table.profileId, table.checkIn, table.checkOut),
]);

export const eventRsvpRooms = pgTable("event_rsvp_rooms", {
  eventId: uuid("event_id").notNull(),
  profileId: text("profile_id").notNull(),
  roomId: uuid("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
}, (table) => [
  primaryKey({ columns: [table.eventId, table.profileId, table.roomId] }),
]);

export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  profileId: text("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  message: text("message").notNull(),
  kind: text("kind").notNull(),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("notifications_profile_idx").on(table.profileId, table.createdAt)]);

export const auditLog = pgTable("audit_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorId: text("actor_id").references(() => profiles.id),
  action: text("action").notNull(),
  subjectType: text("subject_type").notNull(),
  subjectId: text("subject_id"),
  detail: jsonb("detail").notNull().$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("audit_created_idx").on(table.createdAt)]);

export const emailOutbox = pgTable("email_outbox", {
  id: uuid("id").defaultRandom().primaryKey(),
  recipient: text("recipient").notNull(),
  subject: text("subject").notNull(),
  textBody: text("text_body").notNull(),
  attempts: integer("attempts").notNull().default(0),
  nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const adminAlerts = pgTable("admin_alerts", {
  id: uuid("id").defaultRandom().primaryKey(),
  kind: text("kind").notNull(),
  message: text("message").notNull(),
  detail: jsonb("detail").notNull().$type<Record<string, unknown>>().default({}),
  resolved: boolean("resolved").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
