const DISCOGS_API_BASE_URL = 'https://api.discogs.com';

interface DiscogsRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; // Add other methods if needed
  headers?: Record<string, string>;
  body?: unknown; // Replaced 'any' with 'unknown' for better type safety
}

// Helper function for delays
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Makes an authenticated request to the Discogs API with retry logic.
 *
 * @param endpoint - The API endpoint path (e.g., '/users/username/collection/folders/0/releases').
 * @param token - The user's Discogs Personal Access Token.
 * @param options - Optional fetch options (method, headers, body).
 * @param maxRetries - Maximum number of retries for rate limits or network errors.
 * @param initialDelayMs - Initial delay in milliseconds for exponential backoff.
 * @returns A Promise resolving to the JSON response from the API.
 * @throws An error if the request fails after all retries or for non-retryable errors.
 */
export async function makeDiscogsRequest<T>(
  endpoint: string,
  token: string,
  options: DiscogsRequestOptions = {},
  maxRetries: number = 3,
  initialDelayMs: number = 1500
): Promise<T> {
  const url = `${DISCOGS_API_BASE_URL}${endpoint}`;
  const { method = 'GET', headers = {}, body } = options;

  const defaultHeaders: Record<string, string> = {
    'User-Agent': 'DiscogsDashApp/0.1 (+https://github.com/rtuszik/discogsdash)', // Discogs requires a User-Agent
    'Authorization': `Discogs token=${token}`,
    'Content-Type': 'application/json', // Default, adjust if needed
  };

  // Merge default headers with provided headers, allowing overrides
  const requestHeaders = { ...defaultHeaders, ...headers };

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        method: method,
        headers: requestHeaders,
        body: body ? JSON.stringify(body) : undefined,
        // Consider adding a request timeout using AbortController if needed
        // signal: AbortSignal.timeout(15000) // Example: 15 second timeout per attempt
      });

      if (response.ok) {
        // Handle cases where response might be empty (e.g., 204 No Content)
        if (response.status === 204) {
          return null as T; // Or handle as appropriate for your use case
        }
        return await response.json() as T; // Success!
      }

      // --- Handle non-OK responses ---

      // Check for rate limiting (429)
      if (response.status === 429) {
        lastError = new Error(`Discogs API rate limit exceeded (status: 429) on attempt ${attempt + 1}`);
        console.warn(`${lastError.message} for ${endpoint}`);

        if (attempt < maxRetries) {
          let retryDelayMs = initialDelayMs * Math.pow(2, attempt) + (Math.random() * 1000); // Exponential backoff + jitter

          // Check for Retry-After header (value is in seconds)
          const retryAfterHeader = response.headers.get('Retry-After');
          if (retryAfterHeader) {
            const retryAfterSeconds = parseInt(retryAfterHeader, 10);
            if (!isNaN(retryAfterSeconds)) {
              retryDelayMs = Math.max(retryDelayMs, retryAfterSeconds * 1000 + 500); // Use header value + buffer, ensure it's at least our backoff
              console.log(`Respecting Retry-After header: waiting ${retryDelayMs}ms`);
            }
          }

          console.log(`Retrying request to ${endpoint} in ${retryDelayMs.toFixed(0)}ms (attempt ${attempt + 2}/${maxRetries + 1})...`);
          await delay(retryDelayMs);
          continue; // Go to next attempt
        } else {
          console.error(`Max retries reached for rate limit error on ${endpoint}.`);
          break; // Exit loop, will throw lastError below
        }
      }

      // --- Handle other non-retryable HTTP errors ---
      let errorDetails = `HTTP error! status: ${response.status}`;
      try {
        const errorJson = await response.json();
        errorDetails = errorJson.message || JSON.stringify(errorJson);
      } catch (_e) {
        // Ignore if response is not JSON or empty
      }
      // Throw immediately for non-429 errors
      throw new Error(`Discogs API request failed: ${errorDetails}`);

    } catch (error) {
      // --- Handle network errors or errors thrown above ---
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`Attempt ${attempt + 1} failed for ${endpoint}: ${lastError.message}`);

      // Decide if the error is potentially transient (e.g., network issue)
      // For simplicity here, we retry on any caught error except the non-429 HTTP errors thrown explicitly above.
      // More specific network error checking could be added (e.g., checking error.name or error.code).
      if (attempt < maxRetries) {
         const retryDelayMs = initialDelayMs * Math.pow(2, attempt) + (Math.random() * 1000); // Exponential backoff + jitter
         console.log(`Retrying request to ${endpoint} in ${retryDelayMs.toFixed(0)}ms due to error (attempt ${attempt + 2}/${maxRetries + 1})...`);
         await delay(retryDelayMs);
         continue; // Go to next attempt
      } else {
         console.error(`Max retries reached after error on ${endpoint}.`);
         break; // Exit loop, will throw lastError below
      }
    }
  }

  // If loop finished without returning successfully, throw the last encountered error
  console.error(`Failed to make Discogs request to ${endpoint} after ${maxRetries + 1} attempts.`);
  throw lastError ?? new Error(`Discogs request failed after ${maxRetries + 1} attempts.`);
}


// --- Specific API Call Functions ---

// Define the expected structure for a single price suggestion
interface PriceSuggestion {
  currency: string;
  value: number;
}

// Define the expected structure for the API response
// Keys are condition strings like "Mint (M)", "Near Mint (NM or M-)", etc.
type PriceSuggestionsResponse = Record<string, PriceSuggestion>;

/**
 * Fetches suggested market prices for a specific release based on condition.
 *
 * @param releaseId - The Discogs ID of the release.
 * @param token - The user's Discogs Personal Access Token.
 * @returns A Promise resolving to an object containing price suggestions keyed by condition,
 *          or null if no suggestions are found (e.g., 404 response).
 * @throws An error if the request fails for other reasons (e.g., network issue, invalid token).
 */
export async function fetchPriceSuggestions(
  releaseId: number,
  token: string
): Promise<PriceSuggestionsResponse | null> {
  const endpoint = `/marketplace/price_suggestions/${releaseId}`;
  try {
    // Use the generic request function with the specific type
    const suggestions = await makeDiscogsRequest<PriceSuggestionsResponse>(endpoint, token);
    return suggestions;
  } catch (error: unknown) { // Replaced 'any' with 'unknown'
    // Discogs API might return 404 if no suggestions exist, which makeDiscogsRequest throws an error for.
    // We want to treat 404 specifically as "no suggestions found" (null) rather than a hard error.
    // We need to check if the error message indicates a 404 status.
    // Note: This relies on the error message format from makeDiscogsRequest.
    if (error instanceof Error && error.message.includes('status: 404')) {
      console.log(`No price suggestions found for release ID ${releaseId}.`);
      return null; // Return null specifically for 404 errors
    }
    // Re-throw other errors (like auth errors, network issues, etc.)
    console.error(`Error fetching price suggestions for release ID ${releaseId}:`, error);
    throw error;
  }
}