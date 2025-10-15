import { createDiscogsRetryOptions, withRetry } from "../retryUtils";
import { DiscogsOAuth } from "./oauth";

const DISCOGS_API_BASE_URL = "https://api.discogs.com";

interface DiscogsRequestOptions {
    method?: "GET" | "POST" | "PUT" | "DELETE";
    headers?: Record<string, string>;
    body?: unknown;
}

let oauthClient: DiscogsOAuth | null = null;

function getOAuthClient(): DiscogsOAuth {
    if (!oauthClient) {
        oauthClient = new DiscogsOAuth();
    }
    return oauthClient;
}

export async function makeDiscogsRequest<T>(endpoint: string, options: DiscogsRequestOptions = {}): Promise<T> {
    return withRetry(async () => {
        const oauth = getOAuthClient();
        const tokens = await oauth.getStoredTokens();

        if (!tokens) {
            throw new Error("No OAuth tokens found. Please complete OAuth authentication first.");
        }

        const url = `${DISCOGS_API_BASE_URL}${endpoint}`;
        const { method = "GET", headers = {}, body } = options;

        const authHeaders = oauth.getAuthHeaders(url, method, tokens);

        const defaultHeaders: Record<string, string> = {
            "User-Agent": "DiscogsDashApp/0.1 (+https://github.com/rtuszik/discogsdash)",
            "Content-Type": "application/json",
            ...authHeaders,
        };

        const requestHeaders = { ...defaultHeaders, ...headers };

        console.log(`🌐 Making Discogs API request to ${method} ${endpoint}`);

        const response = await fetch(url, {
            method: method,
            headers: requestHeaders,
            body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
            const errorBody = await response.text();

            // Check for Retry-After header on 429 responses
            if (response.status === 429) {
                const retryAfter = response.headers.get("Retry-After");
                if (retryAfter) {
                    console.log(`🚦 Rate limited. Retry-After: ${retryAfter} seconds`);
                }
            }

            throw new Error(`Discogs API request failed: ${response.status} ${response.statusText} - ${errorBody}`);
        }

        if (response.status === 204) {
            return null as T;
        }

        return (await response.json()) as T;
    }, createDiscogsRetryOptions());
}

interface PriceSuggestion {
    currency: string;
    value: number;
}

type PriceSuggestionsResponse = Record<string, PriceSuggestion>;

export async function fetchPriceSuggestions(releaseId: number): Promise<PriceSuggestionsResponse | null> {
    const endpoint = `/marketplace/price_suggestions/${releaseId}`;
    try {
        const suggestions = await makeDiscogsRequest<PriceSuggestionsResponse>(endpoint);
        return suggestions;
    } catch (error: unknown) {
        if (error instanceof Error && error.message.includes("404")) {
            console.log(`No price suggestions found for release ID ${releaseId}.`);
            return null;
        }

        console.error(`Error fetching price suggestions for release ID ${releaseId}:`, error);
        throw error;
    }
}
