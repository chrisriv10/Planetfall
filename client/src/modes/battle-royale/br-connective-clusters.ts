import {
  BR_ISLAND_OUTLINE, BR_MAP_BLOCKS, BR_POIS, BR_ROADS, BR_SECONDARY_LOCATIONS, BR_STRUCTURES, BR_TERRAIN_PATCHES, BR_TRAVERSAL,
  type BrDistrictStyle, type BrMapBlock, type BrRoadSegment, type BrStructure, type BrTerrainPatch, type Vec3
} from "@planetfall/shared";
import { BR_DECK_TRANSITION_RADIUS, buildDeckTransitions, existingDeckTransitionReservations } from "./br-deck-transitions";
import { BR_SECTOR_FIELD_RADIUS, buildBrSectorFields } from "./br-sector-fields";

export const BR_CONNECTIVE_CLUSTER_RADIUS = 7;
export type ConnectiveClusterTheme = "cargo" | "service" | "transit" | "landscape";
export interface ConnectiveClusterPart {
  geometry: "box" | "cylinder" | "octahedron";
  finish: "paintedMetal" | "brushedMetal" | "sidewalk" | "industrialOrange" | "windowLit" | "soil" | "grass";
  position: Vec3;
  scale: Vec3;
  rotationY: number;
  surface: boolean;
}
export interface ConnectiveCluster {
  roadId: string;
  locationId: string;
  style: BrDistrictStyle;
  theme: ConnectiveClusterTheme;
  center: Vec3;
  radius: number;
  parts: ConnectiveClusterPart[];
}
interface ClusterInputs {
  roads: readonly BrRoadSegment[];
  structures: readonly BrStructure[];
  blocks: readonly BrMapBlock[];
  patches: readonly BrTerrainPatch[];
  locations: readonly { id: string; position: Vec3; style: BrDistrictStyle }[];
  traversal: readonly { position: Vec3 }[];
  outline: readonly (readonly [number, number])[];
  reserved: readonly { position: Vec3; radius: number }[];
}
const distance = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.z - b.z);
const segmentDistance = (p: Vec3, a: Vec3, b: Vec3) => {
  const dx = b.x - a.x, dz = b.z - a.z, sq = dx * dx + dz * dz;
  const t = sq ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / sq)) : 0;
  return Math.hypot(p.x - a.x - t * dx, p.z - a.z - t * dz);
};
const rectDistance = (p: Vec3, center: Vec3, size: Vec3, angle = 0) => {
  const dx = p.x - center.x, dz = p.z - center.z;
  return Math.hypot(Math.max(0, Math.abs(dx * Math.cos(angle) - dz * Math.sin(angle)) - size.x / 2),
    Math.max(0, Math.abs(dx * Math.sin(angle) + dz * Math.cos(angle)) - size.z / 2));
};

/** Construction-time reservations for the other connective presentation kits.
 * Pass cached reservations when the renderer already holds their placements. */
export function connectiveClusterReservations(): ClusterInputs["reserved"] {
  return [
    ...existingDeckTransitionReservations(),
    ...buildDeckTransitions().map(site => ({ position: site.center, radius: BR_DECK_TRANSITION_RADIUS })),
    ...buildBrSectorFields().map(site => ({ position: site.center, radius: BR_SECTOR_FIELD_RADIUS })),
    ...BR_SECONDARY_LOCATIONS.map(location => ({ position: location.position, radius: 40 }))
  ];
}

function clear(center: Vec3, inputs: ClusterInputs, clusters: ConnectiveCluster[]): boolean {
  const radius = BR_CONNECTIVE_CLUSTER_RADIUS;
  let inside = false;
  for (let i = 0, j = inputs.outline.length - 1; i < inputs.outline.length; j = i++) {
    const [x, z] = inputs.outline[i], [px, pz] = inputs.outline[j];
    if ((z > center.z) !== (pz > center.z) && center.x < (px - x) * (center.z - z) / (pz - z) + x) inside = !inside;
    if (segmentDistance(center, { x, y: 0, z }, { x: px, y: 0, z: pz }) < radius + 8) return false;
  }
  if (!inside) return false;
  if (inputs.roads.some(road => segmentDistance(center, road.from, road.to) < road.width / 2 + radius + 4
    || Math.min(distance(center, road.from), distance(center, road.to)) < radius + 25)) return false;
  if (inputs.structures.some(s => rectDistance(center, s.position, s.size) < radius + 5)) return false;
  if (inputs.patches.some(p => rectDistance(center, p.position, p.size, p.rotation) < radius + 3)) return false;
  for (const block of inputs.blocks) {
    const gap = block.rotation ? distance(center, block.position) - Math.hypot(block.size.x, block.size.y, block.size.z) / 2
      : rectDistance(center, block.position, block.size);
    if (gap < radius + 4) return false;
  }
  if (inputs.traversal.some(t => distance(center, t.position) < radius + 10)) return false;
  if (inputs.reserved.some(site => distance(center, site.position) < radius + site.radius + 3)) return false;
  return clusters.every(cluster => distance(center,cluster.center)>=55);
}

