import {defineConfig} from "@playwright/test";
export default defineConfig({
  testDir:"./e2e",testMatch:"experience.spec.ts",workers:1,timeout:90_000,expect:{timeout:15_000},
  use:{baseURL:"http://127.0.0.1:25481",channel:"chromium",headless:true},
  webServer:[
    {command:"npm run build -w @planetfall/shared && npm run build -w @planetfall/server && node --import tsx e2e/fixtures/experience-supervisor.ts",url:"http://127.0.0.1:25480/health",env:{NODE_ENV:"test",PLANETFALL_TEST_MATCH_MS:"30000",PLANETFALL_EXPERIENCE_RUN:process.env.PLANETFALL_EXPERIENCE_RUN??String(Date.now())},reuseExistingServer:false,timeout:60_000},
    {command:"node ../node_modules/vite/bin/vite.js --configLoader native --host 127.0.0.1 --port 25481 --strictPort",cwd:"client",url:"http://127.0.0.1:25481",env:{VITE_SERVER_URL:"http://127.0.0.1:25480"},reuseExistingServer:false,timeout:60_000},
  ],
});
