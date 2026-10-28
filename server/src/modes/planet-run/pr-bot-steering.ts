import {prCapacitorTarget} from "./pr-capacitor-steering.js";
import {PR_BALANCE as B,prHash,prInsideTile,prObstacleTransform,prObstacleCenter,prPlatformCenter,type BotDifficulty,type PrInput,type PrPlayerState,type PrRoundDefinition,type PrTileState,type Vec3} from "@planetfall/shared";

/** All crowd samples are observations, never another pilot's pending input. */
export type PrCrowdPilot=Pick<PrPlayerState,"id"|"position"|"velocity"|"status">;
export interface PrBotPersonality {lateral:number;risk:number;reactionLead:number;passSide:number;jumpConfidence:number;diveConfidence:number;phase:number;}
export interface PrSteeringMemory {
  goal:number;nextDecision:number;sequence:number;identitySeed?:number;
  personality?:PrBotPersonality;target?:Vec3;steerX?:number;steerZ?:number;
  desiredX?:number;desiredZ?:number;lastSteerAt?:number;lastJumpAt?:number;lastDiveAt?:number;
  passSide?:number;passX?:number;passUntil?:number;followFactor?:number;nextTargetAt?:number;cachedJump?:boolean;cachedDive?:boolean;
}
export const PR_CROWD_LIMITS=Object.freeze({cellSize:5,radius:9,maxVisited:24,decisionMs:100});
/** Build once per room decision epoch, before moving any pilots. Snapshots avoid
 * sequential physics integration changing a later bot's view of the crowd. */
export class PrCrowdGrid {
  private readonly cells=new Map<string,PrCrowdPilot[]>();
  readonly stats={inserted:0,queries:0,visited:0,cellsVisited:0};
  constructor(players:Iterable<PrCrowdPilot>,readonly elapsed:number){
    for(const p of players){
      if(p.status!=="active")continue;
      const snapshot={id:p.id,status:p.status,position:{...p.position},velocity:{...p.velocity}};
      const key=this.key(p.position.x,p.position.z),cell=this.cells.get(key);
      if(cell)cell.push(snapshot);else this.cells.set(key,[snapshot]);
      this.stats.inserted++;
    }
  }
  private key(x:number,z:number):string{return `${Math.floor(x/PR_CROWD_LIMITS.cellSize)}:${Math.floor(z/PR_CROWD_LIMITS.cellSize)}`;}
  nearby(p:PrCrowdPilot,identity=0):PrCrowdPilot[]{
    this.stats.queries++;
    const result:PrCrowdPilot[]=[],cx=Math.floor(p.position.x/5),cz=Math.floor(p.position.z/5);
    let visited=0;
    // Center-first traversal bounds both bucket and pilot work even for bad
    // density. Rotate within a bucket so dense starts do not privilege IDs.
    for(let ring=0;ring<=2;ring++)for(let dx=-ring;dx<=ring;dx++)for(let dz=-ring;dz<=ring;dz++){
      if(Math.max(Math.abs(dx),Math.abs(dz))!==ring)continue;
      this.stats.cellsVisited++;
      const cell=this.cells.get(`${cx+dx}:${cz+dz}`);if(!cell)continue;
      const offset=identity%cell.length;
      for(let i=0;i<cell.length;i++){
        if(visited>=PR_CROWD_LIMITS.maxVisited)return result;
        visited++;this.stats.visited++;
        const other=cell[(i+offset)%cell.length];
        if(other.id!==p.id&&Math.abs(other.position.y-p.position.y)<3&&Math.hypot(other.position.x-p.position.x,other.position.z-p.position.z)<=9)result.push(other);
      }
    }
    return result;
  }
}
const clamp=(v:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,v));
const unit=(seed:number,index:number)=>(prHash(seed,index)>>>0)/4294967295;
export function prBotPersonality(identity:number):PrBotPersonality {
  return {lateral:(unit(identity,11)*2-1)*5.9,risk:.25+unit(identity,12)*.5,reactionLead:140+unit(identity,13)*160,passSide:unit(identity,14)<.5?-1:1,jumpConfidence:.6+unit(identity,15)*.35,diveConfidence:.2+unit(identity,16)*.65,phase:unit(identity,17)*Math.PI*2};
}
function identityFor(p:PrCrowdPilot,m:PrSteeringMemory):number {
  if(m.identitySeed===undefined){let h=0;for(let i=0;i<p.id.length;i++)h=Math.imul(h,31)+p.id.charCodeAt(i)|0;m.identitySeed=h>>>0;}
  return m.identitySeed;
}
/** Local occupancy includes a short observed-velocity projection. It cannot
 * inspect human future inputs or another bot's private target. */
