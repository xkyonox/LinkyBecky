import express, { Request, Response } from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { storage } from '../storage';
import { generateToken } from '../middleware/simpleAuth';

const authRouter = express.Router();

// Initialize Google Strategy if credentials are available
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
            return done(null, user);
          }
          
          // If not found by Google ID, check by email
          const email = profile.emails?.[0]?.value || "";
          if (!email) {
            return done(new Error('Email is required'), undefined);
          }
          
          user = await storage.getUserByEmail(email);
          if (user) {
            // Update existing user with Google ID
            user = await storage.updateUser(user.id, { googleId: profile.id }) || user;
            console.log('✅ Updated existing user with Google ID:', user.id, user.username);
            return done(null, user);
          }
          
          // Create new user if not found
          const username = `user_${profile.id.substring(0, 8)}`;
          
          const newUser = await storage.createUser({
            email,
            googleId: profile.id,
            username,
            name: profile.displayName || username,
            avatar: profile.photos?.[0]?.value || '',
          });
          
          console.log('✅ Created new user:', newUser.id, newUser.username);
          
          // Create profile for the new user
          await storage.createProfile({
            userId: newUser.id,
            theme: 'default',
            backgroundColor: '#ffffff',
            textColor: '#000000',
            fontFamily: 'Inter',
            socialLinks: []
          });
          
          return done(null, newUser);
        } catch (error) {
          console.error('❌ Error in Google strategy:', error);
          return done(error as Error, undefined);
        }
      }
    )
  );
}

// Storage for pending usernames during OAuth flow
const pendingUsernames = new Map<string, string>();

// Start Google OAuth flow
authRouter.get('/google', (req, res, next) => {
  // Store username in session if provided in query param
  const pendingUsername = req.query.username as string | undefined;
  
  // Store in memory for the callback using a random state value
  if (pendingUsername) {
    const state = Math.random().toString(36).substring(2, 15);
    pendingUsernames.set(state, pendingUsername);
    console.log('📝 Storing pendingUsername in memory:', pendingUsername, 'with state:', state);
    
    // Pass state to Google OAuth
    passport.authenticate('google', {
      scope: ['profile', 'email'],
      state
    })(req, res, next);
  } else {
    passport.authenticate('google', {
      scope: ['profile', 'email']
    })(req, res, next);
  }
});

// Google OAuth callback
authRouter.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/?error=google_auth_failed' }),
  (req: Request, res: Response) => {
    try {
      if (!req.user) {
        console.error("❌ OAuth callback: User object is missing");
        return res.redirect("/?error=authentication_failed");
      }
      
      // Get user info
      const user = req.user as any;
      const userId = user.id;
      
      if (!userId) {
        console.error("❌ OAuth callback: User ID is missing");
        return res.redirect("/?error=user_id_missing");
      }
      
      // Get state from the query params
      const state = req.query.state as string | undefined;
      let pendingUsername;
      
      // Get pending username from memory
      if (state && pendingUsernames.has(state)) {
        pendingUsername = pendingUsernames.get(state);
        // Clean up
        pendingUsernames.delete(state);
        
        // Update user with the pending username
        storage.updateUser(userId, { username: pendingUsername })
          .then(() => {
            console.log(`✅ Updated user ${userId} with pendingUsername: ${pendingUsername}`);
          })
          .catch(err => {
            console.error(`❌ Failed to update username for user ${userId}:`, err);
          });
      }
      
      // Generate JWT token
      const token = generateToken({
        id: userId,
        email: user.email || '',
        username: user.username || '',
      });
      
      // Redirect to frontend with the token
      console.log(`✅ Authentication successful for user ID: ${userId}`);
      
      // Redirect to callback with token
      let redirectUrl = "/auth/callback";
      
      // Add token and username as query params
      redirectUrl += `?token=${encodeURIComponent(token)}`;
      if (pendingUsername) {
        redirectUrl += `&username=${encodeURIComponent(pendingUsername)}`;
      } else if (user.username) {
        redirectUrl += `&username=${encodeURIComponent(user.username)}`;
      }
      
      res.redirect(redirectUrl);
    } catch (error) {
      console.error("❌ Error in OAuth callback:", error);
      res.redirect("/?error=callback_error");
    }
  }
);

// Auth callback endpoint for browser to parse token
authRouter.get('/callback', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Authentication Successful</title>
        <script>
          // Parse token from URL
          const params = new URLSearchParams(window.location.search);
          const token = params.get('token');
          const username = params.get('username');
          
          if (token) {
            // Store token in localStorage
            localStorage.setItem('auth_token', token);
            if (username) {
              localStorage.setItem('username', username);
            }
            
            // Redirect to dashboard or profile
            const redirectTo = username ? '/dashboard' : '/';
            window.location.href = redirectTo;
          } else {
            // Redirect to home if no token
            window.location.href = '/?error=no_token';
          }
        </script>
      </head>
      <body>
        <p>Authentication successful. Redirecting...</p>
      </body>
    </html>
  `);
});

// Check auth status
authRouter.get('/me', (req: Request, res: Response) => {
  // This route will be protected by the auth middleware
  return res.json(req.user);
});

// Logout endpoint
authRouter.get('/logout', (req: Request, res: Response) => {
  // Just return success since we're using token-based auth
  res.json({ success: true, message: 'Logged out successfully' });
});

export default authRouter;