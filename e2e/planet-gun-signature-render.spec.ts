import {test,expect} from "@playwright/test";
import {writeFile} from "node:fs/promises";
// Component stress is deliberately separate from real room/input acceptance.
// No synthetic snapshot is ever sent to a server or a production game instance.
test.use({channel:"chromium",viewport:{width:1280,height:720}});
for(const mode of ["planetstrike","planetwatch","planetsiege","planetzombies"])for(const quality of ["low","medium","high","auto"]){
 test(`signature rendering stress ${mode} ${quality}`,async({page},info)=>{
  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto("/pg-mode-render-review.html");await page.locator("#mode").selectOption(mode);await page.locator("#quality").selectOption(quality);
  const metrics=()=>page.locator("#metrics").textContent().then(t=>t?JSON.parse(t):null);
  await expect.poll(async()=>{const s=await metrics();return s?.fixtureMode===mode&&s?.quality===quality&&s?.samples>=120;}).toBe(true);
  const sample=await metrics();expect(sample.gpu).toBeTruthy();expect(sample.calls).toBeGreaterThan(0);expect(sample.triangles).toBeGreaterThan(0);expect(sample.materials).toBeGreaterThan(0);
  for(const key of ["p50FrameMs","p95FrameMs","p50CpuMs","p95CpuMs"])expect(Number.isFinite(sample[key])).toBe(true);
  if(mode==="planetzombies")expect(sample.fixtureCounts.infected).toBe(32);else expect(sample.fixtureCounts.effects).toBeGreaterThan(0);
  if(mode==="planetsiege"){expect(sample.fixtureCounts.drones).toBeGreaterThan(0);expect(sample.fixtureCounts.cameras).toBeGreaterThan(0);}
  await writeFile(info.outputPath("signature-render-sample.json"),JSON.stringify(sample,null,2));await page.screenshot({path:info.outputPath(`${mode}-${quality}-signature-stress.png`)});expect(errors).toEqual([]);
 });
}
