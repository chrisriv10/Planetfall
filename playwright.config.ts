import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  use: { baseURL: "http://127.0.0.1:15173", headless: true },
  webServer: [
    {
      command: "npm run build -w @planetfall/shared && npm run dev -w @planetfall/server",
      url: "http://127.0.0.1:13000/health",
      env: { PORT: "13000", NODE_ENV: "test", CLIENT_ORIGIN: "http://127.0.0.1:15173", PLANETFALL_TEST_MATCH_MS: "70000" },
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
