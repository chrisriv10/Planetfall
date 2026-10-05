import { describe,expect,it } from "vitest";
import * as THREE from "three";
import { BR_DISTRICT_PLANS,BR_ISLAND_OUTLINE,BR_LOOT_SOCKETS,BR_MAP_BLOCKS,BR_ROADS,BR_STRUCTURES,BR_TRAVERSAL } from "@planetfall/shared";
import { buildBrTransferBridgeDressing,BR_TRANSFER_FREIGHT_CENTER,BR_TRANSFER_FREIGHT_RADIUS } from "./br-transfer-bridge-dressing";

const road=BR_ROADS.find(r=>r.id==="south-transfer-bridge")!;
const dx=road.to.x-road.from.x,dz=road.to.z-road.from.z,length=Math.hypot(dx,dz),nx=-dz/length,nz=dx/length;
const segmentDistance=(p:{x:number;z:number},a:{x:number;z:number},b:{x:number;z:number})=>{
  const vx=b.x-a.x,vz=b.z-a.z,sq=vx*vx+vz*vz,t=sq?Math.max(0,Math.min(1,((p.x-a.x)*vx+(p.z-a.z)*vz)/sq)):0;
  return Math.hypot(p.x-a.x-t*vx,p.z-a.z-t*vz);
};

