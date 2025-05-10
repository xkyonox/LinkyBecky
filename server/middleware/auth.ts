import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { storage } from '../storage';
import { SessionData } from 'express-session';

// Extend SessionData to include userId and pendingUsername properties
declare module 'express-session' {
  interface SessionData {
    userId?: number;
    pendingUsername?: string;
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'linky-becky-secret-key';

// Define user interface for request
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        username: string;
      };
    }
  }
}

// Generate JWT token
export function generateToken(user: { id: number; email: string; username: string }): string {
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

// Verify token middleware
export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  console.log("Request headers:", JSON.stringify(req.headers, null, 2));
  console.log("Authorization Header:", req.headers['authorization']);
  console.log("Cookies:", req.headers.cookie);
  console.log("Session:", req.session);
  console.log("Session ID:", req.sessionID);
  
  // First, check if we have a session with userId
  if (req.session && req.session.userId) {
    console.log("✅ Session authentication successful for user ID:", req.session.userId);
    
    // Set user object based on session data
    req.user = {
      id: req.session.userId,
      email: '', // These will be populated in validateUser if needed
      username: ''
    };
    
    return next();
  }
  
  // If no session, try token-based auth
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  console.log("Extracted token:", token ? "Present (not shown for security)" : "Missing");

  if (!token) {
    console.log("❌ Authentication failed: No token provided and no valid session");
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    console.log("🔍 Attempting to verify token...");
    
    // Check token format before verification
    if (typeof token === 'string' && token.startsWith('eyJ') && (token.match(/\./g) || []).length === 2) {
      console.log("✅ Token appears to be in valid JWT format");
    } else {
      console.error("❌ Token does not appear to be in valid JWT format!");
      console.log("Token first 10 chars:", token?.substring(0, 10) + '...');
    }
    
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: number;
      email: string;
      username: string;
    };
    
    console.log("✅ Token verified successfully for user ID:", decoded.id);
    console.log("Token contains username:", decoded.username);
    
    // Store user info in request
    req.user = decoded;
    
    // If we have a session, store the user ID for future requests
    if (req.session) {
      req.session.userId = decoded.id;
      console.log("✅ Updated session with user ID:", decoded.id);
    }
    
    next();
  } catch (error) {
    console.error("❌ Token verification failed:", error);
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
}

// Middleware to validate user exists in database
export async function validateUser(req: Request, res: Response, next: NextFunction) {
  try {
    console.log('Validating user...');
    console.log('Request user object:', req.user);
    console.log('Session userId:', req.session?.userId);
    
    // Get the user ID either from user object or session
    let userId: number | undefined = req.user?.id;
    
    // If no user object but we have a session userId, use that
    if (!userId && req.session && req.session.userId) {
      userId = req.session.userId;
      console.log('Using userId from session:', userId);
    }
    
    if (!userId) {
      console.log('❌ No user ID available for validation');
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    // Fetch the user from the database
    const user = await storage.getUser(userId);
    
    if (!user) {
      console.log(`❌ User with ID ${userId} not found in database`);
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Enhance req.user with complete information from database
    req.user = {
      id: user.id,
      email: user.email,
      username: user.username
    };
    
    console.log(`✅ User ${user.username} (ID: ${user.id}) successfully validated`);
    next();
  } catch (error) {
    console.error('❌ Error validating user:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// Middleware for session-based authentication
export function authenticateSession(req: Request, res: Response, next: NextFunction) {
  // Detailed session debugging
  console.log('Session middleware called');
  console.log('Session object exists:', !!req.session);
  console.log('Full session data:', req.session);
  
  // Check if session exists and if it has a userId property (properly typed with our SessionData extension)
  if (req.session && req.session.userId) {
    console.log('Session authentication successful for user ID:', req.session.userId);
    next();
  } else {
    console.log('Session authentication failed: No userId in session');
    res.status(401).json({ message: 'Authentication required' });
  }
}
