/** Isolated development/E2E component entry. Not imported by the production game. */
import * as THREE from "three";
import {PgWorldRenderer} from "./pg-world";
import {createPgModeArt} from "./pg-mode-art";
import {QUALITY_PRESETS,type GraphicsSelection} from "../../settings";
import {type PgModeSnapshot} from "@planetfall/shared";
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(innerWidth,innerHeight);document.body.append(renderer.domElement);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();scene.background=new THREE.Color(0x101c32);scene.fog=new THREE.Fog(0x101c32,100,230);
const camera=new THREE.PerspectiveCamera(68,innerWidth/innerHeight,.03,400);camera.position.set(28,4,-19);camera.lookAt(27,1,-33);
const world=new PgWorldRenderer(),art=createPgModeArt();scene.add(world.root,art.group,new THREE.HemisphereLight(0xb8d7ef,0x526574,1.7));
const sun=new THREE.DirectionalLight(0xcbe4ff,2.5);sun.position.set(-35,55,20);sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-64,right:64,top:64,bottom:-64,near:10,far:150});sun.shadow.bias=-.0003;sun.shadow.normalBias=.035;sun.shadow.camera.updateProjectionMatrix();scene.add(sun);
const fill=new THREE.DirectionalLight(0xffd8ad,.5);fill.position.set(30,18,-25);scene.add(fill);
const snapshot:Extract<PgModeSnapshot,{id:"planetzombies"}>={id:"planetzombies",collision:{revision:0,topologyRevision:0,panels:[]},effects:[],pilots:{},round:25,subphase:"wave",deadline:0,wave:25,remaining:32,queued:0,power:true,unlocked:[],reason:null,zombies:Array.from({length:32},(_,i)=>({id:`render-fixture-${i}`,kind:i%3===0?"bulwark":i%3===1?"skitter":"drifter",position:{x:20+i%8*2,y:0,z:-35.5+Math.floor(i/8)*1.7},yaw:Math.PI,hp:100,maxHp:100,windupUntil:i%4===0?Number.MAX_SAFE_INTEGER:0}))};
let quality:GraphicsSelection="high",last=performance.now(),lastReport=0;const frames:number[]=[],cpu:number[]=[];
const select=document.querySelector<HTMLSelectElement>("#quality")!,output=document.querySelector<HTMLOutputElement>("#metrics")!;
function apply(){quality=select.value as GraphicsSelection;const resolved=quality==="auto"?"medium":quality,preset=QUALITY_PRESETS[resolved];world.setQuality(resolved);renderer.setPixelRatio(Math.min(devicePixelRatio,preset.pixelRatioCap)*preset.resolutionScale);renderer.shadowMap.enabled=resolved==="high";sun.castShadow=resolved==="high";frames.length=cpu.length=0;last=performance.now();}
select.addEventListener("change",apply);apply();
const gl=renderer.getContext(),extension=gl.getExtension("WEBGL_debug_renderer_info"),gpu=String(gl.getParameter(extension?extension.UNMASKED_RENDERER_WEBGL:gl.RENDERER));
renderer.setAnimationLoop(now=>{const started=performance.now();frames.push(now-last);last=now;if(frames.length>240)frames.shift();world.update(now);art.update(snapshot,"render-review",now);renderer.render(scene,camera);cpu.push(performance.now()-started);if(cpu.length>240)cpu.shift();if(now-lastReport<500)return;lastReport=now;
 const sorted=[...frames].sort((a,b)=>a-b),cost=[...cpu].sort((a,b)=>a-b),materials=new Set<THREE.Material>();let instances=0;scene.traverseVisible(o=>{if(o instanceof THREE.Mesh){for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);if(o instanceof THREE.InstancedMesh)instances+=o.count;}});
 output.textContent=JSON.stringify({fixture:"synthetic 32-infected rendering only",gpu,quality,resolvedQuality:quality==="auto"?"medium":quality,samples:frames.length,p50FrameMs:sorted[Math.floor(sorted.length*.5)],p95FrameMs:sorted[Math.floor(sorted.length*.95)],maxFrameMs:sorted.at(-1),p50CpuMs:cost[Math.floor(cost.length*.5)],p95CpuMs:cost[Math.floor(cost.length*.95)],calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,instances,materials:materials.size,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures});
});
addEventListener("pagehide",()=>{renderer.setAnimationLoop(null);art.dispose();world.root.removeFromParent();renderer.dispose();},{once:true});
