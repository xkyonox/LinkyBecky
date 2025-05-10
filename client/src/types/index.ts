export interface User {
  id: number;
  username: string;
  email: string;
  name: string;
  bio?: string;
  avatar?: string;
}

export interface Link {
  id: number;
  userId: number;
  title: string;
  url: string;
  shortUrl?: string;
  description?: string;
  iconType: string;
  position: number;
  enabled: boolean;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  createdAt: string;
  updatedAt: string;
  clicks?: number;
  clicksToday?: number;
}

export interface Profile {
  id: number;
  userId: number;
  theme: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
  socialLinks: SocialLink[];
  customDomain?: string;
}

export interface SocialLink {
  platform: string;
  url: string;
}

export interface Analytics {
  totalClicks: number;
  today: number;
  growth: number;
  topCountries: { name: string; percentage: number }[];
  devices: { name: string; percentage: number }[];
  weeklyData: number[];
}

export interface AiInsight {
  id: number;
  userId: number;
  linkId?: number;
  content: string;
  type: string;
  seen: boolean;
  createdAt: string;
}

export interface Theme {
  name: string;
  id: string;
  primary: string;
  text: string;
}

export interface LinkAnalytics {
  totalClicks: number;
  clicksByDate: { date: string; clicks: number }[];
  clicksByCountry: { country: string; clicks: number }[];
  clicksByDevice: { device: string; clicks: number }[];
  clicksByBrowser: { browser: string; clicks: number }[];
}

export interface UserProfile {
  username: string;
  name: string;
  bio?: string;
  avatar?: string;
  profile: Profile;
  links: Link[];
}

export interface LinkSuggestions {
  title: string;
  description: string;
  cta: string;
}

export interface LinkOrderRecommendation {
  recommendedOrder: number[];
  explanation: string;
}
