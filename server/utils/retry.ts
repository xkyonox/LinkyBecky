/**
 * RetryOptions interface for configuring retry behavior
 */
interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  
  /** Initial delay in milliseconds between retries (default: 200) */
  initialDelay?: number;
  
  /** Maximum delay in milliseconds between retries (default: 5000) */
  maxDelay?: number;
  
  /** Exponential backoff factor (default: 2) */
  factor?: number;
  
  /** Whether to add jitter to delay to avoid thundering herd (default: true) */
  jitter?: boolean;
  
  /** Human-readable description of the operation for logging */
  description?: string;
  
  /** Called before each retry with attempt number, error and delay */
  onRetry?: (attempt: number, error: unknown, delay: number) => void;
}

/**
 * Retry utility with exponential backoff and detailed logging
 * 
 * This function executes the provided function and automatically retries on failure
 * with exponential backoff, jitter, and detailed logging.
 * 
 * @param fn Function to retry. Will be called with the current attempt number (1-based)
 * @param options Retry configuration options
 * @returns Promise that resolves with the result of the function or rejects after all retries fail
 */
export async function retryWithBackoff<T>(
  fn: (attempt: number) => Promise<T>, 
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 200,
    maxDelay = 5000,
    factor = 2,
    jitter = true,
    description = 'operation',
    onRetry = () => {}
  } = options;

  let currentAttempt = 1; // Start at 1 for easier logging (first attempt = 1)
  let currentDelay = initialDelay;
  const startTime = Date.now();

  // For logging purposes
  const operationId = Math.random().toString(36).substring(2, 10);
  const logPrefix = description 
    ? `[Retry:${description}][${operationId}]` 
    : `[Retry][${operationId}]`;

  try {
    console.log(`${logPrefix} Starting attempt ${currentAttempt}/${maxRetries + 1}`);
    return await fn(currentAttempt);
  } catch (error) {
    const attemptDuration = Date.now() - startTime;
    console.warn(`${logPrefix} Attempt ${currentAttempt} failed after ${attemptDuration}ms:`, 
      error instanceof Error ? error.message : String(error));
    
    while (currentAttempt <= maxRetries) {
      // Calculate next delay with exponential backoff
      currentDelay = Math.min(currentDelay * factor, maxDelay);
      
      // Add jitter to avoid thundering herd problem (if enabled)
      let nextDelay = currentDelay;
      if (jitter) {
        const jitterAmount = currentDelay * 0.1 * Math.random();
        nextDelay = currentDelay + jitterAmount;
      }
      
      // Call the onRetry callback with useful information
      onRetry(currentAttempt, error, nextDelay);
      
      console.log(`${logPrefix} Waiting ${Math.round(nextDelay)}ms before attempt ${currentAttempt + 1}/${maxRetries + 1}`);
      
      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, nextDelay));
      
      // Increment attempt counter
      currentAttempt++;
      
      // Retry the operation
      const retryStartTime = Date.now();
      try {
        console.log(`${logPrefix} Starting attempt ${currentAttempt}/${maxRetries + 1}`);
        return await fn(currentAttempt);
      } catch (retryError) {
        const retryDuration = Date.now() - retryStartTime;
        console.warn(`${logPrefix} Attempt ${currentAttempt} failed after ${retryDuration}ms:`, 
          retryError instanceof Error ? retryError.message : String(retryError));
        
        // If this was the last attempt, rethrow the error
        if (currentAttempt >= maxRetries + 1) {
          const totalDuration = Date.now() - startTime;
          console.error(`${logPrefix} All ${maxRetries + 1} attempts failed after ${totalDuration}ms total`);
          throw retryError;
        }
        
        // Otherwise, continue to the next iteration
        error = retryError;
      }
    }
    
    // This should never happen due to the throw in the loop above
    // but TypeScript needs this to satisfy the return type
    throw error;
  }
}