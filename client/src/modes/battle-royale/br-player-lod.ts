import type { GraphicsQuality } from "../../settings";

const FAR_PLAYER_DISTANCE: Record<GraphicsQuality, number> = {
  low: 34,
  medium: 52,
  high: 76
};

/**
 * Remote grounded astronauts collapse to a two-draw instanced silhouette at
 * distance. Airborne players retain Ion Wings and full drop readability.
 */
export function useBrPlayerImpostor(
  distance: number,
  quality: GraphicsQuality,
  isLocal: boolean,
  deployment: string,
  downed: boolean
): boolean {
  return !isLocal && !downed && deployment === "grounded" && distance > FAR_PLAYER_DISTANCE[quality];
}
