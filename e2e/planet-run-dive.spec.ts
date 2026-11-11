import {test,expect,type Page} from "@playwright/test";
import {writeFile} from "node:fs/promises";
import {PR_BALANCE} from "@planetfall/shared";
import {selectExperimentalFamily,openLobbyConfiguration} from "./select-family";
test.use({channel:"chromium"});
const state=(page:Page)=>page.evaluate(()=>(window as any).__PLANETFALL_PR_DEBUG__?.());

test("a player-driven dive carries forward while the live camera reviews three angles",async({page},info)=>{
 await page.setViewportSize({width:960,height:540});await page.goto("/");await page.getByLabel("Name",{exact:true}).fill("Dive Review Pilot");await selectExperimentalFamily(page,"planet-run");
 await page.locator("#settings-open").click();await page.locator("#graphics-quality").selectOption("low");await page.locator("#settings-close").click();
 const evidence:unknown[]=[];
 for(const [view,turn]of [["behind",0],["side",Math.PI/2],["front",Math.PI]]as const){
  await page.locator("#create-room").click();await expect(page.locator("#pr-lobby-screen")).toBeVisible();await openLobbyConfiguration(page);await page.locator("#pr-target").selectOption("10");
  if(!await page.locator('[data-round="cargo-cyclone"]').isVisible())await page.locator("#pr-dev-review summary").click();await page.locator('[data-round="cargo-cyclone"]').click();
  await expect.poll(async()=>(await state(page))?.phase).toBe("running");await expect(page.locator(".pr-event-flash")).toBeHidden();
  await page.locator("#game-canvas").click({position:{x:480,y:270}});await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe("game-canvas");
  await page.keyboard.down("w");await page.waitForTimeout(140);await page.keyboard.down("Space");await page.waitForTimeout(140);await page.keyboard.up("Space");
  const before=await state(page);await page.keyboard.down("Shift");await page.waitForTimeout(35);await page.keyboard.up("Shift");await page.keyboard.up("w");
  if(turn)await page.mouse.move(480+turn/.0025,270);
  await page.waitForTimeout(85);const capture=await page.evaluate(()=>new Promise<{state:any;image:string}>(resolve=>requestAnimationFrame(()=>resolve({state:(window as any).__PLANETFALL_PR_DEBUG__?.(),image:(document.querySelector("#game-canvas") as HTMLCanvasElement).toDataURL("image/png")}))));const during=capture.state;await writeFile(info.outputPath(`dive-${view}-canvas.png`),Buffer.from(capture.image.split(",")[1],"base64"));
  await page.waitForTimeout(220);const after=await state(page),distance=Math.hypot(after.local.position.x-before.local.position.x,after.local.position.z-before.local.position.z);
  evidence.push({view,before,during,after,horizontalDistance:distance});
  await writeFile(info.outputPath("dive-routes.json"),JSON.stringify({balance:PR_BALANCE,evidence},null,2));
  expect(Math.hypot(during.local.velocity.x,during.local.velocity.z)).toBeGreaterThan(PR_BALANCE.runSpeed);
  expect(during.camera.distance,"Rapid orbit turn must retain the clear opener viewing radius").toBeGreaterThan(7);
  expect(distance).toBeGreaterThan(3);
  await page.screenshot({path:info.outputPath(`dive-${view}-context.png`)});
  await page.locator("#pr-leave-game").click();await expect(page.locator("#home-screen")).toBeVisible();
 }
 await writeFile(info.outputPath("dive-routes.json"),JSON.stringify({balance:PR_BALANCE,evidence},null,2));
});
