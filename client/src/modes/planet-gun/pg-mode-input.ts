import {PG_OBJECTIVES,PG_PANEL_SOCKETS,pgResolveHero,pgResolveOperator,type PgModeAction,type PgSnapshot,type PgSnapshotPlayer,type Vec3} from "@planetfall/shared";
export type PgModeIntent=PgModeAction extends infer A?A extends PgModeAction?Omit<A,"sequence"|"lifeId">:never:never;
const distance=(a:Vec3,b:Vec3)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
export function pgNearbyModeInteraction(s:PgSnapshot,p:PgSnapshotPlayer,at=s.serverTime):PgModeIntent|null{
 const m=s.mode;if(!m)return null;
 const hold=m.pilots[p.id]?.interaction;if(hold&&at>=hold.startedAt+hold.durationMs)return null;
 if(m.id==="planetstrike"){
  if(m.subphase!=="action")return null;
  const site=PG_OBJECTIVES.strike.find(site=>distance(site.position,p.position)<=site.radius);
  if(m.charge.carrierId===p.id&&site)return {kind:"interact",targetId:`site-${site.id}`,held:true};
  if(p.team!==m.attackTeam&&m.charge.site&&m.charge.position&&distance(m.charge.position,p.position)<3)return {kind:"interact",targetId:"charge",held:true};
  const drop=m.drops.find(d=>distance(d.position,p.position)<=2);if(drop)return {kind:"pickup",entityId:drop.id};
 }
 if(m.id==="planetzombies"){
  const downed=s.players.find(v=>v.id!==p.id&&m.pilots[v.id]?.life==="downed"&&distance(v.position,p.position)<2.4);if(downed)return {kind:"interact",targetId:`revive:${downed.id}`,held:true};
  if(!m.power&&distance(PG_OBJECTIVES.power,p.position)<3)return {kind:"interact",targetId:"power",held:true};
 }
 if(m.id==="planetsiege"){const socket=PG_PANEL_SOCKETS.find(v=>distance(v.solid.center,p.position)<3);if(socket)return {kind:"interact",targetId:socket.id,held:true};}
 return null;
}
export function pgModeAbilityIntent(s:PgSnapshot,p:PgSnapshotPlayer,slot:0|1|2):PgModeIntent|null{
 const m=s.mode;if(!m)return null;const state=m.pilots[p.id],hero=pgResolveHero(state?.characterId),operator=pgResolveOperator(state?.characterId),definition=hero?(slot===2?hero.ultimate:hero.abilities[slot]):operator?.signature;
 const ally=s.players.filter(v=>v.id!==p.id&&v.team===p.team&&v.hp>0).filter(v=>distance(v.position,p.position)<(definition?.range??12)).sort((a,b)=>a.hp/(m.pilots[a.id]?.maxHp??100)-b.hp/(m.pilots[b.id]?.maxHp??100))[0];
 const socket=PG_PANEL_SOCKETS.filter(v=>distance(v.solid.center,p.position)<3).sort((a,b)=>distance(a.solid.center,p.position)-distance(b.solid.center,p.position))[0];
 const range=Math.min(8,definition?.range??5),position={x:p.position.x-Math.sin(p.yaw)*range,y:p.position.y,z:p.position.z-Math.cos(p.yaw)*range};
 return {kind:"ability",slot,...(socket&&m.id==="planetsiege"?{targetId:socket.id}:ally&&definition?.target==="ally"?{targetId:ally.id}:{}),position};
}
