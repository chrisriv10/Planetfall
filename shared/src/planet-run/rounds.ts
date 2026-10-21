import { PR_BALANCE } from "./balance.js";
import type { PrCheckpoint,PrObstacle,PrPlatform,PrRoundDefinition,PrRoundId,PrTile } from "./types.js";
const v=(x:number,y:number,z:number)=>({x,y,z});
const platform=(id:string,x:number,y:number,z:number,hx:number,hz:number):PrPlatform=>({id,center:v(x,y,z),half:v(hx,.6,hz)});
const checkpoint=(z:number,y=0):PrCheckpoint=>({center:v(0,y+2,z),half:v(9,4,2),spawn:v(0,y+.6,z+3)});
function race(id:PrRoundId,name:string,theme:string):PrRoundDefinition {
  const platforms:PrPlatform[]=[],obstacles:PrObstacle[]=[];
  for(let i=0;i<7;i++){
    const y=id==="flux-gardens"&&i%2===1?1.2:0;
    const p=platform(`${id}-deck-${i}`,0,y,-i*20,9,9.6);
    if(id==="cargo-cyclone"&&i>0&&i<6)p.conveyor=v(i%2?2.3:-2.3,0,0);
    if(id==="flux-gardens")p.gravityScale=i%2===1?.65:1;
    if(id==="cargo-cyclone"&&(i===2||i===4))p.motion={axis:"x",distance:2.4,period:6,phase:i*.7};
    platforms.push(p);
    if(i>0&&i<6)obstacles.push({id:`${id}-hazard-${i}`,kind:id==="capacitor-causeway"?"door":"rotator",center:v(0,y+1,-i*20),half:v(id==="capacitor-causeway"?7:6,.45,.6),period:5+i*.6,phase:i*.8,strength:7});
    if(id==="capacitor-causeway"&&i%2===1)obstacles.push({id:`boost-${i}`,kind:"boost",center:v(0,y+.6,-i*20+6),half:v(2,.5,1.5),period:1,phase:0,strength:13});
  }
  const spawns=Array.from({length:30},(_,i)=>v((i%6-2.5)*2.2,.6,7+Math.floor(i/6)*2.2));
  platforms.push(platform(`${id}-start`,0,0,11,9,12));
  return {id,name,theme,category:"race",minimumPlayers:2,maximumPlayers:30,timeoutMs:110000,objective:"Race to the finish",platforms,obstacles,checkpoints:[checkpoint(4),checkpoint(-36),checkpoint(-76)],finish:checkpoint(-124),waypoints:Array.from({length:14},(_,i)=>v(0,.6,4-i*10)),spawns,killY:-18,tiles:[]};
}
function survival(id:"solar-sweep"|"meteor-garden",name:string,theme:string):PrRoundDefinition {
  const platforms:PrPlatform[]=[],obstacles:PrObstacle[]=[];
  for(let x=-1;x<=1;x++)for(let z=-1;z<=1;z++)platforms.push(platform(`${id}-${x}-${z}`,x*12,0,z*12,5.9,5.9));
  if(id==="solar-sweep"){
    obstacles.push({id:"solar-low",kind:"rotator",center:v(0,.65,0),half:v(17,.35,.55),period:7,phase:0,strength:9});
    obstacles.push({id:"solar-high",kind:"rotator",center:v(0,2.8,0),half:v(17,.6,.8),period:11,phase:1.5,strength:7});
  }else for(let i=0;i<16;i++)obstacles.push({id:`meteor-${i}`,kind:"meteor",center:v((i%4-1.5)*8,.5,(Math.floor(i/4)-1.5)*8),half:v(3.2,2,3.2),period:5.2+(i%3)*.4,phase:i*.213,strength:12});
  return {id,name,theme,category:"survival",minimumPlayers:2,maximumPlayers:30,timeoutMs:65000,objective:"Stay on the station",platforms,obstacles,checkpoints:[],finish:null,waypoints:[],spawns:Array.from({length:30},(_,i)=>v((i%6-2.5)*4,.6,(Math.floor(i/6)-2)*5)),killY:-12,tiles:[]};
}
function shatterdeck():PrRoundDefinition {
  const tiles:PrTile[]=[],r=PR_BALANCE.tileRadius;
  for(let deck=0;deck<4;deck++)for(let q=-7;q<=7;q++)for(let s=-7;s<=7;s++){
    const radius=Math.max(Math.abs(q),Math.abs(s),Math.abs(q+s)),limit=[4,6,6,7][deck];
    if(radius>limit)continue;
    // Four authored footprints: compact crown, broken annulus, linked wings,
    // broad fragmented base. Central lanes preserve readable landing options.
    if(deck===1&&radius<2||deck===1&&q>2&&s===0)continue;
    if(deck===2&&Math.abs(q)<2&&Math.abs(s)>2)continue;
    if(deck===3&&radius>3&&(q-s)%4===0)continue;
    tiles.push({id:tiles.length,deck,column:q,row:s,center:v(Math.sqrt(3)*r*(q+s/2),18-deck*5,1.5*r*s),neighbors:[]});
  }
  const offsets=[[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]];
  const lookup=new Map(tiles.map(t=>[`${t.deck}:${t.column}:${t.row}`,t.id]));
  for(const tile of tiles)for(const [dq,ds]of offsets){const id=lookup.get(`${tile.deck}:${tile.column+dq}:${tile.row+ds}`);if(id!==undefined)tile.neighbors.push(id);}
  const upper=tiles.filter(t=>t.deck===0);
  return {id:"shatterdeck",name:"Shatterdeck",theme:"Experimental energy conservatory",category:"final",minimumPlayers:1,maximumPlayers:30,timeoutMs:120000,objective:"Keep a route beneath your boots",platforms:[],obstacles:[],checkpoints:[],finish:null,waypoints:[],spawns:Array.from({length:30},(_,i)=>({...upper[Math.floor(i*upper.length/30)].center})),killY:-5,tiles};
}
export const PR_ROUNDS:readonly PrRoundDefinition[]=[
  race("cargo-cyclone","Cargo Cyclone","Coral freight accelerators"),
  survival("solar-sweep","Solar Sweep","Gold solar turbine terraces"),
  survival("meteor-garden","Meteor Garden","Teal orbital arboretum"),
  race("flux-gardens","Flux Gardens","Lilac variable-gravity conservatory"),
  race("capacitor-causeway","Capacitor Causeway","Blue pulse-gate research pier"),
  shatterdeck(),
];
export function prRound(id:PrRoundId):PrRoundDefinition {const round=PR_ROUNDS.find(r=>r.id===id);if(!round)throw new Error(`Unknown PlanetRun round ${id}`);return round;}
