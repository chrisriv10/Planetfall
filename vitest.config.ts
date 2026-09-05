import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["shared/src/**/*.test.ts", "server/src/**/*.test.ts"],
    testTimeout: 15_000,
    hookTimeout: 10_000,
    pool: "forks",
    maxWorkers: 1
  }
});
