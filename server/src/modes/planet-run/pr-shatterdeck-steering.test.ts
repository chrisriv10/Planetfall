import {describe,expect,it} from "vitest";
import {DEFAULT_COSMETICS,PrTileState,prRound,prSpawn,prStepMotion,type PrPlayerState} from "@planetfall/shared";
import {prCrowdBotInput,type PrSteeringMemory} from "./pr-bot-steering.js";

const round=prRound("shatterdeck");
function pilot(x=0,z=0,y=26.1):PrPlayerState{return {...prSpawn({x,y,z}),id:"falling-pilot",name:"Pilot",color:"#ffffff",isBot:true,connected:false,ready:true,status:"active",checkpoint:0,place:0,qualifiedRounds:0,lastInputSequence:0,emote:null,emoteStartedAt:-2000,fallbucks:0,crowns:0,sessionTotalXp:0,sessionLevel:1,sessionXp:0,ownedCosmetics:[],unlockedPassRewards:["default"],equippedCosmetics:{...DEFAULT_COSMETICS},velocity:{x:0,y:-2,z:0}};}
const memory=(identitySeed=42):PrSteeringMemory=>({goal:-1,nextDecision:0,sequence:0,identitySeed});
function missingThrough(deck:number){const state=new PrTileState(round.tiles);for(const tile of round.tiles)if(tile.deck<=deck)state.contact(tile.id,0);return state;}

describe("Shatterdeck bot descent over 7.5m deck gaps",()=>{
 it("selects a viable lower tile while airborne before the obsolete 6m horizon reaches it",()=>{
  const tile=round.tiles.find(tile=>tile.deck===0&&tile.column===2&&tile.row===1)!,p=pilot(tile.center.x,tile.center.z),m=memory(),state=missingThrough(0);
  const command=prCrowdBotInput(p,round,state,4000,42,"hard",m),goal=round.tiles[m.goal];
  expect(goal).toBeDefined();expect(goal.deck).toBe(1);expect(goal.center.y).toBe(18.5);expect(p.position.y-goal.center.y).toBeGreaterThan(7.5);expect(state.intact(goal.id,4500)).toBe(true);
  expect(Number.isFinite(command.moveX)&&Number.isFinite(command.moveZ)).toBe(true);expect(Math.hypot(command.moveX,command.moveZ)).toBeLessThanOrEqual(1);
 });
 it("abandons an intact cached target above the falling pilot",()=>{
  const cached=round.tiles.find(tile=>tile.deck===0&&tile.column===2&&tile.row===1)!,p=pilot(cached.center.x-2,cached.center.z,24),m={...memory(),goal:cached.id,nextTargetAt:5000},state=missingThrough(0);
  state.triggered.delete(cached.id);prCrowdBotInput(p,round,state,4000,42,"hard",m);
  expect(m.goal).not.toBe(cached.id);expect(round.tiles[m.goal].deck).toBe(1);expect(m.target!.y).toBeLessThan(p.position.y);
 });
 it("never steers through two missing decks toward an unreachable lower plane",()=>{
  const p=pilot(),m=memory(),command=prCrowdBotInput(p,round,missingThrough(1),4000,42,"hard",m);
  expect(m.goal).toBe(-1);expect(m.target).toEqual(p.position);expect(command.dive).toBe(false);
 });
 it("prefers the nearest viable deck when two lower planes enter the height window",()=>{
  const lower=round.tiles.find(tile=>tile.deck===1&&tile.column===2&&tile.row===1)!,p=pilot(lower.center.x,lower.center.z,20.5),m=memory();
  prCrowdBotInput(p,round,missingThrough(0),4000,42,"hard",m);expect(round.tiles[m.goal].deck).toBe(1);
 });
 it("sees a reachable lower landing for contextual recovery without diving over intact support",()=>{
  const state=missingThrough(0),underfoot=round.tiles.find(tile=>tile.deck===1&&tile.column===2&&tile.row===1)!;let recoveries=0;
  for(let identity=0;identity<64;identity++){
   // Slightly off the annulus hole center, a 3.5m recovery probe reaches the
   // inner edge. At the exact center it remains a genuine unsupported gap.
   const unsupported=pilot(.5),m=memory(identity),command=prCrowdBotInput(unsupported,round,state,4000,42,"hard",m);
   if(command.dive){recoveries++;expect(round.tiles[m.goal].deck).toBe(1);}
   const supported=pilot(underfoot.center.x,underfoot.center.z);
   expect(prCrowdBotInput(supported,round,state,4000,42,"hard",memory(identity)).dive).toBe(false);
  }
  expect(recoveries).toBeGreaterThan(0);
 });
 it("lands an ordinary bot on an intact lower deck using only movement inputs",()=>{
  const tile=round.tiles.find(tile=>tile.deck===0&&tile.column===2&&tile.row===1)!,p=pilot(tile.center.x,tile.center.z),m=memory(),state=missingThrough(0);
  let landed=false;
  for(let tick=0;tick<60&&!landed;tick++){
   const elapsed=4000+tick*1000/30,input=prCrowdBotInput(p,round,state,elapsed,42,"normal",m);prStepMotion(p,input,1/30,elapsed,round,42,state);
   if(p.grounded){const support=round.tiles[Number(p.supportId!.slice(5))];expect(support.deck).toBe(1);landed=true;}
  }
  expect(landed).toBe(true);expect(p.position.y).toBe(18.5);
 });
});
