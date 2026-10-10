import { BR_BALANCE } from "./balance.js";
import { BR_MAP_BLOCKS, BR_TRAVERSAL, brBlockPlanarHalfExtents, brBlocksNear, brRoadGradeFloorAt, isInsideBrIsland } from "./map.js";
import { brClamp } from "./math.js";
import { brBaseDeckHeight } from "./orbital-isle-elevation.js";
import {brBlockTopSurfaceAt} from "./block-surface.js";
import type { BrDeploymentState, BrShipState } from "./types.js";
import type { Vec3 } from "../index.js";

export interface BrMotionState {
  position: Vec3;
  velocity: Vec3;
  yaw: number;
  grounded: boolean;
  crouched: boolean;
  deployment: BrDeploymentState;
  downed: boolean;
  lastJumpSignal: boolean;
  lastCrouchSignal: boolean;
  slideEndsAt: number;
  traversalCooldownUntil: number;
  lastGroundedAt?: number;
  jumpBufferedUntil?: number;
}

export interface BrMotionInput {
  moveX: number;
  moveY: number;
  yaw: number;
  jump: boolean;
  sprint: boolean;
  crouch: boolean;
}

export interface BrMotionResult extends BrMotionState {
  landed: boolean;
  traversed: boolean;
}

export interface BrCollisionResult { movement: Vec3; grounded: boolean; ceiling: boolean; crouched?: boolean; }
export type BrCollisionResolver = (position: Vec3, desiredMovement: Vec3, options: { jumping: boolean; downed: boolean; crouched: boolean }) => BrCollisionResult;

/** Keep interior stair contact queries shorter than the existing .18m ground
 * snap. A sprint tick can cross a landing lip and its incline in one query.
 * This refines only supported interior ramps; jumping and open deck keep the
 * ordinary single query and the controller's contact limits stay unchanged. */
export function brInteriorStairSubsteps(feet:Vec3,desired:Vec3,jumping:boolean):number {
  const distance=Math.hypot(desired.x,desired.z);
  if(jumping||desired.y>0||distance<=.12)return 1;
  const steps=Math.ceil(distance/.12);
  for(const block of brBlocksNear(feet,distance+BR_BALANCE.playerRadius)){
    if(block.kind!=="ramp"||!block.id.includes("-stairs-"))continue;
    // Sample the swept segment as well as its endpoints. A long tick can
    // begin on the landing and end far down the incline; neither endpoint
    // then lies close enough to the initial feet height to identify contact.
    for(let step=0;step<=steps;step++){
      const p={x:feet.x+desired.x*step/steps,z:feet.z+desired.z*step/steps};
      const top=brBlockTopSurfaceAt(block,p);
      if(top!==null&&feet.y>=top-.05&&feet.y<=top+.45)return steps;
    }
  }
  return 1;
}

/** Downward intent only where the next short stair query has real support
 * within the controller's existing snap range. Never pull a pilot down across
 * an unsupported stairwell edge or change freefall/jump velocity. */
export function brInteriorStairProbeY(feet:Vec3,desired:Vec3):number {
  const next={x:feet.x+desired.x,z:feet.z+desired.z};
  let currentTop=-Infinity,nextTop=-Infinity;
  for(const block of brBlocksNear(feet,Math.hypot(desired.x,desired.z)+BR_BALANCE.playerRadius)){
    if(block.kind!=="platform"&&block.kind!=="ramp")continue;
    const current=brBlockTopSurfaceAt(block,feet),top=brBlockTopSurfaceAt(block,next);
    if(current!==null&&current<=feet.y+.18)currentTop=Math.max(currentTop,current);
    if(top!==null&&top<=feet.y+.18)nextTop=Math.max(top,nextTop);
  }
  // Upward travel keeps the original controller input. Adding downward intent
  // uphill can oppose a slow pilot at a steep stair foot.
  if(currentTop>=feet.y-.18&&nextTop>=feet.y-.18&&nextTop<currentTop-.001)return Math.min(desired.y,-.1);
  return desired.y;
}

