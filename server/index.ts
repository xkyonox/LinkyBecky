import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { db } from "./db";
import { sql } from "drizzle-orm";

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
