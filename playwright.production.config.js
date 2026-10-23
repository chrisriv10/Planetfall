import {defineConfig} from "@playwright/test";
import base from "./playwright.config.js";

export default defineConfig({
 ...base,testMatch:"planet-gun-production.spec.ts",testIgnore:[],outputDir:"test-results/production",
 use:{...base.use,baseURL:"http://127.0.0.1:15175"},
 webServer:[
  {command:"npm run dev -w @planetfall/server",url:"http://127.0.0.1:13002/health",env:{PORT:"13002",NODE_ENV:"test",CLIENT_ORIGIN:"http://127.0.0.1:15175"},reuseExistingServer:false,timeout:60000},
  {command:`node --input-type=module -e "import {preview} from 'vite';await preview({root:'client',configFile:false,preview:{host:'127.0.0.1',port:15175,strictPort:true,proxy:{'/socket.io':{target:'http://127.0.0.1:13002',ws:true}}}})"`,url:"http://127.0.0.1:15175",reuseExistingServer:false,timeout:60000}
 ]
});
