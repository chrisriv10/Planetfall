import {test,expect,type Page} from "@playwright/test";
import {io as connect,type Socket} from "socket.io-client";
import {writeFile} from "node:fs/promises";
import {selectExperimentalFamily} from "./select-family";
import type {PgJoinResult} from "@planetfall/shared";
test.use({channel:"chromium"});
const state=(p:Page)=>p.evaluate(()=>(window as unknown as {__PLANETFALL_PG_DEBUG__:()=>any}).__PLANETFALL_PG_DEBUG__?.());
async function prepare(p:Page,name:string){await p.setViewportSize({width:960,height:540});await p.goto("/");await p.getByLabel("Name",{exact:true}).fill(name);await selectExperimentalFamily(p,"planet-gun");await p.locator("#settings-open").click();await p.locator("#graphics-quality").selectOption("low");await p.locator("#settings-close").click();}
async function go(page:Page,x:number,z:number){
 for(let i=0;i<100;i++){
  const s=(await state(page)).local,dx=x-s.position.x,dz=z-s.position.z;if(Math.hypot(dx,dz)<.35&&Math.hypot(s.velocity.x,s.velocity.z)<.2){await page.keyboard.up("Control");return;}
  const c=Math.cos(s.yaw),sn=Math.sin(s.yaw),mx=dx*c-dz*sn,mz=dx*sn+dz*c,side=Math.abs(mx)>Math.abs(mz),delta=side?mx:mz,key=side?(delta>0?"d":"a"):(delta>0?"s":"w");
  const near=Math.hypot(dx,dz)<2;if(near)await page.keyboard.down("Control");else await page.keyboard.up("Control");
  await page.keyboard.down(key);await page.waitForTimeout(near?Math.max(90,Math.min(250,Math.abs(delta)/2.5*650)):Math.min(600,Math.abs(delta)/4.5*650));await page.keyboard.up(key);await page.waitForTimeout(120);
 }
 throw Error(`Route failed ${JSON.stringify((await state(page)).local.position)} -> ${x},${z}`);
}
test("two real clients plant and defuse a charge using uninterrupted held input",async({browser},info)=>{
 test.setTimeout(240000);const a=await browser.newPage(),b=await browser.newPage();
 try{
  await prepare(a,"Charge Carrier");await prepare(b,"Defuse Pilot");await a.locator("#create-room").click();await a.getByLabel("PlanetGun submode").selectOption("planetstrike");await a.locator("#pg-fill").uncheck();const code=await a.locator("#pg-code").innerText();await b.locator("#room-code").fill(code);await b.locator("#join-room").click();await b.locator("#pg-ready").click();await a.locator("#pg-ready").click();await a.locator("#pg-start").click();for(const p of[a,b])await expect.poll(async()=>(await state(p))?.mode?.id).toBe("planetstrike");
  await a.bringToFront();await go(a,-40,2);await go(a,-25,2);await go(a,-25,-9);await go(a,-28,-9);
  await b.bringToFront();await go(b,40,-19);await go(b,-28,-19);await go(b,-28,-8);
  await expect.poll(async()=>(await state(a)).mode.subphase,{timeout:25000}).toBe("action");
  await a.bringToFront();await a.keyboard.down("e");await expect.poll(async()=>(await state(a)).mode.charge.site,{timeout:7000}).toBe("A");await a.waitForTimeout(350);await a.keyboard.up("e");await a.keyboard.press("e");await a.waitForTimeout(200);await expect(a.getByText("Invalid charge interaction",{exact:true})).toBeHidden();await a.screenshot({path:info.outputPath("strike-charge-planted.png")});
  await b.bringToFront();await b.keyboard.down("e");await expect.poll(async()=>{const s=await state(b);return s.mode.pilots[s.local.id].interaction?.targetId;}).toBe("charge");await b.screenshot({path:info.outputPath("strike-defuse-held.png")});await expect.poll(async()=>(await state(b)).mode.roundScores.void,{timeout:9000}).toBe(1);await b.keyboard.up("e");
  await b.waitForTimeout(200);await expect(b.getByText("Wait for the action phase",{exact:true})).toBeHidden();const result=await state(b);expect(result.mode.charge.site).toBeNull();await writeFile(info.outputPath("strike-objective-result.json"),JSON.stringify(result,null,2));await b.screenshot({path:info.outputPath("strike-defenders-round-win.png")});
  await expect.poll(async()=>(await state(b)).mode.subphase,{timeout:10000}).toBe("buy");
  await b.keyboard.press("b");await b.locator(".pg-mode-menu").getByRole("button",{name:/^Pulse Rifle ·/}).click();await b.keyboard.press("b");
  await expect.poll(async()=>{const s=await state(b);return s.mode.pilots[s.local.id].primaryUnlocked;}).toBe(true);
  await expect.poll(async()=>(await state(b)).mode.subphase,{timeout:25000}).toBe("action");
  const inventory=(await state(b)).local.guns[0];await b.keyboard.press("x");
  await expect.poll(async()=>(await state(b)).mode.drops.some((d:any)=>d.kind==="weapon"&&d.weapon==="pulse")).toBe(true);
  const dropped=(await state(b)).mode.drops.find((d:any)=>d.kind==="weapon"&&d.weapon==="pulse");expect(dropped.position.y).toBe(0);
  await b.keyboard.press("b");
  await b.evaluate(()=>Object.defineProperty(navigator,"getGamepads",{configurable:true,value:()=>[{connected:true,axes:[0,0,0,0],buttons:Array.from({length:16},(_,i)=>({pressed:i===11,value:i===11?1:0}))}]}));
  await b.waitForTimeout(700);expect((await state(b)).mode.pilots[(await state(b)).local.id].primaryUnlocked).toBe(false);
  await b.evaluate(()=>Reflect.deleteProperty(navigator,"getGamepads"));await b.keyboard.press("b");
  await b.locator("#game-canvas").click({position:{x:480,y:270}});await b.keyboard.down("s");await b.waitForTimeout(250);await b.keyboard.up("s");await b.mouse.move(480,740,{steps:5});await b.waitForTimeout(250);
  await b.screenshot({path:info.outputPath("strike-supported-weapon-drop.png")});
  await b.keyboard.press("e");await expect.poll(async()=>{const s=await state(b);return s.mode.pilots[s.local.id].primaryUnlocked;}).toBe(true);
  const recovered=await state(b);expect(recovered.local.guns[0].id).toBe("pulse");expect(recovered.local.guns[0].magazine).toBe(inventory.magazine);expect(recovered.local.guns[0].reserve).toBe(inventory.reserve);expect(recovered.mode.drops.some((d:any)=>d.id===dropped.id)).toBe(false);
  await writeFile(info.outputPath("strike-drop-recovery.json"),JSON.stringify({dropped,recovered},null,2));
 }finally{await a.close();await b.close();}
});

