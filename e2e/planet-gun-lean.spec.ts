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
  await expect.poll(async()=>(await state())?.mode?.subphase).toBe("prepare");await host.keyboard.down("c");await host.waitForTimeout(250);expect((await state()).local.lean).toBe(0);await host.keyboard.up("c");
  await expect.poll(async()=>(await state()).mode.subphase,{timeout:40000}).toBe("action");await capturePgMouse(host);const baseline=await state(),feet=baseline.local.position,id=baseline.local.id;
  for(const[key,direction]of [["z",-1],["c",1]]as const){
   await host.keyboard.down(key);
   try{
    await expect.poll(async()=>(await state()).local.lean*direction).toBeGreaterThan(.98);
    await expect.poll(async()=>(await state(guest)).remotePilots.find((p:any)=>p.id===id)?.lean*direction).toBeGreaterThan(.98);
    const s=await state(),offset={x:Math.cos(s.local.yaw)*PG_LEAN.distance*s.local.lean,y:-Math.abs(s.local.lean)*PG_LEAN.drop,z:-Math.sin(s.local.yaw)*PG_LEAN.distance*s.local.lean};
    expect(s.local.position).toEqual(feet);expect(Math.abs(s.cameraPosition.x-feet.x-offset.x)).toBeLessThan(.02);expect(Math.abs(s.cameraPosition.z-feet.z-offset.z)).toBeLessThan(.02);expect(Math.abs(s.cameraPosition.y-feet.y-PG_BALANCE.eye-offset.y)).toBeLessThan(.02);expect(s.cameraRoll).toBeCloseTo(-s.local.lean*PG_LEAN.roll,2);
    await host.mouse.down({button:"right"});await expect.poll(async()=>(await state()).ads).toBeGreaterThan(.9);await host.screenshot({path:info.outputPath(`siege-lean-${key}-ads.png`)});await host.mouse.up({button:"right"});
   }finally{await host.keyboard.up(key);}
   await expect.poll(async()=>Math.abs((await state()).local.lean)).toBeLessThan(.01);
  }
  // Primary crouch remains available while C is the Siege right-lean binding.
  await host.keyboard.down("Control");await expect.poll(async()=>(await state()).local.crouched).toBe(true);await host.keyboard.up("Control");
  await host.keyboard.down("z");await expect.poll(async()=>(await state()).local.lean).toBeLessThan(-.8);await host.keyboard.down("Space");await expect.poll(async()=>(await state()).local.grounded).toBe(false);expect((await state()).local.lean).toBe(0);await host.keyboard.up("Space");await host.keyboard.up("z");
  await host.keyboard.press("Escape");await host.locator("#pause-leave").click();await expect(host.locator("#home-screen")).toBeVisible();
 }finally{await host.close();await guest.close();}
});
