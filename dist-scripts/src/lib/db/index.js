"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDb = getDb;
exports.setSetting = setSetting;
exports.getSetting = getSetting;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// Define the path for the database file
const dbDir = path_1.default.resolve(process.cwd(), '.db');
const dbPath = path_1.default.join(dbDir, 'discogsdash.db');
// Ensure the .db directory exists
if (!fs_1.default.existsSync(dbDir)) {
    fs_1.default.mkdirSync(dbDir, { recursive: true });
    console.log(`Created database directory: ${dbDir}`);
    // Add .db/ to .gitignore if it doesn't exist
    const gitignorePath = path_1.default.resolve(process.cwd(), '.gitignore');
    try {
        const gitignoreContent = fs_1.default.existsSync(gitignorePath) ? fs_1.default.readFileSync(gitignorePath, 'utf8') : '';
        if (!gitignoreContent.includes('.db/')) {
            fs_1.default.appendFileSync(gitignorePath, '\n# Database Files\n.db/\n');
            console.log('Added .db/ to .gitignore');
        }
    }
    catch (err) {
        console.warn('Could not automatically update .gitignore:', err);
    }
}
let dbInstance = null;
/**
 * Gets the singleton database instance.
 * Initializes the database if it hasn't been already.
 * @returns The better-sqlite3 database instance.
 */
function getDb() {
    if (!dbInstance) {
        console.log(`Connecting to database at: ${dbPath}`);
        dbInstance = new better_sqlite3_1.default(dbPath, { /* verbose: console.log */}); // Uncomment verbose for debugging SQL
        dbInstance.pragma('journal_mode = WAL'); // Recommended for performance
        initDbSchema(dbInstance);
    }
    return dbInstance;
}
/**
 * Initializes the database schema if tables don't exist.
 * @param db The database instance.
 */
function initDbSchema(db) {
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
      condition TEXT,                  -- User-defined condition (e.g., "Mint (M)", "Near Mint (NM or M-)")
      suggested_value REAL,            -- Latest value suggestion based on condition
      last_value_check TEXT            -- ISO 8601 timestamp of the last price check
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
function setSetting(key, value) {
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
function getSetting(key) {
    var _a;
    const db = getDb();
    const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
    const result = stmt.get(key);
    return (_a = result === null || result === void 0 ? void 0 : result.value) !== null && _a !== void 0 ? _a : null;
}
// Initialize on module load (optional, alternatively call getDb() when needed)
// getDb();
