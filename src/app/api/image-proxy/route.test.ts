import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "./route";
import { NextRequest } from "next/server";

const mockFetch = vi.fn();
global.fetch = mockFetch;

const createMockImageResponse = (
    status: number,
    body?: BodyInit | null,
    headers: Record<string, string> = {},
): Response => {
    const ok = status >= 200 && status < 300;
    const response = {
        ok,
        status,
        headers: new Headers(headers),

        body: body instanceof ReadableStream ? body : null,

        json: async () => {
            throw new Error("Not JSON");
        },
        text: async () => (typeof body === "string" ? body : ""),

        blob: async () =>
            body instanceof Blob ? body : new Blob([typeof body === "string" ? body : ""]),
        arrayBuffer: async () => (body instanceof ArrayBuffer ? body : new ArrayBuffer(0)),
        formData: async () => new FormData(),

        statusText: `Status ${status}`,
        type: "basic",
        url: "",
        redirected: false,
        clone: () => createMockImageResponse(status, body, headers),
        bodyUsed: false,
    };

    return response as unknown as Response;
};

const createMockStream = (content: string = "mock image data"): ReadableStream<Uint8Array> => {
    const encoder = new TextEncoder();
    const uint8Array = encoder.encode(content);
    return new ReadableStream({
        start(controller) {
            controller.enqueue(uint8Array);
            controller.close();
        },
    });
};

describe("API Route: /api/image-proxy", () => {
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

    const createRequest = (searchParams: Record<string, string> = {}): NextRequest => {
        const url = new URL("http://localhost/api/image-proxy");
        Object.entries(searchParams).forEach(([key, value]) => url.searchParams.set(key, value));
        return new NextRequest(url);
    };

    it("should return 400 if url parameter is missing", async () => {
        const request = createRequest({});
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.message).toBe("Missing image URL parameter");
    });

    it("should return 400 if url parameter is invalid (not discogs or local)", async () => {
        const request = createRequest({ url: "http://example.com/image.jpg" });
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.message).toBe("Invalid image URL provided");
        expect(warnSpy).toHaveBeenCalledWith(
            "Invalid image URL requested: http://example.com/image.jpg",
        );
    });

    it("should return 400 if url parameter is local", async () => {
        const request = createRequest({ url: "/images/placeholder.png" });
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.message).toBe("Proxying local files is not supported");
        expect(warnSpy).toHaveBeenCalledWith(
            "Attempted to proxy local file, which is not supported by this proxy: /images/placeholder.png",
        );
    });

    it("should successfully proxy and stream a valid image URL", async () => {
        const imageUrl = "https://i.discogs.com/valid-image.jpg";
        const mockImageData = "mock-jpeg-data";
        const mockStream = createMockStream(mockImageData);
        const mockHeaders = {
            "content-type": "image/jpeg",
            "content-length": String(mockImageData.length),
        };
        mockFetch.mockResolvedValueOnce(createMockImageResponse(200, mockStream, mockHeaders));

        const request = createRequest({ url: imageUrl });
        const response = await GET(request);

        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toBe("image/jpeg");
        expect(response.headers.get("content-length")).toBe(String(mockImageData.length));
        expect(response.headers.get("cache-control")).toContain("public");
        expect(response.headers.get("cache-control")).toContain("max-age=604800");
        expect(response.headers.get("cache-control")).toContain("immutable");

        const responseText = await response.text();
        expect(responseText).toBe(mockImageData);

        expect(mockFetch).toHaveBeenCalledOnce();

        expect(mockFetch).toHaveBeenCalledWith(expect.objectContaining({ url: imageUrl }));

        const actualFetchRequest = mockFetch.mock.calls[0][0] as Request;
        expect(actualFetchRequest.headers.get("User-Agent")).toEqual(expect.any(String));

        expect(logSpy).toHaveBeenCalledWith(`Proxying image request for: ${imageUrl}`);
        expect(logSpy).toHaveBeenCalledWith(
            `Successfully fetched and streaming image from: ${imageUrl}`,
        );
    });

    it("should return proxied status code on fetch failure (e.g., 404)", async () => {
        const imageUrl = "https://i.discogs.com/not-found.jpg";

        mockFetch.mockResolvedValueOnce(
            createMockImageResponse(404, null, { "content-type": "application/json" }),
        );

        const request = createRequest({ url: imageUrl });
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(404);
        expect(data.message).toContain("Failed to fetch image");
        expect(errorSpy).toHaveBeenCalledWith(
            expect.stringContaining(`Failed to fetch image from ${imageUrl}. Status: 404`),
        );
    });

    it("should return 500 status code on fetch server error (e.g., 500)", async () => {
        const imageUrl = "https://i.discogs.com/server-error.jpg";
        mockFetch.mockResolvedValueOnce(
            createMockImageResponse(500, null, { "content-type": "text/plain" }),
        );

        const request = createRequest({ url: imageUrl });
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.message).toContain("Failed to fetch image");
        expect(errorSpy).toHaveBeenCalledWith(
            expect.stringContaining(`Failed to fetch image from ${imageUrl}. Status: 500`),
        );
    });

    it("should return 500 on fetch network error", async () => {
        const imageUrl = "https://i.discogs.com/network-error.jpg";
        const networkError = new Error("Fetch failed");
        mockFetch.mockRejectedValueOnce(networkError);

        const request = createRequest({ url: imageUrl });
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.message).toBe("Failed to proxy image");
        expect(data.error).toBe(networkError.message);
        expect(errorSpy).toHaveBeenCalledWith(`Error proxying image ${imageUrl}:`, networkError);
    });

    it("should return 500 if fetched image has empty body", async () => {
        const imageUrl = "https://i.discogs.com/empty-body.jpg";

        mockFetch.mockResolvedValueOnce(
            createMockImageResponse(200, null, { "content-type": "image/png" }),
        );

        const request = createRequest({ url: imageUrl });
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.message).toBe("Image fetch succeeded but response body was empty");
        expect(errorSpy).toHaveBeenCalledWith(
            `Fetched image from ${imageUrl} but response body was null.`,
        );
    });
});

