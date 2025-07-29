import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { NextRequest } from "next/server";

interface ValuableItem {
    id: number;
    release_id: number;
    artist: string | null;
    title: string | null;
    cover_image_url: string | null;
    condition: string | null;
    suggested_value: number | null;
}

interface LatestAddition {
    id: number;
    release_id: number;
    artist: string | null;
    title: string | null;
    cover_image_url: string | null;
    condition: string | null;
    suggested_value: number | null;
    added_date: string;
    format: string | null;
    year: number | null;
}

interface DashboardStats {
    totalItems: number;
    latestValueMin: number | null;
    latestValueMean: number | null;
    latestValueMax: number | null;
    averageValuePerItem: number | null;

    itemCountHistory: { timestamp: string; count: number }[];
    valueHistory: {
        timestamp: string;
        min: number | null;
        mean: number | null;
        max: number | null;
    }[];

    genreDistribution: Record<string, number>;
    yearDistribution: Record<string, number>;
    formatDistribution: Record<string, number>;

    topValuableItems: ValuableItem[];
    leastValuableItems: ValuableItem[];
    latestAdditions: LatestAddition[];
}

function getTimeRangeFilter(timeRange: string): string | null {
    const now = new Date();
    let startDate: Date;

    switch (timeRange) {
        case '7d':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
        case '1m':
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
        case '3m':
            startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            break;
        case '6m':
            startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
            break;
        case '1y':
            startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
            break;
        case 'all':
        default:
            return null; // No filter for 'all'
    }

    return startDate.toISOString();
}

