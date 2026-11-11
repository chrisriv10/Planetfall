import {PG_MAP,PG_STRIKE_PRICES,pgWeaponValid,type PgSnapshot} from "@planetfall/shared";

/** Presentation gates mirror broad server rules; purchase acknowledgements remain authoritative. */
export function pgStrikeBuyView(snapshot:PgSnapshot|null,localId:string,pendingItem:string|null=null,feedback=""){
 const mode=snapshot?.mode;if(!snapshot||mode?.id!=="planetstrike")return null;
 const player=snapshot.players.find(player=>player.id===localId),pilot=mode.pilots[localId];if(!player||!pilot)return null;
 const inZone=PG_MAP.spawns.some(spawn=>spawn.team===player.team&&Math.hypot(spawn.position.x-player.position.x,spawn.position.y-player.position.y,spawn.position.z-player.position.z)<5);
 const phaseAllowed=mode.subphase==="buy"&&snapshot.serverTime<mode.deadline;
 const sharedReason=pilot.life!=="alive"||player.hp<=0?"Available while alive.":!phaseAllowed?"Purchases open during the buy phase.":!inZone?"Return to your spawn purchase zone.":"";
 const items=Object.entries(PG_STRIKE_PRICES).map(([id,price])=>{
  let owned=false,equipped=false,itemReason="";
  if(pgWeaponValid(id)){
   const slot=id==="orbit"||id==="comet"?1:0;owned=player.guns[slot].id===id&&(slot===1||pilot.primaryUnlocked);equipped=owned&&player.slot===slot;
  }else if(id==="armor"){
   owned=pilot.armor>0;if(pilot.armor>=50)itemReason="Armor is already full.";
  }else{
   const slot=id==="smoke"?0:id==="flash"?1:2;owned=pilot.utilities[slot]>0;if(owned)itemReason="This utility is already owned.";
  }
  const reason=sharedReason||itemReason||(pendingItem?"Waiting for purchase confirmation.":pilot.credits<price?"Insufficient credits.":"");
  return {id,price,owned,equipped,available:!reason,reason};
 });
 return {credits:pilot.credits,secondsLeft:mode.subphase==="buy"?Math.max(0,Math.ceil((mode.deadline-snapshot.serverTime)/1000)):0,items,pendingItem,reason:feedback||sharedReason};
}
