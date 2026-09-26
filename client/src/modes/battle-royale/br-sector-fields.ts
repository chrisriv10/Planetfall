import {
  BR_ISLAND_OUTLINE,
  BR_MAP_BLOCKS,
  BR_POIS,
  BR_ROADS,
  BR_SECONDARY_LOCATIONS,
  BR_STRUCTURES,
  BR_TERRAIN_PATCHES,
  BR_TRAVERSAL,
  type BrDistrictStyle,
  type BrMapBlock,
  type BrRoadSegment,
  type BrSecondaryLocation,
  type BrStructure,
  type BrTerrainPatch,
  type Vec3
} from "@planetfall/shared";
import { buildDeckTransitions, existingDeckTransitionReservations } from "./br-deck-transitions";

export const BR_SECTOR_FIELD_RADIUS = 19;

export type BrSectorFieldFinish =
  | "paintedMetal"
  | "brushedMetal"
  | "structuralDark"
  | "sidewalk"
  | "industrialOrange"
  | "energyCyan"
  | "energyPurple"
  | "warningRed";

export interface BrSectorFieldPart {
  finish: BrSectorFieldFinish;
  position: Vec3;
  scale: Vec3;
  rotationY: number;
  layer: 2 | 3;
}

export interface BrSectorField {
  roadId: string;
  center: Vec3;
  style: BrDistrictStyle;
  parts: BrSectorFieldPart[];
}

interface SectorFieldInputs {
  roads: readonly BrRoadSegment[];
  structures: readonly BrStructure[];
  blocks: readonly BrMapBlock[];
  locations: readonly BrSecondaryLocation[];
  patches: readonly BrTerrainPatch[];
  traversal: readonly { position: Vec3 }[];
  outline: readonly (readonly [number, number])[];
  reserved: readonly { position: Vec3; radius: number }[];
}

const distance = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.z - b.z);
const segmentDistance = (p: Vec3, a: Vec3, b: Vec3) => {
  const dx = b.x - a.x, dz = b.z - a.z, squared = dx * dx + dz * dz;
  const t = squared ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / squared)) : 0;
  return Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t);
};
const boxDistance = (point: Vec3, position: Vec3, size: Vec3, rotation = 0) => {
  const dx = point.x - position.x, dz = point.z - position.z;
  const localX = dx * Math.cos(rotation) - dz * Math.sin(rotation);
  const localZ = dx * Math.sin(rotation) + dz * Math.cos(rotation);
  return Math.hypot(Math.max(0, Math.abs(localX) - size.x / 2), Math.max(0, Math.abs(localZ) - size.z / 2));
};

function defaultReservations(): SectorFieldInputs["reserved"] {
  return [
    ...existingDeckTransitionReservations(),
    ...buildDeckTransitions().map(site => ({ position: site.center, radius: BR_SECTOR_FIELD_RADIUS })),
    ...BR_SECONDARY_LOCATIONS.map(location => ({ position: location.position, radius: 40 }))
  ];
}

function isInsideWithEdgeClearance(center: Vec3, outline: SectorFieldInputs["outline"]): boolean {
  let inside = false;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const [x, z] = outline[i], [previousX, previousZ] = outline[j];
    if ((z > center.z) !== (previousZ > center.z)
      && center.x < (previousX - x) * (center.z - z) / (previousZ - z) + x) inside = !inside;
    if (segmentDistance(center, { x, y: 0, z }, { x: previousX, y: 0, z: previousZ }) < BR_SECTOR_FIELD_RADIUS + 4) return false;
  }
  return inside;
}

function isClear(center: Vec3, inputs: SectorFieldInputs, fields: readonly BrSectorField[]): boolean {
  const radius = BR_SECTOR_FIELD_RADIUS;
  if (!isInsideWithEdgeClearance(center, inputs.outline)) return false;
  if (inputs.roads.some(road => segmentDistance(center, road.from, road.to) < road.width / 2 + radius + 3
    || Math.min(distance(center, road.from), distance(center, road.to)) < radius + 22)) return false;
  if (inputs.structures.some(structure => boxDistance(center, structure.position, structure.size) < radius + 4)) return false;
  for (const block of inputs.blocks) {
    const clearance = block.rotation
      ? distance(center, block.position) - Math.hypot(block.size.x, block.size.y, block.size.z) / 2
      : boxDistance(center, block.position, block.size);
    if (clearance < radius + 3) return false;
  }
  if (inputs.patches.some(patch => boxDistance(center, patch.position, patch.size, patch.rotation) < radius + 3)) return false;
  if (inputs.locations.some(location => distance(center, location.position) < radius + 40)) return false;
  if (inputs.traversal.some(item => distance(center, item.position) < radius + 10)) return false;
  if (inputs.reserved.some(item => distance(center, item.position) < radius + item.radius + 2)) return false;
  return fields.every(field => distance(center, field.center) >= radius * 2 + 8);
}

