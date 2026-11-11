import * as THREE from "three";
import {afterEach,describe,expect,it,vi} from "vitest";
import {createPgZombieWallBuyArt,type PgWallBuySite} from "./pg-zombie-wall-buy-art";
import {createPgPreviewModels,PG_PREVIEW_MODELS} from "./pg-kit-preview";
import {PG_WEAPONS} from "@planetfall/shared";

const sites:PgWallBuySite[]=(["pulse","nova","photon","rail","orbit","comet"] as const).map((weaponId,i)=>({
  id:"wall-"+weaponId,weaponId,price:350+i*125,position:{x:2*i,y:0,z:3},yaw:i%2*Math.PI,bodyHalf:{x:.95,y:.62,z:.23}
}));
afterEach(()=>vi.unstubAllGlobals());
function vertices(root:THREE.Group){
  let vertices=0;
  root.traverseVisible(node=>{if(node instanceof THREE.Mesh)vertices+=node.geometry.index?.count??node.geometry.getAttribute("position").count;});
  return vertices;
}
describe("Zombies wall-mounted supply racks",()=>{
  it("matches all six real weapon geometries with prices and front-facing placement within each supplied rack",()=>{
    const art=createPgZombieWallBuyArt(sites),canonical=createPgPreviewModels();
    for(const [i,site] of sites.entries()){
      const rack=art.root.children[i],body=rack.getObjectByName("fixed-body-group")!;
      expect(rack.position.toArray()).toEqual([site.position.x,0,3]);
      const readout=body.getObjectByName("machine-readout")!;
      expect(readout.getWorldDirection(new THREE.Vector3()).z).toBeCloseTo(-Math.cos(site.yaw));expect(readout.userData.status).toContain(String(site.price));
      rack.position.set(0,0,0);rack.rotation.y=0;art.root.updateMatrixWorld(true);
      const weapon=rack.getObjectByName("br-weapon-"+(PG_PREVIEW_MODELS[site.weaponId]??"orbit-sidearm")) as THREE.Group;
      const original=canonical.get(site.weaponId);original.modules.setModules([]);
      expect(vertices(weapon)).toBe(vertices(original.root));
      const bounds=new THREE.Box3().setFromObject(rack),gunBounds=new THREE.Box3().setFromObject(weapon),{x,y,z}=site.bodyHalf;
      expect(bounds.min.x).toBeGreaterThanOrEqual(-x);expect(bounds.max.x).toBeLessThanOrEqual(x);
      expect(bounds.min.y).toBeGreaterThanOrEqual(-.00001);expect(bounds.max.y).toBeLessThanOrEqual(2*y);
      expect(bounds.min.z).toBeGreaterThanOrEqual(-z);expect(bounds.max.z).toBeLessThanOrEqual(z);
      expect(gunBounds.max.z).toBeLessThan(.44*z);expect(gunBounds.min.y).toBeGreaterThan(.53*y);
      expect(weapon.children.length).toBeLessThan(24);
    }
    art.dispose();canonical.dispose();
  });
  it("writes the item's real name once, preserves reduced/low lighting and disposes shared templates exactly once",()=>{
    const ctx={fillRect:vi.fn(),fillText:vi.fn()};vi.stubGlobal("document",{createElement:()=>({getContext:()=>ctx})});
    const repeated={...sites[0],id:"test-second"};const art=createPgZombieWallBuyArt([sites[0],repeated,...sites]);
    expect(art.root.children).toHaveLength(6);
    expect(ctx.fillText.mock.calls.some(args=>args[0]===PG_WEAPONS.pulse.name)).toBe(true);
    const count=ctx.fillText.mock.calls.length,displays=art.root.children.slice(0,2).map(r=>r.getObjectByName("br-weapon-pulse-rifle")!);
    const first=displays[0].children[0] as THREE.Mesh;
    expect((displays[1].children[0] as THREE.Mesh).geometry).toBe(first.geometry);
    const body=art.root.children[0].getObjectByName("fixed-body-group")!;
    const bus=(body.children.find(child=>child instanceof THREE.InstancedMesh&&child.material instanceof THREE.MeshBasicMaterial) as THREE.Mesh<THREE.BoxGeometry,THREE.MeshBasicMaterial>).material;
    art.update(true,0,"high",true);const on=bus.color.clone();art.update(true,2300,"high",true);expect(bus.color.equals(on)).toBe(true);
    art.update(true,2300,"low",false);expect(bus.color.equals(on)).toBe(true);art.update(false,2300,"high",false);expect(bus.color.equals(on)).toBe(false);
    expect(ctx.fillText).toHaveBeenCalledTimes(count);
    const release=vi.spyOn(first.geometry,"dispose"),releaseMaterial=vi.spyOn(first.material as THREE.Material,"dispose");
    art.dispose();art.dispose();expect(release).toHaveBeenCalledOnce();expect(releaseMaterial).toHaveBeenCalledOnce();
  });
});
