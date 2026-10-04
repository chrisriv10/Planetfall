/**
 * Presentation scale references for Orbital Isle.
 *
 * The canonical Planetfall astronaut is approximately two metres tall in the
 * BR world. These ranges are intentionally broad enough for stylisation while
 * preventing decorative props from quietly drifting into toy-miniature or
 * giant-furniture proportions. They do not describe collision geometry.
 */
export const BR_ASTRONAUT_REFERENCE_HEIGHT = 2;

export interface BrPresentationScaleRange {
  min: number;
  max: number;
}

export const BR_ENVIRONMENT_SCALE = {
  benchSeatTop: { min: .40, max: .56 },
  benchBackTop: { min: .78, max: 1.18 },
  cafeSeatTop: { min: .40, max: .55 },
  cafeTableTop: { min: .82, max: 1.05 },
  streetLightHeight: { min: 2.5, max: 4.5 },
  ornamentalTreeHeight: { min: 3.7, max: 6.5 },
  ornamentalTrunkDiameter: { min: .18, max: .65 },
  entranceClearHeight: { min: 2.35, max: 4.8 },
  oneSeatTransportWidth: { min: 1.8, max: 3.0 },
  oneSeatTransportLength: { min: 3.4, max: 5.6 },
  oneSeatTransportHeight: { min: 1.1, max: 2.2 },
} as const satisfies Record<string, BrPresentationScaleRange>;

export function isWithinBrPresentationScale(value: number, range: BrPresentationScaleRange): boolean {
  return Number.isFinite(value) && value >= range.min && value <= range.max;
}

