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
    script : "./dist-scripts/src/lib/scheduler.js", // Updated path for new outDir
    watch  : false, // No need to watch usually, restart handled by deployment
    env_production: {
       NODE_ENV: "production"
    }
  }]
}