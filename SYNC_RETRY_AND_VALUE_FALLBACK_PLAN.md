# Plan: Implement Sync Retry Logic and Value Fallback

## Goal

1.  Modify the Discogs API client to automatically retry requests that fail due to rate limiting (HTTP 429) or transient network errors, using exponential backoff.
2.  Modify the sync process to use the suggested value from the best available condition (in a preferred order) if the "Mint (M)" value is not present.
3.  Remove the inefficient manual delay currently used for rate limiting.

## Plan Details

1.  **Implement Retry Logic (`src/lib/discogs/client.ts`):**
    *   Modify the `makeDiscogsRequest` function.
    *   Introduce retry parameters (e.g., `maxRetries = 3`, `initialDelay = 1500ms`).
    *   Wrap the `fetch` call and response handling in a retry loop.
    *   **On `response.ok`:** Return success.
    *   **On `response.status === 429`:**
        *   Log a warning.
        *   If max retries not reached, calculate delay:
            *   Prefer `Retry-After` header value (in seconds * 1000).
            *   Otherwise, use exponential backoff + jitter: `delay = initialDelay * (2 ** attempt) + (Math.random() * 1000)`.
        *   Wait for the delay and continue the loop.
    *   **On Network Error (catch block):**
        *   Log the error.
        *   If max retries not reached, calculate delay using exponential backoff + jitter.
        *   Wait and continue the loop.
    *   **On Other `response.status` errors (4xx/5xx):** Throw immediately (do not retry).
    *   If loop finishes without success, throw a final error.

2.  **Implement Value Fallback Logic (`src/lib/syncLogic.ts`):**
    *   Locate the section within the sync loop where `fetchPriceSuggestions` is called (around lines 193-201).
    *   Define the preferred condition order: `const conditionOrder = ['Mint (M)', 'Near Mint (NM or M-)', 'Very Good Plus (VG+)', 'Very Good (VG)', 'Good Plus (G+)', 'Good (G)', 'Fair (F)', 'Poor (P)']`.
    *   After successfully getting `suggestions` from `fetchPriceSuggestions`:
        *   Initialize `itemSuggestedValue = null`.
        *   Loop through `conditionOrder`.
        *   For each `condition`, check if `suggestions[condition]` exists.
        *   If yes, set `itemSuggestedValue = suggestions[condition].value` and `break` the loop.
    *   Use the final `itemSuggestedValue` (which might still be `null` if no conditions were found) when inserting/replacing the item in the database.

3.  **Remove Manual Delay (`src/lib/syncLogic.ts`):**
    *   Delete or comment out the line `await new Promise(resolve => setTimeout(resolve, 1100));` (around line 204).

## Plan Diagram (Conceptual)

```mermaid
graph TD
    subgraph Sync Loop in syncLogic.ts
        A[For Each Release] --> B{Fetch Price Suggestions};
        B --> C{Suggestions Received?};
        C -- Yes --> D{Iterate Preferred Conditions (M, NM, VG+...)};
        D --> E{Condition Found in Suggestions?};
        E -- Yes --> F[Set itemSuggestedValue];
        E -- No --> D;
        D -- Loop End --> G[itemSuggestedValue is set or null];
        C -- No (Error) --> G;
        F --> G;
        G --> H[Insert/Replace DB Row];
    end

    subgraph Fetch Price Suggestions (makeDiscogsRequest in client.ts)
        I[Start Request] --> J{Retry Loop};
        J --> K{Attempt Fetch};
        K --> L{Handle Response (Success, 429, Other Error, Network Error)};
        L -- Success --> M[Return Suggestions];
        L -- 429/Network Error --> N{Calculate Delay & Retry};
        N --> J;
        L -- Other Error --> O[Throw Error];
        J -- Max Retries --> O;
    end

    B --> I;
    M --> C;
    O --> C;

    P[Remove Manual Delay] --> A;

```

## Implementation

Switch to 'Code' mode to apply these changes to `src/lib/discogs/client.ts` and `src/lib/syncLogic.ts`.