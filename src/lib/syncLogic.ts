import { getDb, setSetting } from "./db";
import { makeDiscogsRequest, fetchPriceSuggestions } from "./discogs/client";

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
    id: number;
    instance_id: number;
    folder_id: number;
    rating: number;
    date_added: string;
    basic_information: {
        id: number;
        title: string;
        year: number;
        resource_url: string;
        thumb: string;
        cover_image: string;
        formats: { name: string; qty: string; descriptions?: string[] }[];
        labels: { name: string; catno: string; id: number }[];
        artists: { name: string; id: number }[];
        genres?: string[];
        styles?: string[];
    };
}

interface DiscogsCollectionResponse {
    pagination: DiscogsPagination;
    releases: DiscogsReleaseBasic[];
}

interface DiscogsCollectionValue {
    minimum: string;
    median: string;
    maximum: string;
}

export async function runCollectionSync(): Promise<{ itemCount: number; message: string }> {
    console.log("Starting collection sync run...");
    const syncStartTime = Date.now();

    try {
        await setSetting("sync_status", "running");
        await setSetting("sync_current_item", "0");
        await setSetting("sync_total_items", "0");
        await setSetting("sync_last_error", "");

        const username = process.env.DISCOGS_USERNAME;

        if (!username) {
            const errorMsg = "Sync failed: DISCOGS_USERNAME environment variable not set.";
            console.error(errorMsg);
            await setSetting("sync_status", "error");
            await setSetting("sync_last_error", errorMsg);
            throw new Error(errorMsg);
        }

        console.log(`Syncing for user: ${username}`);

        const collectionEndpoint = `/users/${username}/collection/folders/0/releases?per_page=100`;
        let allReleases: DiscogsReleaseBasic[] = [];
        let nextUrl: string | undefined = collectionEndpoint;
        let pageCount = 0;

        while (nextUrl) {
            pageCount++;
            console.log(`Fetching collection page ${pageCount}: ${nextUrl}`);

            const response: DiscogsCollectionResponse =
                await makeDiscogsRequest<DiscogsCollectionResponse>(nextUrl);
            if (response && response.releases) {
                allReleases = allReleases.concat(response.releases);
            } else {
                console.warn(`No releases found on page ${pageCount} or invalid response.`);
            }

            if (response?.pagination?.urls?.next) {
                const fullNextUrl: string | undefined = response.pagination.urls.next;
                if (!fullNextUrl) {
                    nextUrl = undefined;
                    continue;
                }
                try {
                    const urlObject: URL = new URL(fullNextUrl);
                    nextUrl = urlObject.pathname + urlObject.search;
                } catch (e) {
                    console.error("Failed to parse next URL, stopping pagination:", e);
                    nextUrl = undefined;
                }
            } else {
                nextUrl = undefined;
            }
        }
        const totalItemsToProcess = allReleases.length;
        console.log(
            `Fetched total ${totalItemsToProcess} items from collection across ${pageCount} pages.`,
        );
        await setSetting("sync_total_items", totalItemsToProcess.toString());

        let valueResponse: DiscogsCollectionValue | null = null;
        try {
            const valueEndpoint = `/users/${username}/collection/value`;
            console.log(`Fetching overall collection value: ${valueEndpoint}`);

            valueResponse = await makeDiscogsRequest<DiscogsCollectionValue>(valueEndpoint);
            console.log("Fetched overall collection value:", valueResponse);
        } catch (valueError) {
            console.error("Could not fetch overall collection value:", valueError);
        }

        const db = await getDb();

        const parseValue = (valueStr: string | null | undefined): number | null => {
            if (!valueStr) return null;
            try {
                const cleaned = valueStr
                    .replace(/[$,€£¥]/g, "")
                    .replace(/[.]/g, (match, offset, full) => {
                        return full.lastIndexOf(".") === offset ? "." : "";
                    })
                    .replace(/,/g, ".");

                const value = parseFloat(cleaned);
                return isNaN(value) ? null : value;
            } catch (e) {
                console.error(`Failed to parse currency value: "${valueStr}"`, e);
                return null;
            }
        };

        await db.transaction(async (client) => {
            await client.query("DELETE FROM collection_items");
            console.log("Cleared existing collection items.");

            let processedCount = 0;
            const currentTimestamp = new Date().toISOString();

            for (const release of allReleases) {
                processedCount++;
                await setSetting("sync_current_item", processedCount.toString());

                if (!release || !release.basic_information || !release.id) {
                    console.warn(
                        `Skipping invalid release data (item ${processedCount}/${totalItemsToProcess}):`,
                        release,
                    );
                    continue;
                }

                let itemSuggestedValue: number | null = null;
                let lastCheckTimestamp: string | null = null;

                try {
                    console.log(
                        `(${processedCount}/${allReleases.length}) Fetching price for release ID: ${release.id}`,
                    );
                    const suggestions = await fetchPriceSuggestions(release.id);
                    lastCheckTimestamp = new Date().toISOString();

                    const conditionOrder = [
                        "Mint (M)",
                        "Near Mint (NM or M-)",
                        "Very Good Plus (VG+)",
                        "Very Good (VG)",
                        "Good Plus (G+)",
                        "Good (G)",
                        "Fair (F)",
                        "Poor (P)",
                    ];

                    if (suggestions) {
                        console.log(` -> Received suggestions:`, Object.keys(suggestions));
                        for (const condition of conditionOrder) {
                            if (suggestions[condition]) {
                                itemSuggestedValue = suggestions[condition].value;
                                console.log(
                                    ` -> Using value for condition "${condition}": ${itemSuggestedValue}`,
                                );
                                break;
                            }
                        }
                        if (itemSuggestedValue === null) {
                            console.log(` -> No value found for preferred conditions.`);
                        }
                    } else {
                        console.log(` -> No suggestions object received.`);
                    }
                } catch (priceError) {
                    console.error(
                        `Failed to fetch price suggestions for release ID ${release.id}:`,
                        priceError,
                    );
                }

                const basicInfo = release.basic_information;
                await client.query(
                    `
        INSERT INTO collection_items
        (id, release_id, artist, title, year, format, genres, styles, cover_image_url, added_date, folder_id, rating, notes, condition, suggested_value, last_value_check)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        ON CONFLICT (id) DO UPDATE SET
          release_id = $2,
          artist = $3,
          title = $4,
          year = $5,
          format = $6,
          genres = $7,
          styles = $8,
          cover_image_url = $9,
          added_date = $10,
          folder_id = $11,
          rating = $12,
          notes = $13,
          condition = $14,
          suggested_value = $15,
          last_value_check = $16
      `,
                    [
                        release.instance_id,
                        release.id,
                        basicInfo.artists?.map((a) => a.name).join(", ") || "Unknown Artist",
                        basicInfo.title || "Unknown Title",
                        basicInfo.year || null,
                        basicInfo.formats
                            ?.map(
                                (f) =>
                                    `${f.qty} x ${f.name}${f.descriptions ? ` (${f.descriptions.join(", ")})` : ""}`,
                            )
                            .join("; ") || null,
                        JSON.stringify(basicInfo.genres || []),
                        JSON.stringify(basicInfo.styles || []),
                        basicInfo.cover_image || null,
                        release.date_added,
                        release.folder_id,
                        release.rating,
                        null,
                        null,
                        itemSuggestedValue,
                        lastCheckTimestamp,
                    ],
                );
            }
            console.log(`Processed ${processedCount} items for DB insertion/update.`);

            const minValue = parseValue(valueResponse?.minimum);
            const medianValue = parseValue(valueResponse?.median);
            const maxValue = parseValue(valueResponse?.maximum);

            await client.query(
                `
      INSERT INTO collection_stats_history
      (timestamp, total_items, value_min, value_mean, value_max)
      VALUES ($1, $2, $3, $4, $5)
    `,
                [currentTimestamp, totalItemsToProcess, minValue, medianValue, maxValue],
            );
            console.log("Inserted collection stats history with overall values.");
        });

        const syncEndTime = Date.now();
        const durationSeconds = ((syncEndTime - syncStartTime) / 1000).toFixed(1);
        console.log(`Sync process completed successfully in ${durationSeconds} seconds.`);
        await setSetting("sync_status", "idle");
        return {
            itemCount: allReleases.length,
            message: `Sync complete. Processed ${totalItemsToProcess} items in ${durationSeconds} seconds.`,
        };
    } catch (error) {
        console.error("Sync process failed:", error);
        await setSetting("sync_status", "error");
        await setSetting(
            "sync_last_error",
            error instanceof Error ? error.message : "Unknown sync error",
        );

        throw error;
    }
}

