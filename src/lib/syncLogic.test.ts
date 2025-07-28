import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { getDb, setSetting } from "./db";
import { makeDiscogsRequest, fetchPriceSuggestions } from "./discogs/client";

vi.mock("./db", () => ({
    getDb: vi.fn(),
    setSetting: vi.fn(),
}));

vi.mock("./discogs/client", () => ({
    makeDiscogsRequest: vi.fn(),
    fetchPriceSuggestions: vi.fn(),
}));

import { runCollectionSync } from "./syncLogic";

describe("runCollectionSync (src/lib/syncLogic.ts)", () => {
    let logSpy: ReturnType<typeof vi.spyOn>;
    let errorSpy: ReturnType<typeof vi.spyOn>;
    let warnSpy: ReturnType<typeof vi.spyOn>;

    const mockedGetDb = vi.mocked(getDb);
    const mockedSetSetting = vi.mocked(setSetting);
    const mockedMakeDiscogsRequest = vi.mocked(makeDiscogsRequest);
    const mockedFetchPriceSuggestions = vi.mocked(fetchPriceSuggestions);

    const mockDeleteStmtRun = vi.fn();
    const mockInsertItemStmtRun = vi.fn();
    const mockInsertStatsStmtRun = vi.fn();
    const mockPrepare = vi.fn((sql: string) => {
        if (sql.includes("DELETE FROM collection_items")) return { run: mockDeleteStmtRun };
        if (sql.includes("INSERT OR REPLACE INTO collection_items"))
            return { run: mockInsertItemStmtRun };
        if (sql.includes("INSERT INTO collection_stats_history"))
            return { run: mockInsertStatsStmtRun };
        console.warn(`Unexpected DB prepare call in test: ${sql}`);
        return { run: vi.fn() };
    });
    const mockTransaction = vi.fn((callback) => {
        const executeTransaction = async (...args: any[]) => {
            await callback(...args);
        };
        return executeTransaction;
    });
    const mockDbObject = {
        prepare: mockPrepare,
        transaction: mockTransaction,
    };

    const MOCK_USERNAME = "testuser";
    const MOCK_TOKEN = "testtoken";
    const MOCK_RELEASE_1 = {
        id: 101,
        instance_id: 1,
        folder_id: 0,
        rating: 4,
        date_added: "2024-01-01T00:00:00Z",
        basic_information: {
            id: 101,
            title: "Test Album 1",
            year: 2000,
            artists: [{ name: "Artist A", id: 1 }],
            formats: [{ name: "Vinyl", qty: "1" }],
            cover_image: "img1.jpg",
        },
    };
    const MOCK_RELEASE_2 = {
        id: 102,
        instance_id: 2,
        folder_id: 0,
        rating: 5,
        date_added: "2024-01-02T00:00:00Z",
        basic_information: {
            id: 102,
            title: "Test Album 2",
            year: 2005,
            artists: [{ name: "Artist B", id: 2 }],
            formats: [{ name: "CD", qty: "1" }],
            cover_image: "img2.jpg",
        },
    };
    const MOCK_COLLECTION_PAGE_1 = {
        pagination: {
            page: 1,
            pages: 2,
            per_page: 1,
            items: 2,
            urls: {
                next: `https://api.discogs.com/users/${MOCK_USERNAME}/collection/folders/0/releases?page=2&per_page=1`,
            },
        },
        releases: [MOCK_RELEASE_1],
    };
    const MOCK_COLLECTION_PAGE_2 = {
        pagination: { page: 2, pages: 2, per_page: 1, items: 2, urls: {} },
        releases: [MOCK_RELEASE_2],
    };
    const MOCK_COLLECTION_VALUE = { minimum: "$10.00", median: "$15.50", maximum: "$25.00" };
    const MOCK_PRICE_SUGGESTIONS_1 = { "Near Mint (NM or M-)": { value: 12.34, currency: "USD" } };
    const MOCK_PRICE_SUGGESTIONS_2 = { "Very Good (VG)": { value: 5.67, currency: "USD" } };

    beforeEach(() => {
        vi.resetAllMocks();

        mockDeleteStmtRun.mockClear();
        mockInsertItemStmtRun.mockClear();
        mockInsertStatsStmtRun.mockClear();
        mockPrepare.mockClear();
        mockTransaction.mockClear();

        mockedGetDb.mockReturnValue(mockDbObject as any);

        vi.stubEnv("DISCOGS_USERNAME", MOCK_USERNAME);
        vi.stubEnv("DISCOGS_TOKEN", MOCK_TOKEN);

        logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

        mockedMakeDiscogsRequest
            .mockResolvedValueOnce(MOCK_COLLECTION_PAGE_1)
            .mockResolvedValueOnce(MOCK_COLLECTION_PAGE_2)
            .mockResolvedValueOnce(MOCK_COLLECTION_VALUE);
        mockedFetchPriceSuggestions
            .mockResolvedValueOnce(MOCK_PRICE_SUGGESTIONS_1)
            .mockResolvedValueOnce(MOCK_PRICE_SUGGESTIONS_2);
    });

    afterEach(() => {
        vi.unstubAllEnvs();

        logSpy?.mockRestore();
        errorSpy?.mockRestore();
        warnSpy?.mockRestore();
    });

    it("should fail if DISCOGS_USERNAME is not set", async () => {
        vi.stubEnv("DISCOGS_USERNAME", "");

        await expect(runCollectionSync()).rejects.toThrow(
            "DISCOGS_USERNAME or DISCOGS_TOKEN environment variables not set.",
        );

        expect(mockedSetSetting).toHaveBeenCalledWith("sync_status", "error");
        expect(mockedSetSetting).toHaveBeenCalledWith(
            "sync_last_error",
            expect.stringContaining("DISCOGS_USERNAME"),
        );
        expect(mockedMakeDiscogsRequest).not.toHaveBeenCalled();
        expect(mockedSetSetting).toHaveBeenCalled();
    });

    it("should fail if DISCOGS_TOKEN is not set", async () => {
        vi.stubEnv("DISCOGS_TOKEN", "");

        await expect(runCollectionSync()).rejects.toThrow(
            "DISCOGS_USERNAME or DISCOGS_TOKEN environment variables not set.",
        );

        expect(mockedSetSetting).toHaveBeenCalledWith("sync_status", "error");
        expect(mockedSetSetting).toHaveBeenCalledWith(
            "sync_last_error",
            expect.stringContaining("DISCOGS_TOKEN"),
        );
        expect(mockedMakeDiscogsRequest).not.toHaveBeenCalled();
        expect(mockedSetSetting).toHaveBeenCalled();
    });

    it("should successfully fetch collection, value, prices and update DB", async () => {
        const result = await runCollectionSync();

        expect(result.itemCount).toBe(2);
        expect(result.message).toMatch(/Sync complete. Processed 2 items in \d+(\.\d+)? seconds./);

        expect(mockedSetSetting).toHaveBeenCalledWith("sync_status", "running");
        expect(mockedSetSetting).toHaveBeenCalledWith("sync_total_items", "2");
        expect(mockedSetSetting).toHaveBeenCalledWith("sync_current_item", "1");
        expect(mockedSetSetting).toHaveBeenCalledWith("sync_current_item", "2");
        expect(mockedSetSetting).toHaveBeenCalledWith("sync_status", "idle");
        expect(mockedSetSetting).toHaveBeenCalledWith("sync_last_error", "");

        const collectionUrlPage1 = `/users/${MOCK_USERNAME}/collection/folders/0/releases?per_page=100`;
        const collectionUrlPage2 = `/users/${MOCK_USERNAME}/collection/folders/0/releases?page=2&per_page=1`;
        const valueUrl = `/users/${MOCK_USERNAME}/collection/value`;
        expect(mockedMakeDiscogsRequest).toHaveBeenCalledWith(collectionUrlPage1, MOCK_TOKEN);
        expect(mockedMakeDiscogsRequest).toHaveBeenCalledWith(collectionUrlPage2, MOCK_TOKEN);
        expect(mockedMakeDiscogsRequest).toHaveBeenCalledWith(valueUrl, MOCK_TOKEN);
        expect(mockedFetchPriceSuggestions).toHaveBeenCalledWith(MOCK_RELEASE_1.id, MOCK_TOKEN);
        expect(mockedFetchPriceSuggestions).toHaveBeenCalledWith(MOCK_RELEASE_2.id, MOCK_TOKEN);

        expect(mockTransaction).toHaveBeenCalledOnce();
        expect(mockPrepare).toHaveBeenCalledWith(
            expect.stringContaining("DELETE FROM collection_items"),
        );
        expect(mockPrepare).toHaveBeenCalledWith(
            expect.stringContaining("INSERT OR REPLACE INTO collection_items"),
        );
        expect(mockPrepare).toHaveBeenCalledWith(
            expect.stringContaining("INSERT INTO collection_stats_history"),
        );

        expect(mockDeleteStmtRun).toHaveBeenCalledOnce();
        expect(mockInsertItemStmtRun).toHaveBeenCalledTimes(2);
        expect(mockInsertStatsStmtRun).toHaveBeenCalledOnce();

        expect(mockInsertItemStmtRun).toHaveBeenCalledWith(
            MOCK_RELEASE_1.instance_id,
            MOCK_RELEASE_1.id,
            "Artist A",
            "Test Album 1",
            2000,
            "1 x Vinyl",
            expect.any(String),
            expect.any(String),
            "img1.jpg",
            MOCK_RELEASE_1.date_added,
            MOCK_RELEASE_1.folder_id,
            MOCK_RELEASE_1.rating,
            null,
            null,
            12.34,
            expect.any(String),
        );

        expect(mockInsertItemStmtRun).toHaveBeenCalledWith(
            MOCK_RELEASE_2.instance_id,
            MOCK_RELEASE_2.id,
            "Artist B",
            "Test Album 2",
            2005,
            "1 x CD",
            expect.any(String),
            expect.any(String),
            "img2.jpg",
            MOCK_RELEASE_2.date_added,
            MOCK_RELEASE_2.folder_id,
            MOCK_RELEASE_2.rating,
            null,
            null,
            5.67,
            expect.any(String),
        );

        expect(mockInsertStatsStmtRun).toHaveBeenCalledWith(
            expect.any(String),
            2,
            10.0,
            15.5,
            25.0,
        );

        expect(errorSpy).not.toHaveBeenCalled();
    });

    it("should handle errors during price suggestion fetching gracefully", async () => {
        mockedFetchPriceSuggestions
            .mockReset()
            .mockResolvedValueOnce(MOCK_PRICE_SUGGESTIONS_1)
            .mockRejectedValueOnce(new Error("Price fetch failed"));

        await runCollectionSync();

        expect(mockedSetSetting).toHaveBeenCalledWith("sync_status", "idle");
        expect(errorSpy).toHaveBeenCalledWith(
            expect.stringContaining(
                `Failed to fetch price suggestions for release ID ${MOCK_RELEASE_2.id}`,
            ),
            expect.any(Error),
        );

        expect(mockInsertItemStmtRun).toHaveBeenCalledWith(
            MOCK_RELEASE_2.instance_id,
            MOCK_RELEASE_2.id,
            expect.any(String),
            expect.any(String),
            expect.any(Number),
            expect.any(String),
            expect.any(String),
            expect.any(String),
            expect.any(String),
            expect.any(String),
            expect.any(Number),
            expect.any(Number),
            null,
            null,
            null,
            null,
        );
    });

    it("should handle errors during overall value fetching gracefully", async () => {
        mockedMakeDiscogsRequest
            .mockReset()
            .mockResolvedValueOnce(MOCK_COLLECTION_PAGE_1)
            .mockResolvedValueOnce(MOCK_COLLECTION_PAGE_2)
            .mockRejectedValueOnce(new Error("Value fetch failed"));
        mockedFetchPriceSuggestions.mockReset().mockResolvedValue(MOCK_PRICE_SUGGESTIONS_1);

        await runCollectionSync();

        expect(mockedSetSetting).toHaveBeenCalledWith("sync_status", "idle");
        expect(errorSpy).toHaveBeenCalledWith(
            "Could not fetch overall collection value:",
            expect.any(Error),
        );

        expect(mockInsertStatsStmtRun).toHaveBeenCalledWith(
            expect.any(String),
            2,
            null,
            null,
            null,
        );
    });

    it("should handle errors during collection fetching and set error status", async () => {
        mockedMakeDiscogsRequest
            .mockReset()
            .mockResolvedValueOnce(MOCK_COLLECTION_PAGE_1)
            .mockRejectedValueOnce(new Error("Collection fetch failed"));

        await expect(runCollectionSync()).rejects.toThrow("Collection fetch failed");

        expect(mockedSetSetting).toHaveBeenCalledWith("sync_status", "error");
        expect(mockedSetSetting).toHaveBeenCalledWith("sync_last_error", "Collection fetch failed");

        expect(mockTransaction).not.toHaveBeenCalled();
    });
});

