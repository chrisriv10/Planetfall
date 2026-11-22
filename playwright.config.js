import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // These scenarios have dedicated clocks/persistence fixtures and commands.
  testIgnore: ["planet-gun-production.spec.ts","experience.spec.ts","career-account.spec.ts"],
  // The WebGL clients, authority and latency proxy share the local machine.
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  // Full Chromium uses the host graphics path where available. The separate
  // headless shell uses SwiftShader on the Windows release workstation.
  use: { channel: "chromium", headless: true },
  projects: [
    { name: "gameplay", testIgnore: ["accounts.spec.ts","planet-gun-production.spec.ts"], use: { baseURL: "http://127.0.0.1:15173" } },
    { name: "accounts", testMatch: "accounts.spec.ts", use: { baseURL: "http://127.0.0.1:25173" } },
  ],
  webServer: [
    {
      command: "npm run build -w @planetfall/shared && npm exec -- tsx server/src/index.ts",
      url: "http://127.0.0.1:13000/health",
      // The end-to-end raid drives two real WebGL clients through launch,
      // traversal, shove, sabotage and cannon play. Give the test match enough
      // lifecycle time to exercise those actions on software-rendered CI; the
      // individual interaction/assertion deadlines remain unchanged.
      env: { PORT: "13000", NODE_ENV: "test", CLIENT_ORIGIN: "http://127.0.0.1:15173", PLANETFALL_TEST_MATCH_MS: "165000", PLANETFALL_PR_REVIEW: "1" },
      reuseExistingServer: false,
      timeout: 60_000
    },
    {
      command: "npm run dev -w @planetfall/client -- --host 127.0.0.1 --port 15173",
      url: "http://127.0.0.1:15173",
      env: { VITE_SERVER_URL: "http://127.0.0.1:13000" },
      reuseExistingServer: false,
      timeout: 60_000
    },
    {
      command: "npm exec -- tsx e2e/fixtures/account-server.ts",
      url: "http://127.0.0.1:23000/health",
      env: { PORT: "23000", NODE_ENV: "test", CLIENT_ORIGIN: "http://127.0.0.1:25173", PLANETFALL_TEST_MATCH_MS: "7000" },
      reuseExistingServer: false,
      timeout: 60_000
    },
    {
      command: "npm run dev -w @planetfall/client -- --host 127.0.0.1 --port 25173",
      url: "http://127.0.0.1:25173",
      env: { VITE_SERVER_URL: "http://127.0.0.1:23000" },
      reuseExistingServer: false,
      timeout: 60_000
    }
  ]
});
