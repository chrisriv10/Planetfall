import { BR_ROADS, BR_STRUCTURES, type BrRoadSegment, type BrStructure } from "@planetfall/shared";
import type { BrAuthoredSecondaryDressing, BrAuthoredSecondaryPart } from "./br-authored-secondary-dressing";

const ENTRIES = [
  { id: "nova-landing-shop", entrance: "east", road: "nova-landing-main" },
  { id: "nova-landing-office", entrance: "north", road: "nova-landing-office-entry" },
  { id: "nova-landing-service", entrance: "north", road: "nova-landing-service-entry" },
] as const;

/** World-space, ground-level entrance strips. Render in the existing site LOD
 * with borrowed unitBox/sidewalk surface resources and no camera collision.
 * No raised Nova-deck translation: these entrances are on the lower landing.
 */
export function buildBrNovaLandingDressing(input: {
  structures: readonly BrStructure[]; roads: readonly BrRoadSegment[];
} = { structures: BR_STRUCTURES, roads: BR_ROADS }): BrAuthoredSecondaryDressing | undefined {
  const parts: BrAuthoredSecondaryPart[] = [];
  for (const spec of ENTRIES) {
    const structure = input.structures.find(s => s.id === spec.id);
    if (!structure?.enterable || structure.position.y !== 0 || structure.entrance !== spec.entrance) return undefined;
    const along = spec.entrance === "north" ? "x" : "z", normal = along === "x" ? "z" : "x";
    const road = input.roads.find(r => (r.id === spec.road || r.id.startsWith(`${spec.road}-grade-part-`))
      && structure.position[along] >= Math.min(r.from[along], r.to[along])
      && structure.position[along] <= Math.max(r.from[along], r.to[along]));
    if (!road || road.from[normal] !== road.to[normal] || Math.abs(road.from.y - .1) > .001 || Math.abs(road.to.y - .1) > .001) return undefined;
    const start = structure.position[normal] + structure.size[normal] / 2 + .375;
    const edge = road.from[normal] - road.width / 2 - .15;
    const length = edge - start;
    if (!Number.isFinite(length) || length < 1 || structure.size[along] < 4.8) return undefined;
    parts.push({ name: `${spec.id}-door-walk`, geometry: "box", finish: "sidewalk",
      position: { x: normal === "x" ? (start + edge) / 2 : structure.position.x, y: .02,
        z: normal === "z" ? (start + edge) / 2 : structure.position.z },
      scale: { x: normal === "x" ? length : 4.8, y: .016, z: normal === "z" ? length : 4.8 },
      rotationY: 0, surface: true });
  }
  return { id: "nova-landing", family: "commercial", context: "Three lower landing doorway walks",
    center: { x: -180, y: 0, z: -12 }, radius: 38, parts };
}
