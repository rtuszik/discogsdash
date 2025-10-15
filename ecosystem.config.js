module.exports = {
    apps: [
        {
            name: "next-app",
            script: "npm",
            args: "run start",
            env_production: {
                NODE_ENV: "production",
            },
        },
        {
            name: "scheduler",
            script: "/app/dist-scripts/src/lib/scheduler.js",
            interpreter: "node",
            watch: false,
            env_production: {
                NODE_ENV: "production",
            },
        },
    ],
};
