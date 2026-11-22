import base from "./playwright.config.js";

export default {
  ...base,
  testIgnore:[],
  projects:[{name:"career-account",testMatch:"career-account.spec.ts",use:{baseURL:"http://127.0.0.1:25173"}}],
  // Reuse the existing isolated provider/database. Only this new scenario's
  // match clock is 30 seconds, meeting genuine Career eligibility.
  webServer:base.webServer.slice(2).map((server,index)=>index===0?{...server,env:{...server.env,PLANETFALL_TEST_MATCH_MS:"30000"}}:server),
};
