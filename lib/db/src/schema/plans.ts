import { pgTable, serial, text, timestamp, jsonb, integer } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const plansTable = pgTable("plans", {
  id: serial("id").primaryKey(),
  shareCode: text("share_code").notNull().unique(),
  userId: integer("user_id").references(() => usersTable.id, {
    onDelete: "set null",
  }),
  city: text("city").notNull(),
  country: text("country").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  budget: text("budget"),
  preferences: text("preferences"),
  travellerType: text("traveller_type").notNull(),
  tripSummary: text("trip_summary").notNull(),
  photoUrl: text("photo_url").notNull(),
  planData: jsonb("plan_data").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const photoCacheTable = pgTable("photo_cache", {
  id: serial("id").primaryKey(),
  searchQuery: text("search_query").notNull().unique(),
  photoUrl: text("photo_url").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Plan = typeof plansTable.$inferSelect;
export type PhotoCache = typeof photoCacheTable.$inferSelect;
