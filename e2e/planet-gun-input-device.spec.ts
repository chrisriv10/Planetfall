import {test,expect} from "@playwright/test";
import {writeFile} from "node:fs/promises";
import {selectExperimentalFamily,capturePgMouse,openLobbyConfiguration} from "./select-family";

test.use({channel:"chromium"});
test("a connected idle controller cannot keep rotating a mouse-controlled camera",async({page},info)=>{
 // Hardware emulation only. Match, camera and player state are never injected.
 await page.addInitScript(()=>{
  const pad={id:"input ownership diagnostic",index:0,connected:true,mapping:"standard",timestamp:0,axes:[0,0,.3,0],buttons:Array.from({length:17},()=>({pressed:false,touched:false,value:0}))};
  Object.defineProperty(navigator,"getGamepads",{value:()=>[pad]});Object.assign(window,{__PG_DEVICE_PAD__:pad});
 });
 const state=()=>page.evaluate(()=>(window as unknown as {__PLANETFALL_PG_DEBUG__:()=>any}).__PLANETFALL_PG_DEBUG__());
 await page.goto("/");await page.getByLabel("Name",{exact:true}).fill("Device Pilot");await selectExperimentalFamily(page,"planet-gun");
 await page.locator("#create-room").click();await openLobbyConfiguration(page);await page.locator("#pg-target").selectOption("12");await page.locator("#pg-ready").click();await page.locator("#pg-start").click();
 await expect.poll(async()=>(await state())?.phase).toBe("playing");await expect(page.locator(".pg-capture-hint")).toBeVisible();await page.screenshot({path:info.outputPath("capture-hint-desktop.png")});await capturePgMouse(page);await expect(page.locator(".pg-capture-hint")).toBeHidden();await page.mouse.move(720,360,{steps:3});await page.waitForTimeout(100);
 const before=await state();await page.waitForTimeout(350);const after=await state();
 await writeFile(info.outputPath("device-camera.json"),JSON.stringify({scenario:"static .3 right-stick offset, followed by actual captured mouse input",before:before.movement,after:after.movement},null,2));
 expect(after.movement.camera.controlYaw).toBeCloseTo(before.movement.camera.controlYaw,5);
 // Intentional controller use still works; a single mouse pixel takes it back.
 await page.evaluate(()=>{(window as any).__PG_DEVICE_PAD__.axes[2]=0;});await page.waitForTimeout(80);
 await page.evaluate(()=>{(window as any).__PG_DEVICE_PAD__.axes[2]=.8;});await expect.poll(async()=>(await state()).inputMethod).toBe("gamepad");
 const controllerBefore=(await state()).movement.camera.controlYaw;await page.waitForTimeout(150);expect(Math.abs((await state()).movement.camera.controlYaw-controllerBefore)).toBeGreaterThan(.1);
 await page.mouse.move(721,360);await expect.poll(async()=>(await state()).inputMethod).toBe("keyboard");const precise=await state();await page.waitForTimeout(200);
 expect((await state()).movement.camera.controlYaw).toBeCloseTo(precise.movement.camera.controlYaw,5);
 await page.keyboard.press("Escape");await expect(page.locator(".pg-capture-hint")).toBeHidden();await page.locator("#pause-leave").click();
});
