import {test,expect,type Page} from "@playwright/test";
import {writeFile} from "node:fs/promises";
import {PG_BALANCE,type PgModeSnapshot,type PgSnapshotPlayer} from "@planetfall/shared";
import {selectExperimentalFamily} from "./select-family";

test.use({channel:"chromium"});
interface DebugState {local:PgSnapshotPlayer;mode:PgModeSnapshot;collisionRevision:number;players:number;}
// Observations only: all selection, movement, combat and abilities use normal browser input.
const state=(page:Page)=>page.evaluate(()=>(window as unknown as {__PLANETFALL_PG_DEBUG__:()=>DebugState}).__PLANETFALL_PG_DEBUG__?.());
async function mode<M extends PgModeSnapshot["id"]>(page:Page,id:M){
 const value=(await state(page)).mode;if(value.id!==id)throw Error(`Expected ${id}, observed ${value.id}`);
 return value as Extract<PgModeSnapshot,{id:M}>;
}
async function prepare(page:Page,name:string){
 await page.setViewportSize({width:960,height:540});await page.goto("/");
 await page.getByLabel("Name",{exact:true}).fill(name);await selectExperimentalFamily(page,"planet-gun");
 await page.locator("#settings-open").click();await page.locator("#graphics-quality").selectOption("low");await page.locator("#settings-close").click();
}
async function start(a:Page,b:Page,id:"planetwatch"|"planetsiege"){
 await prepare(a,"Ability Attacker");await prepare(b,"Ability Defender");
 await a.locator("#create-room").click();await a.getByLabel("PlanetGun submode").selectOption(id);await a.locator("#pg-fill").uncheck();
 await b.locator("#room-code").fill(await a.locator("#pg-code").innerText());await b.locator("#join-room").click();
 await a.locator("#pg-lobby-screen .pg-character-card").filter({has:a.locator("strong",{hasText:id==="planetwatch"?"Cairn":"Rivet"})}).click();
 if(id==="planetwatch")await b.locator("#pg-lobby-screen .pg-character-card").filter({has:b.locator("strong",{hasText:"Cinder"})}).click();
 await b.locator("#pg-ready").click();await a.locator("#pg-ready").click();await a.locator("#pg-start").click();
 for(const page of[a,b])await expect.poll(async()=>(await state(page))?.mode?.id).toBe(id);
 await expect.poll(async()=>(await state(a)).players).toBe(2);
}
function movementKey(yaw:number,dx:number,dz:number){
 const c=Math.cos(yaw),s=Math.sin(yaw),mx=dx*c-dz*s,mz=dx*s+dz*c;
 return Math.abs(mx)>Math.abs(mz)?{key:mx>0?"d":"a",delta:mx}:{key:mz>0?"s":"w",delta:mz};
}
async function go(page:Page,x:number,z:number){
 await page.bringToFront();
 try{for(let i=0;i<100;i++){
  const p=(await state(page)).local,dx=x-p.position.x,dz=z-p.position.z,distance=Math.hypot(dx,dz);
  if(distance<.35&&Math.hypot(p.velocity.x,p.velocity.z)<.2)return;
  const {key,delta}=movementKey(p.yaw,dx,dz),near=distance<2;
  if(near)await page.keyboard.down("Control");else await page.keyboard.up("Control");
  await page.keyboard.down(key);
  try{await page.waitForTimeout(near?Math.max(90,Math.min(250,Math.abs(delta)/2.5*650)):Math.min(600,Math.abs(delta)/4.5*650));}finally{await page.keyboard.up(key);}
  await page.waitForTimeout(120);
 }}finally{await page.keyboard.up("Control");}
 throw Error(`Keyboard route failed ${(JSON.stringify((await state(page)).local.position))} -> ${x},${z}`);
}
async function pushToward(page:Page,dx:number,dz:number,ms:number){
 await page.bringToFront();const {key}=movementKey((await state(page)).local.yaw,dx,dz);await page.keyboard.down(key);
 try{await page.waitForTimeout(ms);}finally{await page.keyboard.up(key);}await page.waitForTimeout(250);
}

