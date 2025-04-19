const DISCOGS_API_BASE_URL = 'https://api.discogs.com';

interface DiscogsRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; // Add other methods if needed
  headers?: Record<string, string>;
  body?: unknown; // Replaced 'any' with 'unknown' for better type safety
}

/**
 * Makes an authenticated request to the Discogs API.
 *
 * @param endpoint - The API endpoint path (e.g., '/users/username/collection/folders/0/releases').
 * @param token - The user's Discogs Personal Access Token.
 * @param options - Optional fetch options (method, headers, body).
 * @returns A Promise resolving to the JSON response from the API.
 * @throws An error if the request fails or the API returns an error status.
 */
export async function makeDiscogsRequest<T>(
  endpoint: string,
  token: string,
  options: DiscogsRequestOptions = {}
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

  try {
    const response = await fetch(url, {
      method: method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      // Attempt to parse error details from Discogs response
      let errorDetails = `HTTP error! status: ${response.status}`;
      try {
        const errorJson = await response.json();
        errorDetails = errorJson.message || JSON.stringify(errorJson);
      } catch (_e) { // Prefix unused variable
        // Ignore if response is not JSON or empty
      }
      throw new Error(`Discogs API request failed: ${errorDetails}`);
    }

    // Handle cases where response might be empty (e.g., 204 No Content)
    if (response.status === 204) {
      return null as T; // Or handle as appropriate for your use case
    }

    return await response.json() as T;

  } catch (error) {
    console.error(`Error making Discogs request to ${endpoint}:`, error);
    // Re-throw the error to be handled by the caller
    throw error;
  }
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