function nearestStyle(center: Vec3): BrDistrictStyle {
  return [...BR_POIS].sort((a, b) => distance(center, a.position) - distance(center, b.position)
    || a.id.localeCompare(b.id))[0]?.style ?? "nexus";
}

function createParts(center: Vec3, angle: number, style: BrDistrictStyle): BrSectorFieldPart[] {
  const parts: BrSectorFieldPart[] = [];
  const accent: BrSectorFieldFinish = style === "city" || style === "mall" || style === "academy"
    ? "energyPurple"
    : style === "dock" || style === "industrial" || style === "reactor"
      ? "industrialOrange"
      : style === "wreck" ? "warningRed" : "energyCyan";
  const add = (finish: BrSectorFieldFinish, localX: number, localZ: number, width: number, depth: number, layer: 2 | 3) => {
    parts.push({
      finish,
      layer,
      rotationY: -angle,
      position: {
        x: center.x + Math.cos(angle) * localX - Math.sin(angle) * localZ,
        y: layer === 2 ? .018 : .033,
        z: center.z + Math.sin(angle) * localX + Math.cos(angle) * localZ
      },
      scale: { x: width, y: .008, z: depth }
    });
  };

  // Four separated armor cells retain city-scale composition while leaving a
  // visible deck cross through the kit. This avoids reading as a dark landing
  // pad or as a single missing-collision platform from player height.
  for (const localX of [-6.9, 6.9]) for (const localZ of [-5.1, 5.1]) {
    add("paintedMetal", localX, localZ, 12, 7, 2);
    add("brushedMetal", localX, localZ + Math.sign(localZ) * 2.25, 9.6, .14, 3);
  }
  add("structuralDark", 0, 0, .22, 16.2, 3);
  for (const offset of [-4.8, 4.8]) add(accent, offset, 0, .34, 7.2, 3);
  for (const offset of [-1, 0, 1]) add("sidewalk", 0, offset * 3.1, 1.25, .18, 3);
  return parts;
}

/**
 * Large-scale, flush orbital deck composition for long empty road corridors.
 * These fields are visual-only and deliberately avoid every gameplay route,
 * collider, authored terrain treatment, traversal device and existing kit.
 */
export function buildBrSectorFields(overrides: Partial<SectorFieldInputs> = {}): BrSectorField[] {
  const inputs: SectorFieldInputs = {
    roads: BR_ROADS,
    structures: BR_STRUCTURES,
    blocks: BR_MAP_BLOCKS,
    locations: BR_SECONDARY_LOCATIONS,
    patches: BR_TERRAIN_PATCHES,
    traversal: BR_TRAVERSAL,
    outline: BR_ISLAND_OUTLINE,
    reserved: overrides.reserved ?? defaultReservations(),
    ...overrides
  };
  const roads = [...inputs.roads].filter(road => [road.from.x, road.from.z, road.to.x, road.to.z, road.width].every(Number.isFinite)
      && road.width > 0 && distance(road.from, road.to) >= 82)
    .sort((a, b) => distance(b.from, b.to) - distance(a.from, a.to) || a.id.localeCompare(b.id));
  if (inputs.outline.length < 3 || inputs.outline.some(point => !point.every(Number.isFinite))) return [];

  const fields: BrSectorField[] = [];
  for (const road of roads) {
    if (fields.length === 10) break;
    const dx = road.to.x - road.from.x, dz = road.to.z - road.from.z, length = Math.hypot(dx, dz);
    let placed = false;
    for (const t of [.3, .7, .46, .54, .2, .8]) {
      for (const side of [-1, 1]) {
        for(const extraOffset of [0,12,24,36]){
          const offset = road.width / 2 + BR_SECTOR_FIELD_RADIUS + 5 + extraOffset;
          const center = {
            x: road.from.x + dx * t - dz / length * offset * side,
            y: 0,
            z: road.from.z + dz * t + dx / length * offset * side
          };
          if (!isClear(center, inputs, fields)) continue;
          const style = nearestStyle(center);
          fields.push({ roadId: road.id, center, style, parts: createParts(center, Math.atan2(dz, dx), style) });
          placed = true;
          break;
        }
        if(placed)break;
      }
      if (placed) break;
    }
  }
  return fields;
}
