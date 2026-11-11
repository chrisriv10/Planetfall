/** Isolated development/E2E component entry. Not imported by the production game. */

import * as THREE from "three";

import {PgWorldRenderer} from "./pg-world";

import {createPgModeArt} from "./pg-mode-art";

import {QUALITY_PRESETS,type GraphicsSelection} from "../../settings";

import {PG_HEROES,PG_OPERATORS,PG_SIEGE_CAMERAS,type PgAbilityDefinition,type PgModeEffect,type PgModeSnapshot} from "@planetfall/shared";

const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(innerWidth,innerHeight);document.body.append(renderer.domElement);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.shadowMap.type=THREE.PCFSoftShadowMap;

const scene=new THREE.Scene();scene.background=new THREE.Color(0x101c32);scene.fog=new THREE.Fog(0x101c32,100,230);

const camera=new THREE.PerspectiveCamera(68,innerWidth/innerHeight,.03,400);camera.position.set(28,4,-19);camera.lookAt(27,1,-33);

const world=new PgWorldRenderer(),art=createPgModeArt();scene.add(world.root,art.group,new THREE.HemisphereLight(0xb8d7ef,0x526574,1.7));

const sun=new THREE.DirectionalLight(0xcbe4ff,2.5);sun.position.set(-35,55,20);sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-64,right:64,top:64,bottom:-64,near:10,far:150});sun.shadow.bias=-.0003;sun.shadow.normalBias=.035;sun.shadow.camera.updateProjectionMatrix();scene.add(sun);

const fill=new THREE.DirectionalLight(0xffd8ad,.5);fill.position.set(30,18,-25);scene.add(fill);

const zombies:Extract<PgModeSnapshot,{id:"planetzombies"}>={id:"planetzombies",forge:{phase:"idle",ownerId:null,weaponId:null,targetTier:null,startedAt:null,completesAt:null},arsenal:{phase:"idle",ownerId:null,weaponId:null,revealAt:null,expiresAt:null},collision:{revision:0,topologyRevision:0,panels:[]},effects:[],pilots:{},round:25,subphase:"wave",deadline:0,wave:25,remaining:32,queued:0,power:true,unlocked:[],reason:null,zombies:Array.from({length:32},(_,i)=>({id:`render-fixture-${i}`,kind:i%3===0?"bulwark":i%3===1?"skitter":"drifter",position:{x:20+i%8*2,y:0,z:-35.5+Math.floor(i/8)*1.7},yaw:Math.PI,hp:100,maxHp:100,windupUntil:i%4===0?Number.MAX_SAFE_INTEGER:0}))};

// Synthetic elevated display positions deliberately bypass all placement/game rules.

// Catalog radius, health and effect identities remain canonical. No gameplay evidence.

type FixtureMode="planetstrike"|"planetwatch"|"planetsiege"|"planetzombies";

const common={collision:{revision:0,topologyRevision:0,panels:[]},pilots:{},round:1,subphase:"active",deadline:0};

const point=(x:number,z:number)=>({x,y:12,z});

const effect=(id:string,kind:PgModeEffect["kind"],x:number,z:number,radius:number,hp=0):PgModeEffect=>({id,kind,ownerId:"render-review",team:"solar",position:point(x,z),radius,hp,maxHp:hp,startsAt:0,endsAt:1000});

const heroEffect=(a:PgAbilityDefinition,kind:PgModeEffect["kind"],x:number,z:number)=>effect(a.id,kind,x,z,a.radius,a.deployableHp);

const operatorEffect=(a:PgAbilityDefinition,kind:PgModeEffect["kind"],x:number,z:number)=>effect(a.id,kind,x,z,a.primitive==="trip-line"?.12:a.radius||2,a.deployableHp||1);

const fixtures:Record<FixtureMode,PgModeSnapshot>={

 planetstrike:{...common,id:"planetstrike",attackTeam:"solar",roundScores:{solar:0,void:0},charge:{carrierId:null,position:point(0,4),site:null,detonatesAt:0},

 // Strike's utility radii mirror pg-strike.ts: smoke 4, flash 7, damage/heat 4.

 effects:[effect("strike-smoke","smoke",-15,-12,4),effect("strike-flash","flash",0,-12,7),effect("strike-damage","heat",15,-12,4)],

 drops:["pulse","nova","rail","arc"].map((weapon,i)=>({id:`fixture-drop-${weapon}`,kind:"weapon" as const,weapon:weapon as "pulse"|"nova"|"rail"|"arc",position:point(-9+i*6,4),magazine:0,reserve:0}))},

 planetwatch:{...common,id:"planetwatch",roundScores:{solar:0,void:0},control:{owner:"solar",capture:{solar:0,void:0},progress:{solar:50,void:0},contested:true,point:0},intel:[],effects:[

 heroEffect(PG_HEROES.kepler.abilities[0],"gravity",-18,-18),heroEffect(PG_HEROES.cinder.abilities[1],"heat",-6,-18),

 heroEffect(PG_HEROES.solace.abilities[1],"heal",7,-18),heroEffect(PG_HEROES.spindle.abilities[1],"relay",21,-18),

 heroEffect(PG_HEROES.cairn.ultimate,"shield",-14,1),heroEffect(PG_HEROES.spindle.abilities[0],"shield",1,1),

 {...heroEffect(PG_HEROES.solace.abilities[0],"heal",7,1),end:point(17,1)}]},

 planetsiege:{...common,id:"planetsiege",attackTeam:"solar",roundScores:{solar:0,void:0},capture:.4,site:0,intel:[],effects:[

 operatorEffect(PG_OPERATORS.shroud.signature,"smoke",-24,-20),operatorEffect(PG_OPERATORS.hush.signature,"jammer",-10,-20),

 operatorEffect(PG_OPERATORS.coil.signature,"electric",2,-20),operatorEffect(PG_OPERATORS.mend.signature,"heal",13,-20),

 operatorEffect(PG_OPERATORS.null.signature,"breach",25,-20),operatorEffect(PG_OPERATORS.glint.signature,"sensor",-18,4),

 {...operatorEffect(PG_OPERATORS.thread.signature,"trip",0,4),end:point(6,4)},operatorEffect(PG_OPERATORS.strut.signature,"shield",14,4)],

 drones:Array.from({length:6},(_,i)=>({id:`drone-fixture-${i}`,ownerId:`fixture-${i}`,position:point(-20+i*8,15),yaw:i*.35,pitch:0,hp:35,disabledUntil:0})),

 cameras:PG_SIEGE_CAMERAS.map((c,i)=>({id:c.id,hp:35,maxHp:35,disabled:i===1,disabledUntil:0}))},

 planetzombies:zombies,

};

