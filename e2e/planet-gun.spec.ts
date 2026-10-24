import {test,expect,type Page} from "@playwright/test";
import {selectExperimentalFamily} from "./select-family";
import {writeFile} from "node:fs/promises";
// Read live, read-only DEV diagnostics: the DOM output refreshes only every
// 500ms, which can steer corrective key pulses from an obsolete position.
const state=(page:Page)=>page.evaluate(()=>(window as unknown as {__PLANETFALL_PG_DEBUG__?:()=>any}).__PLANETFALL_PG_DEBUG__?.());

test("PlanetGun warning, lobby, FPS movement, combat controls and clean exit",async({page},info)=>{
 const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
 await page.goto("/");await page.getByLabel("Name",{exact:true}).fill("Nova Pilot");await selectExperimentalFamily(page,"planet-gun");
 await page.locator("#create-room").click();await expect(page.locator("#pg-lobby-screen")).toBeVisible();
 await page.mouse.click(1200,300);expect(await page.evaluate(()=>document.pointerLockElement===null)).toBe(true);
 await page.locator("#pg-target").selectOption("4");await page.locator("#pg-loadout").selectOption("nova");
 await page.locator("#pg-ready").click();await page.locator("#pg-start").click();
 await expect.poll(async()=>(await state(page))?.phase).toBe("playing");
 const before=(await state(page)).local.position;await page.keyboard.down("w");await page.waitForTimeout(700);await page.keyboard.up("w");
 await expect.poll(async()=>{const p=(await state(page)).local.position;return Math.hypot(p.x-before.x,p.z-before.z);}).toBeGreaterThan(2);
 await page.keyboard.down("Space");await page.waitForTimeout(300);await page.keyboard.up("Space");await expect.poll(async()=>(await state(page)).local.position.y).toBeGreaterThan(.6);
 await page.mouse.move(700,400);await page.mouse.down();await page.waitForTimeout(350);await page.mouse.up();
 await expect.poll(async()=>(await state(page)).local.guns[0].magazine).toBeLessThan(36);await page.screenshot({path:info.outputPath("pre-reload.png")});
 await page.keyboard.down("Control");await page.keyboard.press("r");await page.keyboard.up("Control");await expect(page.locator("#pg-ammo")).toContainText("RELOADING");
 await page.keyboard.press("2");await expect(page.locator("#pg-ammo")).toContainText("Comet");
 await page.keyboard.down("Shift");await page.keyboard.down("w");await expect.poll(async()=>(await state(page)).local.mode).toBe("sprint");await page.mouse.click(700,400);await page.keyboard.up("Shift");await page.keyboard.up("w");await expect.poll(async()=>(await state(page)).local.guns[1].magazine).toBeLessThan(9);
 await page.keyboard.press("Escape");await expect(page.locator("#pause-overlay")).toBeVisible();expect(await page.evaluate(()=>document.pointerLockElement===null)).toBe(true);
 await page.locator("#resume-button").click();await page.keyboard.press("Tab");await expect(page.locator("#pg-scoreboard")).toBeVisible();await expect.poll(async()=>(await state(page)).blocked).toBe(true);
 await page.locator("#pg-scoreboard-close").click();await page.screenshot({path:info.outputPath("nova-block-fps.png")});
 await page.keyboard.press("Escape");await page.locator("#pause-leave").click();await expect(page.locator("#home-screen")).toBeVisible();await expect(page.locator("#pg-hud")).toBeHidden();
 await page.locator("#family-planetfall").click();await page.locator("#create-room").click();await expect(page.locator("#lobby-screen")).toBeVisible();expect(errors).toEqual([]);
});

for(const quality of ["low","medium","high","auto"])test(`PlanetGun actual arena review and rendering samples at ${quality}`,async({page},info)=>{
 await page.goto("/");await page.getByLabel("Name",{exact:true}).fill("Arena Review");await selectExperimentalFamily(page,"planet-gun");
 await page.locator("#settings-open").click();await page.locator("#graphics-quality").selectOption(quality);await page.locator("#settings-close").click();
 await page.locator("#play-solo").click();await expect.poll(async()=>(await state(page))?.phase).toBe("playing");
 await page.locator("#pg-dev-review summary").click();const samples:unknown[]=[];
 for(const view of ["overhead","solar","void","center","left","right","upper","wallRun","westInterior","eastInterior"]){
  await page.locator(`[data-pg-view="${view}"]`).click();await expect.poll(async()=>(await state(page))?.review).toBe(view);
  await page.waitForTimeout(1500);const current=await state(page),frames=current.frameTimes.slice(-20).sort((a:number,b:number)=>a-b);
  expect(current.calls).toBeGreaterThan(0);expect(current.triangles).toBeGreaterThan(0);expect(Number.isFinite(current.local.position.y)).toBe(true);
  samples.push({requestedQuality:quality,view,...current,medianFrameMs:frames[Math.floor(frames.length*.5)],p95FrameMs:frames[Math.floor(frames.length*.95)]});
  await page.screenshot({path:info.outputPath(`${quality}-${view}.png`)});
 }
 await writeFile(info.outputPath("render-samples.json"),JSON.stringify(samples,null,2));
});
