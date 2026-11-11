import {pgZombieBarricadeTarget} from "./pg-zombie-barricade-target";
import {pgZombieMachineTarget} from "./pg-zombie-machine-target";
import {PG_ZOMBIE_WALL_BUYS,PG_ZOMBIE_ARSENAL_SITE,PG_ZOMBIE_ARSENAL_COST,PG_ZOMBIE_FORGE_SITE,PG_ZOMBIE_TONIC_SOCKETS,PG_ZOMBIE_PRICES,PG_OBJECTIVES,PG_WEAPONS,pgCollisionMap,pgHasLineOfSight,type PgSnapshot,type Vec3} from "@planetfall/shared";
import type {PgWorldInteractionView} from "./pg-world-interaction-prompt";

/** Range/sight and priority agree with the authoritative machine and held-interaction gates. */
export function createPgZombieArsenalPrompt(){
 let revision=-1,map:ReturnType<typeof pgCollisionMap>|null=null;
 return (snapshot:PgSnapshot,id:string,key:string):PgWorldInteractionView|null=>{
  const mode=snapshot.mode;if(mode?.id!=="planetzombies")return null;
  const player=snapshot.players.find(player=>player.id===id),pilot=mode.pilots[id];if(!player||player.hp<=0||pilot?.life!=="alive")return null;
  const distance=(site:Vec3)=>Math.hypot(player.position.x-site.x,player.position.y-site.y,player.position.z-site.z);
  const rescue=snapshot.players.find(other=>other.id!==id&&mode.pilots[other.id]?.life==="downed"&&distance(other.position)<2.4);
  if(rescue)return {key,title:`REVIVE ${rescue.name.toUpperCase()}`,detail:"HOLD TO HELP YOUR CREW",available:true};
  const topology=mode.collision.topologyRevision??mode.collision.revision;
  if(!map||topology!==revision){revision=topology;map=pgCollisionMap(mode.collision,undefined,{navigation:false});}
  const visible=(site:Vec3)=>pgHasLineOfSight({...player.position,y:player.position.y+1},{...site,y:site.y+1},map!);
  if(!mode.power&&distance(PG_OBJECTIVES.power)<3&&visible(PG_OBJECTIVES.power))return {key,title:"STATION POWER",detail:"HOLD TO RESTORE POWER",available:true};
  const barricade=pgZombieBarricadeTarget(player.position,mode.collision.panels,visible);
  if(barricade){const held=pilot.interaction?.targetId===`barricade:${barricade.site.id}`?pilot.interaction:null;
   return {key,title:`${barricade.site.name.toUpperCase()} · ${barricade.remaining}/3 BOARDS`,available:barricade.damaged,detail:held?`REPAIRING · ${Math.max(0,Math.ceil((held.startedAt+held.durationMs-snapshot.serverTime)/100)/10)}s`:barricade.damaged?"HOLD TO REPAIR ONE BOARD · KEEP ENTRY CLEAR":"ENTRY SCREEN INTACT"};
  }
  const machine=pgZombieMachineTarget(player.position,visible);
  if(machine?.kind==="arsenal"&&mode.arsenal){
   const title="ANOMALY ARSENAL",state=mode.arsenal;
   if(state.phase==="ready")return {key,title,available:state.ownerId===id,detail:state.ownerId===id?`CLAIM ${PG_WEAPONS[state.weaponId].name.toUpperCase()} · REPLACES PRIMARY`:`RESERVED FOR ${snapshot.players.find(player=>player.id===state.ownerId)?.name??"ANOTHER SURVIVOR"}`};
   if(state.phase==="revealing")return {key,title,available:false,detail:`RESOLVING ANOMALY · ${Math.max(0,Math.ceil((state.revealAt-snapshot.serverTime)/1000))}s`};
   return {key,title,available:mode.power&&pilot.points>=PG_ZOMBIE_ARSENAL_COST,detail:!mode.power?"RESTORE STATION POWER":pilot.points<PG_ZOMBIE_ARSENAL_COST?`${PG_ZOMBIE_ARSENAL_COST} RUN POINTS REQUIRED · YOU HAVE ${pilot.points}`:`REQUISITION · ${PG_ZOMBIE_ARSENAL_COST} RUN POINTS`};
  }
  if(machine?.kind==="forge"&&mode.forge){
   const title="OVERCHARGE FORGE",job=mode.forge;
   if(job.phase!=="idle")return {key,title,available:false,detail:job.phase==="processing"?`OVERCHARGING · ${Math.max(0,Math.ceil((job.completesAt-snapshot.serverTime)/1000))}s`:`OC ${job.targetTier} READY`};
   const price=pilot.upgrade<3?PG_ZOMBIE_PRICES.upgrade[pilot.upgrade as 0|1|2]:null;
   const detail=!mode.power?"RESTORE STATION POWER":!pilot.primaryUnlocked||player.slot!==0?"EQUIP A PURCHASED PRIMARY":price===null?"MAXIMUM OVERCHARGE":`OC ${pilot.upgrade+1} · ${price} RUN POINTS`;
   return {key,title,detail,available:mode.power&&pilot.primaryUnlocked&&player.slot===0&&price!==null&&pilot.points>=price};
  }
  const tonic=machine?.kind==="tonic"?machine.site:null;
  if(tonic)return {key,title:tonic.name,available:!pilot.perks.includes(tonic.id)&&pilot.points>=tonic.price,detail:pilot.perks.includes(tonic.id)?"TONIC ACTIVE":`${tonic.price} RUN POINTS · ${tonic.id==="perk-vitality"?"INCREASE HIT ENDURANCE":tonic.id==="perk-reload"?"FASTER RELOADS":"BOOST SPRINT ENDURANCE"}`};
  const rack=machine?.kind==="rack"?machine.site:null;
  if(rack){const inserted=mode.forge?.phase==="processing"&&mode.forge.ownerId===id&&rack.weaponId!=="orbit"&&rack.weaponId!=="comet";return {key,title:PG_WEAPONS[rack.weaponId].name.toUpperCase(),available:!inserted&&pilot.points>=rack.price,detail:inserted?"PRIMARY IN OVERCHARGE FORGE":`${rack.price} RUN POINTS · REPLACES ${rack.weaponId==="orbit"||rack.weaponId==="comet"?"SIDEARM":"PRIMARY"}`};}
  return null;
 };
}