/** A wall/floor corner can make Rapier's autostep return a small downward
 * penetration into the solid base deck. Preserve the resolved horizontal
 * collision and constrain only that floor contact, identically on both peers.
 * The lower service basin keeps its actual -3m floor; outside the outline
 * there is no floor constraint. */
export function brConstrainBaseDeckMovement(feet:Vec3,movement:Vec3):number {
  const next={x:feet.x+movement.x,y:feet.y+movement.y,z:feet.z+movement.z};
  if(movement.y>0||!isInsideBrIsland(next))return movement.y;
  const floor=brBaseDeckHeight(next);
  return feet.y>=floor-.1&&next.y<floor+.035?floor+.035-feet.y:movement.y;
}

/** Fast, deterministic collision result for unobstructed flat deck. Returning
 * null means authored geometry is nearby and Rapier must resolve the move. */
export function brFlatDeckCollision(feet:Vec3,desiredMovement:Vec3,jumping:boolean):BrCollisionResult|null {
  const horizontal=Math.hypot(desiredMovement.x,desiredMovement.z);
  const midpoint={x:feet.x+desiredMovement.x*.5,y:feet.y,z:feet.z+desiredMovement.z*.5};
  const next={x:feet.x+desiredMovement.x,y:feet.y+desiredMovement.y,z:feet.z+desiredMovement.z};
  const sweptBottom=Math.min(feet.y,next.y),sweptTop=Math.max(feet.y,next.y)+BR_BALANCE.playerHeight;
  const minX=Math.min(feet.x,next.x),maxX=Math.max(feet.x,next.x),minZ=Math.min(feet.z,next.z),maxZ=Math.max(feet.z,next.z);
  let floorTop=isInsideBrIsland(next)?brBaseDeckHeight(next):Number.NEGATIVE_INFINITY;
  for(const block of brBlocksNear(midpoint,horizontal*.5+BR_BALANCE.playerRadius+.25)){
    const planarHalf=brBlockPlanarHalfExtents(block);
    const halfX=planarHalf.x+BR_BALANCE.playerRadius,halfZ=planarHalf.z+BR_BALANCE.playerRadius;
    const planarOverlap=maxX>=block.position.x-halfX&&minX<=block.position.x+halfX&&maxZ>=block.position.z-halfZ&&minZ<=block.position.z+halfZ;
    if(!planarOverlap)continue;
    // Service-road grades overlap the monolithic base-deck collider. Rapier's
    // KCC can choose that lower floor and travel underneath the shallow ramp,
    // so resolve their authored top plane deterministically on both client and
    // server. Other rotated ramps remain on Rapier's exact path.
    if(block.rotation){
      const gradeFloor=brRoadGradeFloorAt(block,next,BR_BALANCE.playerRadius);
      if(gradeFloor!==null&&desiredMovement.y<=0&&feet.y>=gradeFloor-.45){floorTop=Math.max(floorTop,gradeFloor);continue;}
      if(gradeFloor!==null&&feet.y+BR_BALANCE.playerHeight<gradeFloor-.34)continue;
      // Diagonal-road broadphase boxes include empty space beside the ribbon.
      if(block.id.endsWith("-surface")&&gradeFloor===null)continue;
      return null;
    }
    const blockBottom=block.position.y-block.size.y/2,blockTop=block.position.y+block.size.y/2;
    if(block.kind==="platform"||block.kind==="bridge"){
      // Broadphase includes the capsule radius, but a floor plane must end at
      // the actual deck edge. Extending that plane by the radius held pilots
      // above descending access roads with no support beneath their feet.
      // Rapier handles the capsule's partial contact at the edge instead.
      const endpointOverlap=next.x>=block.position.x-planarHalf.x&&next.x<=block.position.x+planarHalf.x&&next.z>=block.position.z-planarHalf.z&&next.z<=block.position.z+planarHalf.z;
      if(desiredMovement.y>0&&feet.y+BR_BALANCE.playerHeight<=blockBottom&&next.y+BR_BALANCE.playerHeight>=blockBottom)return null;
      if(endpointOverlap&&feet.y>=blockTop-.45)floorTop=Math.max(floorTop,blockTop);
      else if(sweptTop>blockBottom&&sweptBottom<blockTop)return null;
      continue;
    }
    if(sweptTop>=blockBottom&&sweptBottom<=blockTop)return null;
  }
  if(Number.isFinite(floorTop)&&desiredMovement.y<=0&&next.y<=floorTop+.08&&feet.y>=floorTop-.45){
    // Match the controller's small contact offset so a grounded capsule does
    // not flicker between exact y=0 and airborne on consecutive fast frames.
    return {movement:{x:desiredMovement.x,y:floorTop+.035-feet.y,z:desiredMovement.z},grounded:!jumping,ceiling:false};
  }
  return {movement:{...desiredMovement},grounded:false,ceiling:false};
}

