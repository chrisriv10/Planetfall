import { BR_ROADS, BR_STRUCTURES, type BrRoadSegment, type BrStructure } from "@planetfall/shared";
import type { BrAuthoredSecondaryDressing, BrAuthoredSecondaryPart } from "./br-authored-secondary-dressing";

const ENTRIES = [
  { id: "civic-frontage-bookshop", entrance: "east" },
  { id: "civic-frontage-clinic", entrance: "west" },
  { id: "civic-frontage-service", entrance: "west" },
] as const;

/** Narrow doorway-to-street walks only. World-space transforms at ground zero;
 * surface tops .028m. Use addAuthoredSecondaryDressing in the site's detail LOD:
 * one borrowed unitBox/sidewalk surface batch, no colliders or owned resources.
 * Deliberately no forecourt carpet, props or implied collision-backed enclosure.
 */
export function buildBrCivicFrontageDressing(input: {
  structures: readonly BrStructure[]; roads: readonly BrRoadSegment[];
} = { structures: BR_STRUCTURES, roads: BR_ROADS }): BrAuthoredSecondaryDressing | undefined {
  const parts: BrAuthoredSecondaryPart[] = [];
  for (const spec of ENTRIES) {
    const structure = input.structures.find(s => s.id === spec.id);
    if (!structure?.enterable || structure.position.y !== 0 || structure.entrance !== spec.entrance) return undefined;
    const road = input.roads.find(r => (r.id === "civic-frontage-main" || r.id.startsWith("civic-frontage-main-grade-part-"))
      && structure.position.z >= Math.min(r.from.z, r.to.z)
      && structure.position.z <= Math.max(r.from.z, r.to.z));
    if (!road || road.from.x !== road.to.x || Math.abs(road.from.y - .1) > .001 || Math.abs(road.to.y - .1) > .001) return undefined;
    const sign = spec.entrance === "east" ? 1 : -1;
    const start = structure.position.x + sign * (structure.size.x / 2 + .375);
    const edge = road.from.x - sign * (road.width / 2 + .15);
    const length = (edge - start) * sign;
    if (!Number.isFinite(length) || length < 1 || structure.size.z < 4.8) return undefined;
    parts.push({ name: `${spec.id}-door-walk`, geometry: "box", finish: "sidewalk",
      position: { x: (start + edge) / 2, y: .02, z: structure.position.z },
      scale: { x: length, y: .016, z: 4.8 }, rotationY: 0, surface: true });
  }
  return { id: "civic-frontage", family: "civic", context: "Three clear ground-level entry walks beside the local street",
    center: { x: -145, y: 0, z: 158 }, radius: 30, parts };
}
