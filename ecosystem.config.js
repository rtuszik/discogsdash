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
    script : "./dist/lib/scheduler.js", // Path to the compiled scheduler script
    watch  : false, // No need to watch usually, restart handled by deployment
    env_production: {
       NODE_ENV: "production"
    }
  }]
}