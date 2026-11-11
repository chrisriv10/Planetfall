import {test,expect} from "@playwright/test";
import {writeFile} from "node:fs/promises";
import {PG_ZOMBIE_BARRICADE_SITES} from "@planetfall/shared";
import {selectExperimentalFamily} from "./select-family";
import {state,route,lookAt} from "./pg-world-route";
test.use({channel:"chromium",video:"on"});
test("a survivor shoots a physical entry board and rebuilds it with held interaction",async({page},info)=>{
 test.setTimeout(120000);
 await page.setViewportSize({width:960,height:540});await page.goto("/");await page.getByLabel("Name",{exact:true}).fill("Entry Repair Pilot");await selectExperimentalFamily(page,"planet-gun");
 await page.locator("#settings-open").click();await page.locator("#graphics-quality").selectOption("low");await page.locator("#settings-close").click();
 await page.locator("#create-room").click();await page.getByLabel("PlanetGun submode").selectOption("planetzombies");await page.locator("#pg-ready").click();await page.locator("#pg-start").click();await expect.poll(async()=>(await state(page))?.mode?.subphase).toBe("wave");
 const site=PG_ZOMBIE_BARRICADE_SITES.find(s=>s.id==="southeast")!,board=site.boards[1];
 await route(page,site.interaction,info.outputPath("repair-route-failure.json"));await lookAt(page,board.solid.center);
 const before=await state(page),readBoard=(s:any)=>s.mode.collision.panels.find((p:any)=>p.id===board.id);
 // Orbit is semiautomatic: separate normal trigger presses, not a held
 // automatic-fire assumption. Keep each shot aimed at the actual board face.
 for(let shot=0;shot<6&&readBoard(await state(page)).active;shot++){
  await lookAt(page,board.solid.center);await page.mouse.down();await page.waitForTimeout(60);await page.mouse.up();await page.waitForTimeout(320);
 }
 await expect.poll(async()=>readBoard(await state(page)).active).toBe(false);
 const breached=await state(page);await page.screenshot({path:info.outputPath("entry-board-breached.png")});
 await expect(page.locator(".pg-world-interaction-prompt")).toContainText("HOLD TO REPAIR ONE BOARD");
 await page.keyboard.down("e");try{
  await expect.poll(async()=>{const s=await state(page);return s.mode.pilots[s.local.id].interaction?.targetId;}).toBe(`barricade:${site.id}`);
  await page.screenshot({path:info.outputPath("entry-repair-in-progress.png")});
  await expect.poll(async()=>{const b=readBoard(await state(page));return b.active&&b.hp===b.maxHp;}).toBe(true);
 }finally{await page.keyboard.up("e");}
 const repaired=await state(page);await page.screenshot({path:info.outputPath("entry-board-rebuilt.png")});
 await writeFile(info.outputPath("barricade-playthrough.json"),JSON.stringify({site,board,before,breached,repaired},null,2));
 expect(readBoard(breached).hp).toBe(0);expect(readBoard(repaired).hp).toBe(30);expect(repaired.local.hp).toBeGreaterThan(0);expect(repaired.mode.collision.topologyRevision).toBeGreaterThan(before.mode.collision.topologyRevision);
});
