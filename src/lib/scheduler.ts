import cron from 'node-cron';
import { runCollectionSync } from './syncLogic'; // Adjust path if necessary

console.log('Scheduler module loaded. Setting up cron job...');

// Schedule the sync task to run every day at 2:00 AM
// Cron format: second minute hour day-of-month month day-of-week
// '0 2 * * *' means: 0th second, 2nd minute, every hour, every day of month, every month, every day of week
const cronSchedule = '0 2 * * *';

console.log(`Scheduling collection sync with pattern: "${cronSchedule}"`);

cron.schedule(cronSchedule, async () => {
  console.log(`[${new Date().toISOString()}] Running scheduled collection sync...`);
  try {
    const result = await runCollectionSync();
    console.log(`[${new Date().toISOString()}] Scheduled sync finished successfully: ${result.message}`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Scheduled sync failed:`, error);
    // Consider adding more robust error reporting here (e.g., logging service, email)
  }
}, {
  scheduled: true,
  timezone: "Europe/Berlin" // Optional: Specify timezone, otherwise uses server timezone
});

console.log('Cron job scheduled successfully.');

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