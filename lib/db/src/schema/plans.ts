import { pgTable, serial, text, timestamp, jsonb, integer, real, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const PLAN_STATUSES = ["planning", "booked", "ongoing", "completed", "wishlist"] as const;
export type PlanStatus = typeof PLAN_STATUSES[number];

export const plansTable = pgTable("plans", {
  id: serial("id").primaryKey(),
  shareCode: text("share_code").notNull().unique(),
  userId: integer("user_id").references(() => usersTable.id, {
    onDelete: "set null",
  }),
  city: text("city").notNull(),
  country: text("country").notNull(),
  lat: real("lat"),
  lng: real("lng"),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  budget: text("budget"),
  preferences: text("preferences"),
  travellerType: text("traveller_type").notNull(),
  tripSummary: text("trip_summary").notNull(),
  photoUrl: text("photo_url").notNull(),
  planData: jsonb("plan_data").notNull(),
  customName: text("custom_name"),
  tripNotes: text("trip_notes"),
  dayOrder: jsonb("day_order"),
  status: text("status").default("planning"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const destinationNotesTable = pgTable("destination_notes", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id").notNull().references(() => plansTable.id, { onDelete: "cascade" }),
  dayIndex: integer("day_index").notNull(),
  destIndex: integer("dest_index").notNull(),
  note: text("note").notNull().default(""),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [unique("destination_notes_unique").on(t.planId, t.dayIndex, t.destIndex)]);

export const photoCacheTable = pgTable("photo_cache", {
  id: serial("id").primaryKey(),
  searchQuery: text("search_query").notNull().unique(),
  photoUrl: text("photo_url").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const weatherCacheTable = pgTable("weather_cache", {
  id: serial("id").primaryKey(),
  cacheKey: text("cache_key").notNull().unique(),
  data: jsonb("data").notNull(),
  fetchedAt: timestamp("fetched_at").notNull().defaultNow(),
});

export const routeCacheTable = pgTable("route_cache", {
  id: serial("id").primaryKey(),
  cacheKey: text("cache_key").notNull().unique(),
  data: jsonb("data").notNull(),
  fetchedAt: timestamp("fetched_at").notNull().defaultNow(),
});

export type Plan = typeof plansTable.$inferSelect;
export type PhotoCache = typeof photoCacheTable.$inferSelect;
export type WeatherCache = typeof weatherCacheTable.$inferSelect;