export async function GET(request: NextRequest) {
    console.log("Received request for dashboard stats...");

    try {
        const db = await getDb();
        
        // Get time range from query parameters
        const { searchParams } = new URL(request.url);
        const timeRange = searchParams.get('timeRange') || '3m';
        const startDateFilter = getTimeRangeFilter(timeRange);

        const allItemsResult = await db.query(`
      SELECT id, release_id, artist, title, year, format, genres, cover_image_url, condition, suggested_value, added_date
      FROM collection_items
    `);

        type DbItem = {
            id: number;
            release_id: number;
            artist: string | null;
            title: string | null;
            year: number | null;
            format: string | null;
            genres: string | null;
            cover_image_url: string | null;
            condition: string | null;
            suggested_value: number | null;
            added_date: string;
        };
        const allItems: DbItem[] = allItemsResult.rows as DbItem[];

        const latestStatsResult = await db.query(`
      SELECT total_items, value_min, value_mean, value_max
      FROM collection_stats_history
      ORDER BY timestamp DESC
      LIMIT 1
    `);
        const latestStats = latestStatsResult.rows[0] as
            | {
                  total_items: number;
                  value_min: number | null;
                  value_mean: number | null;
                  value_max: number | null;
              }
            | undefined;

        const totalItems = latestStats?.total_items ?? allItems.length;
        const latestValueMin = latestStats?.value_min ?? null;
        const latestValueMean = latestStats?.value_mean ?? null;
        const latestValueMax = latestStats?.value_max ?? null;

        const averageValuePerItem =
            totalItems > 0 && latestValueMean !== null ? latestValueMean / totalItems : null;

        // Build history query with optional time filter
        let historyQuery = `
      SELECT timestamp, total_items, value_min, value_mean, value_max
      FROM collection_stats_history`;
        
        const queryParams: string[] = [];
        if (startDateFilter) {
            historyQuery += ` WHERE timestamp >= $1`;
            queryParams.push(startDateFilter);
        }
        
        historyQuery += ` ORDER BY timestamp ASC`;
        
        const historyResult = await db.query(historyQuery, queryParams.length > 0 ? queryParams : undefined);
        const historyData = historyResult.rows as {
            timestamp: string;
            total_items: number;
            value_min: number | null;
            value_mean: number | null;
            value_max: number | null;
        }[];

        const itemCountHistory = historyData.map((row) => ({
            timestamp: row.timestamp,
            count: row.total_items,
        }));

        const valueHistory = historyData.map((row) => ({
            timestamp: row.timestamp,
            min: row.value_min,
            mean: row.value_mean,
            max: row.value_max,
        }));

        const itemsWithValue = allItems.filter(
            (item) => item.suggested_value !== null && item.suggested_value > 0,
        );
        const sortedByValueDesc = [...itemsWithValue].sort(
            (a, b) => b.suggested_value! - a.suggested_value!,
        );
        const sortedByValueAsc = [...itemsWithValue].sort(
            (a, b) => a.suggested_value! - b.suggested_value!,
        );

        const topValuableItems: ValuableItem[] = sortedByValueDesc.slice(0, 10).map((item) => ({
            id: item.id,
            release_id: item.release_id,
            artist: item.artist,
            title: item.title,
            cover_image_url: item.cover_image_url,
            condition: item.condition,
            suggested_value: item.suggested_value,
        }));

        const leastValuableItems: ValuableItem[] = sortedByValueAsc.slice(0, 10).map((item) => ({
            id: item.id,
            release_id: item.release_id,
            artist: item.artist,
            title: item.title,
            cover_image_url: item.cover_image_url,
            condition: item.condition,
            suggested_value: item.suggested_value,
        }));

        // Get latest additions (most recently added items)
        const sortedByAddedDate = [...allItems].sort((a, b) => 
            new Date(b.added_date).getTime() - new Date(a.added_date).getTime()
        );
        const latestAdditions: LatestAddition[] = sortedByAddedDate.slice(0, 10).map((item) => ({
            id: item.id,
            release_id: item.release_id,
            artist: item.artist,
            title: item.title,
            cover_image_url: item.cover_image_url,
            condition: item.condition,
            suggested_value: item.suggested_value,
            added_date: item.added_date,
            format: item.format,
            year: item.year,
        }));

        const itemsForDistribution = allItems;

        const genreDistribution: Record<string, number> = {};
        const yearDistribution: Record<string, number> = {};
        const formatDistribution: Record<string, number> = {};

        for (const item of itemsForDistribution) {
            if (item.genres) {
                try {
                    const genres: string[] = JSON.parse(item.genres);
                    genres.forEach((genre) => {
                        const g = genre.trim();
                        if (g) {
                            genreDistribution[g] = (genreDistribution[g] || 0) + 1;
                        }
                    });
                } catch (e) {
                    console.warn(`Failed to parse genres JSON: ${item.genres}`, e);
                }
            }

            const year = item.year;
            if (year && year > 0) {
                const yearStr = year.toString();
                yearDistribution[yearStr] = (yearDistribution[yearStr] || 0) + 1;
            } else {
                yearDistribution["Unknown"] = (yearDistribution["Unknown"] || 0) + 1;
            }

            if (item.format) {
                const formatLower = item.format.toLowerCase();
                let primaryFormat = "Other";

                if (
                    formatLower.includes("vinyl") ||
                    formatLower.includes(" lp") ||
                    formatLower.includes(" ep") ||
                    formatLower.includes(' 7"') ||
                    formatLower.includes(' 10"') ||
                    formatLower.includes(' 12"')
                ) {
                    primaryFormat = "Vinyl";
                } else if (formatLower.includes("cd") || formatLower.includes("compact disc")) {
                    primaryFormat = "CD";
                } else if (formatLower.includes("cass") || formatLower.includes("cassette")) {
                    primaryFormat = "Cassette";
                } else if (formatLower.includes("file") || formatLower.includes("digital")) {
                    primaryFormat = "File";
                }

                formatDistribution[primaryFormat] = (formatDistribution[primaryFormat] || 0) + 1;
            } else {
                formatDistribution["Unknown"] = (formatDistribution["Unknown"] || 0) + 1;
            }
        }

        const sortDistribution = (dist: Record<string, number>): Record<string, number> => {
            return Object.entries(dist)
                .sort(([, countA], [, countB]) => countB - countA)
                .reduce(
                    (acc, [key, value]) => {
                        acc[key] = value;
                        return acc;
                    },
                    {} as Record<string, number>,
                );
        };

        const sortedGenreDistribution = sortDistribution(genreDistribution);
        const sortedYearDistribution = sortDistribution(yearDistribution);
        const sortedFormatDistribution = sortDistribution(formatDistribution);

        const stats: DashboardStats = {
            totalItems,
            latestValueMin,
            latestValueMean,
            latestValueMax,
            averageValuePerItem,
            itemCountHistory,
            valueHistory,
            genreDistribution: sortedGenreDistribution,
            yearDistribution: sortedYearDistribution,
            formatDistribution: sortedFormatDistribution,
            topValuableItems,
            leastValuableItems,
            latestAdditions,
        };

        console.log(`Successfully calculated dashboard stats.`);
        return NextResponse.json(stats, { status: 200 });
    } catch (error) {
        console.error("Dashboard Stats Error:", error);
        let errorMessage = "Internal Server Error fetching stats";
        if (error instanceof Error) {
            errorMessage = error.message;
        }
        return NextResponse.json(
            { message: "Failed to fetch dashboard statistics", error: errorMessage },
            { status: 500 },
        );
    }
}

