import {describe,expect,it} from "vitest";
import * as THREE from "three";
import {readFileSync} from "node:fs";
import {BR_SECONDARY_LOCATIONS} from "@planetfall/shared";
import {buildBrParkDressing,buildBrParkPaths,type BrParkClearance} from "./br-park-dressing";
import {buildBrAuthoredSecondaryDressing} from "./br-authored-secondary-dressing";
import {BR_ENVIRONMENT_SCALE,isWithinBrPresentationScale} from "./br-environment-scale";

const open:BrParkClearance={roads:[],structures:[],blocks:[],traversal:[],outline:[[-100,-100],[100,-100],[100,100],[-100,100]]};
const park={...BR_SECONDARY_LOCATIONS.find(location=>location.id==="west-park")!,position:{x:0,y:0,z:0}};
const destination={x:80,y:0,z:0};

describe("BR park dressing",()=>{
  it("builds deterministic small clusters with distinct tree silhouettes and seating",()=>{
    const clusters=buildBrParkDressing(park,destination,open);
    expect(clusters).toHaveLength(5);
    expect(buildBrParkDressing(park,destination,open)).toEqual(clusters);
    expect(new Set(clusters.map(cluster=>cluster.archetype)).size).toBe(3);
    expect(clusters.flatMap(cluster=>cluster.parts).length).toBeLessThanOrEqual(120);
    expect(clusters.some(cluster=>cluster.parts.some(part=>part.finish==="windowLit"))).toBe(true);
    expect(clusters.every(cluster=>cluster.parts.some(part=>part.finish==="flowers"))).toBe(true);
  });
  it("contains all complete clusters within their clearance circles and reserves the approach lane",()=>{
    for(const cluster of buildBrParkDressing(park,destination,open)) {
      expect(Math.hypot(cluster.center.x,cluster.center.z)-cluster.radius).toBeGreaterThanOrEqual(14);
      expect(Math.abs(cluster.center.z)-cluster.radius).toBeGreaterThanOrEqual(6);
      for(const part of cluster.parts) {
        expect([part.position.x,part.position.y,part.position.z,part.rotationY,...Object.values(part.scale)].every(Number.isFinite)).toBe(true);
        expect(Object.values(part.scale).every(size=>size>0)).toBe(true);
        const half=part.geometry==="box"?.5:1;
        const halfHeight=part.geometry==="box"||part.geometry==="cylinder"?.5:1;
        for(const sx of [-1,1])for(const sy of [-1,1])for(const sz of [-1,1]) {
          const corner=new THREE.Vector3(sx*part.scale.x*half,sy*part.scale.y*halfHeight,sz*part.scale.z*half)
            .applyEuler(new THREE.Euler(0,part.rotationY,part.rotationZ??0)).add(new THREE.Vector3(part.position.x,part.position.y,part.position.z));
          expect(Math.hypot(corner.x-cluster.center.x,corner.z-cluster.center.z)).toBeLessThanOrEqual(cluster.radius);
        }
      }
    }
  });
  it("keeps benches and lights proportional to the canonical astronaut",()=>{
    const parts=buildBrParkDressing(park,destination,open).flatMap(cluster=>cluster.parts);
    const seats=parts.filter(part=>part.finish==="brushedMetal"&&part.scale.x===.19&&part.scale.y===.12);
    expect(seats.length).toBeGreaterThan(0);
    for(const seat of seats)expect(isWithinBrPresentationScale(seat.position.y+seat.scale.y/2,BR_ENVIRONMENT_SCALE.benchSeatTop)).toBe(true);
    const lamps=parts.filter(part=>part.geometry==="cylinder"&&part.scale.y===3.1);
    expect(lamps.length).toBeGreaterThan(0);
    for(const lamp of lamps)expect(isWithinBrPresentationScale(lamp.scale.y,BR_ENVIRONMENT_SCALE.streetLightHeight)).toBe(true);
  });
  it("retires generated West Park pockets in favor of its fixed authored garden",()=>{
    const location=BR_SECONDARY_LOCATIONS.find(value=>value.id==="west-park")!;
    // The legacy helper remains unit-tested for its geometry primitives, but
    // runtime map composition no longer calls it. West Park now uses one
    // reviewed literal treatment instead of accepting candidate output.
    const worldSource=readFileSync(new URL("./br-world.ts",import.meta.url),"utf8");
    expect(worldSource).not.toContain("buildBrParkDressing");
    expect(worldSource).not.toContain("buildBrParkPaths");
    const authored=buildBrAuthoredSecondaryDressing(location)!;
    expect(authored.center).toEqual({x:-435,y:0,z:165});
    expect(authored.context).toContain("Park edge");
    expect(authored.parts).toHaveLength(8);
  });
  it("omits clusters instead of decorating reserved or off-island space",()=>{
    expect(buildBrParkDressing(park,destination,{...open,outline:[[0,0],[1,0],[0,1]]})).toEqual([]);
    expect(buildBrParkDressing(park,destination,{...open,structures:[{position:park.position,size:{x:100,y:10,z:100}}]})).toEqual([]);
    expect(buildBrParkDressing(park,destination,{...open,roads:[{from:{x:-100,y:0,z:0},to:{x:100,y:0,z:0},width:100}]})).toEqual([]);
    expect(buildBrParkDressing({...park,style:"industrial"},destination,open)).toEqual([]);
  });
  it("lays out two flush pedestrian axes toward the connected district",()=>{
    const paths=buildBrParkPaths(park,destination,open);
    expect(paths.filter(path=>path.finish==="sidewalk")).toHaveLength(3);
    expect(paths.every(path=>path.position.y<.08&&path.scale.y<.04)).toBe(true);
    expect(paths.every(path=>[path.position.x,path.position.y,path.position.z,path.rotationY,...Object.values(path.scale)].every(Number.isFinite))).toBe(true);
    expect(paths[0].rotationY).toBeCloseTo(0);
    expect(paths[2].rotationY).toBeCloseTo(-Math.PI/2);
    expect(buildBrParkPaths({...park,style:"industrial"},destination)).toEqual([]);
  });
  it("points paths at a diagonal destination and keeps accents above their paving",()=>{
    const paths=buildBrParkPaths(park,{x:80,y:0,z:60},open);
    const direction=new THREE.Vector3(1,0,0).applyAxisAngle(new THREE.Vector3(0,1,0),paths[0].rotationY);
    expect(direction.x).toBeCloseTo(.8);
    expect(direction.z).toBeCloseTo(.6);
    for(let i=0;i<paths.length;i+=2){
      const sidewalk=paths[i],stripe=paths[i+1];
      expect(stripe.position.y-stripe.scale.y/2).toBeGreaterThan(sidewalk.position.y+sidewalk.scale.y/2);
    }
  });
  it("breaks promenade paving before roads, buildings and the island edge",()=>{
    const input={...open,roads:[{from:{x:18,y:0,z:-100},to:{x:18,y:0,z:100},width:8}],
      structures:[{position:{x:-20,y:0,z:0},size:{x:10,y:10,z:14}}]};
    const paths=buildBrParkPaths(park,destination,input);
    expect(paths.length).toBeGreaterThan(0);
    for(const path of paths){
      const cosine=Math.cos(path.rotationY),sine=Math.sin(path.rotationY);
      for(let x=-path.scale.x/2;x<=path.scale.x/2;x+=.5)for(const z of [-path.scale.z/2,0,path.scale.z/2]){
        const worldX=path.position.x+x*cosine+z*sine,worldZ=path.position.z-x*sine+z*cosine;
        expect(Math.abs(worldX-18)).toBeGreaterThan(4);
        expect(Math.abs(worldX+20)>5||Math.abs(worldZ)>7).toBe(true);
      }
    }
    expect(buildBrParkPaths(park,destination,{...open,outline:[[0,0],[1,0],[0,1]]})).toEqual([]);
  });
});
