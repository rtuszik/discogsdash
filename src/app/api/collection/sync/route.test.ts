import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/syncLogic", () => ({
    runCollectionSync: vi.fn(),
}));

import { runCollectionSync } from "@/lib/syncLogic";
const mockedRunCollectionSync = vi.mocked(runCollectionSync);

describe("API Route: /api/collection/sync", () => {
    let logSpy: ReturnType<typeof vi.spyOn>;
    let errorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.resetAllMocks();

        logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        logSpy.mockRestore();
        errorSpy.mockRestore();
        vi.restoreAllMocks();
    });

    it("should return 200 and success message on successful sync", async () => {
        const successMessage = "Sync completed successfully!";
        const syncResult = { itemCount: 10, message: successMessage };
        mockedRunCollectionSync.mockResolvedValueOnce(syncResult);

        const request = new Request("http://localhost/api/collection/sync");

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.message).toBe(successMessage);
        expect(mockedRunCollectionSync).toHaveBeenCalledOnce();
        expect(logSpy).toHaveBeenCalledWith("Received API request to sync collection...");
        expect(errorSpy).not.toHaveBeenCalled();
    });

    it("should return 500 and error message on sync failure", async () => {
        const errorMessage = "Failed due to missing credentials";
        const syncError = new Error(errorMessage);
        mockedRunCollectionSync.mockRejectedValueOnce(syncError);

        const request = new Request("http://localhost/api/collection/sync");

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.message).toBe("Failed to sync collection");
        expect(data.error).toBe(errorMessage);
        expect(mockedRunCollectionSync).toHaveBeenCalledOnce();
        expect(logSpy).toHaveBeenCalledWith("Received API request to sync collection...");
        expect(errorSpy).toHaveBeenCalledWith("API Collection Sync Error:", syncError);
    });

    it("should handle non-Error rejections from syncLogic", async () => {
        const nonErrorRejection = { reason: "Something weird happened" };
        mockedRunCollectionSync.mockRejectedValueOnce(nonErrorRejection);

        const request = new Request("http://localhost/api/collection/sync");
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.message).toBe("Failed to sync collection");

        expect(data.error).toBe("Internal Server Error during sync");
        expect(errorSpy).toHaveBeenCalledWith("API Collection Sync Error:", nonErrorRejection);
    });
});

