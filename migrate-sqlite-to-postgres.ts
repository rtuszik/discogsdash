import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { Pool } from "pg";

const SQLITE_DB_PATH = path.join(process.cwd(), ".db", "discogsdash.db");
const POSTGRES_URL =
    process.env.DATABASE_URL || "postgresql://discogsdash:discogsdash_password@localhost:5432/discogsdash";

interface MigrationStats {
    settings: number;
    collectionItems: number;
    statsHistory: number;
}

async function migrate() {
    console.log("=== SQLite to PostgreSQL Migration ===\n");

    if (!fs.existsSync(SQLITE_DB_PATH)) {
        console.error(`❌ SQLite database not found at: ${SQLITE_DB_PATH}`);
        console.error("   Make sure your .db/discogsdash.db file exists.");
        process.exit(1);
    }

    console.log(`✓ Found SQLite database at: ${SQLITE_DB_PATH}`);
    console.log(`✓ Connecting to PostgreSQL: ${POSTGRES_URL.replace(/:[^:@]+@/, ":****@")}`);

    const sqlite = new Database(SQLITE_DB_PATH, { readonly: true });
    const pg = new Pool({ connectionString: POSTGRES_URL });

    const stats: MigrationStats = {
        settings: 0,
        collectionItems: 0,
        statsHistory: 0,
    };

    try {
        await pg.query("SELECT 1");
        console.log("✓ PostgreSQL connection established\n");

        const client = await pg.connect();
        await client.query("BEGIN");

        try {
            console.log("📋 Migrating settings...");
            const settings = sqlite.prepare("SELECT * FROM settings").all();

            for (const setting of settings) {
                await client.query(
                    "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2",
                    [setting.key, setting.value],
                );
                stats.settings++;
            }
            console.log(`   ✓ Migrated ${stats.settings} settings\n`);

            console.log("📦 Migrating collection items...");
            const items = sqlite.prepare("SELECT * FROM collection_items").all();

            await client.query("DELETE FROM collection_items");

            for (const item of items) {
                await client.query(
                    `
          INSERT INTO collection_items (
            id, release_id, artist, title, year, format, genres, styles,
            cover_image_url, added_date, folder_id, rating, notes, condition,
            suggested_value, last_value_check
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        `,
                    [
                        item.id,
                        item.release_id,
                        item.artist,
                        item.title,
                        item.year,
                        item.format,
                        item.genres,
                        item.styles,
                        item.cover_image_url,
                        item.added_date,
                        item.folder_id,
                        item.rating,
                        item.notes,
                        item.condition,
                        item.suggested_value,
                        item.last_value_check,
                    ],
                );
                stats.collectionItems++;

                if (stats.collectionItems % 100 === 0) {
                    process.stdout.write(`   Processed ${stats.collectionItems} items...\r`);
                }
            }
            console.log(`   ✓ Migrated ${stats.collectionItems} collection items\n`);

            console.log("📊 Migrating collection stats history...");
            const history = sqlite.prepare("SELECT * FROM collection_stats_history ORDER BY timestamp ASC").all();

            for (const record of history) {
                await client.query(
                    `
          INSERT INTO collection_stats_history (
            timestamp, total_items, value_min, value_mean, value_max
          ) VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (timestamp) DO NOTHING
        `,
                    [record.timestamp, record.total_items, record.value_min, record.value_mean, record.value_max],
                );
                stats.statsHistory++;
            }
            console.log(`   ✓ Migrated ${stats.statsHistory} history records\n`);

            await client.query("COMMIT");
            console.log("✅ Migration completed successfully!\n");

            console.log("=== Migration Summary ===");
            console.log(`Settings:         ${stats.settings} records`);
            console.log(`Collection Items: ${stats.collectionItems} records`);
            console.log(`Stats History:    ${stats.statsHistory} records`);
            console.log("\nYour data has been successfully migrated to PostgreSQL! 🎉");
        } catch (error) {
            await client.query("ROLLBACK");
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error("\n❌ Migration failed:", error);
        console.error("\nPlease check your database connections and try again.");
        process.exit(1);
    } finally {
        sqlite.close();
        await pg.end();
    }
}

console.log("Starting migration...\n");
migrate();
