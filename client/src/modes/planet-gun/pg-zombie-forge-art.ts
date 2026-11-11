import * as THREE from "three";
import {PG_PRIMARY_WEAPONS,PG_WEAPONS,type PgWeaponId} from "@planetfall/shared";
import type {GraphicsQuality} from "../../settings";
import {createPgPreviewModels} from "./pg-kit-preview";
import {createPgMachineReadout,createPgMachineShell} from "./pg-zombie-tonic-art";

export interface PgZombieForgeView {
  phase:"idle"|"processing"|"complete";weaponId:PgWeaponId|null;ownerName:string|null;
  tier:0|1|2|3;startedAt:number|null;completesAt:number|null;price:number|null;
}
const tierNames=["STANDARD","OC I","OC II","OC III"];
type Primary=typeof PG_PRIMARY_WEAPONS[number];

export function createPgZombieForgeArt(site:{position:{x:number;y:number;z:number};yaw:number}) {
  const root=new THREE.Group(),body=new THREE.Group(),stage=new THREE.Group();
  root.name="pg-zombie-overcharge-forge";root.position.copy(site.position);root.rotation.y=site.yaw;root.visible=false;
  body.name="fixed-body-group";stage.name="forge-weapon-cradle";root.add(body,stage);
  const box=new THREE.BoxGeometry(),drum=new THREE.CylinderGeometry(1,1,1,20);
  const shell=createPgMachineShell(body),part=shell.part;
  const armor=new THREE.MeshStandardMaterial({color:0x738e98,metalness:.45,roughness:.44});
  const casing=new THREE.MeshStandardMaterial({color:0x293949,metalness:.29,roughness:.7});
  const insulation=new THREE.MeshStandardMaterial({color:0x17212c,roughness:.58});
  const ceramic=new THREE.MeshStandardMaterial({color:0xc3956e,roughness:.54});
  const emitter=new THREE.MeshBasicMaterial({color:0xffae72});
  part(box,casing,0,.075,0,2.15,.15,1.25);
  part(box,armor,0,.37,.035,1.98,.46,1.08);
  part(box,insulation,0,.39,-.514,1.8,.29,.06);
  for(let i=0;i<8;i++)part(box,ceramic,-.69+i*.195,.38,-.548,.086,.16,.025,-.25);
  part(box,casing,0,.69,0,2.07,.22,1.18);
  part(box,insulation,0,.825,-.05,1.48,.06,.77);
  for(const side of [-1,1]){
    // A pair of inclined press jaws straddles the horizontal workpiece.
    part(box,armor,side*.92,1.23,.13,.22,.88,.61,-side*.105);
    part(box,ceramic,side*.83,1.30,-.145,.20,.38,.32);
    for(const y of [1.20,1.35])part(box,insulation,side*.73,y,-.14,.16,.055,.26);
    part(box,emitter,side*.82,1.29,-.313,.09,.24,.014);
    part(drum,casing,side*.60,.865,-.05,.15,.073,.16);
  }
  part(box,casing,0,1.23,.50,1.92,.81,.18);
  part(box,insulation,0,1.26,.395,1.62,.53,.04);
  part(box,armor,0,1.72,.27,2.10,.31,.63);
  part(box,ceramic,0,1.884,.28,2.08,.025,.68);
  shell.build();
  const readout=createPgMachineReadout("OVERCHARGE FORGE",0xffc499);
  readout.mesh.position.set(0,1.72,-.05);readout.mesh.scale.set(1.95,.263,1);body.add(readout.mesh);
  const flow=new THREE.Mesh(box,emitter);
  flow.name="forge-energy-flow";flow.position.set(0,.872,-.32);flow.scale.set(.16,.015,.06);body.add(flow);
  const models=createPgPreviewModels(),cache=new Map<Primary,THREE.Group>();
  let active:THREE.Group|null=null;
  function placeWeapon(id:PgWeaponId|null) {
    let next:THREE.Group|null=null;
    if(id && PG_PRIMARY_WEAPONS.includes(id as Primary)){
      const key=id as Primary;next=cache.get(key)??null;
      if(!next){
        const stock=models.get(key);stock.modules.setModules([]);
        const model=stock.root;model.updateMatrixWorld(true);
        const bounds=new THREE.Box3(),point=new THREE.Vector3();
        model.traverseVisible(part=>{
          if(!(part instanceof THREE.Mesh))return;
          const positions=part.geometry.getAttribute("position");
          for(let i=0;i<positions.count;i++)bounds.expandByPoint(point.fromBufferAttribute(positions,i).applyMatrix4(part.matrixWorld));
        });
        const size=bounds.getSize(point),scale=Math.min(1.39/size.z,.58/size.y,.48/size.x);
        bounds.getCenter(model.position).multiplyScalar(-1);
        next=new THREE.Group();next.name=`forge-stock-${key}`;next.add(model);next.scale.setScalar(scale);
        cache.set(key,next);
      }
    }
    if(next!==active){active?.removeFromParent();active=next;if(next)stage.add(next);}
  }
  let disposed=false;
  let lastPhase:PgZombieForgeView["phase"]|null=null,lastId:PgWeaponId|null=null,lastOwner:string|null=null;
  let lastTier=-1,lastPrice:number|null=null;
  return {root,
    update(view:PgZombieForgeView|null,time:number,quality:GraphicsQuality,reduced:boolean){
      if(disposed)return;
      root.visible=!!view;
      if(!view){placeWeapon(null);lastPhase=null;return;}
      if(lastPhase!==view.phase || lastId!==view.weaponId || lastTier!==view.tier || lastPrice!==view.price || lastOwner!==view.ownerName){
        lastPhase=view.phase;lastId=view.weaponId;lastTier=view.tier;lastPrice=view.price;lastOwner=view.ownerName;
        placeWeapon(view.phase==="idle"?null:view.weaponId);
        const tier=tierNames[view.tier],name=view.weaponId?PG_WEAPONS[view.weaponId].name:"",owner=view.ownerName?' / '+view.ownerName:"";
        if(view.phase==="idle")readout.write(view.price===null?"STANDBY":`NEXT ${tierNames[Math.min(view.tier+1,3)]}  /  ${view.price} PTS`);
        else if(view.phase==="processing")readout.write(`CHARGING ${tier}${owner}`);
        else readout.write(`${name}  /  ${tier}${owner}`);
        emitter.color.setHex(view.phase==="complete"?0x88f7d9:view.phase==="processing"?0xffad68:0xd2a47e);
      }
      const processing=view.phase==="processing",motion=processing&&!reduced&&quality!=="low"&&Number.isFinite(time);
      const duration=(view.completesAt??0)-(view.startedAt??0);
      const progress=motion&&duration>0?THREE.MathUtils.clamp((time-(view.startedAt??0))/duration,0,1):.5;
      flow.position.x=processing?(progress-.5)*1.15:0;
      flow.scale.x=processing ? .33 : .16;
      stage.position.set(0,1.217+(motion?Math.sin(time*.004)*.012:0),-.073);
      stage.rotation.y=Math.PI/2+.045;
    },
    dispose(){
      if(disposed)return;disposed=true;
      active?.removeFromParent();models.dispose();cache.clear();shell.dispose();readout.dispose();
      root.removeFromParent();root.clear();box.dispose();drum.dispose();
      for(const material of [armor,casing,insulation,ceramic,emitter])material.dispose();
    }
  };
}
