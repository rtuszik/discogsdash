import { describe, it, expect, vi, beforeEach, afterEach, MockInstance } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../mocks/node";
import { makeDiscogsRequest, fetchPriceSuggestions } from "./client";

describe("Discogs API Client (src/lib/discogs/client.ts)", { timeout: 15000 }, () => {
    const MOCK_TOKEN = "test-token-123";
    const MOCK_ENDPOINT = "/test/endpoint";
    const MOCK_URL = `https://api.discogs.com${MOCK_ENDPOINT}`;
    const MOCK_USER_AGENT = "DiscogsDashApp/0.1 (+https://github.com/rtuszik/discogsdash)";

    let logSpy: ReturnType<typeof vi.spyOn>;
    let warnSpy: ReturnType<typeof vi.spyOn>;
    let errorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.resetAllMocks();

        logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        logSpy.mockRestore();
        warnSpy.mockRestore();
        errorSpy.mockRestore();
        vi.restoreAllMocks();
    });

    describe("makeDiscogsRequest", () => {
        it("should make a successful GET request with correct headers", async () => {
            const mockResponseData = { success: true, data: "test" };
            server.use(
                http.get(MOCK_URL, ({ request }) => {
                    expect(request.headers.get("User-Agent")).toBe(MOCK_USER_AGENT);
                    expect(request.headers.get("Authorization")).toBe(
                        `Discogs token=${MOCK_TOKEN}`,
                    );
                    return HttpResponse.json(mockResponseData);
                }),
            );

            const result = await makeDiscogsRequest(MOCK_ENDPOINT, MOCK_TOKEN);
            expect(result).toEqual(mockResponseData);
        });

        it("should make a successful POST request with body and custom headers", async () => {
            const mockResponseData = { id: 123 };
            const mockRequestBody = { name: "new item" };
            const mockCustomHeaders = { "X-Custom": "value" };

            server.use(
                http.post(MOCK_URL, async ({ request }) => {
                    expect(request.headers.get("User-Agent")).toBe(MOCK_USER_AGENT);
                    expect(request.headers.get("Authorization")).toBe(
                        `Discogs token=${MOCK_TOKEN}`,
                    );
                    expect(request.headers.get("Content-Type")).toBe("application/json");
                    expect(request.headers.get("X-Custom")).toBe("value");
                    expect(await request.json()).toEqual(mockRequestBody);
                    return HttpResponse.json(mockResponseData, { status: 201 });
                }),
            );

            const result = await makeDiscogsRequest(MOCK_ENDPOINT, MOCK_TOKEN, {
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
            const result = await makeDiscogsRequest(MOCK_ENDPOINT, MOCK_TOKEN);
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

            const result = await makeDiscogsRequest(MOCK_ENDPOINT, MOCK_TOKEN, {}, 1, 10);

            expect(result).toEqual(mockSuccessResponse);
            expect(requestCount).toBe(2);
            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining(
                    "Discogs API rate limit exceeded (status: 429) on attempt 1",
                ),
            );
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
            const result = await makeDiscogsRequest(MOCK_ENDPOINT, MOCK_TOKEN, {}, 1, 10);
            const endTime = Date.now();

            expect(result).toEqual(mockSuccessResponse);
            expect(requestCount).toBe(2);
            expect(logSpy).toHaveBeenCalledWith(
                expect.stringContaining(
                    `Respecting Retry-After header: waiting ${retryAfterSeconds * 1000 + 500}ms`,
                ),
            );
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

            const maxRetries = 1;
            const initialDelay = 10;
            try {
                await makeDiscogsRequest(MOCK_ENDPOINT, MOCK_TOKEN, {}, maxRetries, initialDelay);
                throw new Error("Test should have thrown an error.");
            } catch (error) {
                expect(error).toBeInstanceOf(Error);
                expect((error as Error).message).toMatch(
                    /Discogs API rate limit exceeded \(status: 429\) on attempt 2/,
                );
            }
            expect(requestCount).toBe(maxRetries + 1);
            expect(errorSpy).toHaveBeenCalledWith(
                "Max retries reached after error on /test/endpoint.",
            );

            expect(errorSpy).toHaveBeenCalledWith(
                "Failed to make Discogs request to /test/endpoint after 2 attempts.",
            );
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
                await makeDiscogsRequest(MOCK_ENDPOINT, MOCK_TOKEN);
                throw new Error("Test should have thrown an error.");
            } catch (error) {
                expect(error).toBeInstanceOf(Error);
                expect((error as Error).message).toBe(
                    `Discogs API request failed: HTTP error! status: 401 Unauthorized`,
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

            const maxRetries = 1;
            const initialDelay = 10;
            const expectedErrorMessage = "Failed to fetch";

            try {
                await makeDiscogsRequest(MOCK_ENDPOINT, MOCK_TOKEN, {}, maxRetries, initialDelay);
                throw new Error("Test should have thrown an error.");
            } catch (error) {
                expect(error).toBeInstanceOf(Error);

                expect((error as Error).message).toBe(expectedErrorMessage);
            }
            expect(requestCount).toBe(maxRetries + 1);
            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining(
                    `Attempt 1 failed for ${MOCK_ENDPOINT}: ${expectedErrorMessage}`,
                ),
            );
            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining(
                    `Attempt 2 failed for ${MOCK_ENDPOINT}: ${expectedErrorMessage}`,
                ),
            );
            expect(errorSpy).toHaveBeenCalledWith(
                `Max retries reached after error on ${MOCK_ENDPOINT}.`,
            );

            expect(errorSpy).toHaveBeenCalledWith(
                `Failed to make Discogs request to ${MOCK_ENDPOINT} after 2 attempts.`,
            );
        });
    });

    describe("fetchPriceSuggestions", () => {
        const RELEASE_ID = 12345;
        const PRICE_ENDPOINT = `/marketplace/price_suggestions/${RELEASE_ID}`;
        const MOCK_SUGGESTIONS = { "Good (G)": { value: 5.0, currency: "USD" } };
        const PRICE_URL = `https://api.discogs.com${PRICE_ENDPOINT}`;

        it("should call fetch and return suggestions on success", async () => {
            server.use(http.get(PRICE_URL, () => HttpResponse.json(MOCK_SUGGESTIONS)));
            const result = await fetchPriceSuggestions(RELEASE_ID, MOCK_TOKEN);
            expect(result).toEqual(MOCK_SUGGESTIONS);
        });

        it("should return null if fetch returns a 404 error", async () => {
            server.use(http.get(PRICE_URL, () => new HttpResponse(null, { status: 404 })));
            const result = await fetchPriceSuggestions(RELEASE_ID, MOCK_TOKEN);
            expect(result).toBeNull();
            expect(logSpy).toHaveBeenCalledWith(
                `No price suggestions found for release ID ${RELEASE_ID}.`,
            );
        });

        it("should re-throw error if fetch returns a non-404 error", async () => {
            const errorJson = { message: "Invalid token" };
            server.use(
                http.get(PRICE_URL, () =>
                    HttpResponse.json(errorJson, { status: 401, statusText: "Unauthorized" }),
                ),
            );
            try {
                await fetchPriceSuggestions(RELEASE_ID, MOCK_TOKEN);
                throw new Error("Test should have thrown an error.");
            } catch (error) {
                expect(error).toBeInstanceOf(Error);
                expect((error as Error).message).toBe(
                    `Discogs API request failed: HTTP error! status: 401 Unauthorized`,
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
                await fetchPriceSuggestions(RELEASE_ID, MOCK_TOKEN);
                throw new Error("Test should have thrown an error.");
            } catch (error) {
                expect(error).toBeInstanceOf(Error);
                expect((error as Error).message).toBe(expectedErrorMessage);
            }
            expect(errorSpy).toHaveBeenCalledWith(
                `Error fetching price suggestions for release ID ${RELEASE_ID}:`,
                expect.any(Error),
            );
        });
    });
});

