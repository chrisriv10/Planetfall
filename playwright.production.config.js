import {defineConfig} from "@playwright/test";
const origin="http://127.0.0.1:15175";

export default defineConfig({
  testDir:"./e2e",
  testMatch:"planet-gun-production.spec.ts",
  outputDir:"test-results/production",
  timeout:90_000,
  expect:{timeout:15_000},
  use:{channel:"chromium",headless:true,baseURL:origin},
  webServer:{
    command:"npm run build && node e2e/fixtures/production-preview.mjs",
    url:`${origin}/health`,
    env:{VITE_SERVER_URL:origin},
    reuseExistingServer:false,
    timeout:120_000,
    gracefulShutdown:{signal:"SIGTERM",timeout:5000},
  },
});
