import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { storage } from '../storage';
import { SessionData } from 'express-session';

// Extend SessionData to include userId property
declare module 'express-session' {
  interface SessionData {
    userId?: number;
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
  console.log("Request headers:", req.headers);
  console.log("Authorization Header:", req.headers['authorization']);
  
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  console.log("Extracted token:", token ? "Present (not shown for security)" : "Missing");

  if (!token) {
    console.log("Authentication failed: No token provided");
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    console.log("Attempting to verify token...");
    
    // Check token format before verification
    if (typeof token === 'string' && token.startsWith('eyJ') && (token.match(/\./g) || []).length === 2) {
      console.log("Token appears to be in valid JWT format");
    } else {
      console.error("Token does not appear to be in valid JWT format!");
      console.log("Token first 10 chars:", token?.substring(0, 10) + '...');
    }
    
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: number;
      email: string;
      username: string;
    };
    
    console.log("Token verified successfully for user ID:", decoded.id);
    console.log("Token contains username:", decoded.username);
    req.user = decoded;
    next();
  } catch (error) {
    console.error("Token verification failed:", error);
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
}

// Middleware to validate user exists in database
export async function validateUser(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    const user = await storage.getUser(req.user.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    next();
  } catch (error) {
    console.error('Error validating user:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// Middleware for session-based authentication
export function authenticateSession(req: Request, res: Response, next: NextFunction) {
  // Check if session exists and if it has a userId property (properly typed with our SessionData extension)
  if (req.session && req.session.userId) {
    console.log('Session authentication successful for user ID:', req.session.userId);
    next();
  } else {
    console.log('Session authentication failed: No userId in session');
    res.status(401).json({ message: 'Authentication required' });
  }
}