describe("South transfer bridge authored construction",()=>{
  it("is deterministic, bounded and keeps low landmarks when reducing detail",()=>{
    const before=JSON.stringify([BR_ROADS,BR_STRUCTURES,BR_MAP_BLOCKS]);
    const high=buildBrTransferBridgeDressing("high"),medium=buildBrTransferBridgeDressing("medium"),low=buildBrTransferBridgeDressing("low");
    expect(high).toHaveLength(47);expect(medium).toHaveLength(41);expect(low).toHaveLength(35);
    expect(buildBrTransferBridgeDressing("high")).toEqual(high);
    for(const part of low)expect(high).toContainEqual(part);
    for(const part of medium)expect(high).toContainEqual(part);
    for(const part of high){
      expect([...Object.values(part.position),...Object.values(part.scale),part.rotationY,part.rotationZ].every(Number.isFinite)).toBe(true);
      expect(Object.values(part.scale).every(value=>value>0)).toBe(true);
    }
    expect(JSON.stringify([BR_ROADS,BR_STRUCTURES,BR_MAP_BLOCKS])).toBe(before);
    for(const bad of [{...road,id:"other"},{...road,width:12},{...road,to:{...road.to,z:-399}},{...road,from:{...road.from,y:NaN}},{...road,from:{...road.from,y:2}}])expect(buildBrTransferBridgeDressing("high",bad)).toEqual([]);
  });

  it("keeps full rotated fittings outside the lane or below the deck, with clear joins and headroom",()=>{
    for(const part of buildBrTransferBridgeDressing("high").filter(p=>p.role!=="freight")){
      expect([...Object.values(part.position),...Object.values(part.scale),part.rotationY,part.rotationZ].every(Number.isFinite)).toBe(true);
      expect(Object.values(part.scale).every(v=>v>0)).toBe(true);
      const rotation=new THREE.Euler(0,part.rotationY,part.rotationZ);
      for(const x of [-.5,.5])for(const y of [-.5,.5])for(const z of [-.5,.5]){
        const corner=new THREE.Vector3(x*part.scale.x,y*part.scale.y,z*part.scale.z).applyEuler(rotation).add(new THREE.Vector3(part.position.x,part.position.y,part.position.z));
        const along=((corner.x-road.from.x)*dx+(corner.z-road.from.z)*dz)/length;
        const lateral=Math.abs((corner.x-road.from.x)*nx+(corner.z-road.from.z)*nz);
        const surface=road.from.y+(road.to.y-road.from.y)*along/length;
        expect(along).toBeGreaterThan(7.8);expect(along).toBeLessThan(length-7.8);
        if(part.role==="rib"){
          expect(corner.y).toBeLessThan(surface-.4);
          expect(corner.y).toBeGreaterThan(2.8);
        }else expect(lateral).toBeGreaterThan(road.width/2+.08);
        if(part.role==="girder")expect(corner.y).toBeLessThan(surface-.22);
        for(const other of BR_ROADS.filter(r=>r.id!==road.id))expect(segmentDistance(corner,other.from,other.to),other.id).toBeGreaterThan(other.width/2+1);
        for(const building of BR_STRUCTURES){
          const gap=Math.hypot(Math.max(0,Math.abs(corner.x-building.position.x)-building.size.x/2),Math.max(0,Math.abs(corner.z-building.position.z)-building.size.z/2));
          expect(gap,building.id).toBeGreaterThan(1);
        }
      }
    }
  });

  it("keeps the whole fixed lower freight reservation inside the island and clear of gameplay",()=>{
    const p=BR_TRANSFER_FREIGHT_CENTER,r=BR_TRANSFER_FREIGHT_RADIUS;
    for(const other of BR_ROADS)expect(segmentDistance(p,other.from,other.to),other.id).toBeGreaterThan(r+other.width/2+2);
    for(const s of BR_STRUCTURES){
      const gap=Math.hypot(Math.max(0,Math.abs(p.x-s.position.x)-s.size.x/2),Math.max(0,Math.abs(p.z-s.position.z)-s.size.z/2));
      expect(gap,s.id).toBeGreaterThan(r+7); // Includes six-metre facade approaches.
    }
    for(const b of BR_MAP_BLOCKS){
      if(b.id==="south-transfer-bridge-surface")continue; // Protected by complete road capsule above.
      const gap=Math.hypot(Math.max(0,Math.abs(p.x-b.position.x)-b.size.x/2),Math.max(0,Math.abs(p.z-b.position.z)-b.size.z/2));
      expect(gap,b.id).toBeGreaterThan(r+2);
    }
    for(const l of BR_LOOT_SOCKETS)expect(Math.hypot(p.x-l.position.x,p.z-l.position.z)).toBeGreaterThan(r+2);
    for(const t of BR_TRAVERSAL)expect(Math.hypot(p.x-t.position.x,p.z-t.position.z)).toBeGreaterThan(r+9);
    for(const plan of BR_DISTRICT_PLANS)expect(Math.hypot(p.x-plan.openZone.position.x,p.z-plan.openZone.position.z)).toBeGreaterThan(r+plan.openZone.radius);
    let inside=false;
    for(let i=0,j=BR_ISLAND_OUTLINE.length-1;i<BR_ISLAND_OUTLINE.length;j=i++){
      const [x,z]=BR_ISLAND_OUTLINE[i],[px,pz]=BR_ISLAND_OUTLINE[j];
      expect(segmentDistance(p,{x,z},{x:px,z:pz})).toBeGreaterThan(r+5);
      if((z>p.z)!==(pz>p.z)&&p.x<(px-x)*(p.z-z)/(pz-z)+x)inside=!inside;
    }
    expect(inside).toBe(true);
    for(const part of buildBrTransferBridgeDressing("high").filter(p=>p.role==="freight")){
      expect(part.position.y-part.scale.y/2).toBeGreaterThanOrEqual(0);
      for(const x of [-1,1])for(const z of [-1,1])expect(Math.hypot(part.position.x-p.x+x*part.scale.x/2,part.position.z-p.z+z*part.scale.z/2)).toBeLessThan(r);
      if(part.surface)expect(part.position.y+part.scale.y/2).toBeLessThan(.06);
      if(part.position.y<2.7&&part.position.y+part.scale.y/2>.8){expect(part.scale.x).toBeLessThanOrEqual(.12);expect(part.scale.z).toBeLessThanOrEqual(.12);}
    }
  });
});
