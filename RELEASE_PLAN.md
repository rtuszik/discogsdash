# DiscogsDash GitHub Release Plan

This document outlines the steps to prepare the `discogsdash` project for a public release on GitHub, including self-hosting configuration, documentation updates, and automated Docker image publishing.

## Phase 1: Configuration & Documentation

1.  **Create `docker-compose.yml`:**
    *   Define a service named `discogsdash`.
    *   Build the image using the existing `Dockerfile`.
    *   Map container port 3000 to host port 3000.
    *   Define a named volume (`discogsdash-data`) and mount it to `/app/.db` inside the container to persist the SQLite database.
    *   Configure it to read the `DISCOGS_TOKEN` from a `.env` file in the project root.
    *   Set the `restart` policy to `unless-stopped`.

2.  **Update `README.md`:**
    *   Replace the default Next.js content with project-specific information:
        *   **Title & Description:** What is DiscogsDash?
        *   **Features:** Key functionalities.
        *   **Tech Stack:** Next.js, TypeScript, SQLite, etc.
        *   **(Optional) Screenshots:** Visual examples.
        *   **Configuration:** Explain the need for `DISCOGS_TOKEN` and link to Discogs settings for token generation.
        *   **Development:** Update instructions, mention using `.env.local` for the token during development.
        *   **Self-Hosting (Docker Compose):** Add clear instructions:
            *   Prerequisites (Docker, Docker Compose).
            *   Clone repository.
            *   Create a `.env` file with `DISCOGS_TOKEN=your_token_here`.
            *   Run `docker-compose up -d`.
            *   Explain data persistence via the volume.
        *   **License:** Add an appropriate open-source license (e.g., MIT).

3.  **Update Discogs Client:**
    *   Modify `src/lib/discogs/client.ts` to use a more specific `User-Agent` string: `DiscogsDash/0.1 (+https://github.com/rtuszik/discogsdash)`.

## Phase 2: Automation

4.  **Create GitHub Actions Workflow (`.github/workflows/publish.yml`):**
    *   **Trigger:** On pushes to the `main` branch.
    *   **Job:** `build-and-push`
        *   **Runner:** `ubuntu-latest`
        *   **Steps:**
            *   Checkout code.
            *   Set up QEMU (for multi-arch).
            *   Set up Docker Buildx.
            *   Log in to GitHub Container Registry (ghcr.io) using the default `GITHUB_TOKEN`.
            *   Extract metadata (tags like `latest` and commit SHA).
            *   Build the Docker image using the existing `Dockerfile`.
            *   Push the image to `ghcr.io/rtuszik/discogsdash` with tags for `linux/amd64` and `linux/arm64` architectures.

## Visualization

```mermaid
graph TD
    A[Push to main branch on GitHub] --> B{GitHub Actions Workflow};
    B --> C[Checkout Code];
    C --> D[Setup Buildx & QEMU];
    D --> E[Login to GHCR];
    E --> F[Build Multi-Arch Docker Image];
    F -- linux/amd64, linux/arm64 --> G[Push Image to ghcr.io/rtuszik/discogsdash];

    H[User Clones Repo] --> I[Create .env file with DISCOGS_TOKEN];
    I --> J[Run `docker-compose up -d`];
    J --> K[Pulls/Builds Image];
    K --> L[Starts Container];
    L -- Mounts Volume --> M[(Persistent SQLite DB)];
    L -- Reads .env --> N{DiscogsDash App};
    N -- Uses Token --> O[Discogs API];

    P[Developer Clones Repo] --> Q[Create .env.local with DISCOGS_TOKEN];
    Q --> R[Run `npm run dev`];
    R --> S{Local Dev Server};
    S -- Uses Token --> O;

    T[Update README.md]
    U[Create docker-compose.yml]
    V[Update src/lib/discogs/client.ts]
    W[Create .github/workflows/publish.yml]

    subgraph "Local Self-Hosting"
        H; I; J; K; L; M; N; O;
    end

    subgraph "Local Development"
        P; Q; R; S;
    end

    subgraph "CI/CD"
        A; B; C; D; E; F; G;
    end

    subgraph "Project Files"
        T; U; V; W;
    end