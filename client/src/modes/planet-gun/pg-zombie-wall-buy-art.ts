import * as THREE from "three";
import {mergeGeometries} from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {PG_WEAPONS,type PgWeaponId} from "@planetfall/shared";
import type {GraphicsQuality} from "../../settings";
import {createPgPreviewModels} from "./pg-kit-preview";
import {createPgMachineReadout,createPgMachineShell} from "./pg-zombie-tonic-art";

type Point={x:number;y:number;z:number};
export interface PgWallBuySite {id:string;weaponId:PgWeaponId;price:number;position:Point;yaw:number;bodyHalf:Point}

/** Permanent display racks. Positions and dimensions are consumed in installation-local space. */
export function createPgZombieWallBuyArt(sites:readonly PgWallBuySite[]) {
  const root=new THREE.Group();root.name="pg-zombie-wall-buys";
  const models=createPgPreviewModels(),box=new THREE.BoxGeometry(),baked:THREE.BufferGeometry[]=[];
  const alloy=new THREE.MeshStandardMaterial({color:0x8d9e9e,metalness:.42,roughness:.55});
  const backing=new THREE.MeshStandardMaterial({color:0x334858,roughness:.65});
  const bezel=new THREE.MeshStandardMaterial({color:0x172734,roughness:.72});
  const active=new THREE.MeshBasicMaterial({color:0x7ae0d7}),warm=new THREE.Color(0x7ae0d7),standby=new THREE.Color(0x66797e);
  const templates=new Map<PgWeaponId,{group:THREE.Group;size:THREE.Vector3}>();
  function getWeapon(id:PgWeaponId){
    const cached=templates.get(id);if(cached)return cached;
    const model=models.get(id);model.modules.setModules([]);model.root.updateMatrixWorld(true);
    // These six weapons never articulate. Batch their actual visible parts by original
    // finish so display racks retain model geometry, optics and materials at low draw cost.
    const batches=new Map<THREE.Material,THREE.BufferGeometry[]>();
    model.root.traverseVisible(part=>{
      if(!(part instanceof THREE.Mesh))return;
      const geometry=part.geometry.index?part.geometry.toNonIndexed():part.geometry.clone();
      geometry.applyMatrix4(part.matrixWorld);geometry.rotateY(-Math.PI/2);
      for(const attr of Object.keys(geometry.attributes))if(attr!=="position"&&attr!=="normal")geometry.deleteAttribute(attr);
      const list=batches.get(part.material)??[];list.push(geometry);batches.set(part.material,list);
    });
    const group=new THREE.Group();group.name=model.root.name;
    const bounds=new THREE.Box3();
    for(const [material,parts] of batches){
      const geometry=mergeGeometries(parts)!;parts.forEach(g=>g.dispose());geometry.computeBoundingBox();
      bounds.union(geometry.boundingBox!);baked.push(geometry);group.add(new THREE.Mesh(geometry,material));
    }
    const center=bounds.getCenter(new THREE.Vector3());
    group.children.forEach(part=>part.position.copy(center).negate());
    const result={group,size:bounds.getSize(new THREE.Vector3())};templates.set(id,result);return result;
  }
  const racks=sites.slice(0,6).map(site=>{
    const rack=new THREE.Group();rack.name=site.id;rack.position.copy(site.position);rack.rotation.y=site.yaw;root.add(rack);
    const body=new THREE.Group();body.name="fixed-body-group";rack.add(body);
    const {x,y,z}=site.bodyHalf,shell=createPgMachineShell(body),part=shell.part;
    part(box,backing,0,y,z*.75,x*1.98,y*1.98,z*.42);
    part(box,bezel,0,y*1.21,z*.49,x*1.80,y*1.22,z*.10);
    for(const side of [-1,1]){
      part(box,alloy,side*x*.94,y,z*.46,x*.085,y*1.96,z*.46);
      part(box,alloy,side*x*.43,y*.83,-z*.1,x*.086,y*.13,z*1.2);
      part(box,bezel,side*x*.43,y*.90,-z*.65,x*.12,y*.18,z*.15);
    }
    part(box,bezel,0,y*.30,z*.18,x*1.84,y*.45,z*.54);
    part(box,active,0,y*1.865,z*.38,x*1.64,y*.034,z*.1);
    shell.build();
    const label=createPgMachineReadout(PG_WEAPONS[site.weaponId].name,0x81e9dc);
    label.write(`WALL BUY  /  ${site.price} POINTS`);
    label.mesh.position.set(0,y*.30,-z*.104);label.mesh.scale.set(x*1.72,y*.407,1);body.add(label.mesh);
    const {group,size}=getWeapon(site.weaponId),display=group.clone(true);
    const scale=Math.min(x*1.65/size.x,y*.90/size.y,z*1.32/size.z);
    display.scale.setScalar(scale);display.position.set(0,y*1.24,-z*.27);rack.add(display);
    return {shell,label};
  });
  let disposed=false;
  return {root,
    update(powered:boolean,time:number,quality:GraphicsQuality,reducedMotion:boolean){
      if(disposed)return;
      // One status bus serves all racks. Motion is a mild brightness shift, never a flash.
      active.color.copy(powered?warm:standby);
      if(powered&&!reducedMotion&&quality!=="low"&&Number.isFinite(time))active.color.multiplyScalar(.96+.04*Math.cos(time*.0012));
    },
    dispose(){
      if(disposed)return;disposed=true;root.removeFromParent();root.clear();
      for(const {shell,label} of racks){shell.dispose();label.dispose();}
      baked.forEach(g=>g.dispose());templates.clear();models.dispose();
      box.dispose();alloy.dispose();backing.dispose();bezel.dispose();active.dispose();
    }
  };
}
