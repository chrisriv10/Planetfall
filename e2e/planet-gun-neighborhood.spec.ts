import {test,expect,type Page} from "@playwright/test";
import {writeFile} from "node:fs/promises";
import {selectExperimentalFamily} from "./select-family";
// Exercise the full Chromium compositor for the new real-input map review.
test.use({channel:"chromium"});
const state=(p:Page)=>p.evaluate(()=>(window as unknown as {__PLANETFALL_PG_DEBUG__:()=>any}).__PLANETFALL_PG_DEBUG__?.());

test("Nova neighborhood adds distinct occupied districts and layered orbital context",async({page},info)=>{
 await page.setViewportSize({width:1280,height:720});await page.goto("/");await page.getByLabel("Name",{exact:true}).fill("Neighborhood Review");await selectExperimentalFamily(page,"planet-gun");
 await page.locator("#settings-open").click();await page.locator("#graphics-quality").selectOption("high");await page.locator("#settings-close").click();
 await page.locator("#play-solo").click();await expect.poll(async()=>(await state(page))?.phase).toBe("playing");await page.locator("#pg-dev-review summary").click();
 for(const view of["serviceInterior","habitatSuite","oblique","orbit"]){await page.locator(`[data-pg-view="${view}"]`).click();await expect.poll(async()=>(await state(page))?.review).toBe(view);await page.waitForTimeout(500);await page.screenshot({path:info.outputPath(`high-${view}.png`)});}
});