for(const mode of ["planetwatch","planetsiege"] as const)test(`${mode} full roster in-world character identities and quality samples`,async({browser},info)=>{
 test.setTimeout(180000);const a=await browser.newPage(),b=await browser.newPage(),idle:Socket[]=[];const samples:unknown[]=[];
 try{
  await prepare(a,"Solar Review");await prepare(b,"Void Review");await a.locator("#create-room").click();await a.getByLabel("PlanetGun submode").selectOption(mode);await a.locator("#pg-fill").uncheck();const code=await a.locator("#pg-code").innerText();await b.locator("#room-code").fill(code);await b.locator("#join-room").click();
  for(let i=0;i<10;i++){const c=connect("http://127.0.0.1:13000",{forceNew:true,transports:["websocket"],extraHeaders:{Origin:"http://127.0.0.1:15173"}});idle.push(c);await new Promise<void>((resolve,reject)=>{c.once("connect",resolve);c.once("connect_error",reject);});const j=await new Promise<PgJoinResult>(r=>c.emit("pg:room:join",{code,name:`Review Pilot ${i}`},r));expect(j.ok).toBe(true);c.emit("pg:room:ready",{ready:true});}
  await b.locator("#pg-ready").click();await a.locator("#pg-ready").click();await a.locator("#pg-start").click();for(const p of[a,b])await expect.poll(async()=>(await state(p))?.mode?.id).toBe(mode);
  const seen=new Set<string>();
  for(const p of[a,b]){await p.bringToFront();await p.locator("#pg-dev-review summary").click();const s=await state(p),own=s.local.team;const ids=Object.entries(s.mode.pilots).filter(([id,v])=>{const pilot=id===s.local.id?s.local:s.remotePilots.find((p:any)=>p.id===id);return pilot?.team===own&&!!(v as any).characterId;});
   for(const [id,v]of ids){const character=(v as any).characterId;if(mode==="planetwatch"&&seen.has(character))continue;await p.locator(`[data-pg-pilot="${id}"]`).click();await expect.poll(async()=>(await state(p)).reviewPilot).toBe(id);await expect.poll(async()=>{const s=await state(p);return s.pilotDetail.near+s.pilotDetail.mid+s.pilotDetail.far;}).toBe(1);await p.waitForTimeout(200);await p.screenshot({path:info.outputPath(`${mode}-${character}-in-world.png`)});seen.add(character);}
  }
  expect(seen.size).toBe(mode==="planetwatch"?6:12);
  await a.locator('[data-pg-view="player"]').click();await expect.poll(async()=>(await state(a)).reviewPilot).toBeNull();
  await expect.poll(async()=>{const s=await state(a);return s.pilotDetail.near+s.pilotDetail.mid+s.pilotDetail.far;}).toBe(11);
  await a.bringToFront();for(const quality of["high","medium","low","auto"]){await a.keyboard.press("Escape");await a.locator("#pause-settings").click();await a.locator("#graphics-quality").selectOption(quality);await a.locator("#settings-close").click();await a.locator("#resume-button").click();await a.waitForTimeout(4200);const s=await state(a),frames=s.frameTimes.slice(-60).sort((x:number,y:number)=>x-y);samples.push({mode,quality,renderer:s.renderer,players:s.players,reviewPilot:s.reviewPilot,pilotDetail:s.pilotDetail,resolvedQuality:s.resolvedQuality,p50FrameMs:frames[Math.floor(frames.length*.5)],p95FrameMs:frames[Math.floor(frames.length*.95)],drawCalls:s.calls,triangles:s.triangles,instances:s.visibleInstances,materials:s.materialCount,geometries:s.geometries,textures:s.textures,profile:s.profile});}
  await writeFile(info.outputPath(`${mode}-full-roster-rendering.json`),JSON.stringify(samples,null,2));
 }finally{for(const c of idle)c.disconnect();await a.close();await b.close();}
});
