import {PG_HEROES,PG_OPERATORS,PG_MAP,type PgRoomView,type PgSnapshot,type PgWeaponId} from "@planetfall/shared";
import type {PgCharacterSelectionView} from "./pg-character-selection-screen";

export interface PgCharacterDraft {characterId:string|null;primary:PgWeaponId|null;pending:boolean;}
/** Legal broad client gates; the existing server action remains the final authority. */
export function pgCharacterSelectionView(room:PgRoomView,snapshot:PgSnapshot|null,localId:string,draft:PgCharacterDraft):PgCharacterSelectionView|null{
 const modeId=room.configuration.mode;if(modeId!=="planetwatch"&&modeId!=="planetsiege")return null;
 const live=room.phase==="lobby"?null:snapshot,mode=live?.mode?.id===modeId?live.mode:null;
 const players=live?.players??room.players,own=players.find(player=>player.id===localId);if(!own)return null;
 const pilot=mode?.pilots[localId],side=pilot?.side??(own.team==="solar"?"attack":"defend");
 const catalog=modeId==="planetwatch"?Object.values(PG_HEROES):Object.values(PG_OPERATORS).filter(character=>character.side===side);
 const selectedId=pilot?.characterId??room.selections?.[localId]??null;
 const teammatePick=(id:string)=>mode?.pilots[id]?.characterId??room.selections?.[id]??null;
 const team=players.filter(player=>player.team===own.team).map(player=>({id:player.id,name:player.name,characterId:teammatePick(player.id),ready:room.phase==="lobby"?player.ready:mode?.pilots[player.id]?.life==="alive",local:player.id===localId}));
 const reserved=new Map<string,string>();for(const player of players){const pick=teammatePick(player.id);if(pick&&player.team===own.team&&player.id!==localId&&!player.isBot)reserved.set(pick,player.name);}
 const character=catalog.find(character=>character.id===draft.characterId)??catalog.find(character=>character.id===selectedId)??catalog.find(character=>!reserved.has(character.id))??catalog[0];
 if(!character)return null;
 const primary=character.primaryChoices.find(weapon=>weapon===draft.primary)??character.primaryChoices.find(weapon=>weapon===own.loadout.primary)??character.primaryChoices[0];
 let reason="";
 if(draft.pending)reason="Confirming your selection…";
 else if(reserved.has(character.id))reason=`Reserved by ${reserved.get(character.id)}.`;
 else if(own.connected===false)reason="Reconnect before changing character.";
 else if(room.phase!=="lobby"){
  if(!mode||!pilot||room.phase==="results")reason="Selection is unavailable during this phase.";
  else if(mode.id==="planetwatch"&&pilot?.life==="alive"){
   const inSpawn=PG_MAP.spawns.some(spawn=>spawn.team===own.team&&Math.hypot(spawn.position.x-own.position.x,spawn.position.y-own.position.y,spawn.position.z-own.position.z)<=8);
   if(!inSpawn)reason="Return to spawn or select while eliminated.";
   else if(live!.serverTime-own.lastDamageAt<5000||live!.serverTime-Math.max(...own.guns.map(gun=>gun.nextFireAt))<5000)reason="Leave combat for five seconds before changing hero.";
  }else if(mode.id==="planetsiege"){
   if(mode.subphase!=="prepare")reason="Operators lock when the action phase starts.";
   else{
    const current=Object.values(PG_OPERATORS).find(operator=>operator.id===selectedId);
    if(mode.effects.some(effect=>effect.ownerId===localId)||current&&pilot&&pilot.charges[0]<current.signature.charges)reason="Your operator has already committed equipment this round.";
   }
  }
 }
 return {mode:modeId,side,catalog,draftId:character.id,selectedId,primary,team,reserved,
  phaseLabel:room.phase==="lobby"?"READY ROOM · CHOOSE YOUR ROLE":mode?.subphase.toUpperCase()??"DEPLOYING",
  secondsLeft:mode&&mode.deadline>0?Math.max(0,Math.ceil((mode.deadline-live!.serverTime)/1000)):null,
  canConfirm:!reason,reason,pending:draft.pending};
}
