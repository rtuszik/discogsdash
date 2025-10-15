import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, type SyncStatusResponse } from "./route";

vi.mock("@/lib/db", () => ({
    getSetting: vi.fn(),
}));

import { getSetting } from "@/lib/db";

const mockedGetSetting = vi.mocked(getSetting);

describe("API Route: /api/collection/sync/status", () => {
    let errorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.resetAllMocks();

        mockedGetSetting.mockImplementation((key: string) => {
            switch (key) {
                case "sync_status":
                    return "idle";
                case "sync_current_item":
                    return "0";
                case "sync_total_items":
                    return "0";
                case "sync_last_error":
                    return null;
                default:
                    return null;
            }
        });

        errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        errorSpy.mockRestore();
        vi.restoreAllMocks();
    });

    const makeRequest = async (): Promise<{
        status: number;
        data: SyncStatusResponse | { message: string; error: string };
    }> => {
        const request = new Request("http://localhost/api/collection/sync/status");
        const response = await GET(request);
        const data = await response.json();
        return { status: response.status, data };
    };

    it("should return idle status correctly", async () => {
        const { status, data } = await makeRequest();

        expect(status).toBe(200);
        expect(data).toEqual({
            status: "idle",
            currentItem: 0,
            totalItems: 0,
            lastError: null,
        });
        expect(mockedGetSetting).toHaveBeenCalledWith("sync_status");
        expect(mockedGetSetting).toHaveBeenCalledWith("sync_current_item");
        expect(mockedGetSetting).toHaveBeenCalledWith("sync_total_items");
        expect(mockedGetSetting).toHaveBeenCalledWith("sync_last_error");
    });

    it("should return running status with progress correctly", async () => {
        mockedGetSetting.mockImplementation((key: string) => {
            switch (key) {
                case "sync_status":
                    return "running";
                case "sync_current_item":
                    return "55";
                case "sync_total_items":
                    return "123";
                case "sync_last_error":
                    return null;
                default:
                    return null;
            }
        });

        const { status, data } = await makeRequest();

        expect(status).toBe(200);
        expect(data).toEqual({
            status: "running",
            currentItem: 55,
            totalItems: 123,
            lastError: null,
        });
    });

    it("should return error status with last error message correctly", async () => {
        const errorMessage = "Failed to fetch page 3";
        mockedGetSetting.mockImplementation((key: string) => {
            switch (key) {
                case "sync_status":
                    return "error";
                case "sync_current_item":
                    return "75";
                case "sync_total_items":
                    return "150";
                case "sync_last_error":
                    return errorMessage;
                default:
                    return null;
            }
        });

        const { status, data } = await makeRequest();

        expect(status).toBe(200);
        expect(data).toEqual({
            status: "error",
            currentItem: 75,
            totalItems: 150,
            lastError: errorMessage,
        });
    });

    it("should return unknown status if stored status is invalid", async () => {
        mockedGetSetting.mockImplementation((key: string) => {
            if (key === "sync_status") return "pending";

            if (key === "sync_current_item") return "0";
            if (key === "sync_total_items") return "0";
            if (key === "sync_last_error") return null;
            return null;
        });

        const { status, data } = await makeRequest();

        expect(status).toBe(200);
        expect((data as SyncStatusResponse).status).toBe("unknown");
        expect((data as SyncStatusResponse).currentItem).toBe(0);
        expect((data as SyncStatusResponse).totalItems).toBe(0);
    });

    it("should return 0 for counts if stored values are null or invalid", async () => {
        mockedGetSetting.mockImplementation((key: string) => {
            switch (key) {
                case "sync_status":
                    return "running";
                case "sync_current_item":
                    return null;
                case "sync_total_items":
                    return "abc";
                case "sync_last_error":
                    return null;
                default:
                    return null;
            }
        });

        const { status, data } = await makeRequest();

        expect(status).toBe(200);
        expect(data).toEqual({
            status: "running",
            currentItem: 0,
            totalItems: 0,
            lastError: null,
        });
    });

    it("should return 500 error if getSetting throws an error", async () => {
        const dbError = new Error("DB read error");
        mockedGetSetting.mockImplementation(() => {
            throw dbError;
        });

        const { status, data } = await makeRequest();

        expect(status).toBe(500);
        expect((data as { message: string }).message).toBe("Failed to fetch sync status");
        expect((data as { error: string }).error).toBe(dbError.message);
        expect(errorSpy).toHaveBeenCalledWith("Error fetching sync status:", dbError);
    });
});
