import {createPgModuleArt} from "./pg-module-art";
import * as THREE from "three";
import type { BrWeaponId,PgModuleId } from "@planetfall/shared";
import { BrWeaponModelLibrary } from "../battle-royale/br-weapon-model-library";
import {createPgReloadSample,samplePgReload,PG_RELOAD_PROFILES,type PgPresentationWeapon} from "./pg-reload-art";
import {addPgWeaponPresentation,createPgOrbitModel,createPgBeveledHousingGeometry,createPgSculptedHousingGeometry,PG_WEAPON_PRESENCE} from "./pg-weapon-presentation";
import {extendPgSleeveElbow,routePgAdsElbow,pgSleeveRadius,createPgSleeveGeometry} from "./pg-viewmodel-arm-art";

export const PG_VIEWMODEL_LAYER=1;
const WEAPON_MODELS:Record<PgPresentationWeapon,BrWeaponId|null>={pulse:"pulse-rifle",nova:"nova-smg",photon:"photon-shotgun",quasar:"quasar-carbine",rail:"rail-laser",comet:"comet-hand-cannon",helix:"helix-burst-rifle",arc:"arc-blaster",prism:"prism-beam",orbit:null};
// Camera-space presentation only. Sight heights refer to canonical model space.
const BASE_POSES:Record<PgPresentationWeapon,{scale:number;sight:number;x:number;y:number;z:number;adsZ:number;support:number;grip:number;kick:number;sprint:number}>={
  pulse:{scale:.38,sight:.35,x:.22,y:-.23,z:-.43,adsZ:-.46,support:-1.02,grip:-.32,kick:.065,sprint:.28},
  nova:{scale:.38,sight:.30,x:.21,y:-.22,z:-.43,adsZ:-.44,support:-.62,grip:-.24,kick:.05,sprint:.36},
  photon:{scale:.34,sight:.215,x:.22,y:-.24,z:-.46,adsZ:-.49,support:-1.12,grip:-.26,kick:.1,sprint:.22},
  quasar:{scale:.36,sight:.30,x:.22,y:-.23,z:-.46,adsZ:-.49,support:-1.02,grip:-.25,kick:.07,sprint:.26},
  rail:{scale:.34,sight:.37,x:.24,y:-.25,z:-.49,adsZ:-.56,support:-1.13,grip:-.34,kick:.105,sprint:.18},
  comet:{scale:.42,sight:.265,x:.18,y:-.22,z:-.45,adsZ:-.47,support:-.17,grip:-.12,kick:.12,sprint:.42},
  helix:{scale:.38,sight:.23,x:.22,y:-.23,z:-.44,adsZ:-.46,support:-1.02,grip:-.28,kick:.065,sprint:.28},
  arc:{scale:.37,sight:.35,x:.23,y:-.23,z:-.46,adsZ:-.48,support:-.95,grip:-.23,kick:.075,sprint:.24},
  prism:{scale:.37,sight:.35,x:.23,y:-.23,z:-.46,adsZ:-.48,support:-.80,grip:-.15,kick:.04,sprint:.22},
  orbit:{scale:.46,sight:.22,x:.17,y:-.21,z:-.43,adsZ:-.45,support:-.12,grip:-.10,kick:.055,sprint:.46}
};
const POSES=Object.fromEntries(Object.entries(BASE_POSES).map(([id,p])=>[id,{...p,scale:p.scale*PG_WEAPON_PRESENCE[id as PgPresentationWeapon]}])) as typeof BASE_POSES;
export interface PgViewmodelState {weapon:PgPresentationWeapon;ads:number;recoil:number;reload:number;speed:number;mode:string;time:number;suitAccent?:number;modules?:readonly PgModuleId[];landing?:number;verticalSpeed?:number;airborne?:boolean;wallSide?:number}

