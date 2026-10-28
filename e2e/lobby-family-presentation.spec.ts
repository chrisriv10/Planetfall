import {test,expect} from "@playwright/test";
import {selectExperimentalFamily} from "./select-family";

test("all four created rooms share a centered readable lobby with a free cursor",async({page},info)=>{
 const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
 await page.setViewportSize({width:1280,height:720});await page.goto("/");await page.getByLabel("Name",{exact:true}).fill("Lobby Pilot");
 for(const family of ["planetfall","battle-royale","planet-run","planet-gun"] as const){
  if(family==="planetfall")await page.locator("#family-planetfall").click();else await selectExperimentalFamily(page,family);
  await page.locator("#create-room").click();
  const ids=family==="planetfall"?["lobby-screen","leave-lobby"]:family==="battle-royale"?["br-lobby-screen","br-leave-lobby"]:family==="planet-run"?["pr-lobby-screen","pr-leave-lobby"]:["pg-lobby-screen","pg-leave-lobby"];
  const lobby=page.locator("#"+ids[0]),card=lobby.locator(".mode-panel").first();await expect(lobby).toBeVisible();await expect(lobby.locator(".mode-roster-name")).toContainText(["Lobby Pilot"]);await expect(lobby.locator("[data-kind=you]")).toHaveText("YOU");await expect(lobby.locator("[data-kind=host]")).toHaveText("HOST");
  await page.mouse.click(4,350);expect(await page.evaluate(()=>document.pointerLockElement===null)).toBe(true);
  const box=await card.boundingBox();expect(box).not.toBeNull();expect(Math.abs(box!.x+box!.width/2-640)).toBeLessThan(20);expect(box!.width).toBeLessThanOrEqual(680.1);
  await expect(page.locator("#"+ids[1])).toBeInViewport({ratio:1});
  await page.screenshot({path:info.outputPath(family+"-lobby-720p.png")});
  await page.setViewportSize({width:390,height:844});await page.locator("#"+ids[1]).scrollIntoViewIfNeeded();await expect(page.locator("#"+ids[1])).toBeInViewport();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);await page.screenshot({path:info.outputPath(family+"-lobby-narrow.png")});
  await page.locator("#"+ids[1]).click();await expect(page.locator("#home-screen")).toBeVisible();await page.setViewportSize({width:1280,height:720});
 }
 expect(errors).toEqual([]);
});
