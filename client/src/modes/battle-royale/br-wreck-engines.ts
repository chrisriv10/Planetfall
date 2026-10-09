import type {BrStructure} from "@planetfall/shared";

/** External end-cap hardware; the torus tube clears the complete wall and its
 * sibling ring. Coordinates are fuselage-local, before the POI display offset. */
export function buildBrWreckEngineMounts(s:BrStructure){
  const radius=3.7,tube=.72,spacing=radius+tube+.12;
  return [-1,1].map(side=>({radius,tube,x:-s.size.x/2-tube-.4,y:4.6,z:side*spacing,emberX:-s.size.x/2-.9}));
}
