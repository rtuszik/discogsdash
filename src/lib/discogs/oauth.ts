import OAuth from "oauth-1.0a";
import { getSetting, setSetting } from "../db";
import { withRetry, createDiscogsRetryOptions } from "../retryUtils";

const DISCOGS_API_BASE_URL = "https://api.discogs.com";
const REQUEST_TOKEN_URL = "https://api.discogs.com/oauth/request_token";
const AUTHORIZE_URL = "https://www.discogs.com/oauth/authorize";
const ACCESS_TOKEN_URL = "https://api.discogs.com/oauth/access_token";

interface OAuthTokens {
    key: string;
    secret: string;
}


// Simple file-based storage for request tokens (better than memory for Docker containers)
import { writeFileSync, readFileSync, existsSync, unlinkSync, mkdirSync } from "fs";
import { join } from "path";

const TOKEN_STORAGE_DIR = "/tmp/oauth-tokens";

function ensureStorageDir() {
    try {
        mkdirSync(TOKEN_STORAGE_DIR, { recursive: true });
    } catch (err: unknown) {
        // Only ignore directory already exists errors
        if (err && typeof err === 'object' && 'code' in err &&
            (err.code === 'EEXIST' || err.code === 'EISDIR')) {
            return; // Directory already exists, this is fine
        }
        // Log and rethrow other errors (permissions, ENOSPC, etc.)
        console.error(`Failed to create OAuth token storage directory ${TOKEN_STORAGE_DIR}:`, err);
        throw err;
    }
}

function storeRequestToken(token: string, secret: string, expiresAt: number) {
    ensureStorageDir();
    const tokenFile = join(TOKEN_STORAGE_DIR, `${token}.json`);
    writeFileSync(tokenFile, JSON.stringify({ secret, expiresAt }));
}

function getRequestTokenSecret(token: string): string | null {
    const tokenFile = join(TOKEN_STORAGE_DIR, `${token}.json`);
    if (!existsSync(tokenFile)) {
        return null;
    }

    try {
        const data = JSON.parse(readFileSync(tokenFile, "utf8"));

        // Check if expired
        if (Date.now() > data.expiresAt) {
            unlinkSync(tokenFile);
            return null;
        }

        return data.secret;
    } catch (_err) {
        return null;
    }
}

export class DiscogsOAuth {
    private oauth: OAuth;
    private consumerKey: string;
    private consumerSecret: string;

    constructor() {
        this.consumerKey = process.env.DISCOGS_CONSUMER_KEY || "";
        this.consumerSecret = process.env.DISCOGS_CONSUMER_SECRET || "";

        if (!this.consumerKey || !this.consumerSecret) {
            throw new Error("DISCOGS_CONSUMER_KEY and DISCOGS_CONSUMER_SECRET must be set");
        }

        this.oauth = new OAuth({
            consumer: {
                key: this.consumerKey,
                secret: this.consumerSecret,
            },
            signature_method: "PLAINTEXT",
        });
    }

    async getStoredTokens(): Promise<OAuthTokens | null> {
        try {
            const tokenKey = await getSetting("oauth_token");
            const tokenSecret = await getSetting("oauth_token_secret");

            if (tokenKey && tokenSecret) {
                return {
                    key: tokenKey,
                    secret: tokenSecret,
                };
            }
        } catch (error) {
            console.error("Error retrieving stored OAuth tokens:", error instanceof Error ? error.message : "Unknown error");
        }
        return null;
    }

    async storeTokens(tokens: OAuthTokens): Promise<void> {
        try {
            await setSetting("oauth_token", tokens.key);
            await setSetting("oauth_token_secret", tokens.secret);
        } catch (error) {
            console.error("Error storing OAuth tokens:", error instanceof Error ? error.message : "Unknown error");
            throw error;
        }
    }

