import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/db", () => ({
    getDb: vi.fn(),
}));

describe("API Route: /api/dashboard-stats", () => {
    let logSpy: ReturnType<typeof vi.spyOn>;
    let errorSpy: ReturnType<typeof vi.spyOn>;

    let mockedGetDb: ReturnType<typeof vi.mocked<typeof import("@/lib/db").getDb>>;

    const mockDbGetAll = vi.fn();
    const mockDbGetOne = vi.fn();
    const mockDbPrepare = vi.fn();
    const mockDbObject = { prepare: mockDbPrepare };

    const mockItemsData = [
        {
            id: 1,
            release_id: 101,
            artist: "Artist A",
            title: "Album 1",
            year: 2000,
            format: "1 x Vinyl, LP",
            genres: '["Rock"]',
            styles: '["Prog Rock"]',
            cover_image_url: "img1.jpg",
            condition: "Near Mint (NM or M-)",
            suggested_value: 25.5,
        },
        {
            id: 2,
            release_id: 102,
            artist: "Artist B",
            title: "Album 2",
            year: 2010,
            format: "CD, Album",
            genres: '["Pop", "Electronic"]',
            styles: '["Synth-pop"]',
            cover_image_url: "img2.jpg",
            condition: "Very Good Plus (VG+)",
            suggested_value: 10.0,
        },
        {
            id: 3,
            release_id: 103,
            artist: "Artist A",
            title: "Album 3",
            year: 2005,
            format: "Cassette",
            genres: '["Rock"]',
            styles: '["Alternative Rock"]',
            cover_image_url: "img3.jpg",
            condition: "Good (G)",
            suggested_value: 5.0,
        },
        {
            id: 4,
            release_id: 104,
            artist: "Artist C",
            title: "Album 4",
            year: null,
            format: "File, MP3",
            genres: "[]",
            styles: "[]",
            cover_image_url: null,
            condition: null,
            suggested_value: null,
        },
    ];
    const mockLatestHistory = {
        timestamp: "2024-01-10T10:00:00Z",
        total_items: 4,
        value_min: 5.0,
        value_mean: 15.0,
        value_max: 25.5,
    };
    const mockHistoryData = [
        {
            timestamp: "2024-01-01T10:00:00Z",
            total_items: 3,
            value_min: 6.0,
            value_mean: 14.0,
            value_max: 20.0,
        },
        mockLatestHistory,
    ];

    beforeEach(async () => {
        const dbModule = await import("@/lib/db");
        mockedGetDb = vi.mocked(dbModule.getDb);

        vi.resetAllMocks();

        mockedGetDb.mockReturnValue(mockDbObject as any);

        mockDbGetAll.mockReset();
        mockDbGetOne.mockReset();

        mockDbPrepare.mockImplementation((sql: string) => {
            const statement = {
                all: vi.fn((..._args: any[]) => {
                    if (sql.includes("FROM collection_items")) return mockItemsData;
                    if (sql.includes("ORDER BY timestamp ASC")) return mockHistoryData;
                    return [];
                }),
                get: vi.fn((..._args: any[]) => {
                    if (sql.includes("ORDER BY timestamp DESC")) return mockLatestHistory;
                    return undefined;
                }),
            };
            return statement as any;
        });

        logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        logSpy.mockRestore();
        errorSpy.mockRestore();
        vi.restoreAllMocks();
    });

    it("should return dashboard stats successfully with valid data", async () => {
        const request = new Request("http://localhost/api/dashboard-stats");

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toBeDefined();

        expect(data.totalItems).toBe(4);
        expect(data.latestValueMin).toBe(5.0);
        expect(data.latestValueMean).toBe(15.0);
        expect(data.latestValueMax).toBe(25.5);
        expect(data.averageValuePerItem).toBeCloseTo(15.0 / 4);

        expect(data.itemCountHistory).toHaveLength(2);
        expect(data.itemCountHistory[0]).toEqual({ timestamp: "2024-01-01T10:00:00Z", count: 3 });
        expect(data.itemCountHistory[1]).toEqual({ timestamp: "2024-01-10T10:00:00Z", count: 4 });
        expect(data.valueHistory).toHaveLength(2);
        expect(data.valueHistory[1]).toEqual({
            timestamp: "2024-01-10T10:00:00Z",
            min: 5.0,
            mean: 15.0,
            max: 25.5,
        });

        expect(data.genreDistribution).toEqual({ Rock: 2, Pop: 1, Electronic: 1 });
        expect(data.yearDistribution).toEqual({ "2000": 1, "2005": 1, "2010": 1, Unknown: 1 });
        expect(data.formatDistribution).toEqual({ Vinyl: 1, CD: 1, Cassette: 1, File: 1 });

        expect(data.topValuableItems).toHaveLength(3);
        expect(data.topValuableItems[0].release_id).toBe(101);
        expect(data.topValuableItems[0].suggested_value).toBe(25.5);
        expect(data.leastValuableItems).toHaveLength(3);
        expect(data.leastValuableItems[0].release_id).toBe(103);
        expect(data.leastValuableItems[0].suggested_value).toBe(5.0);

        expect(mockedGetDb).toHaveBeenCalledOnce();
        expect(mockDbPrepare).toHaveBeenCalledTimes(3);
    });

    it("should return default stats when database is empty", async () => {
        mockDbPrepare.mockImplementation((sql: string) => {
            const statement = {
                all: vi.fn((..._args: any[]) => {
                    return [];
                }),
                get: vi.fn((..._args: any[]) => {
                    return undefined;
                }),
            };
            return statement as any;
        });

        const request = new Request("http://localhost/api/dashboard-stats");
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.totalItems).toBe(0);
        expect(data.latestValueMin).toBeNull();
        expect(data.latestValueMean).toBeNull();
        expect(data.latestValueMax).toBeNull();
        expect(data.averageValuePerItem).toBeNull();
        expect(data.itemCountHistory).toEqual([]);
        expect(data.valueHistory).toEqual([]);
        expect(data.genreDistribution).toEqual({});
        expect(data.yearDistribution).toEqual({});
        expect(data.formatDistribution).toEqual({});
        expect(data.topValuableItems).toEqual([]);
        expect(data.leastValuableItems).toEqual([]);
    });

    it("should return 500 error if database query fails", async () => {
        const dbError = new Error("Database connection failed");

        mockedGetDb.mockImplementationOnce(() => {
            throw dbError;
        });

        const request = new Request("http://localhost/api/dashboard-stats");
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.message).toBe("Failed to fetch dashboard statistics");
        expect(data.error).toBe(dbError.message);
        expect(errorSpy).toHaveBeenCalledWith("Dashboard Stats Error:", dbError);
    });
});
