import express, { type Express, type Request, type Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { authenticateToken, validateUser, generateToken, authenticateSession } from "./middleware/auth";
import { authenticate } from "./middleware/simpleAuth";
import { shortenUrl, generateQrCode, getUrlAnalytics, addUtmParameters } from "./utils/linkyVicky";
import { getSystemHealth } from "./utils/health";
import { generateLinkSuggestions, generatePerformanceInsights, generateLinkOrderRecommendations } from "./utils/openai";
import { 
  insertUserSchema,
  insertProfileSchema,
  insertLinkSchema,
  userAuthSchema,
  linkUpdatePositionSchema
} from "@shared/schema";
import session from "express-session";
import { z, ZodError } from "zod";
import passport from "passport";
import { authRouter } from "./routes/authRoutes";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { fromZodError } from "zod-validation-error";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import jwt from 'jsonwebtoken';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
  
  // Set up auth routes
  app.use('/api/auth', authRouter);
  
  // Create an API router
  const apiRouter = express.Router();
  
  // Apply additional middleware for API routes
  apiRouter.use((req, res, next) => {
    // Log every API request for debugging
    console.log(`[API] ${req.method} ${req.path} - Session ID: ${req.sessionID}`);
    console.log(`[API] Cookie Header: ${req.headers.cookie}`);
    
    // Additional session debugging
    if (req.session) {
      console.log(`[API] Session exists: ${!!req.session}`);
      console.log(`[API] userId in session: ${req.session.userId || 'none'}`);
      console.log(`[API] passport in session: ${JSON.stringify(req.session.passport || 'none')}`);
    }
    
    next();
  });
  
  app.use('/api', apiRouter);

  // We already have CORS configured in index.ts, so we don't need to configure it again here.
  // Keeping this comment to document that CORS is intentionally configured only once.
  
  // Endpoint to check auth status from session
  apiRouter.get('/auth/me-from-session', async (req: Request, res: Response) => {
    try {
      console.log("=================== SESSION AUTH CHECK ===================");
      console.log("[express] Session auth check - Session ID:", req.sessionID);
      console.log("[express] Session auth check - Cookies:", req.headers.cookie);
      console.log("[express] Session auth check - Is Authenticated:", req.isAuthenticated());
      console.log("[express] Session auth check - userId in session:", req.session?.userId);
      console.log("[express] Session auth check - passport in session:", req.session?.passport);
      console.log("[express] Session auth check - User object:", req.user);
      console.log("[express] Session auth check - Session cookie settings:", req.session?.cookie);
      
      // Check for userId in all possible locations (dual storage for redundancy)
      const userId = req.session?.userId || req.session?.passport?.user;
      
      if (userId) {
        console.log("[express] Session auth check - Found userId in session:", userId);
        
        // We have the user ID but may need to fetch the full user data from the database
        let userData = req.user;
        
        // If req.user is not populated by Passport, fetch it from the database
        if (!userData) {
          console.log("[express] Fetching user data from database for ID:", userId);
          try {
            userData = await storage.getUser(Number(userId));
            if (!userData) {
              console.log("[express] ❌ User not found in database for ID:", userId);
              return res.json({ 
                isAuthenticated: false,
                user: null,
                error: "User not found in database"
              });
            }
            console.log("[express] ✅ User found in database:", userData.username);
          } catch (dbError) {
            console.error("[express] ❌ Database error fetching user:", dbError);
            return res.json({ 
              isAuthenticated: false,
              user: null,
              error: "Error fetching user from database"
            });
          }
        }
        
        // Success! Return the authenticated user
        console.log("[express] Session auth check - AUTHENTICATED with userData:", JSON.stringify(userData));
        return res.json({ 
          isAuthenticated: true, 
          user: userData
        });
      } else if (req.isAuthenticated() && req.user) {
        // Passport says we're authenticated but userId not explicitly set
        console.log("[express] Session auth check - Authenticated via Passport only");
        
        // Store the ID in both session formats for next time
        req.session.userId = (req.user as any).id;
        if (!req.session.passport?.user) {
          req.session.passport = { user: (req.user as any).id };
        }
        
        return res.json({ 
          isAuthenticated: true, 
          user: req.user
        });
      } else {
        // No authenticated user found in session or via Passport
        console.log("[express] Session auth check - NOT AUTHENTICATED");
        return res.json({ 
          isAuthenticated: false,
          user: null
        });
      }
    } catch (error) {
      console.error("Error in /auth/me-from-session:", error);
      return res.status(500).json({ 
        isAuthenticated: false,
        error: "Internal server error checking authentication status"
      });
    }
  });
  
  // Endpoint to logout 
  apiRouter.get('/auth/logout', (req: Request, res: Response) => {
    try {
      console.log("[express] Session logout - Before logout:", {
        session: req.session,
        isAuthenticated: req.isAuthenticated()
      });
      
      if (req.isAuthenticated()) {
        req.logout((err) => {
          if (err) {
            console.error("Error during logout:", err);
            return res.status(500).json({ success: false, message: "Error during logout" });
          }
          
          // Destroy the session completely
          req.session.destroy((err) => {
            if (err) {
              console.error("Error destroying session:", err);
              return res.status(500).json({ success: false, message: "Error destroying session" });
            }
            
            // Clear the session cookie
            res.clearCookie('linkybecky.sid');
            console.log("[express] Session logout - Complete");
            return res.json({ success: true, message: "Logged out successfully" });
          });
        });
      } else {
        console.log("[express] Session logout - Not authenticated");
        res.json({ success: true, message: "Not logged in" });
      }
    } catch (error) {
      console.error("Error in /auth/logout:", error);
      res.status(500).json({ success: false, message: "Internal server error during logout" });
    }
  });
  
  // Token-based authentication endpoint
  apiRouter.get('/auth/me', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log("[express] Token auth check - Missing or invalid authorization header");
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const token = authHeader.split(' ')[1];
      
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'linky-becky-secret-key') as any;
        console.log("[express] Token auth check - Decoded token:", decoded);
        
        if (typeof decoded === 'object' && decoded.id) {
          // Fetch fresh user data
          const user = await storage.getUser(decoded.id);
          
          if (!user) {
            console.log("[express] Token auth check - User not found for ID:", decoded.id);
            return res.status(404).json({ message: "User not found" });
          }
          
          console.log("[express] Token auth check - Success, returning user data:", user);
          return res.json(user);
        }
        
        console.log("[express] Token auth check - Invalid token payload");
        return res.status(401).json({ message: "Invalid token" });
      } catch (error) {
        console.error("[express] Token auth check - Error verifying token:", error);
        return res.status(401).json({ message: "Invalid token" });
      }
    } catch (error) {
      console.error("[express] Error in /api/auth/me endpoint:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Health check endpoint
  apiRouter.get('/health', async (req: Request, res: Response) => {
    try {
      console.log("[express] Health check request received");
      
      // Get detailed system health
      const health = await getSystemHealth();
      
      // Set appropriate status code based on health status
      const statusCode = health.status === 'healthy' ? 200 : 
                       health.status === 'degraded' ? 200 : 503;
      
      console.log(`[express] Health check completed with status: ${health.status}`);
      res.status(statusCode).json(health);
    } catch (error) {
      console.error("[express] Error in health check:", error);
      res.status(500).json({ 
        status: 'error',
        timestamp: new Date().toISOString(),
        message: 'Error performing health check',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Headers for cookies
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    next();
  });
  
  // Session middleware
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "linky-becky-session-secret",
      resave: true,
      saveUninitialized: true,
      rolling: true,
      name: 'linkybecky.sid',
      cookie: { 
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/',
        maxAge: 1000 * 60 * 60 * 24 * 7 // 1 week
      }
    })
  );

  // Passport initialization
  app.use(passport.initialize());
  app.use(passport.session());
  
  // Passport user serialization
  passport.serializeUser((user: any, done) => {
    // Standardize what we store in the session - just the ID
    console.log('Serializing user to session:', typeof user === 'object' ? user.id : user);
    const userId = typeof user === 'object' ? user.id : user;
    
    // Log serialization happening
    console.log(`✅ Serializing user ${userId} to session`);
    
    if (!userId) {
      console.error('❌ Cannot serialize user without ID:', user);
      return done(new Error('User ID is required for serialization'), null);
    }
    
    // Store just the ID in the session
    done(null, userId);
  });
  
  passport.deserializeUser(async (id: number, done) => {
    console.log('Deserializing user from session ID:', id);
    try {
      const user = await storage.getUser(id);
      if (!user) {
        console.log('❌ User not found during deserialization:', id);
        return done(null, false);
      }
      
      // Convert the user DB model to a plain object compatible with req.user
      const userObj = {
        id: user.id,
        email: user.email || '',
        username: user.username,
        name: user.name || '',
        bio: user.bio || '',
        avatar: user.avatar || '',
      };
      
      console.log('✅ User deserialized successfully:', userObj.username);
      return done(null, userObj);
    } catch (err) {
      console.error('❌ Error deserializing user:', err);
      return done(err, null);
    }
  });
  
  // Debug middleware
  app.use((req, res, next) => {
    console.log('Debug - Session ID:', req.sessionID);
    console.log('Debug - Session data:', req.session);
    console.log('Debug - Cookies:', req.headers.cookie);
    next();
  });

  // Google OAuth strategy
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
            console.log('🔍 Google OAuth processing for profile:', {
              id: profile.id,
              email: profile.emails?.[0]?.value,
              displayName: profile.displayName
            });
            
            // Check if user exists by Google ID
            let user = await storage.getUserByGoogleId(profile.id);
            if (user) {
              console.log('✅ Found existing user by Google ID:', user.id, user.username);
            }
            
            // If not found by Google ID, check by email
            const email = profile.emails?.[0]?.value || "";
            if (!user && email) {
              console.log('Looking up user by email:', email);
              user = await storage.getUserByEmail(email);
              
              // If user exists with this email but no Google ID, update with Google ID
              if (user) {
                console.log('Found user by email, updating with Google ID:', user.id);
                user = await storage.updateUser(user.id, {
                  googleId: profile.id,
                  avatar: profile.photos?.[0]?.value || user.avatar
                });
                console.log('User updated with Google ID:', user.id);
              }
            }
            
            // If pendingUsername is in session, use it
            let pendingUsername = '';
            
            // If still no user, create a new one
            if (!user) {
              console.log('Creating new user from Google profile');
              
              // Get a valid username - try to use display name first
              const displayNameUsername = profile.displayName?.toLowerCase().replace(/\s+/g, ".");
              const username = displayNameUsername || `user${Math.floor(Math.random() * 10000)}`;
              
              console.log('Creating user with username:', username);
              
              user = await storage.createUser({
                username,
                email,
                name: profile.displayName || email.split('@')[0] || 'User',
                googleId: profile.id,
                avatar: profile.photos?.[0]?.value || '',
                password: '', // No password for OAuth users
              });
              
              console.log('Created new user from Google OAuth:', user.id);
              
              // Create default profile
              const newProfile = await storage.createProfile({
                userId: user.id,
                theme: "light",
                backgroundColor: "#7c3aed",
                textColor: "#ffffff",
                fontFamily: "Inter",
                socialLinks: []
              });
              
              console.log('Created profile for new user:', newProfile.id);
            }
            
            console.log('✅ Google OAuth authentication success:', user.id, user.username);
            
            // Return the complete user object to be serialized
            return done(null, user);
          } catch (error) {
            console.error('❌ Error in Google OAuth strategy:', error);
            return done(error as Error, undefined);
          }
        }
      )
    );
  }

  // Helper function to handle ZodErrors
  const handleZodError = (error: unknown, res: Response) => {
    if (error instanceof ZodError) {
      const validationError = fromZodError(error);
      return res.status(400).json({ message: validationError.message });
    }
    console.error("Unexpected error:", error);
    return res.status(500).json({ message: "Internal server error" });
  };

  // Authentication Routes - SIMPLIFIED APPROACH
  app.get("/api/auth/google", (req, res, next) => {
    console.log('📣 Starting Google OAuth flow from browser');
    
    // Capture state parameter from the client
    const stateParam = req.query.state as string || '';
    console.log('State parameter received:', stateParam);
    
    // Store username in session if provided in query param
    if (req.query.username) {
      console.log('📝 Storing pendingUsername in session:', req.query.username);
      req.session.pendingUsername = req.query.username as string;
    }
    
    // Create a state object to pass through OAuth flow
    const stateObject = {
      redirectTime: Date.now(),
      csrfToken: Math.random().toString(36).substring(2, 15),
      pendingUsername: req.query.username as string || '',
      clientState: stateParam
    };
    
    // Force session save before continuing with authentication
    req.session.save((err) => {
      if (err) {
        console.error('❌ Failed to save session data:', err);
        return res.redirect('/auth/callback?error=session_error');
      } 
      
      console.log('✅ Session saved, proceeding with Google OAuth');
      
      // Continue with Google authentication - simplified approach
      passport.authenticate("google", { 
        scope: ["profile", "email"],
        // Pass state as stringified JSON to preserve through the OAuth flow
        state: JSON.stringify(stateObject)
      })(req, res, next);
    });
  });

  app.get(
    "/api/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/auth/callback?error=google_auth_failed" }),
    (req, res) => {
      dumpRequestInfo(req, 'GOOGLE OAUTH CALLBACK');
      console.log('📣 Google OAuth callback received');
      
      // Extract state if provided
      const stateParam = req.query.state as string;
      let pendingUsername = '';
      let clientState = '';
      
      if (stateParam) {
        try {
          const stateObj = JSON.parse(stateParam);
          pendingUsername = stateObj.pendingUsername || '';
          clientState = stateObj.clientState || '';
          console.log('📝 Extracted from state:', { pendingUsername, clientState });
        } catch (e) {
          console.error('❌ Failed to parse state parameter:', e);
        }
      }
      
      // Also check session for pendingUsername
      if (!pendingUsername && req.session.pendingUsername) {
        pendingUsername = req.session.pendingUsername;
        console.log('📝 Found pendingUsername in session:', pendingUsername);
      }
      
      // Ensure the user object exists
      if (!req.user) {
        console.error("❌ OAuth callback: User object is missing");
        return res.redirect("/auth/callback?error=authentication_failed");
      }
      
      // Get user ID and save it to session
      const userId = (req.user as any)?.id;
      console.log(`✅ Google OAuth successful for user ID: ${userId}`);
      
      if (!userId) {
        console.error("❌ OAuth callback: User ID is missing");
        return res.redirect("/auth/callback?error=user_id_missing");
      }
      
      // For debugging - log the session before we modify it
      console.log('Session before modification:', JSON.stringify(req.session, null, 2));
      
      // SIMPLIFIED APPROACH - Just generate token and redirect to callback handler
      console.log('Using simplified token approach...');
      
      // Generate JWT token with the user data
      const token = generateToken({
        id: userId,
        email: (req.user as any).email || '',
        username: (req.user as any).username || '',
      });
      
      console.log(`✅ Generated JWT token (length: ${token.length})`);
      
      // Redirect to the callback-redirect endpoint with the token
      const redirectParams = new URLSearchParams({
        token: token
      });
      
      // Add username if available
      if (pendingUsername) {
        redirectParams.append('username', pendingUsername);
      }
      
      // Add state if provided by client
      if (clientState) {
        redirectParams.append('state', clientState);
      }
      
      // Build final redirect URL
      const redirectUrl = `/api/auth/callback-redirect?${redirectParams.toString()}`;
      
      console.log(`✅ Redirecting to: ${redirectUrl}`);
      res.redirect(redirectUrl);
    }
  );
  
  // Callback-redirect endpoint - this is the endpoint that receives the token from the OAuth callback
  // and redirects to the frontend with the token in the URL
  app.get("/api/auth/callback-redirect", (req, res) => {
    dumpRequestInfo(req, 'CALLBACK REDIRECT ENDPOINT');
    console.log('📣 Callback redirect endpoint called');
    
    // Extract token from query params
    const token = req.query.token as string;
    const username = req.query.username as string;
    const state = req.query.state as string;
    
    console.log(`✅ Token received (length: ${token ? token.length : 0})`);
    if (username) console.log(`✅ Username received: ${username}`);
    if (state) console.log(`✅ State received: ${state}`);
    
    if (!token) {
      console.error("❌ No token provided in callback-redirect");
      return res.redirect("/auth/redirect?error=no_token");
    }
    
    // Redirect to frontend auth-redirect page with token
    // We use window.location instead of React Router to ensure a full page reload
    // This forces the token to be read from the URL and stored in localStorage
    const clientRedirectUrl = `/auth/redirect?token=${encodeURIComponent(token)}`;
    
    console.log(`✅ Redirecting to client: ${clientRedirectUrl}`);
    res.redirect(clientRedirectUrl);
  });
  
  // Token endpoint
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
        console.log(`✅ Found userId in passport: ${userId}`);
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

  // Login endpoint
  app.post("/api/auth/login", async (req, res) => {
    try {
      console.log("Login attempt with:", { email: req.body.email });
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }
      
      // Find user by email
      const user = await storage.getUserByEmail(email);
      
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      
      // In a real app, validate password here with bcrypt.compare
      // For now, we'll skip actual password validation
      
      // Create token - using simpleAuth for token generation
      const token = generateToken({
        id: user.id,
        email: user.email,
        username: user.username
      });
      
      console.log(`✅ Login successful for user ID: ${user.id}`);
      
      // Return token directly in response - no cookies or sessions
      res.json({ 
        message: "Login successful",
        token, 
        user: { 
          id: user.id, 
          username: user.username, 
          email: user.email,
          name: user.name,
          bio: user.bio || "",
          avatar: user.avatar || ""
        } 
      });
    } catch (error) {
      console.error("Error in login:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Logout endpoint - simplified for token-based auth
  app.post("/api/auth/logout", (req, res) => {
    // With token-based auth, logout is handled on the client side
    // by removing the token from localStorage
    res.json({ message: "Logged out successfully" });
  });
  
  // User validation endpoint - using simpleAuth middleware
  app.get("/api/auth/validate", authenticate, (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    res.json({
      user: {
        id: req.user.id,
        username: req.user.username,
        email: req.user.email,
        name: req.user.name || "",
        bio: req.user.bio || "",
        avatar: req.user.avatar || ""
      }
    });
  });
  
  // Get current user endpoint - used by auth context
  app.get("/api/auth/me", authenticate, async (req, res) => {
    try {
      console.log("🔍 GET /api/auth/me called with token auth");
      
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Get user from storage with full profile
      const user = await storage.getUser(req.user.id);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Return user data
      res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name || "",
        bio: user.bio || "",
        avatar: user.avatar || ""
      });
    } catch (error) {
      console.error("❌ Error in /api/auth/me:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // User registration endpoint
  app.post("/api/users", async (req, res) => {
    try {
      const userData = userAuthSchema.parse(req.body);
      
      // Check if username is available
      const existingUsername = await storage.getUserByUsername(userData.username);
      if (existingUsername) {
        return res.status(409).json({ message: "Username is already taken" });
      }
      
      // Check if email is available
      const existingEmail = await storage.getUserByEmail(userData.email);
      if (existingEmail) {
        return res.status(409).json({ message: "Email is already registered" });
      }
      
      // Create user
      const user = await storage.createUser({
        username: userData.username,
        email: userData.email,
        name: userData.name || userData.username,
        password: userData.password,
        bio: "",
        avatar: ""
      });
      
      // Create default profile
      const profile = await storage.createProfile({
        userId: user.id,
        theme: "light",
        backgroundColor: "#7c3aed",
        textColor: "#ffffff",
        fontFamily: "Inter",
        socialLinks: []
      });
      
      // Generate token
      const token = generateToken({
        id: user.id,
        email: user.email,
        username: user.username
      });
      
      // Set token in session
      req.session.userId = user.id;
      if (!req.session.passport) {
        req.session.passport = { user: user.id };
      }
      
      // Set token in cookie
      res.cookie('auth_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week
        path: '/'
      });
      
      // Save session before response
      req.session.save((err) => {
        if (err) {
          console.error("Error saving session:", err);
        }
        
        // Return user and token
        res.status(201).json({
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            name: user.name,
            bio: user.bio || "",
            avatar: user.avatar || ""
          },
          token
        });
      });
    } catch (error) {
      // Handle validation errors
      handleZodError(error, res);
    }
  });
  
  // Check username availability
  apiRouter.get("/username/availability/:username", async (req: Request, res: Response) => {
    try {
      const { username } = req.params;
      
      if (!username) {
        return res.status(400).json({ message: "Username is required" });
      }
      
      // Validate username format
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
        return res.status(400).json({ 
          available: false,
          message: "Username must be 3-20 characters and only contain letters, numbers, and underscores." 
        });
      }
      
      const existingUser = await storage.getUserByUsername(username);
      
      return res.json({
        available: !existingUser,
        message: existingUser ? "Username is already taken" : "Username is available"
      });
    } catch (error) {
      console.error("Error checking username availability:", error);
      res.status(500).json({ message: "Failed to check username availability" });
    }
  });
  
  // User profile routes
  app.get("/api/users/:id", async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({
        id: user.id,
        username: user.username,
        name: user.name,
        bio: user.bio || "",
        avatar: user.avatar || ""
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Update user profile
  app.patch("/api/users/:id", authenticateToken, validateUser, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      
      // Ensure the authenticated user can only update their own profile
      if (userId !== req.user!.id) {
        return res.status(403).json({ message: "Unauthorized to update this user" });
      }
      
      const { name, bio, avatar } = req.body;
      
      // Create update object with provided fields
      const updateData: Partial<any> = {};
      if (name !== undefined) updateData.name = name;
      if (bio !== undefined) updateData.bio = bio;
      if (avatar !== undefined) updateData.avatar = avatar;
      
      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: "No valid fields to update" });
      }
      
      const updatedUser = await storage.updateUser(userId, updateData);
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({
        id: updatedUser.id,
        username: updatedUser.username,
        name: updatedUser.name,
        bio: updatedUser.bio || "",
        avatar: updatedUser.avatar || "",
        email: updatedUser.email
      });
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Get public profile by username
  app.get("/api/username/:username", async (req, res) => {
    try {
      const { username } = req.params;
      const user = await storage.getUserByUsername(username);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Get profile data
      const profile = await storage.getProfile(user.id);
      
      if (!profile) {
        return res.status(404).json({ message: "Profile not found" });
      }
      
      // Get user's links
      const links = await storage.getLinks(user.id);
      
      // Only return enabled links to the public
      const enabledLinks = links.filter(link => link.enabled).sort((a, b) => a.position - b.position);
      
      res.json({
        user: {
          username: user.username,
          name: user.name,
          bio: user.bio || "",
          avatar: user.avatar || ""
        },
        profile: {
          theme: profile.theme,
          backgroundColor: profile.backgroundColor,
          textColor: profile.textColor,
          fontFamily: profile.fontFamily,
          socialLinks: profile.socialLinks || []
        },
        links: enabledLinks.map(link => ({
          id: link.id,
          title: link.title,
          url: link.url,
          shortUrl: link.shortUrl,
          description: link.description || "",
          iconType: link.iconType,
          position: link.position
        }))
      });
    } catch (error) {
      console.error("Error fetching public profile:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Profile routes
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
  
  app.patch("/api/profile", authenticateToken, validateUser, async (req, res) => {
    try {
      const { theme, backgroundColor, textColor, fontFamily, socialLinks, customDomain } = req.body;
      
      // Create update object with provided fields
      const updateData: Partial<any> = {};
      if (theme !== undefined) updateData.theme = theme;
      if (backgroundColor !== undefined) updateData.backgroundColor = backgroundColor;
      if (textColor !== undefined) updateData.textColor = textColor;
      if (fontFamily !== undefined) updateData.fontFamily = fontFamily;
      if (socialLinks !== undefined) updateData.socialLinks = socialLinks;
      if (customDomain !== undefined) updateData.customDomain = customDomain;
      
      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: "No valid fields to update" });
      }
      
      const updatedProfile = await storage.updateProfile(req.user!.id, updateData);
      
      if (!updatedProfile) {
        return res.status(404).json({ message: "Profile not found" });
      }
      
      res.json(updatedProfile);
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Link routes
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
    console.log("📑 Link creation request received", {
      userId: req.user?.id,
      userEmail: req.user?.email,
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip || req.socket.remoteAddress,
      timestamp: new Date().toISOString()
    });
    
    try {
      // Log request body (sanitized for security)
      console.log("📥 Link creation request data:", {
        title: req.body.title,
        url: req.body.url,
        iconType: req.body.iconType,
        hasDescription: !!req.body.description,
        hasUtmParams: !!(req.body.utmSource || req.body.utmMedium || req.body.utmCampaign),
        timestamp: new Date().toISOString()
      });
      
      // Get userId from the authenticated user
      const userId = req.user!.id;
      if (!userId) {
        console.error("❌ Missing userId for link creation");
        return res.status(400).json({ message: "User ID is required" });
      }
      
      // Get max position for new link
      const existingLinks = await storage.getLinks(userId);
      const maxPosition = existingLinks.length > 0 
        ? Math.max(...existingLinks.map(link => link.position)) + 1 
        : 0;
      
      console.log(`📊 User has ${existingLinks.length} existing links, new position will be ${maxPosition}`);
      
      // Add userId and position to request body before validation
      const completeData = {
        ...req.body,
        userId: userId,
        position: maxPosition
      };
      
      // Now validate the complete data
      let parsedData;
      try {
        console.log("🔍 Validating link data with schema");
        parsedData = insertLinkSchema.parse(completeData);
        console.log("✅ Link validation successful");
      } catch (validationError) {
        console.error("❌ Link validation failed:", validationError);
        if (validationError instanceof ZodError) {
          const formattedError = fromZodError(validationError);
          return res.status(400).json({ 
            error: 'Validation error', 
            message: formattedError.message,
            details: validationError.errors
          });
        }
        return res.status(400).json({ 
          error: 'Invalid data', 
          message: 'The provided link data is invalid'
        });
      }
        
      // Create link with userId and position
      const linkData = parsedData;
      
      // If UTM parameters are provided, add them to the URL
      let originalUrl = linkData.url;
      if (linkData.utmSource || linkData.utmMedium || linkData.utmCampaign || 
          linkData.utmTerm || linkData.utmContent) {
        console.log("🔗 Adding UTM parameters to URL");
        const utmParams = {
          source: linkData.utmSource,
          medium: linkData.utmMedium,
          campaign: linkData.utmCampaign,
          term: linkData.utmTerm,
          content: linkData.utmContent
        };
        linkData.url = addUtmParameters(linkData.url, utmParams);
        console.log(`🔗 URL with UTM params: Original URL: ${originalUrl} → Modified URL: ${linkData.url}`);
      }
      
      // Generate shortened URL if LinkyVicky integration is enabled
      if (process.env.LINKYVICKY_API_KEY) {
        console.log("🔄 LinkyVicky API Key found, attempting to shorten URL");
        try {
          console.log(`🔍 Shortening URL with LinkyVicky: ${linkData.url}`);
          const shortenStart = Date.now();
          const shortenedData = await shortenUrl(linkData.url);
          const shortenDuration = Date.now() - shortenStart;
          linkData.shortUrl = shortenedData.shortUrl;
          console.log(`✅ URL shortened successfully in ${shortenDuration}ms:`, {
            originalUrl: linkData.url,
            shortUrl: shortenedData.shortUrl,
            qrCodeAvailable: !!shortenedData.qrCodeUrl
          });
        } catch (shortenError) {
          console.error("❌ Error shortening URL:", {
            error: shortenError instanceof Error ? shortenError.message : String(shortenError),
            url: linkData.url,
            apiKeyConfigured: !!process.env.LINKYVICKY_API_KEY,
            timestamp: new Date().toISOString()
          });
          // Continue without shortened URL
        }
      } else {
        console.log("ℹ️ LinkyVicky API Key not configured, skipping URL shortening");
      }
      
      console.log("💾 Saving link to database");
      const dbSaveStart = Date.now();
      const link = await storage.createLink(linkData);
      const dbSaveDuration = Date.now() - dbSaveStart;
      console.log(`✅ Link saved successfully in ${dbSaveDuration}ms with ID: ${link.id}`);
      
      res.status(201).json(link);
      console.log("📤 Link creation response sent:", {
        linkId: link.id,
        title: link.title,
        hasShortUrl: !!link.shortUrl,
        statusCode: 201,
        timestamp: new Date().toISOString()
      });
    } catch (error: unknown) {
      console.error("❌ Link creation failed:", {
        error: error instanceof Error ? error.message : String(error),
        type: error instanceof Error ? error.constructor.name : 'Unknown',
        validationError: error instanceof ZodError,
        timestamp: new Date().toISOString()
      });
      handleZodError(error, res);
    }
  });
  
  app.get("/api/links/:id", authenticateToken, validateUser, async (req, res) => {
    try {
      const linkId = parseInt(req.params.id);
      const link = await storage.getLink(linkId);
      
      if (!link) {
        return res.status(404).json({ message: "Link not found" });
      }
      
      // Ensure user can only access their own links
      if (link.userId !== req.user!.id) {
        return res.status(403).json({ message: "Unauthorized to access this link" });
      }
      
      res.json(link);
    } catch (error) {
      console.error("Error fetching link:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.patch("/api/links/:id", authenticateToken, validateUser, async (req, res) => {
    try {
      const linkId = parseInt(req.params.id);
      
      // Verify the link exists and belongs to the user
      const existingLink = await storage.getLink(linkId);
      
      if (!existingLink) {
        return res.status(404).json({ message: "Link not found" });
      }
      
      if (existingLink.userId !== req.user!.id) {
        return res.status(403).json({ message: "Unauthorized to update this link" });
      }
      
      // Create update object
      const updateData: Partial<any> = {};
      
      // List of fields that can be updated
      const updatableFields = [
        'title', 'url', 'description', 'iconType', 
        'position', 'enabled', 'utmSource', 'utmMedium', 
        'utmCampaign', 'utmTerm', 'utmContent'
      ];
      
      // Add provided fields to update data
      for (const field of updatableFields) {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      }
      
      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: "No valid fields to update" });
      }
      
      // If URL is being updated, regenerate shortened URL
      if (updateData.url) {
        // If UTM parameters are provided, add them to the URL
        if (updateData.utmSource || updateData.utmMedium || updateData.utmCampaign || 
            updateData.utmTerm || updateData.utmContent || 
            existingLink.utmSource || existingLink.utmMedium || existingLink.utmCampaign || 
            existingLink.utmTerm || existingLink.utmContent) {
          
          const utmParams = {
            source: updateData.utmSource || existingLink.utmSource,
            medium: updateData.utmMedium || existingLink.utmMedium,
            campaign: updateData.utmCampaign || existingLink.utmCampaign,
            term: updateData.utmTerm || existingLink.utmTerm,
            content: updateData.utmContent || existingLink.utmContent
          };
          
          updateData.url = addUtmParameters(updateData.url, utmParams);
        }
        
        // Generate shortened URL if LinkyVicky integration is enabled
        if (process.env.LINKYVICKY_API_KEY) {
          try {
            console.log("Shortening updated URL with LinkyVicky:", updateData.url);
            const shortenedData = await shortenUrl(updateData.url);
            updateData.shortUrl = shortenedData.shortUrl;
            console.log("URL shortened successfully:", shortenedData.shortUrl);
          } catch (shortenError) {
            console.error("Error shortening URL:", shortenError);
            // Continue without shortened URL
          }
        }
      }
      
      const updatedLink = await storage.updateLink(linkId, updateData);
      
      if (!updatedLink) {
        return res.status(500).json({ message: "Failed to update link" });
      }
      
      res.json(updatedLink);
    } catch (error) {
      console.error("Error updating link:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.delete("/api/links/:id", authenticateToken, validateUser, async (req, res) => {
    try {
      const linkId = parseInt(req.params.id);
      
      // Verify the link exists and belongs to the user
      const existingLink = await storage.getLink(linkId);
      
      if (!existingLink) {
        return res.status(404).json({ message: "Link not found" });
      }
      
      if (existingLink.userId !== req.user!.id) {
        return res.status(403).json({ message: "Unauthorized to delete this link" });
      }
      
      const result = await storage.deleteLink(linkId);
      
      if (!result) {
        return res.status(500).json({ message: "Failed to delete link" });
      }
      
      res.json({ message: "Link deleted successfully" });
    } catch (error) {
      console.error("Error deleting link:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Update link positions
  app.patch("/api/links/positions", authenticateToken, validateUser, async (req, res) => {
    try {
      const { positions } = req.body;
      
      // Validate the positions data
      const validationResult = linkUpdatePositionSchema.safeParse({ positions });
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid positions data format",
          errors: validationResult.error.format()
        });
      }
      
      // Update link positions
      const result = await storage.updateLinkPositions(req.user!.id, positions);
      
      if (!result) {
        return res.status(500).json({ message: "Failed to update link positions" });
      }
      
      // Get updated links
      const updatedLinks = await storage.getLinks(req.user!.id);
      
      res.json(updatedLinks);
    } catch (error) {
      console.error("Error updating link positions:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Link click tracking
  app.post("/api/links/click/:id", async (req, res) => {
    try {
      const linkId = parseInt(req.params.id);
      const { country, device, browser, referer } = req.body;
      
      // Record click
      await storage.recordClick({
        linkId,
        country: country || "Unknown",
        device: device || "Unknown",
        browser: browser || "Unknown",
        referer: referer || ""
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

  // Add a catch-all route to handle user profile URLs in the format /@username
  // This should be the LAST route before returning the httpServer
  app.get('/@:username', async (req, res, next) => {
    console.log(`Caught request for user profile: @${req.params.username}`);
    
    try {
      // Check if this username exists first
      const username = req.params.username;
      const user = await storage.getUserByUsername(username);
      
      if (!user) {
        console.warn(`Profile not found for username: @${username}`);
        // We'll still serve the index.html but the frontend will show a "user not found" message
      } else {
        console.log(`Valid profile request for: @${username} (User ID: ${user.id})`);
      }
      
      // In development mode, let Vite handle this
      if (process.env.NODE_ENV === 'development') {
        return next();
      }
      
      // In production, we need to manually serve the index.html file
      const distPath = path.resolve(__dirname, "../client/dist");
      console.log(`Serving index.html from ${distPath} for profile @${username}`);
      return res.sendFile(path.resolve(distPath, "index.html"));
    } catch (error) {
      console.error('Error handling user profile page:', error);
      next(error);
    }
  });

  return httpServer;
}