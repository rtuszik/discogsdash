import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
// No longer need direct import: import Database from 'better-sqlite3';

// Define the structure of the statistics response
interface DashboardStats {
  // Basic KPIs
  totalItems: number | null;
  latestValueMin: number | null;
  latestValueMean: number | null;
  latestValueMax: number | null;
  averageValuePerItem: number | null;

  // Data for Charts
  itemCountHistory: { timestamp: string; count: number }[];
  valueHistory: { timestamp: string; min: number | null; mean: number | null; max: number | null }[];

  // Distribution Stats
  genreDistribution: Record<string, number>;
  yearDistribution: Record<string, number>;
  formatDistribution: Record<string, number>;

  // TODO: Add Top/Least Valuable Items later
  // topValuableItems: any[];
  // leastValuableItems: any[];
}

export async function GET(request: Request) {
  console.log('Received request for dashboard stats...');

  try {
    const db = getDb();

    // --- Calculate Basic Stats & History ---

    // Get latest stats snapshot
    const latestStatsStmt = db.prepare(`
      SELECT total_items, value_min, value_mean, value_max
      FROM collection_stats_history
      ORDER BY timestamp DESC
      LIMIT 1
    `);
    const latestStats = latestStatsStmt.get() as { total_items: number; value_min: number | null; value_mean: number | null; value_max: number | null } | undefined;

    const totalItems = latestStats?.total_items ?? 0; // Default to 0 if no history
    const latestValueMin = latestStats?.value_min ?? null;
    const latestValueMean = latestStats?.value_mean ?? null;
    const latestValueMax = latestStats?.value_max ?? null;

    // Calculate average value (use mean as the representative value)
    const averageValuePerItem = (totalItems > 0 && latestValueMean !== null)
      ? latestValueMean / totalItems
      : null;

    // Get historical data for charts (limit for performance if needed)
    const historyStmt = db.prepare(`
      SELECT timestamp, total_items, value_min, value_mean, value_max
      FROM collection_stats_history
      ORDER BY timestamp ASC
      -- LIMIT 100 -- Optional: Limit history points
    `);
    const historyData = historyStmt.all() as { timestamp: string; total_items: number; value_min: number | null; value_mean: number | null; value_max: number | null }[];

    const itemCountHistory = historyData.map(row => ({
      timestamp: row.timestamp,
      count: row.total_items,
    }));

    const valueHistory = historyData.map(row => ({
      timestamp: row.timestamp,
      min: row.value_min,
      mean: row.value_mean,
      max: row.value_max,
    }));

    // --- Calculate Distribution Stats ---
    const distributionDataStmt = db.prepare(`
      SELECT genres, year, format FROM collection_items
    `);
    const items = distributionDataStmt.all() as { genres: string | null; year: number | null; format: string | null }[];

    const genreDistribution: Record<string, number> = {};
    const yearDistribution: Record<string, number> = {};
    const formatDistribution: Record<string, number> = {};

    for (const item of items) {
      // Genre Distribution (parses JSON string)
      if (item.genres) {
        try {
          const genres: string[] = JSON.parse(item.genres);
          genres.forEach(genre => {
            const g = genre.trim();
            if (g) {
              genreDistribution[g] = (genreDistribution[g] || 0) + 1;
            }
          });
        } catch (e) {
          console.warn(`Failed to parse genres JSON: ${item.genres}`, e);
        }
      }

      // Year Distribution
      const year = item.year;
      if (year && year > 0) { // Basic validation for year
        const yearStr = year.toString();
        yearDistribution[yearStr] = (yearDistribution[yearStr] || 0) + 1;
      } else {
         yearDistribution['Unknown'] = (yearDistribution['Unknown'] || 0) + 1;
      }

      // Format Distribution (simple aggregation, might need cleaning)
      // Example format string: "1 x Vinyl, LP, Album, Reissue, 180g"
      // We'll extract the primary format type (e.g., Vinyl, CD, Cassette)
      if (item.format) {
          const primaryFormatMatch = item.format.match(/Vinyl|CD|Cassette|File|LP|EP|Single/i);
          let primaryFormat = primaryFormatMatch ? primaryFormatMatch[0].toLowerCase().replace(/\b\w/g, l => l.toUpperCase()) : 'Other'; // Capitalize
          // Consolidate LP/EP/Single under Vinyl if Vinyl isn't already present
          if (['Lp', 'Ep', 'Single'].includes(primaryFormat) && !item.format.match(/Vinyl/i)) {
              primaryFormat = 'Vinyl';
          } else if (primaryFormat === 'Lp') { // If Vinyl is also present, just use Vinyl
              primaryFormat = 'Vinyl';
          }

          formatDistribution[primaryFormat] = (formatDistribution[primaryFormat] || 0) + 1;
      } else {
          formatDistribution['Unknown'] = (formatDistribution['Unknown'] || 0) + 1;
      }
    }

    // Sort distributions for better display (optional)
    const sortDistribution = (dist: Record<string, number>): Record<string, number> => {
        return Object.entries(dist)
            .sort(([, countA], [, countB]) => countB - countA) // Sort by count descending
            .reduce((acc, [key, value]) => { acc[key] = value; return acc; }, {} as Record<string, number>);
    };

    const sortedGenreDistribution = sortDistribution(genreDistribution);
    const sortedYearDistribution = sortDistribution(yearDistribution);
    const sortedFormatDistribution = sortDistribution(formatDistribution);


    // --- TODO: Calculate Top/Least Valuable Items ---
    // Requires 'estimated_value' to be populated in collection_items table.
    // This might need adjustments to the sync process (e.g., fetching individual release market stats)
    // or using the overall min/max values as a proxy which isn't ideal.
    // For now, we'll omit these.


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
      // Initialize others later
      // topValuableItems: [],
      // leastValuableItems: [],
    };

    console.log('Successfully calculated dashboard stats.');
    return NextResponse.json(stats, { status: 200 });

  } catch (error) {
    console.error('Dashboard Stats Error:', error);
    let errorMessage = 'Internal Server Error fetching stats';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json(
      { message: 'Failed to fetch dashboard statistics', error: errorMessage },
      { status: 500 }
    );
  }
}