import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Users
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  bio: text("bio"),
  avatar: text("avatar"),
  googleId: text("google_id").unique(),
  password: text("password"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  links: many(links),
  profiles: many(profiles),
}));

// Profiles (customizable settings for a user's bio page)
export const profiles = pgTable("profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  theme: text("theme").default("light").notNull(),
  backgroundColor: text("background_color").default("#7c3aed").notNull(),
  textColor: text("text_color").default("#ffffff").notNull(),
  fontFamily: text("font_family").default("Inter").notNull(),
  socialLinks: jsonb("social_links").default([]),
  customDomain: text("custom_domain"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const profilesRelations = relations(profiles, ({ one }) => ({
  user: one(users, {
    fields: [profiles.userId],
    references: [users.id],
  }),
}));

// Links
export const links = pgTable("links", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  url: text("url").notNull(),
  shortUrl: text("short_url"),
  description: text("description"),
  iconType: text("icon_type").default("fas fa-link"),
  position: integer("position").notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  utmTerm: text("utm_term"),
  utmContent: text("utm_content"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const linksRelations = relations(links, ({ one }) => ({
  user: one(users, {
    fields: [links.userId],
    references: [users.id],
  }),
}));

// Analytics (for storing click data)
export const analytics = pgTable("analytics", {
  id: serial("id").primaryKey(),
  linkId: integer("link_id").references(() => links.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  clicks: integer("clicks").default(0).notNull(),
  country: text("country"),
  device: text("device"),
  browser: text("browser"),
  date: timestamp("date").defaultNow().notNull(),
});

export const analyticsRelations = relations(analytics, ({ one }) => ({
  link: one(links, {
    fields: [analytics.linkId],
    references: [links.id],
  }),
  user: one(users, {
    fields: [analytics.userId],
    references: [users.id],
  }),
}));

// AI Insights
export const aiInsights = pgTable("ai_insights", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  linkId: integer("link_id").references(() => links.id, { onDelete: "set null" }),
  content: text("content").notNull(),
  type: text("type").notNull(), // "suggestion", "performance", "recommendation"
  seen: boolean("seen").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const aiInsightsRelations = relations(aiInsights, ({ one }) => ({
  user: one(users, {
    fields: [aiInsights.userId],
    references: [users.id],
  }),
  link: one(links, {
    fields: [aiInsights.linkId],
    references: [links.id],
  }),
}));

// Schemas for data insertion and validation
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertProfileSchema = createInsertSchema(profiles).omit({ id: true, createdAt: true, updatedAt: true });
export const insertLinkSchema = createInsertSchema(links).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAnalyticsSchema = createInsertSchema(analytics).omit({ id: true, date: true });
export const insertAiInsightSchema = createInsertSchema(aiInsights).omit({ id: true, createdAt: true });

export const userAuthSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

export const linkUpdatePositionSchema = z.object({
  id: z.number(),
  position: z.number()
});

// Types based on schemas
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type Profile = typeof profiles.$inferSelect;

export type InsertLink = z.infer<typeof insertLinkSchema>;
export type Link = typeof links.$inferSelect;

export type InsertAnalytics = z.infer<typeof insertAnalyticsSchema>;
export type Analytics = typeof analytics.$inferSelect;

export type InsertAiInsight = z.infer<typeof insertAiInsightSchema>;
export type AiInsight = typeof aiInsights.$inferSelect;