export function prCrowdOccupancy(x:number,z:number,y:number,nearby:readonly PrCrowdPilot[]):number {
  let cost=0;
  for(const p of nearby){if(Math.abs(p.position.y-y)>3)continue;
    const current=Math.hypot(x-p.position.x,z-p.position.z);
    const future=Math.hypot(x-p.position.x-clamp(p.velocity.x*.3,-2,2),z-p.position.z-clamp(p.velocity.z*.3,-2,2));
    cost+=Math.max(0,1-current/3.5)*2+Math.max(0,1-future/2.5);
  }
  return cost;
}
function platformAt(round:PrRoundDefinition,x:number,z:number,elapsed:number,maxY=Infinity,margin=0){
  return round.platforms.find(p=>{const c=prPlatformCenter(p,elapsed);return c.y+p.half.y<=maxY&&Math.abs(x-c.x)<=p.half.x-margin&&Math.abs(z-c.z)<=p.half.z-margin;});
}
/** Match shared motion's rounded foot support tolerance. The survival decks'
 * 0.2m seams are walkable; treating every visual seam as a gap makes bots hop
 * unnecessarily and lose ground acceleration while dodging meteors. */
function walkableSupportAt(round:PrRoundDefinition,x:number,z:number,elapsed:number,maxY:number):boolean {
  return round.platforms.some(p=>{const c=prPlatformCenter(p,elapsed);return c.y+p.half.y<=maxY&&Math.hypot(Math.max(0,Math.abs(x-c.x)-p.half.x),Math.max(0,Math.abs(z-c.z)-p.half.z))<=B.radius*.6;});
}
function hazardCost(round:PrRoundDefinition,x:number,z:number,y:number,elapsed:number,seed:number,jumpableOnly=false):number {
  let cost=0;
  for(const o of round.obstacles){
    if(o.kind==="boost"||jumpableOnly&&["meteor","shutter","barrier"].includes(o.kind))continue;
    const tr=prObstacleTransform(o,elapsed,seed);if(!tr.active&&!tr.warning)continue;
    const center=prObstacleCenter(o,elapsed,seed),angle=o.kind==="rotator"?tr.yaw:0,dx=x-center.x,dz=z-center.z,c=Math.cos(angle),s=Math.sin(angle);
    if(o.kind==="meteor"){
      const clearance=Math.hypot(Math.max(0,Math.abs(dx)-o.half.x-B.radius),Math.max(0,Math.abs(dz)-o.half.z-B.radius));
      // Authored meteor boxes leave narrow but real channels. Overlapping soft
      // halos must not make those clear channels worse than an actual impact.
      cost+=clearance===0?25:Math.max(0,1-clearance/1.75);
    }
    else if(Math.abs(y+B.height/2-o.center.y)<o.half.y+B.height/2&&Math.abs(dx*c+dz*s)<o.half.x+1.1&&Math.abs(-dx*s+dz*c)<o.half.z+1.3)cost+=10;
  }
  return cost;
}
/** Three bounded corridor samples prevent selecting an attractive destination
 * on the far side of machinery or an incoming impact. Only authored hazard
 * timing and observed current position are used. */
