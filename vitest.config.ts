import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
    plugins: [react()],
    test: {
        globals: true,
        environment: "jsdom",
        setupFiles: ["./src/tests/setup.ts"],
        coverage: {
            provider: "v8",
            reporter: ["text", "json", "html"],
            reportsDirectory: "./coverage",
            include: ["src/**/*.{ts,tsx}"],
            exclude: [
                "src/tests/**",
                "src/mocks/**",
                "src/**/*.config.{js,ts}",
                "src/**/*.d.ts",
                "src/app/layout.tsx",
                "src/app/api/auth/**",
            ],
            thresholds: {
                lines: 70,
                functions: 70,
                branches: 70,
                statements: 70,
            },
        },
    },
});
