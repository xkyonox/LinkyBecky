import { create } from "zustand";
import { persist } from "zustand/middleware";

// Types
interface User {
  id: number;
  username: string;
  email: string;
  name: string;
  bio?: string;
  avatar?: string;
}

interface Link {
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
}

interface Profile {
  id: number;
  userId: number;
  theme: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
  socialLinks: SocialLink[];
  customDomain?: string;
}

interface SocialLink {
  platform: string;
  url: string;
}

interface Analytics {
  totalClicks: number;
  today: number;
  growth: number;
  topCountries: { name: string; percentage: number }[];
  devices: { name: string; percentage: number }[];
  weeklyData: number[];
}

interface AiInsight {
  id: number;
  userId: number;
  linkId?: number;
  content: string;
  type: string;
  seen: boolean;
  createdAt: string;
}

interface TabState {
  currentTab: "links" | "appearance" | "analytics" | "settings";
  setTab: (tab: "links" | "appearance" | "analytics" | "settings") => void;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
}

interface LinkState {
  links: Link[];
  setLinks: (links: Link[]) => void;
  addLink: (link: Link) => void;
  updateLink: (id: number, data: Partial<Link>) => void;
  removeLink: (id: number) => void;
  reorderLinks: (linkIdPositions: { id: number; position: number }[]) => void;
}

interface ProfileState {
  profile: Profile | null;
  setProfile: (profile: Profile) => void;
  updateProfile: (data: Partial<Profile>) => void;
  addSocialLink: (platform: string, url: string) => void;
  updateSocialLink: (index: number, platform: string, url: string) => void;
  removeSocialLink: (index: number) => void;
}

interface AnalyticsState {
  analytics: Analytics | null;
  setAnalytics: (analytics: Analytics) => void;
}

interface AiInsightState {
  insights: AiInsight[];
  setInsights: (insights: AiInsight[]) => void;
  addInsight: (insight: AiInsight) => void;
  markInsightAsSeen: (id: number) => void;
}

// Auth Store
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      setAuth: (user, token) => {
        console.log('AuthStore: Setting auth with token...');
        
        // Check if token looks like a JWT
        if (token) {
          const isValidJwtFormat = 
            typeof token === 'string' && 
            token.startsWith('eyJ') && 
            (token.match(/\./g) || []).length === 2;
          
          console.log('AuthStore: Token format valid:', isValidJwtFormat);
          
          if (!isValidJwtFormat) {
            console.error('AuthStore: WARNING - Token does not appear to be in valid JWT format!');
          }
        } else {
          console.error('AuthStore: ERROR - No token provided to setAuth!');
        }
        
        // Set the state
        set({ user, token, isAuthenticated: true });
        
        // Verify it was stored properly
        setTimeout(() => {
          const authStorage = localStorage.getItem('auth-storage');
          if (authStorage) {
            try {
              const parsed = JSON.parse(authStorage);
              // Log the structure in a more readable way
              console.log('AuthStore: Verified storage structure:', JSON.stringify(parsed, null, 2));
              const storedToken = parsed?.state?.token;
              console.log('AuthStore: Token in storage:', storedToken ? 'Present' : 'Missing!');
              
              if (storedToken) {
                console.log('AuthStore: First 10 chars of stored token:', storedToken.substring(0, 10) + '...');
              }
            } catch (e) {
              console.error('AuthStore: Error verifying storage:', e);
            }
          } else {
            console.error('AuthStore: No auth-storage found after setting!');
          }
        }, 100);
      },
      clearAuth: () => set({ user: null, token: null, isAuthenticated: false }),
    }),
    {
      name: "auth-storage",
    }
  )
);

// Tab Store
export const useTabStore = create<TabState>((set) => ({
  currentTab: "links",
  setTab: (tab) => set({ currentTab: tab }),
}));

// Link Store
export const useLinkStore = create<LinkState>((set) => ({
  links: [],
  setLinks: (links) => set({ links }),
  addLink: (link) => set((state) => ({ links: [...state.links, link] })),
  updateLink: (id, data) =>
    set((state) => ({
      links: state.links.map((link) =>
        link.id === id ? { ...link, ...data } : link
      ),
    })),
  removeLink: (id) =>
    set((state) => ({
      links: state.links.filter((link) => link.id !== id),
    })),
  reorderLinks: (linkIdPositions) =>
    set((state) => {
      const newLinks = [...state.links];
      
      linkIdPositions.forEach(({ id, position }) => {
        const linkIndex = newLinks.findIndex((link) => link.id === id);
        if (linkIndex !== -1) {
          newLinks[linkIndex] = { ...newLinks[linkIndex], position };
        }
      });
      
      return { links: newLinks.sort((a, b) => a.position - b.position) };
    }),
}));

// Profile Store
export const useProfileStore = create<ProfileState>((set) => ({
  profile: null,
  setProfile: (profile) => set({ profile }),
  updateProfile: (data) =>
    set((state) => ({
      profile: state.profile ? { ...state.profile, ...data } : null,
    })),
  addSocialLink: (platform, url) =>
    set((state) => {
      if (!state.profile) return { profile: null };
      
      const socialLinks = [...(state.profile.socialLinks || [])];
      socialLinks.push({ platform, url });
      
      return {
        profile: {
          ...state.profile,
          socialLinks,
        },
      };
    }),
  updateSocialLink: (index, platform, url) =>
    set((state) => {
      if (!state.profile) return { profile: null };
      
      const socialLinks = [...(state.profile.socialLinks || [])];
      socialLinks[index] = { platform, url };
      
      return {
        profile: {
          ...state.profile,
          socialLinks,
        },
      };
    }),
  removeSocialLink: (index) =>
    set((state) => {
      if (!state.profile) return { profile: null };
      
      const socialLinks = [...(state.profile.socialLinks || [])];
      socialLinks.splice(index, 1);
      
      return {
        profile: {
          ...state.profile,
          socialLinks,
        },
      };
    }),
}));

// Analytics Store
export const useAnalyticsStore = create<AnalyticsState>((set) => ({
  analytics: null,
  setAnalytics: (analytics) => set({ analytics }),
}));

// AI Insights Store
export const useAiInsightStore = create<AiInsightState>((set) => ({
  insights: [],
  setInsights: (insights) => set({ insights }),
  addInsight: (insight) => set((state) => ({ insights: [insight, ...state.insights] })),
  markInsightAsSeen: (id) =>
    set((state) => ({
      insights: state.insights.map((insight) =>
        insight.id === id ? { ...insight, seen: true } : insight
      ),
    })),
}));
