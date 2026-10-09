import { describe, expect, it } from "vitest";
import { BR_BRIDGE_PIERS, BR_GREENWAY_TREES, BR_MAP_BLOCKS, BR_ROADS, BR_STRUCTURES, BR_LOOT_SOCKETS, BR_CRATE_SOCKETS, BR_TRAVERSAL, isInsideBrIslandInterior } from "./map.js";
import { brAuthoredDeckHeight } from "./orbital-isle-elevation.js";

const reserved = [...BR_LOOT_SOCKETS.map(s=>s.position),...BR_CRATE_SOCKETS,...BR_TRAVERSAL.map(t=>t.position)];
const distanceToRoad=(p:{x:number;z:number},r:typeof BR_ROADS[number])=>{
  const dx=r.to.x-r.from.x,dz=r.to.z-r.from.z;
  const t=Math.max(0,Math.min(1,((p.x-r.from.x)*dx+(p.z-r.from.z)*dz)/(dx*dx+dz*dz)));
  return {distance:Math.hypot(p.x-r.from.x-dx*t,p.z-r.from.z-dz*t),height:r.from.y+(r.to.y-r.from.y)*t-.1,t};
};

describe("connective planting and real bridge supports",()=>{
  it("adds broad trunks in several interdistrict planting bands without consuming roads, buildings or sockets",()=>{
    expect(BR_GREENWAY_TREES.length).toBeGreaterThanOrEqual(50);
    expect(new Set(BR_GREENWAY_TREES.map(t=>t.band)).size).toBeGreaterThanOrEqual(12);
    for(const tree of BR_GREENWAY_TREES){
      expect(isInsideBrIslandInterior(tree.position,tree.radius+3),tree.id).toBe(true);
      expect(brAuthoredDeckHeight(tree.position),tree.id).toBe(0);
      for(const road of BR_ROADS)expect(distanceToRoad(tree.position,road).distance,`${tree.id} / ${road.id}`).toBeGreaterThanOrEqual(road.width/2+tree.radius+2);
      for(const structure of BR_STRUCTURES)expect(Math.abs(tree.position.x-structure.position.x)>=structure.size.x/2+tree.radius+2 || Math.abs(tree.position.z-structure.position.z)>=structure.size.z/2+tree.radius+2,tree.id).toBe(true);
      for(const socket of reserved)expect(Math.hypot(tree.position.x-socket.x,tree.position.z-socket.z),tree.id).toBeGreaterThanOrEqual(tree.radius+3);
      const trunk=BR_MAP_BLOCKS.find(b=>b.id===`${tree.id}-trunk`)!;
      expect(trunk.kind).toBe("wall");expect(trunk.size.x).toBe(.7);expect(trunk.size.z).toBe(.7);
      expect(trunk.position.x).toBe(tree.position.x);expect(trunk.position.z).toBe(tree.position.z);
      expect(trunk.position.y-trunk.size.y/2).toBe(tree.position.y);
      expect(trunk.position.y+trunk.size.y/2).toBeCloseTo(tree.height*.7);
    }
    for(let i=0;i<BR_GREENWAY_TREES.length;i++)for(const other of BR_GREENWAY_TREES.slice(i+1)){
      const tree=BR_GREENWAY_TREES[i];
      expect(Math.hypot(tree.position.x-other.position.x,tree.position.z-other.position.z)).toBeGreaterThanOrEqual(tree.radius+other.radius+1);
    }
  });
  it("pairs substantial supports under real exposed slabs, with lower-road and socket clearance",()=>{
    expect(BR_BRIDGE_PIERS.length).toBeGreaterThanOrEqual(30);
    expect(BR_BRIDGE_PIERS.length%2).toBe(0);
    for(const pier of BR_BRIDGE_PIERS){
      const route=pier.id.replace(/^bridge-pier-/,"").replace(/-\d+-(left|right)$/,"");
      const own=BR_ROADS.filter(r=>r.id.replace(/-grade-part-\d+$/,"")===route);
      const road=own.reduce((best,r)=>distanceToRoad(pier.position,r).distance<distanceToRoad(pier.position,best).distance?r:best);
      const contact=distanceToRoad(pier.position,road),run=Math.hypot(road.to.x-road.from.x,road.to.z-road.from.z);
      const underside=contact.height-.34/Math.cos(Math.atan2(road.to.y-road.from.y,run));
      expect(pier.size.x).toBe(1.25);expect(pier.size.z).toBe(1.25);
      expect(pier.size.y).toBeGreaterThan(2.3);
      expect(pier.position.y+pier.size.y/2, pier.id).toBeCloseTo(underside,5);
      expect(pier.position.y-pier.size.y/2,pier.id).toBeCloseTo(brAuthoredDeckHeight(pier.position),5);
      for(const socket of reserved)expect(Math.hypot(pier.position.x-socket.x,pier.position.z-socket.z),pier.id).toBeGreaterThanOrEqual(3.625);
      for(const other of BR_ROADS.filter(r=>!own.includes(r))){
        const lower=distanceToRoad(pier.position,other);
        if(lower.height<underside-.4&&lower.height>=pier.position.y-pier.size.y/2-.5)
          expect(lower.distance,`${pier.id} / ${other.id}`).toBeGreaterThanOrEqual(other.width/2+.625+1.5);
      }
      const pair=BR_BRIDGE_PIERS.find(p=>p.id===pier.id.replace(/-(left|right)$/,pier.id.endsWith("left")?"-right":"-left"));
      expect(pair,pier.id).toBeDefined();
      expect(BR_MAP_BLOCKS.find(b=>b.id===pier.id)).toBe(pier);
    }
  });
});
