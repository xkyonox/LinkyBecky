// Test script to generate a valid JWT token directly
// This is a standalone script - no external dependencies needed

import crypto from 'crypto';

// The secret key used by the application
const JWT_SECRET = 'linky-becky-secret-key';

// Test user data
const payload = {
  id: 999,
  email: 'test@example.com',
  username: 'testuser',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600 // Expires in 1 hour
};

// Create JWT header
const header = {
  alg: 'HS256',
  typ: 'JWT'
};

// Base64 encode the header and payload
const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');

// Create the signature
const signatureInput = `${encodedHeader}.${encodedPayload}`;
const signature = crypto
  .createHmac('sha256', JWT_SECRET)
  .update(signatureInput)
  .digest('base64url');

// Put it all together
const token = `${encodedHeader}.${encodedPayload}.${signature}`;

console.log('\n=== JWT Token for Testing ===');
console.log(token);
console.log('\n=== Use with curl ===');
console.log(`curl -H "Authorization: Bearer ${token}" http://localhost:5000/api/links`);
console.log('\n=== Use with curl to create a link ===');
console.log(`curl -X POST http://localhost:5000/api/links -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" -d '{"title":"Test Link", "url":"https://example.com", "iconType":"url", "position":1, "enabled":true}'`);
console.log('\n=== Token payload ===');
console.log(payload);
console.log('');