function survivalPathDanger(p:PrPlayerState,target:Vec3,r:PrRoundDefinition,t:number,seed:number,lead:number):number {
  const dx=target.x-p.position.x,dz=target.z-p.position.z,distance=Math.hypot(dx,dz);
  let danger=0;
  for(const fraction of [.25,.5,.75]){
    const arrival=t+lead+Math.min(700,distance*fraction/B.runSpeed*1000);
    const x=p.position.x+dx*fraction,z=p.position.z+dz*fraction;
    danger+=Math.max(hazardCost(r,x,z,p.position.y,t,seed),hazardCost(r,x,z,p.position.y,arrival,seed));
  }
  return danger/3;
}
function raceTarget(p:PrPlayerState,r:PrRoundDefinition,t:number,seed:number,m:PrSteeringMemory,person:PrBotPersonality,nearby:readonly PrCrowdPilot[],difficulty:BotDifficulty):Vec3 {
  m.goal=clamp(m.goal,0,Math.max(0,r.waypoints.length-1));
  // The authored races progress toward negative Z. Use longitudinal progress
  // so a wide route or an impulse past a waypoint never requires a U-turn.
  while(m.goal<r.waypoints.length-1&&p.position.z<=r.waypoints[m.goal].z+2.4)m.goal++;
  const wp=r.waypoints[m.goal]??r.finish?.center??p.position;
  let lane=person.lateral+Math.sin(t/5300+person.phase)*.65;
  const deck=platformAt(r,p.position.x,p.position.z,t,p.position.y+1.5)??platformAt(r,wp.x,wp.z,t);
  const center=deck?prPlatformCenter(deck,t+person.reactionLead):wp;
  const half=deck?deck.half.x:8;
  const nextDeck=platformAt(r,wp.x,p.position.z-5,t+550,p.position.y+2.1);
  const nextCenter=nextDeck?prPlatformCenter(nextDeck,t+550):center;
  const minX=Math.max(center.x-half+1.25,nextCenter.x-(nextDeck?.half.x??half)+1.25);
  const maxX=Math.min(center.x+half-1.25,nextCenter.x+(nextDeck?.half.x??half)-1.25);
  lane=clamp(wp.x+lane,minX,maxX);
  const blocker=nearby.find(o=>{const dz=p.position.z-o.position.z;return dz>.2&&dz<4.5&&Math.abs(o.position.x-p.position.x)<1.35&&-o.velocity.z<Math.max(3,-p.velocity.z)+1;});
  m.followFactor=1;
  if(blocker){
    let best=-Infinity,chosen=0;
    for(const side of [-1,1]){
      const x=p.position.x+side*2.2,z=p.position.z-2.8;
      if(x<minX||x>maxX||!platformAt(r,x,z,t+250,p.position.y+1.5,.9))continue;
      const score=-(prCrowdOccupancy(x,z,p.position.y,nearby)*2.8)-hazardCost(r,x,z,p.position.y,t+person.reactionLead,seed)+(side===person.passSide?.7:0)+(side===m.passSide&&t<(m.passUntil??0)?.8:0);
      if(score>best){best=score;chosen=side;}
    }
    if(chosen&&best>-8){m.passSide=chosen;m.passX=blocker.position.x+chosen*2.2;m.passUntil=t+650;}
    else {m.passUntil=t;m.followFactor=.3;lane=p.position.x;}
  }
  if(t<(m.passUntil??0))lane=clamp(m.passX??lane,minX,maxX);
  const target={x:lane,y:wp.y,z:wp.z};
  return r.id==="capacitor-causeway"?prCapacitorTarget(p,r,t,seed,person,nearby,target,difficulty):target;
}
function survivalTarget(p:PrPlayerState,r:PrRoundDefinition,t:number,seed:number,m:PrSteeringMemory,person:PrBotPersonality,nearby:readonly PrCrowdPilot[]):Vec3 {
  const driftingIntoDanger=hazardCost(r,p.position.x,p.position.z,p.position.y,t+person.reactionLead,seed)<5&&hazardCost(r,p.position.x+p.velocity.x*.25,p.position.z+p.velocity.z*.25,p.position.y,t+person.reactionLead,seed)>=5;
  if(!driftingIntoDanger&&m.target&&t<(m.nextTargetAt??0)&&hazardCost(r,m.target.x,m.target.z,p.position.y,t+person.reactionLead,seed)<5){
    const path=survivalPathDanger(p,m.target,r,t,seed,person.reactionLead);
    const underfoot=hazardCost(r,p.position.x,p.position.z,p.position.y,t+person.reactionLead,seed);
    // Preserve a committed escape that reduces danger. Replanning every100ms
    // while still inside a warning box can reverse an otherwise safe dodge.
    if(path<5||underfoot>5&&path<underfoot*.8)return m.target;
  }
  let best=-Infinity,bestSafety=Infinity,target=p.position;
  const threatened=r.obstacles.find(o=>o.kind==="meteor"&&Math.abs(p.position.x-o.center.x)<o.half.x+B.radius+.7&&Math.abs(p.position.z-o.center.z)<o.half.z+B.radius+.7&&[t,t+person.reactionLead].some(at=>{const tr=prObstacleTransform(o,at,seed);return tr.active||tr.warning;}));
  // Random radial samples can miss the authored 0.64m channels altogether.
  // Add four exact face exits for the local warning, keeping work bounded.
  const exits=threatened?([-1,1] as const).flatMap(side=>["x","z"].map(axis=>{
    const exit={x:p.position.x,z:p.position.z},a=axis as "x"|"z";
    exit[a]=threatened.center[a]+side*(threatened.half[a]+B.radius+.8);
    // Use the channel midpoint when an adjacent authored box limits clearance.
    if(r.obstacles.some(o=>o!==threatened&&o.kind==="meteor"&&Math.abs(exit.x-o.center.x)<=o.half.x+B.radius&&Math.abs(exit.z-o.center.z)<=o.half.z+B.radius))exit[a]=threatened.center[a]+side*(threatened.half[a]+B.radius+.32);
    return exit;
  })):[];
  // Golden-angle samples differ continuously by identity, rather than sending
  // the whole field to the same 25 lattice points.
  for(let i=0;i<18+exits.length;i++){
    const angle=person.phase+i*2.3999632297+Math.floor(t/1700)*.37,radius=i===0?0:2+Math.sqrt(i/17)*7;
    const x=exits[i-18]?.x??p.position.x+Math.cos(angle)*radius,z=exits[i-18]?.z??p.position.z+Math.sin(angle)*radius;
    const distance=Math.hypot(x-p.position.x,z-p.position.z);
    if(!platformAt(r,x,z,t+person.reactionLead,p.position.y+1.5,.8))continue;
    const arrival=t+person.reactionLead+Math.min(700,distance/B.runSpeed*1000);
    const danger=Math.max(hazardCost(r,x,z,p.position.y,t,seed),hazardCost(r,x,z,p.position.y,t+person.reactionLead,seed),hazardCost(r,x,z,p.position.y,arrival,seed));
    const path=survivalPathDanger(p,{x,y:p.position.y,z},r,t,seed,person.reactionLead);
    // An open warning box is never preferable to a safe, crowded route. Crowd
    // pressure only ranks viable routes; during an escape minimize exposure.
    const safety=danger<5?(path<5?0:1):2;
    const score=-danger-path*.85-(safety===0&&!driftingIntoDanger?prCrowdOccupancy(x,z,p.position.y,nearby)*4:0)-distance*.16+unit(seed+(m.identitySeed??0),i)*.35;
    if(safety<bestSafety||safety===bestSafety&&score>best){bestSafety=safety;best=score;target={x,y:p.position.y,z};}
  }
  m.nextTargetAt=t+550+person.reactionLead;return {...target};
}
function shatterTarget(p:PrPlayerState,r:PrRoundDefinition,tiles:PrTileState,t:number,m:PrSteeringMemory,person:PrBotPersonality,nearby:readonly PrCrowdPilot[]):Vec3 {
  const current=r.tiles[Number(p.supportId?.replace("tile:",""))];
  const goal=r.tiles[m.goal];
  if(goal&&tiles.intact(goal.id,t+250)&&t<(m.nextTargetAt??0)&&Math.hypot(goal.center.x-p.position.x,goal.center.z-p.position.z)>.45)return goal.center;
  const candidates=current?current.neighbors.map(id=>r.tiles[id]):r.tiles.filter(tile=>tile.center.y<=p.position.y+.1&&tile.center.y>p.position.y-6&&Math.hypot(tile.center.x-p.position.x,tile.center.z-p.position.z)<6);
  let best=-Infinity,target=p.position;m.goal=-1;
  for(const tile of candidates){
    const distance=Math.hypot(tile.center.x-p.position.x,tile.center.z-p.position.z),arrival=t+distance/B.runSpeed*1000+150;
    if(!tiles.intact(tile.id,arrival))continue;
    const connectivity=tile.neighbors.filter(id=>tiles.intact(id,arrival+220)).length;
    const score=connectivity*.8+(tiles.triggered.has(tile.id)?-3:2)-prCrowdOccupancy(tile.center.x,tile.center.z,tile.center.y,nearby)*3-distance*.2+unit(m.identitySeed??0,tile.id)*.7;
    if(score>best){best=score;target=tile.center;m.goal=tile.id;}
  }
  m.nextTargetAt=t+240+person.reactionLead*.5;return {...target};
}
/** Ordinary PrInput only: steering cannot alter support, velocity, bumps, tiles,
 * obstacle state, or physics. Call every fixed step with one epoch's grid. */
