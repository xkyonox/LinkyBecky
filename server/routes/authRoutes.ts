import express, { Request, Response, Router } from 'express';
import { z } from 'zod';
import { OAuth2Client } from 'google-auth-library';
import { storage } from '../storage';
import { userAuthSchema } from '@shared/schema';
import { generateToken, authenticate } from '../middleware/simpleAuth';
import 'express-session';

// Extend Express session type to include our Google data
declare module 'express-session' {
  interface SessionData {
    pendingUsername?: string;
    googleData?: {
      googleId: string;
      email: string;
      name: string;
      picture: string;
    };
  }
}

const router = Router();

// Enhanced callback-redirect endpoint
router.get('/callback-redirect', (req: Request, res: Response) => {
  try {
    const { token, username, error, state } = req.query;
    
    console.log('=====================================================');
    console.log('CALLBACK-REDIRECT ENDPOINT CALLED');
    console.log('Protocol:', req.protocol);
    console.log('Headers host:', req.headers.host);
    console.log('Full URL:', req.originalUrl);
    console.log('Redirecting with authentication data:', { 
      hasToken: !!token, 
      tokenLength: token ? (token as string).length : 0,
      username, 
      hasState: !!state,
      error 
    });
    
    // Create a URL with token in query params for the client to process
    const clientCallbackUrl = new URL('/auth/callback', `${req.protocol}://${req.headers.host}`);
    console.log('Base client callback URL:', clientCallbackUrl.toString());
    
    // Add all parameters that were provided
    if (error) {
      clientCallbackUrl.searchParams.append('error', error as string);
      console.log('Added error param:', error);
    }
    
    if (token) {
      clientCallbackUrl.searchParams.append('token', token as string);
      console.log('Added token param (length):', (token as string).length);
    }
    
    if (username) {
      clientCallbackUrl.searchParams.append('username', username as string);
      console.log('Added username param:', username);
    }
    
    // Pass through any state parameter from the client
    if (state) {
      clientCallbackUrl.searchParams.append('state', state as string);
      console.log('Added client state param');
    }
    
    console.log('Final redirect URL:', clientCallbackUrl.toString());
    console.log('=====================================================');
    
    // Add cache control headers to prevent any caching of this redirect
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Redirect to the client app with the token
    return res.redirect(clientCallbackUrl.toString());
  } catch (error) {
    console.error('Error in /auth/callback-redirect:', error);
    return res.redirect('/auth/callback?error=Server+error');
  }
});

// Google OAuth client
const googleClient = new OAuth2Client({
  clientId: process.env.GOOGLE_CLIENT_ID,
});

// Validate that required env vars are set
const googleOAuthEnabled = !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

// Schema for validating login credentials
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

// Schema for validating Google sign-in token
const googleSignInSchema = z.object({
  token: z.string(),
});

// Schema for validating username availability
const usernameSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
});

