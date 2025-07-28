import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

interface ValuableItem {
    id: number;
    release_id: number;
    artist: string | null;
    title: string | null;
    cover_image_url: string | null;
    condition: string | null;
    suggested_value: number | null;
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
}

export async function GET(_request: Request) {
    console.log("Received request for dashboard stats...");

    try {
        const db = await getDb();

        const allItemsResult = await db.query(`
      SELECT id, release_id, artist, title, year, format, genres, cover_image_url, condition, suggested_value
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

        const historyResult = await db.query(`
      SELECT timestamp, total_items, value_min, value_mean, value_max
      FROM collection_stats_history
      ORDER BY timestamp ASC
    `);
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

