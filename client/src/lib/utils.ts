import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { apiRequest } from "./queryClient";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format number with commas for thousands
 */
export function formatNumber(num: number): string {
  return num.toLocaleString();
}

/**
 * Format a date as a relative time (e.g., "2 days ago")
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) {
    return `${diffInSeconds} seconds ago`;
  }
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes === 1 ? '' : 's'} ago`;
  }
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours === 1 ? '' : 's'} ago`;
  }
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) {
    return `${diffInDays} day${diffInDays === 1 ? '' : 's'} ago`;
  }
  
  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return `${diffInMonths} month${diffInMonths === 1 ? '' : 's'} ago`;
  }
  
  const diffInYears = Math.floor(diffInMonths / 12);
  return `${diffInYears} year${diffInYears === 1 ? '' : 's'} ago`;
}

/**
 * Get a URL's domain name
 */
export function getDomainFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch (error) {
    return url;
  }
}

/**
 * Generate a random color
 */
export function getRandomColor(): string {
  const colors = [
    '#7c3aed', // purple
    '#4f46e5', // indigo
    '#2563eb', // blue
    '#0ea5e9', // sky
    '#0d9488', // teal
    '#059669', // emerald
    '#65a30d', // lime
    '#d97706', // amber
    '#dc2626', // red
    '#db2777', // pink
  ];
  
  return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * Copy text to clipboard
 */
export function copyToClipboard(text: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text)
        .then(() => resolve(true))
        .catch(() => resolve(false));
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      try {
        const successful = document.execCommand('copy');
        resolve(successful);
      } catch (err) {
        resolve(false);
      }
      
      document.body.removeChild(textArea);
    }
  });
}

/**
 * Record a link click
 */
export async function recordLinkClick(linkId: number, metadata: {
  country?: string;
  device?: string;
  browser?: string;
}): Promise<void> {
  try {
    await apiRequest('POST', `/api/links/${linkId}/click`, metadata);
  } catch (error) {
    console.error('Error recording link click:', error);
  }
}

/**
 * Convert hex color to HSL
 */
export function hexToHSL(hex: string): { h: number; s: number; l: number } {
  // Remove the # if it exists
  hex = hex.replace(/^#/, '');
  
  // Parse the hex value to RGB
  let r = parseInt(hex.substring(0, 2), 16) / 255;
  let g = parseInt(hex.substring(2, 4), 16) / 255;
  let b = parseInt(hex.substring(4, 6), 16) / 255;
  
  // Find the min and max values to calculate the lightness
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  let l = (max + min) / 2;
  
  // Only calculate hue and saturation if the color is not a shade of gray
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    
    h /= 6;
  }
  
  // Convert to degrees, percentage, percentage format
  h = Math.round(h * 360);
  s = Math.round(s * 100);
  l = Math.round(l * 100);
  
  return { h, s, l };
}

/**
 * Check if a color is light or dark
 */
export function isColorLight(hex: string): boolean {
  const { l } = hexToHSL(hex);
  return l > 50;
}

/**
 * Get contrast color (black or white) based on background
 */
export function getContrastColor(hex: string): string {
  return isColorLight(hex) ? '#000000' : '#ffffff';
}

/**
 * Get font awesome icon name from URL
 */
export function getIconFromUrl(url: string): string {
  try {
    const domain = getDomainFromUrl(url).toLowerCase();
    
    if (domain.includes('instagram')) return 'fa-instagram';
    if (domain.includes('facebook')) return 'fa-facebook';
    if (domain.includes('twitter') || domain.includes('x.com')) return 'fa-twitter';
    if (domain.includes('linkedin')) return 'fa-linkedin';
    if (domain.includes('youtube')) return 'fa-youtube';
    if (domain.includes('tiktok')) return 'fa-tiktok';
    if (domain.includes('pinterest')) return 'fa-pinterest';
    if (domain.includes('snapchat')) return 'fa-snapchat';
    if (domain.includes('github')) return 'fa-github';
    if (domain.includes('behance')) return 'fa-behance';
    if (domain.includes('dribbble')) return 'fa-dribbble';
    if (domain.includes('medium')) return 'fa-medium';
    if (domain.includes('twitch')) return 'fa-twitch';
    if (domain.includes('discord')) return 'fa-discord';
    if (domain.includes('whatsapp')) return 'fa-whatsapp';
    if (domain.includes('telegram')) return 'fa-telegram';
    if (domain.includes('spotify')) return 'fa-spotify';
    if (domain.includes('apple')) return 'fa-apple';
    if (domain.includes('google')) return 'fa-google';
    if (domain.includes('amazon')) return 'fa-amazon';
    
    return 'fa-link';
  } catch (error) {
    return 'fa-link';
  }
}
