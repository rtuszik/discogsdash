import { HttpResponse, http } from "msw";

// Define the base URL for the Discogs API
const discogsApiBaseUrl = "https://api.discogs.com";

/**
 * Add MSW handlers for the Discogs API endpoints used by the application.
 * Example:
 * http.get(`${discogsApiBaseUrl}/users/:username/collection/folders`, () => {
 *   return HttpResponse.json({ folders: [{ id: 1, name: 'All' }] });
 * })
 */
export const handlers = [
    // TODO: Add specific Discogs API handlers here as tests are written
];
