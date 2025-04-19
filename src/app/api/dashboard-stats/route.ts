import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
// No longer need direct import: import Database from 'better-sqlite3';

// Define the structure for valuable items
interface ValuableItem {
  id: number; // instance_id
  release_id: number;
  artist: string | null;
  title: string | null;
  cover_image_url: string | null;
  condition: string | null; // Added
  suggested_value: number | null; // Added
}

// Define the structure of the statistics response
interface DashboardStats {
  // Basic KPIs (Now from history table again)
  totalItems: number;
  latestValueMin: number | null;
  latestValueMean: number | null; // Using 'mean' from history (Discogs calls it median)
  latestValueMax: number | null;
  averageValuePerItem: number | null; // Calculated from history mean

  // Data for Charts
  itemCountHistory: { timestamp: string; count: number }[];
  valueHistory: { timestamp: string; min: number | null; mean: number | null; max: number | null }[]; // Add back value history

  // Distribution Stats
  genreDistribution: Record<string, number>;
  yearDistribution: Record<string, number>;
  formatDistribution: Record<string, number>;

  // Top/Least Valuable Items
  topValuableItems: ValuableItem[];
  leastValuableItems: ValuableItem[];
}

export async function GET(_request: Request) { // Prefix unused 'request' with underscore
  console.log('Received request for dashboard stats...');

  try {
    const db = getDb();

    // --- Fetch All Relevant Item Data (for Top/Least lists and distributions) ---
    const allItemsStmt = db.prepare(`
      SELECT id, release_id, artist, title, year, format, genres, cover_image_url, condition, suggested_value
      FROM collection_items
    `);
    // Define a more specific type for the raw DB result
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
    const allItems: DbItem[] = allItemsStmt.all() as DbItem[];

    // --- Calculate Basic Stats & History (from history table) ---

    // Get latest stats snapshot from history
    const latestStatsStmt = db.prepare(`
      SELECT total_items, value_min, value_mean, value_max
      FROM collection_stats_history
      ORDER BY timestamp DESC
      LIMIT 1
    `);
    const latestStats = latestStatsStmt.get() as { total_items: number; value_min: number | null; value_mean: number | null; value_max: number | null } | undefined;

    const totalItems = latestStats?.total_items ?? allItems.length; // Use history count, fallback to actual count
    const latestValueMin = latestStats?.value_min ?? null;
    const latestValueMean = latestStats?.value_mean ?? null; // Discogs median stored as mean
    const latestValueMax = latestStats?.value_max ?? null;

    // Calculate average value based on history mean
    const averageValuePerItem = (totalItems > 0 && latestValueMean !== null)
      ? latestValueMean / totalItems
      : null;

    // Get historical data for charts (including value history)
    const historyStmt = db.prepare(`
      SELECT timestamp, total_items, value_min, value_mean, value_max
      FROM collection_stats_history
      ORDER BY timestamp ASC
    `);
    const historyData = historyStmt.all() as { timestamp: string; total_items: number; value_min: number | null; value_mean: number | null; value_max: number | null }[];

    const itemCountHistory = historyData.map(row => ({
      timestamp: row.timestamp,
      count: row.total_items,
    }));

    // Re-add value history mapping
    const valueHistory = historyData.map(row => ({
      timestamp: row.timestamp,
      min: row.value_min,
      mean: row.value_mean, // Use the stored 'mean' (Discogs median)
      max: row.value_max,
    }));

    // --- Calculate Top/Least Valuable Items (using individual item values) ---
    const itemsWithValue = allItems.filter(item => item.suggested_value !== null && item.suggested_value > 0); // Keep this filter
    const sortedByValueDesc = [...itemsWithValue].sort((a, b) => b.suggested_value! - a.suggested_value!);
    const sortedByValueAsc = [...itemsWithValue].sort((a, b) => a.suggested_value! - b.suggested_value!);

    const topValuableItems: ValuableItem[] = sortedByValueDesc.slice(0, 10).map(item => ({
        id: item.id,
        release_id: item.release_id,
        artist: item.artist,
        title: item.title,
        cover_image_url: item.cover_image_url,
        condition: item.condition,
        suggested_value: item.suggested_value
    }));

    const leastValuableItems: ValuableItem[] = sortedByValueAsc.slice(0, 10).map(item => ({
        id: item.id,
        release_id: item.release_id,
        artist: item.artist,
        title: item.title,
        cover_image_url: item.cover_image_url,
        condition: item.condition,
        suggested_value: item.suggested_value
    }));



    // --- Calculate Distribution Stats (using already fetched allItems) ---
    // No need for distributionDataStmt, use 'allItems' directly
    const itemsForDistribution = allItems; // Use the full list fetched earlier

    const genreDistribution: Record<string, number> = {};
    const yearDistribution: Record<string, number> = {};
    const formatDistribution: Record<string, number> = {};

    for (const item of itemsForDistribution) { // Use the correct variable
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
          // Improved regex to better capture primary format, handling variations
          const formatLower = item.format.toLowerCase();
          let primaryFormat = 'Other'; // Default

          if (formatLower.includes('vinyl') || formatLower.includes(' lp') || formatLower.includes(' ep') || formatLower.includes(' 7"') || formatLower.includes(' 10"') || formatLower.includes(' 12"')) {
              primaryFormat = 'Vinyl';
          } else if (formatLower.includes('cd') || formatLower.includes('compact disc')) {
              primaryFormat = 'CD';
          } else if (formatLower.includes('cass') || formatLower.includes('cassette')) {
              primaryFormat = 'Cassette';
          } else if (formatLower.includes('file') || formatLower.includes('digital')) {
              primaryFormat = 'File';
          } // Add more rules if needed (e.g., DVD, Blu-ray)

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


    // --- Assemble Final Stats Object ---
    const stats: DashboardStats = {
      totalItems, // From history
      latestValueMin, // From history
      latestValueMean, // From history (Discogs median)
      latestValueMax, // From history
      averageValuePerItem, // Calculated from history mean
      itemCountHistory, // From history
      valueHistory, // Added back, from history
      genreDistribution: sortedGenreDistribution, // From allItems
      yearDistribution: sortedYearDistribution, // From allItems
      formatDistribution: sortedFormatDistribution, // From allItems
      topValuableItems, // From allItems
      leastValuableItems, // From allItems
    };

    console.log(`Successfully calculated dashboard stats.`); // Removed reference to itemCountWithValue
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