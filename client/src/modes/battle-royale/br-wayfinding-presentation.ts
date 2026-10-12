/** Camera-facing navigation billboards disappear before they fill the view. */
export const BR_WAYFINDING_NEAR_HIDDEN_DISTANCE = 18;
export const BR_WAYFINDING_NEAR_VISIBLE_DISTANCE = 32;
export const BR_WAYFINDING_FAR_VISIBLE_DISTANCE = 160;
export const BR_WAYFINDING_FAR_HIDDEN_DISTANCE = 200;

const smoothstep = (t: number): number => t * t * (3 - 2 * t);

/** Euclidean camera-to-sign distance; no state, allocations or material writes. */
export function brWayfindingOpacity(distance: number): number {
  if (!Number.isFinite(distance) || distance <= BR_WAYFINDING_NEAR_HIDDEN_DISTANCE || distance >= BR_WAYFINDING_FAR_HIDDEN_DISTANCE) return 0;
  if (distance < BR_WAYFINDING_NEAR_VISIBLE_DISTANCE) {
    return smoothstep((distance - BR_WAYFINDING_NEAR_HIDDEN_DISTANCE) /
      (BR_WAYFINDING_NEAR_VISIBLE_DISTANCE - BR_WAYFINDING_NEAR_HIDDEN_DISTANCE));
  }
  if (distance <= BR_WAYFINDING_FAR_VISIBLE_DISTANCE) return 1;
  return 1 - smoothstep((distance - BR_WAYFINDING_FAR_VISIBLE_DISTANCE) /
    (BR_WAYFINDING_FAR_HIDDEN_DISTANCE - BR_WAYFINDING_FAR_VISIBLE_DISTANCE));
}