test("real clients walk both districts, terrace, upper rooms and authored wall-run loops",async({browser},info)=>{
 // This new scenario walks the entire neighborhood with actual input. The
 // existing individual gameplay deadlines and all prior tests stay unchanged.
 test.setTimeout(240_000);
 const a=await browser.newPage(),b=await browser.newPage(),evidence:unknown[]=[];
 try{
  // Full-size visual capture is a separate scenario. Keep this long input
  // route responsive in software WebGL without changing movement assertions.
  for(const [p,name]of[[a,"Neighborhood Walker"],[b,"Passive Observer"]]as const){await p.setViewportSize({width:640,height:360});await p.goto("/");await p.getByLabel("Name",{exact:true}).fill(name);await selectExperimentalFamily(p,"planet-gun");await p.locator("#settings-open").click();await p.locator("#graphics-quality").selectOption("low");await p.locator("#settings-close").click();}
  await a.locator("#create-room").click();await expect(a.locator("#pg-lobby-screen")).toBeVisible();await a.locator("#pg-fill").uncheck();const code=await a.locator("#pg-code").innerText();
  await b.locator("#room-code").fill(code);await b.locator("#join-room").click();await expect(b.locator("#pg-lobby-screen")).toBeVisible();await b.locator("#pg-ready").click();await a.locator("#pg-ready").click();await a.locator("#pg-start").click();
  for(const p of[a,b])await expect.poll(async()=>(await state(p))?.phase).toBe("playing");
  const page=(await state(a)).local.position.x<0?a:b;await page.bringToFront();expect((await state(page)).local.position.x).toBeLessThan(-30);console.log(`Route initial frame times: ${JSON.stringify((await state(page)).frameTimes.slice(-20))}`);
  const record=async(label:string)=>{const s=await state(page);expect(s.review).toBeNull();expect(s.blocked).toBe(false);expect(s.local.hp).toBe(100);evidence.push({label,position:s.local.position,mode:s.local.mode,wallId:s.local.wallId,ion:s.local.ion,grounded:s.local.grounded});};
  const go=async(x:number,z:number,label?:string,tolerance=.25)=>{
   let arrived=false;
   for(let i=0;i<50;i++){
    const s=(await state(page)).local,dx=x-s.position.x,dz=z-s.position.z;if(i%10===0)console.log(`Route correction ${x},${z} ${JSON.stringify({p:s.position,v:s.velocity})}`);if(Math.hypot(dx,dz)<tolerance&&Math.hypot(s.velocity.x,s.velocity.z)<.1){arrived=true;break;}
    const c=Math.cos(s.yaw),sn=Math.sin(s.yaw),mx=dx*c-dz*sn,mz=dx*sn+dz*c,side=Math.abs(mx)>Math.abs(mz),delta=side?mx:mz,key=side?(delta>0?"d":"a"):(delta>0?"s":"w");
    const precise=Math.hypot(dx,dz)<2;if(precise){await page.keyboard.down("Control");await expect.poll(async()=>(await state(page)).local.crouched).toBe(true);}else await page.keyboard.up("Control");
    const before=(await state(page)).local.position;await page.keyboard.down(key);
    // Short timed pulses can fall wholly between software-WebGL frames. Near
    // a waypoint, keep the ordinary key held until a real movement is seen.
    if(precise){await page.waitForTimeout(Math.max(60,Math.min(320,Math.abs(delta)/3.4*1000-30)));await expect.poll(async()=>{const p=(await state(page)).local.position;return Math.hypot(p.x-before.x,p.z-before.z);},{intervals:[25,50,75]}).toBeGreaterThan(.025);}
    else await page.waitForTimeout(Math.min(650,Math.abs(delta)/7.2*650));
    await page.keyboard.up(key);await page.waitForTimeout(400);
   }
   await page.keyboard.up("Control");expect(arrived,`${label??"route"} ${JSON.stringify((await state(page)).local.position)} -> ${x},${z}`).toBe(true);if(label){await record(label);console.log(`Neighborhood route: ${label}`);}
  };
  const start=(await state(page)).local.position;await go(-40,start.z);await go(-40,2,"solar approach");await go(-25,2);await go(-25,-10.5,"habitat lobby");await page.screenshot({path:info.outputPath("walk-habitat-lobby.png")});
  await go(-26.5,-2.7);await go(-31,-2.7);await go(-31,-13.06,"habitat stairs");await go(-26,-13.06);await go(-26,-17.5,"habitat observation suite");await expect.poll(async()=>(await state(page)).local.position.y).toBeCloseTo(3.5,1);await page.screenshot({path:info.outputPath("walk-habitat-suite.png")});
  await go(-26,-11);await go(-13,-11);await go(-12,-19);await go(-5.9,-19);await go(-5.9,-29.6);await go(-12,-29.6);await go(-12,-24,"raised garden terrace");await expect.poll(async()=>(await state(page)).local.position.y).toBeCloseTo(1.2,1);await page.screenshot({path:info.outputPath("walk-garden-terrace.png")});
  await go(-12,-29.6);await go(-20.13,-29.4,undefined,.1);await page.keyboard.down("d");await expect.poll(async()=>Math.hypot((await state(page)).local.velocity.x,(await state(page)).local.velocity.z)).toBeGreaterThan(6.5);await page.keyboard.down("Space");await expect.poll(async()=>(await state(page)).local.wallId,{intervals:[16,30,50,100]}).toBe("hydro-run-turn");await record("hydro corner wall run");await page.screenshot({path:info.outputPath("walk-hydro-corner-wallrun.png")});await page.keyboard.up("Space");await page.keyboard.up("d");await go(-18,-28);
  await go(-10,-30.13,undefined,.1);await page.keyboard.down("w");await page.keyboard.down("Space");await expect.poll(async()=>(await state(page)).local.wallId,{intervals:[16,30,50,100]}).toBe("hydro-run-north");await record("hydro wall run");await page.screenshot({path:info.outputPath("walk-hydro-wallrun.png")});await page.keyboard.up("Space");await page.keyboard.up("w");
  await go(16,-29);await go(16,-19);await go(11.5,-19);await go(11.5,15.6,"transit street and pier bypass");await go(12.13,18,undefined,.1);await page.keyboard.down("d");await expect.poll(async()=>Math.hypot((await state(page)).local.velocity.x,(await state(page)).local.velocity.z)).toBeGreaterThan(6.5);await page.keyboard.down("Space");await expect.poll(async()=>(await state(page)).local.mode,{intervals:[16,30,50,100]}).toBe("wall-run");await record("ion wall run");await page.screenshot({path:info.outputPath("walk-ion-wallrun.png")});await page.keyboard.up("Space");await page.keyboard.up("d");
  await go(11.5,15.6);await go(15.6,15.6);await go(15.6,27,"ion stairs and control room");await expect.poll(async()=>(await state(page)).local.position.y).toBeCloseTo(3.5,1);await page.screenshot({path:info.outputPath("walk-ion-control.png")});
  // The observatory stair side is a real high riser, not a ground-level exit.
  // Walk back to its north landing before ascending the authored flight.
  await go(15.6,15.6);await go(-2,15.6);await go(-2,25,"maintenance interior");await page.screenshot({path:info.outputPath("walk-maintenance-interior.png")});await go(-2,15.6);
  await go(29,15.6,"observatory interior");await go(29,4.2);await go(32,4.2);await go(32,17.7);await go(32,20);await go(28,20);await go(28,23,"observatory upper gallery");await expect.poll(async()=>(await state(page)).local.position.y).toBeCloseTo(3.5,1);
  await go(38,23);await go(40,29,"void spawn approach");await go(40,-27,"void outer lane");await page.screenshot({path:info.outputPath("walk-void-approach.png")});
 }finally{await writeFile(info.outputPath("neighborhood-route.json"),JSON.stringify(evidence,null,2));await a.close();await b.close();}
});
