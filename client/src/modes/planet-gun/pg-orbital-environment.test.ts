import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { createPgOrbitalEnvironment } from "./pg-orbital-environment";

describe("PlanetGun orbital neighborhood",()=>{
  it("bakes finite dimmed geography once and keeps it immutable during updates",()=>{
    const environment=createPgOrbitalEnvironment();
    const planet=environment.root.getObjectByName("neighborhood-planet") as THREE.Mesh<THREE.SphereGeometry,THREE.ShaderMaterial>;
    const texture=planet.material.uniforms.terrainMap.value as THREE.DataTexture;
    expect(texture.image.width).toBe(512);expect(texture.image.height).toBe(256);
    expect(texture.wrapS).toBe(THREE.RepeatWrapping);expect(texture.wrapT).toBe(THREE.ClampToEdgeWrapping);
    expect(texture.magFilter).toBe(THREE.LinearFilter);expect(texture.generateMipmaps).toBe(true);
    expect(texture.colorSpace).toBe(THREE.LinearSRGBColorSpace);
    const data=texture.image.data as Uint8Array;
    let min=255,max=0,opaque=true;for(let i=0;i<data.length;i++){
      if(i%4===3){opaque=opaque&&data[i]===255;continue;}
      min=Math.min(min,data[i]);max=Math.max(max,data[i]);
    }
    expect(opaque).toBe(true);expect(min).toBeGreaterThanOrEqual(0);expect(max).toBeLessThanOrEqual(192);expect(max-min).toBeGreaterThan(76);
    const initial=data.slice();for(let i=0;i<60;i++)environment.update(i/60);
    expect(planet.material.uniforms.terrainMap.value).toBe(texture);expect(texture.image.data).toEqual(initial);
    const dispose=vi.spyOn(texture,"dispose");environment.dispose();environment.dispose();expect(dispose).toHaveBeenCalledTimes(1);
    expect(planet.material.fragmentShader).not.toMatch(/\b(?:sin|cos)\s*\(/);
    environment.dispose();
  });
  it("keeps an identifiable planet and layered structures on Low",()=>{
    const environment=createPgOrbitalEnvironment();environment.setQuality("low");
    const visible:string[]=[];environment.root.traverseVisible(o=>visible.push(o.name));
    for(const name of["neighborhood-planet","planet-atmospheric-limb","orbital-structural-silhouettes","neighborhood-stars"])expect(visible).toContain(name);
    expect(visible).not.toContain("orbital-equipment");expect(visible).not.toContain("orbital-navigation-lights");
    const planet=environment.root.getObjectByName("neighborhood-planet") as THREE.Mesh<THREE.SphereGeometry>;
    // The east-facing scoped comparison sees the planet, inside the far plane.
    environment.root.updateMatrixWorld(true);
    const hits=new THREE.Raycaster(new THREE.Vector3(0,2,15.6),new THREE.Vector3(1,0,0),0,400).intersectObject(planet);
    expect(hits.length).toBeGreaterThan(0);expect(hits[0].distance).toBeGreaterThan(100);
    environment.dispose();
  });
  it("bounds draw calls, materials and celestial detail across presets",()=>{
    const environment=createPgOrbitalEnvironment();
    for(const [quality,draws,points]of[["low",4,140],["medium",5,240],["high",6,360]] as const){
      environment.setQuality(quality);let count=0;const materials=new Set<THREE.Material>();
      environment.root.traverseVisible(o=>{
        expect(o instanceof THREE.Light||o instanceof THREE.Line).toBe(false);
        if(o instanceof THREE.Mesh||o instanceof THREE.Points){count++;for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}
      });
      expect(count).toBe(draws);expect(materials.size).toBe(4);
      const stars=environment.root.getObjectByName("neighborhood-stars") as THREE.Points;
      expect(stars.geometry.drawRange.count).toBe(points);
    }
    environment.dispose();
  });
  it("keeps station geometry outside the battlefield with finite bounded positions",()=>{
    const environment=createPgOrbitalEnvironment();
    for(const name of["orbital-structural-silhouettes","orbital-equipment","orbital-navigation-lights"]){
      const mesh=environment.root.getObjectByName(name) as THREE.Mesh;
      const p=mesh.geometry.getAttribute("position");
      for(let i=0;i<p.count;i++){
        const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
        expect([x,y,z].every(Number.isFinite)).toBe(true);
        expect(Math.abs(x)>48||Math.abs(z)>40).toBe(true);
        expect(Math.hypot(x,y,z)).toBeLessThan(400);
      }
    }
    environment.dispose();
  });
  it("uses fixed transforms and disposes shared resources exactly once",()=>{
    const environment=createPgOrbitalEnvironment(),resources=new Set<THREE.BufferGeometry|THREE.Material>();
    const transforms:number[][]=[];
    environment.root.traverse(o=>{transforms.push([...o.position.toArray(),...o.rotation.toArray().slice(0,3) as number[]]);if(o instanceof THREE.Mesh||o instanceof THREE.Points){resources.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])resources.add(m);}});
    const spies=[...resources].map(r=>vi.spyOn(r,"dispose"));
    environment.update(1e9);const after:number[][]=[];environment.root.traverse(o=>after.push([...o.position.toArray(),...o.rotation.toArray().slice(0,3) as number[]]));expect(after).toEqual(transforms);
    environment.dispose();environment.dispose();for(const spy of spies)expect(spy).toHaveBeenCalledTimes(1);expect(environment.root.children).toHaveLength(0);
  });
});
