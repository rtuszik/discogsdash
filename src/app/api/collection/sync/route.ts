import { NextResponse } from 'next/server';
import { getSetting, getDb } from '@/lib/db'; // Import getDb
import { makeDiscogsRequest } from '@/lib/discogs/client';

// Define expected Discogs API response types (can be refined)
const DISCOGS_API_BASE_URL = 'https://api.discogs.com'; // Needed for parsing next URL

interface DiscogsPagination {
  page: number;
  pages: number;
  per_page: number;
  items: number;
  urls: {
    last?: string;
    next?: string;
  };
}

interface DiscogsReleaseBasic {
  id: number; // Release ID
  instance_id: number; // Instance ID in collection
  folder_id: number;
  rating: number;
  date_added: string; // ISO 8601 format
  basic_information: {
    id: number; // Release ID (repeated)
    title: string;
    year: number;
    resource_url: string;
    thumb: string; // Thumbnail URL
    cover_image: string; // Cover image URL
    formats: { name: string; qty: string; descriptions?: string[] }[];
    labels: { name: string; catno: string; id: number }[];
    artists: { name: string; id: number }[];
    genres?: string[];
    styles?: string[];
  };
  // Potentially notes field if requested via query param
}

interface DiscogsCollectionResponse {
  pagination: DiscogsPagination;
  releases: DiscogsReleaseBasic[];
}

interface DiscogsCollectionValue {
    minimum: string; // e.g., "€1,234.56" - Needs parsing
    median: string;  // e.g., "€2,345.67"
    maximum: string;  // e.g., "€3,456.78"
}


