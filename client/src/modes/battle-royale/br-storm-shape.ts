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

export function brStormDetail(quality: "low" | "medium" | "high") {
  return quality === "low" ? {layers:1,arcs:4,sparks:90} : quality === "medium" ? {layers:2,arcs:8,sparks:180} : {layers:3,arcs:12,sparks:360};
}
