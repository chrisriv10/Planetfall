import * as THREE from "three";
import type {BrWeaponId,PgWeaponId,PgModuleId} from "@planetfall/shared";
import {BrWeaponModelLibrary} from "../battle-royale/br-weapon-model-library";
import {addPgWeaponPresentation,createPgOrbitModel,createPgBeveledHousingGeometry,createPgSculptedHousingGeometry} from "./pg-weapon-presentation";
import {createPgModuleArt} from "./pg-module-art";

export const PG_PREVIEW_MODELS:Record<PgWeaponId,BrWeaponId|null>={pulse:"pulse-rifle",nova:"nova-smg",photon:"photon-shotgun",quasar:"quasar-carbine",rail:"rail-laser",comet:"comet-hand-cannon",helix:"helix-burst-rifle",arc:"arc-blaster",prism:"prism-beam",orbit:null};
export function pgPreviewKey(id:PgWeaponId,modules:readonly PgModuleId[]=[]):string{return `${id}:${[...modules].sort().join(",")}`;}
/** Canonical models plus the exact sculpted local PG service hardware; no arms. */
export function createPgPreviewModels(){
 const library=new BrWeaponModelLibrary(),geometry=[new THREE.BoxGeometry(1,1,1),createPgBeveledHousingGeometry(),createPgSculptedHousingGeometry()],materials=new Set<THREE.Material>();
 const ownMaterial=<T extends THREE.Material>(m:T):T=>{materials.add(m);return m;};
 const r={box:geometry[0],bevel:geometry[1],sculpted:geometry[2],metal:ownMaterial(new THREE.MeshStandardMaterial({color:0xa4b6c6,roughness:.38,metalness:.38})),composite:ownMaterial(new THREE.MeshStandardMaterial({color:0x273749,roughness:.46,metalness:.3})),grip:ownMaterial(new THREE.MeshStandardMaterial({color:0x263b4d,roughness:.86})),ownMaterial};
 const models=new Map<PgWeaponId,{root:THREE.Group;modules:ReturnType<typeof createPgModuleArt>}>();
 let disposed=false;
 return{get(id:PgWeaponId){if(disposed)throw new Error("Preview disposed");let item=models.get(id);if(!item){const canonical=PG_PREVIEW_MODELS[id],root=canonical?library.create(canonical,0x72dbff):createPgOrbitModel(r);addPgWeaponPresentation(root,id,r);item={root,modules:createPgModuleArt(root,id,r)};models.set(id,item);}return item;},dispose(){if(disposed)return;disposed=true;for(const m of models.values()){m.modules.dispose();m.root.removeFromParent();}models.clear();library.dispose();geometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}};
}
/** One canvas/context for the live turntable and all cached kit thumbnails. */
export function createPgKitPreview(host:HTMLElement){
 let renderer:THREE.WebGLRenderer;
 try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});}catch{return{setWeapon(_id:PgWeaponId,_modules:readonly PgModuleId[]=[]){},setVisible(_visible:boolean){},thumbnail(_id:PgWeaponId,_modules:readonly PgModuleId[]=[]){return "";},dispose(){}};}
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));renderer.setClearColor(0x080e23,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
 const canvas=renderer.domElement;canvas.className="pg-kit-preview-canvas";canvas.style.cssText="width:100%;height:100%;display:block;touch-action:none;cursor:grab";canvas.tabIndex=0;canvas.setAttribute("role","group");canvas.setAttribute("aria-label","Weapon preview. Drag or use arrow keys to rotate. Plus and minus zoom. Home resets the view.");host.appendChild(canvas);
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(34,1,.01,30),turntable=new THREE.Group(),models=createPgPreviewModels();scene.add(turntable);
 scene.add(new THREE.HemisphereLight(0xbfeaff,0x3d284f,2.7));const key=new THREE.DirectionalLight(0xffe5ba,3.6);key.position.set(1,3,4);scene.add(key);const rim=new THREE.DirectionalLight(0x68baff,3);rim.position.set(-3,1,-2);scene.add(rim);
 const cache=new Map<string,string>(),bounds=new THREE.Box3(),partBounds=new THREE.Box3(),center=new THREE.Vector3(),size=new THREE.Vector3();
 let current:ReturnType<typeof models.get>|null=null,visible=false,disposed=false,frame=0,last=0,yaw=-1.13,pitch=.08,zoom=1,drag=false,px=0,py=0,width=1,height=1;
 const fitPoints:number[]=[],fitPoint=new THREE.Vector3();
 const fit=()=>{if(!current)return;current.root.position.set(0,0,0);turntable.rotation.set(0,0,0);turntable.updateMatrixWorld(true);bounds.makeEmpty();fitPoints.length=0;current.root.traverseVisible(o=>{if(!(o instanceof THREE.Mesh))return;if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();if(o.geometry.boundingBox){const b=o.geometry.boundingBox;bounds.union(partBounds.copy(b).applyMatrix4(o.matrixWorld));for(let i=0;i<8;i++){fitPoint.set(i&1?b.max.x:b.min.x,i&2?b.max.y:b.min.y,i&4?b.max.z:b.min.z).applyMatrix4(o.matrixWorld);fitPoints.push(fitPoint.x,fitPoint.y,fitPoint.z);}}});bounds.getCenter(center);bounds.getSize(size);for(let i=0;i<fitPoints.length;i+=3){fitPoints[i]-=center.x;fitPoints[i+1]-=center.y;fitPoints[i+2]-=center.z;}current.root.position.copy(center).multiplyScalar(-1);camera.position.set(0,0,pgPreviewCameraDistance(size,camera.aspect,pitch,camera.fov)*zoom);camera.lookAt(0,0,0);};
 const draw=()=>{turntable.rotation.set(pitch,yaw,0);if(current){camera.position.set(0,0,pgPreviewPointsDistance(fitPoints,camera.aspect,pitch,yaw,zoom,camera.fov));camera.lookAt(0,0,0);}renderer.render(scene,camera);};
 const resize=()=>{width=Math.max(1,host.clientWidth);height=Math.max(1,host.clientHeight);renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();fit();};
 const select=(id:PgWeaponId,modules:readonly PgModuleId[])=>{if(current)turntable.remove(current.root);current=models.get(id);current.modules.setModules(modules);turntable.add(current.root);fit();};
 const motion=window.matchMedia("(prefers-reduced-motion: reduce)");
 const tick=(time:number)=>{frame=0;if(!visible||disposed)return;const dt=Math.min(.05,(time-last)/1000);last=time;if(!drag&&!motion.matches)yaw+=dt*.045;draw();if(!motion.matches)frame=requestAnimationFrame(tick);};
 const down=(e:PointerEvent)=>{if(e.button!==0)return;canvas.focus({preventScroll:true});drag=true;px=e.clientX;py=e.clientY;canvas.setPointerCapture(e.pointerId);canvas.style.cursor="grabbing";};
 const move=(e:PointerEvent)=>{if(!drag)return;yaw+=(e.clientX-px)*.008;pitch=THREE.MathUtils.clamp(pitch+(e.clientY-py)*.006,-.65,.65);px=e.clientX;py=e.clientY;if(visible)draw();};
 const up=()=>{drag=false;canvas.style.cursor="grab";};
 const wheel=(e:WheelEvent)=>{e.preventDefault();zoom=THREE.MathUtils.clamp(zoom+e.deltaY*.0007,.75,1.4);fit();if(visible)draw();};
 const keydown=(e:KeyboardEvent)=>{
  if(e.altKey||e.ctrlKey||e.metaKey)return;
  const next=pgPreviewKeyboardView(e.key,{yaw,pitch,zoom});if(!next)return;
  e.preventDefault();({yaw,pitch,zoom}=next);fit();if(visible)draw();
 };
 const motionChanged=()=>{if(frame)cancelAnimationFrame(frame);frame=0;if(visible){last=performance.now();draw();if(!motion.matches)frame=requestAnimationFrame(tick);}};
 motion.addEventListener("change",motionChanged);canvas.addEventListener("keydown",keydown);
 canvas.addEventListener("pointerdown",down);canvas.addEventListener("pointermove",move);canvas.addEventListener("pointerup",up);canvas.addEventListener("pointercancel",up);canvas.addEventListener("lostpointercapture",up);canvas.addEventListener("wheel",wheel,{passive:false});
 const observer=new ResizeObserver(()=>{if(!disposed){resize();if(visible)draw();}});observer.observe(host);resize();
 return{setWeapon(id:PgWeaponId,modules:readonly PgModuleId[]=[]){if(disposed)return;select(id,modules);draw();},setVisible(value:boolean){if(disposed)return;visible=value;if(frame)cancelAnimationFrame(frame);frame=0;if(value){resize();motionChanged();}},thumbnail(id:PgWeaponId,modules:readonly PgModuleId[]=[]):string{
  if(disposed)return "";const k=pgPreviewKey(id,modules),cached=cache.get(k);if(cached)return cached;
  const previous=current,rotation=[yaw,pitch,zoom],same=models.get(id),states:THREE.Object3D[]=[];
  // Preserve every attachment's current visibility even when thumbnailing this live model.
  const statesVisible:boolean[]=[];same.root.traverse(o=>{states.push(o);statesVisible.push(o.visible);});
  select(id,modules);yaw=-1.2;pitch=.08;zoom=1;renderer.setSize(320,160,false);camera.aspect=2;camera.updateProjectionMatrix();fit();draw();const data=canvas.toDataURL("image/png");
  states.forEach((o,i)=>o.visible=statesVisible[i]);turntable.remove(current!.root);current=previous;if(current)turntable.add(current.root);[yaw,pitch,zoom]=rotation;renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();fit();draw();
  cache.set(k,data);if(cache.size>24)cache.delete(cache.keys().next().value!);return data;
 },dispose(){if(disposed)return;disposed=true;if(frame)cancelAnimationFrame(frame);observer.disconnect();motion.removeEventListener("change",motionChanged);canvas.removeEventListener("keydown",keydown);canvas.removeEventListener("pointerdown",down);canvas.removeEventListener("pointermove",move);canvas.removeEventListener("pointerup",up);canvas.removeEventListener("pointercancel",up);canvas.removeEventListener("lostpointercapture",up);canvas.removeEventListener("wheel",wheel);models.dispose();cache.clear();renderer.dispose();renderer.forceContextLoss();canvas.remove();}};
}


