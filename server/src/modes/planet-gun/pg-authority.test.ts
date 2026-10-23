import {describe,it,expect} from "vitest";
import {PG_MAP} from "@planetfall/shared";
import {PgHistory} from "./pg-history.js";
import {pgChooseSpawn} from "./pg-spawns.js";

describe("PlanetGun authoritative pose history",()=>{
  it("interpolates position without retaining mutable player references",()=>{
    const h=new PgHistory(),p={id:"a",hp:100,lifeId:1,crouched:false,position:{x:0,y:0,z:0}};
    h.record([p],1000);p.position.x=10;h.record([p],1100);
    expect(h.sample("a",1,1050)?.position.x).toBe(5);
    p.position.x=500;expect(h.sample("a",1,1100)?.position.x).toBe(10);
  });
  it("does not rewind through a death or across a new life",()=>{
    const h=new PgHistory(),p={id:"a",hp:100,lifeId:1,crouched:false,position:{x:0,y:0,z:0}};
    h.record([p],1000);p.hp=0;h.record([p],1010);expect(h.sample("a",1,1000)).toBeNull();
    p.hp=100;p.lifeId=2;h.record([p],1100);
    expect(h.sample("a",1,1100)).toBeNull();expect(h.sample("a",2,1090)).toBeNull();
  });
  it("bounds storage and removes departed players",()=>{
    const h=new PgHistory(),p={id:"a",hp:100,lifeId:1,crouched:false,position:{x:0,y:0,z:0}};
    for(let t=0;t<10000;t+=10)h.record([p],t);
    expect(h.sample("a",1,9000)).toBeNull();expect(h.sample("a",1,9900)).not.toBeNull();
    h.record([],10000);expect(h.sample("a",1,9900)).toBeNull();
  });
});
describe("PlanetGun spawn safety",()=>{
  it("uses the team's authored region without threats",()=>{
    expect(pgChooseSpawn("solar",[],[],1000).team).toBe("solar");
    expect(pgChooseSpawn("void",[],[],1000).team).toBe("void");
  });
  it("flips away from a camped home region",()=>{
    const enemies=PG_MAP.spawns.filter(s=>s.team==="solar").map(s=>({team:"void" as const,hp:100,position:s.position}));
    expect(pgChooseSpawn("solar",enemies,[],1000).team).toBe("void");
  });
  it("avoids occupied allies and recent death locations",()=>{
    const first=pgChooseSpawn("solar",[],[],1000);
    const next=pgChooseSpawn("solar",[{team:"solar",hp:100,position:first.position}],[{position:first.position,at:990}],1000);
    expect(next.id).not.toBe(first.id);
  });
});
