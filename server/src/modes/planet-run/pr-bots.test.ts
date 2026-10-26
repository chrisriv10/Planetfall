import {describe,it,expect} from "vitest";
import {DEFAULT_COSMETICS,PrTileState,prRound,prSpawn,type PrPlayerState} from "@planetfall/shared";
import {prBotInput,type PrBotMemory} from "./pr-bots.js";
function pilot(x:number):PrPlayerState{return {...prSpawn({x,y:.6,z:4}),id:"pilot",name:"Pilot",color:"#ffffff",isBot:true,connected:false,ready:true,status:"active",checkpoint:0,place:0,qualifiedRounds:0,lastInputSequence:0,emote:null,emoteStartedAt:-2000,fallbucks:0,crowns:0,sessionTotalXp:0,sessionLevel:1,sessionXp:0,ownedCosmetics:[],unlockedPassRewards:["default"],equippedCosmetics:{...DEFAULT_COSMETICS}};}
describe("PlanetRun race bot longitudinal progression",()=>{
  it.each([0,1,2,3,4])("advances off-center progress with personality %i without turning back",identitySeed=>{
    const round=prRound("cargo-cyclone"),lane=(identitySeed-2)*1.8,p=pilot(lane),memory:PrBotMemory={identitySeed,goal:0,nextDecision:0,sequence:0};
    const input=prBotInput(p,round,new PrTileState([]),0,42,"normal",memory);
    expect(memory.goal).toBe(1);expect(input.moveZ).toBeLessThan(-.8);expect(Math.hypot(input.moveX,input.moveZ)).toBeLessThanOrEqual(1.000001);
  });
});
