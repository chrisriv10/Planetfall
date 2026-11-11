import * as THREE from "three";
import {
  PG_PRIMARY_WEAPONS, PG_WEAPONS, PG_ZOMBIE_ARSENAL_COST, PG_ZOMBIE_ARSENAL_REVEAL_MS,
  type PgZombieArsenalSnapshot,
} from "@planetfall/shared";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { GraphicsQuality } from "../../settings";
import { createPgPreviewModels } from "./pg-kit-preview";

type Site = {position: {x:number; y:number; z:number}; yaw:number};
type Primary = typeof PG_PRIMARY_WEAPONS[number];

export function createPgZombieArsenalArt(site: Site) {
  const root = new THREE.Group(), body = new THREE.Group(), display = new THREE.Group();
  root.name = "pg-zombie-anomaly-arsenal"; body.name = "fixed-body-group"; display.name = "arsenal-projection";
  root.position.copy(site.position); root.rotation.y = site.yaw;
  root.add(body,display); root.visible = false;
  const box = new THREE.BoxGeometry(), drum = new THREE.CylinderGeometry(1,1,1,12);
  const signFace = new THREE.PlaneGeometry(1,1);
  const steel = new THREE.MeshStandardMaterial({color:0x90aaa9,metalness:.53,roughness:.42});
  const graphite = new THREE.MeshStandardMaterial({color:0x233444,metalness:.38,roughness:.68});
  const dark = new THREE.MeshStandardMaterial({color:0x101b2e,metalness:.2,roughness:.6});
  const teal = new THREE.MeshBasicMaterial({color:0x69efee}), violet = new THREE.MeshBasicMaterial({color:0xb38cff});
  const holo = new THREE.MeshBasicMaterial({color:0x70eaff,transparent:true,opacity:.37,depthWrite:false,blending:THREE.AdditiveBlending});
  const glass = new THREE.MeshBasicMaterial({color:0x67a9cb,transparent:true,opacity:.16,depthWrite:false});
  const materials: THREE.Material[] = [steel,graphite,dark,teal,violet,holo,glass];
  const geometries: THREE.BufferGeometry[] = [box,drum,signFace];

  function part(name:string, geo:THREE.BufferGeometry, material:THREE.Material, x:number,y:number,z:number,w:number,h:number,d:number) {
    const mesh = new THREE.Mesh(geo,material);
    mesh.name=name; mesh.position.set(x,y,z); mesh.scale.set(w,h,d); body.add(mesh);
    return mesh;
  }
  part("ballasted-plinth",box,graphite,0,.08,0,1.47,.16,.87);
  part("lower-service-hatch",box,steel,0,.36,.015,1.31,.46,.72);
  part("front-vent",box,dark,.32,.37,-.355,.46,.29,.035);
  for(let i=0;i<3;i++) part("vent-slat",box,graphite,.32,.28+i*.075,-.38,.40,.028,.025);
  part("service-indicator",box,teal,-.42,.39,-.353,.19,.028,.024);
  part("purchase-desk",box,graphite,0,.67,0,1.43,.18,.86);
  for(const side of [-1,1]) {
    part("chamber-spine",box,steel,side*.598,1.15,.23,.113,.82,.19);
    part("conductor",box,side<0?teal:violet,side*.598,1.15,.127,.042,.62,.021);
    part("emitter-shoe",drum,graphite,side*.48,.797,0,.15,.08,.15);
  }
  part("chamber-back",box,dark,0,1.14,.355,1.29,.78,.11);
  part("chamber-window",box,glass,0,1.19,.271,.96,.6,.035);
  part("exciter-socket",drum,steel,0,.804,-.025,.32,.086,.25);
  part("exciter-lens",drum,teal,0,.853,-.025,.22,.018,.18);
  part("sign-bezel",box,graphite,0,1.615,.20,1.46,.31,.30);
  part("canopy-lip",box,steel,0,1.773,.18,1.48,.043,.37);
  const keypad = part("purchase-terminal",box,dark,-.31,.804,-.272,.46,.10,.27);
  keypad.rotation.x=-.17;
  for(let i=0;i<3;i++) part("purchase-key",box,i===2?teal:steel,-.446+i*.125,.86,-.30,.091,.022,.065);
  // The shell is static. Batch opaque repeated hardware by finish before adding the changing display.
  for(const material of [steel,graphite,dark,teal,violet]) {
    const pieces:THREE.BufferGeometry[]=[];
    for(const child of [...body.children]) {
      if(!(child instanceof THREE.Mesh) || child.material!==material) continue;
      child.updateMatrix();
      const piece=child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone();
      piece.applyMatrix4(child.matrix);pieces.push(piece);body.remove(child);
    }
    const batch=mergeGeometries(pieces)!; geometries.push(batch);
    pieces.forEach(piece=>piece.dispose());body.add(new THREE.Mesh(batch,material));
  }
  const sign = part("arsenal-readout",signFace,dark,0,1.615,.048,1.34,.259,1);
  sign.rotation.y=Math.PI;
  const labelCanvas = typeof document==="undefined" ? null : document.createElement("canvas");
  if(labelCanvas) { labelCanvas.width=768; labelCanvas.height=150; }
  const ctx=labelCanvas?.getContext("2d");
  const texture=labelCanvas && ctx ? new THREE.CanvasTexture(labelCanvas) : null;
  if(texture) {
    texture.colorSpace=THREE.SRGBColorSpace;
    const screenMaterial=new THREE.MeshBasicMaterial({map:texture,toneMapped:false});
    sign.material=screenMaterial; materials.push(screenMaterial);
  }
  let lastStatus="";
  function readout(status:string) {
    if(lastStatus===status) return;
    lastStatus=status; sign.userData.readout=status;
    if(!ctx || !texture) return;
    ctx.fillStyle="#0c1928";ctx.fillRect(0,0,768,150);
    ctx.fillStyle="#65efe2";ctx.fillRect(0,0,9,150);
    ctx.font="bold 47px sans-serif";ctx.fillText("ANOMALY ARSENAL",24,62);
    ctx.font="bold 26px monospace";ctx.fillStyle="#e1f4ff";ctx.fillText(status,26,119,560);
    ctx.textAlign="right";ctx.fillStyle="#d9b0ff";ctx.font="bold 38px monospace";ctx.fillText(String(PG_ZOMBIE_ARSENAL_COST),745,61);
    ctx.font="bold 19px monospace";ctx.fillText("POINTS",745,102);ctx.textAlign="left";
    texture.needsUpdate=true;
  }

  const models=createPgPreviewModels();
  type DisplayItem = {model: THREE.Group; projection:THREE.Mesh; center:THREE.Vector3; scale:number};
  const cache=new Map<Primary,DisplayItem>();
  function getDisplay(id:Primary) {
    const saved=cache.get(id);
    if(saved) return saved;
    const kit=models.get(id);
    kit.modules.setModules([]);
    kit.root.updateMatrixWorld(true);
    // Bake a single translucent draw for the cycling image. Reward instances keep their real finishes.
    const parts:THREE.BufferGeometry[]=[];
    kit.root.traverseVisible(node=>{
      if(!(node instanceof THREE.Mesh)) return;
      const copy=node.geometry.index ? node.geometry.toNonIndexed() : node.geometry.clone();
      for(const attr of Object.keys(copy.attributes)) if(attr!=="position") copy.deleteAttribute(attr);
      copy.applyMatrix4(node.matrixWorld);
      parts.push(copy);
    });
    const silhouette=mergeGeometries(parts)!;
    for(const part of parts) part.dispose();
    silhouette.computeBoundingBox(); geometries.push(silhouette);
    const bounds=silhouette.boundingBox!, center=bounds.getCenter(new THREE.Vector3()), size=bounds.getSize(new THREE.Vector3());
    const projection=new THREE.Mesh(silhouette,holo);
    projection.name=`arsenal-hologram-${id}`;
    const result={model:kit.root,projection,center,scale:Math.min(1.06/size.z,.52/size.y,.45/size.x)};
    cache.set(id,result);return result;
  }
  let active:THREE.Object3D|null=null, disposed=false;
  function show(id:Primary|null, projection:boolean) {
    const item=id ? getDisplay(id) : null;
    const next=item ? (projection ? item.projection : item.model) : null;
    if(active===next) return;
    active?.removeFromParent(); active=next;
    if(item && next) {
      display.add(next);display.scale.setScalar(item.scale);
      next.position.copy(item.center).multiplyScalar(-1);
    }
  }
  function update(state:PgZombieArsenalSnapshot|null,serverTime:number,ownerName:string|null,quality:GraphicsQuality,reducedMotion:boolean) {
    if(disposed) return;
    root.visible=!!state;
    if(!state) { show(null,false); return; }
    const revealing=state.phase==="revealing",ready=state.phase==="ready";
    const time=Number.isFinite(serverTime)?serverTime:0;
    const motion=reducedMotion?0:Math.sin(time*.0019);
    let id:Primary|null=null;
    if(revealing) {
      const elapsed=Math.max(0,Math.min(PG_ZOMBIE_ARSENAL_REVEAL_MS,time-state.revealAt+PG_ZOMBIE_ARSENAL_REVEAL_MS));
      const frame=reducedMotion?0:Math.floor(elapsed/(quality==="low"?460:250));
      id=PG_PRIMARY_WEAPONS[frame%PG_PRIMARY_WEAPONS.length];
      holo.color.setHex(frame%2===0?0x70eaff:0xc399ff);
    } else if(ready && PG_PRIMARY_WEAPONS.includes(state.weaponId as Primary)) id=state.weaponId as Primary;
    show(id,revealing);
    display.position.set(0,1.19+motion*.022,-.09);
    display.rotation.set(.04,Math.PI/2+.11+motion*.07,.035);
    glass.visible=quality!=="low";
    const claimant=ownerName?.trim()||"Operator";
    const status=ready ? `${PG_WEAPONS[state.weaponId].name}  /  ${claimant}` :
      revealing ? `Resolving  /  ${claimant}` : "Ready to requisition";
    readout(status);
  }
  return {root,update,dispose(){
    if(disposed)return;
    disposed=true; active?.removeFromParent(); active=null; models.dispose();cache.clear();
    root.removeFromParent();root.clear();
    for(const geo of geometries)geo.dispose();
    for(const mat of materials)mat.dispose();
    texture?.dispose();
  }};
}
