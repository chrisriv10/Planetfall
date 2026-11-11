import {test,expect,type Page} from "@playwright/test";
import {writeFile} from "node:fs/promises";
import {PG_BALANCE,PG_ZOMBIE_ARSENAL_SITE,PG_ZOMBIE_FORGE_SITE,pgCapsuleClear,pgPilotHit,pgCollisionMap,pgRayBox,type Vec3,type PgMap} from "@planetfall/shared";
import {PgZombieNavigation} from "../server/src/modes/planet-gun/pg-zombie-navigation";
import {selectExperimentalFamily} from "./select-family";
test.use({channel:"chromium",video:"on"});
import {state,clear,friendlyBlocks,pointerCoordinates,moveMouse,lookAt,go,route} from "./pg-world-route";

test("a real survivor fights finite waves, buys equipment, powers and upgrades the station",async({page,browser},info)=>{
 test.setTimeout(360000);
 // Bots rally around the first human. A separate ordinary host keeps that
 // escort away while the tested survivor seeks an early, real infected attack.
 // Once rescued, closing the host makes the bots escort the tested survivor.
 const anchor=await browser.newPage();
 for(const [p,name]of[[anchor,"Survival Squad Anchor"],[page,"Survival Playtest"]]as const){await p.setViewportSize({width:960,height:540});await p.goto("/");await p.getByLabel("Name",{exact:true}).fill(name);await selectExperimentalFamily(p,"planet-gun");await p.locator("#settings-open").click();await p.locator("#graphics-quality").selectOption("low");await p.locator("#settings-close").click();}
 await anchor.locator("#create-room").click();await anchor.getByLabel("PlanetGun submode").selectOption("planetzombies");const code=await anchor.locator("#pg-code").innerText();await page.locator("#room-code").fill(code);await page.locator("#join-room").click();await page.locator("#pg-ready").click();await anchor.locator("#pg-ready").click();await anchor.locator("#pg-start").click();await expect.poll(async()=>(await state(page))?.mode?.id).toBe("planetzombies");
 await route(page,{x:-19,y:0,z:-10},info.outputPath("initial-survivor-route-failure.json"));const records:unknown[]=[];let mx=480,my=270,bought=false,powered=false,upgraded=false,sawDowned=false,sawRevived=false,sawCombat=false,arsenalBought=false,arsenalClaimed=false,previousLife="alive",nextRecord=0;let rescueNav:PgZombieNavigation|null=null,rescueRevision=-1;const started=Date.now();
 const walkToward=async(p:Page,destination:Vec3)=>{const local=(await state(p)).local,dx=destination.x-local.position.x,dz=destination.z-local.position.z;if(Math.hypot(dx,dz)<.65){await p.waitForTimeout(300);return;}const c=Math.cos(local.yaw),sn=Math.sin(local.yaw),mx=dx*c-dz*sn,mz=dx*sn+dz*c,key=Math.abs(mx)>Math.abs(mz)?mx>0?"d":"a":mz>0?"s":"w";await p.keyboard.down(key);await p.waitForTimeout(250);await p.keyboard.up(key);};
 const buy=async(label:RegExp)=>{await page.keyboard.press("b");await expect(page.getByRole("dialog",{name:"Mode equipment and character"})).toBeVisible();await page.locator(".pg-mode-menu").getByRole("button",{name:label}).click();await page.keyboard.press("b");mx=480;my=270;await page.locator("#game-canvas").click({button:"right",position:{x:480,y:270}});pointerCoordinates.set(page,{x:480,y:270});};
 while(Date.now()-started<280000){
  let s=await state(page),me=s.mode.pilots[s.local.id];if(s.phase==="results")break;
  if(Date.now()>nextRecord){records.push({elapsedMs:Date.now()-started,wave:s.mode.wave,remaining:s.mode.remaining,life:me.life,hp:s.local.hp,points:me.points,purchases:me.purchases,upgrade:me.upgrade,contribution:me.contribution,power:s.mode.power,position:s.local.position,remote:s.remotePilots,anchor:anchor.isClosed()?null:(await state(anchor)).local});await writeFile(info.outputPath("survival-live-progress.json"),JSON.stringify(records,null,2));nextRecord=Date.now()+5000;}
  if(!sawCombat&&me.contribution>0){sawCombat=true;await page.screenshot({path:info.outputPath("survivor-combat-confirmed.png")});}
  const revision=s.mode.collision.topologyRevision??s.mode.collision.revision;if(revision!==rescueRevision){rescueNav=new PgZombieNavigation(pgCollisionMap(s.mode.collision));rescueRevision=revision;}
  if(me.life==="downed"){if(!sawDowned)await page.screenshot({path:info.outputPath("survivor-downed.png")});sawDowned=true;previousLife="downed";if(!anchor.isClosed()){const destination=rescueNav!.destination((await state(anchor)).local.position,s.local.position);if(destination)await go(anchor,destination.x,destination.z);}await page.waitForTimeout(250);continue;}
  if(previousLife==="downed"&&me.life==="alive"){sawRevived=true;await page.screenshot({path:info.outputPath("survivor-revived-by-teammate.png")});await anchor.close();await page.bringToFront();await page.locator("#game-canvas").click({button:"right",position:{x:480,y:270}});pointerCoordinates.set(page,{x:480,y:270});mx=480;my=270;}previousLife=me.life;
  if(me.life!=="alive"){await page.waitForTimeout(500);continue;}
  if(!me.primaryUnlocked&&me.points>=700&&s.mode.power){await route(page,{x:-22,y:0,z:6},info.outputPath("pulse-route-failure.json"));await buy(/^Pulse Rifle ·/);await expect.poll(async()=>{const v=await state(page);return v.mode.pilots[v.local.id].primaryUnlocked;}).toBe(true);bought=true;await page.screenshot({path:info.outputPath("survivor-purchased-pulse.png")});continue;}
  if(bought&&!powered&&s.mode.power){powered=true;await page.screenshot({path:info.outputPath("station-power-restored.png")});}
  if(bought&&s.mode.power&&!upgraded&&me.points>=900){await route(page,PG_ZOMBIE_FORGE_SITE.interaction);await page.keyboard.press("1");await lookAt(page,{...PG_ZOMBIE_FORGE_SITE.position,y:1.1});await page.keyboard.press("e");await expect.poll(async()=>(await state(page)).mode.forge.phase).toBe("processing");await page.screenshot({path:info.outputPath("forge-processing-weapon.png")});await expect(page.locator("#pg-reload")).toContainText("OVERCHARGING");await page.keyboard.press("2");await expect.poll(async()=>(await state(page)).local.slot).toBe(1);await expect.poll(async()=>{const v=await state(page);return v.mode.pilots[v.local.id].upgrade;}).toBe(1);upgraded=true;await page.keyboard.press("1");await page.screenshot({path:info.outputPath("survivor-upgraded-weapon.png")});continue;}
  if(upgraded&&sawRevived&&s.mode.wave>=4&&me.points>=850){
   await route(page,PG_ZOMBIE_ARSENAL_SITE.interaction,info.outputPath("arsenal-route-failure.json"));await page.bringToFront();await lookAt(page,{...PG_ZOMBIE_ARSENAL_SITE.position,y:1.1});
   // A held purchase is a single intent; it must not auto-claim or buy again.
   await page.keyboard.down("e");
   try{
    await expect.poll(async()=>(await state(page)).mode.arsenal.phase).toBe("revealing");arsenalBought=true;
    await page.screenshot({path:info.outputPath("arsenal-revealing.png")});
    await expect.poll(async()=>(await state(page)).mode.arsenal.phase).toBe("ready");await page.waitForTimeout(500);
    const ready=await state(page);expect(ready.mode.arsenal.ownerId).toBe(ready.local.id);expect(ready.mode.arsenal.weaponId).not.toBeNull();
    await page.screenshot({path:info.outputPath("arsenal-reserved-result.png")});
   }finally{await page.keyboard.up("e");}
   const result=(await state(page)).mode.arsenal.weaponId;await page.keyboard.press("e");
   await expect.poll(async()=>(await state(page)).local.guns[0].id).toBe(result);await expect.poll(async()=>(await state(page)).mode.arsenal.phase).toBe("idle");arsenalClaimed=true;
   await page.screenshot({path:info.outputPath("arsenal-claimed-weapon.png")});break;
  }
  // Exercise rescue before the escort buys upgraded weapons. Waiting until
  // late waves let its perfect PvE aim kill every attacker before five hits.
  if(!sawRevived){
   const opponent=s.mode.zombies.filter((z:any)=>rescueNav!.reachable(s.local.position,z.position)).sort((a:any,b:any)=>Math.hypot(a.position.x-s.local.position.x,a.position.z-s.local.position.z)-Math.hypot(b.position.x-s.local.position.x,b.position.z-s.local.position.z))[0];
   const destination=opponent?rescueNav!.destination(s.local.position,opponent.position):null;
   if(destination)await walkToward(page,destination);else await page.waitForTimeout(300);
   continue;
  }
  if(me.primaryUnlocked&&s.local.guns[0].magazine===0&&s.local.guns[0].reserve===0&&me.points>=200){await route(page,{x:-22,y:0,z:6});await buy(/^Ammo ·/);continue;}
  const gun=s.local.guns[s.local.slot];if(gun.magazine===0&&gun.reserve>0){await page.keyboard.press("r");await page.waitForTimeout(1700);continue;}
  const map=pgCollisionMap(s.mode.collision),eyeHeight=s.local.crouched?PG_BALANCE.crouchEye:PG_BALANCE.eye,origin={...s.local.position,y:s.local.position.y+eyeHeight};const target=s.mode.zombies.filter((z:any)=>{const to={...z.position,y:z.position.y+1.05};return clear(origin,to,map)&&!friendlyBlocks(origin,to,s);}).sort((a:any,b:any)=>Math.hypot(a.position.x-origin.x,a.position.z-origin.z)-Math.hypot(b.position.x-origin.x,b.position.z-origin.z))[0];
  if(!target||!gun.magazine){
   // Friendly bodies correctly stop bullets. Find a real firing lane through
   // normal movement instead of emptying magazines into the escort's backs.
   const opponent=s.mode.zombies.filter((z:any)=>rescueNav!.reachable(s.local.position,z.position)).sort((a:any,b:any)=>Math.hypot(a.position.x-origin.x,a.position.z-origin.z)-Math.hypot(b.position.x-origin.x,b.position.z-origin.z))[0];
   if(opponent&&gun.magazine){const to={...opponent.position,y:opponent.position.y+1.05},p=s.local.position;const lane=[[2,0],[-2,0],[0,2],[0,-2],[2,2],[-2,-2],[2,-2],[-2,2]].map(([x,z])=>({x:p.x+x,y:p.y,z:p.z+z})).find(point=>pgCapsuleClear(point,PG_BALANCE.height,map)&&rescueNav!.supported(point)&&rescueNav!.reachable(p,point)&&clear({...point,y:point.y+eyeHeight},to,map)&&!friendlyBlocks({...point,y:point.y+eyeHeight},to,s));const destination=lane?rescueNav!.destination(p,lane):Math.hypot(p.x-opponent.position.x,p.z-opponent.position.z)>7?rescueNav!.destination(p,opponent.position):null;if(destination)await walkToward(page,destination);}
   await page.waitForTimeout(150);continue;
  }
  await moveMouse(page,mx,my);await page.mouse.down({button:"right"});await page.waitForTimeout(180);
  s=await state(page);const live=s.mode.zombies.find((z:any)=>z.id===target.id);
  if(!live){await page.mouse.up({button:"right"});continue;}
  const currentOrigin={...s.local.position,y:s.local.position.y+(s.local.crouched?PG_BALANCE.crouchEye:PG_BALANCE.eye)};
  if(friendlyBlocks(currentOrigin,{...live.position,y:live.position.y+1.05},s)){await page.mouse.up({button:"right"});continue;}
  const desired=Math.atan2(currentOrigin.x-live.position.x,currentOrigin.z-live.position.z),yawDelta=Math.atan2(Math.sin(desired-s.local.yaw),Math.cos(desired-s.local.yaw));
  const pitch=Math.atan2(live.position.y+1.05-currentOrigin.y,Math.hypot(live.position.x-currentOrigin.x,live.position.z-currentOrigin.z)),sensitivity=.0022*(s.ads>.5?.48:1);
  mx-=yawDelta/sensitivity;my-=(pitch-s.local.pitch)/sensitivity;await moveMouse(page,mx,my,{steps:1});await page.waitForTimeout(35);await page.mouse.down();await page.waitForTimeout(gun.id==="pulse"?180:100);await page.mouse.up();await page.mouse.up({button:"right"});await page.waitForTimeout(gun.id==="photon"?650:120);
 }
 const final=await state(page);await writeFile(info.outputPath("survival-playthrough.json"),JSON.stringify({bought,powered,upgraded,arsenalBought,arsenalClaimed,sawDowned,sawRevived,sawCombat,records,final},null,2));await page.screenshot({path:info.outputPath("survival-final-view.png")});expect(arsenalBought).toBe(true);expect(arsenalClaimed).toBe(true);expect(bought).toBe(true);expect(powered).toBe(true);expect(upgraded).toBe(true);expect(sawDowned).toBe(true);expect(sawRevived).toBe(true);expect(final.mode.wave).toBeGreaterThanOrEqual(4);expect(final.mode.pilots[final.local.id].contribution).toBeGreaterThan(0);
});
