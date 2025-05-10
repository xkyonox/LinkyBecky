// Simple test script to generate a JWT token for API testing
import jwt from 'jsonwebtoken';

// Use the default secret key directly
const JWT_SECRET = 'linky-becky-secret-key';

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
console.log('\n=== Use with curl to create a link ===');
console.log(`curl -X POST http://localhost:5000/api/links -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" -d '{"title":"Test Link", "url":"https://example.com", "iconType":"url", "position":1, "enabled":true}'`);
console.log('\n=== Token payload ===');
console.log(jwt.decode(token));
console.log('');