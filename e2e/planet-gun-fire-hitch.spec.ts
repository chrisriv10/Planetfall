import {test,expect} from "@playwright/test";
import {PG_BALANCE,PG_WEAPONS} from "@planetfall/shared";
import {writeFile} from "node:fs/promises";
import {selectExperimentalFamily} from "./select-family";

test.use({channel:"chromium"});
test("a single Photon trigger survives a stalled render frame without an extra shot",async({page},info)=>{
 const emissions:{observedAgeMs:number;clientTime:number;sequence:number}[]=[];
 page.on("websocket",socket=>socket.on("framesent",event=>{
  const payload=String(event.payload);if(!payload.startsWith('42["pg:weapon:fire"'))return;
  const [,shot]=JSON.parse(payload.slice(2));emissions.push({observedAgeMs:Date.now()-shot.clientTime,clientTime:shot.clientTime,sequence:shot.sequence});
 }));
 // Reproduce a render stall after an ordinary canvas trigger. The original
 // RAF timestamp is intentionally preserved; inputs and authority are real.
 await page.addInitScript(()=>{
  const raf=window.requestAnimationFrame.bind(window);let pending=false,used=false;
  const diagnostic={frames:0,lagMs:0};Object.assign(window,{__PG_HITCH_REVIEW__:diagnostic});
  addEventListener("mousedown",e=>{if(e.button===0&&e.target instanceof HTMLCanvasElement)pending=true;},true);
  window.requestAnimationFrame=callback=>raf(timestamp=>{
   if(pending&&!used){used=true;const until=performance.now()+350;while(performance.now()<until){}diagnostic.frames++;diagnostic.lagMs=performance.now()-timestamp;}
   callback(timestamp);
  });
 });
 await page.goto("/");await page.getByLabel("Name",{exact:true}).fill("Hitch Pilot");await selectExperimentalFamily(page,"planet-gun");await page.locator("#create-room").click();await page.locator("#pg-fill").uncheck();const code=await page.locator("#pg-code").innerText();
 const observer=await page.context().newPage();await observer.goto("/");await observer.getByLabel("Name",{exact:true}).fill("Hitch Observer");await selectExperimentalFamily(observer,"planet-gun");await observer.locator("#room-code").fill(code);await observer.locator("#join-room").click();await expect(observer.locator("#pg-lobby-screen")).toBeVisible();await observer.locator("#pg-ready").click();
 await page.locator("#pg-loadout").selectOption("photon");await page.locator("#pg-ready").click();await page.locator("#pg-start").click();await page.bringToFront();
 const state=()=>page.evaluate(()=>(window as unknown as {__PLANETFALL_PG_DEBUG__:()=>any}).__PLANETFALL_PG_DEBUG__());
 await expect.poll(async()=>(await state())?.phase).toBe("playing");await page.mouse.move(640,360);await page.mouse.down({button:"right"});await expect.poll(async()=>(await state()).ads).toBeGreaterThan(.99);
 const before=(await state()).local.guns[0];
 try{
  await page.mouse.down();await expect.poll(async()=>(await state()).local.guns[0].magazine).toBe(before.magazine-1);
  await page.waitForTimeout(850);expect((await state()).local.guns[0].shots).toBe(before.shots+1);
  expect(emissions).toHaveLength(1);
  // DevTools delivery may lag behind the actual network send. The gun's
  // authoritative cooldown records the real server acceptance instant.
  const acceptedAt=(await state()).local.guns[0].nextFireAt-PG_WEAPONS.photon.intervalMs,age=acceptedAt-emissions[0].clientTime;
  expect(age).toBeLessThan(PG_BALANCE.rewindMs);expect(age).toBeGreaterThanOrEqual(-50);
 }finally{
  await page.mouse.up();await page.mouse.up({button:"right"});const hitch=await page.evaluate(()=>(window as unknown as {__PG_HITCH_REVIEW__:{frames:number;lagMs:number}}).__PG_HITCH_REVIEW__);
  await writeFile(info.outputPath("fire-hitch.json"),JSON.stringify({hitch,emissions,gun:(await state()).local.guns[0]},null,2));expect(hitch.frames).toBe(1);expect(hitch.lagMs).toBeGreaterThan(300);await observer.close();
 }
});

test("Photon firing keeps a fresh server clock when gameplay snapshots are delayed",async({page},info)=>{
 let delayed=0,stopping=false;const timers=new Set<ReturnType<typeof setTimeout>>(),shots:{clientTime:number;observedAgeMs:number}[]=[];
 await page.routeWebSocket("**/socket.io/**",route=>{
  const server=route.connectToServer();server.onMessage(message=>{
   if(stopping)return;
   if(typeof message==="string"&&message.startsWith('42["pg:match:snapshot"')){delayed++;const timer=setTimeout(()=>{timers.delete(timer);if(!stopping)route.send(message);},300);timers.add(timer);}else route.send(message);
  });
 });
 page.on("websocket",socket=>socket.on("framesent",event=>{const text=String(event.payload);if(text.startsWith('42["pg:weapon:fire"')){const [,shot]=JSON.parse(text.slice(2));shots.push({clientTime:shot.clientTime,observedAgeMs:Date.now()-shot.clientTime});}}));
 await page.goto("/");await page.getByLabel("Name",{exact:true}).fill("Delayed Pilot");await selectExperimentalFamily(page,"planet-gun");await page.locator("#create-room").click();await page.locator("#pg-fill").uncheck();const code=await page.locator("#pg-code").innerText();
 const observer=await page.context().newPage();await observer.goto("/");await observer.getByLabel("Name",{exact:true}).fill("Clock Observer");await selectExperimentalFamily(observer,"planet-gun");await observer.locator("#room-code").fill(code);await observer.locator("#join-room").click();await expect(observer.locator("#pg-lobby-screen")).toBeVisible();await observer.locator("#pg-ready").click();
 await page.locator("#pg-loadout").selectOption("photon");await page.locator("#pg-ready").click();await page.locator("#pg-start").click();await page.bringToFront();
 const state=()=>page.evaluate(()=>(window as unknown as {__PLANETFALL_PG_DEBUG__:()=>any}).__PLANETFALL_PG_DEBUG__());
 try{await expect.poll(async()=>(await state())?.phase).toBe("playing");await page.mouse.move(640,360);await page.mouse.down();await expect.poll(async()=>(await state()).local.guns[0].magazine).toBe(6);expect((await state()).local.guns[0].shots).toBe(1);expect(delayed).toBeGreaterThan(10);}
 finally{await page.mouse.up();await writeFile(info.outputPath("delayed-snapshot-clock.json"),JSON.stringify({delayedSnapshots:delayed,shots,gun:(await state()).local.guns[0]},null,2));stopping=true;for(const timer of timers)clearTimeout(timer);await observer.close();}
});
