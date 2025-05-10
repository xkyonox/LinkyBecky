import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { db } from "./db";
import { sql } from "drizzle-orm";
import jwt from "jsonwebtoken";

// JWT functions
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-production';

function generateToken(user: { id: number; email: string; username: string }): string {
  return jwt.sign(
    { 
      id: user.id,
      email: user.email,
      username: user.username
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// Extract user from JWT token
function getUserFromToken(req: Request): { id: number; email: string; username: string } | null {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number; email: string; username: string };
    return decoded;
  } catch (error) {
    console.error('Error extracting user from token:', error);
    return null;
  }
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Check and initialize database tables if they don't exist
  try {
    log("🗄️ Checking database connection and tables...");
    
    // First check if we can connect to the database
    const connection = await db.execute(sql`SELECT 1 as connected`);
    log("✅ Database connection successful: " + JSON.stringify(connection.rows?.[0]));
    
    // Check if the 'users' table exists
    const tableCheck = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name = 'users'
      ) as exists
    `);
    
    const usersTableExists = tableCheck.rows?.[0]?.exists === true || 
                         tableCheck.rows?.[0]?.exists === 't' ||
                         tableCheck.rows?.[0]?.exists === 'true';
    
    log(`✅ Database users table exists: ${usersTableExists}`);
    
    // If the users table doesn't exist, push the schema to the database
    if (!usersTableExists) {
      log("🗄️ Creating database tables from schema...");
      
      // Create sessions table for session storage
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "sessions" (
          "sid" VARCHAR(255) NOT NULL PRIMARY KEY,
          "sess" JSON NOT NULL,
          "expire" TIMESTAMP(6) NOT NULL
        )
      `);
      
      log("✅ Sessions table created");
      
      // Create users table
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "users" (
          "id" SERIAL PRIMARY KEY,
          "username" VARCHAR(20) NOT NULL UNIQUE,
          "email" VARCHAR(255) UNIQUE,
          "password" VARCHAR(255),
          "salt" VARCHAR(255),
          "name" VARCHAR(255),
          "bio" TEXT,
          "avatar" TEXT,
          "google_id" VARCHAR(255) UNIQUE,
          "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
      
      log("✅ Users table created");
      
      // Create profiles table
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "profiles" (
          "id" SERIAL PRIMARY KEY,
          "user_id" INTEGER NOT NULL UNIQUE,
          "theme" VARCHAR(50) NOT NULL DEFAULT 'default',
          "background_color" VARCHAR(20) NOT NULL DEFAULT '#ffffff',
          "text_color" VARCHAR(20) NOT NULL DEFAULT '#000000',
          "font_family" VARCHAR(50) NOT NULL DEFAULT 'Inter',
          "social_links" JSONB NOT NULL DEFAULT '[]',
          "custom_domain" VARCHAR(255),
          "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
          "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
          FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
        )
      `);
      
      log("✅ Profiles table created");
      
      // Create links table
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "links" (
          "id" SERIAL PRIMARY KEY,
          "user_id" INTEGER NOT NULL,
          "title" VARCHAR(100) NOT NULL,
          "url" TEXT NOT NULL,
          "short_url" VARCHAR(255),
          "description" TEXT,
          "icon_type" VARCHAR(50) NOT NULL DEFAULT 'auto',
          "position" INTEGER NOT NULL DEFAULT 0,
          "enabled" BOOLEAN NOT NULL DEFAULT true,
          "utm_source" VARCHAR(100),
          "utm_medium" VARCHAR(100),
          "utm_campaign" VARCHAR(100),
          "utm_term" VARCHAR(100),
          "utm_content" VARCHAR(100),
          "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
          "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
          FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
        )
      `);
      
      log("✅ Links table created");
      
      // Create analytics table
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "analytics" (
          "id" SERIAL PRIMARY KEY,
          "user_id" INTEGER NOT NULL,
          "link_id" INTEGER,
          "clicks" INTEGER NOT NULL DEFAULT 1,
          "country" VARCHAR(100),
          "device" VARCHAR(100),
          "browser" VARCHAR(100),
          "referrer" VARCHAR(255),
          "date" TIMESTAMP NOT NULL DEFAULT NOW(),
          FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE,
          FOREIGN KEY ("link_id") REFERENCES "links" ("id") ON DELETE SET NULL
        )
      `);
      
      log("✅ Analytics table created");
      
      // Create AI insights table
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "ai_insights" (
          "id" SERIAL PRIMARY KEY,
          "user_id" INTEGER NOT NULL,
          "link_id" INTEGER,
          "content" TEXT NOT NULL,
          "type" VARCHAR(50) NOT NULL,
          "seen" BOOLEAN NOT NULL DEFAULT false,
          "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
          FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE,
          FOREIGN KEY ("link_id") REFERENCES "links" ("id") ON DELETE SET NULL
        )
      `);
      
      log("✅ AI insights table created");
      
      log("🚀 All database tables have been created successfully!");
    }
  } catch (dbError) {
    log("❌ Database initialization error: " + String(dbError));
    log("⚠️ Continuing without database initialization. Some features may not work correctly.");
  }
  
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Create a custom API router for handling all /api routes
  // This will create a completely separate handler for API routes
  app.all('/api/*', (req: Request, res: Response, next: NextFunction) => {
    log(`API Route intercepted: ${req.method} ${req.path}`);
    
    // Extract the original route path after /api/
    const apiPath = req.path.replace(/^\/api/, '');
    log(`API Path: ${apiPath}`);
    
    // Define a custom handler that automatically returns JSON
    const handleApiRequest = async () => {
      try {
        // Force content type to JSON for all API responses
        res.setHeader('Content-Type', 'application/json');
        
        // Status endpoint
        if (req.method === 'GET' && apiPath === '/status') {
          return res.json({
            status: "online",
            time: new Date().toISOString(),
            env: process.env.NODE_ENV || "development",
            sessionId: req.sessionID || null,
            cookiePresent: !!req.headers.cookie
          });
        }
        
        // Test DB endpoint
        if (req.method === 'GET' && apiPath === '/test-db') {
          try {
            const connection = await db.execute(sql`SELECT 1 as connected`);
            
            // Get tables from database
            const tables = await db.execute(sql`
              SELECT table_name 
              FROM information_schema.tables 
              WHERE table_schema = 'public'
            `);
            
            // Count users
            const userCount = await db.execute(sql`SELECT COUNT(*) as count FROM users`);
            
            return res.json({
              status: "Database connection successful",
              tables: tables.rows?.map((row: any) => row.table_name) || [],
              userCount: userCount.rows?.[0]?.count || 0
            });
          } catch (error: any) {
            console.error("❌ Database test error:", error);
            return res.status(500).json({
              status: "Database connection error",
              error: error?.message || String(error)
            });
          }
        }
        
        // Username availability check
        if (req.method === 'GET' && apiPath.startsWith('/username/availability/')) {
          const username = apiPath.replace('/username/availability/', '');
          
          // Validate username format
          if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
            return res.status(400).json({ 
              available: false, 
              message: "Username must be 3-20 characters and only contain letters, numbers, and underscores." 
            });
          }
          
          try {
            const result = await db.execute(sql`
              SELECT EXISTS (
                SELECT 1 FROM users WHERE username = ${username}
              ) as exists
            `);
            
            const userExists = result.rows?.[0]?.exists === true || 
                             result.rows?.[0]?.exists === 't' || 
                             result.rows?.[0]?.exists === 'true';
            
            return res.json({
              available: !userExists,
              message: userExists 
                ? "Username is already taken." 
                : "Username is available."
            });
          } catch (error) {
            console.error("❌ Username SQL check error:", error);
            return res.status(500).json({
              available: false,
              message: "Server error checking username availability."
            });
          }
        }
        
        // Auth endpoints
        if (req.method === 'GET' && apiPath === '/auth/me-from-session') {
          try {
            // Check if user has a valid session
            const userId = req.session?.userId || req.session?.passport?.user;
            if (!userId) {
              return res.json(null); // Not authenticated
            }
            
            // Get user from database
            try {
              const userResult = await db.execute(sql`
                SELECT id, username, email, name, bio, avatar 
                FROM users WHERE id = ${userId}
              `);
              
              if (userResult.rows && userResult.rows.length > 0) {
                return res.json(userResult.rows[0]);
              }
              
              return res.json(null); // User not found
            } catch (dbErr) {
              console.error("Database error fetching user:", dbErr);
              return res.json(null);
            }
          } catch (error) {
            console.error("Error in me-from-session:", error);
            return res.json(null);
          }
        }
        
        // Token endpoint - return a token for an authenticated user
        if (req.method === 'GET' && apiPath === '/auth/token') {
          try {
            // Check if we have a userId in session
            let userId = req.session?.userId;
            
            if (!userId && req.session?.passport?.user) {
              userId = req.session.passport.user;
            }
            
            if (!userId) {
              return res.status(401).json({ 
                error: 'Authentication required', 
                message: 'No user ID in session' 
              });
            }
            
            // Get user from database
            try {
              const userResult = await db.execute(sql`
                SELECT id, username, email, name, bio, avatar 
                FROM users WHERE id = ${userId}
              `);
              
              if (!userResult.rows || userResult.rows.length === 0) {
                return res.status(404).json({ 
                  error: 'User not found', 
                  message: 'User not found in database' 
                });
              }
              
              const user = userResult.rows[0];
              
              // Generate JWT token
              const token = generateToken({
                id: Number(user.id),
                email: user.email?.toString() || '',
                username: user.username?.toString() || ''
              });
              
              return res.json({
                token,
                user
              });
            } catch (dbErr) {
              console.error("Database error fetching user for token:", dbErr);
              return res.status(500).json({ 
                error: 'Database error', 
                message: 'Error fetching user from database' 
              });
            }
          } catch (error) {
            console.error("Error in token endpoint:", error);
            return res.status(500).json({ 
              error: 'Server error', 
              message: 'Internal server error' 
            });
          }
        }
        
        // Update username API
        if (req.method === 'POST' && apiPath === '/auth/update-username') {
          try {
            // Get user from token
            const tokenUser = getUserFromToken(req);
            if (!tokenUser) {
              return res.status(401).json({ 
                error: 'Authentication required', 
                message: 'Valid authentication token required' 
              });
            }
            
            // Get username from request body
            const { username } = req.body;
            
            if (!username) {
              return res.status(400).json({ 
                error: 'Invalid request', 
                message: 'Username is required' 
              });
            }
            
            // Validate username format
            if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
              return res.status(400).json({ 
                error: 'Invalid username', 
                message: 'Username must be 3-20 characters and only contain letters, numbers, and underscores' 
              });
            }
            
            // Check if username is available
            const usernameCheckResult = await db.execute(sql`
              SELECT EXISTS (
                SELECT 1 FROM users WHERE username = ${username} AND id != ${tokenUser.id}
              ) as exists
            `);
            
            const userExists = usernameCheckResult.rows?.[0]?.exists === true || 
                               usernameCheckResult.rows?.[0]?.exists === 't' || 
                               usernameCheckResult.rows?.[0]?.exists === 'true';
            
            if (userExists) {
              return res.status(400).json({ 
                error: 'Username taken', 
                message: 'This username is already taken by another user' 
              });
            }
            
            // Update username
            await db.execute(sql`
              UPDATE users SET username = ${username} WHERE id = ${tokenUser.id}
            `);
            
            // Get updated user
            const userResult = await db.execute(sql`
              SELECT id, username, email, name, bio, avatar 
              FROM users WHERE id = ${tokenUser.id}
            `);
            
            if (!userResult.rows || userResult.rows.length === 0) {
              return res.status(500).json({ 
                error: 'Database error', 
                message: 'Failed to retrieve updated user' 
              });
            }
            
            const updatedUser = userResult.rows[0];
            
            // Generate new token with updated username
            const token = generateToken({
              id: Number(updatedUser.id),
              email: updatedUser.email?.toString() || '',
              username: updatedUser.username?.toString() || ''
            });
            
            return res.json({
              token,
              user: updatedUser
            });
          } catch (error) {
            console.error("Error updating username:", error);
            return res.status(500).json({ 
              error: 'Server error', 
              message: 'Internal server error' 
            });
          }
        }
        
        // Public profile endpoint - get a user by username
        if (req.method === 'GET' && apiPath.startsWith('/users/')) {
          try {
            const username = apiPath.replace('/users/', '');
            console.log(`Looking up public profile for username: ${username}`);
            
            // Get user from database
            const userResult = await db.execute(sql`
              SELECT id, username, email, name, bio, avatar
              FROM users 
              WHERE username = ${username}
            `);
            
            if (!userResult.rows || userResult.rows.length === 0) {
              return res.status(404).json({ 
                error: 'User not found', 
                message: `No user with username '${username}' exists`
              });
            }
            
            const user = userResult.rows[0];
            console.log(`Found user: ${user.id} (${user.username})`);
            
            // Get user's profile settings
            const profileResult = await db.execute(sql`
              SELECT id, theme, background_color AS "backgroundColor", text_color AS "textColor", 
                     font_family AS "fontFamily", social_links AS "socialLinks"
              FROM profiles
              WHERE user_id = ${user.id}
            `);
            
            let profile = null;
            if (profileResult.rows && profileResult.rows.length > 0) {
              profile = profileResult.rows[0];
              
              // Parse socialLinks JSON if it's a string
              if (typeof profile.socialLinks === 'string') {
                try {
                  profile.socialLinks = JSON.parse(profile.socialLinks);
                } catch (e) {
                  console.error('Error parsing socialLinks JSON:', e);
                  profile.socialLinks = [];
                }
              } else if (!profile.socialLinks) {
                profile.socialLinks = [];
              }
            } else {
              // Create default profile if none exists
              profile = {
                theme: "light",
                backgroundColor: "#7c3aed",
                textColor: "#ffffff",
                fontFamily: "Inter",
                socialLinks: []
              };
            }
            
            // Get user's links
            const linksResult = await db.execute(sql`
              SELECT id, title, url, short_url AS "shortUrl", description, 
                     icon_type AS "iconType", position, enabled
              FROM links
              WHERE user_id = ${user.id} AND enabled = true
              ORDER BY position ASC
            `);
            
            const links = linksResult.rows || [];
            
            // Return combined user info
            return res.json({
              id: user.id,
              username: user.username,
              name: user.name,
              bio: user.bio,
              avatar: user.avatar,
              profile,
              links
            });
          } catch (error) {
            console.error("Error fetching user profile by username:", error);
            return res.status(500).json({ 
              error: 'Server error', 
              message: 'Failed to fetch user profile'
            });
          }
        }
        
        // Profile management endpoints
        // GET profile for the authenticated user
        if (req.method === 'GET' && apiPath === '/profile') {
          try {
            // Get authenticated user from token or session
            const tokenUser = getUserFromToken(req);
            const sessionUserId = req.session?.userId || req.session?.passport?.user;
            
            let userId: number | null = null;
            
            if (tokenUser) {
              userId = tokenUser.id;
            } else if (sessionUserId) {
              userId = sessionUserId;
            }
            
            if (!userId) {
              return res.status(401).json({ 
                error: 'Authentication required', 
                message: 'Valid authentication required'
              });
            }
            
            // Get profile from database
            const profileResult = await db.execute(sql`
              SELECT id, theme, background_color AS "backgroundColor", text_color AS "textColor", 
                     font_family AS "fontFamily", social_links AS "socialLinks"
              FROM profiles
              WHERE user_id = ${userId}
            `);
            
            if (!profileResult.rows || profileResult.rows.length === 0) {
              return res.status(404).json({ 
                error: 'Profile not found', 
                message: 'No profile found for this user'
              });
            }
            
            const profile = profileResult.rows[0];
            
            // Parse socialLinks JSON if it's a string
            if (typeof profile.socialLinks === 'string') {
              try {
                profile.socialLinks = JSON.parse(profile.socialLinks);
              } catch (e) {
                console.error('Error parsing socialLinks JSON:', e);
                profile.socialLinks = [];
              }
            } else if (!profile.socialLinks) {
              profile.socialLinks = [];
            }
            
            return res.json(profile);
          } catch (error) {
            console.error("Error fetching profile:", error);
            return res.status(500).json({ 
              error: 'Server error', 
              message: 'Failed to fetch profile'
            });
          }
        }
        
        // Create or update profile
        if (req.method === 'PUT' && apiPath === '/profile') {
          try {
            // Get authenticated user from token or session
            const tokenUser = getUserFromToken(req);
            const sessionUserId = req.session?.userId || req.session?.passport?.user;
            
            let userId: number | null = null;
            
            if (tokenUser) {
              userId = tokenUser.id;
            } else if (sessionUserId) {
              userId = sessionUserId;
            }
            
            if (!userId) {
              return res.status(401).json({ 
                error: 'Authentication required', 
                message: 'Valid authentication required'
              });
            }
            
            // Validate request body
            const { theme, backgroundColor, textColor, fontFamily, socialLinks } = req.body;
            
            if (!theme || !backgroundColor || !textColor || !fontFamily) {
              return res.status(400).json({ 
                error: 'Invalid request', 
                message: 'Missing required profile fields'
              });
            }
            
            // Convert socialLinks to JSON string if it's an array
            const socialLinksJson = Array.isArray(socialLinks) 
              ? JSON.stringify(socialLinks) 
              : JSON.stringify([]);
            
            // Check if profile exists
            const profileCheckResult = await db.execute(sql`
              SELECT id FROM profiles WHERE user_id = ${userId}
            `);
            
            if (profileCheckResult.rows && profileCheckResult.rows.length > 0) {
              // Update existing profile
              await db.execute(sql`
                UPDATE profiles 
                SET theme = ${theme}, 
                    background_color = ${backgroundColor}, 
                    text_color = ${textColor}, 
                    font_family = ${fontFamily}, 
                    social_links = ${socialLinksJson}
                WHERE user_id = ${userId}
              `);
            } else {
              // Create new profile
              await db.execute(sql`
                INSERT INTO profiles (user_id, theme, background_color, text_color, font_family, social_links)
                VALUES (${userId}, ${theme}, ${backgroundColor}, ${textColor}, ${fontFamily}, ${socialLinksJson})
              `);
            }
            
            // Get updated profile
            const updatedProfileResult = await db.execute(sql`
              SELECT id, theme, background_color AS "backgroundColor", text_color AS "textColor", 
                     font_family AS "fontFamily", social_links AS "socialLinks"
              FROM profiles
              WHERE user_id = ${userId}
            `);
            
            if (!updatedProfileResult.rows || updatedProfileResult.rows.length === 0) {
              return res.status(500).json({ 
                error: 'Database error', 
                message: 'Failed to retrieve updated profile'
              });
            }
            
            const profile = updatedProfileResult.rows[0];
            
            // Parse socialLinks JSON if it's a string
            if (typeof profile.socialLinks === 'string') {
              try {
                profile.socialLinks = JSON.parse(profile.socialLinks);
              } catch (e) {
                console.error('Error parsing socialLinks JSON:', e);
                profile.socialLinks = [];
              }
            } else if (!profile.socialLinks) {
              profile.socialLinks = [];
            }
            
            return res.json(profile);
          } catch (error) {
            console.error("Error updating profile:", error);
            return res.status(500).json({ 
              error: 'Server error', 
              message: 'Failed to update profile'
            });
          }
        }
        
        // Link management endpoints
        // GET all links for the authenticated user
        if (req.method === 'GET' && apiPath === '/links') {
          try {
            // Get authenticated user from token or session
            const tokenUser = getUserFromToken(req);
            const sessionUserId = req.session?.userId || req.session?.passport?.user;
            
            let userId: number | null = null;
            
            if (tokenUser) {
              userId = tokenUser.id;
            } else if (sessionUserId) {
              userId = sessionUserId;
            }
            
            if (!userId) {
              return res.status(401).json({ 
                error: 'Authentication required', 
                message: 'Valid authentication required'
              });
            }
            
            // Get links from database, ordered by position
            const linksResult = await db.execute(sql`
              SELECT id, title, url, short_url AS "shortUrl", description, 
                     icon_type AS "iconType", position, enabled, 
                     utm_source AS "utmSource", utm_medium AS "utmMedium", 
                     utm_campaign AS "utmCampaign", utm_term AS "utmTerm", 
                     utm_content AS "utmContent", 
                     created_at AS "createdAt", updated_at AS "updatedAt"
              FROM links
              WHERE user_id = ${userId}
              ORDER BY position ASC
            `);
            
            // Return links (empty array if none)
            return res.json(linksResult.rows || []);
          } catch (error) {
            console.error("Error fetching links:", error);
            return res.status(500).json({ 
              error: 'Server error', 
              message: 'Failed to fetch links'
            });
          }
        }
        
        // Create a new link
        if (req.method === 'POST' && apiPath === '/links') {
          try {
            // Get authenticated user from token or session
            const tokenUser = getUserFromToken(req);
            const sessionUserId = req.session?.userId || req.session?.passport?.user;
            
            let userId: number | null = null;
            
            if (tokenUser) {
              userId = tokenUser.id;
            } else if (sessionUserId) {
              userId = sessionUserId;
            }
            
            if (!userId) {
              console.error("Failed to create link: No authenticated user");
              return res.status(401).json({ 
                error: 'Authentication required', 
                message: 'Valid authentication required'
              });
            }
            
            // Validate request body (basic validation)
            const { title, url, description, iconType, utmSource, utmMedium, utmCampaign, utmTerm, utmContent } = req.body;
            
            if (!title || !url) {
              console.error("Failed to create link: Missing required fields", req.body);
              return res.status(400).json({ 
                error: 'Invalid request', 
                message: 'Title and URL are required'
              });
            }
            
            // Get the highest position for existing links
            const positionResult = await db.execute(sql`
              SELECT COALESCE(MAX(position), 0) AS max_position
              FROM links
              WHERE user_id = ${userId}
            `);
            
            const maxPosition = positionResult.rows && positionResult.rows[0] ? 
                Number(positionResult.rows[0].max_position) || 0 : 0;
            
            // Import the LinkyVicky API utilities to shorten the URL
            const { shortenUrl } = await import("./utils/linkyVicky");
            
            // Create short URL using LinkyVicky API
            let shortUrl = null;
            try {
              console.log("Shortening URL:", url);
              const shortenedUrl = await shortenUrl(url);
              shortUrl = shortenedUrl.shortUrl;
              console.log("Successfully shortened URL:", shortUrl);
            } catch (apiError) {
              console.error("Error shortening URL with LinkyVicky API:", apiError);
              // Continue without short URL if API fails
            }
            
            // Create link in database
            const insertResult = await db.execute(sql`
              INSERT INTO links (
                user_id, title, url, short_url, description, icon_type, 
                position, enabled, utm_source, utm_medium, utm_campaign, utm_term, utm_content
              ) VALUES (
                ${userId}, ${title}, ${url}, ${shortUrl}, ${description || null}, ${iconType || 'default'}, 
                ${maxPosition + 1}, ${true}, ${utmSource || null}, ${utmMedium || null}, 
                ${utmCampaign || null}, ${utmTerm || null}, ${utmContent || null}
              ) RETURNING id, title, url, short_url AS "shortUrl", description, 
                icon_type AS "iconType", position, enabled, 
                utm_source AS "utmSource", utm_medium AS "utmMedium", 
                utm_campaign AS "utmCampaign", utm_term AS "utmTerm", 
                utm_content AS "utmContent", created_at AS "createdAt", updated_at AS "updatedAt"
            `);
            
            if (!insertResult.rows || insertResult.rows.length === 0) {
              console.error("Failed to create link: No rows returned from insert");
              return res.status(500).json({ 
                error: 'Database error', 
                message: 'Failed to create link'
              });
            }
            
            // Return created link
            return res.status(201).json(insertResult.rows[0]);
          } catch (error) {
            console.error("Error creating link:", error);
            return res.status(500).json({ 
              error: 'Server error', 
              message: 'Failed to create link'
            });
          }
        }
        
        // Update link
        if (req.method === 'PUT' && apiPath.startsWith('/links/') && apiPath.split('/').length === 3) {
          try {
            // Extract link ID from path
            const linkId = apiPath.split('/')[2];
            
            if (!linkId || !/^\d+$/.test(linkId)) {
              return res.status(400).json({ 
                error: 'Invalid request', 
                message: 'Invalid link ID'
              });
            }
            
            // Get authenticated user from token or session
            const tokenUser = getUserFromToken(req);
            const sessionUserId = req.session?.userId || req.session?.passport?.user;
            
            let userId: number | null = null;
            
            if (tokenUser) {
              userId = tokenUser.id;
            } else if (sessionUserId) {
              userId = sessionUserId;
            }
            
            if (!userId) {
              return res.status(401).json({ 
                error: 'Authentication required', 
                message: 'Valid authentication required'
              });
            }
            
            // Verify link belongs to user
            const linkCheckResult = await db.execute(sql`
              SELECT id FROM links WHERE id = ${linkId} AND user_id = ${userId}
            `);
            
            if (!linkCheckResult.rows || linkCheckResult.rows.length === 0) {
              return res.status(404).json({ 
                error: 'Not found', 
                message: 'Link not found or does not belong to you'
              });
            }
            
            // Validate request body fields
            const { title, url, description, iconType, enabled, utmSource, utmMedium, utmCampaign, utmTerm, utmContent } = req.body;
            
            // Prepare SET parts for SQL
            const updates = [];
            const params = [];
            
            if (title !== undefined) {
              updates.push(`title = $${params.length + 1}`);
              params.push(title);
            }
            
            if (url !== undefined) {
              updates.push(`url = $${params.length + 1}`);
              params.push(url);
              
              // If URL is being updated, update shortUrl as well
              if (url) {
                try {
                  const { shortenUrl } = await import("./utils/linkyVicky");
                  const shortenedUrl = await shortenUrl(url);
                  updates.push(`short_url = $${params.length + 1}`);
                  params.push(shortenedUrl.shortUrl);
                } catch (apiError) {
                  console.error("Error updating shortened URL:", apiError);
                  // Continue without updating short URL
                }
              }
            }
            
            if (description !== undefined) {
              updates.push(`description = $${params.length + 1}`);
              params.push(description);
            }
            
            if (iconType !== undefined) {
              updates.push(`icon_type = $${params.length + 1}`);
              params.push(iconType);
            }
            
            if (enabled !== undefined) {
              updates.push(`enabled = $${params.length + 1}`);
              params.push(enabled);
            }
            
            if (utmSource !== undefined) {
              updates.push(`utm_source = $${params.length + 1}`);
              params.push(utmSource);
            }
            
            if (utmMedium !== undefined) {
              updates.push(`utm_medium = $${params.length + 1}`);
              params.push(utmMedium);
            }
            
            if (utmCampaign !== undefined) {
              updates.push(`utm_campaign = $${params.length + 1}`);
              params.push(utmCampaign);
            }
            
            if (utmTerm !== undefined) {
              updates.push(`utm_term = $${params.length + 1}`);
              params.push(utmTerm);
            }
            
            if (utmContent !== undefined) {
              updates.push(`utm_content = $${params.length + 1}`);
              params.push(utmContent);
            }
            
            // Add updated_at timestamp
            updates.push(`updated_at = $${params.length + 1}`);
            params.push(new Date());
            
            // Update link if there are valid fields to update
            if (updates.length === 0) {
              return res.status(400).json({
                error: 'Invalid request',
                message: 'No valid fields to update'
              });
            }
            
            // Build and execute update query
            const updateSql = `
              UPDATE links 
              SET ${updates.join(', ')}
              WHERE id = $${params.length + 1} AND user_id = $${params.length + 2}
              RETURNING id, title, url, short_url AS "shortUrl", description, 
                icon_type AS "iconType", position, enabled, 
                utm_source AS "utmSource", utm_medium AS "utmMedium", 
                utm_campaign AS "utmCampaign", utm_term AS "utmTerm", 
                utm_content AS "utmContent", created_at AS "createdAt", updated_at AS "updatedAt"
            `;
            
            params.push(linkId);
            params.push(userId);
            
            const updateResult = await db.execute(sql.raw(updateSql, ...params));
            
            if (!updateResult.rows || updateResult.rows.length === 0) {
              return res.status(404).json({
                error: 'Not found',
                message: 'Link not found or not updated'
              });
            }
            
            return res.json(updateResult.rows[0]);
          } catch (error) {
            console.error("Error updating link:", error);
            return res.status(500).json({ 
              error: 'Server error', 
              message: 'Failed to update link'
            });
          }
        }
        
        // Delete link
        if (req.method === 'DELETE' && apiPath.startsWith('/links/') && apiPath.split('/').length === 3) {
          try {
            // Extract link ID from path
            const linkId = apiPath.split('/')[2];
            
            if (!linkId || !/^\d+$/.test(linkId)) {
              return res.status(400).json({ 
                error: 'Invalid request', 
                message: 'Invalid link ID'
              });
            }
            
            // Get authenticated user from token or session
            const tokenUser = getUserFromToken(req);
            const sessionUserId = req.session?.userId || req.session?.passport?.user;
            
            let userId: number | null = null;
            
            if (tokenUser) {
              userId = tokenUser.id;
            } else if (sessionUserId) {
              userId = sessionUserId;
            }
            
            if (!userId) {
              return res.status(401).json({ 
                error: 'Authentication required', 
                message: 'Valid authentication required'
              });
            }
            
            // Verify link belongs to user
            const linkCheckResult = await db.execute(sql`
              SELECT id, position FROM links WHERE id = ${linkId} AND user_id = ${userId}
            `);
            
            if (!linkCheckResult.rows || linkCheckResult.rows.length === 0) {
              return res.status(404).json({ 
                error: 'Not found', 
                message: 'Link not found or does not belong to you'
              });
            }
            
            // Delete link
            await db.execute(sql`
              DELETE FROM links WHERE id = ${linkId} AND user_id = ${userId}
            `);
            
            // Reorder remaining links to ensure positions are consecutive
            const deletedPosition = linkCheckResult.rows[0].position;
            
            await db.execute(sql`
              UPDATE links
              SET position = position - 1
              WHERE user_id = ${userId} AND position > ${deletedPosition}
            `);
            
            return res.json({ success: true });
          } catch (error) {
            console.error("Error deleting link:", error);
            return res.status(500).json({ 
              error: 'Server error', 
              message: 'Failed to delete link'
            });
          }
        }
        
        // Update link positions (reordering)
        if (req.method === 'POST' && apiPath === '/links/positions') {
          try {
            // Get authenticated user from token or session
            const tokenUser = getUserFromToken(req);
            const sessionUserId = req.session?.userId || req.session?.passport?.user;
            
            let userId: number | null = null;
            
            if (tokenUser) {
              userId = tokenUser.id;
            } else if (sessionUserId) {
              userId = sessionUserId;
            }
            
            if (!userId) {
              return res.status(401).json({ 
                error: 'Authentication required', 
                message: 'Valid authentication required'
              });
            }
            
            // Validate request body
            const { positions } = req.body;
            
            if (!positions || !Array.isArray(positions)) {
              return res.status(400).json({ 
                error: 'Invalid request', 
                message: 'Positions array is required'
              });
            }
            
            // Update each link position
            for (const { id, position } of positions) {
              // Validate position data
              if (!id || !Number.isInteger(position) || position < 0) {
                continue;
              }
              
              // Update position for this link
              await db.execute(sql`
                UPDATE links
                SET position = ${position}, updated_at = NOW()
                WHERE id = ${id} AND user_id = ${userId}
              `);
            }
            
            // Get updated links
            const updatedLinksResult = await db.execute(sql`
              SELECT id, title, url, short_url AS "shortUrl", description, 
                     icon_type AS "iconType", position, enabled, 
                     utm_source AS "utmSource", utm_medium AS "utmMedium", 
                     utm_campaign AS "utmCampaign", utm_term AS "utmTerm", 
                     utm_content AS "utmContent", created_at AS "createdAt", updated_at AS "updatedAt"
              FROM links
              WHERE user_id = ${userId}
              ORDER BY position ASC
            `);
            
            return res.json(updatedLinksResult.rows || []);
          } catch (error) {
            console.error("Error updating link positions:", error);
            return res.status(500).json({ 
              error: 'Server error', 
              message: 'Failed to update link positions'
            });
          }
        }
        
        // If no handler matched, return a 404
        return res.status(404).json({ 
          error: 'API endpoint not found',
          path: apiPath
        });
      } catch (error) {
        console.error("API error:", error);
        return res.status(500).json({ error: 'Internal server error' });
      }
    };
    
    // Handle the API request and prevent further processing
    handleApiRequest().catch(next);
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