/** Initial drop velocity shared by prediction and the authoritative server. */
export function brDropVelocity(ship:Pick<BrShipState,"start"|"end"|"startedAt"|"endsAt">,yaw:number):Vec3 {
  const routeSeconds=Math.max(.001,(ship.endsAt-ship.startedAt)/1000);
  const shipX=(ship.end.x-ship.start.x)/routeSeconds,shipZ=(ship.end.z-ship.start.z)/routeSeconds;
  // Preserve most of the transport's momentum so the jump timing has a clear,
  // readable effect on reachable landing sites. Steering then blends in fast.
  return {x:shipX*.84+Math.sin(yaw)*6,y:-5,z:shipZ*.84-Math.cos(yaw)*6};
}

/** Safe final-ejection velocity. It retains some Starliner continuity while
 * guaranteeing a useful inward component instead of carrying idle pilots off
 * the island along the final outward leg of the route. */
export function brForcedDropVelocity(ship:Pick<BrShipState,"start"|"end"|"startedAt"|"endsAt">,position:Pick<Vec3,"x"|"z">):Vec3 {
  const routeSeconds=Math.max(.001,(ship.endsAt-ship.startedAt)/1000);
  const shipX=(ship.end.x-ship.start.x)/routeSeconds,shipZ=(ship.end.z-ship.start.z)/routeSeconds;
  const routeSpeed=Math.max(.001,Math.hypot(shipX,shipZ));
  const radius=Math.hypot(position.x,position.z);
  const inward=radius>.001?{x:-position.x/radius,z:-position.z/radius}:{x:-shipX/routeSpeed,z:-shipZ/routeSpeed};
  let x=shipX*.26+inward.x*18,z=shipZ*.26+inward.z*18;
  const inwardSpeed=x*inward.x+z*inward.z;
  if(inwardSpeed<8){const correction=8-inwardSpeed;x+=inward.x*correction;z+=inward.z*correction;}
  return{x,y:-5,z};
}

/** Moves a planar velocity toward its target without diagonal acceleration gain or overshoot. */
export function brApproachPlanarVelocity(current:Vec3,target:Vec3,maximumDelta:number):Vec3 {
  const dx=target.x-current.x,dz=target.z-current.z,distance=Math.hypot(dx,dz);
  if(distance<=maximumDelta||distance<1e-8)return{x:target.x,y:current.y,z:target.z};
  const scale=maximumDelta/distance;return{x:current.x+dx*scale,y:current.y,z:current.z+dz*scale};
}

export function brFloorHeightAt(position: Vec3, previousY: number): number {
  // The fallback and vehicle surface queries must use the same real base
  // cutout as Rapier; y=0 would create a phantom floor above a sunken court.
  let floor = brBaseDeckHeight(position);
  for (const block of BR_MAP_BLOCKS) {
    if(block.rotation){
      const gradeFloor=brRoadGradeFloorAt(block,position);
      if(gradeFloor!==null){
        if(previousY>=gradeFloor-.5)floor=Math.max(floor,gradeFloor);
        continue;
      }
      // A diagonal ribbon's axis-aligned box also covers empty space beside
      // the road. Its exact grade query returning null means no floor here.
      if(block.id.endsWith("-surface"))continue;
    }
    const top=brBlockTopSurfaceAt(block,position);
    if(top!==null&&previousY>=top-.5)floor=Math.max(floor,top);
  }
  return floor;
}

