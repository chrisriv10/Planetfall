import type { BrDeploymentState } from "./types.js";

export type BrSpectatorCandidate = {
  alive: boolean;
  downed: boolean;
  grounded: boolean;
  deployment: BrDeploymentState;
  position: { y: number };
};

/** Lower is a better automatic spectating target. Players descending over the
 * playable deck remain useful; players already below it are a last resort. */
export function brSpectatorPriority(candidate: BrSpectatorCandidate): number {
  if (!candidate.alive) return 99;
  if (!Number.isFinite(candidate.position.y)) return 98;
  if (!candidate.downed && candidate.deployment === "grounded" && candidate.position.y >= -.5) return 0;
  if (candidate.downed && candidate.position.y >= -.5) return 1;
  if ((candidate.deployment === "freefall" || candidate.deployment === "chute" || candidate.deployment === "attached") && candidate.position.y >= 0) return 2;
  return 3;
}

export function preferBrSpectator<T extends BrSpectatorCandidate>(candidates: readonly T[]): T | null {
  let best: T | null = null;
  let bestPriority = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const priority = brSpectatorPriority(candidate);
    if (priority < bestPriority) { best = candidate; bestPriority = priority; }
  }
  return best;
}
