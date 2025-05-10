// Simple test script to generate a JWT token for API testing
import jwt from 'jsonwebtoken';
import { config } from 'dotenv';

// Load environment variables
config();

// Get the JWT secret from environment or use default
const JWT_SECRET = process.env.JWT_SECRET || 'linky-becky-secret-key';

// Test user data
const testUser = {
  id: 999,
  email: 'test@example.com',
  username: 'testuser'
};

// Generate token
const token = jwt.sign(testUser, JWT_SECRET, { expiresIn: '1h' });

console.log('\n=== JWT Token for Testing ===');
console.log(token);
console.log('\n=== Use with curl ===');
console.log(`curl -H "Authorization: Bearer ${token}" http://localhost:5000/api/links`);
console.log('\n=== Token payload ===');
console.log(jwt.decode(token));
console.log('');