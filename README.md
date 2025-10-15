# DiscogsDash

Personal dashboard for visualizing and analyzing Discogs vinyl collections. Tracks collection value, distribution, and trends over time.

## Setup

### Prerequisites

- Docker and Docker Compose

### Configuration

1. Register a Discogs application at https://www.discogs.com/settings/developers
2. Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Required environment variables:

- `DISCOGS_CONSUMER_KEY` - From your Discogs app registration
- `DISCOGS_CONSUMER_SECRET` - From your Discogs app registration
- `DISCOGS_USERNAME` - Your Discogs username
- `DATABASE_URL` - PostgreSQL connection string

### Deployment

Start the application:

```bash
docker-compose up -d
```

The application will be available at `http://localhost:3000`.

### Database

Uses PostgreSQL with automatic migrations. Data persists in Docker volumes.

## Development

```bash
npm run dev          # Start development server
npm run build        # Build production application
npm run test         # Run tests
npm run lint         # Check code quality
```

## Architecture

- **Frontend**: Next.js with React, TypeScript, Tailwind CSS
- **Backend**: Next.js API routes with PostgreSQL
- **Authentication**: OAuth 1.0a with Discogs API
- **Scheduling**: Node-cron for automatic collection syncing
- **Deployment**: Docker with PM2 process management

### Key Components

- `src/lib/discogs/client.ts` - Discogs API integration with OAuth
- `src/lib/syncLogic.ts` - Collection synchronization logic
- `src/lib/scheduler.ts` - Automated sync scheduling
- `src/app/api/oauth/` - OAuth authentication endpoints

### Database Schema

- `collection_items` - User's collection data
- `collection_stats_history` - Historical value tracking
- `settings` - Application configuration

## Sync Process

The application automatically syncs collection data daily at midnight (configurable via `SYNC_CRON_SCHEDULE`). Manual sync available via `/api/collection/sync`.

## API Endpoints

- `/api/oauth/setup` - Initialize OAuth authentication
- `/api/oauth/callback` - OAuth callback handler
- `/api/collection/sync` - Trigger manual sync
- `/api/collection/sync/status` - Check sync status
- `/api/dashboard-stats` - Get dashboard statistics

## License

MIT

