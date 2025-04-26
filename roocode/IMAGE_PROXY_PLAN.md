# Plan: Resolve Discogs Image Loading Issue via API Proxy

## Problem

Remote artwork images from `i.discogs.com` are not loading in the Dockerized Next.js application when accessed locally via HTTP. The browser shows a broken image placeholder, not the fallback specified in the code.

## Investigation Summary

1.  **`next.config.ts`:** Correctly configured `remotePatterns` for `https://i.discogs.com`. No options to set fetch headers.
2.  **Frontend (`ValuableItemsList.tsx`):** Uses Next.js `Image` component correctly with `item.cover_image_url` and a fallback. The fallback isn't shown, indicating the URL is present but failing to load.
3.  **API (`/api/dashboard-stats`):** Correctly fetches `cover_image_url` from the database.
4.  **Dockerfile & `docker-compose.yml`:** No obvious network restrictions.
5.  **Container Connectivity Test (`wget -S -O /dev/null https://i.discogs.com`):**
    *   Successfully resolved DNS and connected to `i.discogs.com`.
    *   Received an `HTTP/1.1 302 Moved Temporarily` redirect to `https://www.discogs.com`.
    *   Following the redirect resulted in `HTTP/1.1 403 Forbidden`.

## Diagnosis

The container can reach the image server, but the server redirects the request. This strongly suggests the Next.js server's internal request (used for image optimization) lacks the necessary headers (likely `User-Agent`) required by `i.discogs.com`, causing the redirect/failure.

## Solution: API Proxy Route

Since directly controlling the Next.js image optimizer's fetch headers isn't feasible, we will create an API proxy route.

1.  **Create API Proxy Route (`/api/image-proxy/route.ts`):**
    *   Accept the target Discogs image URL (`url`) as a query parameter.
    *   Use the server-side `fetch` API to request the image from the provided `url`.
    *   **Crucially, set a standard `User-Agent` header** in the `fetch` request (e.g., `User-Agent: Mozilla/5.0 ...`).
    *   Validate the fetched response (check status code).
    *   Stream the fetched image data back as the API response, copying relevant headers (`Content-Type`, `Content-Length`, `Cache-Control`).
2.  **Update Frontend Component (`src/components/ValuableItemsList.tsx`):**
    *   Modify the `src` prop of the `Image` component.
    *   Instead of `src={item.cover_image_url}`, use `src={\`/api/image-proxy?url=\${encodeURIComponent(item.cover_image_url || PLACEHOLDER_IMAGE)}\`}`. Ensure the placeholder is also proxied if the original URL is null.
3.  **Implementation:** Switch to 'Code' mode to create the new API route file and modify the frontend component.

## Plan Diagram

```mermaid
graph TD
    A[Start: Images Not Loading] --> B{Config & Code Review};
    B -- OK --> C{Test Container Connectivity};
    C -- Output: 302 Redirect & 403 --> D{Hypothesis: Missing User-Agent in Next.js Fetch};
    D --> E{Re-check next.config.ts Images Section};
    E -- No Header Options Found --> F(Final Plan: Create API Proxy Route);
    F --> G{Implement Proxy Route (Needs Code Mode)};
    G --> H{Update Frontend Component (Needs Code Mode)};
    H --> I{Switch to Code Mode};
    I --> J[End: Resolution];