export function stepBrMovement(current: BrMotionState, input: BrMotionInput, rawDt: number, now: number, resolveCollision?: BrCollisionResolver): BrMotionResult {
  const dt = brClamp(Number.isFinite(rawDt) ? rawDt : 0, 0, .1);
  const state: BrMotionResult = {
    ...current,
    position: { ...current.position },
    velocity: { ...current.velocity },
    yaw: Number.isFinite(input.yaw) ? input.yaw : current.yaw,
    landed: false,
    traversed: false
  };
  state.lastGroundedAt ??= state.grounded ? now : Number.NEGATIVE_INFINITY;
  state.jumpBufferedUntil ??= 0;
  if (state.deployment === "attached" || state.deployment === "eliminated") return state;
  const forward = { x: Math.sin(state.yaw), z: -Math.cos(state.yaw) }; const right = { x: Math.cos(state.yaw), z: Math.sin(state.yaw) };
  let mx = brClamp(Number(input.moveX) || 0, -1, 1); let my = brClamp(Number(input.moveY) || 0, -1, 1); const magnitude = Math.hypot(mx, my); if (magnitude > 1) { mx /= magnitude; my /= magnitude; }
  const desired = { x: right.x * mx + forward.x * my, z: right.z * mx + forward.z * my };
  if (state.deployment === "freefall" || state.deployment === "chute") {
    if (state.position.y <= BR_BALANCE.autoDeployHeight) state.deployment = "chute";
    const maxFall = state.deployment === "chute" ? BR_BALANCE.chuteSpeed : BR_BALANCE.freefallSpeed;
    const airSpeed=state.deployment==="chute"?BR_BALANCE.chuteHorizontalSpeed:BR_BALANCE.freefallHorizontalSpeed;
    state.velocity.x+=(desired.x*airSpeed-state.velocity.x)*Math.min(1,dt*BR_BALANCE.airSteering);
    state.velocity.z+=(desired.z*airSpeed-state.velocity.z)*Math.min(1,dt*BR_BALANCE.airSteering);
    state.velocity.y = Math.max(-maxFall, state.velocity.y - BR_BALANCE.gravity * dt);
  } else {
    const crouchSignal = Boolean(input.crouch);
    if (crouchSignal && !state.lastCrouchSignal && state.grounded && !state.downed && Math.hypot(state.velocity.x, state.velocity.z) > BR_BALANCE.walkSpeed) {
      const speed = Math.max(.001, Math.hypot(state.velocity.x, state.velocity.z));
      state.velocity.x = state.velocity.x / speed * BR_BALANCE.slideInitialSpeed; state.velocity.z = state.velocity.z / speed * BR_BALANCE.slideInitialSpeed; state.slideEndsAt = now + BR_BALANCE.slideDurationMs;
    }
    state.lastCrouchSignal = crouchSignal;
    const sliding=state.slideEndsAt>now;
    const speed = state.downed ? 1.8 : state.crouched || input.crouch || sliding ? BR_BALANCE.crouchSpeed : input.sprint ? BR_BALANCE.sprintSpeed : BR_BALANCE.walkSpeed;
    const currentPlanar=Math.hypot(state.velocity.x,state.velocity.z);
    const desiredX = desired.x * speed * Math.min(1, magnitude); const desiredZ = desired.z * speed * Math.min(1, magnitude);
    if (sliding) {
      const damping = Math.max(0, 1 - dt * 1.25); state.velocity.x *= damping; state.velocity.z *= damping;
      state.velocity.x += desiredX * dt * .18; state.velocity.z += desiredZ * dt * .18;
    } else {
      const desiredPlanar=Math.hypot(desiredX,desiredZ);
      const dot=state.velocity.x*desiredX+state.velocity.z*desiredZ;
      const groundAcceleration=desiredPlanar<.01&&currentPlanar>.01?BR_BALANCE.braking:dot<-.01?BR_BALANCE.reversalAcceleration:BR_BALANCE.acceleration;
      const acceleration=state.grounded?groundAcceleration:BR_BALANCE.acceleration*BR_BALANCE.airControl;
      const approached=brApproachPlanarVelocity(state.velocity,{x:desiredX,y:state.velocity.y,z:desiredZ},acceleration*dt);
      state.velocity.x=approached.x;state.velocity.z=approached.z;
    }
    const jumpSignal = Boolean(input.jump);
    if (jumpSignal && !state.lastJumpSignal) state.jumpBufferedUntil = now + BR_BALANCE.jumpBufferMs;
    if (state.grounded) state.lastGroundedAt = now;
    const canJump = !state.downed && state.jumpBufferedUntil >= now && (state.grounded || now - state.lastGroundedAt <= BR_BALANCE.coyoteMs);
    if (canJump) { state.velocity.y = BR_BALANCE.jumpSpeed; state.grounded = false; state.jumpBufferedUntil = 0; state.lastGroundedAt = Number.NEGATIVE_INFINITY; }
    state.lastJumpSignal = jumpSignal;
    if (!state.grounded) state.velocity.y -= BR_BALANCE.gravity * dt; else state.velocity.y = Math.min(0, state.velocity.y);
  }
  const desiredMovement = { x: state.velocity.x * dt, y: state.velocity.y * dt, z: state.velocity.z * dt };
  const next = { x: state.position.x + desiredMovement.x, y: state.position.y + desiredMovement.y, z: state.position.z + desiredMovement.z };
  const wasAirborne = !state.grounded || state.deployment === "freefall" || state.deployment === "chute";
  if (resolveCollision) {
    const collision = resolveCollision(state.position, desiredMovement, { jumping: state.velocity.y > .05, downed: state.downed, crouched: Boolean(input.crouch) || state.slideEndsAt>now || state.downed });
    next.x = state.position.x + collision.movement.x; next.y = state.position.y + collision.movement.y; next.z = state.position.z + collision.movement.z;
    state.crouched = collision.crouched ?? (Boolean(input.crouch) || state.downed);
    if (collision.grounded && state.velocity.y <= .05) {
      state.grounded = true; state.lastGroundedAt = now; if (state.velocity.y < 0) state.velocity.y = 0;
      if (state.deployment === "freefall" || state.deployment === "chute") state.deployment = "grounded";
      state.landed = wasAirborne;
    } else state.grounded = false;
    if (collision.ceiling && state.velocity.y > 0) state.velocity.y = 0;
  } else {
    state.crouched = Boolean(input.crouch) || state.downed;
    resolveBrBlockCollisions(state, next, Boolean(input.jump));
    const floor = brFloorHeightAt(next, state.position.y);
    if (isInsideBrIsland(next) && next.y <= floor && state.position.y >= floor - .45) {
      next.y = floor; if (state.velocity.y < 0) state.velocity.y = 0;
      state.grounded = true; state.lastGroundedAt = now; if (state.deployment === "freefall" || state.deployment === "chute") state.deployment = "grounded"; state.landed = wasAirborne;
    } else if (!isInsideBrIsland(next)) state.grounded = false;
  }
  if (state.landed && !state.downed && state.jumpBufferedUntil >= now) {
    state.velocity.y = BR_BALANCE.jumpSpeed; state.grounded = false; state.jumpBufferedUntil = 0; state.lastGroundedAt = Number.NEGATIVE_INFINITY;
  }
  state.traversed = applyBrTraversal(state, next, now);
  state.position = next;
  return state;
}