test("PlanetWatch Cairn barrier stops walking and takes enemy shots; Brace Pulse damages a real opponent",async({browser},info)=>{
 test.setTimeout(180000);const a=await browser.newPage(),b=await browser.newPage();
 try{
  await start(a,b,"planetwatch");
  // The north outer deck is a clear ground route outside both protected spawn regions.
  const ap=(await state(a)).local.position,bp=(await state(b)).local.position;
  await go(a,-40,ap.z);await go(a,-40,-34);await go(a,-30,-34);
  await go(b,40,bp.z);await go(b,40,-34);await go(b,-21.5,-34);
  expect((await state(a)).local.team).not.toBe((await state(b)).local.team);
  expect((await mode(a,"planetwatch")).pilots[(await state(a)).local.id].characterId).toBe("cairn");
  expect((await mode(b,"planetwatch")).pilots[(await state(b)).local.id].characterId).toBe("cinder");
  const before=await state(a);await a.bringToFront();await a.keyboard.press("q");
  await expect.poll(async()=>(await mode(a,"planetwatch")).collision.panels.filter(p=>p.active).length,{timeout:3000}).toBe(1);
  const deployed=(await mode(a,"planetwatch")).collision.panels.find(p=>p.active)!;
  expect(deployed.hp).toBe(450);expect(deployed.solid.center.x).toBeCloseTo(-25,0);
  expect((await mode(a,"planetwatch")).pilots[before.local.id].cooldowns[0]).toBeGreaterThan(before.mode.pilots[before.local.id].cooldowns[0]);
  await pushToward(a,1,0,1300);
  const blocked=(await state(a)).local;expect(blocked.position.x).toBeGreaterThan(-27);expect(blocked.position.x).toBeLessThan(-25.45);
  await a.screenshot({path:info.outputPath("watch-rampart-blocks-walking.png")});
  await b.bringToFront();await b.locator("#game-canvas").click({button:"left",position:{x:480,y:270}});
  await expect.poll(async()=>(await mode(b,"planetwatch")).collision.panels.find(p=>p.id===deployed.id)?.hp,{timeout:2500}).toBeLessThan(450);
  const damaged=(await mode(b,"planetwatch")).collision.panels.find(p=>p.id===deployed.id)!;
  expect(damaged.active).toBe(true);expect(damaged.hp).toBeGreaterThan(0);expect((await state(a)).local.hp).toBe(before.local.hp);
  await b.screenshot({path:info.outputPath("watch-enemy-shot-damages-rampart.png")});
  await expect.poll(async()=>(await mode(a,"planetwatch")).collision.panels.find(p=>p.id===deployed.id)?.active,{timeout:10000}).not.toBe(true);
  await go(a,-24.5,-34);const victim=await state(b);await a.bringToFront();await a.keyboard.press("f");
  await expect.poll(async()=>(await state(b)).local.hp,{timeout:3000}).toBe(victim.local.hp-25);
  await expect.poll(async()=>(await state(b)).local.position.x,{timeout:3000}).toBeGreaterThan(victim.local.position.x+.1);
  await writeFile(info.outputPath("watch-ability-result.json"),JSON.stringify({deployed,damaged,attacker:await state(a),defender:await state(b)},null,2));
  await a.screenshot({path:info.outputPath("watch-brace-pulse-real-damage.png")});
 }finally{await a.close();await b.close();}
});

test("PlanetSiege prepares a doorway, physically breaches it and wins by fifteen seconds of uplink capture",async({browser},info)=>{
 test.setTimeout(180000);const a=await browser.newPage(),b=await browser.newPage();
 try{
  await start(a,b,"planetsiege");const initial=await state(a),attackerId=initial.local.id,defenderId=(await state(b)).local.id;
  expect(initial.mode.pilots[attackerId].characterId).toBe("rivet");expect(initial.mode.pilots[attackerId].side).toBe("attack");
  expect((await mode(b,"planetsiege")).subphase).toBe("prepare");
  await go(b,-25,-9);await go(b,-25,-3);await b.keyboard.press("f");
  await expect.poll(async()=>(await mode(b,"planetsiege")).collision.panels.find(p=>p.id==="west-south")?.active,{timeout:3000}).toBe(true);
  const prepared=(await mode(b,"planetsiege")).collision.panels.find(p=>p.id==="west-south")!;
  expect(prepared.hp).toBe(100);expect(prepared.reinforced).toBe(false);
  await b.screenshot({path:info.outputPath("siege-preparation-ordinary-barricade.png")});
  // Keep the sole defender alive and outside capture, so elimination cannot award this round.
  await go(b,-28,-3);
  await expect.poll(async()=>(await mode(a,"planetsiege")).subphase,{timeout:40000}).toBe("action");
  await go(a,-40,2);await go(a,-25,2);await go(a,-25,.8);
  await pushToward(a,0,-1,900);expect((await state(a)).local.position.z).toBeCloseTo(prepared.solid.center.z+prepared.solid.half.z+PG_BALANCE.radius,1);
  const beforeBreach=await mode(a,"planetsiege");await a.keyboard.press("q");
  await expect.poll(async()=>(await mode(a,"planetsiege")).effects.some(e=>e.kind==="breach"),{timeout:1000}).toBe(true);
  await a.screenshot({path:info.outputPath("siege-rivet-breach-warning.png")});
  await expect.poll(async()=>(await mode(a,"planetsiege")).collision.panels.find(p=>p.id==="west-south")?.active,{timeout:4000}).toBe(false);
  const breached=await mode(a,"planetsiege");expect(breached.collision.revision).toBeGreaterThan(beforeBreach.collision.revision);
  expect(breached.pilots[attackerId].charges[0]).toBe(beforeBreach.pilots[attackerId].charges[0]-1);
  await go(a,-25,-3);expect((await state(a)).local.position.z).toBeLessThan(-2.5);
  await a.screenshot({path:info.outputPath("siege-player-walks-through-real-breach.png")});
  await go(a,-25,-9);await go(a,-28,-9);
  await expect.poll(async()=>(await mode(a,"planetsiege")).capture,{timeout:4000}).toBeGreaterThan(.1);
  const capturing=await mode(a,"planetsiege");expect(capturing.pilots[defenderId].life).toBe("alive");
  expect((await state(b)).local.hp).toBeGreaterThan(0);await a.screenshot({path:info.outputPath("siege-uncontested-uplink-capture.png")});
  await expect.poll(async()=>(await mode(a,"planetsiege")).roundScores[initial.local.team],{timeout:19000}).toBe(1);
  const result=await mode(a,"planetsiege");expect(result.capture).toBe(1);expect(result.pilots[defenderId].life).toBe("alive");expect((await state(b)).local.hp).toBeGreaterThan(0);
  await writeFile(info.outputPath("siege-breach-capture-result.json"),JSON.stringify({prepared,breached,capturing,result,attacker:await state(a),defender:await state(b)},null,2));
  await a.screenshot({path:info.outputPath("siege-capture-round-victory.png")});
 }finally{await a.close();await b.close();}
});
