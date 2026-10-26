import {selectExperimentalFamily} from "./select-family";
import {writeFile} from "node:fs/promises";
import {expect,test,type Page} from "@playwright/test";
const debug=(page:Page)=>page.evaluate(()=>(window as unknown as {__PLANETFALL_PR_DEBUG__?:()=>{phase:string;roundId:string;roundIndex:number;active:boolean;camera:{yaw:number;pitch:number};players:number;triggeredTiles:number;local:{position:{x:number;y:number;z:number};velocity:{y:number};grounded:boolean};calls:number;triangles:number;frameTimes:number[]}}).__PLANETFALL_PR_DEBUG__?.());
async function home(page:Page){await page.goto("/");await page.getByLabel("Name",{exact:true}).fill("Course Pilot");await selectExperimentalFamily(page,"planet-run");}
async function review(page:Page,round:string,beforeRunning?:()=>Promise<void>){await home(page);await page.locator("#create-room").click();await expect(page.locator("#pr-lobby-screen")).toBeVisible();await page.locator("#pr-target").selectOption("10");if(!await page.locator(`[data-round='${round}']`).isVisible())await page.locator("#pr-dev-review summary").click();await page.locator(`[data-round='${round}']`).click();await beforeRunning?.();await expect.poll(async()=>(await debug(page))?.phase).toBe("running");}
test("PlanetRun lifecycle, input, UI capture and cross-family renderer ownership",async({page},info)=>{
  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  await home(page);await page.locator("#create-room").click();await expect(page.locator("#pr-lobby-screen")).toBeVisible();
  await page.mouse.click(1200,500);expect(await page.evaluate(()=>document.pointerLockElement===null)).toBe(true);
  await page.locator("#pr-shop").click();await expect(page.locator("#shop-overlay")).toBeVisible();await page.locator("#shop-close").click();
  await page.locator("#pr-ready").click();await page.locator("#pr-start").click();await expect.poll(async()=>(await debug(page))?.phase).toBe("running");
  const before=(await debug(page))!.local.position;await page.keyboard.down("w");await page.waitForTimeout(700);await page.keyboard.up("w");
  await expect.poll(async()=>(await debug(page))!.local.position.z).toBeLessThan(before.z-2);
  await page.keyboard.down("Space");await page.waitForTimeout(120);await page.keyboard.up("Space");expect((await debug(page))!.local.position.y).toBeGreaterThan(.8);
  await page.keyboard.press("Escape");await expect(page.locator("#pause-overlay")).toBeVisible();expect(await page.evaluate(()=>document.pointerLockElement===null)).toBe(true);await page.locator("#resume-button").click();
  // Right-drag remains usable in embedded browsers that deny pointer lock.
  const yaw=(await debug(page))!.camera.yaw;
  await page.mouse.move(800,450);await page.mouse.down({button:"right"});await page.mouse.move(920,470,{steps:4});await page.mouse.up({button:"right"});
  await expect.poll(async()=>(await debug(page))!.camera.yaw).not.toBe(yaw);
  await page.screenshot({path:info.outputPath("planetrun-first-course.png")});
  await page.locator("#pr-leave-game").click();await expect(page.locator("#home-screen")).toBeVisible();expect((await debug(page))?.active).toBe(false);
  await page.locator("#family-planetfall").click();await page.locator("#create-room").click();await expect(page.locator("#lobby-screen")).toBeVisible();await expect(page.locator("#pr-hud")).not.toBeVisible();await page.locator("#leave-lobby").click();
  await selectExperimentalFamily(page,"battle-royale");await page.locator("#create-room").click();await expect(page.locator("#br-lobby-screen")).toBeVisible();await expect(page.locator("#pr-hud")).not.toBeVisible();await page.locator("#br-leave-lobby").click();expect(errors).toEqual([]);
});
test("PlanetRun quick solo fills bots and advances an ordinary tournament",async({page})=>{
  await home(page);await page.locator("#play-solo").click();await expect.poll(async()=>(await debug(page))?.phase).toBe("running");expect((await debug(page))!.players).toBe(20);
  // Bots follow ordinary course physics. No finish/result injection.
  await expect.poll(async()=>(await debug(page))?.roundIndex,{timeout:125000}).toBeGreaterThan(0);
  await page.locator("#pr-leave-game").click();await expect(page.locator("#home-screen")).toBeVisible();
});
test("Shatterdeck contact breaks cells and falls to a lower deck",async({page},info)=>{
  // Observe the upper spawn during deployment. A normal phase poll can return
  // after the620ms contact tile has already broken; that is expected gameplay.
  await review(page,"shatterdeck",async()=>{
    await expect.poll(async()=>(await debug(page))?.roundId).toBe("shatterdeck");
    await expect.poll(async()=>(await debug(page))?.local.position.y).toBeGreaterThan(17);
  });
  await expect.poll(async()=>(await debug(page))!.triggeredTiles).toBeGreaterThan(0);
  await expect.poll(async()=>(await debug(page))!.local.position.y).toBeLessThan(17);
  await page.screenshot({path:info.outputPath("shatterdeck-lower-deck.png")});
  // Idle human can lose; keep watching until the real final produces a result.
  await expect(page.locator("#pr-results-screen")).toBeVisible({timeout:135000});
  await page.locator("#pr-return").click();await expect(page.locator("#pr-lobby-screen")).toBeVisible();
  await page.locator("#pr-leave-lobby").click();await expect(page.locator("#home-screen")).toBeVisible();
});
for(const quality of ["low","medium","high","auto"]){
test(`PlanetRun six-round rendering samples at ${quality}`,async({page},info)=>{
  const samples:unknown[]=[];
    await home(page);await page.locator("#settings-open").click();await page.locator("#graphics-quality").selectOption(quality);await page.locator("#settings-close").click();
    for(const round of ["cargo-cyclone","solar-sweep","meteor-garden","flux-gardens","capacitor-causeway","shatterdeck"]){
      await page.locator("#create-room").click();await expect(page.locator("#pr-lobby-screen")).toBeVisible();await page.locator("#pr-target").selectOption("10");if(!await page.locator(`[data-round='${round}']`).isVisible())await page.locator("#pr-dev-review summary").click();await page.locator(`[data-round='${round}']`).click();
      await expect.poll(async()=>(await debug(page))?.phase).toBe("running");
      await page.waitForTimeout(2000);const state=await debug(page);expect(state!.calls).toBeGreaterThan(0);expect(state!.triangles).toBeGreaterThan(0);
      const frames=state!.frameTimes.slice(-90).sort((a,b)=>a-b);samples.push({quality,round,...state,medianFrameMs:frames[Math.floor(frames.length*.5)],p95FrameMs:frames[Math.floor(frames.length*.95)]});
      await page.screenshot({path:info.outputPath(`${quality}-${round}.png`)});
      await page.locator("#pr-leave-game").click();await expect(page.locator("#home-screen")).toBeVisible();
    }
  await writeFile(info.outputPath("client-render-samples.json"),JSON.stringify(samples,null,2));
  await info.attach("client-render-samples",{body:JSON.stringify(samples,null,2),contentType:"application/json"});
});
}
test("Meteor Garden renders telegraphed fields without opaque hazard boxes",async({page},info)=>{
  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  await review(page,"meteor-garden");
  await page.keyboard.down("KeyD");await page.waitForTimeout(500);await page.keyboard.up("KeyD");
  await page.screenshot({path:info.outputPath("meteor-warning-field.png")});
  await page.waitForTimeout(2200);await page.screenshot({path:info.outputPath("meteor-impact-field.png")});
  const renderer=await page.evaluate(()=>{
    const canvas=document.querySelector<HTMLCanvasElement>("#game-canvas")!,gl=canvas.getContext("webgl2");
    if(!gl)return "unavailable";const extension=gl.getExtension("WEBGL_debug_renderer_info");return extension?String(gl.getParameter(extension.UNMASKED_RENDERER_WEBGL)):String(gl.getParameter(gl.RENDERER));
  });
  await writeFile(info.outputPath("meteor-client-renderer.json"),JSON.stringify({renderer,state:await debug(page)},null,2));
  expect(errors).toEqual([]);await page.locator("#pr-leave-game").click();await expect(page.locator("#home-screen")).toBeVisible();
});
