import {test,expect} from "@playwright/test";
import {selectExperimentalFamily} from "./select-family";

test("all four created rooms share a balanced readable ready room with a free cursor",async({page},info)=>{
 const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
 await page.setViewportSize({width:1280,height:720});await page.goto("/");await page.getByLabel("Name",{exact:true}).fill("Lobby Pilot");
 for(const family of ["planetfall","battle-royale","planet-run","planet-gun"] as const){
  if(family==="planetfall")await page.locator("#family-planetfall").click();else await selectExperimentalFamily(page,family);
  await page.locator("#create-room").click();
  const ids=family==="planetfall"?["lobby-screen","leave-lobby"]:family==="battle-royale"?["br-lobby-screen","br-leave-lobby"]:family==="planet-run"?["pr-lobby-screen","pr-leave-lobby"]:["pg-lobby-screen","pg-leave-lobby"];
  const lobby=page.locator("#"+ids[0]),card=lobby.locator(".mode-panel").first();await expect(lobby).toBeVisible();await expect(lobby.locator(".mode-roster-name")).toContainText(["Lobby Pilot"]);await expect(lobby.locator("[data-kind=you]")).toHaveText("YOU");await expect(lobby.locator("[data-kind=host]")).toHaveText("HOST");
  await page.mouse.click(4,350);expect(await page.evaluate(()=>document.pointerLockElement===null)).toBe(true);
  const box=await card.boundingBox();expect(box).not.toBeNull();expect(box!.width).toBeLessThanOrEqual(680.1);
  const avatar=await lobby.locator('.lobby-main-area').boundingBox(),footer=await lobby.locator('.lobby-footer').boundingBox();expect(avatar).not.toBeNull();expect(footer).not.toBeNull();
  expect(avatar!.width).toBeGreaterThan(350);expect(box!.x).toBeGreaterThanOrEqual(avatar!.x+avatar!.width);expect(box!.x+box!.width).toBeLessThanOrEqual(1260);
  expect(Math.abs(footer!.x+footer!.width/2-640)).toBeLessThan(20);expect(footer!.y).toBeGreaterThanOrEqual(box!.y+box!.height);
  await expect(page.locator("#"+ids[1])).toBeInViewport({ratio:1});
  await expect.poll(()=>page.evaluate(()=>(window as any).__PLANETFALL_DEBUG__?.().lobbyAvatarCount)).toBeGreaterThan(0);
  await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
  await page.screenshot({path:info.outputPath(family+"-lobby-720p.png")});
  await page.setViewportSize({width:390,height:844});await page.locator("#"+ids[1]).scrollIntoViewIfNeeded();await expect(page.locator("#"+ids[1])).toBeInViewport();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);// Resizing clears the WebGL drawing buffer; review after actual new-size frames.
  await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())))));
  await expect.poll(()=>page.evaluate(()=>(window as any).__PLANETFALL_DEBUG__?.().lobbyAvatarCount)).toBe(1);
  await page.screenshot({path:info.outputPath(family+"-lobby-narrow.png")});
  await page.locator("#"+ids[1]).click();await expect(page.locator("#home-screen")).toBeVisible();await page.setViewportSize({width:1280,height:720});
 }
 expect(errors).toEqual([]);
});
