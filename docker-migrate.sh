#!/bin/bash

# Docker-based SQLite to PostgreSQL Migration Script
echo "=== Docker-based SQLite to PostgreSQL Migration ==="
echo ""

# Check if .db/discogsdash.db exists
if [ ! -f ".db/discogsdash.db" ]; then
    echo "❌ Error: SQLite database not found at .db/discogsdash.db"
    echo "   Please ensure your SQLite database file exists before running migration."
    exit 1
fi

echo "✓ Found SQLite database at .db/discogsdash.db"
echo ""

# Create a temporary migration container
echo "🔧 Creating migration container..."

# Run the migration using docker compose
docker compose -f docker-compose.dev.yml run --rm \
  -v "$(pwd)/.db:/app/.db:ro" \
  -v "$(pwd)/migrate-sqlite-to-postgres.ts:/app/migrate-sqlite-to-postgres.ts:ro" \
  -e DATABASE_URL=postgresql://discogsdash:discogsdash_password@postgres:5432/discogsdash \
  discogsdash \
  npx tsx migrate-sqlite-to-postgres.ts

# Check if migration was successful
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration completed successfully!"
    echo ""
    echo "Your SQLite data has been migrated to PostgreSQL."
    echo "You can now remove the old .db directory if you wish."
else
    echo ""
    echo "❌ Migration failed. Please check the error messages above."
    exit 1
fi