/** Camera child; all lighting and geometry use a dedicated layer. No gameplay ownership. */
export function createPgViewmodel(){
  const root=new THREE.Group();root.name="planet-gun-viewmodel";
  const rig=new THREE.Group();root.add(rig);
  const library=new BrWeaponModelLibrary(),weapons=new Map<PgPresentationWeapon,THREE.Group>();
  const modules=new Map<PgPresentationWeapon,ReturnType<typeof createPgModuleArt>>();
  const hardware=new Map<PgPresentationWeapon,ReturnType<typeof addPgWeaponPresentation>>();
  const ownedGeometry=new Set<THREE.BufferGeometry>(),ownedMaterials=new Set<THREE.Material>();
  const ownG=<T extends THREE.BufferGeometry>(g:T):T=>{ownedGeometry.add(g);return g;};
  const ownM=<T extends THREE.Material>(m:T):T=>{ownedMaterials.add(m);return m;};
  const frame=ownM(new THREE.MeshStandardMaterial({color:0xa4b6c6,roughness:.38,metalness:.38}));
  const dark=ownM(new THREE.MeshStandardMaterial({color:0x273749,roughness:.46,metalness:.3}));
  const glove=ownM(new THREE.MeshStandardMaterial({color:0x263b4d,roughness:.86}));
  const sleeve=ownM(new THREE.MeshStandardMaterial({color:0x6c8191,roughness:.86,metalness:.03}));
  const accent=ownM(new THREE.MeshStandardMaterial({color:0x64e5d2,emissive:0x64e5d2,emissiveIntensity:.12,roughness:.45}));
  const lensMaterial=ownM(new THREE.MeshBasicMaterial({color:0x75d9f0,transparent:true,opacity:.045,depthWrite:false,side:THREE.DoubleSide}));
  const box=ownG(new THREE.BoxGeometry(1,1,1)),handGeo=ownG(new THREE.SphereGeometry(1,10,8)),armGeo=ownG(new THREE.CylinderGeometry(1,1,1,12)),sleeveGeo=ownG(createPgSleeveGeometry());
  const artResources={box,bevel:ownG(createPgBeveledHousingGeometry()),sculpted:ownG(createPgSculptedHousingGeometry()),metal:frame,composite:dark,grip:glove,ownMaterial:ownM};
  const mesh=(parent:THREE.Object3D,name:string,g:THREE.BufferGeometry,m:THREE.Material,at:number[],scale:number[])=>{const o=new THREE.Mesh(g,m);o.name=name;o.position.set(at[0],at[1],at[2]);o.scale.set(scale[0],scale[1],scale[2]);parent.add(o);return o;};
  // Broad camera-relative fill keeps metal legible without emissive receivers or world lights.
  const fill=new THREE.HemisphereLight(0xd9edff,0x56657a,1.65);fill.name="pg-viewmodel-fill";root.add(fill);
  const key=new THREE.DirectionalLight(0xffeedb,2.4);key.name="pg-viewmodel-key";key.position.set(-1,2,1);key.target.position.set(0,0,-1);root.add(key,key.target);
  const arms:{group:THREE.Group;forearm:THREE.Mesh;hand:THREE.Group;cuff:THREE.Mesh}[]=[];
  for(const side of[-1,1]){
    const group=new THREE.Group();group.name=side<0?"support-forearm":"trigger-forearm";rig.add(group);
    const forearm=mesh(group,"astronaut-sleeve",sleeveGeo,sleeve,[0,0,0],[.058,.3,.058]);
    const hand=new THREE.Group();hand.name=side<0?"support-glove":"trigger-glove";group.add(hand);
    mesh(hand,"glove-palm",handGeo,glove,[0,0,0],[.046,.046,.062]);
    mesh(hand,"glove-knuckle-plate",box,frame,[side*.032,.015,-.009],[.014,.044,.063]);
    for(let f=0;f<3;f++)mesh(hand,"glove-finger",box,glove,[-side*.012,-.024+f*.017,-.045],[.055,.013,.024]);
    mesh(hand,"glove-thumb",handGeo,glove,[-side*.032,.026,.002],[.018,.027,.031]);
    const cuff=mesh(group,"suit-cuff",armGeo,accent,[0,0,0],[.046,.018,.046]);arms.push({group,forearm,hand,cuff});
  }
  for(const weapon of Object.keys(WEAPON_MODELS)as PgPresentationWeapon[]){
    const canonical=WEAPON_MODELS[weapon],model=canonical?library.create(canonical,0x81ecdf):createPgOrbitModel(artResources),p=POSES[weapon];
    // Clone local metal materials only; remote library templates retain exact resources.
    const localMaterials=new Map<THREE.Material,THREE.Material>();
    model.traverse(o=>{if(!(o instanceof THREE.Mesh))return;
      const revise=(m:THREE.Material)=>{let local=localMaterials.get(m);if(local)return local;local=m.clone();ownM(local);localMaterials.set(m,local);
        if(local instanceof THREE.MeshStandardMaterial){local.metalness=Math.min(.45,local.metalness);local.roughness=Math.max(.36,local.roughness);local.emissiveIntensity=Math.min(.22,local.emissiveIntensity);if(local.color.getHex()===0x19263b)local.color.setHex(0x27394c);}return local;};
      o.material=Array.isArray(o.material)?o.material.map(revise):revise(o.material);
    });
    const scopeNames=weapon==="rail"?["rail-scope-body","rail-scope-rear","rail-scope-front"]:weapon==="quasar"?["quasar-optic"]:[];
    for(const name of scopeNames){
      const scope=model.getObjectByName(name)as THREE.Mesh<THREE.CylinderGeometry>,params=scope.geometry.parameters;
      // Thin open tube, no opaque end caps. Consistent bore avoids a thick nested tire silhouette.
      const radius=weapon==="rail"?(name==="rail-scope-body"?.098:.105):.095;
      scope.geometry=ownG(new THREE.CylinderGeometry(radius,radius,params.height,24,1,true));scope.material=weapon==="rail"&&name!=="rail-scope-rear"?dark:frame;
      for(const sign of[-1,1]){
        const rear=weapon!=="rail"||name==="rail-scope-rear";
        const ring=mesh(model,`${name}-open-rim-${sign}`,ownG(new THREE.RingGeometry(radius-(rear?.007:.0045),radius,24)),rear?frame:dark,[scope.position.x,scope.position.y,scope.position.z+sign*params.height/2],[1,1,1]);
        ring.userData.pgOpticRearRim=rear; // Forward rims recede instead of forming a second bright target.
      }
    }
    if(scopeNames.length){
      const old=model.getObjectByName(weapon==="rail"?"rail-scope-lens":"quasar-lens");if(old)old.visible=false;
      const z=weapon==="rail"?-.165:-.255,r=weapon==="rail"?.097:.087;
      const glass=mesh(model,"pg-optic-glass",ownG(new THREE.CircleGeometry(r,32)),lensMaterial,[0,p.sight,z],[1,1,1]);glass.userData.pgOpticGlass=true;
      for(const side of[-1,1])mesh(model,"optic-mount-clamp",box,frame,[side*.078,p.sight-.14,-.48],[.025,.08,.07]);
    }
    if(weapon==="rail"){
      // The canonical stock is correct remotely, but its camera-facing end dominated ADS.
      for(const o of model.children){if(o instanceof THREE.Mesh&&o.position.y===.25&&o.position.z===-.45){o.name="rail-local-low-mount";o.position.y=.19;o.scale.y=.65;}if(o instanceof THREE.Mesh&&o.position.z>.1){o.scale.x*=.7;o.scale.z*=.62;o.position.z*=.55;}}
      for(const side of[-1,1]){
        mesh(model,"rail-receiver-cheek",box,frame,[side*.116,-.015,-.59],[.018,.12,.49]);
        for(let i=0;i<4;i++)mesh(model,"rail-thermal-slot",box,dark,[side*.128,.005,-.4-i*.12],[.008,.055,.045]);
        mesh(model,"rail-lower-channel",box,frame,[side*.085,-.105,-1.14],[.026,.025,.65]);
      }
      mesh(model,"rail-bolt-tab",box,frame,[.18,.02,-.23],[.13,.035,.07]);
    }
    // Trigger guard and lower support shoe make the visible glove contacts intentional.
    mesh(model,"local-trigger-guard",box,frame,[.052,-.20,p.grip-.07],[.016,.10,.16]);
    if(weapon!=="comet"&&weapon!=="orbit")mesh(model,"local-support-shoe",box,dark,[0,-.12,p.support],[.2,.06,.22]);
    if(weapon==="arc"||weapon==="prism"){
      for(const side of[-1,1])mesh(model,"local-energy-reflex-post",box,frame,[side*.075,p.sight,-.25],[.025,.13,.055]);
      mesh(model,"local-energy-reflex-bridge",box,frame,[0,p.sight+.075,-.25],[.175,.025,.055]);
    }
    hardware.set(weapon,addPgWeaponPresentation(model,weapon,artResources));modules.set(weapon,createPgModuleArt(model,weapon,artResources));
    model.scale.setScalar(p.scale);model.visible=false;rig.add(model);weapons.set(weapon,model);
  }
  root.traverse(o=>{o.layers.set(PG_VIEWMODEL_LAYER);o.userData.cameraCollision=false;if(o instanceof THREE.Mesh){o.castShadow=false;o.receiveShadow=false;}});
  let current:PgPresentationWeapon|null=null,pending:PgPresentationWeapon|null=null,switchedAt=-1000,raisedAt=-1000,disposed=false,lastTime=0,poseX=.22,poseY=-.23,poseZ=-.43,sprint=0,movementLean=0;
  const reloadSample=createPgReloadSample();
  const clamp=(v:number)=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));
  const wrist=new THREE.Vector3(),elbow=new THREE.Vector3(),direction=new THREE.Vector3(),up=new THREE.Vector3(0,1,0),parentOrientation=new THREE.Quaternion();
  return{root,update(state:PgViewmodelState):void{
    if(disposed)return;
    const time=Number.isFinite(state.time)?state.time:lastTime,dt=Math.min(.05,Math.max(0,(time-lastTime)/1000));lastTime=time;
    if(current===null){current=state.weapon;weapons.get(current)!.visible=true;}
    else if(state.weapon!==current&&pending!==state.weapon){pending=state.weapon;switchedAt=time;}
    else if(state.weapon===current&&pending!==null){pending=null;raisedAt=-1000;}
    const lowerDuration=65+PG_RELOAD_PROFILES[current].weight*22;
    if(pending!==null&&time-switchedAt>=lowerDuration){weapons.get(current)!.visible=false;current=pending;pending=null;weapons.get(current)!.visible=true;raisedAt=switchedAt+lowerDuration;}
    if(state.suitAccent!==undefined){accent.color.setHex(state.suitAccent);accent.emissive.copy(accent.color);}
    const p=POSES[current],profile=PG_RELOAD_PROFILES[current],pistol=current==="comet"||current==="orbit",ads=clamp(state.ads),reload=current===state.weapon?clamp(state.reload):0,kick=current===state.weapon?clamp(state.recoil):0,speed=Math.min(14,Math.max(0,state.speed||0));
    if(current===state.weapon)modules.get(current)!.setModules(state.modules??[]);
    samplePgReload(current,reload,(pistol?-.028:-.07)/p.scale,-.10,p.support,reloadSample);hardware.get(current)!.update(reloadSample,kick);
    const smooth=1-Math.exp(-24*dt),switchProgress=clamp((time-switchedAt)/lowerDuration),switchDip=pending!==null?switchProgress*switchProgress*(3-2*switchProgress):clamp(1-(time-raisedAt)/(80+profile.weight*20));
    sprint+=((state.mode==="sprint"?1:0)-sprint)*(1-Math.exp(-12*dt));
    const bob=(Math.sin(time*.011)*Math.min(speed/10,1)*.006+Math.sin(time*.0018)*.0012)*(1-ads);
    const landing=clamp(state.landing??0),airLift=state.airborne?Math.max(-1,Math.min(1,(state.verticalSpeed??0)/12))*.018:0;
    const targetLean=state.mode==="wall-run"?-.07*(state.wallSide===-1?-1:1):state.mode==="slide"?.1:state.mode==="mantle"?.18:0;
    movementLean+=(targetLean-movementLean)*(1-Math.exp(-14*dt));
    poseX+=(p.x*(1-ads)-poseX)*smooth;poseY+=(-p.sight*p.scale*ads+p.y*(1-ads)-poseY)*smooth;poseZ+=(p.z*(1-ads)+p.adsZ*ads-poseZ)*smooth;
    rig.position.set(poseX+bob*.5,poseY+bob+reloadSample.present*.035-switchDip*.23-sprint*.035*(1-ads)-landing*.025+airLift*(1-ads),poseZ+kick*.04);
    rig.rotation.set(kick*p.kick+reloadSample.present*.045+sprint*.08*(1-ads)+landing*.025,sprint*p.sprint*(1-ads),((movementLean-sprint*.14)*(1-ads))+reloadSample.present*(pistol?.20:.12));
    rig.updateMatrix();
    for(let i=0;i<arms.length;i++){
      const a=arms[i],support=i===0,side=support?-1:1;
      if(support)wrist.set(reloadSample.handX*p.scale,reloadSample.handY*p.scale,reloadSample.handZ*p.scale);
      else wrist.set(pistol?.028:.044,-.24*p.scale,p.grip*p.scale);
      elbow.set(side*(support?.20:.18),-.19,support?.10:.20);
      routePgAdsElbow(elbow,side,ads);
      const sleeveRadius=pgSleeveRadius(ads);
      extendPgSleeveElbow(wrist,elbow,rig.matrix,sleeveRadius);
      direction.subVectors(wrist,elbow);const length=direction.length();direction.normalize();
      a.forearm.position.copy(elbow).add(wrist).multiplyScalar(.5);a.forearm.scale.set(sleeveRadius,length,sleeveRadius);a.forearm.quaternion.setFromUnitVectors(up,direction);
      const cuffRadius=sleeveRadius+.001;
      a.cuff.scale.set(cuffRadius,.018,cuffRadius);
      a.cuff.position.copy(wrist).addScaledVector(direction,-.063);a.cuff.quaternion.copy(a.forearm.quaternion);
      a.hand.position.copy(wrist);a.hand.rotation.set(support?-.22+reloadSample.present*.12:.12,support&&!pistol?-.45+reloadSample.present*.22:side*.2,side*.18+(support?reloadSample.cellRoll:0));
    }
  },getReloadPhase(){return reloadSample.phase;},getMuzzle(target:THREE.Vector3,orientation?:THREE.Quaternion):boolean{
    if(disposed||current===null)return false;
    const model=weapons.get(current)!;const anchor=model.userData.muzzle as THREE.Vector3;
    model.updateWorldMatrix(true,false);target.copy(anchor).applyMatrix4(model.matrixWorld);
    if(root.parent)root.parent.worldToLocal(target);
    if(orientation){model.getWorldQuaternion(orientation);if(root.parent){root.parent.getWorldQuaternion(parentOrientation);orientation.premultiply(parentOrientation.invert());}}
    return Number.isFinite(target.x)&&Number.isFinite(target.y)&&Number.isFinite(target.z);
  },dispose():void{if(disposed)return;disposed=true;for(const module of modules.values())module.dispose();library.dispose();for(const g of ownedGeometry)g.dispose();for(const m of ownedMaterials)m.dispose();root.clear();}};
}