export async function GET(request: Request) {
  console.log('Received request to sync collection...');

  try {
    // 1. Get Credentials from DB
    const username = getSetting('discogs_username');
    const token = getSetting('discogs_token');

    if (!username || !token) {
      console.error('Sync failed: Discogs username or token not configured.');
      return NextResponse.json(
        { message: 'Discogs username and token not configured. Please set them in Settings.' },
        { status: 401 } // Unauthorized or Bad Request might be suitable
      );
    }

    console.log(`Starting sync for user: ${username}`);

    // --- Fetch Collection Items (Handles Pagination) ---
    const collectionEndpoint = `/users/${username}/collection/folders/0/releases?per_page=100`; // Start with folder 0 (All), max 100 per page
    let allReleases: DiscogsReleaseBasic[] = [];
    let nextUrl: string | undefined = collectionEndpoint;
    let pageCount = 0;

    while (nextUrl) {
      pageCount++;
      console.log(`Fetching collection page ${pageCount}: ${nextUrl}`);
      // Ensure the token is valid before making the request
      if (!token) throw new Error("Discogs token is missing.");

      const response: DiscogsCollectionResponse = await makeDiscogsRequest<DiscogsCollectionResponse>(nextUrl, token);
      if (response && response.releases) {
          allReleases = allReleases.concat(response.releases);
      } else {
          console.warn(`No releases found on page ${pageCount} or invalid response.`);
      }

      // Check pagination and prepare next URL
      if (response?.pagination?.urls?.next) {
          // Discogs API returns full URL, need relative path for our client
          const fullNextUrl: string | undefined = response.pagination.urls.next;
          if (!fullNextUrl) {
              nextUrl = undefined; // Explicitly stop if URL is missing
              continue;
          }
          try {
              const urlObject: URL = new URL(fullNextUrl);
              nextUrl = urlObject.pathname + urlObject.search; // Get path and query string
          } catch (e) {
              console.error("Failed to parse next URL, stopping pagination:", e);
              nextUrl = undefined;
          }
      } else {
          nextUrl = undefined; // No more pages
      }

      // Optional: Add a small delay to respect rate limits, especially for large collections
      // await new Promise(resolve => setTimeout(resolve, 250)); // 250ms delay
    }
    console.log(`Fetched total ${allReleases.length} items from collection across ${pageCount} pages.`);


    // --- Fetch Collection Value ---
    const valueEndpoint = `/users/${username}/collection/value`;
    console.log(`Fetching collection value: ${valueEndpoint}`);
    if (!token) throw new Error("Discogs token is missing."); // Re-check token just in case
    const valueResponse = await makeDiscogsRequest<DiscogsCollectionValue>(valueEndpoint, token);
    console.log('Fetched collection value:', valueResponse);


    // --- Store Data in DB (within a transaction) ---
    const db = getDb();
    const insertItemStmt = db.prepare(`
      INSERT OR REPLACE INTO collection_items
      (id, release_id, artist, title, year, format, genres, styles, cover_image_url, added_date, folder_id, rating, notes, estimated_value)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertStatsStmt = db.prepare(`
      INSERT INTO collection_stats_history
      (timestamp, total_items, value_min, value_mean, value_max)
      VALUES (?, ?, ?, ?, ?)
    `);

    // Helper to parse currency string like "$1,234.56" or "€1.234,56" to number
    const parseValue = (valueStr: string | null | undefined): number | null => {
        if (!valueStr) return null;
        try {
            // Remove currency symbols, thousands separators (commas or dots)
            const cleaned = valueStr.replace(/[$,€£¥]/g, '').replace(/[.]/g, (match, offset, full) => {
                // Keep the last dot if it's followed by digits (likely decimal)
                // Otherwise, remove dots used as thousands separators
                return full.lastIndexOf('.') === offset ? '.' : '';
            }).replace(/,/g, '.'); // Replace comma decimal separator with dot

            const value = parseFloat(cleaned);
            return isNaN(value) ? null : value;
        } catch (e) {
            console.error(`Failed to parse currency value: "${valueStr}"`, e);
            return null;
        }
    };


    const runTransaction = db.transaction(() => {
      // Clear existing items for a full refresh.
      // Alternatively, implement an update/upsert strategy if needed.
      db.prepare('DELETE FROM collection_items').run();
      console.log('Cleared existing collection items.');

      let insertedCount = 0;
      for (const release of allReleases) {
        if (!release || !release.basic_information) {
            console.warn('Skipping invalid release data:', release);
            continue;
        }
        const basicInfo = release.basic_information;
        insertItemStmt.run(
          release.instance_id,
          release.id, // release_id
          basicInfo.artists?.map(a => a.name).join(', ') || 'Unknown Artist',
          basicInfo.title || 'Unknown Title',
          basicInfo.year || null,
          basicInfo.formats?.map(f => `${f.qty} x ${f.name}${f.descriptions ? ` (${f.descriptions.join(', ')})` : ''}`).join('; ') || null,
          JSON.stringify(basicInfo.genres || []), // Store as JSON string
          JSON.stringify(basicInfo.styles || []), // Store as JSON string
          basicInfo.cover_image || null,
          release.date_added, // Already ISO string
          release.folder_id,
          release.rating,
          null, // Notes - not fetched by default, add if needed
          null // Estimated value - not directly available here, maybe fetch separately?
        );
        insertedCount++;
      }
      console.log(`Inserted ${insertedCount} items into DB.`);

      // Parse value strings
      const minValue = parseValue(valueResponse?.minimum);
      const medianValue = parseValue(valueResponse?.median); // Discogs calls it median, map to mean for simplicity?
      const maxValue = parseValue(valueResponse?.maximum);

      insertStatsStmt.run(new Date().toISOString(), allReleases.length, minValue, medianValue, maxValue);
      console.log('Inserted collection stats history.');
    });

    runTransaction();


    console.log('Sync process completed successfully.');
    return NextResponse.json(
      { message: `Sync complete. Processed ${allReleases.length} items.`, value: valueResponse },
      { status: 200 }
    );

  } catch (error) {
    console.error('Collection Sync Error:', error);
    let errorMessage = 'Internal Server Error during sync';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json(
      { message: 'Failed to sync collection', error: errorMessage },
      { status: 500 }
    );
  }
}