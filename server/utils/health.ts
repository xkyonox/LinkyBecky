import { db, pool } from '../db';
import { isLinkyVickyConfigured, testLinkyVickyConnection } from './linkyVicky';

/**
 * Health check utilities
 */

// Check for required environment variables
export function checkRequiredEnvVars(): {
  missing: string[];
  available: string[];
  missingRecommended?: string[];
} {
  // In production, these would all be required
  // For our current development setup, we only require DATABASE_URL
  // and provide a fallback for JWT_SECRET in the auth middleware
  const required = [
    'DATABASE_URL',
    'SESSION_SECRET',
  ];

  const recommended = [
    'JWT_SECRET',
  ];

  const optional = [
    'LINKYVICKY_API_KEY',
    'LINKYVICKY_API_URL',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'PORT',
    'NODE_ENV',
  ];

  const missing = required.filter(name => !process.env[name]);
  const missingRecommended = recommended.filter(name => !process.env[name]);
  const available = [...required, ...recommended, ...optional].filter(name => !!process.env[name]);

  return { 
    missing,
    available, 
    missingRecommended: missingRecommended.length > 0 ? missingRecommended : undefined
  };
}

// Check database connection
export async function checkDatabaseConnection(): Promise<{
  success: boolean;
  message: string;
  error?: string;
}> {
  try {
    // Simple query to check connection
    const result = await db.execute(sql`SELECT 1 AS online`);
    return {
      success: true,
      message: 'Database connection is healthy',
    };
  } catch (error) {
    console.error('Health check - Database connection error:', error);
    return {
      success: false,
      message: 'Database connection failed',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Check overall system health
export async function getSystemHealth(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: {
    database: {
      success: boolean;
      message: string;
      error?: string;
    };
    environment: {
      success: boolean;
      message: string;
      missing?: string[];
      missingRecommended?: string[];
      available?: string[];
    };
    linkyVicky?: {
      success: boolean;
      message: string;
      apiUrl?: string;
    };
  };
}> {
  // Check environment variables
  const envVars = checkRequiredEnvVars();
  let envMessage = '';
  
  if (envVars.missing.length === 0) {
    envMessage = 'All required environment variables are set';
    if (envVars.missingRecommended && envVars.missingRecommended.length > 0) {
      envMessage += `, but recommended variables are missing: ${envVars.missingRecommended.join(', ')}`;
    }
  } else {
    envMessage = `Missing required environment variables: ${envVars.missing.join(', ')}`;
  }
  
  const envStatus = {
    success: envVars.missing.length === 0,
    message: envMessage,
    missing: envVars.missing.length > 0 ? envVars.missing : undefined,
    missingRecommended: envVars.missingRecommended,
    available: envVars.available,
  };

  // Check database connection
  const dbStatus = await checkDatabaseConnection();

  // Build the health check result
  const result: any = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {
      database: dbStatus,
      environment: envStatus,
    }
  };

  // Check LinkyVicky if configured
  if (isLinkyVickyConfigured()) {
    const lvStatus = await testLinkyVickyConnection();
    result.checks.linkyVicky = lvStatus;

    // Update health status if LinkyVicky is not working
    if (!lvStatus.success) {
      result.status = 'degraded';
    }
  }

  // Determine overall status
  if (!dbStatus.success) {
    result.status = 'unhealthy';
  } else if (!envStatus.success) {
    result.status = 'degraded';
  }

  return result;
}

// SQL helper import
import { sql } from 'drizzle-orm';