import type { BrPlayerState, BrTeamMode } from "@planetfall/shared";

/** UI-level teammate filtering is explicitly mode-aware. Team ids are an
 * authoritative grouping primitive, but Solo must never inherit squad chrome. */
export function brPresentedTeammates(
  teamMode: BrTeamMode,
  local: Pick<BrPlayerState, "id" | "teamId">,
  players: readonly BrPlayerState[],
): BrPlayerState[] {
  if (teamMode === "solo") return [];
  return players.filter((player) => player.id !== local.id && player.teamId === local.teamId);
}

export type BrTeammateStatus = "active" | "downed" | "eliminated" | "disconnected";

export function brTeammateStatus(player: Pick<BrPlayerState, "connected" | "alive" | "downed">): BrTeammateStatus {
  if (!player.connected) return "disconnected";
  if (!player.alive) return "eliminated";
  if (player.downed) return "downed";
  return "active";
}
