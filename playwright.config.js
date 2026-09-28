import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: { baseURL: "http://127.0.0.1:15173", headless: true },
  webServer: [
    {
      command: "npm run build -w @planetfall/shared && npm run dev -w @planetfall/server",
      url: "http://127.0.0.1:13000/health",
      // The end-to-end raid drives two real WebGL clients through launch,
      // traversal, shove, sabotage and cannon play. Give the test match enough
      // lifecycle time to exercise those actions on software-rendered CI; the
      // individual interaction/assertion deadlines remain unchanged.
      env: { PORT: "13000", NODE_ENV: "test", CLIENT_ORIGIN: "http://127.0.0.1:15173", PLANETFALL_TEST_MATCH_MS: "165000" },
      reuseExistingServer: false,
      timeout: 60_000
    },
    {
      command: "npm run dev -w @planetfall/client -- --host 127.0.0.1 --port 15173",
      url: "http://127.0.0.1:15173",
      env: { VITE_SERVER_URL: "http://127.0.0.1:13000" },
      reuseExistingServer: false,
      timeout: 60_000
    }
  ]
});
