import { 
  users, profiles, links, analytics, aiInsights,
  type User, type InsertUser,
  type Profile, type InsertProfile,
  type Link, type InsertLink,
  type Analytics, type InsertAnalytics,
  type AiInsight, type InsertAiInsight
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc, isNull, sql } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByGoogleId(googleId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined>;
  upsertUser(user: InsertUser): Promise<User>;
  
  // Profile operations
  getProfile(userId: number): Promise<Profile | undefined>;
  createProfile(profile: InsertProfile): Promise<Profile>;
  updateProfile(userId: number, data: Partial<InsertProfile>): Promise<Profile | undefined>;
  
  // Link operations
  getLinks(userId: number): Promise<Link[]>;
  getLink(id: number): Promise<Link | undefined>;
  getLinkByShortUrl(shortUrl: string): Promise<Link | undefined>;
  createLink(link: InsertLink): Promise<Link>;
  updateLink(id: number, data: Partial<InsertLink>): Promise<Link | undefined>;
  deleteLink(id: number): Promise<boolean>;
  updateLinkPositions(userId: number, linkIdPositions: {id: number, position: number}[]): Promise<boolean>;
  
  // Analytics operations
  getAnalytics(userId: number, period?: string): Promise<any[]>;
  getLinkAnalytics(linkId: number, period?: string): Promise<any[]>;
  recordClick(data: InsertAnalytics): Promise<Analytics>;
  
  // AI Insights
  getAiInsights(userId: number): Promise<AiInsight[]>;
  createAiInsight(insight: InsertAiInsight): Promise<AiInsight>;
  markAiInsightAsSeen(id: number): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }
  
  // Handle Replit Auth upsert - create or update a user
  async upsertUser(userData: InsertUser): Promise<User> {
    console.log(`Upserting user with id ${userData.id} (${userData.username})`);
    const [user] = await db
      .insert(users)
      .values({
        ...userData,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    
    // Check if the user has a profile, create one if not
    const existingProfile = await this.getProfile(user.id);
    if (!existingProfile) {
      await this.createProfile({
        userId: user.id,
        theme: 'default',
        backgroundColor: '#ffffff',
        textColor: '#000000',
        fontFamily: 'Inter',
        socialLinks: []
      });
    }
    
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    console.log(`🔍 DatabaseStorage.getUserByUsername called with username: "${username}"`);
    try {
      // Log the SQL query being executed
      const query = db.select().from(users).where(eq(users.username, username));
      console.log(`🔍 SQL Query: ${query.toSQL().sql}`);
      
      const [user] = await query;
      
      if (user) {
        console.log(`✅ Found user with username "${username}": ID ${user.id}`);
      } else {
        console.log(`ℹ️ No user found with username: "${username}"`);
      }
      
      return user;
    } catch (error) {
      console.error(`❌ Error in getUserByUsername("${username}"):`, error);
      throw error;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    console.log(`🔍 DatabaseStorage.getUserByEmail called with email: "${email}"`);
    try {
      // Log the SQL query being executed
      const query = db.select().from(users).where(eq(users.email, email));
      console.log(`🔍 SQL Query: ${query.toSQL().sql}`);
      
      const [user] = await query;
      
      if (user) {
        console.log(`✅ Found user with email "${email}": ID ${user.id}, username: ${user.username}`);
      } else {
        console.log(`ℹ️ No user found with email: "${email}"`);
        // Try finding similar email (case insensitive comparison)
        const allUsers = await db.select().from(users);
        const similarUser = allUsers.find(u => 
          u.email && u.email.toLowerCase() === email.toLowerCase()
        );
        
        if (similarUser) {
          console.log(`⚠️ Found similar email with different case: "${similarUser.email}"`);
        } else {
          console.log(`❌ No similar emails found in database`);
        }
      }
      
      return user;
    } catch (error) {
      console.error(`❌ Error in getUserByEmail("${email}"):`, error);
      throw error;
    }
  }

  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.googleId, googleId));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set(data)
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  // Profile operations
  async getProfile(userId: number): Promise<Profile | undefined> {
    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, userId));
    return profile;
  }

  async createProfile(profile: InsertProfile): Promise<Profile> {
    const [newProfile] = await db
      .insert(profiles)
      .values(profile)
      .returning();
    return newProfile;
  }

  async updateProfile(userId: number, data: Partial<InsertProfile>): Promise<Profile | undefined> {
    const [updatedProfile] = await db
      .update(profiles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(profiles.userId, userId))
      .returning();
    return updatedProfile;
  }

  // Link operations
  async getLinks(userId: number): Promise<Link[]> {
    return db
      .select()
      .from(links)
      .where(eq(links.userId, userId))
      .orderBy(asc(links.position));
  }

  async getLink(id: number): Promise<Link | undefined> {
    const [link] = await db
      .select()
      .from(links)
      .where(eq(links.id, id));
    return link;
  }

  async getLinkByShortUrl(shortUrl: string): Promise<Link | undefined> {
    const [link] = await db
      .select()
      .from(links)
      .where(eq(links.shortUrl, shortUrl));
    return link;
  }

  async createLink(link: InsertLink): Promise<Link> {
    const [newLink] = await db
      .insert(links)
      .values(link)
      .returning();
    return newLink;
  }

  async updateLink(id: number, data: Partial<InsertLink>): Promise<Link | undefined> {
    const [updatedLink] = await db
      .update(links)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(links.id, id))
      .returning();
    return updatedLink;
  }

  async deleteLink(id: number): Promise<boolean> {
    const result = await db
      .delete(links)
      .where(eq(links.id, id))
      .returning({ id: links.id });
    return result.length > 0;
  }

  async updateLinkPositions(userId: number, linkIdPositions: {id: number, position: number}[]): Promise<boolean> {
    // Using a transaction to ensure all position updates succeed or fail together
    try {
      for (const { id, position } of linkIdPositions) {
        await db
          .update(links)
          .set({ position })
          .where(and(
            eq(links.id, id),
            eq(links.userId, userId)
          ));
      }
      return true;
    } catch (error) {
      console.error("Error updating link positions:", error);
      return false;
    }
  }

  // Analytics operations
  async getAnalytics(userId: number, period?: string): Promise<any[]> {
    let query = db
      .select({
        date: analytics.date,
        clicks: sql`sum(${analytics.clicks})`.as('clicks'),
        country: analytics.country,
        device: analytics.device,
        browser: analytics.browser
      })
      .from(analytics)
      .where(eq(analytics.userId, userId))
      .groupBy(analytics.date, analytics.country, analytics.device, analytics.browser);

    if (period === 'day') {
      query = query.where(sql`${analytics.date} >= NOW() - INTERVAL '1 day'`);
    } else if (period === 'week') {
      query = query.where(sql`${analytics.date} >= NOW() - INTERVAL '7 days'`);
    } else if (period === 'month') {
      query = query.where(sql`${analytics.date} >= NOW() - INTERVAL '30 days'`);
    }

    return query.orderBy(desc(analytics.date));
  }

  async getLinkAnalytics(linkId: number, period?: string): Promise<any[]> {
    let query = db
      .select({
        date: analytics.date,
        clicks: sql`sum(${analytics.clicks})`.as('clicks'),
        country: analytics.country,
        device: analytics.device,
        browser: analytics.browser
      })
      .from(analytics)
      .where(eq(analytics.linkId, linkId))
      .groupBy(analytics.date, analytics.country, analytics.device, analytics.browser);

    if (period === 'day') {
      query = query.where(sql`${analytics.date} >= NOW() - INTERVAL '1 day'`);
    } else if (period === 'week') {
      query = query.where(sql`${analytics.date} >= NOW() - INTERVAL '7 days'`);
    } else if (period === 'month') {
      query = query.where(sql`${analytics.date} >= NOW() - INTERVAL '30 days'`);
    }

    return query.orderBy(desc(analytics.date));
  }

  async recordClick(data: InsertAnalytics): Promise<Analytics> {
    const [result] = await db
      .insert(analytics)
      .values(data)
      .returning();
    return result;
  }

  // AI Insights
  async getAiInsights(userId: number): Promise<AiInsight[]> {
    return db
      .select()
      .from(aiInsights)
      .where(eq(aiInsights.userId, userId))
      .orderBy(desc(aiInsights.createdAt));
  }

  async createAiInsight(insight: InsertAiInsight): Promise<AiInsight> {
    const [newInsight] = await db
      .insert(aiInsights)
      .values(insight)
      .returning();
    return newInsight;
  }

  async markAiInsightAsSeen(id: number): Promise<boolean> {
    const result = await db
      .update(aiInsights)
      .set({ seen: true })
      .where(eq(aiInsights.id, id))
      .returning({ id: aiInsights.id });
    return result.length > 0;
  }
}

export const storage = new DatabaseStorage();
