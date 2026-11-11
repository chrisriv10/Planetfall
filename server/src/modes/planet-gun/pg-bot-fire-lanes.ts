import {PG_BALANCE as B,pgLeanEye,pgLeanOffset,pgPilotHit,pgRayBox,type PgMap,type PgPlayer,type Vec3} from "@planetfall/shared";

export interface PgBotFireLaneOptions {
 shooter:PgPlayer;
 /** The caller must already have observed this enemy. This helper discovers no enemies. */
 observedTarget:PgPlayer;
 allies:readonly PgPlayer[];
 map:PgMap;
 /** Optional actual aim ray (normalized direction), gating fire without correcting bot aim. */
 shot?:{origin:Vec3;direction:Vec3;range:number};
 /** Disable lateral movement during interactions, doorway clearance, or committed traversal. */
 movementAllowed?:boolean;
 objectiveArea?:{position:Vec3;radius:number};
 /** Optional mode constraint; called for every sampled point along the proposed move. */
 allowPosition?:(feet:Vec3)=>boolean;
}
export interface PgBotFireLane {blockedBy:string|null;position:Vec3|null;}
const axes=["x","y","z"] as const;
const separation=(a:Vec3,b:Vec3)=>Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z);
const direction=(a:Vec3,b:Vec3):Vec3=>{const n=separation(a,b);return {x:(b.x-a.x)/n,y:(b.y-a.y)/n,z:(b.z-a.z)/n};};

function blocker(origin:Vec3,ray:Vec3,limit:number,options:PgBotFireLaneOptions):string|null {
 let nearest=limit,id:string|null=null;
 for(const ally of options.allies){
  if(ally.id===options.shooter.id||ally.hp<=0||ally.team!==options.shooter.team)continue;
  const hit=pgPilotHit(origin,ray,ally.position,ally.crouched,pgLeanOffset(ally));
  if(hit&&hit.distance<nearest){nearest=hit.distance;id=ally.id;}
 }
 return id;
}

/** Conservative swept standing envelope: never crosses low cover or overhead solids. */
function bodyClear(from:Vec3,to:Vec3,map:PgMap):boolean {
 const delta={x:to.x-from.x,y:to.y-from.y,z:to.z-from.z};
 return !map.solids.some(s=>{
  let enter=0,exit=1;
  for(const axis of axes){
   const low=s.center[axis]-s.half[axis]-(axis==="y"?B.height:B.radius)+1e-6;
   const high=s.center[axis]+s.half[axis]+(axis==="y"?0:B.radius)-1e-6;
   if(Math.abs(delta[axis])<1e-9){if(from[axis]<=low||from[axis]>=high)return false;continue;}
   const a=(low-from[axis])/delta[axis],b=(high-from[axis])/delta[axis];
   enter=Math.max(enter,Math.min(a,b));exit=Math.min(exit,Math.max(a,b));if(exit<=enter)return false;
  }
  return enter<exit;
 });
}
function supported(from:Vec3,to:Vec3,map:PgMap):boolean {
 // Continuous support intervals avoid stepping across a narrow gap between samples.
 // Include the standing footprint so a center ray alone cannot approve a ledge.
 return [[0,0],[B.radius,0],[-B.radius,0],[0,B.radius],[0,-B.radius]].every(([x,z])=>{
  const intervals:{start:number;end:number}[]=[];
  for(const solid of map.solids){
   if(Math.abs(solid.center.y+solid.half.y-from.y)>.025)continue;
   let start=0,end=1;
   for(const axis of ["x","z"] as const){
    const origin=from[axis]+(axis==="x"?x:z),delta=to[axis]-from[axis],low=solid.center[axis]-solid.half[axis],high=solid.center[axis]+solid.half[axis];
    if(Math.abs(delta)<1e-9){if(origin<low||origin>high){end=-1;break;}continue;}
    const a=(low-origin)/delta,b=(high-origin)/delta;
    start=Math.max(start,Math.min(a,b));end=Math.min(end,Math.max(a,b));
   }
   if(end>=start)intervals.push({start,end});
  }
  intervals.sort((a,b)=>a.start-b.start);let covered=0;
  for(const interval of intervals){if(interval.start>covered+1e-6)return false;covered=Math.max(covered,interval.end);if(covered>=1)return true;}
  return false;
 });
}
function reachable(from:Vec3,to:Vec3,options:PgBotFireLaneOptions):boolean {
 if(!bodyClear(from,to,options.map)||!supported(from,to,options.map))return false;
 const dx=to.x-from.x,dz=to.z-from.z,lengthSquared=dx*dx+dz*dz;
 for(const ally of options.allies){
  if(ally.id===options.shooter.id||ally.hp<=0||ally.team!==options.shooter.team)continue;
  if(ally.position.y>=from.y+B.height||ally.position.y+(ally.crouched?B.crouchHeight:B.height)<=from.y)continue;
  const t=Math.max(0,Math.min(1,((ally.position.x-from.x)*dx+(ally.position.z-from.z)*dz)/lengthSquared));
  if(Math.hypot(from.x+dx*t-ally.position.x,from.z+dz*t-ally.position.z)<2*B.radius)return false;
 }
 const steps=Math.ceil(separation(from,to)/.2);
 for(let i=0;i<=steps;i++){
  const t=i/steps,feet={x:from.x+(to.x-from.x)*t,y:from.y,z:from.z+(to.z-from.z)*t},area=options.objectiveArea;
  if(Math.abs(feet.x)+B.radius>options.map.halfWidth||Math.abs(feet.z)+B.radius>options.map.halfDepth)return false;
  if(area&&Math.hypot(feet.x-area.position.x,feet.y-area.position.y,feet.z-area.position.z)+B.radius>area.radius)return false;
  if(options.allowPosition&&!options.allowPosition(feet))return false;
 }
 return true;
}

/** Bounded suggestion only: the caller moves normally and retains its objective and aim memory. */
export function pgBotFireLane(options:PgBotFireLaneOptions):PgBotFireLane {
 const {shooter,observedTarget:target}=options;
 const aim={...target.position,y:target.position.y+(target.crouched?.76:1.05)},origin=pgLeanEye(shooter);
 const length=separation(origin,aim);
 if(length<1e-6)return {blockedBy:null,position:null};
 const shot=options.shot??{origin,direction:direction(origin,aim),range:length};
 const targetHit=pgPilotHit(shot.origin,shot.direction,target.position,target.crouched,pgLeanOffset(target));
 const blockedBy=blocker(shot.origin,shot.direction,Math.min(shot.range,targetHit?.distance??separation(shot.origin,aim)),options);
 if(!blockedBy||options.movementAllowed===false||!shooter.grounded)return {blockedBy,position:null};
 const dx=aim.x-origin.x,dz=aim.z-origin.z,n=Math.hypot(dx,dz);
 if(n<1e-6)return {blockedBy,position:null};
 // Exactly four candidates, at most two metres away; no route or target search.
 for(const offset of [1,-1,2,-2]){
  const feet={x:shooter.position.x+dz/n*offset,y:shooter.position.y,z:shooter.position.z-dx/n*offset};
  if(!reachable(shooter.position,feet,options))continue;
  const eye=pgLeanEye({...shooter,position:feet}),ray=direction(eye,aim),distance=separation(eye,aim);
  if(options.map.solids.some(s=>{const hit=pgRayBox(eye,ray,s);return hit!==null&&hit<distance;}))continue;
  if(blocker(eye,ray,distance,options))continue;
  return {blockedBy,position:feet};
 }
 return {blockedBy,position:null};
}
