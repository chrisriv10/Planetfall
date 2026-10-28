import {test,expect} from "@playwright/test";
import {writeFile} from "node:fs/promises";
import {selectExperimentalFamily} from "./select-family";

for(const rtt of [0,40,80,120])test(`PlanetGun prediction remains responsive at ${rtt}ms RTT with ordered jitter`,async({page},info)=>{
 const timers=new Set<ReturnType<typeof setTimeout>>();let sequence=0;
 await page.routeWebSocket(/socket\.io/,ws=>{
  const server=ws.connectToServer();let lastUp=0,lastDown=0;
  const send=(message:string|Buffer,up:boolean)=>{
   const jitter=rtt?((++sequence*7)%9)-4:0,now=Date.now();
   const at=Math.max(now+rtt/2+jitter,(up?lastUp:lastDown)+1);
   if(up)lastUp=at;else lastDown=at;
   const timer=setTimeout(()=>{timers.delete(timer);try{if(up)server.send(message);else ws.send(message);}catch{}},Math.max(0,at-now));timers.add(timer);
  };
  ws.onMessage(message=>send(message,true));server.onMessage(message=>send(message,false));
 });
 const state=()=>page.evaluate(()=>(window as unknown as {__PLANETFALL_PG_DEBUG__?:()=>any}).__PLANETFALL_PG_DEBUG__?.());
 try{
  await page.goto("/");await page.getByLabel("Name",{exact:true}).fill(`Motion ${rtt}`);await selectExperimentalFamily(page,"planet-gun");await page.locator("#create-room").click();await expect(page.locator("#pg-lobby-screen")).toBeVisible();await page.locator("#pg-target").selectOption("4");await page.locator("#pg-difficulty").selectOption("easy");await page.locator("#pg-ready").click();await page.locator("#pg-start").click();
  await expect.poll(async()=>(await state())?.phase).toBe("playing");
  const samples=[];
  for(const [label,keys,ms]of [["walk",["w"],900],["sprint",["w","Shift"],900],["slide",["w","Shift","Control"],400],["jump",["w","Space"],100],["air",["w"],350],["thrust",["w","Space"],700],["settle",[],900]]as const){
   for(const key of keys)await page.keyboard.down(key);
   await page.waitForTimeout(ms);
   samples.push({label,state:await state()});
   for(const key of [...keys].reverse())await page.keyboard.up(key);
  }
  const final=await state();expect(final.local.hp).toBeGreaterThan(0);expect(final.movement.inputToSimulationMs.count).toBeGreaterThan(5);expect(final.movement.correctionMeters.count).toBeGreaterThan(40);
  for(const {state:s}of samples)expect([s.local.position.x,s.local.position.y,s.local.position.z].every(Number.isFinite)).toBe(true);
  const result={additionalRttMs:rtt,jitterMs:rtt?4:0,measuredNetwork:final.network,renderer:final.renderer,frameProfile:final.profile,transportSaturated:final.movement.snapshotAgeMs.p95>500,samples};await writeFile(info.outputPath("movement-network.json"),JSON.stringify(result,null,2));await info.attach("movement-network",{body:JSON.stringify(result),contentType:"application/json"});
  console.log("Movement correction",rtt,JSON.stringify(final.movement));
  await page.keyboard.press("Escape");await page.locator("#pause-leave").click();await expect(page.locator("#home-screen")).toBeVisible();
 }finally{for(const timer of timers)clearTimeout(timer);}
});
