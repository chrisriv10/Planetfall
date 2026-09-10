import { BR_BALANCE } from "./balance.js";
import { BR_MAP_BLOCKS, BR_TRAVERSAL, brBlocksNear, isInsideBrIsland } from "./map.js";
import { brClamp } from "./math.js";
import type { BrDeploymentState } from "./types.js";
import type { Vec3 } from "../index.js";

export interface BrMotionState {
  position: Vec3;
  velocity: Vec3;
  yaw: number;
  grounded: boolean;
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

export interface BrCollisionResult { movement: Vec3; grounded: boolean; ceiling: boolean; }
export type BrCollisionResolver = (position: Vec3, desiredMovement: Vec3, options: { jumping: boolean; downed: boolean; crouched: boolean }) => BrCollisionResult;

export function brFloorHeightAt(position: Vec3, previousY: number): number {
  let floor = 0;
  for (const block of BR_MAP_BLOCKS) {
    const halfX = block.size.x / 2; const halfZ = block.size.z / 2; const top = block.position.y + block.size.y / 2;
    if (Math.abs(position.x - block.position.x) <= halfX && Math.abs(position.z - block.position.z) <= halfZ && previousY >= top - .5) floor = Math.max(floor, top);
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
    const airSpeed = state.deployment === "chute" ? 8 : 12;
    state.velocity.x += (desired.x * airSpeed - state.velocity.x) * Math.min(1, dt * 2.4);
    state.velocity.z += (desired.z * airSpeed - state.velocity.z) * Math.min(1, dt * 2.4);
    state.velocity.y = Math.max(-maxFall, state.velocity.y - BR_BALANCE.gravity * dt);
  } else {
    const crouchSignal = Boolean(input.crouch);
    if (crouchSignal && !state.lastCrouchSignal && state.grounded && !state.downed && Math.hypot(state.velocity.x, state.velocity.z) > BR_BALANCE.walkSpeed) {
      const speed = Math.max(.001, Math.hypot(state.velocity.x, state.velocity.z));
      state.velocity.x = state.velocity.x / speed * BR_BALANCE.slideInitialSpeed; state.velocity.z = state.velocity.z / speed * BR_BALANCE.slideInitialSpeed; state.slideEndsAt = now + BR_BALANCE.slideDurationMs;
    }
    state.lastCrouchSignal = crouchSignal;
    const speed = state.downed ? 1.8 : input.crouch ? BR_BALANCE.crouchSpeed : input.sprint ? BR_BALANCE.sprintSpeed : BR_BALANCE.walkSpeed;
    const acceleration = state.grounded ? BR_BALANCE.acceleration : BR_BALANCE.acceleration * BR_BALANCE.airControl;
    const desiredX = desired.x * speed * Math.min(1, magnitude); const desiredZ = desired.z * speed * Math.min(1, magnitude);
    if (state.slideEndsAt > now) {
      const damping = Math.max(0, 1 - dt * 1.45); state.velocity.x *= damping; state.velocity.z *= damping;
      state.velocity.x += desiredX * dt * .18; state.velocity.z += desiredZ * dt * .18;
    } else {
      state.velocity.x += brClamp(desiredX - state.velocity.x, -acceleration * dt, acceleration * dt);
      state.velocity.z += brClamp(desiredZ - state.velocity.z, -acceleration * dt, acceleration * dt);
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
    const collision = resolveCollision(state.position, desiredMovement, { jumping: state.velocity.y > .05, downed: state.downed, crouched: Boolean(input.crouch) || state.downed });
    next.x = state.position.x + collision.movement.x; next.y = state.position.y + collision.movement.y; next.z = state.position.z + collision.movement.z;
    if (collision.grounded && state.velocity.y <= .05) {
      state.grounded = true; state.lastGroundedAt = now; if (state.velocity.y < 0) state.velocity.y = 0;
      if (state.deployment === "freefall" || state.deployment === "chute") state.deployment = "grounded";
      state.landed = wasAirborne;
    } else state.grounded = false;
    if (collision.ceiling && state.velocity.y > 0) state.velocity.y = 0;
  } else {
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
