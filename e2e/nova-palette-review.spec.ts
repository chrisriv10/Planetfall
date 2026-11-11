import {test,expect} from "@playwright/test";
import {writeFile} from "node:fs/promises";
import {selectExperimentalFamily} from "./select-family";
test.use({channel:"chromium",viewport:{width:1280,height:720}});
test("Nova Block districts retain their geometry while showing authored color identity",async({page},info)=>{
 await page.goto("/");await page.getByLabel("Name",{exact:true}).fill("District Review");await selectExperimentalFamily(page,"planet-gun");await page.locator("#settings-open").click();await page.locator("#graphics-quality").selectOption("high");await page.locator("#settings-close").click();await page.locator("#play-solo").click();
 const state=()=>page.evaluate(()=>(window as any).__PLANETFALL_PG_DEBUG__?.());await expect.poll(async()=>(await state())?.phase).toBe("playing");await page.locator("#pg-dev-review summary").click();const samples:unknown[]=[];
 for(const view of ["westInterior","habitatSuite","left","serviceInterior","right","center"]){await page.locator(`[data-pg-view="${view}"]`).click();await expect.poll(async()=>(await state())?.review).toBe(view);await page.waitForTimeout(500);const s=await state();expect(s.calls).toBeGreaterThan(0);expect(s.triangles).toBeGreaterThan(0);samples.push({view,renderer:s.renderer,calls:s.calls,triangles:s.triangles,materialCount:s.materialCount,visibleInstances:s.visibleInstances});await page.screenshot({path:info.outputPath(view+".png")});}
 await writeFile(info.outputPath("district-render.json"),JSON.stringify(samples,null,2));
});
