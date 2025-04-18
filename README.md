# DiscogsDash - Your Personal Discogs Dashboard

DiscogsDash provides a personalized dashboard to visualize and analyze your Discogs music collection. Gain insights into your collection's value, distribution, and trends over time.

## Features

*   **Collection Overview:** See key statistics about your collection size and estimated value.
*   **Value Trends:** Track the estimated market value of your collection over time.
*   **Genre/Style Distribution:** Visualize the breakdown of your collection by genre and style.
*   **Most Valuable Items:** Quickly identify the most valuable records in your collection based on Discogs market data.
*   **Automatic Sync:** Keeps your dashboard updated with your latest Discogs collection changes (runs periodically).
*   **Self-Hosted:** Run DiscogsDash on your own server using Docker.

## Tech Stack

*   [Next.js](https://nextjs.org/) (React Framework)
*   [TypeScript](https://www.typescriptlang.org/)
*   [Tailwind CSS](https://tailwindcss.com/)
*   [Recharts](https://recharts.org/) (Charting Library)
*   [SQLite](https://www.sqlite.org/index.html) (Database)
*   [Node-Cron](https://github.com/node-cron/node-cron) (Scheduler)
*   [PM2](https://pm2.keymetrics.io/) (Process Manager within Docker)
*   [Docker](https://www.docker.com/) / [Docker Compose](https://docs.docker.com/compose/)

## Configuration

DiscogsDash requires a **Discogs Personal Access Token** to access your collection data via the Discogs API.

1.  Go to your Discogs [Developer Settings](https://www.discogs.com/settings/developers).
2.  Generate a new Personal Access Token.
3.  Copy this token. You will need it for both development and self-hosting setups.

**Important:** Keep your token secure and do not commit it directly into your repository.

## Development Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/rtuszik/discogsdash.git
    cd discogsdash
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Create a local environment file:**
    Create a file named `.env.local` in the project root.
4.  **Add your Discogs token to `.env.local`:**
    ```env
    DISCOGS_TOKEN=your_discogs_personal_access_token_here
    ```
5.  **Run the development server:**
    ```bash
    npm run dev
    ```
6.  Open [http://localhost:3000](http://localhost:3000) in your browser.

## Self-Hosting (Docker Compose)

1.  **Prerequisites:**
    *   [Docker](https://docs.docker.com/get-docker/) installed.
    *   [Docker Compose](https://docs.docker.com/compose/install/) installed.
2.  **Clone the repository:**
    ```bash
    git clone https://github.com/rtuszik/discogsdash.git
    cd discogsdash
    ```
3.  **Configure `docker-compose.yml`:**
    Open the `docker-compose.yml` file and replace the placeholder values in the `environment` section with your actual Discogs token and username:
    ```yaml
    services:
      discogsdash:
        # ... other settings
        environment:
          - DISCOGS_TOKEN=YOUR_DISCOGS_TOKEN_HERE # <-- Replace this
          - DISCOGS_USERNAME=YOUR_DISCOGS_USERNAME_HERE # <-- Replace this
        # ... other settings
    ```
4.  **Start the application:**
    ```bash
    docker-compose up -d
    ```
    This command will build the Docker image (if not already built) and start the DiscogsDash container in the background.
6.  Access the application at `http://<your-server-ip>:3000`.

**Data Persistence:** Your collection data (SQLite database) is stored in a Docker volume named `discogsdash-data`. This ensures your data persists even if you stop and remove the container.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details (You may need to create this file if one doesn't exist).

---

*Disclaimer: This project uses the Discogs API but is not affiliated with, sponsored, or endorsed by Discogs.*
