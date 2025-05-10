/**
 * Retry utility with exponential backoff
 * 
 * @param fn Function to retry
 * @param options Retry options
 * @returns Result of the function
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>, 
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    factor?: number;
    onRetry?: (attempt: number, error: Error, delay: number) => void;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 200,
    maxDelay = 5000,
    factor = 2,
    onRetry = () => {}
  } = options;

  let attempt = 0;
  let delay = initialDelay;

  while (true) {
    try {
      return await fn();
    } catch (error) {
      attempt++;
      
      if (attempt >= maxRetries) {
        console.error(`Retry failed after ${attempt} attempts:`, error);
        throw error;
      }
      
      // Calculate next delay with exponential backoff
      delay = Math.min(delay * factor, maxDelay);
      
      // Add some jitter to avoid thundering herd problem
      const jitter = delay * 0.1 * Math.random();
      const nextDelay = delay + jitter;
      
      // Call the onRetry callback
      onRetry(attempt, error, nextDelay);
      
      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, nextDelay));
    }
  }
}