import * as THREE from "three";
import {describe,it,expect,vi} from "vitest";
import {PG_PRIMARY_WEAPONS} from "@planetfall/shared";
import {createPgZombieForgeArt,type PgZombieForgeView} from "./pg-zombie-forge-art";
import {PG_PREVIEW_MODELS} from "./pg-kit-preview";

const site={position:{x:0,y:0,z:0},yaw:0};
const idle:PgZombieForgeView={phase:"idle",weaponId:"pulse",ownerName:null,tier:0,startedAt:null,completesAt:null,price:900};
const processing:PgZombieForgeView={...idle,phase:"processing",tier:1,ownerName:"Pilot",startedAt:1000,completesAt:3000};

describe("Overcharge Forge presentation",()=>{
  it("fits the complete fixed body and faces its supplied front",()=>{
    const art=createPgZombieForgeArt(site);expect(art.root.visible).toBe(false);
    art.update(idle,0,"low",true);
    const body=art.root.getObjectByName("fixed-body-group")!,bounds=new THREE.Box3().setFromObject(body);
    expect(bounds.min.x).toBeGreaterThanOrEqual(-1.1);expect(bounds.max.x).toBeLessThanOrEqual(1.1);
    expect(bounds.min.y).toBeGreaterThanOrEqual(-1e-6);expect(bounds.max.y).toBeLessThanOrEqual(1.9);
    expect(bounds.min.z).toBeGreaterThanOrEqual(-.65);expect(bounds.max.z).toBeLessThanOrEqual(.65);
    expect(body.children.length).toBeLessThan(12);
    const sign=body.getObjectByName("machine-readout")!;
    expect(sign.getWorldDirection(new THREE.Vector3()).z).toBeLessThan(-.99);
    expect(sign.userData.status).toContain("NEXT OC I  /  900 PTS");art.dispose();
  });
  it("clamps one canonical weapon, caches all eight identities and follows supplied phase even past its deadline",()=>{
    const art=createPgZombieForgeArt(site),stage=art.root.getObjectByName("forge-weapon-cradle")!,sign=art.root.getObjectByName("machine-readout")!;
    const models=new Set<THREE.Object3D>();
    for(let pass=0;pass<2;pass++)for(const weaponId of PG_PRIMARY_WEAPONS) {
      art.update({...processing,weaponId},5000,"high",false);
      expect(stage.children).toHaveLength(1);models.add(stage.children[0]);
      expect(stage.getObjectByName('br-weapon-'+PG_PREVIEW_MODELS[weaponId])).toBeDefined();
      expect(sign.userData.status).toContain("CHARGING OC I / Pilot");
    }
    expect(models.size).toBe(8);art.update({...processing,phase:"complete",tier:3},6000,"high",false);
    expect(sign.userData.status).toContain("Pulse Rifle  /  OC III");
    art.update(null,6100,"low",true);expect(art.root.visible).toBe(false);expect(stage.children).toHaveLength(0);
    art.dispose();
  });
  it("keeps reduced/low poses static and disposes the model and batches once",()=>{
    const art=createPgZombieForgeArt(site),stage=art.root.getObjectByName("forge-weapon-cradle")!,flow=art.root.getObjectByName("forge-energy-flow")!;
    for(const [quality,reduced] of [["high",true],["low",false]] as const) {
      art.update(processing,1000,quality,reduced);const pos=stage.position.clone(),x=flow.position.x;
      art.update(processing,2500,quality,reduced);expect(stage.position.equals(pos)).toBe(true);expect(flow.position.x).toBe(x);
    }
    art.update(processing,1000,"medium",false);const x=flow.position.x;art.update(processing,2500,"medium",false);expect(flow.position.x).toBeGreaterThan(x);
    const model=stage.getObjectByName("br-weapon-pulse-rifle")!,mesh=model.children.find(child=>child instanceof THREE.Mesh) as THREE.Mesh;
    const batch=art.root.getObjectByName("fixed-body-group")!.children.find(child=>child instanceof THREE.InstancedMesh) as THREE.InstancedMesh;
    const release=vi.spyOn(mesh.geometry,"dispose"),releaseBatch=vi.spyOn(batch,"dispose");
    art.dispose();art.dispose();expect(release).toHaveBeenCalledOnce();expect(releaseBatch).toHaveBeenCalledOnce();
  });
});