    async getRequestToken(): Promise<{ token: string; secret: string; authorizeUrl: string }> {
        return withRetry(async () => {
            const requestData = {
                url: REQUEST_TOKEN_URL,
                method: "GET",
                data: {
                    oauth_callback: "oob", // out-of-band for desktop/server apps
                },
            };

            const authHeaders = this.oauth.toHeader(this.oauth.authorize(requestData)) as unknown as Record<string, string>;

            console.log("🔑 Making OAuth request token request...");

            const response = await fetch(REQUEST_TOKEN_URL, {
                method: "GET",
                headers: {
                    ...authHeaders,
                    "User-Agent": "DiscogsDashApp/0.1 (+https://github.com/rtuszik/discogsdash)",
                },
            });

            if (!response.ok) {
                const errorBody = await response.text();
                console.error("OAuth request failed:", response.status, response.statusText, errorBody);

                if (response.status === 401) {
                    throw new Error(`Unauthorized: Invalid consumer key or secret. Please check your DISCOGS_CONSUMER_KEY and DISCOGS_CONSUMER_SECRET environment variables. Make sure you have registered your application at https://www.discogs.com/settings/developers`);
                }

                throw new Error(`Failed to get request token: ${response.status} ${response.statusText} - ${errorBody}`);
            }

            const responseText = await response.text();
            const params = new URLSearchParams(responseText);

            const token = params.get("oauth_token");
            const secret = params.get("oauth_token_secret");

            if (!token || !secret) {
                throw new Error("Invalid request token response");
            }

            // Store request token temporarily (15 minutes expiry)
            storeRequestToken(token, secret, Date.now() + 15 * 60 * 1000);

            const authorizeUrl = `${AUTHORIZE_URL}?oauth_token=${token}`;

            console.log("✅ Successfully obtained request token");
            return { token, secret, authorizeUrl };
        }, createDiscogsRetryOptions());
    }

    getStoredRequestTokenSecret(requestToken: string): string | null {
        return getRequestTokenSecret(requestToken);
    }

    async getAccessToken(
        requestToken: string,
        requestTokenSecret: string,
        verifier: string,
    ): Promise<OAuthTokens> {
        // Separate the token acquisition from token storage to avoid retrying with consumed tokens
        const tokens = await withRetry(async () => {
            const requestData = {
                url: ACCESS_TOKEN_URL,
                method: "POST",
            };

            const token = {
                key: requestToken,
                secret: requestTokenSecret,
            };

            const authData = this.oauth.authorize(requestData, token);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (authData as any).oauth_verifier = verifier;

            const headers = this.oauth.toHeader(authData) as unknown as Record<string, string>;

            console.log("🔑 Making OAuth access token request...");

            const response = await fetch(ACCESS_TOKEN_URL, {
                method: "POST",
                headers: {
                    ...headers,
                    "User-Agent": "DiscogsDashApp/0.1 (+https://github.com/rtuszik/discogsdash)",
                },
            });

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`Failed to get access token: ${response.status} ${response.statusText} - ${errorBody}`);
            }

            const responseText = await response.text();
            const params = new URLSearchParams(responseText);

            const accessToken = params.get("oauth_token");
            const accessTokenSecret = params.get("oauth_token_secret");

            if (!accessToken || !accessTokenSecret) {
                throw new Error("Invalid access token response");
            }

            console.log("✅ Successfully obtained access token");
            return {
                key: accessToken,
                secret: accessTokenSecret,
            };
        }, createDiscogsRetryOptions());

        // Store tokens separately with their own retry logic
        await withRetry(async () => {
            await this.storeTokens(tokens);
        }, createDiscogsRetryOptions());

        return tokens;
    }

    getAuthHeaders(url: string, method: string = "GET", tokens: OAuthTokens): Record<string, string> {
        const requestData = {
            url,
            method,
        };

        const authData = this.oauth.authorize(requestData, tokens);
        return this.oauth.toHeader(authData) as unknown as Record<string, string>;
    }

    async makeAuthenticatedRequest<T>(
        endpoint: string,
        options: { method?: string; body?: unknown } = {},
    ): Promise<T> {
        return withRetry(async () => {
            const tokens = await this.getStoredTokens();
            if (!tokens) {
                throw new Error("No OAuth tokens found. Please complete OAuth flow first.");
            }

            const url = endpoint.startsWith("http") ? endpoint : `${DISCOGS_API_BASE_URL}${endpoint}`;
            const method = options.method || "GET";

            const authHeaders = this.getAuthHeaders(url, method, tokens);

            console.log(`🌐 Making authenticated request to ${method} ${endpoint}`);

            const response = await fetch(url, {
                method,
                headers: {
                    ...authHeaders,
                    "User-Agent": "DiscogsDashApp/0.1 (+https://github.com/rtuszik/discogsdash)",
                    "Content-Type": "application/json",
                },
                body: options.body ? JSON.stringify(options.body) : undefined,
            });

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`HTTP error! status: ${response.status} - ${errorBody}`);
            }

            if (response.status === 204) {
                return null as T;
            }

            return (await response.json()) as T;
        }, createDiscogsRetryOptions());
    }
}

export async function initializeOAuthIfNeeded(): Promise<void> {
    const oauth = new DiscogsOAuth();
    const tokens = await oauth.getStoredTokens();

    if (!tokens) {
        console.log("No OAuth tokens found. You need to complete the OAuth flow.");
        console.log("Run the OAuth setup endpoint or script to authenticate with Discogs.");
        throw new Error("OAuth tokens not found. Please complete OAuth authentication first.");
    }

    console.log("OAuth tokens found and ready to use.");
}