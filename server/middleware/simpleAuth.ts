import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { storage } from "../storage";

// JWT secret key
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-production';

// Generate JWT token
export function generateToken(user: { id: number; email: string; username: string }): string {
  return jwt.sign(
    { 
      userId: user.id,
      email: user.email,
      username: user.username
    }, 
    JWT_SECRET, 
    { expiresIn: '7d' }
  );
}

// Middleware to authenticate token
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    // Get token from header or query param (for simplicity)
    const authHeader = req.headers.authorization;
    let token = authHeader && authHeader.split(' ')[1];
    
    // Also check for token in query parameter (for redirects and image requests)
    if (!token && req.query.token) {
      token = req.query.token as string;
    }
    
    // If no token, return unauthorized
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }
    
    // Verify token
    jwt.verify(token, JWT_SECRET, async (err: any, decoded: any) => {
      if (err) {
        console.error('Token verification failed:', err.message);
        return res.status(401).json({ message: 'Invalid token' });
      }
      
      // Get user from database for extra security
      try {
        const user = await storage.getUser(decoded.userId);
        if (!user) {
          return res.status(401).json({ message: 'User not found' });
        }
        
        // Set user in request
        req.user = user;
        next();
      } catch (dbError) {
        console.error('Database error in auth middleware:', dbError);
        return res.status(500).json({ message: 'Server error' });
      }
    });
  } catch (error) {
    console.error('Unexpected error in auth middleware:', error);
    return res.status(500).json({ message: 'Server error' });
  }
}