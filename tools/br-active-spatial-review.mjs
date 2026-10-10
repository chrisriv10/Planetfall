import {chromium} from '@playwright/test';
import {io} from 'socket.io-client';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createPlanetfallServer} from '../server/src/app.ts';
import {BR_STRUCTURES,BR_POIS} from '../shared/dist/index.js';
const output=process.env.SPATIAL_OUTPUT??'artifacts/br-active-recovery-oct09/engine-gate';
const coolant=process.env.SPATIAL_SITE==='coolant';
const roads=process.env.SPATIAL_SITE==='roads';
const civic=process.env.SPATIAL_SITE==='civic'||roads;
const primary=process.env.SPATIAL_PRIMARY;
const structure=primary?BR_STRUCTURES.find(s=>s.districtId===primary&&s.enterable):undefined;
if(primary)assert(structure&&BR_POIS.some(p=>p.id===primary),`Unknown primary POI ${primary}`);
const doorway=structure?{axis:['north','south'].includes(structure.entrance)?'z':'x',sign:['north','east'].includes(structure.entrance)?1:-1}:undefined;
const primaryStart=structure?{...structure.position,y:structure.position.y+.035}:undefined;
if(structure)primaryStart[doorway.axis]+=doorway.sign*(structure.size[doorway.axis]/2+1.2);
await mkdir(output,{recursive:true});
const server=await createPlanetfallServer({port:13001,host:'127.0.0.1',nodeEnv:'test',clientOrigins:['http://127.0.0.1:15174']});
await server.listen();
const browser=await chromium.launch({headless:false});let guest;
const evidence={scope:'Active production player/camera walkthrough in an isolated local match. One initial authoritative fixture placement, then trusted browser mouse/keyboard only. Not human gameplay acceptance.',errors:[],routes:[],pickups:[],screenshots:[]};
try{
 const page=await browser.newPage({viewport:{width:1280,height:720}});
 page.on('pageerror',e=>evidence.errors.push(e.message));
 await page.goto('http://127.0.0.1:15174/');
 await page.getByLabel('Name').fill('Spatial Pilot');await page.locator('#family-br').click();await page.getByRole('button',{name:'Create BR Room'}).click();
 await page.locator('#br-fill-bots').uncheck();
 const room=[...server.manager.rooms.values()].find(r=>r.family==='battle-royale');
 room.seed=901337;
 guest=io('http://127.0.0.1:13001',{transports:['websocket'],extraHeaders:{Origin:'http://127.0.0.1:15174'}});
 await new Promise((r,j)=>{guest.once('connect',r);guest.once('connect_error',j)});
 const joined=await new Promise(r=>guest.emit('br:room:join',{code:room.code,name:'Remote observer'},r));assert(joined.ok);
 guest.emit('br:room:ready',{ready:true});
 await page.locator('#br-ready-button').click();await page.locator('#br-start-button').click();
 await page.locator('#br-hud').waitFor({state:'visible'});await page.waitForFunction(()=>window.__PLANETFALL_BR_DEBUG__?.().phase==='ship');
 const player=[...room.players.values()].find(p=>!p.isBot&&p.name==='Spatial Pilot');
 player.position=primaryStart??(civic?{x:-5,y:.035,z:58}:coolant?{x:37,y:.035,z:58}:{x:340,y:.035,z:-205});player.velocity={x:0,y:0,z:0};player.deployment='grounded';player.grounded=true;player.history=[];
 evidence.initialFixture={position:{...player.position},placementCount:1,generatedLoot:room.loot.size};
 await page.waitForFunction(()=>window.__PLANETFALL_BR_DEBUG__().localPlayer.deployment==='grounded');
 await page.mouse.click(640,360);await page.waitForFunction(()=>document.pointerLockElement?.id==='game-canvas');
 await page.evaluate(()=>{window.__inputEvidence={mouse:0,keys:0,trusted:true};for(const kind of ['mousemove','keydown'])addEventListener(kind,e=>{window.__inputEvidence[kind==='mousemove'?'mouse':'keys']++;window.__inputEvidence.trusted&&=e.isTrusted})});
 const state=()=>page.evaluate(()=>window.__PLANETFALL_BR_DEBUG__());
 let mouseX=640;
 const face=async(yaw)=>{
  for(let i=0;i<3;i++){
   const s=await state(),delta=Math.atan2(Math.sin(yaw-s.localPlayer.yaw),Math.cos(yaw-s.localPlayer.yaw));
   if(Math.abs(delta)<.012)break;mouseX+=Math.round(delta/.0022);await page.mouse.move(mouseX,360);await page.waitForTimeout(160);
  }
 };
 const shot=async(name)=>{await page.waitForTimeout(250);await page.screenshot({path:`${output}/${name}.jpg`,type:'jpeg',quality:90});evidence.screenshots.push(name)};
 const walk=async(label,target)=>{
  const start=await state(),samples=[];let priorDistance=Infinity,lastProgress=Date.now();
  const route={label,target,start:start.localPlayer.position,samples,passed:false};evidence.routes.push(route);
  try{
   for(let frame=0;frame<300;frame++){
    const s=await state(),p=s.localPlayer.position,dx=target.x-p.x,dz=target.z-p.z,d=Math.hypot(dx,dz);
    samples.push({position:p,grounded:s.localPlayer.grounded,alive:s.localPlayer.alive,yaw:s.localPlayer.yaw,
     targetYaw:Math.atan2(dx,-dz),camera:s.camera.position,velocity:s.localPlayer.velocity,
     authority:{position:{...player.position},grounded:player.grounded,yaw:player.yaw,velocity:{...player.velocity}}});
    assert(s.localPlayer.alive,`${label}: died`);
    if(!s.localPlayer.grounded){
     const steps=civic?[[-33,155],[-9,155]]:coolant?[[28,98],[47,98]]:[[326,-198],[326,-162]];
     if(primaryStart){const edge={...primaryStart};edge[doorway.axis]-=doorway.sign*1.2;steps.push([edge.x,edge.z]);}
     const base=structure?.position.y??0;
     const doorStep=steps.some(([x,z])=>Math.abs(p.x-x)<1.5&&Math.abs(p.z-z)<1.5)&&p.y>=base+.034&&p.y<=base+.44;
     const support=room.physics.rayDistance(p,{x:0,y:-1,z:0},1);
     assert(doorStep&&support<.45&&s.localPlayer.velocity.y<=0,`${label}: lost ground outside the .36m door step`);
     samples.at(-1).doorStepDescent={support,maximumHeight:.44};
    }
    if(d<.65){await page.keyboard.up('w');await page.waitForTimeout(200);const stopped=await state();if(Math.hypot(target.x-stopped.localPlayer.position.x,target.z-stopped.localPlayer.position.z)<.65)break;}
    if(d<priorDistance-.15){lastProgress=Date.now();priorDistance=d;}assert(Date.now()-lastProgress<4500,`${label}: blocked at ${JSON.stringify(p)}`);
    await page.keyboard.up('w');await face(Math.atan2(dx,-dz));await page.keyboard.down('w');await page.waitForTimeout(Math.min(180,Math.max(25,(d-.35)/8*1000)));
    if(d<2){await page.keyboard.up('w');await page.waitForTimeout(180);}
   }
  }catch(error){await shot(`${label}-failure`);throw error;}finally{await page.keyboard.up('w');}
  await page.waitForTimeout(150);const end=await state();assert(Math.hypot(target.x-end.localPlayer.position.x,target.z-end.localPlayer.position.z)<1.1,`${label}: arrival ${JSON.stringify(end.localPlayer.position)}`);
  assert(end.localPlayer.grounded,`${label}: did not land`);route.end=end.localPlayer.position;route.passed=true;await shot(label);
 };
 const pickup=async(label,building,centerX=318,upper=false,upperMinimum=5)=>{
  const items=[...room.loot.values()].filter(l=>l.itemId&&Math.abs(l.position.x-centerX)<7&&Math.abs(l.position.z-building)<10&&(upper?l.position.y>upperMinimum:l.position.y<2));
  assert(items.length,`${label}: authored loot missing`);const item=items[0];
  await walk(`${label}-loot-approach`,{x:item.position.x+1.5,z:item.position.z});
  const before=(await state()).localPlayer.inventory;
  for(let attempt=0;attempt<4&&room.loot.has(item.id);attempt++){await page.keyboard.press('e');await page.waitForTimeout(450);}
  const after=(await state()).localPlayer.inventory;
  assert(!room.loot.has(item.id),`${label}: loot not collected`);assert(after.some(i=>i?.itemId===item.itemId),`${label}: inventory`);
  evidence.pickups.push({label,itemId:item.itemId,before,after,removedFromAuthority:true});await shot(`${label}-picked-up`);
  const slot=after.findIndex(i=>i?.itemId===item.itemId),existing=new Set(room.loot.keys());
  await page.keyboard.press('i');const button=page.locator(`button[data-action="drop"][data-slot="${slot}"]`);await button.waitFor({state:'visible'});await page.waitForTimeout(350);await shot(`${label}-inventory-drop`);await button.click({delay:180});await page.waitForTimeout(300);
  const dropped=[...room.loot.values()].find(l=>!existing.has(l.id));assert(dropped,`${label}: inventory drop missing`);
  const ground=room.physics.rayDistance({...dropped.position,y:dropped.position.y+.01},{x:0,y:-1,z:0},2);
  assert(ground>=.58&&ground<.9,`${label}: drop support ${ground}`);
  await page.locator('#br-inventory-close').click();await page.mouse.click(640,360);await page.waitForFunction(()=>document.pointerLockElement?.id==='game-canvas');
  // Playwright's click recentres its native mouse coordinate after the menu.
  // Keep our accumulated coordinate in sync before the next relative look.
  mouseX=640;
  await shot(`${label}-dropped-on-floor`);
  await page.keyboard.down('d');await page.waitForTimeout(220);await page.keyboard.up('d');await page.waitForTimeout(180);
  assert((await state()).localPlayer.grounded,`${label}: side view lost ground`);
  const viewYaw=(await state()).localPlayer.yaw;await face(viewYaw+.6);await page.mouse.move(mouseX,490);await shot(`${label}-dropped-floor-oblique`);await page.mouse.move(mouseX,360);await face(viewYaw);
  for(let attempt=0;attempt<4&&room.loot.has(dropped.id);attempt++){await page.keyboard.press('e');await page.waitForTimeout(350)}
  assert(!room.loot.has(dropped.id),`${label}: dropped item could not be recovered`);
  evidence.pickups.at(-1).drop={position:dropped.position,surfaceY:dropped.surfaceY,groundDistance:ground,recovered:true};
 };
 await shot('start');
 if(structure){
  const inside={...structure.position};inside[doorway.axis]+=doorway.sign*(structure.size[doorway.axis]/2-2);
  await walk(`${primary}-entry`,inside);await face(Math.atan2(structure.position.x-inside.x,-(structure.position.z-inside.z)));await shot(`${primary}-interior`);
  await walk(`${primary}-exit`,primaryStart);await face(Math.atan2(inside.x-primaryStart.x,-(inside.z-primaryStart.z)));await shot(`${primary}-frontage`);
 }else if(roads){
  await walk('zero-level-entry',{x:-5,z:86});await walk('garden-oblique-link',{x:-15,z:104});
  await walk('civic-through-street',{x:-15,z:170});await walk('mall-oblique-link',{x:-5,z:184});
  await walk('mall-level-arrival',{x:-5,z:190});await walk('mall-continuation',{x:-5,z:214});
  await walk('mall-return',{x:-5,z:190});await walk('mall-arrival-return',{x:-5,z:184});
  await walk('civic-link-return',{x:-15,z:170});await walk('civic-street-return',{x:-15,z:104});
  await walk('garden-link-return',{x:-5,z:86});await walk('zero-return',{x:-5,z:58});
 }else if(civic){
  await walk('civic-zero-entry',{x:-5,z:86});await walk('civic-garden-link',{x:-15,z:104});await walk('civic-garden-verge',{x:-15,z:125});await walk('civic-paired-street',{x:-15,z:155});await walk('archive-entry',{x:-34.7,z:155});
  await walk('archive-ground-corridor',{x:-34.7,z:164});await walk('archive-ground-south',{x:-44,z:164});await pickup('archive',155,-44);
  await walk('archive-ground-return',{x:-44,z:164});await walk('archive-stair-foot',{x:-38.06,z:164});await walk('archive-upper-landing',{x:-38.06,z:145});await walk('archive-upper-north',{x:-44,z:145});await walk('archive-upper-corridor',{x:-44,z:155});await pickup('archive-upper',155,-44,true,4);
  await walk('archive-upper-corridor-return',{x:-44,z:155});await walk('archive-upper-north-return',{x:-44,z:145});await walk('archive-upper-landing-return',{x:-38.06,z:145});await walk('archive-stair-descent',{x:-38.06,z:164});await walk('archive-door-corridor',{x:-34.7,z:164});await walk('archive-door-return',{x:-34.7,z:155});await walk('archive-exit',{x:-15,z:155});
  await walk('exchange-entry',{x:-5,z:155});await pickup('exchange',155,0);await walk('exchange-exit',{x:-15,z:155});
  await walk('civic-street-north',{x:-15,z:170});await walk('mall-tangent-link',{x:-5,z:184});await walk('mall-level-arrival',{x:-5,z:190});await walk('mall-continuation',{x:-5,z:214});await walk('mall-return',{x:-5,z:190});await walk('civic-arrival-return',{x:-5,z:184});await walk('civic-link-return',{x:-15,z:170});await walk('civic-street-return',{x:-15,z:104});await walk('civic-garden-link-return',{x:-5,z:86});await walk('civic-to-zero',{x:-5,z:58});
 }else if(coolant){
  await walk('coolant-main-street',{x:37,z:98});await walk('office-entry',{x:25,z:98});await pickup('office',98,18);
  await walk('office-west-corridor',{x:19.8,z:106});await walk('office-stair-foot',{x:23.4,z:106});await walk('office-upper-landing',{x:23.4,z:88});await walk('office-upper-west',{x:19.8,z:88});await walk('office-upper-doorway',{x:19.8,z:98});await pickup('office-upper',98,18,true);
  await walk('office-upper-doorway-return',{x:19.8,z:98});await walk('office-upper-corridor-return',{x:19.8,z:88});await walk('office-upper-return',{x:23.4,z:88});await walk('office-stair-descent',{x:23.4,z:106});await walk('office-ground-corridor-south',{x:26.8,z:106});await walk('office-door-return',{x:26.8,z:98});await walk('office-exit',{x:37,z:98});
  await walk('maintenance-entry',{x:51,z:98});await pickup('maintenance',98,56);await walk('maintenance-exit',{x:37,z:98});
  await walk('north-corner',{x:37,z:121});await walk('avenue-junction',{x:70+10*63/95,z:121});await walk('avenue-to-zero',{x:70,z:58});await walk('perimeter-return',{x:37,z:58});
 }else{
 await walk('workshop-entry',{x:320,z:-198});await pickup('workshop',-198);await face(Math.PI/2);await shot('workshop-camera-door');
 await walk('workshop-exit',{x:340,z:-198});await walk('through-road-south',{x:340,z:-135});await walk('through-road-north',{x:340,z:-162});
 await walk('relay-entry',{x:320,z:-162});await pickup('relay',-162);await walk('relay-exit',{x:340,z:-162});
 await walk('court-east',{x:340,z:-180});await walk('court-west',{x:310,z:-180});await walk('court-return',{x:340,z:-180});
 }
 evidence.input=await page.evaluate(()=>window.__inputEvidence);assert(evidence.input.trusted);assert.deepEqual(evidence.errors,[]);evidence.passed=true;
 console.log(JSON.stringify({routes:evidence.routes.length,pickups:evidence.pickups.length,input:evidence.input,errors:evidence.errors,passed:true}));
}catch(e){evidence.failure=String(e);console.error(e);process.exitCode=1;}finally{
 evidence.input=await browser.contexts()[0]?.pages()[0]?.evaluate(()=>window.__inputEvidence).catch(()=>undefined);
 await writeFile(`${output}/playthrough.json`,JSON.stringify(evidence,null,2)+'\n');guest?.disconnect();await browser.close();await server.close();
}
