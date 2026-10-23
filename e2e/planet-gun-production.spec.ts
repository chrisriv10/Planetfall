import {test,expect} from "@playwright/test";
import {selectExperimentalFamily} from "./select-family";

// Run against actual bundled assets, not a development server with a hidden panel.
test("production PlanetGun omits review UI and diagnostic outputs while gameplay remains usable",async({page},info)=>{
 const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
 await page.goto("/");await page.getByLabel("Name",{exact:true}).fill("Production Pilot");await selectExperimentalFamily(page,"planet-gun");await page.locator("#create-room").click();await expect(page.locator("#pg-lobby-screen")).toBeVisible();await page.locator("#pg-fill").uncheck();const code=await page.locator("#pg-code").innerText();
 const wing=await page.context().newPage();await wing.goto("/");await wing.getByLabel("Name",{exact:true}).fill("Production Target");await selectExperimentalFamily(wing,"planet-gun");await wing.locator("#room-code").fill(code);await wing.locator("#join-room").click();await expect(wing.locator("#pg-lobby-screen")).toBeVisible();await wing.locator("#pg-ready").click();await page.locator("#pg-ready").click();await page.locator("#pg-start").click();await page.bringToFront();
 await expect(page.locator("#pg-hud")).toBeVisible();await expect(page.locator("#pg-timer")).toHaveText(/[1-9]\d*:\d\d/);await expect(page.locator("#pg-status")).toBeEmpty();
 await expect(page.locator("#pg-dev-review")).toHaveCount(0);await expect(page.locator("#pg-dev-state")).toHaveCount(0);await expect(page.getByText("DEV · MAP REVIEW",{exact:true})).toHaveCount(0);
 expect(await page.evaluate(()=>Object.getOwnPropertyNames(window).filter(k=>k.startsWith("__PLANETFALL_")&&k.includes("DEBUG")))).toEqual([]);
 await page.mouse.move(640,360);await page.mouse.down();await expect.poll(async()=>Number(await page.locator("#pg-magazine").textContent())).toBeLessThan(30);await page.mouse.up();await page.screenshot({path:info.outputPath("production-fps.png")});
 await page.keyboard.press("Escape");await expect(page.locator("#pause-overlay")).toBeVisible();expect(await page.evaluate(()=>document.pointerLockElement)).toBeNull();await page.locator("#pause-leave").click();await expect(page.locator("#home-screen")).toBeVisible();expect(errors).toEqual([]);
});