function createParts(center: Vec3, angle: number, theme: ConnectiveClusterTheme): ConnectiveClusterPart[] {
  const parts: ConnectiveClusterPart[] = [];
  const add = (finish: ConnectiveClusterPart["finish"], x: number, y: number, z: number, sx: number, sy: number, sz: number,
    surface = false, geometry: ConnectiveClusterPart["geometry"] = "box") => parts.push({ geometry, finish, surface, rotationY: -angle,
    position: { x: center.x + Math.cos(angle) * x - Math.sin(angle) * z, y, z: center.z + Math.sin(angle) * x + Math.cos(angle) * z },
    scale: { x: sx, y: sy, z: sz }
  });
  // Broken edge ticks are a common visual language, without another filled pad.
  for (const x of [-4.8, 4.8]) for (const z of [-3, 3]) add("sidewalk", x, .04, z, .8, .012, .12, true);
  if (theme === "landscape") {
    for (const x of [-3.2, 3.2]) {
      add("soil", x, .028, 0, 2.2, .014, 3.8, true);
      for (const z of [-1.1, 0, 1.1]) {
        // Radius-one octahedra: scale is the actual leaf extent, not diameter.
        add("grass", x, .3, z, .42, .25, .55, false, "octahedron");
      }
    }
  } else if (theme === "cargo") {
    for (const x of [-2.8, 2.8]) {
      // Empty loading cradles are visibly open and only ankle-high; no crates.
      for (const side of [-1, 1]) add("paintedMetal", x + side * .85, .095, 0, .12, .16, 3.4);
      for (const z of [-1.4, 1.4]) add("brushedMetal", x, .065, z, 1.8, .1, .12);
      add("industrialOrange", x, .04, -2.2, 1.1, .012, .12, true);
    }
  } else if (theme === "service") {
    for (const x of [-2.9, 2.9]) {
      add("paintedMetal", x, .029, 0, 2.5, .012, 3.4, true);
      for (const z of [-1, 1]) add("brushedMetal", x, .047, z, 1.5, .012, .08, true);
      add("industrialOrange", x, .04, -2.2, .9, .012, .12, true);
    }
    add("brushedMetal", 0, .035, 2.7, .5, .02, .5, true, "cylinder");
  } else {
    for (const x of [-2.2, 0, 2.2]) add("sidewalk", x, .04, 0, .85, .012, .12, true);
    for (const x of [-3.9, 3.9]) {
      // Slender warm-light markers give the waiting pocket vertical identity,
      // but have no opaque sign, canopy or bench that could read as hard cover.
      add("brushedMetal", x, 1.4, 2.2, .1, 2.8, .1, false, "cylinder");
      add("windowLit", x, 2.85, 2.2, .16, .1, .16, false, "cylinder");
    }
  }
  return parts;
}

/** Up to sixteen low-density pockets with 11–14 parts each. Geometry keys map directly to
 * existing unitBox/unitCylinder/unitOctahedron (radius-one cylinders/octas).
 * Batch by geometry+finish+surface, using surface(finish,6) for flush parts and
 * get(finish) otherwise; cameraCollision=false. No textures, lights or updates.
 * Terrain/secondary compounds and every existing connective kit remain clear. */
export function buildConnectiveClusters(overrides: Partial<ClusterInputs> = {}): ConnectiveCluster[] {
  const inputs: ClusterInputs = {
    roads: BR_ROADS, structures: BR_STRUCTURES, blocks: BR_MAP_BLOCKS, patches: BR_TERRAIN_PATCHES,
    locations: [...BR_POIS, ...BR_SECONDARY_LOCATIONS], traversal: BR_TRAVERSAL, outline: BR_ISLAND_OUTLINE,
    ...overrides, reserved: overrides.reserved ?? connectiveClusterReservations()
  };
  inputs.roads = inputs.roads.filter(road => [road.from.x, road.from.z, road.to.x, road.to.z, road.width].every(Number.isFinite) && road.width > 0);
  inputs.locations = inputs.locations.filter(location => [location.position.x, location.position.z].every(Number.isFinite));
  if (!inputs.locations.length || inputs.outline.length < 3 || inputs.outline.some(point => !point.every(Number.isFinite))) return [];
  const roads = [...inputs.roads].filter(road => distance(road.from, road.to) >= 100)
    .sort((a, b) => distance(b.from, b.to) - distance(a.from, a.to) || (a.id < b.id ? -1 : 1));
  const clusters: ConnectiveCluster[] = [];
  for (const road of roads) {
    if(clusters.length===16)break;
    const dx = road.to.x - road.from.x, dz = road.to.z - road.from.z, length = Math.hypot(dx, dz);
    let placed = false;
    for (const extra of [26, 44, 62, 80]) {
      for (const t of [.5, .3, .7, .18, .82]) {
        for (const side of [-1, 1]) {
          const offset = road.width / 2 + extra;
          const center = { x: road.from.x + dx * t - dz / length * offset * side, y: 0, z: road.from.z + dz * t + dx / length * offset * side };
          if (!clear(center, inputs, clusters)) continue;
          const location = [...inputs.locations].sort((a, b) => distance(center, a.position) - distance(center, b.position) || (a.id < b.id ? -1 : 1))[0];
          const theme: ConnectiveClusterTheme = location.style === "farm" || location.style === "academy" ? "landscape"
            : location.style === "dock" || location.style === "wreck" ? "cargo"
            : location.style === "industrial" || location.style === "reactor" ? "service" : "transit";
          clusters.push({ roadId: road.id, locationId: location.id, style: location.style, theme, center, radius: BR_CONNECTIVE_CLUSTER_RADIUS,
            parts: createParts(center, Math.atan2(dz, dx), theme) });
          placed = true;
          break;
        }
        if (placed) break;
      }
      if (placed) break;
    }
  }
  return clusters;
}
