// Simple script to test API endpoints

const apiUrl = 'http://localhost:5000';

// Test various endpoints
const endpoints = [
  '/api/status',
  '/api/test-db',
  '/api/username/availability/testuser'
];

// Print out curl commands to test each endpoint
console.log('Run these commands to test API endpoints:\n');

endpoints.forEach(endpoint => {
  console.log(`curl -X GET "${apiUrl}${endpoint}" -H "Accept: application/json" -H "Content-Type: application/json" -v`);
  console.log();
});