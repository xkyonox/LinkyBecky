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

// Redirect with token endpoint
router.get('/callback-redirect', (req: Request, res: Response) => {
  try {
    const { token, username, error } = req.query;
    
    console.log('Redirecting with authentication token:', { token, username, error });
    
    // Create a URL with token in query params for the client to process
    const clientCallbackUrl = new URL('/auth/callback', `${req.protocol}://${req.headers.host}`);
    
    if (error) {
      clientCallbackUrl.searchParams.append('error', error as string);
    }
    
    if (token) {
      clientCallbackUrl.searchParams.append('token', token as string);
    }
    
    if (username) {
      clientCallbackUrl.searchParams.append('username', username as string);
    }
    
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
  try {
    // req.user is set by the authenticate middleware
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    return res.json({
      id: req.user.id,
      email: req.user.email,
      username: req.user.username
    });
  } catch (error) {
    console.error('Error in /auth/me:', error);
    return res.status(500).json({ error: 'Server error' });
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
  try {
    if (!googleOAuthEnabled) {
      return res.status(503).json({ error: 'Google OAuth is not configured' });
    }

    // Validate request body
    const result = googleSignInSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ 
        error: 'Invalid token', 
        details: result.error.errors 
      });
    }

    const { token } = result.data;

    // Verify Google token
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return res.status(400).json({ error: 'Invalid Google token' });
    }

    const { email, name, picture } = payload;
    const googleId = payload.sub;

    // Find existing user by Google ID or email
    let user = await storage.getUserByGoogleId(googleId);
    
    if (!user) {
      // Check if user exists with this email
      user = await storage.getUserByEmail(email!);
      
      if (user) {
        // Update existing user with Google ID
        user = await storage.updateUser(user.id, { googleId });
      }
    }

    if (!user) {
      // New user registration - need a username
      // For now, generate a pending username based on email
      // Store in session for later username selection step
      let pendingUsername = email!.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
      
      // Store in session for username selection step
      req.session.pendingUsername = pendingUsername;
      req.session.googleData = {
        googleId,
        email: email!,
        name: name || '',
        picture: picture || ''
      };
      
      // Redirect to username selection
      return res.json({
        needUsername: true,
        suggestedUsername: pendingUsername
      });
    }

    // Generate token for existing user
    const authToken = generateToken({
      id: user.id,
      email: user.email,
      username: user.username
    });

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

export const authRouter = router;