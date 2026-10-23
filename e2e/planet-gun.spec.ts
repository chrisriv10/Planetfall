import {PG_MAP,pgRayBox} from "@planetfall/shared";
import {test,expect,type Page} from "@playwright/test";
import {selectExperimentalFamily} from "./select-family";
import {writeFile} from "node:fs/promises";
const state=(page:Page)=>page.locator("#pg-dev-state").textContent().then(s=>s?JSON.parse(s):null);
test("PlanetGun warning, lobby, FPS movement, combat controls and clean exit",async({page},info)=>{
 const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
 await page.goto("/");await page.getByLabel("Name",{exact:true}).fill("Nova Pilot");await selectExperimentalFamily(page,"planet-gun");
 await page.locator("#create-room").click();await expect(page.locator("#pg-lobby-screen")).toBeVisible();
 await page.mouse.click(1200,300);expect(await page.evaluate(()=>document.pointerLockElement===null)).toBe(true);
 await page.locator("#pg-target").selectOption("4");await page.locator("#pg-loadout").selectOption("nova");
 await page.locator("#pg-ready").click();await page.locator("#pg-start").click();
 await expect.poll(async()=>(await state(page))?.phase).toBe("playing");
 const before=(await state(page)).local.position;await page.keyboard.down("w");await page.waitForTimeout(700);await page.keyboard.up("w");
 await expect.poll(async()=>{const p=(await state(page)).local.position;return Math.hypot(p.x-before.x,p.z-before.z);}).toBeGreaterThan(2);
 await page.keyboard.down("Space");await page.waitForTimeout(300);await page.keyboard.up("Space");await expect.poll(async()=>(await state(page)).local.position.y).toBeGreaterThan(.6);
 await page.mouse.move(700,400);await page.mouse.down();await page.waitForTimeout(350);await page.mouse.up();
 await expect.poll(async()=>(await state(page)).local.guns[0].magazine).toBeLessThan(36);await page.screenshot({path:info.outputPath("pre-reload.png")});
 await page.keyboard.down("Control");await page.keyboard.press("r");await page.keyboard.up("Control");await expect(page.locator("#pg-ammo")).toContainText("RELOADING");
 await page.keyboard.press("2");await expect(page.locator("#pg-ammo")).toContainText("Comet");
 await page.keyboard.down("Shift");await page.keyboard.down("w");await expect.poll(async()=>(await state(page)).local.mode).toBe("sprint");await page.mouse.click(700,400);await page.keyboard.up("Shift");await page.keyboard.up("w");await expect.poll(async()=>(await state(page)).local.guns[1].magazine).toBeLessThan(9);
 await page.keyboard.press("Escape");await expect(page.locator("#pause-overlay")).toBeVisible();expect(await page.evaluate(()=>document.pointerLockElement===null)).toBe(true);
 await page.locator("#resume-button").click();await page.keyboard.press("Tab");await expect(page.locator("#pg-scoreboard")).toBeVisible();await expect.poll(async()=>(await state(page)).blocked).toBe(true);
 await page.locator("#pg-scoreboard-close").click();await page.screenshot({path:info.outputPath("nova-block-fps.png")});
 await page.keyboard.press("Escape");await page.locator("#pause-leave").click();await expect(page.locator("#home-screen")).toBeVisible();await expect(page.locator("#pg-hud")).toBeHidden();
 await page.locator("#family-planetfall").click();await page.locator("#create-room").click();await expect(page.locator("#lobby-screen")).toBeVisible();expect(errors).toEqual([]);
});

for(const quality of ["low","medium","high","auto"])test(`PlanetGun actual arena review and rendering samples at ${quality}`,async({page},info)=>{
 await page.goto("/");await page.getByLabel("Name",{exact:true}).fill("Arena Review");await selectExperimentalFamily(page,"planet-gun");
 await page.locator("#settings-open").click();await page.locator("#graphics-quality").selectOption(quality);await page.locator("#settings-close").click();
 await page.locator("#play-solo").click();await expect.poll(async()=>(await state(page))?.phase).toBe("playing");
 await page.locator("#pg-dev-review summary").click();const samples:unknown[]=[];
 for(const view of ["overhead","solar","void","center","left","right","upper","wallRun","westInterior","eastInterior"]){
  await page.locator(`[data-pg-view="${view}"]`).click();await expect.poll(async()=>(await state(page))?.review).toBe(view);
  await page.waitForTimeout(1500);const current=await state(page),frames=current.frameTimes.slice(-20).sort((a:number,b:number)=>a-b);
  expect(current.calls).toBeGreaterThan(0);expect(current.triangles).toBeGreaterThan(0);expect(Number.isFinite(current.local.position.y)).toBe(true);
  samples.push({requestedQuality:quality,view,...current,medianFrameMs:frames[Math.floor(frames.length*.5)],p95FrameMs:frames[Math.floor(frames.length*.95)]});
  await page.screenshot({path:info.outputPath(`${quality}-${view}.png`)});
 }
 await writeFile(info.outputPath("render-samples.json"),JSON.stringify(samples,null,2));
});

