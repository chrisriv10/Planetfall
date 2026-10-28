import {test,expect} from "@playwright/test";
import {io} from "socket.io-client";
import {writeFile} from "node:fs/promises";
import {selectExperimentalFamily} from "./select-family";

test.use({video:"on"});
test("a live rejoin preserves equipment and ordinary input mantles the center plinth",async({page},info)=>{
 const observer=io("http://127.0.0.1:13000",{transports:["websocket"],reconnection:false});
 const state=()=>page.evaluate(()=>(window as any).__PLANETFALL_PG_DEBUG__?.());
 const records:unknown[]=[];let code="";
 try{
  await page.setViewportSize({width:640,height:360});await page.goto("/");await page.getByLabel("Name",{exact:true}).fill("Mantle Pilot");await selectExperimentalFamily(page,"planet-gun");
  await page.locator("#settings-open").click();await page.locator("#graphics-quality").selectOption("low");await page.locator("#settings-close").click();
  await page.locator("#create-room").click();await page.locator("#pg-fill").uncheck();code=await page.locator("#pg-code").innerText();
  if(!observer.connected)await new Promise<void>((resolve,reject)=>{observer.once("connect",resolve);observer.once("connect_error",reject);});
  const joined=await observer.timeout(5000).emitWithAck("pg:room:join",{code,name:"Idle Observer"});expect(joined.ok).toBe(true);observer.emit("pg:room:ready",{ready:true});
  await page.locator("#pg-ready").click();await page.locator("#pg-start").click();await expect.poll(async()=>(await state())?.phase).toBe("playing");
  const before=await state();expect(before.local.queuedLoadout).toBeUndefined();
  await page.reload();await selectExperimentalFamily(page,"planet-gun");await page.locator("#room-code").fill(code);await page.locator("#join-room").click();
  await expect.poll(async()=>(await state())?.phase).toBe("playing");expect((await state()).local.id).toBe(before.local.id);expect((await state()).local.queuedLoadout).toBeUndefined();
  const go=async(x:number,z:number)=>{
   for(let i=0;i<40;i++){
    const p=(await state()).local,dx=x-p.position.x,dz=z-p.position.z;if(Math.hypot(dx,dz)<.18&&Math.hypot(p.velocity.x,p.velocity.z)<.2)return;
    const c=Math.cos(p.yaw),s=Math.sin(p.yaw),mx=dx*c-dz*s,mz=dx*s+dz*c,side=Math.abs(mx)>Math.abs(mz),delta=side?mx:mz,key=side?(delta>0?"d":"a"):(delta>0?"s":"w");
    const precise=Math.hypot(dx,dz)<2;if(precise)await page.keyboard.down("Control");else await page.keyboard.up("Control");
    await page.keyboard.down(key);await page.waitForTimeout(Math.max(80,Math.min(700,Math.abs(delta)/(precise?3.4:7.2)*800)));await page.keyboard.up(key);await page.waitForTimeout(250);
   }
   throw Error(`Route blocked at ${JSON.stringify((await state()).local.position)} toward ${x},${z}`);
  };
  await go(-40,4.4);await go(-12,4.4);await page.keyboard.up("Control");records.push({label:"approach",state:await state()});
  // Solar spawn faces east (-pi/2); forward approaches the west face.
  expect((await state()).local.yaw).toBeCloseTo(-Math.PI/2,2);
  await page.keyboard.down("w");await expect.poll(async()=>(await state()).local.position.x).toBeGreaterThan(-10.65);await page.keyboard.down("Space");
  await expect.poll(async()=>(await state()).local.mode,{intervals:[16,30,50]}).toBe("mantle");records.push({label:"mantle",state:await state()});await page.screenshot({path:info.outputPath("actual-mantle.png")});
  await page.keyboard.up("w");await page.keyboard.up("Space");await expect.poll(async()=>(await state()).local.position.y).toBeCloseTo(1.5,1);await expect.poll(async()=>(await state()).local.grounded).toBe(true);
  const landed=await state();expect(landed.local.hp).toBe(100);expect(landed.movement.modes.mantle).toBeGreaterThan(0);records.push({label:"landed",state:landed});await page.screenshot({path:info.outputPath("plinth-landed.png")});
 }finally{
  await page.keyboard.up("w");await page.keyboard.up("Space");await page.keyboard.up("Control");
  await writeFile(info.outputPath("mantle-route.json"),JSON.stringify(records,null,2));
  if(code&&observer.connected)await observer.timeout(1500).emitWithAck("room:leave",{code}).catch(()=>{});observer.disconnect();
 }
});
