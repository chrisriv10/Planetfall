import { BR_ROADS, brAuthoredDeckHeight } from "@planetfall/shared";
export type BrReviewCamera = { position: readonly [number, number, number]; focus: readonly [number, number, number] };

/** Deterministic development-only framing for screenshot review. Keeping the
 * points outside br-game makes them independently collision-testable after a
 * map-layout change. */
const BASE_REVIEW_CAMERAS: Readonly<Record<string, BrReviewCamera>> = {
  "zero-plaza": { position: [0, 4.5, -42], focus: [0, 15, 0] },
  "transit-court": { position: [129.5, 2.7, 127], focus: [129.5, 2.2, 72] },
  "nova-street": { position: [-175, 2.7, -112], focus: [-175, 7, -165] },
  "nova-storefront": { position: [-175, 2.7, -92], focus: [-207, 3.2, -103] },
  // View the market's real east entrance and the newly separated studio
  // frontage from road height, rather than hiding their former intersection
  // with an aerial camera or looking at the opposite cafe block.
  "nova-east-block": { position: [-96, 2.7, -85], focus: [-145, 3.2, -108] },
  "nova-roof": { position: [-209, 40, -137], focus: [-171, 20, -125] },
  // Ground-level edge views expose surface patches spanning a retaining wall;
  // aerial/rooftop views can hide an unsupported decorative overhang.
  "astra-deck-edge": { position: [-278, 2.7, 3], focus: [-278, 3, 30] },
  "helios-deck-edge": { position: [262, 2.7, 1], focus: [262, 3, 29] },
  // Inspect the actual low-level travel gap below the Helios–Farms grade,
  // rather than hiding the lack of enclosure with an aerial camera.
  "farm-transfer-corridor": { position: [180, 2.7, 199], focus: [225, 2.7, 200] },
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
  // South Exchange now occupies the former ring-s stop. Review the remaining
  // Crash–Hotel service pocket, not an empty retired location or a deck grade.
  "roadside-south": { position: [-138.3, 3.1, -284], focus: [-138.3, 2.2, -300.5] },
  "roadside-nova": { position: [-76, 3.1, -178], focus: [-76, 3, -214] },
  "west-neighborhood-link": { position: [-309, 2.7, -43], focus: [-350, 2.4, -105] },
  "west-transit-avenue": { position: [-320, 2.7, -165], focus: [-315, 2.5, -131] },
  "north-garden-promenade": { position: [-108, 2.7, 438], focus: [-135, 2.4, 390] },
  "southwest-salvage-grade": { position: [-238, 2.7, -442], focus: [-232, 3.4, -399] },
  "south-freight-boulevard": { position: [188, 2.7, -318], focus: [190, 2.6, -280] },
  "southeast-industrial-triangle": { position: [414, 3.0, -260], focus: [370, 4.2, -243] },
  "north-skywalk": { position: [-161, 2.7, 452], focus: [-150, 2.5, 420] },
  "solar-rim-grade": { position: [163, 5.7, 447], focus: [168, 1.2, 393] },
  "solar-service-street": { position: [180, 2.7, 434], focus: [180, 2.7, 400] },
  "south-ring-frontage": { position: [-210, 2.7, -340], focus: [-210, 2.7, -312] },
  "south-rim-loop": { position: [-72, 7.1, -477], focus: [-70, 4.8, -438] },
  "central-civic-junction": { position: [18, 2.7, -148], focus: [-4, 2.6, -105] },
  "central-frontage": { position: [-65, 2.7, -72], focus: [-65, 2.7, -100] },
  "hotel-frontage": { position: [-70, 2.7, -244], focus: [-81, 2.7, -224] },
  "academy-dorms-frontage": { position: [-369, 2.7, 182], focus: [-375, 2.7, 167] },
  "west-overlook-frontage": { position: [-411, 2.7, 45], focus: [-397, 2.7, 31] },
  "south-central-grid": { position: [-78, 2.7, -318], focus: [-76, 2.5, -278] },
  "south-exchange": { position: [-76, 2.7, -365], focus: [-76, 3.2, -310] },
  "zero-coolant-avenue": { position: [42, 2.7, 115], focus: [76, 2.5, 118] },
  "connective-academy": { position: [-265, 9.1, 280], focus: [-265, 7.9, 235] },
  "east-checkpoint-deck": { position: [355, 8.4, 292], focus: [355, 7.2, 250] },
  "academy-commons-grade": { position: [-207, 11.5, 211], focus: [-231, 3.2, 234] },
  "east-checkpoint-grade": { position: [297, 2.8, 171], focus: [328, 5.6, 208] },
  "south-terminal-grade": { position: [15, 3.1, -350], focus: [15, 5.2, -388] },
  "south-terminal-apron": { position: [-15, 5.35, -386], focus: [7, 4.1, -401] },
  "south-terminal-skimmer": { position: [10, 6.15, -377], focus: [2, 4.65, -386] },
  "south-shipworks-grade": { position: [133, 4.1, -347], focus: [183, 6.5, -374] },
  "maintenance-south": { position: [190, 7.65, -360], focus: [190, 5.85, -400] },
  "south-transfer-bridge": { position: [105, 2.7, -448], focus: [105, 4.1, -407.5] },
  "deck-transition": { position: [-255, 3.2, 8], focus: [-255, 2.2, -30] },
  // East Rim is a full six-metre raised district. Keep this connective-field
  // review at astronaut eye height above that deck rather than inside its
  // structural platform, where the underside used to occlude most of frame.
  "sector-field": { position: [382, 9.2, 105], focus: [425, 7.6, 105] },
  "edge-south": { position: [0, 12, -550], focus: [0, -13, -455] },
  "storm-boundary": { position: [-184, 2.7, -40], focus: [-184, 7, -10] },
  "storm-final": { position: [-184, 2.7, -96], focus: [-184, 7, -60] },
  "aerial": { position: [-430, 520, 540], focus: [0, 0, 0] }
};
export const BR_REVIEW_CAMERAS: Readonly<Record<string, BrReviewCamera>>=Object.fromEntries(Object.entries(BASE_REVIEW_CAMERAS).map(([id,view])=>{
  const lift=(point:readonly [number,number,number]):[number,number,number]=>{
    let floor=brAuthoredDeckHeight({x:point[0],z:point[2]});
    // Street-eye review points also track the actual graded road below them.
    // Existing elevated review fixtures already include their original deck.
    if(point[1]<4)for(const road of BR_ROADS){
      const dx=road.to.x-road.from.x,dz=road.to.z-road.from.z,lengthSq=dx*dx+dz*dz;
      const t=((point[0]-road.from.x)*dx+(point[2]-road.from.z)*dz)/lengthSq;
      if(t>=0&&t<=1&&Math.hypot(point[0]-road.from.x-dx*t,point[2]-road.from.z-dz*t)<=road.width/2)floor=Math.max(floor,road.from.y+(road.to.y-road.from.y)*t-.1);
    }
    return [point[0],point[1]+floor,point[2]];
  };
  return [id,{position:lift(view.position),focus:lift(view.focus)}];
}));

