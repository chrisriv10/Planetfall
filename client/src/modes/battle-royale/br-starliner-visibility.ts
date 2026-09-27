import type { BrDeploymentState, BrPhase } from "@planetfall/shared";

// The transport's engine trails extend roughly 70m from its authored origin.
// Keep additional camera clearance so an origin that is technically distant
// cannot still put the underside or exhaust cones across the whole viewport.
export const BR_STARLINER_CAMERA_CULL_RADIUS = 105;

export function shouldKeepStarlinerInDropView(
  phase: BrPhase | undefined,
  renderedDeployment: BrDeploymentState | undefined,
  snapshotDeployment: BrDeploymentState | undefined
): boolean {
  if (phase !== "ship") return false;
  // The room player is what the ship camera is following. During the first
  // snapshot after countdown, localState can still contain the previous
  // grounded state (or be absent), so it must not hide the transport.
  return renderedDeployment === "attached" || (renderedDeployment === undefined && snapshotDeployment === "attached") || (renderedDeployment === undefined && snapshotDeployment === undefined);
}

export function shouldHideStarlinerNearCamera(
  phase: BrPhase | undefined,
  renderedDeployment: BrDeploymentState | undefined,
  snapshotDeployment: BrDeploymentState | undefined,
  distance: number
): boolean {
  return Number.isFinite(distance)
    && distance < BR_STARLINER_CAMERA_CULL_RADIUS
    && !shouldKeepStarlinerInDropView(phase, renderedDeployment, snapshotDeployment);
}
