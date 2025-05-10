import { useLocation } from "wouter";

export function useQueryParams() {
  const [location] = useLocation();
  
  // Extract query params from location
  const getQueryParams = () => {
    const searchParams = new URLSearchParams(location.split("?")[1] || "");
    const params: Record<string, string> = {};
    
    for (const [key, value] of searchParams.entries()) {
      params[key] = value;
    }
    
    return params;
  };
  
  // Create a new query string from params object
  const createQueryString = (params: Record<string, string>) => {
    const searchParams = new URLSearchParams();
    
    for (const [key, value] of Object.entries(params)) {
      if (value) {
        searchParams.append(key, value);
      }
    }
    
    const queryString = searchParams.toString();
    return queryString ? `?${queryString}` : "";
  };
  
  return {
    getQueryParams,
    createQueryString
  };
}
