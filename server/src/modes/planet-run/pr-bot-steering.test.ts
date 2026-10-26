import {describe,expect,it} from "vitest";
import {DEFAULT_COSMETICS,PrTileState,prBump,prStepMotion,prPlatformCenter,prRound,prSpawn,type PrPlayerState,type PrRoundDefinition} from "@planetfall/shared";
import {PR_CROWD_LIMITS,PrCrowdGrid,prBotPersonality,prCrowdBotInput,prCrowdOccupancy,type PrSteeringMemory} from "./pr-bot-steering.js";

function pilot(id="pilot",x=0,z=0):PrPlayerState {
  return {...prSpawn({x,y:.6,z}),id,name:id,color:"#ffffff",isBot:true,connected:false,ready:true,status:"active",checkpoint:0,place:0,qualifiedRounds:0,lastInputSequence:0,emote:null,emoteStartedAt:-2000,fallbucks:0,crowns:0,sessionTotalXp:0,sessionLevel:1,sessionXp:0,ownedCosmetics:[],unlockedPassRewards:["default"],equippedCosmetics:{...DEFAULT_COSMETICS},grounded:true,supportId:"cargo-cyclone-deck-0"};
}
const memory=(identitySeed=42):PrSteeringMemory=>({goal:0,nextDecision:0,sequence:0,identitySeed});
function straightMemory(side=1):PrSteeringMemory {
  return {...memory(),personality:{...prBotPersonality(42),lateral:0,phase:0,passSide:side}};
}
const cargo=prRound("cargo-cyclone");
const quietRace:PrRoundDefinition={...cargo,obstacles:[]};
function input(p:PrPlayerState,m:PrSteeringMemory,others:PrPlayerState[]=[],round=quietRace,t=0){
  return prCrowdBotInput(p,round,new PrTileState(round.tiles),t,42,"normal",m,new PrCrowdGrid([p,...others],t));
}

