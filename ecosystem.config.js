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
    script : "./dist/src/lib/scheduler.js", // Corrected path based on tsconfig outDir/rootDir
    watch  : false, // No need to watch usually, restart handled by deployment
    env_production: {
       NODE_ENV: "production"
    }
  }]
}