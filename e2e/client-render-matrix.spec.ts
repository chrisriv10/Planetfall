import {test,expect,type Page} from "@playwright/test";
import {writeFile} from "node:fs/promises";
import {selectExperimentalFamily,openLobbyConfiguration} from "./select-family";

// Record the actual renderer: bundled headless-shell software rendering is a
// different dataset from the installed Chromium GPU path used here.
test.use({channel:"chromium",viewport:{width:1280,height:720}});
const state=(page:Page)=>page.evaluate(()=>(window as any).__PLANETFALL_PG_DEBUG__?.());
const modes=["deathmatch","planetstrike","planetwatch","planetsiege","planetzombies"] as const;
for(const quality of ["low","medium","high","auto"] as const)for(const mode of modes){
 test(`client render matrix ${mode} ${quality}`,async({page},info)=>{
  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));page.on("console",m=>{if(m.type()==="error"&&/WebGLProgram|GL_INVALID|shader error/i.test(m.text()))errors.push(m.text());});
  await page.goto("/");await page.getByLabel("Name",{exact:true}).fill("Render Matrix Pilot");await selectExperimentalFamily(page,"planet-gun");
  await page.locator("#settings-open").click();await page.locator("#graphics-quality").selectOption(quality);await page.locator("#settings-close").click();
  await page.locator("#create-room").click();await expect(page.locator("#pg-lobby-screen")).toBeVisible();await page.getByLabel("PlanetGun submode").selectOption(mode);
  await openLobbyConfiguration(page);await page.locator("#pg-target").selectOption(mode==="planetzombies"?"4":"12");await page.locator("#pg-ready").click();await page.locator("#pg-start").click();
  await expect.poll(async()=>(await state(page))?.phase).toBe("playing");
  if(mode==="planetstrike"||mode==="planetsiege")await expect.poll(async()=>(await state(page))?.mode?.subphase,{timeout:45000}).toBe("action");
  if(mode==="planetzombies")await expect.poll(async()=>(await state(page))?.mode?.zombies.length).toBeGreaterThan(0);
  await page.locator("#pg-dev-review summary").click();
  const samples:unknown[]=[];
  const sample=async(view:string)=>{
   await page.waitForTimeout(5000);const s=await state(page),frames=s.frameTimes.slice(-90).sort((a:number,b:number)=>a-b);
   expect(s.calls).toBeGreaterThan(0);expect(s.triangles).toBeGreaterThan(0);expect(frames.length).toBeGreaterThan(10);
   const heap=await page.evaluate(()=>(performance as any).memory?.usedJSHeapSize??null);
   samples.push({requestedQuality:quality,mode,view,renderer:s.renderer,resolvedQuality:s.resolvedQuality,players:s.players,subphase:s.mode?.subphase,pilotBatching:s.pilotBatching,pilotDetail:s.pilotDetail,medianFrameMs:frames[Math.floor(frames.length*.5)],p95FrameMs:frames[Math.floor(frames.length*.95)],calls:s.calls,triangles:s.triangles,visibleInstances:s.visibleInstances,materialCount:s.materialCount,geometries:s.geometries,textures:s.textures,programs:s.programs,usedJSHeapBytes:heap,effects:s.effects,profile:s.profile,network:s.network,signatureEffects:s.mode?.effects.length??0,liveInfected:s.mode?.id==="planetzombies"?s.mode.zombies.length:0,activePilots:s.mode?Object.values(s.mode.pilots).filter((p:any)=>p.life==="alive").length:s.players});
   await writeFile(info.outputPath("client-render-samples.json"),JSON.stringify(samples,null,2));
   await page.screenshot({path:info.outputPath(`${view}.png`)});
  };
  for(const view of ["overhead","westInterior","crowd6"]){
   await page.locator(`[data-pg-view="${view}"]`).click();await expect.poll(async()=>(await state(page))?.review).toBe(view);await sample(view);
  }
  // Same camera and canonical geometry; the supported review switch changes
  // batching only. Live bot poses/visibility remain recorded, not frozen.
  await page.locator('[data-pg-batching="false"]').click();await expect.poll(async()=>(await state(page))?.pilotBatching).toBe(false);await sample("crowd6-unbatched");
  await page.locator('[data-pg-batching="true"]').click();await expect.poll(async()=>(await state(page))?.pilotBatching).toBe(true);
  expect(errors).toEqual([]);
 });
}
