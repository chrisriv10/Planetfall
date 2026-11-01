import {test,expect} from "@playwright/test";
import {writeFile} from "node:fs/promises";
import {selectExperimentalFamily} from "./select-family";
test.use({channel:"chromium"});

for(const rtt of [0,40,80,120])test(`Watch local input and reconciliation with ${rtt}ms delayed WebSocket round trip`,async({page},info)=>{
 // Real browser and Socket.IO transport, with bounded ordered loopback delay.
 // This is latency emulation, not a claim about a remote WAN or packet loss.
 const timers=new Set<ReturnType<typeof setTimeout>>();let traffic=0;
 await page.routeWebSocket(/\/socket\.io\//,route=>{
  const server=route.connectToServer();let upload=0,download=0,serial=0;
  const delay=(send:()=>void,direction:"up"|"down")=>{
   const at=Date.now(),jitter=rtt?Math.sin(++serial*1.71)*7:0;
   const deadline=Math.max(at+rtt/2+jitter,direction==="up"?upload:download);
   if(direction==="up")upload=deadline;else download=deadline;
   const timer=setTimeout(()=>{timers.delete(timer);send();},Math.max(0,deadline-at));timers.add(timer);traffic++;
  };
  route.onMessage(message=>delay(()=>server.send(message),"up"));
  server.onMessage(message=>delay(()=>route.send(message),"down"));
 });
 try{
  await page.setViewportSize({width:960,height:540});await page.goto("/");await page.getByLabel("Name",{exact:true}).fill(`Latency ${rtt}`);await selectExperimentalFamily(page,"planet-gun");
  await page.locator("#settings-open").click();await page.locator("#graphics-quality").selectOption("low");await page.locator("#settings-close").click();
  await page.locator("#create-room").click();await page.getByLabel("PlanetGun submode").selectOption("planetwatch");await page.locator("#pg-target").selectOption("12");await page.locator("#pg-ready").click();await page.locator("#pg-start").click();
  const state=()=>page.evaluate(()=>(window as unknown as {__PLANETFALL_PG_DEBUG__:()=>any}).__PLANETFALL_PG_DEBUG__?.());
  await expect.poll(async()=>(await state())?.phase).toBe("playing");const before=await state();
  await page.keyboard.down("w");await page.waitForTimeout(50);const immediate=await state();await page.waitForTimeout(450);await page.keyboard.up("w");await page.waitForTimeout(1800);const settled=await state();
  expect(Math.hypot(immediate.local.position.x-before.local.position.x,immediate.local.position.z-before.local.position.z)).toBeGreaterThan(.01);
  expect(Math.hypot(settled.local.position.x-before.local.position.x,settled.local.position.z-before.local.position.z)).toBeGreaterThan(.5);
  expect(settled.pending).toBeLessThan(15);expect(Object.values(settled.local.position).every(v=>Number.isFinite(v as number))).toBe(true);
  expect(Math.hypot(...Object.values(settled.renderCorrection) as [number,number,number])).toBeLessThan(1.5);
  expect(traffic).toBeGreaterThan(100);if(rtt)expect(settled.network.rttMs).toBeGreaterThan(rtt*.5);
  const frames=settled.frameTimes.slice(-90).sort((a:number,b:number)=>a-b);
  await writeFile(info.outputPath(`latency-${rtt}.json`),JSON.stringify({scenario:"real WebSocket loopback with ordered half-RTT delay and ±7ms jitter",rtt,jitterMs:rtt?7:0,traffic,network:settled.network,immediateDisplacement:Math.hypot(immediate.local.position.x-before.local.position.x,immediate.local.position.z-before.local.position.z),pending:settled.pending,renderCorrection:settled.renderCorrection,p50FrameMs:frames[Math.floor(frames.length*.5)],p95FrameMs:frames[Math.floor(frames.length*.95)],calls:settled.calls,triangles:settled.triangles,players:settled.players},null,2));
 }finally{await page.close();for(const timer of timers)clearTimeout(timer);}
});
