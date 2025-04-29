module.exports = {
  apps : [{
    name   : "next-app",
    script : "npm",
    args   : "run start",
    env_production: {
       NODE_ENV: "production"
    },
    // Optional: Add more configuration like instances, exec_mode, etc.
    // instances : "max",
    // exec_mode : "cluster"
  }, {
    name   : "scheduler",
    script : "/app/dist-scripts/src/lib/scheduler.js", // Correct absolute path based on tsc output structure
    interpreter: "node", // Explicitly tell PM2 to use node
    watch  : false, // No need to watch usually, restart handled by deployment
    env_production: {
       NODE_ENV: "production"
    }
  }]
}