import {pgBotFireLane} from "./pg-bot-fire-lanes.js";
import {pgBotAim,type PgBotAimMemory} from "./pg-bot-aim.js";
import {pgBotAware} from "./pg-bot-perception.js";
import {PG_BALANCE as B,PG_MAP,pgAim,pgLeanEye,pgGunProfile,pgRayBox,type BotDifficulty,type PgInput,type PgPlayer,type Vec3,type PgMap,type PgSolid} from "@planetfall/shared";
export interface PgBotContext {map:PgMap;goal:Vec3|null;visible:(a:Vec3,b:Vec3)=>boolean;grounded?:boolean;steering?:Vec3|null;combatArea?:{position:Vec3;radius:number};allowCombatReposition?:boolean;}
export interface PgBotMemory {sequence:number;nextDecision:number;targetId:string|null;goal:number;path:number[];fireAt:number;stuckAt:number;last:Vec3;routeMap?:PgMap;routeGoal?:Vec3;routeBlocked?:boolean;routeTargetId?:string|null;routeRecovery?:number;aim?:PgBotAimMemory;fireLane?:{targetId:string;lifeId:number;map:PgMap;recheckAt:number;expiresAt:number;position:Vec3|null};}
export const pgBotMemory=():PgBotMemory=>({sequence:0,nextDecision:0,targetId:null,goal:0,path:[],fireAt:0,stuckAt:0,last:{x:0,y:0,z:0}});
const navigationSolids=new WeakMap<PgMap,PgSolid[]>();
/** Conservative swept standing body, including feet/overhead geometry missed by a chest ray. */
function bodySegmentClear(from:Vec3,to:Vec3,map:PgMap):boolean {
  const delta={x:to.x-from.x,y:to.y-from.y,z:to.z-from.z};
  return !map.solids.some(s=>{
    let enter=0,exit=1;
    for(const axis of ["x","y","z"] as const){
      const low=s.center[axis]-s.half[axis]-(axis==="y"?B.height:B.radius)+1e-6;
      const high=s.center[axis]+s.half[axis]+(axis==="y"?0:B.radius)-1e-6;
      if(Math.abs(delta[axis])<1e-9){if(from[axis]<=low||from[axis]>=high)return false;continue;}
      const a=(low-from[axis])/delta[axis],b=(high-from[axis])/delta[axis];
      enter=Math.max(enter,Math.min(a,b));exit=Math.min(exit,Math.max(a,b));
      if(exit<=enter)return false;
    }
    return enter<exit;
  });
}
function reachableNode(from:Vec3,to:Vec3,map:PgMap):boolean {
  let solids=navigationSolids.get(map);
  if(!solids){solids=map.solids.map(s=>({...s,half:{x:s.half.x+.43,y:s.half.y,z:s.half.z+.43}}));navigationSolids.set(map,solids);}
  const delta={x:to.x-from.x,y:to.y-from.y,z:to.z-from.z},length=Math.hypot(delta.x,delta.y,delta.z);
  if(length<.01)return true;
  const direction={x:delta.x/length,y:delta.y/length,z:delta.z/length},origin={...from,y:from.y+.95};
  let escaping=false;
  for(const s of solids){
    const hit=pgRayBox(origin,direction,s);if(hit===null||hit>=length-.05)continue;
    // A physical wall contact can start .01m inside the navigation safety skin.
    // Only allow promptly leaving that skin when the entire standing-body sweep is clear.
    if((["x","y","z"] as const).some(axis=>Math.abs(origin[axis]-s.center[axis])>=s.half[axis]))return false;
    let exit=Infinity;
    for(const axis of ["x","y","z"] as const)if(Math.abs(direction[axis])>1e-9)exit=Math.min(exit,(s.center[axis]+Math.sign(direction[axis])*s.half[axis]-origin[axis])/direction[axis]);
    if(exit>.1||exit>=length)return false;
    escaping=true;
  }
  return !escaping||bodySegmentClear(from,to,map);
}
const distance=(a:Vec3,b:Vec3)=>Math.hypot(a.x-b.x,a.z-b.z);
function visible(a:Vec3,b:Vec3):boolean {const n=Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z);if(n<.001)return true;const direction={x:(b.x-a.x)/n,y:(b.y-a.y)/n,z:(b.z-a.z)/n};return !PG_MAP.solids.some(box=>{const t=pgRayBox(a,direction,box);return t!==null&&t<n;});}
const walkEdges=new WeakMap<PgMap,Map<string,boolean>>();
function walkEdgeClear(from:number,to:number,map:PgMap):boolean {
  let edges=walkEdges.get(map);if(!edges){edges=new Map();walkEdges.set(map,edges);}
  const key=`${from}:${to}`;let clear=edges.get(key);
  if(clear===undefined){clear=reachableNode(map.navigation[from].position,map.navigation[to].position,map);edges.set(key,clear);}
  return clear;
}
function routeTree(from:number,map:PgMap,grounded=false,safe=false):Map<number,number>{
 const queue=[from],previous=new Map<number,number>([[from,-1]]);
 for(let i=0;i<queue.length;i++)for(const link of map.navigation[queue[i]].links){
  if(previous.has(link.to)||grounded&&link.kind==="wall-run"||safe&&link.kind==="walk"&&!walkEdgeClear(queue[i],link.to,map))continue;
  previous.set(link.to,queue[i]);queue.push(link.to);
 }
 return previous;
}
function route(from:number,to:number,previous:Map<number,number>):number[]{
 if(!previous.has(to))return [];
 const path:number[]=[];for(let id=to;id!==from;id=previous.get(id)!)path.unshift(id);return path;
}
export function pgBotInput(p:PgPlayer,players:Iterable<PgPlayer>,now:number,difficulty:BotDifficulty,m:PgBotMemory,context?:PgBotContext):{input:PgInput;fire:boolean} {
  const map=context?.map??PG_MAP,canSee=context?.visible??visible,steered=context?.steering!==undefined;
  // Room topology can remove appended bypass nodes while a mode temporarily
  // has no objective. Invalidate before reading any old waypoint/goal index.
  if((m.routeMap&&m.routeMap!==map)||m.path.some(id=>!map.navigation[id])||!map.navigation[m.goal]){m.path=[];m.goal=map.navigation[0]?.id??0;m.routeMap=undefined;m.routeGoal=undefined;m.routeTargetId=null;m.routeBlocked=false;m.routeRecovery=0;m.nextDecision=now;}
  const reaction=difficulty==="easy"?500:difficulty==="hard"?170:300;
  const eye={...p.position,y:p.position.y+(p.crouched?B.crouchEye:B.eye)};
  const roster=[...players],enemies=roster.filter(e=>e.hp>0&&e.team!==p.team&&pgBotAware(p,e,now)).sort((a,b)=>distance(a.position,p.position)-distance(b.position,p.position));
  const target=enemies.find(e=>canSee(eye,{...e.position,y:e.position.y+(e.crouched?.76:1.05)}));
  if(target?.id!==m.targetId){m.targetId=target?.id??null;m.fireAt=now+reaction;}
  const objective=context?.goal;
  // Modes request a stationary interaction by targeting the bot's current feet.
  if(!steered&&objective&&Math.hypot(objective.x-p.position.x,objective.y-p.position.y,objective.z-p.position.z)<.01){m.path=[];m.routeMap=map;m.routeGoal={...objective};m.routeBlocked=false;}
  const metric=(a:Vec3,b:Vec3)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
  const changedRoute=!!objective&&(m.routeMap!==map||!m.routeGoal||metric(objective,m.routeGoal)>.1);
  if(!steered&&(changedRoute||now>=m.nextDecision)){m.nextDecision=now+reaction;
    const nodes=map.navigation.filter(n=>difficulty!=="easy"||n.position.y===0);
    const ordered=[...nodes].sort((a,b)=>metric(a.position,p.position)-metric(b.position,p.position));
    // Patrol and pursuit retain their corners across combat reaction ticks too.
    // A moving visible enemy changes the destination only after changing nav anchor.
    const chase=target?[...nodes].sort((a,b)=>metric(a.position,target.position)-metric(b.position,target.position)).find(n=>reachableNode(target.position,n.position,map)):undefined;
    const chaseChanged=!objective&&!!chase&&(m.routeTargetId!==target?.id||m.goal!==chase.id);
    const completed=!m.path.length&&!!m.routeGoal&&metric(m.routeGoal,p.position)<.85;
    const needsRoute=objective?changedRoute:m.routeMap!==map||chaseChanged||completed||!m.routeGoal;
    if(needsRoute){
      const connectors=ordered.filter(n=>reachableNode(p.position,n.position,map));
      const nearest=connectors[Math.min(m.routeRecovery??0,Math.max(0,connectors.length-1))];
      if(!nearest){m.path=[];m.routeBlocked=true;m.routeMap=map;m.routeGoal=objective?{...objective}:undefined;}
      else {
        const tree=routeTree(nearest.id,map,context?.grounded,!objective);
        const available=nodes.filter(n=>tree.has(n.id));
        const upper=available.filter(n=>n.position.y>=2&&n.links.length>0),identity=p.id.charCodeAt(p.id.length-1);
        const patrol=available.filter(n=>metric(n.position,p.position)>3);
        const pool=difficulty!=="easy"&&upper.length&&Math.floor(now/6000)%3===identity%3?upper:patrol.length?patrol:available;
        const previous=!objective&&!completed&&m.routeGoal?available.find(n=>metric(n.position,m.routeGoal!)<.1):undefined;
        const goal=objective?([...nodes].sort((a,b)=>metric(a.position,objective)-metric(b.position,objective)).find(n=>reachableNode(objective,n.position,map))??nearest):chase&&available.some(n=>n.id===chase.id)?chase:previous??pool[(Math.floor(now/3500)+identity*7)%pool.length];
        m.path=route(nearest.id,goal.id,tree);m.goal=goal.id;
        m.routeBlocked=nearest.id!==goal.id&&!m.path.length;
        m.path.unshift(nearest.id);m.routeMap=map;m.routeGoal={...(objective??goal.position)};m.routeTargetId=target?.id??null;
      }
    }
  }
  if(!steered)while(m.path.length&&distance(map.navigation[m.path[0]].position,p.position)<.85&&Math.abs(map.navigation[m.path[0]].position.y-p.position.y)<.6){
    const current=map.navigation[m.path[0]],next=m.path.length>1?map.navigation[m.path[1]].position:objective;
    const edge=m.path.length>1?current.links.find(l=>l.to===m.path[1]):undefined;
    // Retain walk corners until the next connector is clear; traversal edges
    // intentionally cross geometry that requires jumping, mantling or wall-running.
    if(next&&(objective||(!edge||edge.kind==="walk")&&Math.abs(next.y-current.position.y)<.1)&&!reachableNode(p.position,next,map))break;
    m.path.shift();
  }
  const destination=steered?(context.steering??p.position):objective&&!m.path.length?(!m.routeBlocked&&reachableNode(p.position,objective,map)?objective:p.position):m.routeBlocked?p.position:map.navigation[m.path.length?m.path[0]:m.goal].position;
  const dx=destination.x-p.position.x,dz=destination.z-p.position.z;
  const aim=pgBotAim(p,target,now,difficulty,Math.hypot(dx,dz)<.01?(m.aim?.yaw??p.yaw):Math.atan2(-dx,-dz),m.aim);m.aim=aim.memory;
  const {yaw,pitch}=aim;
  const canReposition=context?.allowCombatReposition!==false&&p.grounded&&p.mode!=="mantle"&&p.mode!=="wall-run"&&p.mode!=="slide"&&!(objective&&metric(objective,p.position)<.01);
  if(!target||!canReposition||m.fireLane&&(m.fireLane.targetId!==target.id||m.fireLane.lifeId!==p.lifeId||m.fireLane.map!==map))m.fireLane=undefined;
  let friendlyBlocked=false,lanePosition:Vec3|null=null;
  if(target){
    const options={shooter:p,observedTarget:target,allies:roster,map,shot:{origin:pgLeanEye(p),direction:pgAim(yaw,pitch),range:pgGunProfile(p.guns[p.slot]).range},movementAllowed:false,objectiveArea:context?.combatArea};
    friendlyBlocked=pgBotFireLane(options).blockedBy!==null;
    if(friendlyBlocked&&canReposition&&(!m.fireLane||now>=m.fireLane.recheckAt)){
      const suggestion=pgBotFireLane({...options,movementAllowed:true});
      m.fireLane={targetId:target.id,lifeId:p.lifeId,map,recheckAt:now+reaction,expiresAt:now+900,position:suggestion.position};
    }
    const cached=m.fireLane,position=cached?.position,area=context?.combatArea;
    if(position&&cached&&now<cached.expiresAt&&distance(position,p.position)>.2&&(!area||metric(position,area.position)+B.radius<=area.radius))lanePosition=position;
    else if(cached)cached.position=null;
  }
  const repositioning=lanePosition!==null,moveX=lanePosition?lanePosition.x-p.position.x:dx,moveZ=lanePosition?lanePosition.z-p.position.z:dz,moveLength=Math.max(1,Math.hypot(moveX,moveZ));
  const c=Math.cos(yaw),s=Math.sin(yaw),forwardX=moveX/moveLength,forwardZ=moveZ/moveLength;
  let jump=difficulty!=="easy"&&destination.y>p.position.y+.55;if(now-m.stuckAt>700){const stalled=distance(m.last,p.position)<.5;jump||=stalled;if(!steered&&stalled&&(distance(destination,p.position)>.65||!objective&&m.path.length>1)){m.routeMap=undefined;m.routeRecovery=(m.routeRecovery??0)+1;m.nextDecision=now;}else if(!stalled)m.routeRecovery=0;m.last={...p.position};m.stuckAt=now;}
  if(context?.goal&&distance(context.goal,p.position)<.65)jump=false;
  if(p.mode==="wall-run"&&now>p.wallUntil-350)jump=!p.jumpHeld;
  if(steered||repositioning)jump=false;
  const close=!repositioning&&!steered&&!context?.goal&&target&&distance(target.position,p.position)<12;
  // Respawning initializes lastDamageAt too; an actual attacker distinguishes incoming fire.
  const returningFire=!!objective&&!!target&&!!p.lastAttacker&&now>=p.lastDamageAt&&now-p.lastDamageAt<=1500&&Math.hypot(target.position.x-p.position.x,target.position.y-p.position.y,target.position.z-p.position.z)<=pgGunProfile(p.guns[p.slot]).range;
  const advancing=!!context?.goal&&!returningFire&&distance(context.goal,p.position)>5&&(!target||distance(target.position,p.position)>14);
  const slide=!steered&&!target&&difficulty!=="easy"&&p.grounded&&Math.hypot(p.velocity.x,p.velocity.z)>8&&Math.floor((now+p.id.charCodeAt(p.id.length-1)*71)/650)%11===0;
  return {input:{sequence:++m.sequence,moveX:close?Math.sin(now*.001)*.65:forwardX*c-forwardZ*s,moveZ:close?0:forwardX*s+forwardZ*c,yaw,pitch,jump,sprint:!repositioning&&(advancing||!target),crouch:slide,ads:!!target&&!advancing},fire:!!target&&!friendlyBlocked&&aim.facing&&!advancing&&now>=m.fireAt};
}
