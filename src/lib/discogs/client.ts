const DISCOGS_API_BASE_URL = 'https://api.discogs.com';

interface DiscogsRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; // Add other methods if needed
  headers?: Record<string, string>;
  body?: any; // For POST/PUT requests
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
    'User-Agent': 'DiscogsDashApp/0.1 (+https://github.com/your-repo)', // Replace with your app details
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
      } catch (e) {
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

// Example Usage (will be used in API routes later):
/*
async function getUserProfile(username: string, token: string) {
  try {
    const profile = await makeDiscogsRequest<any>(`/users/${username}`, token);
    console.log('User Profile:', profile);
    return profile;
  } catch (error) {
    console.error('Failed to get user profile:', error);
  }
}
*/