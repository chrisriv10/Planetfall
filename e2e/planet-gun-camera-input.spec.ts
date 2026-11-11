import {test,expect} from "@playwright/test";
import {writeFile} from "node:fs/promises";
import {selectExperimentalFamily,openLobbyConfiguration} from "./select-family";

test.use({channel:"chromium"});
// Real room, ordinary roster and browser events. This checks capture ownership
// and direct mouse application, not human responsiveness or WAN performance.
for(const mode of ["deathmatch","planetstrike","planetwatch","planetsiege","planetzombies"] as const)
for(const rtt of [0,40,80,120])test(`${mode}: captured mouse and UI recapture at ${rtt}ms ordered RTT`,async({page},info)=>{
 const timers=new Set<ReturnType<typeof setTimeout>>();let stopping=false,serial=0,delayed=false,delayNextSnapshot=false;
 if(rtt)await page.routeWebSocket(/socket\.io/,route=>{
  const server=route.connectToServer();let upload=0,download=0;
  const relay=(message:string|Buffer,up:boolean)=>{
   const now=Date.now(),jitter=Math.sin(++serial*1.71)*7;
   const stall=!up&&delayNextSnapshot&&typeof message==="string"&&message.includes('"pg:match:snapshot"')?250:0;
   if(stall){delayNextSnapshot=false;delayed=true;}
   const at=Math.max(now+rtt/2+jitter+stall,up?upload:download);
   if(up)upload=at;else download=at;
   const timer=setTimeout(()=>{timers.delete(timer);if(stopping)return;try{if(up)server.send(message);else route.send(message);}catch{}},Math.max(0,at-now));timers.add(timer);
  };
  route.onMessage(message=>relay(message,true));server.onMessage(message=>relay(message,false));
 });
 const state=()=>page.evaluate(()=>(window as unknown as {__PLANETFALL_PG_DEBUG__:()=>any}).__PLANETFALL_PG_DEBUG__());
 try{
  await page.goto("/");await page.getByLabel("Name",{exact:true}).fill(`Camera ${rtt}`);
  await page.locator("#settings-open").click();await page.locator("#graphics-quality").selectOption("low");await page.locator("#settings-close").click();
  await selectExperimentalFamily(page,"planet-gun");await page.locator("#create-room").click();
  await page.getByLabel("PlanetGun submode").selectOption(mode);await openLobbyConfiguration(page);await page.locator("#pg-target").selectOption(mode==="planetzombies"?"4":"12");
  await page.locator("#pg-ready").click();await page.locator("#pg-start").click();await expect.poll(async()=>(await state())?.phase).toBe("playing");
  const beforeCapture=await state(),shots=beforeCapture.local.guns[beforeCapture.local.slot].shots;
  await page.locator("#game-canvas").click({position:{x:640,y:360}});
  await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe("game-canvas");
  await page.waitForTimeout(150);expect((await state()).local.guns[beforeCapture.local.slot].shots).toBe(shots);
  const before=await state();await page.mouse.move(740,350,{steps:3});
  await expect.poll(async()=>(await state()).movement.mouseEvents.length).toBeGreaterThan(before.movement.mouseEvents.length);
  const after=await state(),events=after.movement.mouseEvents.slice(before.movement.mouseEvents.length);
  expect(events.every((e:any)=>e.locked)).toBe(true);
  expect(events.reduce((n:number,e:any)=>n+e.dx,0)).toBe(100);
  expect(after.movement.camera.controlYaw-before.movement.camera.controlYaw).toBeCloseTo(-.22,5);
  expect(after.movement.camera.yaw).toBeCloseTo(after.movement.camera.controlYaw,8);
  expect(after.movement.camera.pitch).toBeCloseTo(after.movement.camera.controlPitch,8);
  // A delayed snapshot must not take ownership of mouse orientation.
  delayNextSnapshot=true;await page.mouse.move(640,360,{steps:3});await page.waitForTimeout(400);
  const reversed=await state();expect(reversed.movement.camera.controlYaw).toBeCloseTo(before.movement.camera.controlYaw,5);
  await page.keyboard.press("Escape");await expect(page.locator("#resume-button")).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>document.pointerLockElement===null)).toBe(true);
  const paused=await state();await page.mouse.move(800,400);await page.waitForTimeout(100);
  expect((await state()).movement.camera.controlYaw).toBe(paused.movement.camera.controlYaw);
  await page.locator("#resume-button").click();const beforeRecapture=await state();
  await page.locator("#game-canvas").click({position:{x:640,y:360}});await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe("game-canvas");
  await page.waitForTimeout(150);const recaptured=await state();
  expect(recaptured.local.guns[recaptured.local.slot].shots).toBe(beforeRecapture.local.guns[beforeRecapture.local.slot].shots);
  expect(recaptured.movement.camera.controlYaw).toBe(beforeRecapture.movement.camera.controlYaw);
  expect(recaptured.movement.camera.owner).toBe("local");
  expect(recaptured.players).toBe(mode==="planetzombies"?4:12);
  if(rtt){expect(delayed).toBe(true);expect(recaptured.network.rttMs).toBeGreaterThanOrEqual(rtt/2);}
  await writeFile(info.outputPath("camera-input.json"),JSON.stringify({mode,addedRttMs:rtt,jitterMs:rtt?7:0,delayedSnapshot:delayed,network:recaptured.network,movement:recaptured.movement,profile:recaptured.profile},null,2));
  await page.keyboard.press("Escape");await page.locator("#pause-leave").click();await expect(page.locator("#home-screen")).toBeVisible();
 }finally{stopping=true;await page.close();for(const timer of timers)clearTimeout(timer);}
});
