import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Get token directly from localStorage 
  const token = localStorage.getItem('auth_token');
  console.log(`API Request to ${url} - Starting API request function`);
  console.log(`API Request to ${url} - Token: ${token ? "Present" : "Missing"}`);
  
  
  // Prepare headers with common options
  const headers: Record<string, string> = {
    // Always include these headers
    "Accept": "application/json",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
    
    // Add content type for requests with body
    ...(data ? { "Content-Type": "application/json" } : {}),
    
    // Add Authorization header if we have a valid token
    ...(token ? { "Authorization": `Bearer ${token}` } : {})
  };
  
  console.log(`API Request to ${url} - Method: ${method}, Token: ${token ? "Present" : "Missing"}`);
  
  // Enhanced request configuration
  const requestInit: RequestInit = {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include", // Always include credentials for cookies
    mode: "cors", // Explicitly set CORS mode
    cache: "no-cache" // Prevent caching
  };
  
  try {
    console.log(`API Request to ${url} - Sending fetch request`);
    const res = await fetch(url, requestInit);
    
    // Log all response headers for debugging
    const allHeaders: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      allHeaders[key] = value;
    });
    console.log(`API Response from ${url} - Status: ${res.status}, Headers:`, allHeaders);

    if (!res.ok) {
      console.error(`API Error ${res.status}: ${res.statusText} on ${url}`);
      // Log response body for debugging
      try {
        const errorText = await res.clone().text();
        console.error(`Error response body: ${errorText}`);
      } catch (e) {
        console.error('Could not read error response body:', e);
      }
    } else {
      console.log(`API Request to ${url} - Success with status ${res.status}`);
    }

    await throwIfResNotOk(res);
    return res;
  } catch (error) {
    console.error(`API Request to ${url} - Network error:`, error);
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Get token directly from localStorage
    const token = localStorage.getItem('auth_token');
    const url = queryKey[0] as string;
    console.log(`Query to ${url} - Starting query function`);
    console.log(`Query to ${url} - Token: ${token ? "Present" : "Missing"}`);
    
    
    // Add cache-busting for all API endpoints to prevent stale data
    const finalUrl = `${url}${url.includes('?') ? '&' : '?'}_t=${Date.now()}`;
    
    // Enhanced headers with comprehensive options
    const headers: Record<string, string> = {
      "Accept": "application/json",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
      ...(token ? { "Authorization": `Bearer ${token}` } : {})
    };
    
    console.log(`Query to ${finalUrl} - Token: ${token ? "Present" : "Missing"}`);
    
    // Enhanced request configuration
    const requestInit: RequestInit = {
      method: 'GET',
      headers,
      credentials: "include", // Always include credentials for session cookie
      mode: "cors", // Explicitly set CORS mode
      cache: "no-cache" // Prevent caching
    };
    
    try {
      console.log(`Query to ${finalUrl} - Sending fetch request`);
      const res = await fetch(finalUrl, requestInit);
      
      // Log response headers for debugging
      const allHeaders: Record<string, string> = {};
      res.headers.forEach((value, key) => {
        allHeaders[key] = value;
      });
      
      if (res.status === 401) {
        console.log(`Query to ${finalUrl} - 401 Unauthorized received`);
        
        if (unauthorizedBehavior === "returnNull") {
          console.log(`Query to ${finalUrl} - Returning null as configured for 401`);
          return null;
        }
      }
      
      if (!res.ok) {
        console.error(`Query Error ${res.status}: ${res.statusText} on ${finalUrl}`);
        
        try {
          const errorText = await res.clone().text();
          console.error(`Error response body: ${errorText}`);
        } catch (e) {
          console.error('Could not read error response body:', e);
        }
      } else {
        console.log(`Query to ${finalUrl} - Success with status ${res.status}`);
      }
      
      await throwIfResNotOk(res);
      
      const data = await res.json();
      console.log(`Query to ${finalUrl} - Data received successfully`);
      return data;
    } catch (error) {
      console.error(`Query to ${finalUrl} - Error:`, error);
      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
