# Plan: Fix Cron Job, Add Configurable Interval, and Enhance Logging

## Problem

The background cron job for syncing the Discogs collection is not running or logging as expected within the Docker container. Additionally, the sync interval is hardcoded and needs to be configurable.

## Diagnosis

1.  `src/lib/scheduler.ts` uses `node-cron` but relies on being executed.
2.  `docker-compose.yml` uses the default image command.
3.  `Dockerfile` compiles `scheduler.ts` to `./dist-scripts` and uses `pm2-runtime start ecosystem.config.js` as the `CMD`.
4.  `ecosystem.config.js` *does* define a `scheduler` app process.
5.  `tsconfig.scripts.json` sets `outDir` to `./dist-scripts`.
6.  **Root Cause:** The `ecosystem.config.js` points to an incorrect path (`./dist-scripts/src/lib/scheduler.js`) for the compiled scheduler script. The correct path, based on `tsconfig.scripts.json` and the `include` path, should be `./dist-scripts/scheduler.js`.

## Solution Steps

1.  **Correct Scheduler Path in PM2 Config:**
    *   Modify `ecosystem.config.js`: Change the `script` path for the `scheduler` app from `./dist-scripts/src/lib/scheduler.js` to `./dist-scripts/scheduler.js`.

2.  **Implement Configurable Cron Interval:**
    *   Modify `src/lib/scheduler.ts`:
        *   Read the cron schedule from the environment variable `SYNC_CRON_SCHEDULE`.
        *   Use `0 0 * * *` (daily at midnight) as the default schedule if the environment variable is not set.
        *   Add logging to indicate whether the default or the environment variable schedule is being used.
        *   Use the determined schedule in the `cron.schedule` call.

3.  **Update Docker Compose:**
    *   Modify `docker-compose.yml`:
        *   Add the `SYNC_CRON_SCHEDULE` environment variable under the `discogsdash` service's `environment` section.
        *   Provide a commented-out example: `# SYNC_CRON_SCHEDULE=0 0 * * * # Default: Daily at midnight. Uncomment to override.`.

4.  **Enhance Logging:**
    *   Modify `src/lib/scheduler.ts`:
        *   Add a log message *before* calling `await runCollectionSync()` inside the `try` block.
        *   Ensure existing logs clearly state the timestamp and the event (e.g., "Scheduler starting sync", "Sync finished", "Sync failed").

## Conceptual Flow Diagram

```mermaid
graph TD
    A[docker-compose.yml] -- sets SYNC_CRON_SCHEDULE --> B(Container Environment);
    B -- provides env var --> C(PM2);
    C -- starts --> D(ecosystem.config.js);
    D -- defines --> E{Scheduler Process w/ correct path};
    D -- defines --> F{Next.js Process};
    E -- runs script --> G[./dist-scripts/scheduler.js];
    G -- reads env var --> H{SYNC_CRON_SCHEDULE?};
    H -- Yes --> I[Use Env Var Schedule];
    H -- No --> J[Use Default Schedule '0 0 * * *'];
    I -- schedules --> K(node-cron);
    J -- schedules --> K;
    K -- triggers at interval --> L(runCollectionSync);
    L -- logs --> M(Container Logs);
    G -- logs --> M;

    style A fill:#f9f,stroke:#333,stroke-width:2px
    style C fill:#ccf,stroke:#333,stroke-width:2px
    style G fill:#ff9,stroke:#333,stroke-width:2px
    style L fill:#9cf,stroke:#333,stroke-width:2px