export function prCrowdBotInput(p:PrPlayerState,r:PrRoundDefinition,tiles:PrTileState,t:number,seed:number,difficulty:BotDifficulty,m:PrSteeringMemory,crowd?:PrCrowdGrid):PrInput {
  const identity=identityFor(p,m),person=m.personality??(m.personality=prBotPersonality(identity));
  if(t>=m.nextDecision||m.desiredX===undefined){
    const nearby=crowd?.nearby(p,identity)??[];
    m.target=r.id==="shatterdeck"?shatterTarget(p,r,tiles,t,m,person,nearby):r.category==="race"?raceTarget(p,r,t,seed,m,person,nearby,difficulty):survivalTarget(p,r,t,seed,m,person,nearby);
    let dx=m.target.x-p.position.x,dz=m.target.z-p.position.z,d=Math.hypot(dx,dz);
    // A survival target is a place to stop. Full-speed arrival plus steering
    // inertia otherwise oscillates back into narrow meteor channels.
    const settling=r.category==="survival";
    if(d>(settling?.08:.35)){const scale=settling?Math.max(d,2):d;dx/=scale;dz/=scale;}else {dx=0;dz=0;}
    let sx=0,sz=0;
    for(const other of nearby){const x=p.position.x-other.position.x,z=p.position.z-other.position.z,dist=Math.hypot(x,z);
      if(dist>=2.4)continue;
      const strength=(1-dist/2.4)*.55;
      if(dist>.05){sx+=x/dist*strength;sz+=z/dist*strength;}
      else {sx+=person.passSide*strength;sz+=Math.sin(person.phase)*strength;}
    }
    const separation=Math.max(1,Math.hypot(sx,sz)/.65);sx/=separation;sz/=separation;
    let nx=dx+sx,nz=dz+sz;
    // Crowd preference cannot steer toward a course edge or a missing tile.
    const probeX=p.position.x+nx*1.2,probeZ=p.position.z+nz*1.2;
    const safe=r.id==="shatterdeck"?r.tiles.some(tile=>Math.abs(tile.center.y-p.position.y)<1&&tiles.intact(tile.id,t+200)&&prInsideTile(tile,probeX,probeZ)):!!platformAt(r,probeX,probeZ,t+150,p.position.y+1.5,.45);
    const crowdHazard=r.category==="survival"&&(hazardCost(r,p.position.x,p.position.z,p.position.y,t+person.reactionLead,seed)>0||hazardCost(r,probeX,probeZ,p.position.y,t+person.reactionLead,seed)>hazardCost(r,p.position.x+dx*1.2,p.position.z+dz*1.2,p.position.y,t+person.reactionLead,seed)+.5);
    if(!safe||crowdHazard){nx=dx;nz=dz;}
    const length=Math.max(1,Math.hypot(nx,nz)),pace=r.category==="race"?(m.followFactor??1):1;m.desiredX=nx/length*pace;m.desiredZ=nz/length*pace;
    let jump=false;
    const lead=1.45+person.jumpConfidence*.9;
    if(p.grounded&&d>.8&&t-(m.lastJumpAt??-2000)>650){
      if(r.id==="shatterdeck")jump=!!p.supportId&&tiles.triggered.has(Number(p.supportId.slice(5)))&&d>1.4&&tiles.intact(m.goal,t+350);
      else {
        // Probe authored support along the actual approach, catching narrow
        // gaps and raised slabs even when a longer probe already lands on deck.
        for(let step=.5;step<=lead;step+=.4){
          const x=p.position.x+dx*step,z=p.position.z+dz*step;
          if(!walkableSupportAt(r,x,z,t+step/B.runSpeed*1000,p.position.y+.45))jump=true;
        }
        if(hazardCost(r,p.position.x+dx*lead,p.position.z+dz*lead,p.position.y,t+person.reactionLead,seed,true)>5)jump=true;
      }
    }
    if(jump)m.lastJumpAt=t;
    let dive=false;
    const competence=difficulty==="easy"?.16:difficulty==="hard"?.95:.6;
    if(t>=p.diveReadyAt&&t-(m.lastDiveAt??-5000)>3400&&unit(identity,Math.floor(t/800))<person.diveConfidence*competence){
      const aheadX=p.position.x+dx*3.5,aheadZ=p.position.z+dz*3.5;
      const safeLanding=r.id==="shatterdeck"?r.tiles.some(tile=>tile.center.y<=p.position.y&&tile.center.y>p.position.y-4&&tiles.intact(tile.id,t+450)&&prInsideTile(tile,aheadX,aheadZ)):!!platformAt(r,aheadX,aheadZ,t+350,p.position.y+.3,.8);
      const finishDistance=r.finish?Math.hypot(p.position.x-r.finish.center.x,p.position.z-r.finish.center.z):Infinity;
      const finishSprint=r.category==="race"&&finishDistance>2&&finishDistance<7&&p.checkpoint===r.checkpoints.length-1;
      const supportBelow=r.id==="shatterdeck"?r.tiles.some(tile=>tile.center.y<=p.position.y+.3&&tile.center.y>p.position.y-4&&tiles.intact(tile.id,t)&&prInsideTile(tile,p.position.x,p.position.z)):walkableSupportAt(r,p.position.x,p.position.z,t,p.position.y+.3);
      // Recovery is a local gap decision. A distant waypoint says nothing about
      // whether this short jump needs help; continuous deck beneath an ordinary
      // descending jump does not justify a dive.
      const recovery=!p.grounded&&!supportBelow&&p.velocity.y<-.5&&p.velocity.y>-7&&d>.8;
      dive=safeLanding&&(finishSprint||recovery)&&hazardCost(r,aheadX,aheadZ,p.position.y,t+200,seed)<5;
    }
    if(dive)m.lastDiveAt=t;
    m.cachedJump=jump;m.cachedDive=dive;m.nextDecision=t+PR_CROWD_LIMITS.decisionMs;
  }
  const dt=clamp((t-(m.lastSteerAt??t-33))/1000,0,.1),alpha=1-Math.exp(-dt*(5.5+person.risk*2));
  if(m.steerX===undefined){m.steerX=m.desiredX??0;m.steerZ=m.desiredZ??0;}
  else {m.steerX+=((m.desiredX??0)-m.steerX)*alpha;m.steerZ=((m.steerZ??0)+((m.desiredZ??0)-(m.steerZ??0))*alpha);}
  m.lastSteerAt=t;
  return {sequence:++m.sequence,moveX:m.steerX,moveZ:m.steerZ??0,jump:m.cachedJump??false,dive:m.cachedDive??false};
}
