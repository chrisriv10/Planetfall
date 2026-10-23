import * as THREE from "three";
import type { BrWeaponId, PgWeaponId } from "@planetfall/shared";
import { BrWeaponModelLibrary } from "../battle-royale/br-weapon-model-library";

const WEAPON_MODELS: Record<PgWeaponId, BrWeaponId> = {pulse:"pulse-rifle",nova:"nova-smg",photon:"photon-shotgun",quasar:"quasar-carbine",rail:"rail-laser",comet:"comet-hand-cannon"};
const SIGHT_HEIGHT: Record<PgWeaponId, number> = {pulse:.35,nova:.30,photon:.215,quasar:.3,rail:.37,comet:.265};
export interface PgViewmodelState {weapon:PgWeaponId;ads:number;recoil:number;reload:number;speed:number;mode:string;time:number;suitAccent?:number}

/** Attach root directly to the FPS camera. No shot origin, hit or input ownership.
 * Time is elapsed milliseconds; reload is normalized progress (0 when inactive). */
export function createPgViewmodel() {
  const root=new THREE.Group();root.name="planet-gun-viewmodel";
  const rig=new THREE.Group();root.add(rig);
  const library=new BrWeaponModelLibrary(),weapons=new Map<PgWeaponId,THREE.Group>();
  const opticGeometry:THREE.BufferGeometry[]=[];
  const opticRimMaterial=new THREE.MeshStandardMaterial({color:0x243348,roughness:.5,metalness:.5,side:THREE.DoubleSide});
  const geometry=new THREE.CapsuleGeometry(.07,.3,4,8);
  const gloveGeometry=new THREE.SphereGeometry(.085,10,7);
  const cuffGeometry=new THREE.CylinderGeometry(.082,.082,.055,10);
  const sleeve=new THREE.MeshStandardMaterial({color:0xdce9ef,roughness:.8,metalness:.12});
  const glove=new THREE.MeshStandardMaterial({color:0x213044,roughness:.8});
  const accent=new THREE.MeshStandardMaterial({color:0x64e5d2,emissive:0x64e5d2,emissiveIntensity:.12,roughness:.5});
  const arms:THREE.Group[]=[];
  for(const side of [-1,1]){
    const arm=new THREE.Group();arm.name=side<0?"support-forearm":"trigger-forearm";
    const forearm=new THREE.Mesh(geometry,sleeve);forearm.rotation.x=Math.PI/2;forearm.scale.set(1,1.1,1);arm.add(forearm);
    const hand=new THREE.Mesh(gloveGeometry,glove);hand.position.z=-.24;hand.scale.set(.85,.8,1.2);arm.add(hand);
    const cuff=new THREE.Mesh(cuffGeometry,accent);cuff.rotation.x=Math.PI/2;cuff.position.z=-.18;arm.add(cuff);
    arm.position.set(side<0?-.09:.065,side<0?-.13:-.19,side<0?-.35:-.02);arm.rotation.y=side<0?-.2:.1;
    rig.add(arm);arms.push(arm);
  }
  for(const weapon of Object.keys(WEAPON_MODELS)as PgWeaponId[]){
    const model=library.create(WEAPON_MODELS[weapon],0x81ecdf);
    // Canonical remote scopes use closed cylinders. Only this local instance
    // gets an open bore; template geometry/materials remain library-owned.
    const scopeNames=weapon==="rail"?["rail-scope-body","rail-scope-rear","rail-scope-front"]:weapon==="quasar"?["quasar-optic"]:[];
    for(const name of scopeNames){
      const scope=model.getObjectByName(name)as THREE.Mesh<THREE.CylinderGeometry>;
      const p=scope.geometry.parameters;
      const bore=new THREE.CylinderGeometry(p.radiusTop,p.radiusBottom,p.height,p.radialSegments,1,true);
      opticGeometry.push(bore);scope.geometry=bore;
      for(const sign of[-1,1]){
        const radius=sign>0?p.radiusTop:p.radiusBottom;
        const ringGeometry=new THREE.RingGeometry(radius*.82,radius,16);opticGeometry.push(ringGeometry);
        const ring=new THREE.Mesh(ringGeometry,opticRimMaterial);ring.name=`${name}-open-rim-${sign}`;
        ring.position.copy(scope.position);ring.position.z+=sign*p.height/2;model.add(ring);
      }
    }
    if(scopeNames.length){const lens=model.getObjectByName(weapon==="rail"?"rail-scope-lens":"quasar-lens");if(lens)lens.visible=false;}
    model.scale.setScalar(.43);model.visible=false;rig.add(model);weapons.set(weapon,model);
  }
  root.traverse(o=>{o.userData.cameraCollision=false;if(o instanceof THREE.Mesh){o.castShadow=false;o.receiveShadow=false;}});
  let current:PgWeaponId|null=null,switchedAt=-1000,disposed=false,lastTime=0,poseY=-.25,poseX=.23;
  const clamp=(v:number)=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));
  return {
    root,
    update(state:PgViewmodelState):void {
      if(disposed)return;
      const time=Number.isFinite(state.time)?state.time:lastTime,dt=Math.min(.05,Math.max(0,(time-lastTime)/1000));lastTime=time;
      if(current!==state.weapon){for(const [id,model]of weapons)model.visible=id===state.weapon;current=state.weapon;switchedAt=time;}
      if(state.suitAccent!==undefined){accent.color.setHex(state.suitAccent);accent.emissive.copy(accent.color);}
      const ads=clamp(state.ads),reload=clamp(state.reload),kick=clamp(state.recoil),speed=Math.min(14,Math.max(0,state.speed||0));
      const cycle=time*.011,bob=Math.sin(cycle)*Math.min(speed/10,1)*.009*(1-ads);
      const reloadArc=reload>0?Math.sin(reload*Math.PI):0;
      const switchDip=Math.max(0,1-(time-switchedAt)/220);
      const targetX=.23*(1-ads),targetY=-.25*(1-ads)-SIGHT_HEIGHT[state.weapon]*.43*ads;
      const smooth=1-Math.exp(-24*dt);poseX+=(targetX-poseX)*smooth;poseY+=(targetY-poseY)*smooth;
      rig.position.set(poseX+bob*.5,poseY+bob-reloadArc*.2-switchDip*.18,-.29+kick*.055);
      rig.rotation.set(kick*.075+reloadArc*.45,0,(state.mode==="wall-run"?-.08:state.mode==="slide"?.12:0)*(1-ads)-reloadArc*.3);
      arms[0].position.y=-.13-reloadArc*.12;arms[0].position.z=-.35+reloadArc*.18;
      // A two-handed compact sidearm grip, with the same canonical glove geometry.
      arms[0].position.x=state.weapon==="comet"?-.025:-.09;
    },
    dispose():void {if(disposed)return;disposed=true;library.dispose();for(const r of[geometry,gloveGeometry,cuffGeometry,sleeve,glove,accent,opticRimMaterial,...opticGeometry])r.dispose();root.clear();}
  };
}
