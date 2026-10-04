export type BrReviewCamera = { position: readonly [number, number, number]; focus: readonly [number, number, number] };

/** Deterministic development-only framing for screenshot review. Keeping the
 * points outside br-game makes them independently collision-testable after a
 * map-layout change. */
export const BR_REVIEW_CAMERAS: Readonly<Record<string, BrReviewCamera>> = {
  "zero-plaza": { position: [0, 4.5, -42], focus: [0, 15, 0] },
  "nova-street": { position: [-175, 2.7, -112], focus: [-175, 7, -165] },
  "nova-storefront": { position: [-175, 2.7, -92], focus: [-207, 3.2, -103] },
  "nova-roof": { position: [-209, 40, -137], focus: [-171, 20, -125] },
  "mall-interior": { position: [-106, 2.7, 252], focus: [-80, 5, 264] },
  "mall-directory": { position: [-115, 2.5, 253.5], focus: [-124.7, 2.1, 253.5] },
  "mall-ramp": { position: [-86, 2.3, 251.5], focus: [-75.7, 4.5, 263] },
  "mall-ceiling": { position: [-115, 2.4, 266], focus: [-124, 8, 263] },
  "hotel-lounge": { position: [-94, 2.2, -236], focus: [-104.8, 2.35, -236] },
  "hotel-lobby": { position: [-94, 2.2, -236], focus: [-104.8, 2.35, -236] },
  "hotel-stairs": { position: [-86, 2.2, -236], focus: [-88, 6.8, -245] },
  "hotel-service-wall": { position: [-89, 2.3, -241], focus: [-105.5, 2.5, -241] },
  "housing-lounge": { position: [-54, 2.2, -47.2], focus: [-60.4, 2.6, -47.2] },
  "hotel-landing": { position: [-87.5, 8.8, -245], focus: [-94, 4.2, -236] },
  "helios-interior": { position: [262, 2.7, 64], focus: [262, 5, 88] },
  "crash-exterior": { position: [-312, 16, -290], focus: [-326, 3.2, -258] },
  "crash-interior": { position: [-304, 2.7, -258], focus: [-341, 4, -258] },
  "foundry-interior": { position: [342, 2.7, -81], focus: [350, 5, -61] },
  "foundry-roof": { position: [342, 24.7, -60], focus: [352, 28, -73] },
  "roadside-south": { position: [15, 7.15, -380], focus: [15, 5.35, -415] },
  "roadside-nova": { position: [-76, 3.1, -178], focus: [-76, 3, -214] },
  "connective-academy": { position: [-265, 9.1, 280], focus: [-265, 7.9, 235] },
  "east-checkpoint-deck": { position: [355, 8.4, 292], focus: [355, 7.2, 250] },
  "academy-commons-grade": { position: [-207, 11.5, 211], focus: [-231, 3.2, 234] },
  "east-checkpoint-grade": { position: [297, 2.8, 171], focus: [328, 5.6, 208] },
  "south-terminal-grade": { position: [15, 3.1, -350], focus: [15, 5.2, -388] },
  "south-terminal-apron": { position: [-15, 5.35, -386], focus: [7, 4.1, -401] },
  "south-shipworks-grade": { position: [133, 4.1, -347], focus: [183, 6.5, -374] },
  "maintenance-south": { position: [190, 7.65, -360], focus: [190, 5.85, -400] },
  "deck-transition": { position: [-255, 3.2, 8], focus: [-255, 2.2, -30] },
  "sector-field": { position: [382, 3.2, 105], focus: [425, 2.2, 105] },
  "edge-south": { position: [0, 12, -550], focus: [0, -13, -455] },
  "storm-boundary": { position: [-184, 2.7, -40], focus: [-184, 7, -10] },
  "storm-final": { position: [-184, 2.7, -96], focus: [-184, 7, -60] },
  "aerial": { position: [-430, 520, 540], focus: [0, 0, 0] }
};