/** Keyboard interaction for the decorative turntable; never touches game input. */
export function pgPreviewKeyboardView(key:string,view:{yaw:number;pitch:number;zoom:number}){
 const next={...view};
 switch(key){
  case "ArrowLeft":next.yaw-=.12;break;
  case "ArrowRight":next.yaw+=.12;break;
  case "ArrowUp":next.pitch-=.08;break;
  case "ArrowDown":next.pitch+=.08;break;
  case "+":case "=":next.zoom-=.08;break;
  case "-":case "_":next.zoom+=.08;break;
  case "Home":return{yaw:-1.13,pitch:.08,zoom:1};
  default:return null;
 }
 next.pitch=THREE.MathUtils.clamp(next.pitch,-.65,.65);
 next.zoom=THREE.MathUtils.clamp(next.zoom,.75,1.4);
 return next;
}

/** Encloses every idle yaw while using the weapon's true height instead of a sphere. */
export function pgPreviewCameraDistance(size:{x:number;y:number;z:number},aspect:number,pitch:number,fov=34):number{
 const radius=Math.hypot(size.x,size.z)*.5,halfHeight=size.y*.5;
 const sin=Math.abs(Math.sin(pitch)),cos=Math.abs(Math.cos(pitch));
 const height=halfHeight*cos+radius*sin,depth=radius*cos+halfHeight*sin;
 const tangent=Math.tan(THREE.MathUtils.degToRad(fov*.5));
 const horizontal=radius/Math.sin(Math.atan(tangent*Math.max(.1,aspect)));
 return Math.max(.9,horizontal,height/tangent+depth)*1.08;
}

