### Note

This project was the result of experimenting with Gemini 2.5 pro and autonomous agentic coding (Roocode).
The entire codebase was written by an LLM apart from some interventions where the LLM got stuck.

As a result of that, I do not plan on actively maintaining this project, though issues on bug reports are welcome.

# DiscogsDash - Your Personal Discogs Dashboard

DiscogsDash provides a personalized dashboard to visualize and analyze your Discogs music collection. Gain insights into your collection's value, distribution, and trends over time.

## First Look

![](screenshots/DiscogsDash_Mockup.png)

## Features

-   **Collection Overview:** See key statistics about your collection size and estimated value.
-   **Value Trends:** Track the estimated market value of your collection over time.
-   **Genre/Style Distribution:** Visualize the breakdown of your collection by genre and style.
-   **Most Valuable Items:** Quickly identify the most valuable records in your collection based on Discogs market data.
-   **Automatic Sync:** Keeps your dashboard updated with your latest Discogs collection changes (runs daily at 2am).
-   **Self-Hosted:** Run DiscogsDash on your own server using Docker.

## Quick Start (Docker Compose)

This is the recommended way to run DiscogsDash.

**Prerequisites:**

-   [Docker](https://docs.docker.com/get-docker/) installed.
-   [Docker Compose](https://docs.docker.com/compose/install/) installed.
-   A Discogs account.

**Steps:**

1.  **Create `docker-compose.yml`:**
    Create a file named `docker-compose.yml` on your system where you want to run the application.

2.  **Copy Content:**
    Copy the following content into your `docker-compose.yml` file:

    ```yaml
    version: "3.8"

    services:
        postgres:
            image: postgres:16-alpine
            container_name: discogsdash-postgres
            ports:
                - "5432:5432"
            volumes:
                - postgres-data:/var/lib/postgresql/data
            environment:
                - POSTGRES_USER=discogsdash
                - POSTGRES_PASSWORD=discogsdash_password # Change this in production!
                - POSTGRES_DB=discogsdash
            restart: unless-stopped
            healthcheck:
                test: ["CMD-SHELL", "pg_isready -U discogsdash"]
                interval: 10s
                timeout: 5s
                retries: 5

        discogsdash:
            image: ghcr.io/rtuszik/discogsdash:latest # Use the pre-built image
            container_name: discogsdash
            ports:
                - "3000:3000"
            environment:
                - DISCOGS_TOKEN=YOUR_DISCOGS_TOKEN_HERE # Replace with your actual token
                - DISCOGS_USERNAME=YOUR_DISCOGS_USERNAME_HERE # Replace with your Discogs username
                - DATABASE_URL=postgresql://discogsdash:discogsdash_password@postgres:5432/discogsdash
            depends_on:
                postgres:
                    condition: service_healthy
            restart: unless-stopped

    volumes:
        postgres-data:
    ```

3.  **Get Discogs Token & Username:**

    -   You need a **Discogs Personal Access Token**. Go to your Discogs [Developer Settings](https://www.discogs.com/settings/developers) and generate a new token. Copy it securely.
    -   You also need your **Discogs Username**.

    **In order to retrieve the suggested pricing for individual collection items, you need to fill out your [Discogs Seller Settings](https://www.discogs.com/settings/seller/)**

4.  **Configure:**
    Open the `docker-compose.yml` file you created and replace the placeholder values:

    -   Replace `YOUR_DISCOGS_TOKEN_HERE` with your actual Discogs Personal Access Token.
    -   Replace `YOUR_DISCOGS_USERNAME_HERE` with your Discogs username.
    -   **Important**: Change the PostgreSQL password (`discogsdash_password`) in both the `postgres` service and the `DATABASE_URL` for production use.

5.  **Run:**
    Navigate to the directory containing your `docker-compose.yml` file in your terminal and run:

    ```bash
    docker-compose up -d
    ```

    This command will pull the latest `discogsdash` image from the GitHub Container Registry and start the application container in the background.

6.  **Access:**
    Open your web browser and navigate to `http://localhost:3000`. If you are running Docker on a remote server, replace `localhost` with your server's IP address or domain name.

**Data Persistence:**

Your collection data is stored in PostgreSQL with a Docker volume named `postgres-data`. This ensures your data persists even if you stop, remove, or update the containers.

## Tech Stack

-   [Next.js](https://nextjs.org/) (React Framework)
-   [TypeScript](https://www.typescriptlang.org/)
-   [Tailwind CSS](https://tailwindcss.com/)
-   [Recharts](https://recharts.org/) (Charting Library)
-   [PostgreSQL](https://www.postgresql.org/) (Database)
-   [Node-Cron](https://github.com/node-cron/node-cron) (Scheduler)
-   [PM2](https://github.com/Unitech/pm2) (Process Manager within Docker)
-   [Docker](https://www.docker.com/) / [Docker Compose](https://docs.docker.com/compose/)

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

_Disclaimer: This project uses the Discogs API but is not affiliated with, sponsored, or endorsed by Discogs._
