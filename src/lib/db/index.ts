import { Pool, PoolClient } from "pg";

let pool: Pool | null = null;

function getPool(): Pool {
    if (!pool) {
        // Try DATABASE_URL first, then fallback to individual POSTGRES_* vars
        const connectionString = process.env.DATABASE_URL;

        if (connectionString) {
            pool = new Pool({
                connectionString,
                max: 20,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 10000,
            });
        } else {
            // Use individual POSTGRES_* environment variables
            const { POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB, POSTGRES_HOST = 'localhost', POSTGRES_PORT = '5432' } = process.env;

            if (!POSTGRES_USER || !POSTGRES_PASSWORD || !POSTGRES_DB) {
                throw new Error("Either DATABASE_URL or POSTGRES_USER, POSTGRES_PASSWORD, and POSTGRES_DB environment variables must be set");
            }

            pool = new Pool({
                user: POSTGRES_USER,
                password: POSTGRES_PASSWORD,
                database: POSTGRES_DB,
                host: POSTGRES_HOST,
                port: parseInt(POSTGRES_PORT, 10),
                max: 20,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 10000,
            });
        }

        pool.on("error", (err) => {
            console.error("Unexpected error on idle PostgreSQL client", err);
        });

        console.log("PostgreSQL connection pool initialized");
    }

    return pool;
}

export async function initDbSchema(): Promise<void> {
    const pool = getPool();
    const client = await pool.connect();

    try {
        console.log("Initializing database schema...");

        await client.query("BEGIN");

        await client.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);
        console.log("Checked/Created table: settings");

        await client.query(`
      CREATE TABLE IF NOT EXISTS collection_items (
        id INTEGER PRIMARY KEY,          -- Discogs Instance ID
        release_id INTEGER NOT NULL,     -- Discogs Release ID
        artist TEXT,
        title TEXT,
        year INTEGER,
        format TEXT,                     -- Could be more structured (e.g., JSON) if needed
        genres TEXT,                     -- Store as JSON array string '["Rock", "Pop"]'
        styles TEXT,                     -- Store as JSON array string '["Pop Rock", "Synth-pop"]'
        cover_image_url TEXT,
        added_date TEXT NOT NULL,        -- ISO 8601 Format (e.g., '2023-10-27T10:00:00Z')
        folder_id INTEGER,
        rating INTEGER,                  -- User's rating (0-5)
        notes TEXT,
        condition TEXT,                  -- User-defined condition (e.g., "Mint (M)", "Near Mint (NM or M-)")
        suggested_value REAL,            -- Latest value suggestion based on condition
        last_value_check TEXT            -- ISO 8601 timestamp of the last price check
      );
    `);

        await client.query(
            `CREATE INDEX IF NOT EXISTS idx_collection_items_release_id ON collection_items(release_id);`,
        );
        await client.query(
            `CREATE INDEX IF NOT EXISTS idx_collection_items_artist ON collection_items(artist);`,
        );
        await client.query(
            `CREATE INDEX IF NOT EXISTS idx_collection_items_year ON collection_items(year);`,
        );
        await client.query(
            `CREATE INDEX IF NOT EXISTS idx_collection_items_added_date ON collection_items(added_date);`,
        );
        console.log("Checked/Created table: collection_items and indexes");

        await client.query(`
      CREATE TABLE IF NOT EXISTS collection_stats_history (
        timestamp TEXT PRIMARY KEY,      -- ISO 8601 Format (e.g., '2023-10-27T10:00:00Z')
        total_items INTEGER NOT NULL,
        value_min REAL,                  -- Discogs reported min value
        value_mean REAL,                 -- Discogs reported median/mean value
        value_max REAL                   -- Discogs reported max value
      );
    `);
        console.log("Checked/Created table: collection_stats_history");

        await client.query("COMMIT");
        console.log("Database schema initialization complete.");
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Failed to initialize database schema:", error);
        throw error;
    } finally {
        client.release();
    }
}

export async function getDb() {
    const pool = getPool();

    if (!pool.totalCount) {
        await initDbSchema();
    }

    return {
        query: (text: string, params?: unknown[]) => pool.query(text, params),

        connect: () => pool.connect(),

        prepare: (query: string) => {
            return {
                run: async (...params: unknown[]) => {
                    const result = await pool.query(query, params);
                    return { changes: result.rowCount };
                },
                get: async (...params: unknown[]) => {
                    const result = await pool.query(query, params);
                    return result.rows[0] || undefined;
                },
                all: async (...params: unknown[]) => {
                    const result = await pool.query(query, params);
                    return result.rows;
                },
            };
        },

        transaction: async (fn: (client: PoolClient) => Promise<void>) => {
            const client = await pool.connect();
            try {
                await client.query("BEGIN");
                await fn(client);
                await client.query("COMMIT");
            } catch (error) {
                await client.query("ROLLBACK");
                throw error;
            } finally {
                client.release();
            }
        },
    };
}

export async function setSetting(key: string, value: string): Promise<void> {
    const db = await getDb();
    await db.query(
        "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2",
        [key, value],
    );
}

export async function getSetting(key: string): Promise<string | null> {
    const db = await getDb();
    const result = await db.query("SELECT value FROM settings WHERE key = $1", [key]);
    return result.rows[0]?.value ?? null;
}

export async function closeDb(): Promise<void> {
    if (pool) {
        await pool.end();
        pool = null;
        console.log("PostgreSQL connection pool closed");
    }
}

process.on("SIGINT", async () => {
    console.log("SIGINT received, closing database connections...");
    await closeDb();
    process.exit(0);
});

process.on("SIGTERM", async () => {
    console.log("SIGTERM received, closing database connections...");
    await closeDb();
    process.exit(0);
});

export function __resetDbInstanceForTest(): void {
    if (pool) {
        pool.end().catch(() => {});
    }
    pool = null;
}