/** Fit the current view's eight corners without reserving barrel length vertically. */
export function pgPreviewAngleDistance(size:{x:number;y:number;z:number},aspect:number,pitch:number,yaw:number,zoom=1,fov=34):number{
 const tangent=Math.tan(fov*Math.PI/360),cx=Math.cos(pitch),sx=Math.sin(pitch),cy=Math.cos(yaw),sy=Math.sin(yaw);let distance=.5;
 for(let corner=0;corner<8;corner++){
  const x=(corner&1?1:-1)*size.x*.5,y=(corner&2?1:-1)*size.y*.5,z=(corner&4?1:-1)*size.z*.5;
  const rx=cy*x+sy*z,rz=-sy*x+cy*z,ry=cx*y-sx*rz,depth=sx*y+cx*rz;
  distance=Math.max(distance,depth+Math.abs(rx)/(tangent*Math.max(.1,aspect))/.9*zoom,depth+Math.abs(ry)/tangent/.9*zoom);
 }
 return distance+.04;
}

/** Per-part bounds avoid reserving empty corners between a long barrel and a low cell. */
export function pgPreviewPointsDistance(points:readonly number[],aspect:number,pitch:number,yaw:number,zoom=1,fov=34):number{
 const tangent=Math.tan(fov*Math.PI/360),cx=Math.cos(pitch),sx=Math.sin(pitch),cy=Math.cos(yaw),sy=Math.sin(yaw);let distance=.5;
 for(let i=0;i<points.length;i+=3){const x=points[i],y=points[i+1],z=points[i+2],rx=cy*x+sy*z,rz=-sy*x+cy*z,ry=cx*y-sx*rz,depth=sx*y+cx*rz;distance=Math.max(distance,depth+Math.abs(rx)/(tangent*Math.max(.1,aspect))/.93*zoom,depth+Math.abs(ry)/tangent/.93*zoom);}
 return distance+.025;
}