describe("PlanetRun crowd input steering",()=>{
  it("derives stable, continuous personalities and more than five distinct routes",()=>{
    const routes=new Set<number>();
    for(let id=0;id<30;id++){
      expect(prBotPersonality(id)).toEqual(prBotPersonality(id));
      const m=memory(id);input(pilot(),m);routes.add(Math.round(m.target!.x*1000));
    }
    expect(routes.size).toBeGreaterThan(25);
    expect(new Set(Array.from({length:30},(_,id)=>prBotPersonality(id).passSide)).size).toBe(2);
  });

  it("separates input preferences without mutating player physics",()=>{
    const p=pilot(),neighbor=pilot("neighbor",.7,0),before=structuredClone(p);
    const alone=input(p,straightMemory()),crowded=input(p,straightMemory(),[neighbor]);
    expect(crowded.moveX).toBeLessThan(alone.moveX-.2);
    expect(Math.hypot(crowded.moveX,crowded.moveZ)).toBeLessThanOrEqual(1);
    expect(p).toEqual(before);
  });

  it("replays identical observed states deterministically",()=>{
    const replay=()=>{
      const m=memory(1729),p=pilot(),outputs=[];
      for(let i=0;i<40;i++){
        p.position.x=Math.sin(i*.2);p.position.z=-i*.4;
        outputs.push(input(p,m,[pilot("observed",1,-i*.4-2)],quietRace,i*33));
      }
      return outputs;
    };
    expect(replay()).toEqual(replay());
  });

  it("advances a wide runner's waypoint without requiring a centerline visit",()=>{
    const p=pilot("wide-progress",7,4),m=memory(29);
    const result=input(p,m);
    expect(m.goal).toBe(1);expect(result.moveZ).toBeLessThan(0);
    p.position.z=-18;
    input(p,m,[],quietRace,100);
    expect(m.goal).toBeGreaterThan(2);expect(m.target!.z).toBeLessThan(p.position.z);
  });

  it.each([-1,1])("uses identity preference for an equally open %i pass",side=>{
    const m=straightMemory(side),p=pilot(),blocker=pilot("slow",0,-2);
    input(p,m,[blocker]);expect(m.passSide).toBe(side);expect(Math.sign(m.target!.x)).toBe(side);
  });

  it("chooses the free side over personality and refuses an edge pass",()=>{
    const p=pilot(),m=straightMemory(1);
    input(p,m,[pilot("slow",0,-2),pilot("occupied",2.2,-2.8)]);
    expect(m.passSide).toBe(-1);
    const edge=pilot("edge",7.3,0),edgeMemory=straightMemory(1);
    input(edge,edgeMemory,[pilot("slow",7.3,-2)]);
    expect(edgeMemory.passSide).toBe(-1);expect(edgeMemory.target!.x).toBeLessThan(7.3);
  });

  it("follows at a slower pace if neither pass has authored support",()=>{
    const narrow:PrRoundDefinition={...quietRace,platforms:[{id:"narrow",center:{x:0,y:0,z:0},half:{x:1.5,y:.6,z:20}}]};
    const m=straightMemory(),result=input(pilot(),m,[pilot("slow",0,-2)],narrow);
    expect(m.followFactor).toBe(.3);expect(Math.hypot(result.moveX,result.moveZ)).toBeLessThanOrEqual(.3);
  });

  it("keeps a wide preference inside the upcoming moving deck's landing width",()=>{
    const p=pilot("wide",6,-29),m=straightMemory();m.personality!.lateral=100;
    input(p,m,[],quietRace,3000);
    const next=cargo.platforms.find(deck=>deck.id==="cargo-cyclone-deck-2")!;
    const center=prPlatformCenter(next,3550);
    expect(m.target!.x).toBeLessThanOrEqual(center.x+next.half.x-1.25);
    expect(m.target!.x).toBeGreaterThanOrEqual(center.x-next.half.x+1.25);
  });

  it("turns smoothly between decisions and queries the crowd only at decision frequency",()=>{
    const p=pilot(),m=straightMemory(),grid=new PrCrowdGrid([p],0),tiles=new PrTileState([]);
    prCrowdBotInput(p,quietRace,tiles,0,42,"normal",m,grid);
    m.desiredX=1;m.desiredZ=0;
    const next=prCrowdBotInput(p,quietRace,tiles,33,42,"normal",m,grid);
    expect(next.moveX).toBeGreaterThan(0);expect(next.moveX).toBeLessThan(.4);expect(next.moveZ).toBeLessThan(-.5);
    expect(grid.stats.queries).toBe(1);
  });

  it("jumps for authored gaps and raised decks rather than repeating Z thresholds",()=>{
    expect(input(pilot("safe",0,-4),straightMemory()).jump).toBe(false);
    expect(input(pilot("gap",0,-8.2),straightMemory()).jump).toBe(true);
    const flux={...prRound("flux-gardens"),obstacles:[]};
    expect(input(pilot("raised",0,-8.2),straightMemory(),[],flux).jump).toBe(true);
    const continuous={...quietRace,platforms:[{id:"continuous",center:{x:0,y:0,z:-20},half:{x:9,y:.6,z:100}}]};
    expect(input(pilot("same-z",0,-8.2),straightMemory(),[],continuous).jump).toBe(false);
  });

  it("penalizes survival occupancy and samples personal non-grid targets",()=>{
    const round={...prRound("meteor-garden"),obstacles:[]},p=pilot(),a=memory(15);
    input(p,a,[],round);
    const occupied=Array.from({length:6},(_,i)=>pilot(`cluster-${i}`,a.target!.x+i*.03,a.target!.z));
    const b=memory(15);input(p,b,occupied,round);
    expect(prCrowdOccupancy(b.target!.x,b.target!.z,.6,occupied)).toBeLessThan(prCrowdOccupancy(a.target!.x,a.target!.z,.6,occupied));
    expect(Math.hypot(b.target!.x-a.target!.x,b.target!.z-a.target!.z)).toBeGreaterThan(2);
  });

  it("walks across survival seams supported by the authoritative foot radius",()=>{
    const round={...prRound("meteor-garden"),obstacles:[]},p=pilot("seam",4.7,0),m=straightMemory();
    m.target={x:10,y:.6,z:0};m.nextTargetAt=10000;
    expect(input(p,m,[],round).jump).toBe(false);
    p.position={x:6,y:1.5,z:0};p.grounded=false;p.supportId=null;p.velocity.y=-2;
    for(let id=0;id<32;id++){
      const memoryForSeam=memory(id);memoryForSeam.target={x:10,y:.6,z:0};memoryForSeam.nextTargetAt=10000;
      expect(prCrowdBotInput(p,round,new PrTileState([]),4000,42,"hard",memoryForSeam).dive).toBe(false);
    }
  });

  it.each([{x:0,z:0},{x:3.5,z:3.5}])("abandons a threatened meteor target at $x,$z and dodges on foot",cached=>{
    const round:PrRoundDefinition={...prRound("meteor-garden"),platforms:[{id:"large",center:{x:0,y:0,z:0},half:{x:20,y:.6,z:20}}],obstacles:[{id:"impact",kind:"meteor",center:{x:0,y:.5,z:0},half:{x:3.2,y:2,z:3.2},period:100,phase:0,strength:12}]};
    const p=pilot("corner",3.5,3.5),m=straightMemory();m.target={...cached,y:.6};m.nextTargetAt=10000;
    const result=prCrowdBotInput(p,round,new PrTileState([]),2600,0,"normal",m);
    expect(result.jump).toBe(false);expect(result.dive).toBe(false);
    const clearance=Math.hypot(Math.max(0,Math.abs(m.target!.x)-3.68),Math.max(0,Math.abs(m.target!.z)-3.68));
    expect(clearance).toBeGreaterThan(1.4);
    expect(m.target).not.toEqual({...cached,y:.6});
  });

  it.each([900,2600])("rejects a safe endpoint across a threatened meteor corridor at %ims",time=>{
    const round:PrRoundDefinition={...prRound("meteor-garden"),platforms:[{id:"large",center:{x:0,y:0,z:0},half:{x:20,y:.6,z:20}}],obstacles:[{id:"impact",kind:"meteor",center:{x:0,y:.5,z:0},half:{x:3.2,y:2,z:3.2},period:100,phase:0,strength:12}]};
    const p=pilot("corridor",-6,0),m=straightMemory();m.target={x:6,y:.6,z:0};m.nextTargetAt=10000;
    const result=prCrowdBotInput(p,round,new PrTileState([]),time,0,"normal",m);
    expect(m.target!.x).toBeLessThan(-3.68);
    expect(result.moveX).toBeLessThanOrEqual(0);expect(result.jump).toBe(false);
  });

  it("preserves a committed escape while the foot is still inside an impact warning",()=>{
    const round:PrRoundDefinition={...prRound("meteor-garden"),platforms:[{id:"large",center:{x:0,y:0,z:0},half:{x:20,y:.6,z:20}}],obstacles:[{id:"impact",kind:"meteor",center:{x:0,y:.5,z:0},half:{x:3.2,y:2,z:3.2},period:100,phase:0,strength:12}]};
    const p=pilot("escaping",0,0),m=straightMemory();m.target={x:8,y:.6,z:0};m.nextTargetAt=10000;
    const result=prCrowdBotInput(p,round,new PrTileState([]),2600,0,"normal",m);
    expect(m.target).toEqual({x:8,y:.6,z:0});expect(result.moveX).toBeGreaterThan(.9);
  });

  it("prefers a safe crowded exit over an empty meteor warning box",()=>{
    const round:PrRoundDefinition={...prRound("meteor-garden"),platforms:[{id:"exit",center:{x:3,y:0,z:0},half:{x:4,y:.6,z:1.5}}],obstacles:[{id:"impact",kind:"meteor",center:{x:0,y:.5,z:0},half:{x:3.2,y:2,z:3.2},period:100,phase:0,strength:12}]};
    const p=pilot(),m=straightMemory(),others=Array.from({length:8},(_,i)=>pilot(`exit-crowd-${i}`,6,0));
    m.personality!.phase=-5*2.3999632297-.37;prCrowdBotInput(p,round,new PrTileState([]),2600,0,"normal",m,new PrCrowdGrid([p,...others],2600));
    expect(m.target!.x).toBeGreaterThan(5.08);
    expect(m.target!.z).toBeGreaterThan(-.7);expect(m.target!.z).toBeLessThan(.7);
  });

  it("keeps a committed target in the actual clear channel between warned boxes",()=>{
    const round:PrRoundDefinition={...prRound("meteor-garden"),obstacles:[0,8].map(x=>({id:`impact-${x}`,kind:"meteor",center:{x,y:.5,z:0},half:{x:3.2,y:2,z:3.2},period:100,phase:0,strength:12}))};
    const p=pilot("channel",4,0),m=straightMemory();m.target={x:4,y:.6,z:0};m.nextTargetAt=10000;
    const result=prCrowdBotInput(p,round,new PrTileState([]),2600,0,"normal",m);
    expect(m.target).toEqual({x:4,y:.6,z:0});expect(result.moveX).toBe(0);expect(result.moveZ).toBe(0);
  });

  it("settles toward a nearby survival target and suppresses crowd deflection beside warnings",()=>{
    const round:PrRoundDefinition={...prRound("meteor-garden"),obstacles:[{id:"impact",kind:"meteor",center:{x:0,y:.5,z:0},half:{x:3.2,y:2,z:3.2},period:100,phase:0,strength:12}]};
    const p=pilot("settling",4,0),m=straightMemory();m.target={x:4.4,y:.6,z:0};m.nextTargetAt=10000;
    const neighbors=[pilot("nearby",4.7,0)];
    const result=prCrowdBotInput(p,round,new PrTileState([]),2600,0,"normal",m,new PrCrowdGrid([p,...neighbors],2600));
    expect(result.moveX).toBeCloseTo(.2);expect(result.moveZ).toBe(0);
  });

  it.each([20,30])("settles clear of seed42 impacts in a %i pilot fixed-step crowd",count=>{
    const round=prRound("meteor-garden"),tiles=new PrTileState([]),players=round.spawns.slice(0,count).map((spawn,i)=>({...pilot(`sim-${i}`),...prSpawn(spawn)})),memories=players.map(()=>({goal:0,nextDecision:0,sequence:0} as PrSteeringMemory));
    for(let tick=0;tick<450;tick++){
      const t=tick*1000/30,grid=new PrCrowdGrid(players,t);
      for(let i=0;i<players.length;i++){const p=players[i];if(p.status!=="active")continue;
        const command=i===0?{sequence:tick,moveX:0,moveZ:0,jump:false,dive:false}:prCrowdBotInput(p,round,tiles,t,42,"normal",memories[i],grid);prStepMotion(p,command,1/30,t,round,42,tiles);
        if(p.position.y<round.killY)p.status="eliminated";
      }
      for(let i=0;i<players.length;i++)for(let j=i+1;j<players.length;j++)if(players[i].status==="active"&&players[j].status==="active")prBump(players[i],players[j]);
    }
    expect(players.slice(1).filter(p=>p.status==="eliminated").map(p=>p.id)).toEqual([]);
  });

  it("avoids an occupied Shatterdeck neighbor while preserving tile viability",()=>{
    const round=prRound("shatterdeck"),tile=round.tiles.find(t=>t.deck===0&&t.column===0&&t.row===0)!;
    const p=pilot();p.position={...tile.center};p.supportId=`tile:${tile.id}`;
    const a=memory();input(p,a,[],round);
    const goal=round.tiles[a.goal],others=Array.from({length:3},(_,i)=>{const other=pilot(`tile-cluster-${i}`,goal.center.x,goal.center.z);other.position.y=goal.center.y;return other;});
    const b=memory();input(p,b,others,round);
    expect(b.goal).not.toBe(a.goal);expect(tile.neighbors).toContain(b.goal);
    expect(new PrTileState(round.tiles).intact(b.goal,400)).toBe(true);
  });

  it("uses rare contextual dives with difficulty competence and cooldowns",()=>{
    const counts={easy:0,hard:0};
    for(const difficulty of ["easy","hard"] as const)for(let id=0;id<100;id++){
      const p=pilot(`finish-${id}`,0,-118);p.checkpoint=2;
      const m=memory(id),tiles=new PrTileState([]);
      const result=prCrowdBotInput(p,quietRace,tiles,4000,42,difficulty,m);
      if(result.dive){counts[difficulty]++;expect(prCrowdBotInput(p,quietRace,tiles,4200,42,difficulty,m).dive).toBe(false);}
      expect(prCrowdBotInput(pilot(`open-${id}`,0,-40),quietRace,tiles,4000,42,difficulty,memory(id)).dive).toBe(false);
    }
    expect(counts.hard).toBeGreaterThan(10);expect(counts.hard).toBeLessThan(80);expect(counts.hard).toBeGreaterThan(counts.easy);
  });

  it("recovers a short airborne gap with a distant waypoint, but never dives over continuous support",()=>{
    const round={...quietRace,waypoints:[{x:0,y:.6,z:-40}],finish:null};
    const continuous={...round,platforms:[{id:"continuous",center:{x:0,y:0,z:-20},half:{x:9,y:.6,z:100}}]};
    const noLanding={...round,platforms:[quietRace.platforms[0]]};
    const p=pilot("short-gap",0,-10);p.position.y=1.5;p.grounded=false;p.supportId=null;p.velocity.y=-2;
    const tiles=new PrTileState([]);let recoveries=0;
    for(let id=0;id<64;id++){
      const m=memory(id),result=prCrowdBotInput(p,round,tiles,4000,42,"hard",m);
      expect(Math.hypot(m.target!.x-p.position.x,m.target!.z-p.position.z)).toBeGreaterThan(20);
      if(result.dive){
        recoveries++;
        expect(prCrowdBotInput(p,round,tiles,4200,42,"hard",m).dive).toBe(false);
      }
      expect(prCrowdBotInput(p,continuous,tiles,4000,42,"hard",memory(id)).dive).toBe(false);
      expect(prCrowdBotInput(p,noLanding,tiles,4000,42,"hard",memory(id)).dive).toBe(false);
      expect(prCrowdBotInput({...p,velocity:{...p.velocity,y:-9}},round,tiles,4000,42,"hard",memory(id)).dive).toBe(false);
    }
    expect(recoveries).toBeGreaterThan(0);
  });

  it("snapshots current movement, ignores inactive pilots, and bounds dense queries",()=>{
    const p=pilot(),players=Array.from({length:1000},(_,i)=>pilot(`dense-${i}`,i*.0001,0));
    const inactive=pilot("inactive");inactive.status="qualified";
    const grid=new PrCrowdGrid([p,inactive,...players],0);
    players[0].position.x=100;const nearby=grid.nearby(p);
    expect(nearby.find(n=>n.id==="dense-0")?.position.x).toBe(0);
    expect(nearby.some(n=>n.id==="inactive")).toBe(false);
    expect(grid.stats.inserted).toBe(1001);expect(grid.stats.visited).toBeLessThanOrEqual(PR_CROWD_LIMITS.maxVisited);
    expect(grid.stats.cellsVisited).toBeLessThanOrEqual(25);
    const memoryByPilot=players.slice(0,30).map((_,i)=>memory(i)),roomGrid=new PrCrowdGrid(players.slice(0,30),0);
    for(let tick=0;tick<3;tick++)for(let i=0;i<30;i++)prCrowdBotInput(players[i],quietRace,new PrTileState([]),tick*33,42,"normal",memoryByPilot[i],roomGrid);
    expect(roomGrid.stats.queries).toBe(30);expect(roomGrid.stats.visited).toBeLessThanOrEqual(30*PR_CROWD_LIMITS.maxVisited);
  });
});
