"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_cron_1 = __importDefault(require("node-cron"));
const syncLogic_1 = require("./syncLogic"); // Adjust path if necessary
console.log('Scheduler module loaded. Setting up cron job...');
// Define the default cron schedule (daily at midnight)
const DEFAULT_CRON_SCHEDULE = '0 0 * * *';
// Read schedule from environment variable or use default
const effectiveCronSchedule = process.env.SYNC_CRON_SCHEDULE || DEFAULT_CRON_SCHEDULE;
if (process.env.SYNC_CRON_SCHEDULE) {
    console.log(`Using custom cron schedule from SYNC_CRON_SCHEDULE: "${effectiveCronSchedule}"`);
}
else {
    console.log(`Using default cron schedule: "${effectiveCronSchedule}". Set SYNC_CRON_SCHEDULE to override.`);
}
// Validate the cron schedule format (basic validation)
if (!node_cron_1.default.validate(effectiveCronSchedule)) {
    console.error(`[ERROR] Invalid cron schedule format provided: "${effectiveCronSchedule}". Scheduler will not run.`);
    // Optionally, exit or prevent scheduling if invalid
    // process.exit(1); // Uncomment to exit if the schedule is invalid
}
else {
    console.log(`Scheduling collection sync with pattern: "${effectiveCronSchedule}"`);
    node_cron_1.default.schedule(effectiveCronSchedule, async () => {
        const startTime = new Date();
        console.log(`[${startTime.toISOString()}] Cron job triggered. Starting collection sync...`);
        try {
            const result = await (0, syncLogic_1.runCollectionSync)();
            console.log(`[${new Date().toISOString()}] Scheduled sync finished successfully: ${result.message}`);
        }
        catch (error) {
            console.error(`[${new Date().toISOString()}] Scheduled sync failed:`, error);
            // Consider adding more robust error reporting here (e.g., logging service, email)
        } // End of try-catch block
    }, {
        scheduled: true,
        timezone: "Europe/Berlin" // Optional: Specify timezone, otherwise uses server timezone
    }); // End of cron.schedule call
    console.log('Cron job scheduled successfully.');
} // End of else block (for cron.validate)
// Keep the script running (important if run as a separate process)
// In a simple setup, this might not be needed if run alongside the main app process,
// but it doesn't hurt for clarity if run standalone.
// process.stdin.resume(); // Or use a more robust process manager like pm2
// Optional: Add graceful shutdown handling if needed
// process.on('SIGINT', () => {
//   console.log('Scheduler shutting down...');
//   // Perform any cleanup if necessary
//   process.exit(0);
// });
