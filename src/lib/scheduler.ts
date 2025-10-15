import cron from "node-cron";
import { runCollectionSync } from "./syncLogic";

const DEFAULT_CRON_SCHEDULE = "0 0 * * *";

export function setupScheduler() {
    console.log("Setting up cron job...");

    const effectiveCronSchedule = process.env.SYNC_CRON_SCHEDULE || DEFAULT_CRON_SCHEDULE;

    if (process.env.SYNC_CRON_SCHEDULE) {
        console.log(`Using custom cron schedule from SYNC_CRON_SCHEDULE: "${effectiveCronSchedule}"`);
    } else {
        console.log(`Using default cron schedule: "${effectiveCronSchedule}". Set SYNC_CRON_SCHEDULE to override.`);
    }

    if (!cron.validate(effectiveCronSchedule)) {
        console.error(
            `[ERROR] Invalid cron schedule format provided: "${effectiveCronSchedule}". Scheduler will not run.`,
        );

        return;
    }

    console.log(`Scheduling collection sync with pattern: "${effectiveCronSchedule}"`);

    cron.schedule(
        effectiveCronSchedule,
        async () => {
            const startTime = new Date();
            console.log(`[${startTime.toISOString()}] Cron job triggered. Starting collection sync...`);
            try {
                const result = await runCollectionSync();
                console.log(`[${new Date().toISOString()}] Scheduled sync finished successfully: ${result.message}`);
            } catch (error) {
                console.error(`[${new Date().toISOString()}] Scheduled sync failed:`, error);
            }
        },
        {
            scheduled: true,
            timezone: "Europe/Berlin",
        },
    );

    console.log("Cron job scheduled successfully.");
}

if (require.main === module) {
    console.log("Scheduler module loaded directly. Running setup...");
    setupScheduler();
} else {
    console.log("Scheduler module loaded as a dependency.");
}