const expectedVisibleCounts={

 planetstrike:{effects:3,weaponDrops:4,charge:1,objectiveMarkers:2,zombies:0,drones:0,cameras:0},

 planetwatch:{effects:7,weaponDrops:0,charge:0,objectiveMarkers:1,zombies:0,drones:0,cameras:0},

 planetsiege:{effects:8,weaponDrops:0,charge:0,objectiveMarkers:1,zombies:0,drones:6,cameras:2},

 planetzombies:{effects:0,weaponDrops:0,charge:0,objectiveMarkers:2,zombies:32,windupRings:8,drones:0,cameras:0},

};

let mode:FixtureMode="planetzombies",snapshot:PgModeSnapshot=zombies;

let quality:GraphicsSelection="high",last=performance.now(),lastReport=0;const frames:number[]=[],cpu:number[]=[];

const modeSelect=document.querySelector<HTMLSelectElement>("#mode")!;

const select=document.querySelector<HTMLSelectElement>("#quality")!,output=document.querySelector<HTMLOutputElement>("#metrics")!;

function apply(){quality=select.value as GraphicsSelection;const resolved=quality==="auto"?"medium":quality,preset=QUALITY_PRESETS[resolved];world.setQuality(resolved);renderer.setPixelRatio(Math.min(devicePixelRatio,preset.pixelRatioCap)*preset.resolutionScale);renderer.shadowMap.enabled=resolved==="high";sun.castShadow=resolved==="high";frames.length=cpu.length=0;output.textContent="";last=performance.now();lastReport=0;}

function applyMode(){mode=modeSelect.value as FixtureMode;snapshot=fixtures[mode];

 if(mode==="planetzombies"){camera.position.set(28,4,-19);camera.lookAt(27,1,-33);}

 else {camera.position.set(5,65,53);camera.lookAt(0,8,-5);}

 frames.length=cpu.length=0;output.textContent="";last=performance.now();lastReport=0;

 document.querySelector("#fixture-description")!.textContent=mode==="planetzombies"?"32 infected / 3 kinds / 8 windups":"Elevated synthetic effect display / canonical sizes / fixed camera hardware stays at map anchors";

}

modeSelect.addEventListener("change",applyMode);select.addEventListener("change",apply);applyMode();apply();

const gl=renderer.getContext(),extension=gl.getExtension("WEBGL_debug_renderer_info"),gpu=String(gl.getParameter(extension?extension.UNMASKED_RENDERER_WEBGL:gl.RENDERER));

renderer.setAnimationLoop(now=>{const started=performance.now();frames.push(now-last);last=now;if(frames.length>240)frames.shift();world.update(now);art.update(snapshot,"render-review",mode==="planetzombies"?now:250+(now%500),quality==="auto"?"medium":quality);renderer.render(scene,camera);cpu.push(performance.now()-started);if(cpu.length>240)cpu.shift();if(now-lastReport<500)return;lastReport=now;

 const sorted=[...frames].sort((a,b)=>a-b),cost=[...cpu].sort((a,b)=>a-b),materials=new Set<THREE.Material>();let instances=0;scene.traverseVisible(o=>{if(o instanceof THREE.Mesh){for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);if(o instanceof THREE.InstancedMesh)instances+=o.count;}});

 output.textContent=JSON.stringify({fixture:"SYNTHETIC RENDER ONLY",mode,fixtureMode:mode,fixtureCounts:{effects:snapshot.effects.length,drones:snapshot.id==="planetsiege"?snapshot.drones.length:0,cameras:snapshot.id==="planetsiege"?snapshot.cameras.length:0,infected:snapshot.id==="planetzombies"?snapshot.zombies.length:0},autoSemantics:"review Auto is fixed Medium; not adaptive match Auto",expectedVisibleCounts:expectedVisibleCounts[mode],countSemantics:"enabled art entities; world occlusion and frustum may hide fixed map anchors",effectIds:snapshot.effects.map(e=>e.id),effectKinds:snapshot.effects.map(e=>e.kind),gpu,quality,resolvedQuality:quality==="auto"?"medium":quality,samples:frames.length,p50FrameMs:sorted[Math.floor(sorted.length*.5)],p95FrameMs:sorted[Math.floor(sorted.length*.95)],maxFrameMs:sorted.at(-1),p50CpuMs:cost[Math.floor(cost.length*.5)],p95CpuMs:cost[Math.floor(cost.length*.95)],calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,instances,materials:materials.size,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures});

});

addEventListener("resize",()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});

addEventListener("pagehide",()=>{renderer.setAnimationLoop(null);art.dispose();world.root.removeFromParent();renderer.dispose();},{once:true});
