import axios from 'axios';

// LinkyVicky API base URL
const LINKYVICKY_API_URL = process.env.LINKYVICKY_API_URL || 'https://api.linkyvicky.com';
const LINKYVICKY_API_KEY = process.env.LINKYVICKY_API_KEY || '';

// Debug API connection issues
console.log("LinkyVicky API Configuration:");
console.log("API URL:", LINKYVICKY_API_URL);
console.log("API KEY:", LINKYVICKY_API_KEY ? "Available" : "Missing");

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
 * Shorten a URL using LinkyVicky API
 */
export async function shortenUrl(originalUrl: string, customSlug?: string): Promise<ShortenedUrlResponse> {
  console.log(`LinkyVicky - Attempting to shorten URL: ${originalUrl}${customSlug ? ' with custom slug' : ''}`);
  
  if (!LINKYVICKY_API_KEY) {
    console.error('LinkyVicky - API key is missing');
    throw new Error('URL shortening service is not configured. Please contact support.');
  }
  
  try {
    console.log(`LinkyVicky - Making API request to ${LINKYVICKY_API_URL}/api/shorten`);
    
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
          'Accept': 'application/json'
        },
        timeout: 10000 // 10 second timeout
      }
    );

    console.log(`LinkyVicky - API responded with status ${response.status}`);
    
    if (response.status !== 200) {
      console.error(`LinkyVicky - Error response: ${response.statusText}`);
      throw new Error(`Failed to shorten URL: ${response.statusText}`);
    }

    console.log('LinkyVicky - URL shortened successfully');
    return response.data;
  } catch (error: any) {
    console.error('LinkyVicky - Error shortening URL:', error);
    
    // Provide more detailed error information
    if (error.response) {
      // The request was made and the server responded with a status code outside the 2xx range
      console.error(`LinkyVicky - API error response: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      throw new Error(`URL shortening service error: ${error.response.status} - ${error.response.data?.message || 'Unknown error'}`);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('LinkyVicky - No response received from API');
      throw new Error('URL shortening service unavailable. Please try again later.');
    } else {
      // Something happened in setting up the request
      console.error(`LinkyVicky - Request setup error: ${error.message}`);
      throw new Error(`URL shortening error: ${error.message}`);
    }
  }
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