/** True when a crouched astronaut can safely expand to the standing capsule. */
export function brHasStandingClearance(feet: Vec3): boolean {
  const crouchedTop = feet.y + BR_BALANCE.playerRadius * 2 + .12;
  const standingTop = feet.y + BR_BALANCE.playerHeight;
  for (const block of brBlocksNear(feet, BR_BALANCE.playerRadius)) {
    if (block.kind !== "platform" && block.kind !== "bridge") continue;
    const bottom = block.position.y - block.size.y / 2;
    const top = block.position.y + block.size.y / 2;
    const withinX = Math.abs(feet.x - block.position.x) < block.size.x / 2 + BR_BALANCE.playerRadius * .82;
    const withinZ = Math.abs(feet.z - block.position.z) < block.size.z / 2 + BR_BALANCE.playerRadius * .82;
    if (withinX && withinZ && bottom >= crouchedTop - .04 && bottom < standingTop + .04 && top > crouchedTop) return false;
  }
  return true;
}

/** Returns a valid low ledge top only when the player is moving into that ledge. */
export function brMantleTopAt(feet: Vec3, desiredMovement: Vec3): number | null {
  const horizontal = Math.hypot(desiredMovement.x, desiredMovement.z);
  if (horizontal < .025) return null;
  const directionX = desiredMovement.x / horizontal;
  const directionZ = desiredMovement.z / horizontal;
  const candidate = { x: feet.x + desiredMovement.x, y: feet.y, z: feet.z + desiredMovement.z };
  let best = Number.POSITIVE_INFINITY;
  for (const block of brBlocksNear(candidate, BR_BALANCE.playerRadius + .18)) {
    if (block.kind !== "cover" && block.kind !== "wall") continue;
    const top = block.position.y + block.size.y / 2;
    const height = top - feet.y;
    if (height <= .35 || height > BR_BALANCE.mantleHeight + .4) continue;
    const toX = block.position.x - feet.x;
    const toZ = block.position.z - feet.z;
    if (toX * directionX + toZ * directionZ <= .08) continue;
    const withinX = Math.abs(candidate.x - block.position.x) <= block.size.x / 2 + BR_BALANCE.playerRadius;
    const withinZ = Math.abs(candidate.z - block.position.z) <= block.size.z / 2 + BR_BALANCE.playerRadius;
    if (!withinX || !withinZ || !brHasStandingClearance({ x: candidate.x, y: top + .03, z: candidate.z })) continue;
    best = Math.min(best, top);
  }
  return Number.isFinite(best) ? best : null;
}

