import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, MockInstance, vi } from "vitest";
import { server } from "../../mocks/node";
import { createDiscogsRetryOptions } from "../retryUtils";
import { fetchPriceSuggestions, makeDiscogsRequest } from "./client";

const mockOAuth = {
    getStoredTokens: vi.fn().mockResolvedValue({ key: "test-token", secret: "test-secret" }),
    getAuthHeaders: vi.fn().mockReturnValue({
        Authorization:
            'OAuth oauth_consumer_key="test-key",oauth_token="test-token",oauth_signature_method="PLAINTEXT",oauth_timestamp="1234567890",oauth_nonce="test-nonce",oauth_version="1.0",oauth_signature="test-signature"',
    }),
};

vi.mock("./oauth", () => ({
    DiscogsOAuth: vi.fn(() => mockOAuth),
}));

vi.mock("../retryUtils", async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        createDiscogsRetryOptions: vi.fn(() => ({
            maxRetries: 1,
            baseDelay: 10,
            maxDelay: 100,
            backoffMultiplier: 1,
            retryCondition: (error: any) => {
                if (error.message && typeof error.message === "string") {
                    const message = error.message.toLowerCase();
                    // Don't retry on 404 errors for fetchPriceSuggestions
                    if (message.includes("404")) {
                        return false;
                    }
                    return message.includes("429") || message.includes("failed to fetch");
                }
                return false;
            },
        })),
    };
});

