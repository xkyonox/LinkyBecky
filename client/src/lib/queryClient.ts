import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { useAuthStore } from "./store";

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
  // Get token from auth store
  const { token } = useAuthStore.getState();
  
  // Prepare headers
  const headers: Record<string, string> = {
    ...(data ? { "Content-Type": "application/json" } : {}),
    ...(token ? { "Authorization": `Bearer ${token}` } : {})
  };
  
  // Log for debugging
  console.log(`API Request to ${url} with token: ${token ? "Present" : "Missing"}`);
  
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
    // Get token from auth store
    const { token } = useAuthStore.getState();
    
    // Add Authorization header if token exists
    const headers: Record<string, string> = {
      ...(token ? { "Authorization": `Bearer ${token}` } : {})
    };
    
    console.log(`Query fetch to ${queryKey[0]} with token: ${token ? "Present" : "Missing"}`);
    
    const res = await fetch(queryKey[0] as string, {
      headers,
      credentials: "include",
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