// Get the currently authenticated user
router.get('/me', authenticate, (req: Request, res: Response) => {
  console.log('\n===== /API/AUTH/ME ENDPOINT =====');
  console.log('Headers:', req.headers);
  console.log('Auth header:', req.headers.authorization);
  
  try {
    // req.user is set by the authenticate middleware
    if (!req.user) {
      console.log('User NOT authenticated - req.user is null');
      return res.status(401).json({ error: 'Not authenticated' });
    }

    console.log('User authenticated:', req.user);
    const responseData = {
      id: req.user.id,
      email: req.user.email,
      username: req.user.username
    };
    console.log('Returning user data:', responseData);
    console.log('===== END /API/AUTH/ME =====\n');
    
    return res.json(responseData);
  } catch (error) {
    console.error('Error in /auth/me:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Validate token endpoint - just returns user data if the token is valid
router.get('/validate', authenticate, (req: Request, res: Response) => {
  try {
    // If we get here, the token is valid (authenticate middleware validated it)
    // Check if user data exists in req.user
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Invalid token',
        isValid: false
      });
    }
    
    return res.json({
      user: {
        id: req.user.id,
        email: req.user.email,
        username: req.user.username
      },
      isValid: true
    });
  } catch (error) {
    console.error('Error in /auth/validate:', error);
    return res.status(401).json({ 
      error: 'Invalid token',
      isValid: false
    });
  }
});

// Login endpoint - authenticates user with email and password
router.post('/login', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const result = loginSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ 
        error: 'Invalid credentials', 
        details: result.error.errors 
      });
    }

    const { email, password } = result.data;

    // Find user by email
    const user = await storage.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password (assuming a password field exists in the user model)
    // In a real app, you'd use bcrypt.compare or similar
    if (user.password !== password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = generateToken({
      id: user.id,
      email: user.email,
      username: user.username
    });

    // If this is a browser request with Accept header that includes text/html,
    // redirect to the client with token in query params
    if (req.headers.accept?.includes('text/html')) {
      return res.redirect(`/api/auth/callback-redirect?token=${encodeURIComponent(token)}&username=${encodeURIComponent(user.username)}`);
    }
    
    // For API clients, return JSON response
    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Error in /auth/login:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Google sign-in endpoint
router.post('/google', async (req: Request, res: Response) => {
  console.log("====== /auth/google ENDPOINT CALLED ======");
  console.log("Request headers:", req.headers);
  console.log("Request body:", req.body);
  console.log("Google OAuth enabled:", googleOAuthEnabled);
  console.log("Google Client ID available:", !!process.env.GOOGLE_CLIENT_ID);
  
  try {
    if (!googleOAuthEnabled) {
      console.log("Google OAuth not configured, returning 503");
      return res.status(503).json({ error: 'Google OAuth is not configured' });
    }

    // Validate request body
    console.log("Validating request body...");
    const result = googleSignInSchema.safeParse(req.body);
    if (!result.success) {
      console.log("Invalid request body:", result.error.errors);
      return res.status(400).json({ 
        error: 'Invalid token', 
        details: result.error.errors 
      });
    }

    const { token } = result.data;
    console.log("Token received, verifying with Google...");

    // Verify Google token
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    console.log("Token payload received:", payload ? "YES" : "NO");
    if (!payload || !payload.email) {
      console.log("Invalid or missing payload from Google token");
      return res.status(400).json({ error: 'Invalid Google token' });
    }
    
    console.log("Token verified successfully with payload");
    const { email, name, picture } = payload;
    const googleId = payload.sub;
    console.log("User info from Google:", { email, name: name || "N/A", googleId, hasPicture: !!picture });

    // Find existing user by Google ID or email
    console.log("Looking for existing user by Google ID:", googleId);
    let user = await storage.getUserByGoogleId(googleId);
    
    if (!user) {
      console.log("User not found by Google ID, checking by email:", email);
      // Check if user exists with this email
      user = await storage.getUserByEmail(email!);
      
      if (user) {
        console.log("User found by email, updating with Google ID");
        // Update existing user with Google ID
        user = await storage.updateUser(user.id, { googleId });
      }
    }

    if (!user) {
      console.log("New user, needs to create username");
      // New user registration - need a username
      // For now, generate a pending username based on email
      // Store in session for later username selection step
      let pendingUsername = email!.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
      console.log("Generated pending username:", pendingUsername);
      
      // Store in session for username selection step
      req.session.pendingUsername = pendingUsername;
      req.session.googleData = {
        googleId,
        email: email!,
        name: name || '',
        picture: picture || ''
      };
      
      console.log("Stored in session:", req.session.googleData);
      console.log("Redirecting to username selection");
      
      // Redirect to username selection
      return res.json({
        needUsername: true,
        suggestedUsername: pendingUsername
      });
    }

    console.log("Existing user found, generating token");
    // Generate token for existing user
    const authToken = generateToken({
      id: user.id,
      email: user.email,
      username: user.username
    });

    console.log("Token generated, redirecting to callback handler");
    console.log("Redirect URL:", `/api/auth/callback-redirect?token=${encodeURIComponent(authToken)}&username=${encodeURIComponent(user.username)}`);
    
    // Redirect to client with token
    return res.redirect(`/api/auth/callback-redirect?token=${encodeURIComponent(authToken)}&username=${encodeURIComponent(user.username)}`);
    
    // Alternative JSON response for non-browser clients
    /* return res.json({
      token: authToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    }); */
  } catch (error) {
    console.error('Error in /auth/google:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Complete Google sign-in with chosen username
router.post('/complete-google-signup', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const result = usernameSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ 
        error: 'Invalid username', 
        details: result.error.errors 
      });
    }

    const { username } = result.data;

    // Check if username is available
    const existingUser = await storage.getUserByUsername(username);
    if (existingUser) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    // Check if we have pending Google data in session
    if (!req.session.googleData) {
      return res.status(400).json({ error: 'No pending Google signup' });
    }

    const { googleId, email, name, picture } = req.session.googleData;

    // Create new user
    const user = await storage.createUser({
      username,
      email,
      name,
      googleId,
      avatar: picture
    });

    // Create user profile
    await storage.createProfile({
      userId: user.id,
      theme: 'default',
      backgroundColor: '#ffffff', 
      textColor: '#000000'
    });

    // Clear session data
    delete req.session.googleData;
    delete req.session.pendingUsername;

    // Generate JWT token
    const token = generateToken({
      id: user.id,
      email: user.email,
      username: user.username
    });

    // Redirect to client with token
    return res.redirect(`/api/auth/callback-redirect?token=${encodeURIComponent(token)}&username=${encodeURIComponent(user.username)}`);
    
    // Alternative JSON response for non-browser clients
    /* return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    }); */
  } catch (error) {
    console.error('Error in /auth/complete-google-signup:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Check username availability
router.get('/username-available/:username', async (req: Request, res: Response) => {
  try {
    const { username } = req.params;
    
    // Validate username format
    const result = usernameSchema.safeParse({ username });
    if (!result.success) {
      return res.status(400).json({ 
        available: false,
        error: 'Invalid username format'
      });
    }
    
    // Check if username exists
    const existingUser = await storage.getUserByUsername(username);
    
    return res.json({
      available: !existingUser
    });
  } catch (error) {
    console.error('Error checking username availability:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Logout endpoint (client-side only for token-based auth)
router.post('/logout', (req: Request, res: Response) => {
  // For token-based auth, the client should discard the token
  // This endpoint is just for API consistency
  return res.json({ success: true });
});

// Test token endpoint - creates a test token for debugging purposes
router.get('/test-token', async (req: Request, res: Response) => {
  try {
    console.log('[express] /auth/test-token endpoint hit');
    
    // Create a test user if it doesn't exist
    let testUser = await storage.getUserByEmail('test@example.com');
    
    if (!testUser) {
      console.log('[express] Creating test user');
      testUser = await storage.createUser({
        email: 'test@example.com',
        username: 'testuser',
        name: 'Test User',
        password: 'hashed_password_would_go_here'
      });
    }
    
    // Generate token for test user
    const token = generateToken({
      id: testUser.id,
      email: testUser.email,
      username: testUser.username
    });
    
    console.log('[express] Generated test token for user ID:', testUser.id);
    
    // Return the token
    res.json({ token });
  } catch (error) {
    console.error('[express] Error generating test token:', error);
    res.status(500).json({ message: 'Failed to generate test token' });
  }
});

export const authRouter = router;