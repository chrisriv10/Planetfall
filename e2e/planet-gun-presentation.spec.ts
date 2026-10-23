import {test,expect} from "@playwright/test";
import {selectExperimentalFamily} from "./select-family";

for(const weapon of["pulse","nova","photon","quasar","rail"]){
 test(`PlanetGun ${weapon} held hip, ADS, recoil, reload and sprint presentation`,async({page},info)=>{
  await page.setViewportSize({width:1280,height:720});
  await page.goto("/");await page.getByLabel("Name",{exact:true}).fill("Optic Review");await selectExperimentalFamily(page,"planet-gun");
  // A passive second human keeps pose capture deterministic. Combat against
  // bots and the opposing-client scoped hit are exercised in separate tests;
  // an AI elimination here can reset ammo/life in the middle of a screenshot.
  await page.locator("#create-room").click();await expect(page.locator("#pg-lobby-screen")).toBeVisible();await page.locator("#pg-fill").uncheck();const code=await page.locator("#pg-code").innerText();
  const wing=await page.context().newPage();await wing.goto("/");await wing.getByLabel("Name",{exact:true}).fill("Presentation Target");await selectExperimentalFamily(wing,"planet-gun");await wing.locator("#room-code").fill(code);await wing.locator("#join-room").click();await expect(wing.locator("#pg-lobby-screen")).toBeVisible();await wing.locator("#pg-ready").click();
  await page.locator("#pg-loadout").selectOption(weapon);await page.locator("#pg-ready").click();await page.locator("#pg-start").click();await page.bringToFront();
  const state=async()=>page.evaluate(()=>(window as unknown as {__PLANETFALL_PG_DEBUG__:()=>any}).__PLANETFALL_PG_DEBUG__());
  await expect.poll(async()=>(await state())?.phase).toBe("playing");expect((await state()).players).toBe(2);
  await page.waitForTimeout(500);await page.screenshot({path:info.outputPath(`${weapon}-hip.png`)});
  await page.mouse.move(640,360);await page.mouse.down({button:"right"});await expect.poll(async()=>(await state()).ads).toBeGreaterThan(.99);
  const crosshair=await page.locator("#pg-crosshair").boundingBox();expect(crosshair).not.toBeNull();expect(crosshair!.x+crosshair!.width/2).toBeCloseTo(640,1);expect(crosshair!.y+crosshair!.height/2).toBeCloseTo(360,1);
  expect(await page.locator("#pg-crosshair").evaluate(e=>Number(getComputedStyle(e).getPropertyValue("--pg-optic-opacity")))).toBeGreaterThan(.99);
  await page.screenshot({path:info.outputPath(`${weapon}-ads.png`)});
  const magazine=(await state()).local.guns[0].magazine;await page.mouse.down();
  // Hold the real input until authority observes it, rather than releasing a
  // 110ms pulse while a software-rendered screenshot may stall the frame loop.
  await expect.poll(async()=>(await state()).local.guns[0].magazine).toBeLessThan(magazine);
  await page.screenshot({path:info.outputPath(`${weapon}-recoil.png`)});await page.mouse.up();await page.mouse.up({button:"right"});
  await page.keyboard.down("Control");await page.keyboard.press("r");await page.keyboard.up("Control");await expect(page.locator("#pg-ammo")).toContainText("RELOADING");await page.waitForTimeout(450);await page.screenshot({path:info.outputPath(`${weapon}-reload.png`)});
  await expect(page.locator("#pg-reload")).toBeEmpty();await page.keyboard.down("Shift");await page.keyboard.down("w");await expect.poll(async()=>(await state()).local.mode).toBe("sprint");await page.screenshot({path:info.outputPath(`${weapon}-sprint.png`)});await page.keyboard.up("w");await page.keyboard.up("Shift");
  if(weapon==="pulse"){
   await page.keyboard.press("2");await expect(page.locator("#pg-ammo")).toContainText("Comet");await page.waitForTimeout(450);await page.screenshot({path:info.outputPath("comet-hip.png")});
   await page.setViewportSize({width:864,height:540});await page.waitForTimeout(500);
   for(const selector of["#pg-score","#pg-health","#pg-ion","#pg-ammo","#pg-pause","#pg-scoreboard-toggle"]){const b=await page.locator(selector).boundingBox();expect(b).not.toBeNull();expect(b!.x).toBeGreaterThanOrEqual(0);expect(b!.y).toBeGreaterThanOrEqual(0);expect(b!.x+b!.width).toBeLessThanOrEqual(864);expect(b!.y+b!.height).toBeLessThanOrEqual(540);}
   await page.screenshot({path:info.outputPath("compact-hud-864.png")});
  }
 });
}
