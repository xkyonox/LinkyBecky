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
  // Get token from localStorage directly to avoid circular imports
  let token = null;
  const authStorageRaw = localStorage.getItem('auth-storage');
  console.log('Raw auth-storage content:', authStorageRaw);
  
  try {
    if (authStorageRaw) {
      // Log exact structure of localStorage['auth-storage']
      console.log('auth-storage structure:', JSON.parse(authStorageRaw));
      
      const authStorage = JSON.parse(authStorageRaw);
      token = authStorage?.state?.token;
      
      // Check if token is in expected format (JWT)
      if (token) {
        // Check if it looks like a JWT (starts with eyJ and has two dots)
        const isValidJwtFormat = 
          typeof token === 'string' && 
          token.startsWith('eyJ') && 
          (token.match(/\./g) || []).length === 2;
        
        console.log('Token format valid:', isValidJwtFormat);
        console.log('Token first 10 chars:', token.substring(0, 10) + '...');
        
        if (!isValidJwtFormat) {
          console.error('Token does not appear to be in valid JWT format!');
        }
      } else {
        console.log('Token is missing from auth storage state');
      }
    } else {
      console.log('No auth-storage found in localStorage');
    }
  } catch (e) {
    console.error('Error parsing auth-storage from localStorage:', e);
  }
  
  // Prepare headers
  const headers: Record<string, string> = {
    ...(data ? { "Content-Type": "application/json" } : {}),
    ...(token ? { "Authorization": `Bearer ${token}` } : {})
  };
  
  // Log for debugging
  console.log(`API Request to ${url} with token: ${token ? "Present" : "Missing"}`);
  
  // For debugging - check headers
  console.log("Request headers:", headers);
  
  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  if (!res.ok) {
    console.error(`API Error ${res.status}: ${res.statusText} on ${url}`);
    // Try to log response body for debugging
    try {
      const errorText = await res.clone().text();
      console.error(`Error response: ${errorText}`);
    } catch (e) {
      console.error('Could not read error response');
    }
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Get token from localStorage directly to avoid circular imports
    let token = null;
    const authStorageRaw = localStorage.getItem('auth-storage');
    console.log('Query - Raw auth-storage content:', authStorageRaw);
    
    try {
      if (authStorageRaw) {
        const authStorage = JSON.parse(authStorageRaw);
        token = authStorage?.state?.token;
        
        // Check if token is in expected format (JWT)
        if (token) {
          // Check if it looks like a JWT (starts with eyJ and has two dots)
          const isValidJwtFormat = 
            typeof token === 'string' && 
            token.startsWith('eyJ') && 
            (token.match(/\./g) || []).length === 2;
          
          if (!isValidJwtFormat) {
            console.error('Query - Token does not appear to be in valid JWT format!');
            token = null; // Don't use invalid tokens
          }
        } else {
          console.log('Query - Token is missing from auth storage state');
        }
      } else {
        console.log('Query - No auth-storage found in localStorage');
      }
    } catch (e) {
      console.error('Query - Error parsing auth-storage from localStorage:', e);
    }
    
    // Add cache-busting for auth endpoints to prevent stale data
    const url = queryKey[0] as string;
    const isCacheSensitiveEndpoint = 
      url.includes('/api/auth/') || 
      url.includes('/profile') || 
      url.includes('/api/links');
      
    const finalUrl = isCacheSensitiveEndpoint 
      ? `${url}${url.includes('?') ? '&' : '?'}_t=${Date.now()}` 
      : url;
    
    // Add Authorization header if token exists
    const headers: Record<string, string> = {
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
      ...(token ? { "Authorization": `Bearer ${token}` } : {})
    };
    
    console.log(`Query fetch to ${finalUrl} with token: ${token ? "Present" : "Missing"}`);
    
    // For debugging - check headers
    console.log("Query headers:", headers);
    
    const res = await fetch(finalUrl, {
      method: 'GET',
      headers,
      credentials: "include", // Always include credentials for session cookie
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      console.log("401 Unauthorized, returning null as configured");
      return null;
    }
    
    if (!res.ok) {
      console.error(`Query Error ${res.status}: ${res.statusText} on ${queryKey[0]}`);
      try {
        const errorText = await res.clone().text();
        console.error(`Error response: ${errorText}`);
      } catch (e) {
        console.error('Could not read error response');
      }
    }

    await throwIfResNotOk(res);
    return await res.json();
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
