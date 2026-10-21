import {describe,it,expect} from "vitest";
import {PR_BALANCE as B,PR_ROUNDS,PrTileState,prBump,prInsideTile,prObstacleTransform,prPlatformCenter,prQualificationTarget,prRank,prRound,prSanitizeInput,prSelectRound,prSpawn,prStepMotion,prTileState} from "./index.js";
const empty={sequence:1,moveX:0,moveZ:0,jump:false,dive:false};
describe("PlanetRun tournament contracts",()=>{
  it("adapts 10/20/30-player brackets and ends in one winner",()=>{
    for(const start of [10,20,30]){let n=start,previous=null as ReturnType<typeof prSelectRound>["id"]|null;
      for(let i=0;i<4;i++){const r=prSelectRound(PR_ROUNDS,n,i,previous,17);if(i===0)expect(r.category).toBe("race");expect(r.id).not.toBe(previous);const next=prQualificationTarget(n,r.category,i);expect(next).toBeLessThan(n);n=next;previous=r.id;if(n===1)break;}
      expect(n).toBe(1);
    }
  });
  it("selects repeatably and resolves exact ties by stable ID",()=>{
    expect(prSelectRound(PR_ROUNDS,20,0,null,183)).toBe(prSelectRound(PR_ROUNDS,20,0,null,183));
    expect(prRank([{id:"b",progress:1,survivedMs:3},{id:"a",progress:1,survivedMs:3}]).map(p=>p.id)).toEqual(["a","b"]);
  });
});
describe("Shatterdeck authoritative state",()=>{
  const round=prRound("shatterdeck");
  it("has four different connected footprints with reciprocal neighbors",()=>{
    const counts=Array.from({length:4},(_,d)=>round.tiles.filter(t=>t.deck===d).length);expect(new Set(counts).size).toBe(4);
    for(const t of round.tiles){expect(prInsideTile(t,t.center.x,t.center.z)).toBe(true);for(const id of t.neighbors)expect(round.tiles[id].neighbors).toContain(t.id);}
  });
  it("never resets contact time and reconstructs compact changes",()=>{
    const state=new PrTileState(round.tiles),other=new PrTileState(round.tiles),t=round.tiles[0];
    expect(prTileState(undefined,0)).toBe("solid");expect(state.contact(t.id,100)).toEqual({id:t.id,triggeredAt:100});expect(state.contact(t.id,400)).toBeNull();
    expect(state.intact(t.id,719)).toBe(true);expect(state.intact(t.id,720)).toBe(false);
    other.apply(state.full());other.apply([{id:t.id,triggeredAt:900}]);expect(other.triggered.get(t.id)).toBe(100);expect(other.intact(t.id,720)).toBe(false);
  });
  it("removes support at break time, allowing a fall through lower decks",()=>{
    const tile=round.tiles.find(t=>t.deck===0&&t.column===0&&t.row===0)!,state=new PrTileState(round.tiles),p=prSpawn(tile.center);
    prStepMotion(p,empty,1/30,100,round,1,state);expect(p.grounded).toBe(true);
    state.contact(tile.id,100);prStepMotion(p,empty,1/30,720,round,1,state);expect(p.grounded).toBe(false);expect(p.position.y).toBeLessThan(tile.center.y);
    for(let i=1;i<60;i++)prStepMotion(p,empty,1/30,720+i*1000/30,round,1,state);
    expect(p.position.y).toBeLessThan(tile.center.y-4);
  });
});
describe("PlanetRun movement",()=>{
  const round=prRound("cargo-cyclone");
  it("rejects malformed inputs and normalizes diagonal intent",()=>{
    expect(prSanitizeInput({...empty,moveX:NaN})).toBeNull();expect(prSanitizeInput({...empty,sequence:Infinity})).toBeNull();
    const p=prSanitizeInput({...empty,moveX:8,moveZ:8})!;expect(Math.hypot(p.moveX,p.moveZ)).toBeCloseTo(1);
  });
  it("jumps once per press and dive cannot be spammed",()=>{
    const p=prSpawn({x:0,y:.6,z:10});prStepMotion(p,empty,1/30,100,round,2);expect(p.grounded).toBe(true);
    prStepMotion(p,{...empty,jump:true},1/30,134,round,2);expect(p.velocity.y).toBeGreaterThan(9);
    prStepMotion(p,{...empty,jump:true},1/30,168,round,2);expect(p.velocity.y).toBeLessThan(10);
    prStepMotion(p,{...empty,dive:true,moveZ:-1},1/30,200,round,2);expect(p.velocity.z).toBe(-B.diveSpeed);const ready=p.diveReadyAt;
    prStepMotion(p,empty,1/30,234,round,2);prStepMotion(p,{...empty,dive:true},1/30,268,round,2);expect(p.diveReadyAt).toBe(ready);
  });
  it("carries moving-platform support and conveyor motion",()=>{
    const r={...round,obstacles:[],platforms:[{id:"moving",center:{x:0,y:0,z:0},half:{x:4,y:.6,z:4},motion:{axis:"x" as const,distance:2,period:4,phase:0},conveyor:{x:0,y:0,z:2}}]};
    const p=prSpawn({x:0,y:.6,z:0});p.grounded=true;p.supportId="moving";prStepMotion(p,empty,1/30,100,r,1);
    expect(p.position.x).toBeGreaterThan(0);expect(p.position.z).toBeCloseTo(2/30);expect(p.grounded).toBe(true);
    expect(prPlatformCenter(r.platforms[0],1000).x).toBeCloseTo(2);
  });
  it("bounds overlap correction rather than launching pilots",()=>{
    const a=prSpawn({x:0,y:0,z:0}),b=prSpawn({x:.1,y:0,z:0});prBump(a,b);expect(Math.abs(a.position.x)).toBeLessThanOrEqual(B.bumpLimit);expect(a.velocity.x).toBe(0);
  });
  it("uses deterministic shared obstacle telegraphs",()=>{
    const o=prRound("meteor-garden").obstacles[0];expect(prObstacleTransform(o,2000,42)).toEqual(prObstacleTransform(o,2000,42));
    expect(prObstacleTransform(o,2000,42).warning).toBe(true);
  });
  it("keeps authored low gravity active after takeoff without a support ID",()=>{
    const round=prRound("flux-gardens"),p=prSpawn({x:0,y:4,z:-20});p.velocity.y=5;p.supportId=null;
    prStepMotion(p,empty,1/30,100,round,42);
    expect(p.velocity.y).toBeCloseTo(5-B.gravity*.65/30);
  });
  it("never begins a meteor round in an untelegraphed impact",()=>{
    for(const seed of [0,42,999])for(const o of prRound("meteor-garden").obstacles){
      expect(prObstacleTransform(o,0,seed).active).toBe(false);
      let warned=false;
      for(let ms=0;ms<10000;ms+=50){const tr=prObstacleTransform(o,ms,seed);if(tr.warning)warned=true;if(tr.active){expect(warned).toBe(true);break;}}
    }
  });
  it("walks slowly across narrow module seams while a boot still contacts support",()=>{
    const r={...prRound("solar-sweep"),obstacles:[]},p=prSpawn({x:5.7,y:.6,z:0});
    for(let i=0;i<90;i++){prStepMotion(p,{...empty,moveX:.2},1/30,i*1000/30,r,1);expect(p.position.y).toBeCloseTo(.6);}
    expect(p.position.x).toBeGreaterThan(9);expect(p.grounded).toBe(true);
  });
});
