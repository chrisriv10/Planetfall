import type { BrDeploymentState, BrPhase } from "@planetfall/shared";

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
