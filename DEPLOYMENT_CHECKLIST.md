# LinkyBecky Deployment Checklist

## Environment & Configuration

- [ ] All required environment variables are set (see `.env.production.example`)
- [ ] Database connection string is valid
- [ ] Google OAuth credentials are configured with correct redirect URIs
- [ ] LinkyVicky API credentials are valid (if enabled)
- [ ] OpenAI API key is valid (if AI features are enabled)
- [ ] Session and JWT secrets are strong, random strings (min 64 chars)
- [ ] Production domain is properly configured in env vars

## Security Checks

- [ ] Cookies are set to secure and httpOnly in production
- [ ] CORS is properly configured for production domain
- [ ] Rate limiting is enabled for sensitive endpoints
- [ ] All authentication routes are properly secured
- [ ] No sensitive information is exposed in API responses
- [ ] Error responses don't leak implementation details

## Feature Validation

- [ ] Authentication works (Google OAuth login flow)
- [ ] Session persistence works between page refreshes
- [ ] Link creation, editing, and deletion function correctly
- [ ] URL shortening works or gracefully falls back
- [ ] Profile customization (themes, colors, etc.) works
- [ ] Analytics tracking records clicks properly

## Performance & Reliability

- [ ] Health check endpoint returns correct status
- [ ] Appropriate timeout values are set for external services
- [ ] Retry mechanisms work for transient failures
- [ ] Error logging captures sufficient context for debugging
- [ ] Database queries are optimized for production loads

## Backup & Recovery

- [ ] Database backup strategy is in place
- [ ] Recovery process is documented and tested
- [ ] Monitoring alerts are configured for critical failures

## Post-Deployment

- [ ] Verify site loads correctly on production domain
- [ ] Test all features with real user credentials
- [ ] Verify analytics tracking works in production
- [ ] Check performance metrics (loading times, API response times)
- [ ] Run a final security scan on production endpoints

## Documentation

- [ ] API endpoints are documented
- [ ] Environment variables are documented
- [ ] Deployment process is documented
- [ ] Troubleshooting guide is created
- [ ] Frontend routes are documented

---

## QA Test Results

### Health Check Status
```
GET /api/health
```
Expected result: `{"status":"healthy"}` or specific degradation reasons

### Authentication Endpoints
```
GET /api/auth/me-from-session
```
Expected result when not logged in: `{"isAuthenticated":false,"user":null}`
Expected result when logged in: `{"isAuthenticated":true,"user":{...}}`

### Links Management
```
GET /api/links
POST /api/links
GET /api/links/:id
PATCH /api/links/:id
DELETE /api/links/:id
```
All should return appropriate data or proper authentication errors

### Profile Management
```
GET /api/profile
PATCH /api/profile
```
Should return appropriate data or proper authentication errors

### Error Handling
API should handle errors gracefully, with appropriate status codes and error messages, and not crash the application.

### LinkyVicky Fallback
When LinkyVicky API is unavailable, links should still be created successfully without short URLs.