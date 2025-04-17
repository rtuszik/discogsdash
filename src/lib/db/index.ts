import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Define the path for the database file
const dbDir = path.resolve(process.cwd(), '.db');
const dbPath = path.join(dbDir, 'discogsdash.db');

// Ensure the .db directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
  console.log(`Created database directory: ${dbDir}`);
  // Add .db/ to .gitignore if it doesn't exist
  const gitignorePath = path.resolve(process.cwd(), '.gitignore');
  try {
    const gitignoreContent = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : '';
    if (!gitignoreContent.includes('.db/')) {
      fs.appendFileSync(gitignorePath, '\n# Database Files\n.db/\n');
      console.log('Added .db/ to .gitignore');
    }
  } catch (err) {
    console.warn('Could not automatically update .gitignore:', err);
  }
}

let dbInstance: Database.Database | null = null;

/**
 * Gets the singleton database instance.
 * Initializes the database if it hasn't been already.
 * @returns The better-sqlite3 database instance.
 */
export function getDb(): Database.Database {
  if (!dbInstance) {
    console.log(`Connecting to database at: ${dbPath}`);
    dbInstance = new Database(dbPath, { /* verbose: console.log */ }); // Uncomment verbose for debugging SQL
    dbInstance.pragma('journal_mode = WAL'); // Recommended for performance
    initDbSchema(dbInstance);
  }
  return dbInstance;
}

/**
 * Initializes the database schema if tables don't exist.
 * @param db The database instance.
 */
function initDbSchema(db: Database.Database): void {
  console.log('Initializing database schema...');

  // Settings Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
  console.log('Checked/Created table: settings');

  // Collection Items Table
  db.exec(`
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
      estimated_value REAL             -- Store latest known value per item if available/desired
    );
  `);
  // Add indexes for potentially queried columns
  db.exec(`CREATE INDEX IF NOT EXISTS idx_collection_items_release_id ON collection_items(release_id);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_collection_items_artist ON collection_items(artist);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_collection_items_year ON collection_items(year);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_collection_items_added_date ON collection_items(added_date);`);
  console.log('Checked/Created table: collection_items and indexes');

  // Collection Stats History Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS collection_stats_history (
      timestamp TEXT PRIMARY KEY,      -- ISO 8601 Format (e.g., '2023-10-27T10:00:00Z')
      total_items INTEGER NOT NULL,
      value_min REAL,                  -- Discogs reported min value
      value_mean REAL,                 -- Discogs reported median/mean value
      value_max REAL                   -- Discogs reported max value
    );
  `);
  console.log('Checked/Created table: collection_stats_history');

  console.log('Database schema initialization complete.');
}

// --- Settings Management ---

/**
 * Sets a value in the settings table.
 * @param key The setting key.
 * @param value The setting value.
 */
export function setSetting(key: string, value: string): void {
  const db = getDb();
  const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  stmt.run(key, value);
  console.log(`Setting updated: ${key}`);
}

/**
 * Gets a value from the settings table.
 * @param key The setting key.
 * @returns The setting value, or null if not found.
 */
export function getSetting(key: string): string | null {
  const db = getDb();
  const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
  const result = stmt.get(key) as { value: string } | undefined;
  return result?.value ?? null;
}


// Initialize on module load (optional, alternatively call getDb() when needed)
// getDb();