function resolveBrBlockCollisions(state: BrMotionState, next: Vec3, jumpHeld: boolean): void {
  const feet = state.position.y;
  for (const block of brBlocksNear(next, 2.5)) {
    if (block.kind === "platform" || block.kind === "ramp") continue;
    const halfX = block.size.x / 2 + BR_BALANCE.playerRadius; const halfZ = block.size.z / 2 + BR_BALANCE.playerRadius;
    const top = block.position.y + block.size.y / 2; const bottom = block.position.y - block.size.y / 2;
    if (feet + BR_BALANCE.playerHeight <= bottom || feet >= top - .08 || Math.abs(next.x - block.position.x) >= halfX || Math.abs(next.z - block.position.z) >= halfZ) continue;
    const mantleHeight = top - feet;
    if (jumpHeld && mantleHeight <= BR_BALANCE.mantleHeight + .45 && !state.downed) { next.y = top; state.velocity.y = 0; state.grounded = true; continue; }
    const pushX = halfX - Math.abs(next.x - block.position.x); const pushZ = halfZ - Math.abs(next.z - block.position.z);
    if (pushX < pushZ) { next.x = block.position.x + Math.sign(next.x - block.position.x || 1) * halfX; state.velocity.x = 0; }
    else { next.z = block.position.z + Math.sign(next.z - block.position.z || 1) * halfZ; state.velocity.z = 0; }
  }
}

function applyBrTraversal(state: BrMotionState, next: Vec3, now: number): boolean {
  if (now < state.traversalCooldownUntil || state.deployment === "freefall" || state.deployment === "chute") return false;
  for (const traversal of BR_TRAVERSAL) {
    if (Math.hypot(next.x - traversal.position.x, next.z - traversal.position.z) > 3.2 || Math.abs(next.y - traversal.position.y) > 3) continue;
    if (traversal.kind === "grav-lift") { state.velocity.y = 15; state.grounded = false; }
    else { const dx = traversal.target.x - next.x; const dz = traversal.target.z - next.z; const magnitude = Math.max(1, Math.hypot(dx, dz)); state.velocity = { x: dx / magnitude * 18, y: 15, z: dz / magnitude * 18 }; state.grounded = false; }
    state.traversalCooldownUntil = now + 1300; return true;
  }
  return false;
}