test("two opposing FPS clients traverse Nova Block, register a scoped hit and respawn",async({browser},info)=>{
 const a=await browser.newPage(),b=await browser.newPage();
 try{
  for(const [page,name]of [[a,"Solar Test"],[b,"Void Test"]]as const){await page.goto("/");await page.getByLabel("Name",{exact:true}).fill(name);await selectExperimentalFamily(page,"planet-gun");}
  await a.locator("#create-room").click();await expect(a.locator("#pg-lobby-screen")).toBeVisible();const code=await a.locator("#pg-code").innerText();await a.locator("#pg-fill").uncheck();
  await b.locator("#room-code").fill(code);await b.locator("#join-room").click();await expect(b.locator("#pg-lobby-screen")).toBeVisible();
  for(const page of [a,b]){await page.locator("#pg-loadout").selectOption("rail");await page.locator("#pg-ready").click();}
  await a.locator("#pg-start").click();for(const page of [a,b])await expect.poll(async()=>(await state(page))?.phase).toBe("playing");
  // Spawn safety can flip anchors: route from the actual positions through the shared southern passage.
  for(const page of [a,b]){
   let p=(await state(page)).local,d=17.4-p.position.z;
   let key=Math.sign(d)*-Math.sin(p.yaw)>0?"d":"a";
   await page.keyboard.down(key);await page.waitForTimeout(Math.max(30,(Math.abs(d)-1)/7.2*1000));await page.keyboard.up(key);await page.waitForTimeout(550);
   await page.keyboard.down("Control");
   for(let i=0;i<7;i++){p=(await state(page)).local;d=17.4-p.position.z;if(Math.abs(d)<.2)break;key=Math.sign(d)*-Math.sin(p.yaw)>0?"d":"a";await page.keyboard.down(key);await page.waitForTimeout(Math.max(40,Math.min(300,Math.abs(d)*140)));await page.keyboard.up(key);await page.waitForTimeout(550);}
   await page.keyboard.up("Control");
   expect(Math.abs((await state(page)).local.position.z-17.4)).toBeLessThan(.25);
  }

  await a.keyboard.down("w");await b.keyboard.down("w");await a.waitForTimeout(4500);await a.keyboard.up("w");await b.keyboard.up("w");
  await expect.poll(async()=>Math.hypot((await state(a)).local.velocity.x,(await state(a)).local.velocity.z)).toBeLessThan(.1);
  // Exit the hydroponics wall-run corner before testing a clear shot.
  for(const page of [a,b]){
   await page.keyboard.down("Control");
   for(let i=0;i<8;i++){const p=(await state(page)).local,d=15.6-p.position.z;if(Math.abs(d)<.2)break;const key=Math.sign(d)*-Math.sin(p.yaw)>0?"d":"a";await page.keyboard.down(key);await page.waitForTimeout(Math.max(40,Math.min(300,Math.abs(d)*140)));await page.keyboard.up(key);await page.waitForTimeout(550);}
   await page.keyboard.up("Control");
   expect(Math.abs((await state(page)).local.position.z-15.6)).toBeLessThan(.3);
  }
  for(const page of [a,b])expect(await page.evaluate(()=>window.getSelection()?.toString()??"" )).toBe("");
  const shooter=(await state(a)).local,target=(await state(b)).local;expect(Math.abs(shooter.position.x)).toBeLessThan(20);expect(Math.abs(target.position.x)).toBeLessThan(20);
  const desiredYaw=Math.atan2(shooter.position.x-target.position.x,shooter.position.z-target.position.z),yawDelta=Math.atan2(Math.sin(desiredYaw-shooter.yaw),Math.cos(desiredYaw-shooter.yaw)),pitch=Math.atan2(target.position.y+1.53-shooter.position.y-1.57,Math.hypot(target.position.x-shooter.position.x,target.position.z-shooter.position.z));
  const origin={...shooter.position,y:shooter.position.y+1.57},distance=Math.hypot(target.position.x-origin.x,target.position.y+1.53-origin.y,target.position.z-origin.z),direction={x:(target.position.x-origin.x)/distance,y:(target.position.y+1.53-origin.y)/distance,z:(target.position.z-origin.z)/distance};
  expect(PG_MAP.solids.some(s=>{const hit=pgRayBox(origin,direction,s);return hit!==null&&hit<distance;})).toBe(false);
  await a.mouse.move(640,360);await a.mouse.down({button:"right"});await expect.poll(async()=>(await state(a)).cameraFov).toBeLessThan(40);await expect.poll(async()=>(await state(a)).ads).toBeGreaterThan(.9);await a.screenshot({path:info.outputPath("rail-held-ads.png")});await a.mouse.move(640-yawDelta/(.0022*.48),360-pitch/(.0022*.48),{steps:3});await a.waitForTimeout(120);await a.mouse.down();await a.waitForTimeout(180);await a.mouse.up();await a.mouse.up({button:"right"});
  await a.screenshot({path:info.outputPath("combat-before-confirm.png")});
  await writeFile(info.outputPath("combat-debug.json"),JSON.stringify({shooter,target,afterShooter:(await state(a)).local,afterTarget:(await state(b)).local},null,2));
  await expect.poll(async()=>{const p=(await state(b)).local;return p.hp<100||p.deaths>0;}).toBe(true);
  await a.screenshot({path:info.outputPath("opposing-client-combat.png")});
 }finally{await a.close();await b.close();}
});
