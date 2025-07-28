const DISCOGS_API_BASE_URL = "https://api.discogs.com";

interface DiscogsRequestOptions {
    method?: "GET" | "POST" | "PUT" | "DELETE";
    headers?: Record<string, string>;
    body?: unknown;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function makeDiscogsRequest<T>(
    endpoint: string,
    token: string,
    options: DiscogsRequestOptions = {},
    maxRetries: number = 3,
    initialDelayMs: number = 1500,
): Promise<T> {
    const url = `${DISCOGS_API_BASE_URL}${endpoint}`;
    const { method = "GET", headers = {}, body } = options;

    const defaultHeaders: Record<string, string> = {
        "User-Agent": "DiscogsDashApp/0.1 (+https://github.com/rtuszik/discogsdash)",
        Authorization: `Discogs token=${token}`,
        "Content-Type": "application/json",
    };

    const requestHeaders = { ...defaultHeaders, ...headers };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        let response: Response | undefined;
        try {
            response = await fetch(url, {
                method: method,
                headers: requestHeaders,
                body: body ? JSON.stringify(body) : undefined,
            });

            if (response.ok) {
                if (response.status === 204) {
                    return null as T;
                }
                return (await response.json()) as T;
            }

            if (response.status === 429) {
                lastError = new Error(
                    `Discogs API rate limit exceeded (status: 429) on attempt ${attempt + 1}`,
                );
                console.warn(`${lastError.message} for ${endpoint}`);
            } else {
                const errorDetails =
                    `HTTP error! status: ${response.status} ${response.statusText || ""}`.trim();
                lastError = new Error(`Discogs API request failed: ${errorDetails}`);
                break;
            }
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            console.warn(`Attempt ${attempt + 1} failed for ${endpoint}: ${lastError.message}`);
        }

        if (attempt < maxRetries) {
            let retryDelayMs = initialDelayMs * Math.pow(2, attempt) + Math.random() * 1000;

            if (response?.status === 429) {
                const retryAfterHeader = response.headers.get("Retry-After");
                if (retryAfterHeader) {
                    const retryAfterSeconds = parseInt(retryAfterHeader, 10);
                    if (!isNaN(retryAfterSeconds)) {
                        retryDelayMs = Math.max(retryDelayMs, retryAfterSeconds * 1000 + 500);
                        console.log(`Respecting Retry-After header: waiting ${retryDelayMs}ms`);
                    }
                }
            }

            console.log(
                `Retrying request to ${endpoint} in ${retryDelayMs.toFixed(0)}ms (attempt ${attempt + 2}/${maxRetries + 1})...`,
            );
            await delay(retryDelayMs);
            continue;
        } else {
            console.error(`Max retries reached after error on ${endpoint}.`);
            break;
        }
    }

    console.error(
        `Failed to make Discogs request to ${endpoint} after ${maxRetries + 1} attempts.`,
    );
    throw lastError ?? new Error(`Discogs request failed after ${maxRetries + 1} attempts.`);
}

interface PriceSuggestion {
    currency: string;
    value: number;
}

type PriceSuggestionsResponse = Record<string, PriceSuggestion>;

export async function fetchPriceSuggestions(
    releaseId: number,
    token: string,
): Promise<PriceSuggestionsResponse | null> {
    const endpoint = `/marketplace/price_suggestions/${releaseId}`;
    try {
        const suggestions = await makeDiscogsRequest<PriceSuggestionsResponse>(endpoint, token);
        return suggestions;
    } catch (error: unknown) {
        if (error instanceof Error && error.message.includes("status: 404")) {
            console.log(`No price suggestions found for release ID ${releaseId}.`);
            return null;
        }

        console.error(`Error fetching price suggestions for release ID ${releaseId}:`, error);
        throw error;
    }
}

