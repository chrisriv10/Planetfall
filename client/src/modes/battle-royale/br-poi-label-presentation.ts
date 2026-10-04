import type { Vec3 } from "@planetfall/shared";

export type BrPoiLabelPresentation = {
  visible: boolean;
  opacity: number;
  scale: number;
};

const horizontalDistance = (first: Vec3, second: Vec3) => Math.hypot(first.x - second.x, first.z - second.z);
const distance = (first: Vec3, second: Vec3) => Math.hypot(first.x - second.x, first.y - second.y, first.z - second.z);

/**
 * Keeps navigation labels useful from the Starliner and on long approaches,
 * then yields to authored facade signs and combat UI near the destination.
 * `scale` is the height-independent billboard unit consumed by BrGame.
 */
export function brPoiLabelPresentation(
  playerPosition: Vec3 | undefined,
  labelPosition: Vec3,
  cameraPosition: Vec3,
  airborne: boolean
): BrPoiLabelPresentation {
  if (![...Object.values(labelPosition), ...Object.values(cameraPosition)].every(Number.isFinite)) {
    return { visible: false, opacity: 0, scale: 0 };
  }
  const cameraDistance = distance(cameraPosition, labelPosition);
  const playerDistance = playerPosition && Object.values(playerPosition).every(Number.isFinite)
    ? horizontalDistance(playerPosition, labelPosition)
    : cameraDistance;
  const minimumDistance = airborne ? 62 : 92;
  const visible = cameraDistance < 780 && playerDistance > minimumDistance;
  if (!visible) return { visible: false, opacity: 0, scale: 0 };

  return {
    visible: true,
    opacity: Math.min(.82, Math.max(.2, (playerDistance - minimumDistance) / 78)),
    scale: Math.min(12.5, Math.max(6.5, cameraDistance * .018))
  };
}
