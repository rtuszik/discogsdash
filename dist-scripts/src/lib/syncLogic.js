"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCollectionSync = runCollectionSync;
const db_1 = require("./db"); // Use relative path
const client_1 = require("./discogs/client"); // Use relative path
/**
 * Performs the full collection sync process: fetches items, gets price suggestions, updates DB.
 * Can be called by API route or scheduler.
 */
async function runCollectionSync() {
    var _a, _b;
    console.log('Starting collection sync run...');
    const syncStartTime = Date.now();
    try {
        // Set initial status
        (0, db_1.setSetting)('sync_status', 'running');
        (0, db_1.setSetting)('sync_current_item', '0');
        (0, db_1.setSetting)('sync_total_items', '0');
        (0, db_1.setSetting)('sync_last_error', ''); // Clear previous errors
        // 1. Get Credentials from Environment Variables
        const username = process.env.DISCOGS_USERNAME;
        const token = process.env.DISCOGS_TOKEN;
        if (!username || !token) {
            const errorMsg = 'Sync failed: DISCOGS_USERNAME or DISCOGS_TOKEN environment variables not set.';
            console.error(errorMsg);
            (0, db_1.setSetting)('sync_status', 'error'); // Still use DB for status tracking
            (0, db_1.setSetting)('sync_last_error', errorMsg);
            throw new Error(errorMsg);
        }
        console.log(`Syncing for user: ${username}`);
        // --- Fetch Collection Items (Handles Pagination) ---
        const collectionEndpoint = `/users/${username}/collection/folders/0/releases?per_page=100`;
        let allReleases = [];
        let nextUrl = collectionEndpoint;
        let pageCount = 0;
        while (nextUrl) {
            pageCount++;
            console.log(`Fetching collection page ${pageCount}: ${nextUrl}`);
            // Re-check token here as it's critical for the loop
            if (!token)
                throw new Error("DISCOGS_TOKEN environment variable is missing.");
            const response = await (0, client_1.makeDiscogsRequest)(nextUrl, token);
            if (response && response.releases) {
                allReleases = allReleases.concat(response.releases);
            }
            else {
                console.warn(`No releases found on page ${pageCount} or invalid response.`);
            }
            if ((_b = (_a = response === null || response === void 0 ? void 0 : response.pagination) === null || _a === void 0 ? void 0 : _a.urls) === null || _b === void 0 ? void 0 : _b.next) {
                const fullNextUrl = response.pagination.urls.next;
                if (!fullNextUrl) {
                    nextUrl = undefined;
                    continue;
                }
                try {
                    const urlObject = new URL(fullNextUrl);
                    nextUrl = urlObject.pathname + urlObject.search;
                }
                catch (e) {
                    console.error("Failed to parse next URL, stopping pagination:", e);
                    nextUrl = undefined;
                }
            }
            else {
                nextUrl = undefined;
            }
            // Optional delay
            // await new Promise(resolve => setTimeout(resolve, 250));
        }
        const totalItemsToProcess = allReleases.length;
        console.log(`Fetched total ${totalItemsToProcess} items from collection across ${pageCount} pages.`);
        (0, db_1.setSetting)('sync_total_items', totalItemsToProcess.toString()); // Update total count
        // --- Fetch Overall Collection Value ---
        let valueResponse = null;
        try {
            const valueEndpoint = `/users/${username}/collection/value`;
            console.log(`Fetching overall collection value: ${valueEndpoint}`);
            // Re-check token here as well
            if (!token)
                throw new Error("DISCOGS_TOKEN environment variable is missing.");
            valueResponse = await (0, client_1.makeDiscogsRequest)(valueEndpoint, token);
            console.log('Fetched overall collection value:', valueResponse);
        }
        catch (valueError) {
            console.error("Could not fetch overall collection value:", valueError);
            // Continue sync even if overall value fetch fails
        }
        // --- Store Data in DB (within a transaction) ---
        const db = (0, db_1.getDb)();
        const insertItemStmt = db.prepare(`
    INSERT OR REPLACE INTO collection_items
    (id, release_id, artist, title, year, format, genres, styles, cover_image_url, added_date, folder_id, rating, notes, condition, suggested_value, last_value_check)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
        const insertStatsStmt = db.prepare(`
    INSERT INTO collection_stats_history
    (timestamp, total_items, value_min, value_mean, value_max)
    VALUES (?, ?, ?, ?, ?)
  `);
        // Helper to parse currency string like "$1,234.56" or "€1.234,56" to number
        const parseValue = (valueStr) => {
            if (!valueStr)
                return null;
            try {
                // Remove currency symbols, thousands separators (commas or dots)
                const cleaned = valueStr.replace(/[$,€£¥]/g, '').replace(/[.]/g, (match, offset, full) => {
                    // Keep the last dot if it's followed by digits (likely decimal)
                    // Otherwise, remove dots used as thousands separators
                    return full.lastIndexOf('.') === offset ? '.' : '';
                }).replace(/,/g, '.'); // Replace comma decimal separator with dot
                const value = parseFloat(cleaned);
                return isNaN(value) ? null : value;
            }
            catch (e) {
                console.error(`Failed to parse currency value: "${valueStr}"`, e);
                return null;
            }
        };
        const runTransaction = db.transaction(async () => {
            var _a, _b;
            db.prepare('DELETE FROM collection_items').run();
            console.log('Cleared existing collection items.');
            let processedCount = 0;
            const currentTimestamp = new Date().toISOString();
            for (const release of allReleases) {
                processedCount++;
                (0, db_1.setSetting)('sync_current_item', processedCount.toString()); // Update progress before processing item
                if (!release || !release.basic_information || !release.id) {
                    console.warn(`Skipping invalid release data (item ${processedCount}/${totalItemsToProcess}):`, release);
                    continue;
                }
                let itemSuggestedValue = null;
                let lastCheckTimestamp = null;
                try {
                    // Re-check token before fetching price suggestions
                    if (!token)
                        throw new Error("DISCOGS_TOKEN environment variable is missing.");
                    console.log(`(${processedCount}/${allReleases.length}) Fetching price for release ID: ${release.id}`);
                    const suggestions = await (0, client_1.fetchPriceSuggestions)(release.id, token);
                    lastCheckTimestamp = new Date().toISOString();
                    // Define preferred condition order for fallback
                    const conditionOrder = [
                        'Mint (M)',
                        'Near Mint (NM or M-)',
                        'Very Good Plus (VG+)',
                        'Very Good (VG)',
                        'Good Plus (G+)',
                        'Good (G)',
                        'Fair (F)',
                        'Poor (P)'
                    ];
                    if (suggestions) {
                        console.log(` -> Received suggestions:`, Object.keys(suggestions));
                        for (const condition of conditionOrder) {
                            if (suggestions[condition]) {
                                itemSuggestedValue = suggestions[condition].value;
                                console.log(` -> Using value for condition "${condition}": ${itemSuggestedValue}`);
                                break; // Found the best available value
                            }
                        }
                        if (itemSuggestedValue === null) {
                            console.log(` -> No value found for preferred conditions.`);
                        }
                    }
                    else {
                        console.log(` -> No suggestions object received.`);
                    }
                    // Manual delay removed - handled by retry logic in makeDiscogsRequest
                }
                catch (priceError) {
                    console.error(`Failed to fetch price suggestions for release ID ${release.id}:`, priceError);
                }
                const basicInfo = release.basic_information;
                insertItemStmt.run(release.instance_id, release.id, ((_a = basicInfo.artists) === null || _a === void 0 ? void 0 : _a.map(a => a.name).join(', ')) || 'Unknown Artist', basicInfo.title || 'Unknown Title', basicInfo.year || null, ((_b = basicInfo.formats) === null || _b === void 0 ? void 0 : _b.map(f => `${f.qty} x ${f.name}${f.descriptions ? ` (${f.descriptions.join(', ')})` : ''}`).join('; ')) || null, JSON.stringify(basicInfo.genres || []), JSON.stringify(basicInfo.styles || []), basicInfo.cover_image || null, release.date_added, release.folder_id, release.rating, null, // Notes
                null, // Condition
                itemSuggestedValue, lastCheckTimestamp);
            }
            console.log(`Processed ${processedCount} items for DB insertion/update.`);
            // Parse overall value strings
            const minValue = parseValue(valueResponse === null || valueResponse === void 0 ? void 0 : valueResponse.minimum);
            const medianValue = parseValue(valueResponse === null || valueResponse === void 0 ? void 0 : valueResponse.median);
            const maxValue = parseValue(valueResponse === null || valueResponse === void 0 ? void 0 : valueResponse.maximum);
            insertStatsStmt.run(currentTimestamp, totalItemsToProcess, minValue, medianValue, maxValue);
            console.log('Inserted collection stats history with overall values.');
        });
        await runTransaction(); // Await the async transaction
        const syncEndTime = Date.now();
        const durationSeconds = ((syncEndTime - syncStartTime) / 1000).toFixed(1);
        console.log(`Sync process completed successfully in ${durationSeconds} seconds.`);
        (0, db_1.setSetting)('sync_status', 'idle'); // Set status back to idle on success
        return {
            itemCount: allReleases.length,
            message: `Sync complete. Processed ${totalItemsToProcess} items in ${durationSeconds} seconds.`
        };
    }
    catch (error) {
        // Catch errors from credential check, fetching, or transaction
        console.error('Sync process failed:', error);
        (0, db_1.setSetting)('sync_status', 'error');
        (0, db_1.setSetting)('sync_last_error', error instanceof Error ? error.message : 'Unknown sync error');
        // Re-throw the error so the caller (API route or scheduler) knows it failed
        throw error;
    }
}
