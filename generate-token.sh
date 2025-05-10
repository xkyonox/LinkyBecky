#!/bin/bash

# Create a hardcoded JWT token for testing
# This is a simple implementation without validation - for testing only!

# Header: {"alg":"HS256","typ":"JWT"}
HEADER="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"

# Payload: {"id":999,"email":"test@example.com","username":"testuser","iat":1620000000,"exp":1999999999}
PAYLOAD="eyJpZCI6OTk5LCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJ1c2VybmFtZSI6InRlc3R1c2VyIiwiaWF0IjoxNjIwMDAwMDAwLCJleHAiOjE5OTk5OTk5OTl9"

# Signature is not cryptographically valid, but format is correct for testing
# In production, use proper JWT libraries!
SIGNATURE="INVALID_SIGNATURE_FOR_TESTING_ONLY"

# Combine to form token
TOKEN="${HEADER}.${PAYLOAD}.${SIGNATURE}"

echo
echo "=== JWT Token for Testing ==="
echo $TOKEN
echo
echo "=== Use with curl ==="
echo "curl -H \"Authorization: Bearer ${TOKEN}\" http://localhost:5000/api/links"
echo
echo "=== Use with curl to create a link ==="
echo "curl -X POST http://localhost:5000/api/links -H \"Authorization: Bearer ${TOKEN}\" -H \"Content-Type: application/json\" -d '{\"title\":\"Test Link\", \"url\":\"https://example.com\", \"iconType\":\"url\", \"position\":1, \"enabled\":true}'"
echo