describe("Discogs API Client (src/lib/discogs/client.ts)", { timeout: 15000 }, () => {
    const MOCK_ENDPOINT = "/test/endpoint";
    const MOCK_URL = `https://api.discogs.com${MOCK_ENDPOINT}`;
    const MOCK_USER_AGENT = "DiscogsDashApp/0.1 (+https://github.com/rtuszik/discogsdash)";

    let logSpy: ReturnType<typeof vi.spyOn>;
    let warnSpy: ReturnType<typeof vi.spyOn>;
    let errorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.resetAllMocks();

        vi.stubEnv("DISCOGS_CONSUMER_KEY", "test-key");
        vi.stubEnv("DISCOGS_CONSUMER_SECRET", "test-secret");

        mockOAuth.getStoredTokens.mockResolvedValue({ key: "test-token", secret: "test-secret" });
        mockOAuth.getAuthHeaders.mockReturnValue({
            Authorization:
                'OAuth oauth_consumer_key="test-key",oauth_token="test-token",oauth_signature_method="PLAINTEXT",oauth_timestamp="1234567890",oauth_nonce="test-nonce",oauth_version="1.0",oauth_signature="test-signature"',
        });

        logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        logSpy.mockRestore();
        warnSpy.mockRestore();
        errorSpy.mockRestore();
        vi.restoreAllMocks();
        vi.unstubAllEnvs();
    });

    describe("makeDiscogsRequest", () => {
        it("should make a successful GET request with correct headers", async () => {
            const mockResponseData = { success: true, data: "test" };
            server.use(
                http.get(MOCK_URL, ({ request }) => {
                    expect(request.headers.get("User-Agent")).toBe(MOCK_USER_AGENT);
                    expect(request.headers.get("Authorization")).toContain("OAuth");
                    return HttpResponse.json(mockResponseData);
                }),
            );

            const result = await makeDiscogsRequest(MOCK_ENDPOINT);
            expect(result).toEqual(mockResponseData);
        });

        it("should make a successful POST request with body and custom headers", async () => {
            const mockResponseData = { id: 123 };
            const mockRequestBody = { name: "new item" };
            const mockCustomHeaders = { "X-Custom": "value" };

            server.use(
                http.post(MOCK_URL, async ({ request }) => {
                    expect(request.headers.get("User-Agent")).toBe(MOCK_USER_AGENT);
                    expect(request.headers.get("Authorization")).toContain("OAuth");
                    expect(request.headers.get("Content-Type")).toBe("application/json");
                    expect(request.headers.get("X-Custom")).toBe("value");
                    expect(await request.json()).toEqual(mockRequestBody);
                    return HttpResponse.json(mockResponseData, { status: 201 });
                }),
            );

            const result = await makeDiscogsRequest(MOCK_ENDPOINT, {
                method: "POST",
                body: mockRequestBody,
                headers: mockCustomHeaders,
            });
            expect(result).toEqual(mockResponseData);
        });

        it("should return null for 204 No Content response", async () => {
            server.use(
                http.get(MOCK_URL, () => {
                    return new HttpResponse(null, { status: 204 });
                }),
            );
            const result = await makeDiscogsRequest(MOCK_ENDPOINT);
            expect(result).toBeNull();
        });

        it("should retry on 429 rate limit error and succeed on retry", async () => {
            const mockSuccessResponse = { data: "finally" };
            let requestCount = 0;
            server.use(
                http.get(MOCK_URL, () => {
                    requestCount++;
                    if (requestCount === 1) {
                        return new HttpResponse(JSON.stringify({ message: "Rate limit" }), {
                            status: 429,
                        });
                    }
                    return HttpResponse.json(mockSuccessResponse);
                }),
            );

            const result = await makeDiscogsRequest(MOCK_ENDPOINT, {});

            expect(result).toEqual(mockSuccessResponse);
            expect(requestCount).toBe(2);
        });

        it("should respect Retry-After header on 429", async () => {
            const retryAfterSeconds = 1;
            const mockSuccessResponse = { success: true };
            let requestCount = 0;
            server.use(
                http.get(MOCK_URL, () => {
                    requestCount++;
                    if (requestCount === 1) {
                        return new HttpResponse(JSON.stringify({ message: "Rate limit" }), {
                            status: 429,
                            headers: { "Retry-After": String(retryAfterSeconds) },
                        });
                    }
                    return HttpResponse.json(mockSuccessResponse);
                }),
            );

            const startTime = Date.now();
            const result = await makeDiscogsRequest(MOCK_ENDPOINT, {});
            const endTime = Date.now();

            expect(result).toEqual(mockSuccessResponse);
            expect(requestCount).toBe(2);
            expect(endTime - startTime).toBeGreaterThanOrEqual(retryAfterSeconds * 1000);
        });

        it("should fail after max retries on persistent 429", async () => {
            let requestCount = 0;
            server.use(
                http.get(MOCK_URL, () => {
                    requestCount++;
                    return new HttpResponse(JSON.stringify({ message: "Rate limit" }), {
                        status: 429,
                    });
                }),
            );

            try {
                await makeDiscogsRequest(MOCK_ENDPOINT, {});
                throw new Error("Test should have thrown an error.");
            } catch (error) {
                expect(error).toBeInstanceOf(Error);
                expect((error as Error).message).toContain("Operation failed after 2 attempts");
            }
            expect(requestCount).toBe(2);
        });

        it("should fail immediately on non-429 HTTP error", async () => {
            const errorJson = { message: "Invalid token" };
            server.use(
                http.get(MOCK_URL, () => {
                    return HttpResponse.json(errorJson, {
                        status: 401,
                        statusText: "Unauthorized",
                    });
                }),
            );

            try {
                await makeDiscogsRequest(MOCK_ENDPOINT);
                throw new Error("Test should have thrown an error.");
            } catch (error) {
                expect(error).toBeInstanceOf(Error);
                expect((error as Error).message).toBe(
                    `Discogs API request failed: 401 Unauthorized - {"message":"Invalid token"}`,
                );
            }
        });

        it("should retry on network error and fail after max retries", async () => {
            let requestCount = 0;
            server.use(
                http.get(MOCK_URL, () => {
                    requestCount++;

                    return HttpResponse.error();
                }),
            );

            const expectedErrorMessage = "Failed to fetch";

            try {
                await makeDiscogsRequest(MOCK_ENDPOINT, {});
                throw new Error("Test should have thrown an error.");
            } catch (error) {
                expect(error).toBeInstanceOf(Error);
                expect((error as Error).message).toContain("Operation failed after 2 attempts");
                expect((error as Error).message).toContain(expectedErrorMessage);
            }
            expect(requestCount).toBe(2);
        });
    });

    describe("fetchPriceSuggestions", () => {
        const RELEASE_ID = 12345;
        const PRICE_ENDPOINT = `/marketplace/price_suggestions/${RELEASE_ID}`;
        const MOCK_SUGGESTIONS = { "Good (G)": { value: 5.0, currency: "USD" } };
        const PRICE_URL = `https://api.discogs.com${PRICE_ENDPOINT}`;

        it("should call fetch and return suggestions on success", async () => {
            server.use(http.get(PRICE_URL, () => HttpResponse.json(MOCK_SUGGESTIONS)));
            const result = await fetchPriceSuggestions(RELEASE_ID);
            expect(result).toEqual(MOCK_SUGGESTIONS);
        });

        it("should return null if fetch returns a 404 error", async () => {
            server.use(http.get(PRICE_URL, () => new HttpResponse(null, { status: 404 })));
            const result = await fetchPriceSuggestions(RELEASE_ID);
            expect(result).toBeNull();
            expect(logSpy).toHaveBeenCalledWith(`No price suggestions found for release ID ${RELEASE_ID}.`);
        });

        it("should re-throw error if fetch returns a non-404 error", async () => {
            const errorJson = { message: "Invalid token" };
            server.use(
                http.get(PRICE_URL, () => HttpResponse.json(errorJson, { status: 401, statusText: "Unauthorized" })),
            );
            try {
                await fetchPriceSuggestions(RELEASE_ID);
                throw new Error("Test should have thrown an error.");
            } catch (error) {
                expect(error).toBeInstanceOf(Error);
                expect((error as Error).message).toBe(
                    `Discogs API request failed: 401 Unauthorized - {"message":"Invalid token"}`,
                );
            }
            expect(errorSpy).toHaveBeenCalledWith(
                `Error fetching price suggestions for release ID ${RELEASE_ID}:`,
                expect.any(Error),
            );
        });

        it("should re-throw error if fetch throws a network error", async () => {
            server.use(http.get(PRICE_URL, () => HttpResponse.error()));
            const expectedErrorMessage = "Failed to fetch";
            try {
                await fetchPriceSuggestions(RELEASE_ID);
                throw new Error("Test should have thrown an error.");
            } catch (error) {
                expect(error).toBeInstanceOf(Error);
                expect((error as Error).message).toContain("Operation failed after 2 attempts");
                expect((error as Error).message).toContain(expectedErrorMessage);
            }
            expect(errorSpy).toHaveBeenCalledWith(
                `Error fetching price suggestions for release ID ${RELEASE_ID}:`,
                expect.any(Error),
            );
        });
    });
});
