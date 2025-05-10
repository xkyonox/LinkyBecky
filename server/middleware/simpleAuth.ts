import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { storage } from '../storage';

const JWT_SECRET = process.env.JWT_SECRET || 'linky-becky-secret-key';

// Generate an authentication token for a user
export function generateToken(user: { id: number; email: string; username: string }): string {
  return jwt.sign(
    { id: user.id, email: user.email, username: user.username },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// Middleware to authenticate and validate token from the Authorization header
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  console.log("\n===== AUTHENTICATION MIDDLEWARE =====");
  console.log("Path:", req.path);
  console.log("Method:", req.method);
  
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    console.log("Authorization header present:", !!authHeader);
    console.log("Request headers:", req.headers);
    
    // Log request info
    console.log("Request URL:", req.originalUrl);
    console.log("Request method:", req.method);
    console.log("Request query:", req.query);
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log("No valid Authorization header:", authHeader);
      return res.status(401).json({ error: 'No authentication token provided' });
    }
    
    const token = authHeader.split(' ')[1];
    console.log("Token extracted from header:", token ? "YES (length: " + token.length + ")" : "NO");
    
    if (!token) {
      console.log("Token is empty after extraction");
      return res.status(401).json({ error: 'Invalid token format' });
    }
    
    // Verify token
    console.log("Verifying token with JWT...");
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number; email: string; username: string };
    console.log("Token verified successfully for user ID:", decoded.id);
    
    // Get user from database
    console.log("Looking up user in database...");
    const user = await storage.getUser(decoded.id);
    
    if (!user) {
      console.log("User not found in database for ID:", decoded.id);
      return res.status(401).json({ error: 'User not found' });
    }
    
    console.log("User found:", user.email);
    
    // Attach user to request object
    req.user = {
      id: user.id,
      email: user.email,
      username: user.username
    };
    
    console.log("Authentication successful for user:", user.username);
    console.log("===== END AUTHENTICATION =====\n");
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      console.log("JWT Error:", error.message);
      return res.status(401).json({ error: `Invalid token: ${error.message}` });
    }
    if (error instanceof jwt.TokenExpiredError) {
      console.log("Token expired at:", error.expiredAt);
      return res.status(401).json({ error: `Token expired at ${error.expiredAt}` });
    }
    
    console.error('Authentication error:', error);
    return res.status(500).json({ error: 'Internal server error during authentication' });
  }
}