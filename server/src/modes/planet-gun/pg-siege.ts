import {pgLeanEye,PG_MAP,PG_OBJECTIVES,PG_PANEL_SOCKETS,PG_OPERATORS,PG_OPERATOR_IDS,PG_SIEGE_MOVEMENT_RULES,pgCapsuleClear,pgCharacterDefaultLoadout,pgResolveOperator,pgValidateOperatorLoadout,pgRayBox,type PgModeAction,type PgModeActionResult,type PgModeSnapshot,type PgPlayer,type PgSiegePilot,type PgModeEffect,type PgModeIntel,type PgDrone,type PgTeam,type PgWeaponId,type Vec3} from "@planetfall/shared";
import type {PgModeContext,PgModeRuntime,PgModeTarget} from "./pg-mode-runtime.js";
import {pgModeDistance as dist,pgModePilot,pgModeOk as ok,pgModeError as error,pgRawModeDamage} from "./pg-mode-base.js";
import {PgRoundSeries} from "./pg-round-series.js";
import {PgZombieNavigation} from "./pg-zombie-navigation.js";
// Keep doorway approach lanes open even when the currently selected bot route
// uses another entrance. Cover must not strand the next arriving teammate.
const entryNodes=new Set(PG_MAP.navigation.filter(node=>PG_PANEL_SOCKETS.some(socket=>socket.approaches.some(at=>Math.hypot(at.x-node.position.x,at.y-node.position.y,at.z-node.position.z)<.05))).map(node=>node.id));
const entryCorridors=PG_MAP.navigation.flatMap(node=>node.links.filter(link=>link.kind==="walk"&&(entryNodes.has(node.id)||entryNodes.has(link.to))&&node.id<link.to).map(link=>[node.position,PG_MAP.navigation[link.to].position] as const));
const eye=(p:Vec3)=>({...p,y:p.y+1.3});
const lineDistance=(p:Vec3,a:Vec3,b:Vec3)=>{const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/Math.max(.0001,dx*dx+dz*dz)));return Math.hypot(p.x-a.x-dx*t,p.z-a.z-dz*t);};
const crossesLine=(from:Vec3,to:Vec3,a:Vec3,b:Vec3,radius:number)=>{const dx=to.x-from.x,dz=to.z-from.z,ex=b.x-a.x,ez=b.z-a.z,det=dx*ez-dz*ex;if(Math.abs(det)>.00001){const ax=a.x-from.x,az=a.z-from.z,t=(ax*ez-az*ex)/det,u=(ax*dz-az*dx)/det;if(t>=0&&t<=1&&u>=0&&u<=1)return true;}return Math.min(lineDistance(from,a,b),lineDistance(to,a,b),lineDistance(a,from,to),lineDistance(b,from,to))<=radius;};
import {PG_SIEGE_CAMERAS} from "@planetfall/shared";
export {PG_SIEGE_CAMERAS} from "@planetfall/shared";
interface Gadget extends PgModeEffect {primitive:string;disabledUntil:number;pool:number;nextPulse:number;direction:Vec3;damageByTarget?:Map<string,number>;previousPositions?:Map<string,Vec3>;}
interface Scout extends PgDrone {input:{x:number;z:number;at:number};}
/** One-life compound control. Public/team intel is projected separately for each recipient. */
export class PgSiege implements PgModeRuntime {
 readonly id="planetsiege" as const;
 private series=new PgRoundSeries(3);private pilots=new Map<string,PgSiegePilot>();
 private gadgets=new Map<string,Gadget>();private scouts=new Map<string,Scout>();private intel=new Map<PgTeam,PgModeIntel[]>([["solar",[]],["void",[]]]);
 private subphase:"prepare"|"action"|"intermission"|"complete"="prepare";private deadline=0;private now=0;private capture=0;private vacantAt=0;private site=0;private serial=0;
 private camerasDisabledUntil=new Map<string,number>();
 private cameraHealth=new Map<string,number>();
 private defensePosts:{revision:number;site:number;posts:(Vec3|null)[];patrol:Vec3[]}|null=null;
 private defenseNavigation?:PgZombieNavigation;
 private assaultCommits=new Set<string>();
 private botSteering=new Map<string,{revision:number;goal:Vec3;path:Vec3[];reconsiderAt:number}>();
 private defensePatrol=new Map<string,number>();private retakers:string[]=[];private defenseNextSense=0;private defenseLastCapture=0;private defenseResetAt:number|null=null;
 private captureGoals:{revision:number;site:number;points:Vec3[]}|null=null;
 private common=new Map<string,{breaches:number;barricades:number;repairs:number}>();private slowed=new Map<string,number>();private toggles=new Map<string,number>();private pendingBreaches:{id:string;ownerId:string;at:number;reinforced:boolean}[]=[];
 constructor(private ctx:PgModeContext){}
 start(now:number){this.series=new PgRoundSeries(3);this.pilots.clear();this.serial=0;this.beginRound(now);}
 private beginRound(now:number){
  this.botSteering.clear();this.assaultCommits.clear();
  this.now=now;this.subphase="prepare";this.deadline=now+35000;this.capture=0;this.vacantAt=0;this.site=(this.series.round-1)%2;this.defensePosts=null;this.defensePatrol.clear();this.retakers=[];this.defenseNextSense=now;this.defenseLastCapture=0;this.defenseResetAt=null;this.gadgets.clear();this.scouts.clear();this.pendingBreaches=[];this.slowed.clear();this.intel.set("solar",[]);this.intel.set("void",[]);this.common.clear();this.camerasDisabledUntil.clear();this.cameraHealth=new Map(PG_SIEGE_CAMERAS.map(camera=>[camera.id,35]));this.ctx.world.reset([],now);
  const used=new Map<PgTeam,Set<string>>([["solar",new Set()],["void",new Set()]]);
  for(const p of [...this.ctx.players.values()].sort((a,b)=>Number(a.isBot)-Number(b.isBot))){
   const side=p.team===this.series.attackTeam?"attack":"defend",old=this.pilots.get(p.id),available=PG_OPERATOR_IDS.filter(id=>PG_OPERATORS[id].side===side&&!used.get(p.team)!.has(id));
   const preferred=old?.characterId??this.ctx.selections?.get(p.id);const reserved=new Set([...this.ctx.players.values()].filter(other=>other.id!==p.id&&!other.isBot&&other.team===p.team&&!this.pilots.has(other.id)).map(other=>this.ctx.selections?.get(other.id)));const id=preferred&&available.includes(preferred as typeof available[number])?preferred as typeof available[number]:available.find(id=>!reserved.has(id))??available[0];if(!id)continue;used.get(p.team)!.add(id);
   const op=PG_OPERATORS[id],s:PgSiegePilot={...pgModePilot(p,op.maxHp),side,characterId:id,charges:[op.signature.charges,side==="attack"?1:2],droneId:null,cameraId:null,reinforcements:side==="defend"?2+(id==="brace"?1:0):0,controllingDrone:false};this.pilots.set(p.id,s);this.common.set(p.id,{breaches:side==="attack"?1:0,barricades:side==="defend"?2:0,repairs:side==="defend"?1:0});
   const anchor=side==="defend"?PG_OBJECTIVES.uplink[this.site].position:PG_MAP.spawns.find(sp=>sp.team===p.team)!.position;
   const index=[...used.get(p.team)!].length-1,position={x:anchor.x+(index%3-1)*1.2,y:anchor.y,z:anchor.z+Math.floor(index/3)*1.2};
   this.ctx.respawn(p,now,pgValidateOperatorLoadout(op.id,this.ctx.selectedLoadouts?.get(p.id))??pgCharacterDefaultLoadout(op),pgCapsuleClear(position,1.95,this.ctx.world.map)?position:anchor);p.hp=op.maxHp;p.protectedUntil=this.deadline;
   if(side==="attack"){const drone:Scout={id:`drone-${p.id}`,ownerId:p.id,position:{...p.position},yaw:p.yaw,pitch:0,hp:35,disabledUntil:0,input:{x:0,z:0,at:Number.NEGATIVE_INFINITY}};this.scouts.set(drone.id,drone);s.droneId=drone.id;}
  }
 }
 private roundEnd(winner:PgTeam,now:number){if(this.subphase!=="action"&&this.subphase!=="prepare")return;this.series.resolve(winner);for(const p of this.pilots.values())p.interaction=null;if(this.series.done){this.subphase="complete";this.deadline=0;this.ctx.finish(this.series.winner);}else{this.subphase="intermission";this.deadline=now+5000;}}
 update(dt:number,now:number){
  this.now=now;if(this.subphase==="intermission"){if(now>=this.deadline)this.beginRound(now);return;}if(this.subphase==="complete")return;
  if(this.subphase==="prepare"&&now>=this.deadline){this.subphase="action";this.deadline=now+150000;for(const p of this.ctx.players.values())p.protectedUntil=now;}
  for(const b of this.pendingBreaches.filter(b=>now>=b.at)){this.ctx.world.damage(b.id,1000,now,b.reinforced);const p=this.ctx.players.get(b.ownerId);if(p){const state=this.pilots.get(p.id);if(state)state.contribution+=30;if(b.reinforced){const socket=PG_PANEL_SOCKETS.find(s=>s.id===b.id);if(socket)for(const target of this.ctx.players.values())if(dist(target.position,socket.solid.center)<=2&&this.ctx.world.visible(eye(socket.solid.center),eye(target.position)))this.ctx.damage(target,p,35,now);}}}this.pendingBreaches=this.pendingBreaches.filter(b=>now<b.at);
  for(const scout of this.scouts.values())this.stepDrone(scout,dt,now);
  const panels=this.ctx.world.snapshot().panels;for(const gadget of this.gadgets.values()){if(gadget.primitive==="barrier"||gadget.primitive==="shutter"){const panel=panels.find(p=>p.id===(gadget.primitive==="shutter"?gadget.id.slice(6):gadget.id));if(panel)gadget.hp=Math.min(gadget.hp,panel.hp);}this.stepGadget(gadget,dt,now);}
  for(const [id,state]of this.pilots){const owner=this.ctx.players.get(id),camera=PG_SIEGE_CAMERAS.find(c=>c.id===state.cameraId);if(owner&&camera&&this.cameraValid(owner.team,camera,now)){const point=camera.target;this.scan(owner.team,camera.position,Math.atan2(camera.position.x-point.x,camera.position.z-point.z),30,now,false,0,Math.atan2(point.y-camera.position.y,Math.hypot(point.x-camera.position.x,point.z-camera.position.z)));}}
  for(const [id,g]of this.gadgets)if(now>=g.endsAt||g.hp<=0){this.gadgets.delete(id);this.ctx.world.damage(g.primitive==="shutter"?id.slice(6):id,100000,now,true);}
  for(const team of ["solar","void"] as const)this.intel.set(team,(this.intel.get(team)??[]).filter(i=>i.expiresAt>now));
  if(this.subphase!=="action")return;
  const living=[...this.ctx.players.values()].filter(p=>p.hp>0&&this.pilots.get(p.id)?.life==="alive"),attack=living.filter(p=>p.team===this.series.attackTeam),defend=living.filter(p=>p.team!==this.series.attackTeam);
  // Double elimination resolves for defenders, then capture, then action deadline.
  if(!attack.length){this.roundEnd(this.other(),now);return;}if(!defend.length){this.roundEnd(this.series.attackTeam,now);return;}
  const point=PG_OBJECTIVES.uplink[this.site],inside=(p:PgPlayer)=>p.protectedUntil<=now&&dist(p.position,point.position)<=point.radius;
  const attackers=attack.filter(inside),defenders=defend.filter(inside);
  if(attackers.length&&!defenders.length){this.vacantAt=0;this.capture=Math.min(1,this.capture+dt/15);for(const p of attackers)this.pilots.get(p.id)!.contribution+=dt;}
  else if(!attackers.length&&!defenders.length){this.vacantAt||=now;if(now-this.vacantAt>2000)this.capture=Math.max(0,this.capture-dt/10);}else this.vacantAt=0;
  if(this.capture>=1)this.roundEnd(this.series.attackTeam,now);else if(now>=this.deadline)this.roundEnd(this.other(),now);
 }
 private other():PgTeam{return this.series.attackTeam==="solar"?"void":"solar";}
 maxHp(p:PgPlayer){return this.pilots.get(p.id)?.maxHp??100;}
 movement(p:PgPlayer){const slow=(this.slowed.get(p.id)??0)>this.now?.7:1;return {...PG_SIEGE_MOVEMENT_RULES,walkSpeed:PG_SIEGE_MOVEMENT_RULES.walkSpeed*slow,sprintSpeed:PG_SIEGE_MOVEMENT_RULES.sprintSpeed*slow};}
 canMove(p:PgPlayer){const s=this.pilots.get(p.id);return !!s&&s.life==="alive"&&p.hp>0&&!s.cameraId&&!this.controlling(p.id)&&(this.subphase==="action"||this.subphase==="prepare"&&s.side==="defend");}
 canFire(p:PgPlayer){return this.subphase==="action"&&this.canMove(p);}
 viewOrigin(p:PgPlayer):Vec3|null{const state=this.pilots.get(p.id);if(state?.cameraId){const camera=PG_SIEGE_CAMERAS.find(c=>c.id===state.cameraId);return camera&&this.cameraValid(p.team,camera,this.now)?{...camera.position}:null;}if(this.controlling(p.id)){const drone=this.scouts.get(`drone-${p.id}`);return drone&&drone.hp>0&&drone.disabledUntil<=this.now&&this.sensorValid(p.team,drone.position,this.now)?{...drone.position,y:drone.position.y+.25}:null;}return pgLeanEye(p);}
 private cameraValid(team:PgTeam,camera:typeof PG_SIEGE_CAMERAS[number],now:number){return (this.cameraHealth.get(camera.id)??0)>0&&(this.camerasDisabledUntil.get(camera.id)??0)<=now&&this.sensorValid(team,camera.position,now);}
 private controlling(id:string){return (this.scouts.get(`drone-${id}`)?.input.at??Number.NEGATIVE_INFINITY)>this.now-500;}
 damage(p:PgPlayer,attacker:PgPlayer|null,amount:number,now:number){const s=this.pilots.get(p.id);return s&&this.subphase==="action"?pgRawModeDamage(p,s,amount,now,attacker):0;}
 eliminated(p:PgPlayer,_killer:PgPlayer|null,_weapon:PgWeaponId,now:number){const s=this.pilots.get(p.id);if(!s)return;s.life="eliminated";s.interaction=null;s.cameraId=null;p.respawnAt=Number.MAX_SAFE_INTEGER;p.deadAt=now;const drone=this.scouts.get(`drone-${p.id}`);if(drone)drone.input.at=Number.NEGATIVE_INFINITY;}
 action(p:PgPlayer,a:PgModeAction,now:number):PgModeActionResult{
  this.now=now;const s=this.pilots.get(p.id);if(!s)return error("Join the current operation first.");
  if(a.kind==="select"){
   if(this.subphase!=="prepare")return error("Operators lock when action starts.");const op=pgResolveOperator(a.characterId,s.side);if(!op)return error("Operator belongs to the other side.");const occupant=[...this.pilots].find(([id,v])=>id!==p.id&&this.ctx.players.get(id)?.team===p.team&&v.characterId===op.id);if(occupant&&!this.ctx.players.get(occupant[0])?.isBot)return error("A teammate reserved that operator.");const loadout=a.loadout?pgValidateOperatorLoadout(op.id,a.loadout):pgCharacterDefaultLoadout(op);if(!loadout)return error("Equipment is not legal for this operator.");
   // A selection cannot replenish deployed equipment: only pristine operators may change.
   if([...this.gadgets.values()].some(g=>g.ownerId===p.id)||s.charges[0]<(pgResolveOperator(s.characterId)?.signature.charges??0))return error("Equipment already committed this round.");const spentReinforcements=(s.side==="defend"?2+(s.characterId==="brace"?1:0):0)-s.reinforcements;s.reinforcements=Math.max(0,(s.side==="defend"?2+(op.id==="brace"?1:0):0)-spentReinforcements);if(occupant){const bot=this.ctx.players.get(occupant[0])!,botState=occupant[1],previous=pgResolveOperator(s.characterId,s.side)!;for(const [key,g]of this.gadgets)if(g.ownerId===bot.id){this.ctx.world.damage(g.primitive==="shutter"?g.id.slice(6):g.id,100000,now,true);this.gadgets.delete(key);}botState.characterId=previous.id;botState.maxHp=previous.maxHp;botState.charges[0]=Math.min(botState.charges[0],previous.signature.charges);this.ctx.respawn(bot,now,pgCharacterDefaultLoadout(previous),{...bot.position});bot.hp=Math.min(bot.hp,previous.maxHp);bot.protectedUntil=this.deadline;}s.characterId=op.id;s.maxHp=op.maxHp;s.charges[0]=op.signature.charges;this.ctx.respawn(p,now,loadout,{...p.position});p.hp=op.maxHp;p.protectedUntil=this.deadline;return ok();
  }
  if(a.kind==="camera")return this.cameraAction(p,s,a.cameraId,now);
  if(a.kind==="drone")return this.droneAction(p,s,a,now);
  if(s.life!=="alive"||p.hp<=0||!["prepare","action"].includes(this.subphase))return error("No active operator.");
  if(a.kind==="deploy")return this.reinforce(p,s,a.socketId,now);
  if(a.kind==="interact"){
   if(!a.held){s.interaction=null;return ok();}
   const panel=this.ctx.world.snapshot().panels.find(x=>x.id===a.targetId),socket=PG_PANEL_SOCKETS.find(x=>x.id===a.targetId);if(!panel||!socket||dist(p.position,socket.solid.center)>3)return error("Move near a panel.");
   if(s.characterId==="brace"&&this.gadgets.get(`panel-${socket.id}`)?.ownerId===p.id){if((this.gadgets.get(`panel-${socket.id}`)?.disabledUntil??0)>now)return error("Shutter is disabled.");if(now<(this.toggles.get(p.id)??0))return error("Shutter is cycling.");this.toggles.set(p.id,now+1500);const snapshot=this.ctx.world.snapshot();const part=snapshot.panels.find(v=>v.id===panel.id)!;part.active=!part.active;part.revision=snapshot.revision+1;this.ctx.world.reset(snapshot.panels,now);return ok();}
   const c=this.common.get(p.id)!;if(s.side!=="defend"||c.repairs<=0||!panel.active)return error("Cannot repair this panel.");if(panel.hp>=panel.maxHp)return error("Panel is already fully repaired.");c.repairs--;this.ctx.world.repair(panel.id,100,now);const part=this.ctx.world.snapshot().panels.find(v=>v.id===panel.id)!;const gadget=this.gadgets.get(`panel-${socket.id}`);if(gadget){gadget.hp=part.hp;gadget.maxHp=part.maxHp;}return ok();
  }
  if(a.kind!=="ability")return error("This operation has no purchase economy.");
  if(a.slot===2){const drone=this.scouts.get(`drone-${p.id}`);if(!drone)return error("No available scout drone.");return this.droneAction(p,s,{kind:"drone",sequence:a.sequence,lifeId:a.lifeId,control:!this.controlling(p.id),moveX:0,moveZ:0,yaw:p.yaw,pitch:0},now);}
  if(a.slot===1)return this.commonAbility(p,s,a,now);
  return this.signature(p,s,a,now);
 }
 private reinforce(p:PgPlayer,s:PgSiegePilot,id:string,now:number){const socket=PG_PANEL_SOCKETS.find(x=>x.id===id);if(s.side!=="defend"||this.subphase!=="prepare"||!socket||dist(p.position,socket.solid.center)>3||s.reinforcements<=0)return error("Reinforce a nearby socket during preparation.");if(!this.ctx.world.reinforce(id,now))return error("Place an ordinary barricade first.");s.reinforcements--;return ok();}
 private commonAbility(p:PgPlayer,s:PgSiegePilot,a:Extract<PgModeAction,{kind:"ability"}>,now:number){const common=this.common.get(p.id)!,socket=this.nearestSocket(p,a.targetId);if(!socket)return error("Target a nearby panel socket.");
  if(s.side==="attack"){if(this.subphase!=="action"||common.breaches<=0)return error("No breach charge.");const panel=this.ctx.world.snapshot().panels.find(x=>x.id===socket.id&&x.active);if(!panel||panel.reinforced)return error("Common charges cannot breach reinforced panels.");common.breaches--;s.charges[1]=common.breaches;this.pendingBreaches.push({id:socket.id,ownerId:p.id,at:now+1800,reinforced:false});this.warning(p,socket.solid.center,now,1800);return ok();}
  if(common.barricades<=0)return error("No barricades remain.");if(!this.placePanel(socket.id,100,false,p,now))return error("Keep another approach open and clear the opening.");common.barricades--;s.charges[1]=common.barricades;return ok();
 }
 private nearestSocket(p:PgPlayer,id?:string){return PG_PANEL_SOCKETS.filter(x=>!id||x.id===id||x.solid.id===id).filter(x=>dist(p.position,x.solid.center)<=3).sort((a,b)=>dist(p.position,a.solid.center)-dist(p.position,b.solid.center))[0];}
 private placePanel(id:string,hp:number,reinforced:boolean,p:PgPlayer,now:number){const socket=PG_PANEL_SOCKETS.find(x=>x.id===id);if(!socket)return false;const snapshot=this.ctx.world.snapshot();if(snapshot.panels.some(x=>x.id===id&&x.active)||snapshot.panels.some(x=>x.active&&PG_PANEL_SOCKETS.find(t=>t.id===x.id)?.compound===socket.compound))return false;
  if([...this.ctx.players.values()].some(v=>v.hp>0&&Math.abs(v.position.x-socket.solid.center.x)<socket.solid.half.x+.5&&Math.abs(v.position.z-socket.solid.center.z)<socket.solid.half.z+.5))return false;
  const panel={id,solid:structuredClone(socket.solid),hp,maxHp:hp,active:true,reinforced,revision:snapshot.revision+1};const index=snapshot.panels.findIndex(x=>x.id===id);if(index>=0)snapshot.panels[index]=panel;else snapshot.panels.push(panel);this.ctx.world.reset(snapshot.panels,now);return true;
 }
 private warning(p:PgPlayer,position:Vec3,now:number,delay:number){const id=`warning-${++this.serial}`;this.gadgets.set(id,{id,primitive:"warning",kind:"breach",ownerId:p.id,team:p.team,position:{...position},radius:2,startsAt:now,endsAt:now+delay,hp:1,maxHp:1,disabledUntil:0,pool:0,nextPulse:0,direction:{x:0,y:0,z:0}});}
 private signature(p:PgPlayer,s:PgSiegePilot,a:Extract<PgModeAction,{kind:"ability"}>,now:number):PgModeActionResult{
  const op=pgResolveOperator(s.characterId);if(!op||s.charges[0]<=0)return error("No signature charges remain.");const def=op.signature;
  if(s.side==="attack"&&this.subphase!=="action")return error("Scout with your drone during preparation.");
  const target=a.targetId?this.ctx.players.get(a.targetId):undefined;
  if(def.primitive==="heal"){if(!target||target.hp<=0||target.team!==p.team||dist(p.position,target.position)>def.range||!this.visible(eye(p.position),eye(target.position)))return error("Choose a visible living teammate.");const gain=Math.min(this.maxHp(target)-target.hp,def.effect.healing??45);if(gain<=0)return error("Target is healthy.");target.hp+=gain;s.contribution+=gain;s.charges[0]--;return ok();}
  if(def.primitive==="breach"){const socket=this.nearestSocket(p,a.targetId);if(!socket||!this.ctx.world.snapshot().panels.some(x=>x.id===socket.id&&x.active))return error("Approach an authored panel.");s.charges[0]--;this.pendingBreaches.push({id:socket.id,ownerId:p.id,at:now+def.warningMs,reinforced:true});this.warning(p,socket.solid.center,now,def.warningMs);return ok();}
  if(def.primitive==="shutter"){const socket=this.nearestSocket(p,a.targetId);if(!socket||!this.placePanel(socket.id,def.deployableHp,false,p,now))return error("Keep a clear alternative approach.");s.charges[0]--;const id=`panel-${socket.id}`;this.gadgets.set(id,{id,primitive:"shutter",kind:"shield",ownerId:p.id,team:p.team,position:{...socket.solid.center},radius:1,startsAt:now,endsAt:now+185000,hp:def.deployableHp,maxHp:def.deployableHp,disabledUntil:0,pool:0,nextPulse:0,direction:{x:0,y:0,z:0}});return ok();}
  const position=a.position??{x:p.position.x-Math.sin(p.yaw)*2,y:p.position.y,z:p.position.z-Math.cos(p.yaw)*2};
  if(![position.x,position.y,position.z].every(Number.isFinite)||dist(p.position,position)>def.range||Math.abs(position.y-p.position.y)>1||!this.ctx.world.visible(eye(p.position),{...position,y:position.y+.3})||!pgCapsuleClear(position,.6,this.ctx.world.map))return error("Choose a clear reachable deployment.");
  if(def.effect.requiresWall){const dir={x:-Math.sin(p.yaw),y:0,z:-Math.cos(p.yaw)};if(!PG_MAP.solids.some(b=>{const t=pgRayBox(eye(position),dir,b);return t!==null&&t<2;}))return error("Aim at an adjacent wall for this sensor.");}
  if(def.primitive==="trip-line"){const length=dist(p.position,position);if(length<.75||length>(def.effect.maxLineLength??6)||!this.ctx.world.visible({...p.position,y:p.position.y+.25},{...position,y:position.y+.25}))return error("Choose a clear line between 0.75 and 6 metres.");for(let n=0;n<=Math.ceil(length/.25);n++){const t=n/Math.ceil(length/.25),point={x:p.position.x+(position.x-p.position.x)*t,y:p.position.y+(position.y-p.position.y)*t,z:p.position.z+(position.z-p.position.z)*t};if(!pgCapsuleClear(point,.45,this.ctx.world.map))return error("Trip lines cannot cross solid cover.");}}
  let colliderId:string|undefined;
  if(def.primitive==="barrier"){
   const id=`cover-${++this.serial}`,solid={id,kind:"structure" as const,center:{...position,y:position.y+.5},half:{x:1,y:.5,z:.175},mantle:true};if([...this.ctx.players.values()].some(v=>dist(v.position,position)<1.6))return error("Clear the cover footprint.");colliderId=id;this.ctx.world.add({id,solid,hp:300,maxHp:300,reinforced:false,active:true,revision:this.ctx.world.revision+1},now);
  }
  s.charges[0]--;const id=colliderId??`gadget-${++this.serial}`,kind:PgModeEffect["kind"]=def.primitive==="smoke"?"smoke":def.primitive==="floor-strip"?"electric":def.primitive==="trip-line"?"trip":def.primitive==="beacon"?"heal":def.primitive==="emp"?"breach":def.primitive==="barrier"?"shield":def.primitive==="jammer"?"jammer":"sensor";
  this.gadgets.set(id,{id,kind,primitive:def.primitive,ownerId:p.id,team:p.team,position:{...(def.primitive==="trip-line"?p.position:position)},...(def.primitive==="trip-line"?{end:{...position},previousPositions:new Map([...this.ctx.players].map(([id,p])=>[id,{...p.position}]))}:{}),radius:def.primitive==="trip-line"?.12:def.radius||2,startsAt:now+def.warningMs,endsAt:now+def.warningMs+(def.durationMs||1500),hp:def.deployableHp||1,maxHp:def.deployableHp||1,disabledUntil:0,pool:def.effect.healingPool??300,nextPulse:now,direction:{x:-Math.sin(p.yaw),y:0,z:-Math.cos(p.yaw)}});return ok();
 }
 private cameraAction(p:PgPlayer,s:PgSiegePilot,id:string|null,now:number){
  if(id===null){s.cameraId=null;return ok();}const camera=PG_SIEGE_CAMERAS.find(c=>c.id===id);
  if(s.side!=="defend"||!camera||!this.cameraValid(p.team,camera,now))return error("Camera unavailable.");s.cameraId=id;return ok();
 }
 private droneAction(p:PgPlayer,s:PgSiegePilot,a:Extract<PgModeAction,{kind:"drone"}>,now:number){
  const drone=this.scouts.get(s.droneId??"");if(s.side!=="attack"||!drone||drone.hp<=0)return error("Drone unavailable.");
  if(!a.control){drone.input.at=Number.NEGATIVE_INFINITY;s.controllingDrone=false;return ok();}if(![a.moveX,a.moveZ,a.yaw,a.pitch].every(Number.isFinite)||Math.abs(a.moveX)>1||Math.abs(a.moveZ)>1||Math.abs(a.pitch)>1.45)return error("Invalid drone input.");
  if(drone.disabledUntil>now)return error("Drone is jammed.");s.cameraId=null;s.controllingDrone=true;drone.input={x:a.moveX,z:a.moveZ,at:now};drone.yaw=Math.atan2(Math.sin(a.yaw),Math.cos(a.yaw));drone.pitch=a.pitch;return ok();
 }
 private stepDrone(d:Scout,dt:number,now:number){
  if(d.hp<=0)return;
  if([...this.gadgets.values()].some(g=>g.primitive==="jammer"&&g.team!==this.ctx.players.get(d.ownerId)?.team&&g.hp>0&&g.disabledUntil<=now&&dist(g.position,d.position)<g.radius))d.disabledUntil=now+500;
  if(now>d.input.at+500||d.disabledUntil>now)return;
  const c=Math.cos(d.yaw),s=Math.sin(d.yaw),n=Math.max(1,Math.hypot(d.input.x,d.input.z)),dx=(d.input.x*c+d.input.z*s)/n*4*dt,dz=(-d.input.x*s+d.input.z*c)/n*4*dt;
  for(const [axis,delta]of [["x",dx],["z",dz]]as const){const point={...d.position,[axis]:d.position[axis]+delta};if(Math.abs(point.x)<45&&Math.abs(point.z)<37&&pgCapsuleClear(point,.45,this.ctx.world.map))d.position=point;}
  const owner=this.ctx.players.get(d.ownerId);if(owner&&this.sensorValid(owner.team,d.position,now))this.scan(owner.team,d.position,d.yaw,14,now,false,.25);
 }
 private sensorValid(team:PgTeam,position:Vec3,now:number){return ![...this.gadgets.values()].some(g=>g.team!==team&&g.primitive==="jammer"&&g.hp>0&&g.disabledUntil<=now&&dist(position,g.position)<g.radius);}
 private scan(team:PgTeam,position:Vec3,yaw:number,range:number,now:number,movementOnly=false,originHeight=1.3,pitch?:number){
  if(!this.sensorValid(team,position,now))return;const list=this.intel.get(team)!;
  for(const p of this.ctx.players.values()){if(movementOnly&&Math.hypot(p.velocity.x,p.velocity.z)<.1)continue;if(p.team===team||p.hp<=0||!this.sensorValid(team,p.position,now)||dist(position,p.position)>range||!this.visible({...position,y:position.y+originHeight},eye(p.position)))continue;const dx=p.position.x-position.x,dz=p.position.z-position.z,n=Math.max(.01,Math.hypot(dx,dz));if((-Math.sin(yaw)*dx-Math.cos(yaw)*dz)/n<.65||pitch!==undefined&&Math.abs(Math.atan2(p.position.y+1.3-position.y-originHeight,n)-pitch)>35*Math.PI/180)continue;const intel={targetId:p.id,position:{...p.position},at:now,expiresAt:now+1500},index=list.findIndex(i=>i.targetId===p.id);if(index>=0)list[index]=intel;else list.push(intel);}
 }
 private stepGadget(g:Gadget,dt:number,now:number){
  if(g.hp<=0||now<g.startsAt||now>=g.endsAt||now<g.disabledUntil)return;
  if(g.primitive==="emp"&&now>=g.nextPulse){g.nextPulse=Number.MAX_SAFE_INTEGER;for(const camera of PG_SIEGE_CAMERAS)if(dist(g.position,camera.position)<=g.radius&&this.ctx.world.visible(eye(g.position),camera.position))this.camerasDisabledUntil.set(camera.id,now+6000);for(const target of this.gadgets.values())if(target.team!==g.team&&["jammer","sensor","trip-line","beacon","floor-strip","shutter"].includes(target.primitive)&&dist(g.position,target.position)<=g.radius&&this.ctx.world.visible(eye(g.position),eye(target.position)))target.disabledUntil=now+6000;for(const drone of this.scouts.values())if(this.ctx.players.get(drone.ownerId)?.team!==g.team&&dist(g.position,drone.position)<=g.radius&&this.ctx.world.visible(eye(g.position),eye(drone.position)))drone.disabledUntil=now+6000;}
  if(g.primitive==="sensor"&&now>=g.nextPulse){const op=pgResolveOperator(this.pilots.get(g.ownerId)?.characterId);g.nextPulse=now+(op?.signature.effect.pulseIntervalMs??1200);this.scan(g.team,g.position,Math.atan2(-g.direction.x,-g.direction.z),g.radius,now,!!op?.signature.effect.movementOnly);}
  let healingBudget=24*dt;
  for(const p of this.ctx.players.values()){
   const previous=g.previousPositions?.get(p.id)??p.position;g.previousPositions?.set(p.id,{...p.position});
   const touching=g.primitive==="trip-line"&&g.end?Math.abs(p.position.y-g.position.y)<1&&crossesLine(previous,p.position,g.position,g.end,g.radius+.4):dist(p.position,g.position)<=g.radius;
   if(p.hp<=0||!touching||!this.ctx.world.visible({...g.position,y:g.position.y+.25},eye(p.position)))continue;
   if(g.primitive==="beacon"&&p.team===g.team&&g.pool>0){const gain=Math.min(this.maxHp(p)-p.hp,12*dt,g.pool,healingBudget);if(gain>0){p.hp+=gain;g.pool-=gain;healingBudget-=gain;this.pilots.get(g.ownerId)!.contribution+=gain;}}
   if(p.team===g.team)continue;
   if(g.primitive==="floor-strip"){this.slowed.set(p.id,now+600);const inflicted=g.damageByTarget??=new Map<string,number>();const amount=Math.min(8*dt,Math.max(0,32-(inflicted.get(p.id)??0)));if(amount>0){const dealt=this.ctx.damage(p,this.ctx.players.get(g.ownerId)??null,amount,now);inflicted.set(p.id,(inflicted.get(p.id)??0)+dealt);}}
   if(g.primitive==="trip-line"&&g.pool>0){g.pool=0;g.hp=0;this.slowed.set(p.id,now+1500);this.intel.get(g.team)!.push({targetId:p.id,position:{...p.position},at:now,expiresAt:now+2000});}
  }
 }
 visible(from:Vec3,to:Vec3){if(!this.ctx.world.visible(from,to))return false;const delta={x:to.x-from.x,y:to.y-from.y,z:to.z-from.z},length=Math.hypot(delta.x,delta.y,delta.z);if(length<.001)return true;for(const g of this.gadgets.values()){if(g.primitive!=="smoke"||g.hp<=0||this.now<g.startsAt||this.now>=g.endsAt)continue;const t=Math.max(0,Math.min(1,((g.position.x-from.x)*delta.x+(g.position.y+1-from.y)*delta.y+(g.position.z-from.z)*delta.z)/(length*length)));if(dist({x:from.x+delta.x*t,y:from.y+delta.y*t,z:from.z+delta.z*t},{...g.position,y:g.position.y+1})<g.radius)return false;}return true;}
 targets(shooter:PgPlayer):PgModeTarget[]{
  const targets:PgModeTarget[]=[];
  if(this.pilots.get(shooter.id)?.side==="attack")for(const camera of PG_SIEGE_CAMERAS){
   const hp=this.cameraHealth.get(camera.id)??0;if(hp<=0)continue;
   const dx=camera.target.x-camera.position.x,dy=camera.target.y-camera.position.y,dz=camera.target.z-camera.position.z,length=Math.hypot(dx,dy,dz);
   targets.push({id:camera.id,kind:"gadget",position:{x:camera.position.x-dx/length*.3,y:camera.position.y-dy/length*.3,z:camera.position.z-dz/length*.3},half:{x:.4,y:.22,z:.4},damage:amount=>{
    if(!Number.isFinite(amount)||amount<=0)return 0;const damage=Math.min(this.cameraHealth.get(camera.id)??0,amount);this.cameraHealth.set(camera.id,(this.cameraHealth.get(camera.id)??0)-damage);return damage;
   }});
  }
  for(const g of this.gadgets.values())if(g.hp>1&&g.team!==shooter.team)targets.push({id:g.id,kind:"gadget",position:{...g.position,y:g.position.y+.4},half:{x:.35,y:.4,z:.35},damage:(amount,_who,now)=>{if(!Number.isFinite(amount)||amount<=0)return 0;const snapshot=this.ctx.world.snapshot(),panel=snapshot.panels.find(p=>p.id===(g.primitive==="shutter"?g.id.slice(6):g.id));if(panel&&(g.primitive==="shutter"||g.primitive==="barrier")){const n=this.ctx.world.damage(panel.id,amount,now),current=this.ctx.world.snapshot().panels.find(p=>p.id===panel.id)!;g.hp=current.hp;g.maxHp=current.maxHp;return n;}const n=Math.min(g.hp,amount);g.hp-=n;return n;}});
  for(const g of this.gadgets.values())if(g.end&&g.hp>1&&g.team!==shooter.team){const start=targets.find(t=>t.id===g.id);if(start)targets.push({...start,id:`${g.id}-end`,position:{...g.end,y:g.end.y+.4}});}
  for(const drone of this.scouts.values())if(drone.hp>0&&this.ctx.players.get(drone.ownerId)?.team!==shooter.team)targets.push({id:drone.id,kind:"gadget",position:{...drone.position,y:drone.position.y+.2},half:{x:.3,y:.2,z:.3},damage:amount=>{const n=Math.min(drone.hp,amount);drone.hp-=n;return n;}});return targets;
 }
 botCombatArea(p:PgPlayer){const point=PG_OBJECTIVES.uplink[this.site];return dist(p.position,point.position)<=point.radius?point:null;}
 botGoal(p:PgPlayer,now:number):Vec3|null{
  const s=this.pilots.get(p.id);if(!s||s.life!=="alive")return null;const point=PG_OBJECTIVES.uplink[this.site].position;
  if(this.subphase==="prepare"){
   if(s.side!=="defend")return null;
   const compound=this.site===0?"west":"east",sockets=PG_PANEL_SOCKETS.filter(t=>t.compound===compound),roster=[...this.ctx.players.values()].filter(other=>other.team===p.team),number=Math.max(0,roster.indexOf(p)),socket=sockets[number%sockets.length];
   const inside=socket.approaches.reduce((a,b)=>dist(a,point)<dist(b,point)?a:b),offset=Math.floor(number/sockets.length)-1,alongX=socket.solid.half.x>socket.solid.half.z;
   const staging={...inside,x:inside.x+(alongX?offset:0),z:inside.z+(alongX?0:offset)};
   return pgCapsuleClear(staging,1.95,this.ctx.world.map)?staging:{...inside};
  }
  if(s.side==="defend")return p.isBot?this.defenseGoal(p,now):null;
  if(s.side==="attack"){
   // Once inside the public capture area, keep the secured objective rather
   // than abandoning it for an unrelated panel at another compound entrance.
   if(dist(p.position,point)<=PG_OBJECTIVES.uplink[this.site].radius)return this.captureGoal(p);
   // Commit an operator arriving at a usable breach to the compound, instead
   // of spending the approach seeking another unrelated exterior panel.
   const panels=this.ctx.world.snapshot().panels,sockets=PG_PANEL_SOCKETS.filter(socket=>socket.compound===(this.site===0?"west":"east"));
   // Intent survives ordinary corner contacts; botWaypoint owns physical
   // route/topology validation on every subsequent navigation update.
   if(this.assaultCommits.has(p.id))return this.captureGoal(p);
   const entering=sockets.some(socket=>!panels.some(panel=>panel.id===socket.id&&panel.active)&&socket.approaches.some(at=>dist(at,p.position)<3.5));
   if(entering){
    const navigation=this.defenseNavigation??=new PgZombieNavigation(this.ctx.world.map,{groundLevelOnly:true});navigation.update(this.ctx.world.map,this.ctx.world.revision);
    if(navigation.reachable(p.position,point)){this.assaultCommits.add(p.id);return this.captureGoal(p);}
    this.assaultCommits.delete(p.id);
   }
   const panel=panels.filter(x=>x.active&&(!x.reinforced||(s.characterId==="rivet"&&s.charges[0]>0))).filter(x=>PG_PANEL_SOCKETS.some(t=>t.id===x.id&&t.compound===(this.site===0?"west":"east"))).sort((a,b)=>dist(p.position,a.solid.center)-dist(p.position,b.solid.center))[0];
   if(panel&&(this.common.get(p.id)!.breaches>0||s.characterId==="rivet"&&s.charges[0]>0)){const socket=PG_PANEL_SOCKETS.find(t=>t.id===panel.id)!;return socket.approaches.reduce((a,b)=>dist(a,point)>dist(b,point)?a:b);}
  }
  // An operator without a usable breach keeps the objective. Physical walking
  // routes find the alternative opening instead of holding that closed doorway.
  return this.captureGoal(p);
 }
 botWaypoint(p:PgPlayer,goal:Vec3|null):Vec3|null {
  if(!goal||!this.canMove(p))return null;
  const world=this.ctx.world;let cached=this.botSteering.get(p.id);
  const navigation=this.defenseNavigation??=new PgZombieNavigation(world.map,{groundLevelOnly:true});navigation.update(world.map,world.revision);
  if(cached&&cached.revision===world.revision&&dist(cached.goal,goal)<.05){
   while(cached.path.length>1&&dist(p.position,cached.path[0])<.25&&navigation.connects(p.position,cached.path[1]))cached.path.shift();
   // Retain physical corners through the whole corridor. Repeated nearest-node
   // selection on a first stair tread sends the body back and forth forever.
   if(cached.path.length||this.now<cached.reconsiderAt)return cached.path[0]?{...cached.path[0]}:null;
  }
  // Tactical objectives stay on supported walk corridors. Generic graph
  // traversal can otherwise cut across a stair flight toward a ground slot.
  const first=navigation.destination(p.position,goal),path:Vec3[]=[];
  if(first===goal)path.push({...goal});
  else if(first){
   // Keep the complete-route connector already validated by destination().
   const start=navigation.nearest(first),end=navigation.nearest(goal);
   if(start!==null&&end!==null){
    const field=navigation.field(end);let current=start;path.push({...world.map.navigation[current].position});
    for(let step=0;current!==end&&step<world.map.navigation.length;step++){
     const next=field.get(current);if(next===undefined||next===current){path.length=0;break;}
     current=next;path.push({...world.map.navigation[current].position});
    }
    if(path.length)path.push({...goal});
   }
  }
  cached={revision:world.revision,goal:{...goal},path,reconsiderAt:this.now+170};this.botSteering.set(p.id,cached);
  while(path.length>1&&dist(p.position,path[0])<.25&&navigation.connects(p.position,path[1]))path.shift();
  return path[0]?{...path[0]}:null;
 }
 /** Validate authored posts only when physical topology changes, never against hidden enemies. */
 private prepareDefensePosts(){
  const world=this.ctx.world,objective=PG_OBJECTIVES.uplink[this.site],point=objective.position;
  if(this.defensePosts?.revision===world.revision&&this.defensePosts.site===this.site)return this.defensePosts;
  const map=world.map,nodes=map.navigation.filter(n=>Math.abs(n.position.y)<.01&&pgCapsuleClear(n.position,1.95,map));
  const connector=(a:Vec3,b:Vec3)=>{
   const length=dist(a,b);if(length<.01)return true;
   const direction={x:(b.x-a.x)/length,y:0,z:(b.z-a.z)/length};
   return !map.solids.some(s=>[.1,.95,1.9].some(y=>{const hit=pgRayBox({...a,y:a.y+y},direction,{...s,half:{x:s.half.x+.43,y:s.half.y,z:s.half.z+.43}});return hit!==null&&hit<length-.05;}));
  };
  const seed=[...nodes].sort((a,b)=>dist(a.position,point)-dist(b.position,point))[0];
  const connected=new Set<number>(),queue=seed?[seed.id]:[];
  for(let i=0;i<queue.length;i++){
   const id=queue[i];if(connected.has(id))continue;connected.add(id);
   for(const link of map.navigation[id].links)if(link.kind==="walk"&&Math.abs(map.navigation[link.to]?.position.y??1)<.01&&!connected.has(link.to))queue.push(link.to);
  }
  const valid=(candidate:Vec3)=>pgCapsuleClear(candidate,1.95,map)&&nodes.some(n=>connected.has(n.id)&&connector(candidate,n.position));
  const sockets=PG_PANEL_SOCKETS.filter(socket=>socket.compound===(this.site===0?"west":"east"));
  const inside=sockets.map(socket=>socket.approaches.reduce((a,b)=>dist(a,point)<dist(b,point)?a:b));
  const authored=this.site===0?[{x:-28,y:0,z:-10.2},{x:-28,y:0,z:-15},{x:-22,y:0,z:-7}]:[{x:28,y:0,z:13.8},{x:26,y:0,z:9},{x:32,y:0,z:19}];
  const posts:(Vec3|null)[]=[],used:Vec3[]=[];
  for(const [index,preferred]of [...authored,...inside].entries()){
   const offsets=[[0,0],[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[2,0],[-2,0],[0,2],[0,-2]];
   const candidates=offsets.map(([x,z])=>({...preferred,x:preferred.x+x,z:preferred.z+z}));
   const post=candidates.find(candidate=>(index===0?dist(candidate,point)<objective.radius-.6:dist(candidate,point)>objective.radius+.3)&&used.every(other=>dist(candidate,other)>1)&&valid(candidate))??null;
   posts.push(post);if(post)used.push(post);
  }
  const patrol=sockets.map(socket=>socket.approaches.reduce((a,b)=>dist(a,point)>dist(b,point)?a:b)).filter(valid);
  const navigation=this.defenseNavigation??=new PgZombieNavigation(map);navigation.update(map,world.revision);
  // The mobile role circulates around real exterior cover rather than merely
  // shuttling between the two doorway lips. Covered backs are transit points;
  // arrival, not elapsed time, advances the patrol.
  const outer=this.site===0?[{x:-31,y:0,z:13},{x:-27,y:0,z:16},{x:-23,y:0,z:13},{x:-25,y:0,z:3}]:[{x:21,y:0,z:7},{x:23,y:0,z:0},{x:37,y:0,z:-1},{x:38,y:0,z:15}];
  const route=[...outer,...patrol].filter(candidate=>valid(candidate)&&navigation.supported(candidate)&&navigation.reachable(point,candidate));
  this.defensePosts={revision:world.revision,site:this.site,posts,patrol:route};return this.defensePosts;
 }
 /** Bounded sensing-time route estimate follows walk corridors, including closed-door detours. */
 private retakeRoute(from:Vec3,to:Vec3):{distance:number;entry:string|null} {
  const navigation=this.defenseNavigation!,map=this.ctx.world.map;
  if(!navigation.reachable(from,to))return {distance:Infinity,entry:null};
  const path:Vec3[]=[from];
  const first=navigation.destination(from,to);
  if(first!==to){
   if(!first)return {distance:Infinity,entry:null};
   const start=navigation.nearest(first),goal=navigation.nearest(to);
   if(start===null||goal===null)return {distance:Infinity,entry:null};
   const field=navigation.field(goal);let current=start;path.push(map.navigation[current].position);
   for(let step=0;current!==goal&&step<map.navigation.length;step++){
    const next=field.get(current);if(next===undefined||next===current)return {distance:Infinity,entry:null};
    current=next;path.push(map.navigation[current].position);
   }
   if(current!==goal)return {distance:Infinity,entry:null};
  }
  path.push(to);let distance=0,entry:string|null=null;
  const sockets=PG_PANEL_SOCKETS.filter(socket=>socket.compound===(this.site===0?"west":"east"));
  for(let i=1;i<path.length;i++){
   distance+=dist(path[i-1],path[i]);
   for(const socket of sockets){
    // Only a route crossing the actual doorway plane has an entrance identity.
    const axis=socket.solid.half.x<socket.solid.half.z?"x":"z",other=axis==="x"?"z":"x",a=path[i-1],b=path[i],delta=b[axis]-a[axis];
    if(Math.abs(delta)<.0001)continue;
    const t=(socket.solid.center[axis]-a[axis])/delta;
    if(t>=0&&t<=1&&Math.abs(a[other]+(b[other]-a[other])*t-socket.solid.center[other])<=socket.solid.half[other]+.45)entry=socket.id;
   }
  }
  return {distance,entry};
 }
 private defenseGoal(p:PgPlayer,now:number):Vec3 {
  // Humans retain their own input; eliminated bot slots do not reshuffle surviving posts.
  const roster=[...this.ctx.players.values()].filter(other=>other.team===p.team&&other.isBot),index=Math.max(0,roster.indexOf(p)),plan=this.prepareDefensePosts();
  const living=roster.filter(other=>other.hp>0&&this.pilots.get(other.id)?.life==="alive");
  if(now>=this.defenseNextSense){
   this.defenseNextSense=now+300;
   this.retakers=this.retakers.filter(id=>living.some(other=>other.id===id));
   if(this.capture>0){
    this.defenseResetAt=null;
    if(this.retakers.length<2&&(this.capture>this.defenseLastCapture||this.retakers.length)){
     const point=PG_OBJECTIVES.uplink[this.site].position;
     const available=living.filter(other=>other!==roster[0]&&!this.retakers.includes(other.id)).map(player=>({player,...this.retakeRoute(player.position,point)})).filter(route=>Number.isFinite(route.distance)).sort((a,b)=>a.distance-b.distance);
     while(this.retakers.length<2&&available.length){
      const prior=this.retakers.map(id=>this.ctx.players.get(id)).filter((other):other is PgPlayer=>!!other).map(other=>this.retakeRoute(other.position,point).entry);
      const nearest=available[0],separate=available.findIndex(route=>route.entry!==null&&!prior.includes(route.entry)&&route.distance<=nearest.distance*1.5+8);
      const chosen=available.splice(prior.some(entry=>entry!==null)&&separate>=0?separate:0,1)[0];
      this.retakers.push(chosen.player.id);
     }
    }
   }else if(this.retakers.length){
    this.defenseResetAt??=now;
    if(now-this.defenseResetAt>=2000){this.retakers=[];this.defenseResetAt=null;}
   }
   this.defenseLastCapture=this.capture;
  }
  const retake=this.retakers.indexOf(p.id);
  if(retake>=0){
   // Reuse the ordinary capsule-clear capture-slot cache, assigning retakers distinct slots.
   this.captureGoal(p);
   const points=this.captureGoals!.points,core=plan.posts[0];
   const slots=points.filter(candidate=>!core||dist(candidate,core)>1);
   return {...(slots[retake]??points[retake]??p.position)};
  }
  if(index>=5&&plan.patrol.length){
   let waypoint=(this.defensePatrol.get(p.id)??0)%plan.patrol.length;
   if(dist(p.position,plan.patrol[waypoint])<.8&&plan.patrol.length>1)waypoint=(waypoint+1)%plan.patrol.length;
   this.defensePatrol.set(p.id,waypoint);return {...plan.patrol[waypoint]};
  }
  const post=plan.posts[Math.min(index,4)];
  if(post)return {...post};
  // Newly deployed cover may occupy an authored post. Prefer a validated spare
  // outside capture rather than crowding the core or ordering a blocked position.
  return {...(plan.posts.find((candidate,i)=>i>0&&candidate)||plan.patrol[0]||p.position)};
 }
 private captureGoal(p:PgPlayer):Vec3 {
  const objective=PG_OBJECTIVES.uplink[this.site],point=objective.position,world=this.ctx.world;
  if(this.captureGoals?.revision!==world.revision||this.captureGoals.site!==this.site){
   const offsets:[number,number][]=[];
   for(const z of [-1.2,1.2])for(const x of [-1.4,0,1.4])offsets.push([x,z]);
   for(const z of [-2.4,0,2.4])for(const x of [-2.8,-1.4,0,1.4,2.8])offsets.push([x,z]);
   const points:Vec3[]=[];
   for(const [x,z]of offsets){const candidate={x:point.x+x,y:point.y,z:point.z+z};
    if(dist(candidate,point)<=objective.radius&&pgCapsuleClear(candidate,1.95,world.map)&&world.visible(eye(point),eye(candidate))&&points.every(other=>dist(candidate,other)>.9))points.push(candidate);
   }
   this.captureGoals={revision:world.revision,site:this.site,points};
  }
  // Stable team-relative slots do not change when a teammate is eliminated.
  const roster=[...this.ctx.players.values()].filter(other=>other.team===p.team),index=Math.max(0,roster.indexOf(p));
  return {...(this.captureGoals.points[index%this.captureGoals.points.length]??p.position)};
 }
 /** Utility decisions use public geometry and current sight, never unseen opponents. */
 private attackerUtility(p:PgPlayer,s:PgSiegePilot,now:number){
  const def=pgResolveOperator(s.characterId)?.signature;if(!def||s.charges[0]<=0)return;
  const world=this.ctx.world,point=PG_OBJECTIVES.uplink[this.site].position;
  const deploy=(position:Vec3)=>this.signature(p,s,{kind:"ability",slot:0,position,sequence:0,lifeId:p.lifeId},now);
  const clear=(position:Vec3)=>pgCapsuleClear(position,.6,world.map)&&world.visible(eye(p.position),{...position,y:position.y+.3});
  if(def.primitive==="emp"){
   const hardware:Vec3[]=[];
   for(const camera of PG_SIEGE_CAMERAS)if((this.cameraHealth.get(camera.id)??0)>0&&(this.camerasDisabledUntil.get(camera.id)??0)<=now&&this.visible(eye(p.position),camera.position))hardware.push(camera.position);
   for(const g of this.gadgets.values())if(g.team!==p.team&&g.hp>0&&g.disabledUntil<=now&&["jammer","sensor","trip-line","beacon","floor-strip","shutter"].includes(g.primitive)&&this.visible(eye(p.position),eye(g.position)))hardware.push(eye(g.position));
   for(const target of hardware.sort((a,b)=>dist(p.position,a)-dist(p.position,b))){
    const position={x:target.x,y:p.position.y,z:target.z};
    if(dist(p.position,position)>def.range||dist(position,target)>def.radius||!clear(position)||!world.visible(eye(position),target))continue;
    if([...this.gadgets.values()].some(g=>g.primitive==="emp"&&g.team===p.team&&g.endsAt>now&&dist(g.position,target)<=g.radius))continue;
    if(deploy(position).ok)return;
   }
   return;
  }
  if(def.primitive==="sensor"){
   // A dart must survey the compound, rather than the empty launch area behind it.
   if(dist(p.position,point)>def.radius)return;
   const position={x:p.position.x-Math.sin(p.yaw)*2,y:p.position.y,z:p.position.z-Math.cos(p.yaw)*2};
   const dx=point.x-position.x,dz=point.z-position.z,length=Math.hypot(dx,dz);
   if(length>def.radius||(-Math.sin(p.yaw)*dx-Math.cos(p.yaw)*dz)/Math.max(.01,length)<.65||!clear(position))return;
   if([...this.gadgets.values()].some(g=>g.ownerId===p.id&&g.primitive==="sensor"&&g.hp>0&&g.endsAt>now&&dist(g.position,position)<def.radius/2))return;
   deploy(position);return;
  }
  if(def.primitive==="barrier"){
   const threat=[...this.ctx.players.values()].filter(other=>other.team!==p.team&&other.hp>0&&dist(p.position,other.position)<22&&this.visible(eye(p.position),eye(other.position))).sort((a,b)=>dist(p.position,a.position)-dist(p.position,b.position))[0];
   if(!threat||dist(p.position,point)>22)return;
   const dx=threat.position.x-p.position.x,dz=threat.position.z-p.position.z,length=Math.hypot(dx,dz);if(length<4)return;
   const fx=dx/length,fz=dz/length;
   const navigation=this.defenseNavigation??=new PgZombieNavigation(world.map,{groundLevelOnly:true});navigation.update(world.map,world.revision);
   // Cache the existing planned corridors once for all three bounded placements.
   // An unsafe direct placement need not discard a useful flank placement.
   const allies=[...this.ctx.players.values()].filter(ally=>ally.team===p.team&&ally.hp>0).map(ally=>{
    const goal=ally.isBot?this.botGoal(ally,now):null;if(ally.isBot)this.botWaypoint(ally,goal);
    return {player:ally,path:ally.isBot?this.botSteering.get(ally.id)?.path??(goal?[goal]:[]):[]};
   });
   for(const lateral of [0,-2.2,2.2]){
    const forward=lateral?2:2.6,position={x:p.position.x+fx*forward+fz*lateral,y:p.position.y,z:p.position.z+fz*forward-fx*lateral};
    if([...this.gadgets.values()].some(g=>g.ownerId===p.id&&g.primitive==="barrier"&&g.hp>0&&g.endsAt>now&&dist(g.position,position)<3))continue;
    if(!navigation.supported(position)||!clear(position)||[-.9,0,.9].some(x=>[-.175,.175].some(z=>!pgCapsuleClear({x:position.x+x,y:position.y,z:position.z+z},.6,world.map))))continue;
    const footprint={id:"bot-cover-clearance",kind:"structure" as const,center:{...position,y:position.y+.5},half:{x:1.43,y:.5,z:.605},mantle:false};
    let unsafe=entryCorridors.some(([from,to])=>{
      const distance=dist(from,to);if(distance<.01)return false;
      const hit=pgRayBox({...from,y:from.y+.5},{x:(to.x-from.x)/distance,y:(to.y-from.y)/distance,z:(to.z-from.z)/distance},footprint);
      return hit!==null&&hit<=distance;
     }),protectsRoute=!lateral;
     if(unsafe)continue;
    for(const {player:ally,path}of allies){
     if(Math.abs(ally.position.x-position.x)<1.43&&Math.abs(ally.position.z-position.z)<.605||dist(ally.position,position)<1.6){unsafe=true;break;}
     let from=ally.position;
     for(const next of path){
      const distance=dist(from,next);if(distance>.01){
       const hit=pgRayBox({...from,y:from.y+.5},{x:(next.x-from.x)/distance,y:0,z:(next.z-from.z)/distance},footprint);
       if(hit!==null&&hit<=distance){unsafe=true;break;}
      }
      from=next;
     }
     if(unsafe)break;
     // A connector can span useful protected ground without a waypoint at it.
      // Intersect each path edge with the threat→cover shadow, then validate
      // actual visibility/cover interception just as for authored endpoints.
      const protectedPoints=[ally.position,...path];let start=ally.position;
      if(!protectsRoute)for(const end of path){
       const dx=end.x-start.x,dz=end.z-start.z,rx=position.x-threat.position.x,rz=position.z-threat.position.z,det=dx*rz-dz*rx;
       if(Math.abs(det)>.00001){
        const ax=threat.position.x-start.x,az=threat.position.z-start.z,along=(ax*rz-az*rx)/det,shadow=(ax*dz-az*dx)/det;
        if(along>=0&&along<=1&&shadow>=1)protectedPoints.push({x:start.x+dx*along,y:start.y+(end.y-start.y)*along,z:start.z+dz*along});
       }
       start=end;
      }
      if(!protectsRoute)for(const at of protectedPoints){
      const distance=dist(at,threat.position),away=dist(at,position);
      if(away<=1.6||away>=8||distance<.01||!world.visible({...at,y:at.y+.5},{...threat.position,y:threat.position.y+.5}))continue;
      const hit=pgRayBox({...at,y:at.y+.5},{x:(threat.position.x-at.x)/distance,y:(threat.position.y-at.y)/distance,z:(threat.position.z-at.z)/distance},{...footprint,half:{x:1,y:.5,z:.175}});
      if(hit!==null&&hit<distance){protectsRoute=true;break;}
     }
    }
    if(!unsafe&&protectsRoute&&deploy(position).ok)return;
   }
   return;
  }
  if(def.primitive==="trip-line"){
   const socket=PG_PANEL_SOCKETS.filter(socket=>socket.compound===(this.site===0?"west":"east")).find(socket=>socket.approaches.some(position=>dist(p.position,position)<3));
   if(!socket||[...this.gadgets.values()].some(g=>g.ownerId===p.id&&g.primitive==="trip-line"&&g.hp>0&&g.endsAt>now&&dist(g.position,p.position)<6))return;
   const alongX=socket.solid.half.x>socket.solid.half.z;
   for(const sign of [-1,1])if(deploy({x:p.position.x+(alongX?sign*2:0),y:p.position.y,z:p.position.z+(alongX?0:sign*2)}).ok)return;
  }
 }
 botAction(p:PgPlayer,now:number){
  const s=this.pilots.get(p.id);if(!s||s.life!=="alive"||now<(s.cooldowns[0]??0))return;s.cooldowns[0]=now+1800;
  if(this.subphase==="prepare"&&s.side==="defend"){
   const socket=this.nearestSocket(p);if(socket){const common=this.common.get(p.id)!;if(s.characterId==="brace"&&s.charges[0]>0&&!this.ctx.world.snapshot().panels.some(x=>x.id===socket.id&&x.active))this.signature(p,s,{kind:"ability",slot:0,sequence:0,lifeId:p.lifeId,targetId:socket.id},now);else if(this.ctx.world.snapshot().panels.some(x=>x.id===socket.id&&x.active))this.reinforce(p,s,socket.id,now);else if(common.barricades>0)this.commonAbility(p,s,{kind:"ability",slot:1,sequence:0,lifeId:p.lifeId,targetId:socket.id},now);else this.reinforce(p,s,socket.id,now);}if(s.charges[0]>0)this.signature(p,s,{kind:"ability",slot:0,sequence:0,lifeId:p.lifeId,position:{x:p.position.x+1,y:p.position.y,z:p.position.z}},now);return;
  }
  if(this.subphase==="prepare"&&s.side==="attack"){const d=this.scouts.get(s.droneId??"");if(d){const point=PG_OBJECTIVES.uplink[this.site].position;d.yaw=Math.atan2(d.position.x-point.x,d.position.z-point.z);d.input={x:0,z:-1,at:now};}return;}
  if(this.subphase!=="action")return;
  const op=pgResolveOperator(s.characterId),ally=[...this.ctx.players.values()].find(v=>v.team===p.team&&v.hp>0&&v.hp<this.maxHp(v)-20&&dist(v.position,p.position)<8);
  if(op?.signature.primitive==="heal"&&ally)this.signature(p,s,{kind:"ability",slot:0,targetId:ally.id,sequence:0,lifeId:p.lifeId},now);
  else if(op?.signature.primitive==="breach"){const panel=this.ctx.world.snapshot().panels.find(v=>v.active&&dist(p.position,v.solid.center)<3);if(panel)this.signature(p,s,{kind:"ability",slot:0,targetId:panel.id,sequence:0,lifeId:p.lifeId},now);}
  else if(s.side==="attack")this.attackerUtility(p,s,now);
  else if(s.charges[0]>0)this.signature(p,s,{kind:"ability",slot:0,position:{x:p.position.x-Math.sin(p.yaw)*2,y:p.position.y,z:p.position.z-Math.cos(p.yaw)*2},sequence:0,lifeId:p.lifeId},now);
  const panel=this.ctx.world.snapshot().panels.find(v=>v.active&&!v.reinforced&&dist(p.position,v.solid.center)<3);if(panel&&s.side==="attack")this.commonAbility(p,s,{kind:"ability",slot:1,targetId:panel.id,sequence:0,lifeId:p.lifeId},now);
 }
 snapshot(viewerId?:string):PgModeSnapshot{
  const viewer=viewerId?this.ctx.players.get(viewerId):undefined,team=viewer?.team;
  const origin=viewer?this.viewOrigin(viewer):null;const known=(p:PgPlayer)=>!!viewer&&(p.team===team||!!origin&&this.visible(origin,eye(p.position)));
  const pilots:Record<string,PgSiegePilot>={};for(const [id,s]of this.pilots){const p=this.ctx.players.get(id);if(!p)continue;pilots[id]={...structuredClone(s),controllingDrone:this.controlling(id)};if(!known(p)){pilots[id].characterId=null;pilots[id].maxHp=100;pilots[id].charges=[0,0];pilots[id].droneId=null;pilots[id].cameraId=null;pilots[id].reinforcements=0;pilots[id].controllingDrone=false;}}
  const effects=[...this.gadgets.values()].filter(g=>g.kind==="smoke"||g.kind==="breach"||g.team===team||origin&&(dist(origin,g.position)<20&&this.visible(origin,eye(g.position))||!!g.end&&dist(origin,g.end)<20&&this.visible(origin,eye(g.end)))).map(({primitive,disabledUntil,pool,nextPulse,direction,damageByTarget,previousPositions,...g})=>structuredClone(g));
  const drones=[...this.scouts.values()].filter(d=>this.ctx.players.get(d.ownerId)?.team===team||origin&&this.visible(origin,{...d.position,y:d.position.y+.25})).map(({input,...d})=>structuredClone(d));
  return {id:this.id,collision:this.ctx.world.snapshot(),effects,pilots,round:this.series.round,subphase:this.subphase,deadline:this.deadline,attackTeam:this.series.attackTeam,roundScores:{...this.series.scores},capture:this.capture,site:this.site,drones,cameras:PG_SIEGE_CAMERAS.map(camera=>({id:camera.id,hp:this.cameraHealth.get(camera.id)??0,maxHp:35,disabled:!!team&&!this.cameraValid(team,camera,this.now),disabledUntil:this.camerasDisabledUntil.get(camera.id)??0})),intel:team?structuredClone(this.intel.get(team)??[]):[]};
 }
 leave(id:string,now:number){this.assaultCommits.delete(id);this.botSteering.delete(id);this.pilots.delete(id);this.common.delete(id);for(const [key,g]of this.gadgets)if(g.ownerId===id){this.ctx.world.damage(g.primitive==="shutter"?g.id.slice(6):g.id,100000,now,true);this.gadgets.delete(key);}this.scouts.delete(`drone-${id}`);}
}
