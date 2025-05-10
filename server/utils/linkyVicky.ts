import axios from 'axios';

// LinkyVicky API base URL
const LINKYVICKY_API_URL = process.env.LINKYVICKY_API_URL || 'https://api.linkyvicky.com';
const LINKYVICKY_API_TOKEN = process.env.LINKYVICKY_API_TOKEN || '';

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
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.status !== 200) {
      throw new Error(`Failed to shorten URL: ${response.statusText}`);
    }

    return response.data;
  } catch (error) {
    console.error('Error shortening URL:', error);
    throw new Error('Failed to shorten URL');
  }
}

/**
 * Generate a QR code for a URL using LinkyVicky API
 */
export async function generateQrCode(url: string): Promise<string> {
  try {
    const response = await axios.post(
      `${LINKYVICKY_API_URL}/api/qrcode`,
      { url },
      {
        headers: {
          'Authorization': `Bearer ${LINKYVICKY_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.status !== 200) {
      throw new Error(`Failed to generate QR code: ${response.statusText}`);
    }

    return response.data.qrCodeUrl;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw new Error('Failed to generate QR code');
  }
}

/**
 * Get analytics for a shortened URL
 */
export async function getUrlAnalytics(shortUrl: string, period?: string): Promise<AnalyticsResponse> {
  try {
    const response = await axios.get(
      `${LINKYVICKY_API_URL}/api/analytics/${shortUrl}`,
      {
        params: { period },
        headers: {
          'Authorization': `Bearer ${LINKYVICKY_API_KEY}`
        }
      }
    );

    if (response.status !== 200) {
      throw new Error(`Failed to get analytics: ${response.statusText}`);
    }

    return response.data;
  } catch (error) {
    console.error('Error getting analytics:', error);
    throw new Error('Failed to get analytics');
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
