import axios from 'axios';
import { retryWithBackoff } from './retry';

// LinkyVicky API base URL
const LINKYVICKY_API_URL = process.env.LINKYVICKY_API_URL || 'https://api.linkyvicky.com';
const LINKYVICKY_API_KEY = process.env.LINKYVICKY_API_KEY || '';

// Debug API connection issues
console.log("LinkyVicky API Configuration:");
console.log("API URL:", LINKYVICKY_API_URL);
console.log("API KEY:", LINKYVICKY_API_KEY ? "Available" : "Missing");

/**
 * Validate if LinkyVicky API is properly configured
 */
export function isLinkyVickyConfigured(): boolean {
  return !!LINKYVICKY_API_KEY && !!LINKYVICKY_API_URL;
}

/**
 * Test LinkyVicky API connection
 */
export async function testLinkyVickyConnection(): Promise<{
  success: boolean;
  message: string;
  apiUrl?: string;
}> {
  if (!isLinkyVickyConfigured()) {
    return {
      success: false,
      message: "LinkyVicky API is not configured. LINKYVICKY_API_KEY and/or LINKYVICKY_API_URL are missing.",
    };
  }
  
  try {
    // Simplified health check endpoint
    // We'll just use the shorten endpoint with a test URL
    await axios.post(
      `${LINKYVICKY_API_URL}/api/shorten`,
      { url: "https://example.com/test" },
      {
        headers: {
          'Authorization': `Bearer ${LINKYVICKY_API_KEY}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 5000 // 5 second timeout for health check
      }
    );
    
    return {
      success: true,
      message: "LinkyVicky API connection successful",
      apiUrl: LINKYVICKY_API_URL
    };
  } catch (error: any) {
    let errorMessage = "Unknown error";
    
    if (error.response) {
      errorMessage = `Status ${error.response.status}: ${error.response.data?.message || error.response.statusText}`;
    } else if (error.request) {
      errorMessage = "No response received from API. Service may be unavailable.";
    } else {
      errorMessage = error.message || "Request setup error";
    }
    
    return {
      success: false,
      message: `LinkyVicky API connection failed: ${errorMessage}`,
      apiUrl: LINKYVICKY_API_URL
    };
  }
}

// Interface for shortened URL response
interface ShortenedUrlResponse {
  shortUrl: string;
  originalUrl: string;
  qrCodeUrl: string;
}

// Interface for analytics response
interface AnalyticsResponse {
  totalClicks: number;
  clicksByDate: { date: string; clicks: number }[];
  clicksByCountry: { country: string; clicks: number }[];
  clicksByDevice: { device: string; clicks: number }[];
  clicksByBrowser: { browser: string; clicks: number }[];
}

/**
 * Shorten a URL using LinkyVicky API with retry capability
 */
export async function shortenUrl(originalUrl: string, customSlug?: string): Promise<ShortenedUrlResponse> {
  // Generate a unique ID for tracking this request across logs
  const requestId = Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
  const startTime = Date.now();
  
  console.log(`📎 [LinkyVicky] [${requestId}] Attempting to shorten URL:`, {
    url: originalUrl,
    hasCustomSlug: !!customSlug,
    timestamp: new Date().toISOString()
  });
  
  if (!LINKYVICKY_API_KEY) {
    console.error(`❌ [LinkyVicky] [${requestId}] API key is missing`);
    throw new Error('URL shortening service is not configured. Please contact support.');
  }
  
  return retryWithBackoff(
    async (attempt: number) => {
      const attemptStartTime = Date.now();
      console.log(`🔄 [LinkyVicky] [${requestId}] Making API request (attempt ${attempt}):`, {
        endpoint: `${LINKYVICKY_API_URL}/api/shorten`,
        originalUrl,
        hasCustomSlug: !!customSlug
      });
      
      try {
        const response = await axios.post(
          `${LINKYVICKY_API_URL}/api/shorten`,
          {
            url: originalUrl,
            customSlug
          },
          {
            headers: {
              'Authorization': `Bearer ${LINKYVICKY_API_KEY}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'X-Request-ID': requestId
            },
            timeout: 10000 // 10 second timeout
          }
        );

        const attemptDuration = Date.now() - attemptStartTime;
        console.log(`✅ [LinkyVicky] [${requestId}] API responded in ${attemptDuration}ms:`, {
          status: response.status,
          statusText: response.statusText,
          shortUrl: response.data?.shortUrl,
          hasQrCode: !!response.data?.qrCodeUrl
        });
        
        if (response.status !== 200) {
          console.error(`❌ [LinkyVicky] [${requestId}] Error response:`, {
            status: response.status,
            statusText: response.statusText,
            data: response.data
          });
          throw new Error(`Failed to shorten URL: ${response.statusText}`);
        }

        console.log(`✅ [LinkyVicky] [${requestId}] URL shortened successfully in ${attemptDuration}ms`);
        return response.data;
      } catch (error) {
        const attemptDuration = Date.now() - attemptStartTime;
        
        if (axios.isAxiosError(error)) {
          console.error(`❌ [LinkyVicky] [${requestId}] Request failed in ${attemptDuration}ms:`, {
            attempt,
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            message: error.message,
            code: error.code
          });
        } else {
          console.error(`❌ [LinkyVicky] [${requestId}] Non-Axios error in ${attemptDuration}ms:`, {
            attempt,
            error: error instanceof Error ? error.message : String(error)
          });
        }
        throw error;
      }
    },
    {
      maxRetries: 3,
      initialDelay: 300,
      maxDelay: 3000,
      factor: 2,
      onRetry: (attempt, error, delay) => {
        console.warn(`🔄 [LinkyVicky] [${requestId}] Scheduling retry ${attempt}:`, {
          error: error instanceof Error ? error.message : String(error),
          delayMs: delay,
          elapsedMs: Date.now() - startTime
        });
      }
    }
  ).catch((error: any) => {
    const totalDuration = Date.now() - startTime;
    console.error(`❌ [LinkyVicky] [${requestId}] All retry attempts failed after ${totalDuration}ms:`, {
      originalUrl,
      hasCustomSlug: !!customSlug,
      totalAttempts: 4, // Initial + 3 retries
      lastError: error instanceof Error ? error.message : String(error)
    });
    
    // Provide more detailed error information based on error type
    if (axios.isAxiosError(error) && error.response) {
      // The request was made and the server responded with a status code outside the 2xx range
      console.error(`❌ [LinkyVicky] [${requestId}] API error response details:`, {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
      throw new Error(`URL shortening service error: ${error.response.status} - ${error.response.data?.message || 'Unknown error'}`);
    } else if (axios.isAxiosError(error) && error.request) {
      // The request was made but no response was received
      console.error(`❌ [LinkyVicky] [${requestId}] No response received:`, {
        requestSent: true,
        responseReceived: false,
        timeoutMs: 10000
      });
      throw new Error('URL shortening service unavailable. Please try again later.');
    } else {
      // Something happened in setting up the request
      console.error(`❌ [LinkyVicky] [${requestId}] Request setup error:`, {
        message: error.message,
        stack: error.stack
      });
      throw new Error(`URL shortening error: ${error.message}`);
    }
  });
}

/**
 * Generate a QR code for a URL using LinkyVicky API
 */
export async function generateQrCode(url: string): Promise<string> {
  console.log(`LinkyVicky - Attempting to generate QR code for URL: ${url}`);
  
  if (!LINKYVICKY_API_KEY) {
    console.error('LinkyVicky - API key is missing');
    throw new Error('QR code generation service is not configured. Please contact support.');
  }
  
  try {
    console.log(`LinkyVicky - Making QR code API request to ${LINKYVICKY_API_URL}/api/qrcode`);
    
    const response = await axios.post(
      `${LINKYVICKY_API_URL}/api/qrcode`,
      { url },
      {
        headers: {
          'Authorization': `Bearer ${LINKYVICKY_API_KEY}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 10000 // 10 second timeout
      }
    );

    console.log(`LinkyVicky - QR code API responded with status ${response.status}`);
    
    if (response.status !== 200) {
      console.error(`LinkyVicky - QR code error response: ${response.statusText}`);
      throw new Error(`Failed to generate QR code: ${response.statusText}`);
    }

    console.log('LinkyVicky - QR code generated successfully');
    return response.data.qrCodeUrl;
  } catch (error: any) {
    console.error('LinkyVicky - Error generating QR code:', error);
    
    // Provide more detailed error information
    if (error.response) {
      // The request was made and the server responded with a status code outside the 2xx range
      console.error(`LinkyVicky - QR code API error response: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      throw new Error(`QR code service error: ${error.response.status} - ${error.response.data?.message || 'Unknown error'}`);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('LinkyVicky - No response received from QR code API');
      throw new Error('QR code service unavailable. Please try again later.');
    } else {
      // Something happened in setting up the request
      console.error(`LinkyVicky - QR code request setup error: ${error.message}`);
      throw new Error(`QR code generation error: ${error.message}`);
    }
  }
}

/**
 * Get analytics for a shortened URL
 */
export async function getUrlAnalytics(shortUrl: string, period?: string): Promise<AnalyticsResponse> {
  console.log(`LinkyVicky - Attempting to get analytics for: ${shortUrl}${period ? ` with period ${period}` : ''}`);
  
  if (!LINKYVICKY_API_KEY) {
    console.error('LinkyVicky - API key is missing');
    throw new Error('Analytics service is not configured. Please contact support.');
  }
  
  try {
    console.log(`LinkyVicky - Making analytics API request to ${LINKYVICKY_API_URL}/api/analytics/${shortUrl}`);
    
    const response = await axios.get(
      `${LINKYVICKY_API_URL}/api/analytics/${shortUrl}`,
      {
        params: { period },
        headers: {
          'Authorization': `Bearer ${LINKYVICKY_API_KEY}`,
          'Accept': 'application/json'
        },
        timeout: 10000 // 10 second timeout
      }
    );

    console.log(`LinkyVicky - Analytics API responded with status ${response.status}`);
    
    if (response.status !== 200) {
      console.error(`LinkyVicky - Analytics error response: ${response.statusText}`);
      throw new Error(`Failed to get analytics: ${response.statusText}`);
    }

    console.log('LinkyVicky - Analytics retrieved successfully');
    return response.data;
  } catch (error: any) {
    console.error('LinkyVicky - Error getting analytics:', error);
    
    // Provide more detailed error information
    if (error.response) {
      // The request was made and the server responded with a status code outside the 2xx range
      console.error(`LinkyVicky - Analytics API error response: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      throw new Error(`Analytics service error: ${error.response.status} - ${error.response.data?.message || 'Unknown error'}`);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('LinkyVicky - No response received from analytics API');
      throw new Error('Analytics service unavailable. Please try again later.');
    } else {
      // Something happened in setting up the request
      console.error(`LinkyVicky - Analytics request setup error: ${error.message}`);
      throw new Error(`Analytics error: ${error.message}`);
    }
  }
}

/**
 * Add UTM parameters to a URL
 */
export function addUtmParameters(
  url: string,
  params: {
    source?: string;
    medium?: string;
    campaign?: string;
    term?: string;
    content?: string;
  }
): string {
  try {
    const urlObj = new URL(url);
    
    if (params.source) urlObj.searchParams.set('utm_source', params.source);
    if (params.medium) urlObj.searchParams.set('utm_medium', params.medium);
    if (params.campaign) urlObj.searchParams.set('utm_campaign', params.campaign);
    if (params.term) urlObj.searchParams.set('utm_term', params.term);
    if (params.content) urlObj.searchParams.set('utm_content', params.content);
    
    return urlObj.toString();
  } catch (error) {
    console.error('Error adding UTM parameters:', error);
    return url;
  }
}
