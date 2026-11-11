import {expect,test} from "@playwright/test";
import {writeFile} from "node:fs/promises";
import {openLobbyConfiguration,selectExperimentalFamily} from "./select-family";

test("ordinary infected hits drive danger, downed feedback and a real solo recovery",async({page},info)=>{
 const observed:{life:string;hits:number;capacity:number}[]=[];
 page.on("websocket",socket=>socket.on("framereceived",event=>{
  const text=String(event.payload);if(!text.startsWith('42["pg:match:snapshot"'))return;
  const [,snapshot]=JSON.parse(text.slice(2));if(snapshot.mode?.id!=="planetzombies")return;
  const own=snapshot.players.find((p:{name:string})=>p.name==="Hazard Pilot"),pilot=own&&snapshot.mode.pilots[own.id];
  if(pilot&&observed.at(-1)?.hits!==pilot.hitCount)observed.push({life:pilot.life,hits:pilot.hitCount,capacity:pilot.hitCapacity});
 }));
 const state=()=>page.evaluate(()=>(window as unknown as {__PLANETFALL_PG_DEBUG__:()=>any}).__PLANETFALL_PG_DEBUG__());
 const pilot=async()=>Object.values((await state())?.mode?.pilots??{})[0]as{life:string;hitCount:number;hitCapacity:number;selfRecovery:boolean}|undefined;
 try{
  await page.goto("/");await page.getByLabel("Name",{exact:true}).fill("Hazard Pilot");await selectExperimentalFamily(page,"planet-gun");await page.locator("#create-room").click();
  await page.getByLabel("PlanetGun submode").selectOption("planetzombies");await openLobbyConfiguration(page);await page.locator("#pg-target").selectOption("1");await page.locator("#pg-fill").uncheck();
  await page.locator("#pg-ready").click();await page.locator("#pg-start").click();await expect.poll(async()=>(await state())?.mode?.id).toBe("planetzombies");
  await expect(page.locator("#pg-health-label")).toHaveText("HITS LEFT");await expect(page.locator("#pg-health-value")).toHaveText("3");
  // Stand at the ordinary survivor spawn. Real wave enemies must reach and hit
  // the body; this test never edits HP, hits, position, enemies or wave state.
  await expect.poll(async()=>(await pilot())?.life,{timeout:45000}).toBe("downed");
  expect(observed.some(p=>p.hits===1)).toBe(true);expect(observed.some(p=>p.hits===2)).toBe(true);
  await expect(page.locator("#pg-health-label")).toHaveText("DOWNED");await expect(page.locator("#pg-crosshair")).toBeHidden();
  expect(await page.locator(".pg-health-vignette").evaluate(e=>Number(getComputedStyle(e).opacity))).toBeGreaterThan(.7);
  await page.screenshot({path:info.outputPath("real-zombie-downed.png")});
  await page.keyboard.down("e");await expect.poll(async()=>(await pilot())?.life,{timeout:8000}).toBe("alive");await page.keyboard.up("e");
  expect((await pilot())?.selfRecovery).toBe(false);await expect(page.locator("#pg-health-label")).toHaveText("HITS LEFT");
  await page.screenshot({path:info.outputPath("real-zombie-recovered.png")});
 }finally{await page.keyboard.up("e").catch(()=>{});await writeFile(info.outputPath("hit-history.json"),JSON.stringify(observed,null,2));}
});
