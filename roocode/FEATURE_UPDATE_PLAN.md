# Discogs Collection IQ - Feature Update Plan

This document outlines the plan for updating the Discogs dashboard application based on user requirements.

**Overall Goals:**

*   Update website title and implement a grayscale UI theme (using Tailwind `neutral` palette).
*   Make charts colorful and visually appealing against the dark theme.
*   Implement new statistics: Top 10 most valuable and least valuable collection items (including artwork).
*   Refine the dashboard layout for a "sleek" appearance.
*   Add a scheduled background job (daily) for syncing collection data and values, using self-hosted open-source tools suitable for Docker deployment.

---

**Phase 1: Backend Development (API, Data Logic, Scheduling)**

1.  **Database Schema Review & Update:**
    *   **Action:** Examine current schema (Prisma).
    *   **Goal:** Add fields like `condition` (String, optional), `suggested_value` (Decimal, optional), `last_value_check` (DateTime) to the item model if not present.
    *   **Files:** `src/lib/db/index.ts` (or schema file).

2.  **Discogs API Client Enhancement:**
    *   **Action:** Add `fetchPriceSuggestions(releaseId)` function.
    *   **Goal:** Call `/marketplace/price_suggestions/{releaseId}`, handle errors, parse response.
    *   **Files:** `src/lib/discogs/client.ts`.

3.  **Collection Sync Logic Overhaul:**
    *   **Action:** Modify sync logic.
    *   **Goal:** For each item, fetch `release_id` & `condition`, call `fetchPriceSuggestions`, process results (match condition, default to Mint, handle nulls), update DB record with `condition`, `suggested_value`, `last_value_check`. Refactor logic into a reusable function.
    *   **Files:** `src/app/api/collection/sync/route.ts`, potentially a new `src/lib/syncLogic.ts`.

4.  **Dashboard Stats API Enhancement:**
    *   **Action:** Modify dashboard data endpoint.
    *   **Goal:** Query DB for items + values, calculate Top 10 most/least valuable, include necessary fields (title, artist, value, condition, artwork URL), add `topValuableItems` & `leastValuableItems` arrays to response.
    *   **Files:** `src/app/api/dashboard-stats/route.ts`.

5.  **Implement Scheduled Sync Job:**
    *   **Action:** Integrate `node-cron`.
    *   **Goal:** Add dependency (`npm install node-cron @types/node-cron`). Create scheduler script/integration (`src/lib/scheduler.ts` or similar). Configure daily cron job (e.g., `'0 2 * * *'`) to call the reusable sync logic. Ensure it runs within Docker.

---

**Phase 2: Frontend Development (UI, Layout, Components)**

1.  **Update Page Title:**
    *   **Action:** Change `<h1>` text.
    *   **Goal:** Display "Discogs Collection IQ".
    *   **Files:** `src/app/page.tsx`.

2.  **Apply Grayscale Theme:**
    *   **Action:** Replace existing Tailwind colors with `neutral` palette equivalents (`bg-neutral-900/800`, `text-neutral-100/400`, etc.) *excluding* charts/artwork.
    *   **Goal:** Consistent grayscale UI.
    *   **Files:** `src/app/globals.css`, `src/app/page.tsx`, various components.

3.  **Update Chart Colors:**
    *   **Action:** Define a vibrant color palette for charts. Update chart components to use these colors.
    *   **Goal:** Colorful, sleek charts on dark background.
    *   **Files:** `src/components/TimeSeriesChart.tsx`, `src/components/DistributionPieChart.tsx`.

4.  **Create Value List Components:**
    *   **Action:** Develop `ValuableItemsList.tsx` component.
    *   **Goal:** Reusable component accepting `title` and `items` (artwork, title, artist, condition, value), rendering a styled list using the `neutral` theme.
    *   **Files:** `src/components/ValuableItemsList.tsx`.

5.  **Redesign Dashboard Layout:**
    *   **Action:** Modify `page.tsx` structure and styling.
    *   **Goal:** Fetch enhanced data, integrate two `ValuableItemsList` instances, rearrange *all* elements (KPIs, charts, lists) using Tailwind grid for a balanced, sleek layout.
    *   **Files:** `src/app/page.tsx`.

6.  **Refine Overall Styling:**
    *   **Action:** Adjust fonts, spacing, borders, shadows.
    *   **Goal:** Enhance visual polish, inspired by Spotify aesthetic.
    *   **Files:** Various components, `globals.css`.

---

**Phase 3: Dockerization**

1.  **Update `Dockerfile`:**
    *   **Action:** Modify Dockerfile.
    *   **Goal:** Ensure correct dependency installation (incl. `node-cron`), build app, define `CMD`/`ENTRYPOINT` to start *both* Next.js server *and* `node-cron` scheduler process (e.g., via startup script or `pm2-runtime`).

---

**Diagram: High-Level Flow**

```mermaid
graph TD
    subgraph Browser (Frontend)
        F1[Dashboard Page (page.tsx)] -- Fetches data --> B1[/api/dashboard-stats]
        F2[Sync Button] -- Triggers --> B2[/api/collection/sync]
        F3[Settings Modal]
        F4[Charts]
        F5[Value Lists]
        F1 --> F4 & F5 & Other Components
    end

    subgraph Server (Backend - Docker Container)
        B1 -- Reads --> DB[(Local Database)]
        B2 -- Reads/Writes --> DB
        B2 -- Calls --> DAPI[Discogs API /collection]
        B2 -- Calls --> PriceAPI[Discogs API /price_suggestions]

        subgraph Scheduler
            S1(node-cron) -- Triggers daily --> SyncLogic[Sync Function]
        end

        SyncLogic -- Reads/Writes --> DB
        SyncLogic -- Calls --> DAPI
        SyncLogic -- Calls --> PriceAPI

        B2 -- Calls --> SyncLogic

        NextApp[Next.js App Server] --> B1 & B2
        SchedulerProcess[Node Process for Scheduler] --> S1
    end

    subgraph External
        DAPI
        PriceAPI
    end

    DB -- Stores --> UserData[User Collection Data]
    DB -- Stores --> ValueData[Item Conditions & Values]