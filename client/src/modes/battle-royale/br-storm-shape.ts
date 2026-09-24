/** World-space visual dimensions. Never change authoritative circle/damage math. */
export const BR_STORM_BAND_SEGMENTS = 192;
export const BR_STORM_HEIGHT = 180;

export function brStormBandPositions(radius: number, target: Float32Array = new Float32Array((BR_STORM_BAND_SEGMENTS + 1) * 6)): Float32Array {
  const r = Number.isFinite(radius) ? Math.max(0, radius) : 0;
  // Keep the danger boundary thin at the opening circle AND the final circle.
  // The old scaled torus grew to twelve metres across at a 500m radius.
  const halfWidth = Math.min(.38, r * .5);
  for (let ring = 0; ring < 2; ring++) {
    for (let i = 0; i <= BR_STORM_BAND_SEGMENTS; i++) {
      const angle = i / BR_STORM_BAND_SEGMENTS * Math.PI * 2;
      const offset = (ring * (BR_STORM_BAND_SEGMENTS + 1) + i) * 3;
      target[offset] = Math.cos(angle) * (r + (ring ? halfWidth : -halfWidth));
      target[offset + 1] = .14;
      target[offset + 2] = Math.sin(angle) * (r + (ring ? halfWidth : -halfWidth));
    }
  }
  return target;
}

export function brStormDetail(quality: "low" | "medium" | "high", radius = 650) {
  const budget = quality === "low"
    ? {layers:1,arcs:4,sparks:90,streaks:10}
    : quality === "medium"
      ? {layers:2,arcs:8,sparks:180,streaks:20}
      : {layers:3,arcs:12,sparks:360,streaks:32};
  const circumference = Math.PI * 2 * (Number.isFinite(radius) ? Math.max(0, radius) : 0);
  // Preserve the continuous wall and ground boundary at every quality. Only
  // decorative sparks/arcs thin out as the same pool crowds a smaller circle.
  budget.arcs = Math.min(budget.arcs, Math.max(1, Math.ceil(circumference / 35)));
  budget.sparks = Math.min(budget.sparks, Math.max(12, Math.ceil(circumference / 3)));
  budget.streaks = Math.min(budget.streaks, Math.max(4, Math.ceil(circumference / 11)));
  return budget;
}

export function brStormLayerSpacing(radius: number): number {
  const r = Number.isFinite(radius) ? Math.max(0, radius) : 0;
  // Secondary curtains stay outside the true boundary, but never balloon into
  // separate concentric walls when the final circle approaches zero.
  return Math.min(.35, r * .025);
}

export function brStormCurtainRepeats(radius: number): number {
  const r = Number.isFinite(radius) ? Math.max(0, radius) : 0;
  // A fractional repeat ends on a different texel at the cylinder seam.
  return Math.max(1, Math.round(Math.PI * 2 * r / 38));
}
