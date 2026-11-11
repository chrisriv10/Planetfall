import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { createPgSiegeCameraArt } from "./pg-siege-camera-art";

const sites = [
  {id:"west", name:"West", position:{x:4,y:2,z:9}, target:{x:9,y:0,z:-20}},
  {id:"east", name:"East", position:{x:-9,y:6,z:3}, target:{x:-40,y:0,z:4}},
];
const states = sites.map(site => ({id:site.id, hp:100, maxHp:100, disabled:false}));

describe("Siege camera housings", () => {
  it("places the lens on the sightline with all geometry behind its optical face", () => {
    const art = createPgSiegeCameraArt(sites);
    art.update(states); art.root.updateMatrixWorld(true);
    for (const [i, group] of art.root.children.entries()) {
      const origin = new THREE.Vector3().copy(sites[i].position);
      const forward = new THREE.Vector3().copy(sites[i].target).sub(origin).normalize();
      expect(group.getWorldDirection(new THREE.Vector3()).distanceTo(forward)).toBeLessThan(1e-6);
      const lensFace = group.getObjectByName("lens")!.localToWorld(new THREE.Vector3(0,0,.5));
      expect(lensFace.distanceTo(origin)).toBeLessThan(1e-6);
      for (const mesh of group.children as THREE.Mesh[]) {
        const vertices = mesh.geometry.getAttribute("position");
        for (let v=0;v<vertices.count;v++) {
          const world = new THREE.Vector3().fromBufferAttribute(vertices,v).applyMatrix4(mesh.matrixWorld);
          expect(world.sub(origin).dot(forward)).toBeLessThan(1e-6);
        }
      }
    }
    art.dispose();
  });
  it("updates existing materials, hides absent state and disposes shared resources once", () => {
    const art = createPgSiegeCameraArt([...sites,sites[0]]);
    expect(art.root.children).toHaveLength(2); expect(art.root.children.every(n=>!n.visible)).toBe(true);
    const [a,b] = art.root.children, lens = a.getObjectByName("lens") as THREE.Mesh;
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
    const collect = () => art.root.traverse(node => { if(node instanceof THREE.Mesh) { geometries.add(node.geometry); materials.add(node.material); } });
    const variants = new Set<THREE.Material>();
    for(const [hp, disabled] of [[100,false],[60,false],[60,true],[0,true]] as const) {
      art.update([{...states[0],hp,disabled}]); expect(a.visible).toBe(true); expect(b.visible).toBe(false);
      variants.add(lens.material as THREE.Material); collect();
    }
    expect(variants.size).toBe(4); expect(geometries.size).toBe(2); expect(materials.size).toBe(6);
    art.update(null); expect(a.visible).toBe(false);
    const disposed = [...geometries,...materials].map(resource => vi.spyOn(resource,"dispose"));
    art.dispose(); art.dispose(); expect(art.root.children).toHaveLength(0);
    for (const spy of disposed) expect(spy).toHaveBeenCalledOnce();
  });
});
