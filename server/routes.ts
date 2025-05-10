import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { authenticateToken, validateUser, generateToken } from "./middleware/auth";
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

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Set up session middleware
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "linky-becky-session-secret",
      resave: false,
      saveUninitialized: false,
      cookie: { 
        secure: process.env.NODE_ENV === "production",
        maxAge: 1000 * 60 * 60 * 24 * 7 // 1 week
      }
    })
  );

  // Initialize Passport
  app.use(passport.initialize());
  app.use(passport.session());

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
      req.session.userId = (req.user as any)?.id;
      // Instead of handling username update here, we'll redirect to a frontend callback page
      // that will handle username retrieval from sessionStorage
      res.redirect("/auth/callback");
    }
  );
  
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

  app.get("/api/auth/me", authenticateToken, async (req, res) => {
    try {
      const user = await storage.getUser(req.user!.id);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({ 
        id: user.id, 
        username: user.username, 
        email: user.email,
        name: user.name,
        avatar: user.avatar
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Internal server error" });
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
