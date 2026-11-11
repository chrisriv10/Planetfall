import * as THREE from "three";
import {describe,expect,it,vi} from "vitest";
import {createPlanetCosmeticVariant,type PlanetCosmeticStyle} from "./planet-cosmetic-variants";

const styles:PlanetCosmeticStyle[]=["ocean","cinder","garden"];
describe("planet cosmetic variants",()=>{
  it("keeps shell vertices at gameplay and preview radii and limits decorations to the garden orbital ribbon",()=>{
    const p=new THREE.Vector3();
    for(const radius of [1,8])for(const style of styles){
      const visual=createPlanetCosmeticVariant(style,radius),geometry=visual.shell.geometry,verts=geometry.getAttribute("position");
      for(let i=0;i<verts.count;i+=7)expect(p.fromBufferAttribute(verts,i).length()).toBeCloseTo(radius,5);
      expect(visual.group.children.length).toBe(style==="garden"?2:1);
      expect(visual.shell.material.transparent).toBe(false);
      visual.group.traverse(node=>expect(node.userData.cameraCollision).toBe(false));
      if(style==="garden"){
        const ring=visual.group.children[1] as THREE.Mesh<THREE.RingGeometry,THREE.MeshBasicMaterial>;
        expect(ring.geometry.parameters.innerRadius).toBeGreaterThan(radius*1.1);
        expect(ring.geometry.parameters.outerRadius).toBeLessThan(radius*1.23);
        expect(ring.material.opacity).toBeLessThan(.65);
      }
      visual.dispose();
    }
  });
  it("creates distinct multicolor surfaces, repeatable at both scales, and uses bump relief for Cinder alone",()=>{
    const samples=new Set<string>();
    for(const style of styles){
      const visual=createPlanetCosmeticVariant(style,1),other=createPlanetCosmeticVariant(style,8);
      const map=visual.shell.material.map! as THREE.DataTexture;
      const data=map.image.data as Uint8Array,colors=new Set<number>();
      for(let i=0;i<data.length;i+=32)colors.add(data[i]*65536+data[i+1]*256+data[i+2]);
      expect(colors.size).toBeGreaterThan(140);samples.add(Array.from(data.slice(7800,8000)).join(","));
      expect((other.shell.material.map as THREE.DataTexture).image.data).toBe(data);expect(other.shell.material.map).not.toBe(map);
      if(style==="cinder"){
        const height=(visual.shell.material.bumpMap as THREE.DataTexture).image.data as Uint8Array;
        expect(new Set(height).size).toBeGreaterThan(70);expect(visual.shell.material.bumpScale*8).toBe(other.shell.material.bumpScale);
      }else expect(visual.shell.material.bumpMap).toBeNull();
      visual.dispose();other.dispose();
    }
    expect(samples.size).toBe(3);
  });
  it("keeps the underlying world fixed and reduced motion neutral, with idempotent resource cleanup",()=>{
    for(const style of styles){
      const visual=createPlanetCosmeticVariant(style,1),parent=new THREE.Group();parent.add(visual.group);
      const assets=[visual.shell.geometry,visual.shell.material,visual.shell.material.map!];
      if(visual.shell.material.bumpMap)assets.push(visual.shell.material.bumpMap);
      if(style==="garden"){
        const ring=visual.group.children[1] as THREE.Mesh<THREE.RingGeometry,THREE.MeshBasicMaterial>;
        const neutral=ring.quaternion.clone();visual.update(12);expect(ring.quaternion.equals(neutral)).toBe(false);
        visual.update(27,undefined,true);expect(ring.quaternion.equals(neutral)).toBe(true);
        vi.spyOn(ring.geometry,"dispose");vi.spyOn(ring.material,"dispose");
        visual.dispose();visual.dispose();expect(ring.geometry.dispose).toHaveBeenCalledOnce();expect(ring.material.dispose).toHaveBeenCalledOnce();
      }else{
        const release=assets.map(a=>vi.spyOn(a,"dispose"));
        visual.update(NaN);visual.dispose();visual.dispose();for(const spy of release)expect(spy).toHaveBeenCalledOnce();
      }
      expect(visual.group.parent).toBeNull();expect(visual.shell.rotation.toArray().slice(0,3)).toEqual([0,0,0]);
    }
  });
});
