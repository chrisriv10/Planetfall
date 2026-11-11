import * as THREE from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PG_PRIMARY_WEAPONS, PG_ZOMBIE_ARSENAL_COST, PG_ZOMBIE_ARSENAL_REVEAL_MS, type PgZombieArsenalSnapshot } from "@planetfall/shared";
import { createPgZombieArsenalArt } from "./pg-zombie-arsenal-art";
import { PG_PREVIEW_MODELS } from "./pg-kit-preview";

const site={position:{x:-20,y:0,z:-2.2},yaw:0};
const idle:PgZombieArsenalSnapshot={phase:"idle",ownerId:null,weaponId:null,revealAt:null,expiresAt:null};
const revealing:PgZombieArsenalSnapshot={phase:"revealing",ownerId:"pilot",weaponId:null,revealAt:PG_ZOMBIE_ARSENAL_REVEAL_MS,expiresAt:18000};
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});

describe("Anomaly Arsenal presentation",()=>{
  it("keeps the complete fixed body inside the authored box and faces the readout forward",()=>{
    const art=createPgZombieArsenalArt(site);
    expect(art.root.visible).toBe(false);
    art.update(idle,0,null,"low",false);
    expect(art.root.position.toArray()).toEqual([-20,0,-2.2]);
    art.root.updateMatrixWorld(true);
    const body=art.root.getObjectByName("fixed-body-group")!,bounds=new THREE.Box3().setFromObject(body);
    bounds.translate(art.root.position.clone().negate());
    expect(bounds.min.x).toBeGreaterThanOrEqual(-.75);expect(bounds.max.x).toBeLessThanOrEqual(.75);
    expect(bounds.min.y).toBeGreaterThanOrEqual(-1e-7);expect(bounds.max.y).toBeLessThanOrEqual(1.8);
    expect(bounds.min.z).toBeGreaterThanOrEqual(-.45);expect(bounds.max.z).toBeLessThanOrEqual(.45);
    const sign=body.getObjectByName("arsenal-readout")!;
    expect(sign.getWorldDirection(new THREE.Vector3()).z).toBeLessThan(-.99);
    expect(body.children.length).toBeLessThan(15);
    art.update(null,1,null,"medium",false);expect(art.root.visible).toBe(false);art.dispose();
  });
  it("cycles at most eight canonical silhouettes in one translucent draw, then shows only the authoritative result",()=>{
    const art=createPgZombieArsenalArt({...site,yaw:1.23}),stage=art.root.getObjectByName("arsenal-projection")!;
    expect(art.root.rotation.y).toBe(1.23);
    const generated=new Set<THREE.Object3D>();
    for(let pass=0;pass<2;pass++)for(let i=0;i<8;i++) {
      art.update(revealing,i*250,"Pilot","high",false);
      expect(stage.children).toHaveLength(1);const image=stage.children[0] as THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>;
      expect(image.name).toBe('arsenal-hologram-'+PG_PRIMARY_WEAPONS[i]);generated.add(image);
      expect(image.material.transparent).toBe(true);expect(image.material.depthWrite).toBe(false);expect(image.material.opacity).toBeLessThan(.5);
    }
    expect(generated.size).toBe(8);
    for(const weaponId of PG_PRIMARY_WEAPONS){
      art.update({...revealing,phase:"ready",weaponId},99999,"Pilot","medium",false);
      expect(stage.children).toHaveLength(1);expect(stage.children[0].name).toBe('br-weapon-'+PG_PREVIEW_MODELS[weaponId]);
      expect(stage.getObjectByName('pg-'+weaponId+'-power-cell')).toBeDefined();
    }
    art.update(idle,100000,null,"high",false);expect(stage.children).toHaveLength(0);art.dispose();
  });
  it("holds reduced motion, throttles low-tier cycling and redraws the readout only when the text changes",()=>{
    const ctx={fillText:vi.fn(),fillRect:vi.fn()};
    vi.stubGlobal("document",{createElement:()=>({getContext:()=>ctx})});
    const art=createPgZombieArsenalArt(site),stage=art.root.getObjectByName("arsenal-projection")!;
    art.update(revealing,0,"Pilot","low",true);stage.updateMatrix();
    const initial=stage.matrix.clone(),shape=stage.children[0],calls=ctx.fillText.mock.calls.length;
    expect(ctx.fillText.mock.calls.some(args=>args[0]===String(PG_ZOMBIE_ARSENAL_COST))).toBe(true);
    art.update(revealing,1750,"Pilot","low",true);stage.updateMatrix();
    expect(stage.matrix.equals(initial)).toBe(true);expect(stage.children[0]).toBe(shape);expect(ctx.fillText).toHaveBeenCalledTimes(calls);
    art.update(revealing,300,"Pilot","low",false);expect(stage.children[0]).toBe(shape);
    art.update(revealing,500,"Pilot","low",false);expect(stage.children[0]).not.toBe(shape);
    art.update(revealing,500,"New pilot","low",false);expect(ctx.fillText.mock.calls.length).toBeGreaterThan(calls);
    const sign=art.root.getObjectByName("arsenal-readout") as THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>;
    const releaseMap=vi.spyOn(sign.material.map!,"dispose"),releaseHolo=vi.spyOn((shape as THREE.Mesh).geometry,"dispose");
    art.update({...revealing,phase:"ready",weaponId:"pulse"},3000,"Pilot","high",false);
    const model=stage.children[0],mesh=model.children.find(child=>child instanceof THREE.Mesh) as THREE.Mesh;
    const releaseWeapon=vi.spyOn(mesh.geometry,"dispose");
    art.dispose();art.dispose();art.update(idle,0,null,"low",false);
    expect(releaseMap).toHaveBeenCalledOnce();expect(releaseHolo).toHaveBeenCalledOnce();expect(releaseWeapon).toHaveBeenCalledOnce();expect(art.root.children).toHaveLength(0);
  });
});
