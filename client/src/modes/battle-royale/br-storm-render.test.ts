import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createVoidStorm, updateVoidStorm } from "./br-presentation";
import type { BrRoomView } from "@planetfall/shared";

// Baked data textures and rendering transforms work without a DOM or GPU.
const stormFixture=createVoidStorm;
function room(radius:number):Pick<BrRoomView,"storm"> {
  return {storm:{phaseIndex:1,center:{x:30,z:-20},radius,nextCenter:{x:30,z:-20},nextRadius:0,stage:"closing",stageEndsAt:1000,damagePerSecond:2}};
}
function dispose(root:THREE.Group) {
  const textures=new Set<THREE.Texture>();
  root.traverse(object=>{if(object instanceof THREE.Mesh||object instanceof THREE.Line||object instanceof THREE.Points){object.geometry.dispose();const material=object.material;if(material.map)textures.add(material.map);material.dispose();}});
  for(const texture of textures)texture.dispose();
}
describe("BR storm renderer regression",()=>{
  it("drifts layered veils independently while sharing the baked pixels",()=>{
    const storm=createVoidStorm();
    const layers=storm.children.filter(c=>c.userData.stormLayer) as THREE.Mesh<THREE.CylinderGeometry,THREE.MeshBasicMaterial>[];
    const maps=layers.map(layer=>layer.material.map!);
    expect(new Set(maps).size).toBe(3);
    for(const map of maps)expect(map.source).toBe(maps[0].source);
    updateVoidStorm(storm,room(25),1000);
    const previous=maps.map(map=>map.offset.clone());
    updateVoidStorm(storm,room(25),2000);
    expect(maps[0].offset.x).toBeGreaterThan(previous[0].x);
    expect(maps[1].offset.x).toBeLessThan(previous[1].x);
    expect(maps[0].offset.y).toBeLessThan(previous[0].y);
    expect(maps[1].offset.y).toBeGreaterThan(previous[1].y);
    for(let i=0;i<layers.length;i++)expect(layers[i].material.map).toBe(maps[i]);
    dispose(storm);
  });
  it("starts the entire energy curtain at the deck, not halfway below it",()=>{
    const storm=stormFixture();updateVoidStorm(storm,room(500),100);
    const layer=storm.children.find(c=>c.userData.stormLayer)!;
    const bounds=new THREE.Box3().setFromObject(layer);
    expect(bounds.min.y).toBeCloseTo(0);expect(bounds.max.y).toBeCloseTo(180);
    expect(layer.getWorldPosition(new THREE.Vector3()).x).toBe(30);
    dispose(storm);
  });
  it("keeps outer layers within a metre of the true circle and reuses buffers while shrinking",()=>{
    const storm=stormFixture();
    const ground=storm.children.find(c=>c.userData.stormGround)! as THREE.Mesh;
    const attribute=ground.geometry.getAttribute("position");
    for(const radius of [500,25,1]) {
      updateVoidStorm(storm,room(radius),100);
      for(const layer of storm.children.filter(c=>c.userData.stormLayer))expect(layer.scale.x-radius).toBeLessThan(1);
      expect(ground.geometry.getAttribute("position")).toBe(attribute);
      storm.updateMatrixWorld(true);
      const worldPoint=new THREE.Vector3().fromBufferAttribute(attribute,0).applyMatrix4(ground.matrixWorld);
      expect(Math.hypot(worldPoint.x-30,worldPoint.z+20)).toBeCloseTo(radius-.38,3);
    }
    dispose(storm);
  });
  it("reduces active layers/arcs/particles on Low and hides invalid collapsed storms",()=>{
    const storm=stormFixture();updateVoidStorm(storm,room(500),200,"low");
    expect(storm.children.filter(c=>c.userData.stormLayer&&c.visible)).toHaveLength(1);
    expect(storm.children.filter(c=>c.userData.stormArc&&c.visible)).toHaveLength(4);
    const sparks=storm.children.find(c=>c.userData.stormSparks)! as THREE.Points;
    expect(sparks.geometry.drawRange.count).toBe(90);
    const streaks=storm.children.find(c=>c.userData.stormStreaks)! as THREE.LineSegments;
    expect(streaks.geometry.drawRange.count).toBe(20);
    updateVoidStorm(storm,room(0),300);expect(storm.visible).toBe(false);
    updateVoidStorm(storm,room(NaN),300);expect(storm.visible).toBe(false);
    updateVoidStorm(storm,room(500),400,"high");expect(storm.visible).toBe(true);
    expect(sparks.geometry.drawRange.count).toBe(360);
    expect(streaks.geometry.drawRange.count).toBe(64);
    dispose(storm);
  });
  it("keeps sparse vertical filaments on the authoritative circle without rebuilding their pool",()=>{
    const storm=stormFixture();
    const streaks=storm.children.find(c=>c.userData.stormStreaks)! as THREE.LineSegments<THREE.BufferGeometry,THREE.LineBasicMaterial>;
    const position=streaks.geometry.getAttribute("position");
    updateVoidStorm(storm,room(25),500,"high");
    expect(streaks.geometry.getAttribute("position")).toBe(position);
    expect(streaks.geometry.drawRange.count).toBeGreaterThanOrEqual(8);
    expect(streaks.geometry.drawRange.count).toBeLessThanOrEqual(64);
    expect(streaks.scale.x).toBe(25);expect(streaks.scale.z).toBe(25);
    for(let index=0;index<position.count;index+=2){
      expect(position.getY(index)).toBeGreaterThanOrEqual(0);
      expect(position.getY(index+1)).toBeGreaterThan(position.getY(index));
      expect(Math.hypot(position.getX(index),position.getZ(index))).toBeCloseTo(1.006,1);
    }
    const rotation=streaks.rotation.y;
    updateVoidStorm(storm,room(1),1500,"low");
    expect(streaks.geometry.getAttribute("position")).toBe(position);
    expect(streaks.geometry.drawRange.count).toBe(8);
    expect(streaks.rotation.y).toBeGreaterThan(rotation);
    expect(streaks.material.opacity).toBeGreaterThan(.1);
    expect(streaks.material.opacity).toBeLessThan(.18);
    dispose(storm);
  });
  it("reuses decoration pools while thinning final circles and restores opening detail",()=>{
    const storm=stormFixture();
    const sparks=storm.children.find(c=>c.userData.stormSparks)! as THREE.Points;
    const positions=sparks.geometry.getAttribute("position");
    const layers=storm.children.filter(c=>c.userData.stormLayer) as THREE.Mesh<THREE.CylinderGeometry,THREE.MeshBasicMaterial>[];
    updateVoidStorm(storm,room(1),200,"high");
    expect(sparks.geometry.drawRange.count).toBe(12);
    expect(storm.children.filter(c=>c.userData.stormArc&&c.visible)).toHaveLength(1);
    expect(layers[0].scale.x).toBe(1);
    for(const layer of layers) {
      expect(layer.visible).toBe(true);
      expect(layer.scale.x).toBeLessThanOrEqual(1.05);
      expect(Number.isInteger(layer.material.map!.repeat.x)).toBe(true);
    }
    updateVoidStorm(storm,room(500),400,"high");
    expect(sparks.geometry.getAttribute("position")).toBe(positions);
    expect(sparks.geometry.drawRange.count).toBe(360);
    expect(storm.children.filter(c=>c.userData.stormArc&&c.visible)).toHaveLength(12);
    dispose(storm);
  });
  it("anchors a fading eye-level glow to the exact circle at every quality",()=>{
    const storm=stormFixture();
    const glow=storm.children.find(c=>c.userData.stormBoundaryGlow)! as THREE.Mesh<THREE.CylinderGeometry,THREE.MeshBasicMaterial>;
    const geometry=glow.geometry;
    const positions=geometry.getAttribute("position"),colors=geometry.getAttribute("color");
    for(let i=0;i<positions.count;i++) {
      if(positions.getY(i)===-2.5)expect(colors.getX(i)).toBe(1);
      if(positions.getY(i)===2.5)expect(colors.getX(i)).toBe(0);
    }
    for(const quality of ["low","medium","high"] as const)for(const radius of [1,25,500]) {
      updateVoidStorm(storm,room(radius),200,quality);
      expect(glow.visible).toBe(true);
      expect(glow.scale.x).toBe(radius);expect(glow.scale.z).toBe(radius);
      expect(glow.geometry).toBe(geometry);
      const bounds=new THREE.Box3().setFromObject(glow);
      expect(bounds.min.y).toBe(0);expect(bounds.max.y).toBe(5);
    }
    expect(glow.material.depthTest).toBe(true);
    expect(glow.material.depthWrite).toBe(false);
    expect(glow.material.toneMapped).toBe(false);
    expect(glow.material.forceSinglePass).toBe(true);
    dispose(storm);
  });
  it("concentrates the tall curtain near the deck and shares its static geometry",()=>{
    const storm=stormFixture();
    const layers=storm.children.filter(c=>c.userData.stormLayer) as THREE.Mesh<THREE.CylinderGeometry,THREE.MeshBasicMaterial>[];
    const geometry=layers[0].geometry,positions=geometry.getAttribute("position"),colors=geometry.getAttribute("color");
    for(const layer of layers)expect(layer.geometry).toBe(geometry);
    for(let i=0;i<positions.count;i++) {
      if(positions.getY(i)===-90)expect(colors.getX(i)).toBe(1);
      if(positions.getY(i)===90)expect(colors.getX(i)).toBeLessThan(.13);
    }
    dispose(storm);
  });
  it("keeps stronger wall structure separate from the restrained ground emission",()=>{
    const storm=stormFixture();
    const layer=storm.children.find(c=>c.userData.stormLayer)! as THREE.Mesh<THREE.CylinderGeometry,THREE.MeshBasicMaterial>;
    const ground=storm.children.find(c=>c.userData.stormGround)! as THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>;
    const glow=storm.children.find(c=>c.userData.stormBoundaryGlow)! as THREE.Mesh<THREE.CylinderGeometry,THREE.MeshBasicMaterial>;
    for(const now of [0,1000,2000,3000,4000]) {
      updateVoidStorm(storm,room(25),now);
      expect(layer.material.opacity).toBeGreaterThan(.52);
      expect(layer.material.opacity).toBeLessThan(.58);
      expect(ground.material.opacity).toBeLessThanOrEqual(.54);
      expect(glow.material.opacity).toBeLessThanOrEqual(.255);
    }
    dispose(storm);
  });
});
