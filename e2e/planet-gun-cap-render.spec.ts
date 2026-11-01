import {test,expect} from "@playwright/test";
import {writeFile} from "node:fs/promises";
test.use({channel:"chromium"});
test("32 authoritative-format infected instances render with bounded resources at every quality",async({page},info)=>{
 await page.setViewportSize({width:1280,height:720});await page.goto("/pg-mode-render-review.html");const results:unknown[]=[];
 for(const quality of ["high","medium","low","auto"]){await page.locator("#quality").selectOption(quality);await expect.poll(async()=>{const raw=await page.locator("#metrics").textContent();if(!raw)return 0;const m=JSON.parse(raw);return m.quality===quality?m.samples:0;}).toBeGreaterThan(90);const first=JSON.parse((await page.locator("#metrics").textContent())!);await page.waitForTimeout(1200);const last=JSON.parse((await page.locator("#metrics").textContent())!);expect(last.geometries).toBe(first.geometries);expect(last.textures).toBe(first.textures);expect(last.calls).toBeLessThan(300);expect(last.triangles).toBeLessThan(250000);expect(last.instances).toBeGreaterThanOrEqual(32);results.push(last);await page.screenshot({path:info.outputPath(`cap-${quality}.png`)});}
 await writeFile(info.outputPath("cap-render-metrics.json"),JSON.stringify(results,null,2));
});
