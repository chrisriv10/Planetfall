import {expect,test} from "@playwright/test";
import {PG_BALANCE,PG_LEAN} from "@planetfall/shared";
import {capturePgMouse,openLobbyConfiguration,selectExperimentalFamily} from "./select-family";

test.use({channel:"chromium"});
test("Siege hold-to-lean moves the real camera and networked exposure while feet stay planted",async({browser},info)=>{
 test.setTimeout(120000);const host=await browser.newPage({viewport:{width:1280,height:720}}),guest=await browser.newPage({viewport:{width:960,height:540}});
 const state=(page=host)=>page.evaluate(()=>(window as any).__PLANETFALL_PG_DEBUG__?.());
 try{
  for(const [page,name]of [[host,"Lean Pilot"],[guest,"Lean Observer"]]as const){await page.goto("/");await page.getByLabel("Name",{exact:true}).fill(name);await selectExperimentalFamily(page,"planet-gun");}
  await host.locator("#create-room").click();await host.getByLabel("PlanetGun submode").selectOption("planetsiege");await openLobbyConfiguration(host);await host.locator("#pg-fill").uncheck();await guest.locator("#room-code").fill(await host.locator("#pg-code").innerText());await guest.locator("#join-room").click();await guest.locator("#pg-ready").click();await host.locator("#pg-ready").click();await host.locator("#pg-start").click();
  // Siege assigns sides on the server. Only the actual attacker is barred
  // from leaning during preparation.
  await expect.poll(async()=>(await state(host))?.mode?.subphase).toBe("prepare");
  const initial=await state(host);
  const [pilot,observer]=initial.local.team===initial.mode.attackTeam?[host,guest]:[guest,host];
  await pilot.bringToFront();
  await expect.poll(async()=>{
   const s=await state(pilot);
   return {subphase:s?.mode?.subphase,side:s?.mode?.pilots[s.local?.id]?.side};
  }).toEqual({subphase:"prepare",side:"attack"});
  const pilotState=()=>state(pilot);
  await pilot.keyboard.down("c");await pilot.waitForTimeout(250);expect((await pilotState()).local.lean).toBe(0);await pilot.keyboard.up("c");
  await expect.poll(async()=>(await pilotState()).mode.subphase,{timeout:40000}).toBe("action");await capturePgMouse(pilot);const baseline=await pilotState(),feet=baseline.local.position,id=baseline.local.id;
  for(const[key,direction]of [["z",-1],["c",1]]as const){
   await pilot.keyboard.down(key);
   try{
    await expect.poll(async()=>(await pilotState()).local.lean*direction).toBeGreaterThan(.98);
    await expect.poll(async()=>(await state(observer)).remotePilots.find((p:any)=>p.id===id)?.lean*direction).toBeGreaterThan(.98);
    const s=await pilotState(),offset={x:Math.cos(s.local.yaw)*PG_LEAN.distance*s.local.lean,y:-Math.abs(s.local.lean)*PG_LEAN.drop,z:-Math.sin(s.local.yaw)*PG_LEAN.distance*s.local.lean};
    expect(s.local.position).toEqual(feet);expect(Math.abs(s.cameraPosition.x-feet.x-offset.x)).toBeLessThan(.02);expect(Math.abs(s.cameraPosition.z-feet.z-offset.z)).toBeLessThan(.02);expect(Math.abs(s.cameraPosition.y-feet.y-PG_BALANCE.eye-offset.y)).toBeLessThan(.02);expect(s.cameraRoll).toBeCloseTo(-s.local.lean*PG_LEAN.roll,2);
    await pilot.mouse.down({button:"right"});await expect.poll(async()=>(await pilotState()).ads).toBeGreaterThan(.9);await pilot.screenshot({path:info.outputPath(`siege-lean-${key}-ads.png`)});await pilot.mouse.up({button:"right"});
   }finally{await pilot.keyboard.up(key);}
   await expect.poll(async()=>Math.abs((await pilotState()).local.lean)).toBeLessThan(.01);
  }
  // Primary crouch remains available while C is the Siege right-lean binding.
  await pilot.keyboard.down("Control");await expect.poll(async()=>(await pilotState()).local.crouched).toBe(true);await pilot.keyboard.up("Control");
  await pilot.keyboard.down("z");await expect.poll(async()=>(await pilotState()).local.lean).toBeLessThan(-.8);await pilot.keyboard.down("Space");await expect.poll(async()=>(await pilotState()).local.grounded).toBe(false);expect((await pilotState()).local.lean).toBe(0);await pilot.keyboard.up("Space");await pilot.keyboard.up("z");
  await pilot.keyboard.press("Escape");await pilot.locator("#pause-leave").click();await expect(pilot.locator("#home-screen")).toBeVisible();
 }finally{await host.close();await guest.close();}
});
