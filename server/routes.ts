import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { authenticateToken, validateUser, generateToken, authenticateSession } from "./middleware/auth";
import { shortenUrl, generateQrCode, getUrlAnalytics, addUtmParameters } from "./utils/linkyVicky";
import { generateLinkSuggestions, generatePerformanceInsights, generateLinkOrderRecommendations } from "./utils/openai";
import { 
  insertUserSchema,
  insertProfileSchema,
  insertLinkSchema,
  userAuthSchema,
  linkUpdatePositionSchema
} from "@shared/schema";
import session from "express-session";
import { z } from "zod";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import cors from "cors";

// Helper function to dump request info for debugging
function dumpRequestInfo(req: Request, title: string = 'Request Info') {
  console.log(`\n 🔍 ${title.toUpperCase()} 🔍`);
  console.log(`📍 URL: ${req.method} ${req.url}`);
  console.log(`🍪 Cookies: ${req.headers.cookie || 'None'}`);
  console.log(`🆔 Session ID: ${req.sessionID || 'None'}`);
  console.log(`👤 Session User ID: ${req.session?.userId || 'None'}`);
  console.log(`🔑 Authorization: ${req.headers.authorization ? 'Present' : 'None'}`);
  console.log(`📦 Session Data: ${JSON.stringify(req.session, null, 2) || 'None'}`);
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Setup CORS - ensure it runs before session middleware
  app.use(cors({
    // Allow any origin in development, specific domain in production
    origin: process.env.NODE_ENV === "production" 
      ? ["https://linkybecky.replit.app"] 
      : true,
    credentials: true, // Essential for cookies/auth to work cross-domain
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'X-Requested-With'],
    exposedHeaders: ['Set-Cookie'],
  }));
  
  // Add a middleware to add the proper headers for cookies
  app.use((req, res, next) => {
    // Ensure proper headers are set for cookies to work
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    next();
  });
  
  // Set up session middleware with improved cookie settings
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "linky-becky-session-secret",
      resave: true, // Force session to be saved back to the store
      saveUninitialized: true, // Save uninitialized sessions
      rolling: true, // Force cookie to be set on every response
      name: 'linkybecky.sid', // Custom cookie name to avoid conflicts
      cookie: { 
        secure: false, // Set to false even in production for now (troubleshooting)
        httpOnly: true, // Prevent client-side JS from reading the cookie
        sameSite: 'lax', // Changed from 'none' for better compatibility
        path: '/', // Ensure cookie is available for all paths
        maxAge: 1000 * 60 * 60 * 24 * 7 // 1 week
      }
    })
  );

  // Initialize Passport
  app.use(passport.initialize());
  app.use(passport.session());
  
  // Debug middleware to log session and cookie data
  app.use((req, res, next) => {
    console.log('Debug - Session ID:', req.sessionID);
    console.log('Debug - Session data:', req.session);
    console.log('Debug - Cookies:', req.headers.cookie);
    next();
  });

  // Configure Google OAuth strategy
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: process.env.NODE_ENV === "production" 
            ? "https://linkybecky.replit.app/api/auth/google/callback"
            : "/api/auth/google/callback"
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            // Check if user exists by Google ID
            let user = await storage.getUserByGoogleId(profile.id);
            
            // If not found by Google ID, check by email
            const email = profile.emails?.[0]?.value || "";
            if (!user && email) {
              user = await storage.getUserByEmail(email);
              
              // If user exists with this email but no Google ID, update with Google ID
              if (user) {
                user = await storage.updateUser(user.id, {
                  googleId: profile.id,
                  avatar: profile.photos?.[0]?.value || user.avatar
                });
              }
            }
            
            // If still no user, create a new one
            if (!user) {
              // Create new user if not exists
              const username = `${profile.displayName.toLowerCase().replace(/\s+/g, ".")}_${Math.floor(Math.random() * 1000)}`;
              
              user = await storage.createUser({
                username,
                email,
                name: profile.displayName,
                googleId: profile.id,
                avatar: profile.photos?.[0]?.value,
                password: null, // No password for OAuth users
              });
              
              // Create default profile
              await storage.createProfile({
                userId: user.id,
                theme: "light",
                backgroundColor: "#7c3aed",
                textColor: "#ffffff",
                fontFamily: "Inter",
                socialLinks: []
              });
            }
            
            return done(null, user);
          } catch (error) {
            return done(error as Error);
          }
        }
      )
    );
  }

  // Serialize and deserialize user
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user || undefined);
    } catch (error) {
      done(error);
    }
  });

  // Helper function to handle ZodErrors
  const handleZodError = (error: unknown, res: Response) => {
    if (error instanceof ZodError) {
      const validationError = fromZodError(error);
      return res.status(400).json({ message: validationError.message });
    }
    console.error("Unexpected error:", error);
    return res.status(500).json({ message: "Internal server error" });
  };

  // Authentication Routes
  app.get("/api/auth/google", (req, res, next) => {
    // Store username in session if provided
    if (req.query.username) {
      req.session.pendingUsername = req.query.username as string;
    }
    
    passport.authenticate("google", { 
      scope: ["profile", "email"]
    })(req, res, next);
  });

  app.get(
    "/api/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/" }),
    (req, res) => {
      dumpRequestInfo(req, 'GOOGLE OAUTH CALLBACK');
      
      // Ensure the user object exists
      if (!req.user) {
        console.error("❌ OAuth callback: User object is missing");
        return res.redirect("/?error=authentication_failed");
      }
      
      // Get user ID and save it to session
      const userId = (req.user as any)?.id;
      console.log(`✅ Google OAuth successful for user ID: ${userId}`);
      
      if (!userId) {
        console.error("❌ OAuth callback: User ID is missing");
        return res.redirect("/?error=user_id_missing");
      }
      
      // Save user ID to session
      req.session.userId = userId;
      
      // Also save full user object as Passport expects (for deserialization)
      req.session.passport = {
        user: userId
      };
      
      // Force session save before redirecting
      req.session.save((err) => {
        if (err) {
          console.error("❌ Failed to save session:", err);
          return res.redirect("/?error=session_save_failed");
        }
        
        console.log(`✅ Session saved successfully with user ID: ${userId}`);
        console.log(`Session cookie:`, req.session.cookie);
        console.log(`Session ID: ${req.sessionID}`);
        
        // Try to regenerate session after save to ensure it persists
        req.session.regenerate((regenerateErr) => {
          if (regenerateErr) {
            console.error("❌ Failed to regenerate session:", regenerateErr);
          } else {
            // Save user ID again in the new session
            req.session.userId = userId;
            req.session.passport = { user: userId };
            console.log("✅ Session regenerated with fresh session ID:", req.sessionID);
          }
          
          // Always redirect to the frontend callback handler
          res.redirect("/auth/callback");
        });
      });
    }
  );
  
  // Token endpoint - returns a token for the authenticated user
  // Used during OAuth callback flow - removed authenticateSession middleware to debug
  app.get("/api/auth/token", async (req, res) => {
    try {
      // Use our debug utility
      dumpRequestInfo(req, 'TOKEN ENDPOINT');
      
      // Check if we have a userId in:
      // 1. Session directly
      // 2. Session.passport.user (Passport.js standard)
      let userId = req.session?.userId;
      
      if (!userId && req.session?.passport?.user) {
        userId = req.session.passport.user;
        console.log(`ℹ️ Using userId from passport: ${userId}`);
      }
      
      if (!userId) {
        console.error("❌ No userId in session - direct or passport");
        return res.status(401).json({ message: "Authentication required", details: "No user ID in session" });
      }
      
      console.log(`✅ Found userId in session: ${userId}`);
      
      // Get user from database
      const user = await storage.getUser(userId);
      
      if (!user) {
        console.error(`❌ User with ID ${userId} not found in database`);
        return res.status(404).json({ message: "User not found" });
      }
      
      console.log(`✅ User found: ${user.username} (ID: ${user.id})`);
      
      // Now that we have verified the user, save it properly in the session
      req.session.userId = user.id;
      if (!req.session.passport) {
        req.session.passport = { user: user.id };
      }
      
      // Generate JWT token
      const token = generateToken({
        id: user.id,
        email: user.email,
        username: user.username
      });
      
      console.log(`✅ Generated token for user ID ${user.id}`);
      
      // Set token in cookie as well for redundancy
      res.cookie('auth_token', token, {
        httpOnly: true,
        secure: false, // Set to true in production with HTTPS
        maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week
        path: '/'
      });
      
      // Create response object
      const responseData = { 
        token, 
        user: { 
          id: user.id, 
          username: user.username, 
          email: user.email,
          name: user.name,
          bio: user.bio || "",
          avatar: user.avatar || ""
        } 
      };
      
      // Save session before sending response to ensure changes are persisted
      req.session.save((err) => {
        if (err) {
          console.error("❌ Error saving session:", err);
          // Still return the data even if session save fails
        } else {
          console.log("✅ Session saved successfully");
        }
        
        // Return response
        res.json(responseData);
      });
    } catch (error) {
      console.error("❌ Error generating token:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // API endpoint to update username after OAuth login
  app.post("/api/auth/update-username", authenticateToken, validateUser, async (req, res) => {
    try {
      const { username } = req.body;
      
      if (!username) {
        return res.status(400).json({ message: "Username is required" });
      }
      
      // Validate username format
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
        return res.status(400).json({ 
          message: "Username must be 3-20 characters and only contain letters, numbers, and underscores." 
        });
      }
      
      // Check if username is available
      const existingUser = await storage.getUserByUsername(username);
      
      if (existingUser && existingUser.id !== req.user!.id) {
        return res.status(409).json({ message: "Username is already taken." });
      }
      
      // Update the user's username
      const updatedUser = await storage.updateUser(req.user!.id, { username });
      
      if (!updatedUser) {
        return res.status(500).json({ message: "Failed to update username" });
      }
      
      // Generate JWT token
      const token = generateToken({
        id: updatedUser.id,
        email: updatedUser.email,
        username: updatedUser.username,
      });
      
      res.json({ 
        message: "Username updated successfully", 
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          email: updatedUser.email,
          name: updatedUser.name,
          avatar: updatedUser.avatar
        },
        token
      });
    } catch (error) {
      console.error("Error updating username:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = userAuthSchema.parse(req.body);
      
      const user = await storage.getUserByEmail(email);
      
      if (!user || user.password !== password) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      
      // Set session
      req.session.userId = user.id;
      
      // Generate JWT token
      const token = generateToken({
        id: user.id,
        email: user.email,
        username: user.username,
      });
      
      res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
    } catch (error) {
      handleZodError(error, res);
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      // Check if username or email already exists
      const existingUser = await storage.getUserByUsername(userData.username) || 
                          await storage.getUserByEmail(userData.email);
      
      if (existingUser) {
        return res.status(409).json({ message: "Username or email already exists" });
      }
      
      const newUser = await storage.createUser(userData);
      
      // Create default profile
      await storage.createProfile({
        userId: newUser.id,
        theme: "light",
        backgroundColor: "#7c3aed",
        textColor: "#ffffff",
        fontFamily: "Inter",
        socialLinks: []
      });
      
      // Set session
      req.session.userId = newUser.id;
      
      // Generate JWT token
      const token = generateToken({
        id: newUser.id,
        email: newUser.email,
        username: newUser.username,
      });
      
      res.status(201).json({ token, user: { id: newUser.id, username: newUser.username, email: newUser.email } });
    } catch (error) {
      handleZodError(error, res);
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Failed to logout" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  // Get authenticated user based on JWT token
  app.get("/api/auth/me", authenticateToken, async (req, res) => {
    try {
      console.log("🔍 GET /api/auth/me called with token auth");
      console.log("User from token:", req.user);
      
      const user = await storage.getUser(req.user!.id);
      
      if (!user) {
        console.log(`❌ User with id ${req.user!.id} not found in database`);
        return res.status(404).json({ message: "User not found" });
      }
      
      console.log(`✅ Retrieved user: ${user.username} (ID: ${user.id})`);
      
      res.json({ 
        id: user.id, 
        username: user.username, 
        email: user.email,
        name: user.name,
        bio: user.bio || "",
        avatar: user.avatar || ""
      });
    } catch (error) {
      console.error("❌ Error fetching user:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Get authenticated user from session (used for session-based auth)
  app.get("/api/auth/me-from-session", async (req, res) => {
    try {
      console.log("🔍 GET /api/auth/me-from-session called");
      console.log("Session:", req.session);
      console.log("Cookies:", req.headers.cookie);
      
      // Check if we have a userId in the session
      if (!req.session?.userId) {
        console.log("❌ No userId in session");
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      // Get user from database
      const userId = req.session.userId;
      console.log(`✅ Found userId ${userId} in session`);
      
      const user = await storage.getUser(userId);
      
      if (!user) {
        console.log(`❌ User with id ${userId} not found in database`);
        return res.status(404).json({ message: "User not found" });
      }
      
      console.log(`✅ Retrieved user: ${user.username} (ID: ${user.id})`);
      
      // Generate a fresh token for the frontend
      const token = generateToken({
        id: user.id,
        email: user.email,
        username: user.username
      });
      
      // Return the user with the token
      res.json({
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        bio: user.bio || "",
        avatar: user.avatar || "",
        token // Include the token in the response
      });
    } catch (error) {
      console.error("❌ Error in /api/auth/me-from-session:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Username availability check
  app.get("/api/username/availability/:username", async (req, res) => {
    try {
      const { username } = req.params;
      
      // Validate username format
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
        return res.status(400).json({ 
          available: false, 
          message: "Username must be 3-20 characters and only contain letters, numbers, and underscores." 
        });
      }
      
      const existingUser = await storage.getUserByUsername(username);
      
      res.json({
        available: !existingUser,
        message: existingUser ? "Username is already taken." : "Username is available."
      });
    } catch (error) {
      console.error("Error checking username availability:", error);
      res.status(500).json({ 
        available: false, 
        message: "Error checking username availability." 
      });
    }
  });

  // User & Profile Routes
  app.get("/api/users/:username", async (req, res) => {
    try {
      const { username } = req.params;
      const user = await storage.getUserByUsername(username);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const profile = await storage.getProfile(user.id);
      const userLinks = await storage.getLinks(user.id);
      
      // Filter out disabled links for public profile
      const enabledLinks = userLinks.filter(link => link.enabled);
      
      res.json({
        username: user.username,
        name: user.name,
        bio: user.bio,
        avatar: user.avatar,
        profile,
        links: enabledLinks
      });
    } catch (error) {
      console.error("Error fetching user profile:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/profile", authenticateToken, validateUser, async (req, res) => {
    try {
      const profile = await storage.getProfile(req.user!.id);
      
      if (!profile) {
        return res.status(404).json({ message: "Profile not found" });
      }
      
      res.json(profile);
    } catch (error) {
      console.error("Error fetching profile:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/profile", authenticateToken, validateUser, async (req, res) => {
    try {
      const profileData = insertProfileSchema.partial().parse(req.body);
      
      const profile = await storage.getProfile(req.user!.id);
      
      if (!profile) {
        // Create profile if not exists
        const newProfile = await storage.createProfile({
          ...profileData,
          userId: req.user!.id
        });
        return res.json(newProfile);
      }
      
      // Update existing profile
      const updatedProfile = await storage.updateProfile(req.user!.id, profileData);
      res.json(updatedProfile);
    } catch (error) {
      handleZodError(error, res);
    }
  });

  // Link Routes
  app.get("/api/links", authenticateToken, validateUser, async (req, res) => {
    try {
      const links = await storage.getLinks(req.user!.id);
      res.json(links);
    } catch (error) {
      console.error("Error fetching links:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/links", authenticateToken, validateUser, async (req, res) => {
    try {
      const linkData = insertLinkSchema.parse(req.body);
      
      // Get current max position
      const links = await storage.getLinks(req.user!.id);
      const maxPosition = links.length > 0 
        ? Math.max(...links.map(link => link.position))
        : -1;
      
      // Create link with next position
      const newLink = await storage.createLink({
        ...linkData,
        userId: req.user!.id,
        position: maxPosition + 1
      });
      
      // Shorten the URL if not already shortened
      if (!newLink.shortUrl) {
        try {
          const { shortUrl } = await shortenUrl(newLink.url);
          await storage.updateLink(newLink.id, { shortUrl });
          newLink.shortUrl = shortUrl;
        } catch (error) {
          console.error("Error shortening URL:", error);
          // Continue even if shortening fails
        }
      }
      
      res.status(201).json(newLink);
    } catch (error) {
      handleZodError(error, res);
    }
  });

  app.get("/api/links/:id", authenticateToken, validateUser, async (req, res) => {
    try {
      const { id } = req.params;
      const link = await storage.getLink(parseInt(id));
      
      if (!link) {
        return res.status(404).json({ message: "Link not found" });
      }
      
      // Check if link belongs to the authenticated user
      if (link.userId !== req.user!.id) {
        return res.status(403).json({ message: "Unauthorized access to link" });
      }
      
      res.json(link);
    } catch (error) {
      console.error("Error fetching link:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/links/:id", authenticateToken, validateUser, async (req, res) => {
    try {
      const { id } = req.params;
      const linkId = parseInt(id);
      
      const link = await storage.getLink(linkId);
      
      if (!link) {
        return res.status(404).json({ message: "Link not found" });
      }
      
      // Check if link belongs to the authenticated user
      if (link.userId !== req.user!.id) {
        return res.status(403).json({ message: "Unauthorized access to link" });
      }
      
      const linkData = insertLinkSchema.partial().parse(req.body);
      
      // Check if URL changed and needs reshortening
      if (linkData.url && linkData.url !== link.url) {
        try {
          // Add UTM parameters if specified
          let urlToShorten = linkData.url;
          
          if (linkData.utmSource || linkData.utmMedium || linkData.utmCampaign) {
            urlToShorten = addUtmParameters(urlToShorten, {
              source: linkData.utmSource,
              medium: linkData.utmMedium,
              campaign: linkData.utmCampaign,
              term: linkData.utmTerm,
              content: linkData.utmContent
            });
          }
          
          const { shortUrl } = await shortenUrl(urlToShorten);
          linkData.shortUrl = shortUrl;
        } catch (error) {
          console.error("Error shortening URL:", error);
          // Continue even if shortening fails
        }
      }
      
      const updatedLink = await storage.updateLink(linkId, linkData);
      res.json(updatedLink);
    } catch (error) {
      handleZodError(error, res);
    }
  });

  app.delete("/api/links/:id", authenticateToken, validateUser, async (req, res) => {
    try {
      const { id } = req.params;
      const linkId = parseInt(id);
      
      const link = await storage.getLink(linkId);
      
      if (!link) {
        return res.status(404).json({ message: "Link not found" });
      }
      
      // Check if link belongs to the authenticated user
      if (link.userId !== req.user!.id) {
        return res.status(403).json({ message: "Unauthorized access to link" });
      }
      
      const result = await storage.deleteLink(linkId);
      
      if (result) {
        res.json({ message: "Link deleted successfully" });
      } else {
        res.status(500).json({ message: "Failed to delete link" });
      }
    } catch (error) {
      console.error("Error deleting link:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/links/reorder", authenticateToken, validateUser, async (req, res) => {
    try {
      const linkPositions = z.array(linkUpdatePositionSchema).parse(req.body);
      
      const result = await storage.updateLinkPositions(req.user!.id, linkPositions);
      
      if (result) {
        res.json({ message: "Link positions updated successfully" });
      } else {
        res.status(500).json({ message: "Failed to update link positions" });
      }
    } catch (error) {
      handleZodError(error, res);
    }
  });

  // QR Code Generation
  app.get("/api/links/:id/qrcode", authenticateToken, validateUser, async (req, res) => {
    try {
      const { id } = req.params;
      const link = await storage.getLink(parseInt(id));
      
      if (!link) {
        return res.status(404).json({ message: "Link not found" });
      }
      
      // Check if link belongs to the authenticated user
      if (link.userId !== req.user!.id) {
        return res.status(403).json({ message: "Unauthorized access to link" });
      }
      
      const url = link.shortUrl || link.url;
      const qrCodeUrl = await generateQrCode(url);
      
      res.json({ qrCodeUrl });
    } catch (error) {
      console.error("Error generating QR code:", error);
      res.status(500).json({ message: "Failed to generate QR code" });
    }
  });

  // Analytics Routes
  app.get("/api/analytics", authenticateToken, validateUser, async (req, res) => {
    try {
      const { period } = req.query;
      const analytics = await storage.getAnalytics(req.user!.id, period as string);
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching analytics:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/links/:id/analytics", authenticateToken, validateUser, async (req, res) => {
    try {
      const { id } = req.params;
      const { period } = req.query;
      
      const link = await storage.getLink(parseInt(id));
      
      if (!link) {
        return res.status(404).json({ message: "Link not found" });
      }
      
      // Check if link belongs to the authenticated user
      if (link.userId !== req.user!.id) {
        return res.status(403).json({ message: "Unauthorized access to link" });
      }
      
      // If the link has a shortUrl, get analytics from LinkyVicky
      if (link.shortUrl) {
        try {
          const shortUrlId = link.shortUrl.split('/').pop();
          const analytics = await getUrlAnalytics(shortUrlId!, period as string);
          return res.json(analytics);
        } catch (error) {
          console.error("Error fetching analytics from LinkyVicky:", error);
          // Fall back to local analytics if LinkyVicky fails
        }
      }
      
      // Fallback to local analytics
      const analytics = await storage.getLinkAnalytics(parseInt(id), period as string);
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching link analytics:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Record click
  app.post("/api/links/:id/click", async (req, res) => {
    try {
      const { id } = req.params;
      const { country, device, browser } = req.body;
      
      const link = await storage.getLink(parseInt(id));
      
      if (!link) {
        return res.status(404).json({ message: "Link not found" });
      }
      
      await storage.recordClick({
        linkId: parseInt(id),
        userId: link.userId,
        clicks: 1,
        country,
        device,
        browser
      });
      
      res.json({ message: "Click recorded successfully" });
    } catch (error) {
      console.error("Error recording click:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // AI Routes
  app.post("/api/ai/link-suggestions", authenticateToken, validateUser, async (req, res) => {
    try {
      const { url } = req.body;
      
      if (!url) {
        return res.status(400).json({ message: "URL is required" });
      }
      
      const suggestions = await generateLinkSuggestions(url);
      res.json(suggestions);
    } catch (error) {
      console.error("Error generating link suggestions:", error);
      res.status(500).json({ message: "Failed to generate suggestions" });
    }
  });

  app.get("/api/ai/insights", authenticateToken, validateUser, async (req, res) => {
    try {
      const insights = await storage.getAiInsights(req.user!.id);
      res.json(insights);
    } catch (error) {
      console.error("Error fetching AI insights:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/ai/insights/:id/seen", authenticateToken, validateUser, async (req, res) => {
    try {
      const { id } = req.params;
      const result = await storage.markAiInsightAsSeen(parseInt(id));
      
      if (result) {
        res.json({ message: "Insight marked as seen" });
      } else {
        res.status(404).json({ message: "Insight not found" });
      }
    } catch (error) {
      console.error("Error marking insight as seen:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/ai/link-order", authenticateToken, validateUser, async (req, res) => {
    try {
      const { links } = req.body;
      
      if (!links || !Array.isArray(links)) {
        return res.status(400).json({ message: "Links array is required" });
      }
      
      const recommendations = await generateLinkOrderRecommendations(links);
      res.json(recommendations);
    } catch (error) {
      console.error("Error generating link order recommendations:", error);
      res.status(500).json({ message: "Failed to generate recommendations" });
    }
  });

  return httpServer;
}
