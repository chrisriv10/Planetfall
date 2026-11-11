import {test,expect} from "@playwright/test";
import {writeFile} from "node:fs/promises";
import {selectExperimentalFamily,capturePgMouse,openLobbyConfiguration} from "./select-family";

test.use({channel:"chromium"});
test("browser pointer-lock loss releases held fire and ADS without needing mouseup",async({page},info)=>{
 const state=()=>page.evaluate(()=>(window as unknown as {__PLANETFALL_PG_DEBUG__:()=>any}).__PLANETFALL_PG_DEBUG__());
 await page.addInitScript(()=>{
  const events:any[]=[];(window as any).__CAPTURE_OBSERVATIONS__=events;
  const observe=(kind:string,event?:Event)=>{const s=(window as any).__PLANETFALL_PG_DEBUG__?.();events.push({at:performance.now(),kind,button:(event as MouseEvent)?.button,target:(event?.target as HTMLElement)?.id,locked:document.pointerLockElement?.id,focused:document.hasFocus(),blocked:s?.blocked,phase:s?.phase,ads:s?.ads,life:s?.local?.lifeId});if(events.length>300)events.shift();};
  for(const name of ["pointerlockchange","blur","focus","mousedown","mouseup","contextmenu","visibilitychange","focusin"])addEventListener(name,event=>observe(name,event),true);
  let previous="";const sample=()=>{const s=(window as any).__PLANETFALL_PG_DEBUG__?.(),signature=JSON.stringify([s?.blocked,s?.phase,s?.ads>.05,document.pointerLockElement?.id,document.hasFocus()]);if(signature!==previous){previous=signature;observe("state-change");}requestAnimationFrame(sample);};requestAnimationFrame(sample);
 });
 await page.goto("/");await page.getByLabel("Name",{exact:true}).fill("Capture Pilot");await selectExperimentalFamily(page,"planet-gun");
 await page.locator("#create-room").click();await openLobbyConfiguration(page);await page.locator("#pg-fill").uncheck();const code=await page.locator("#pg-code").innerText();
 const wing=await page.context().newPage();
 try{
  await wing.goto("/");await wing.getByLabel("Name",{exact:true}).fill("Capture Observer");await selectExperimentalFamily(wing,"planet-gun");await wing.locator("#room-code").fill(code);await wing.locator("#join-room").click();await wing.locator("#pg-ready").click();
  await page.locator("#pg-ready").click();await page.locator("#pg-start").click();await page.bringToFront();await expect.poll(async()=>(await state())?.phase).toBe("playing");
  await capturePgMouse(page);await page.mouse.down({button:"right"});await expect.poll(async()=>(await state()).ads).toBeGreaterThan(.95);
  // A late acquisition notification must not erase controls pressed after the
  // browser has already granted real capture. This replays notification timing,
  // not a player/server state change; the eventual loss below is native.
  await page.evaluate(()=>document.dispatchEvent(new Event("pointerlockchange")));await page.waitForTimeout(150);
  expect((await state()).ads,"late acquisition notification cleared held ADS").toBeGreaterThan(.95);
  await page.mouse.down();await expect.poll(async()=>(await state()).local.guns[0].shots).toBeGreaterThan(0);
  // Invoke the real browser capture lifecycle, independent of app pause/modal
  // handlers. This neither changes match state nor synthesizes a mouseup.
  await page.evaluate(()=>document.exitPointerLock());await expect.poll(()=>page.evaluate(()=>document.pointerLockElement===null)).toBe(true);
  await page.waitForTimeout(250);const settled=await state();await page.waitForTimeout(350);const after=await state();
  await writeFile(info.outputPath("capture-loss.json"),JSON.stringify({settled:{shots:settled.local.guns[0].shots,ads:settled.ads},after:{shots:after.local.guns[0].shots,ads:after.ads}},null,2));
  expect(after.local.guns[0].shots).toBe(settled.local.guns[0].shots);expect(after.ads).toBeLessThan(.01);
  await expect(page.locator(".pg-capture-hint")).toBeVisible();
 }finally{await writeFile(info.outputPath("capture-lifecycle-observations.json"),JSON.stringify({events:await page.evaluate(()=>(window as any).__CAPTURE_OBSERVATIONS__).catch(()=>null),state:await state().catch(()=>null)},null,2));await page.mouse.up();await page.mouse.up({button:"right"});await wing.close();}
});
