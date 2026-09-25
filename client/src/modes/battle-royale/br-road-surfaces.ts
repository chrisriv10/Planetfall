import { BR_STRUCTURES, type BrRoadSegment, type BrStructure } from "@planetfall/shared";

export interface BrVisibleRoadSpan {
  sourceRoadId: string;
  from: { x: number; z: number };
  to: { x: number; z: number };
  startT: number;
  endT: number;
  width: number;
  color: string;
}

function clippedInterval(road: BrRoadSegment, structure: BrStructure, clearance: number): [number, number] | null {
  const dx = road.to.x - road.from.x;
  const dz = road.to.z - road.from.z;
  const halfX = structure.size.x / 2 + road.width / 2 + clearance;
  const halfZ = structure.size.z / 2 + road.width / 2 + clearance;
  const minX = structure.position.x - halfX;
  const maxX = structure.position.x + halfX;
  const minZ = structure.position.z - halfZ;
  const maxZ = structure.position.z + halfZ;
  let enter = 0;
  let exit = 1;
  for (const [origin, delta, min, max] of [[road.from.x, dx, minX, maxX], [road.from.z, dz, minZ, maxZ]] as const) {
    if (Math.abs(delta) < 1e-7) {
      if (origin < min || origin > max) return null;
      continue;
    }
    const first = (min - origin) / delta;
    const second = (max - origin) / delta;
    enter = Math.max(enter, Math.min(first, second));
    exit = Math.min(exit, Math.max(first, second));
    if (enter >= exit) return null;
  }
  return exit <= 0 || enter >= 1 ? null : [Math.max(0, enter), Math.min(1, exit)];
}

/** Visual road spans with building footprints cut out. Authoritative roads stay unchanged. */
export function buildBrVisibleRoadSpans(
  road: BrRoadSegment,
  structures: readonly BrStructure[] = BR_STRUCTURES,
  clearance = 1.25
): BrVisibleRoadSpan[] {
  const exclusions = structures
    .map((structure) => clippedInterval(road, structure, clearance))
    .filter((entry): entry is [number, number] => Boolean(entry))
    .sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const interval of exclusions) {
    const last = merged.at(-1);
    if (last && interval[0] <= last[1]) last[1] = Math.max(last[1], interval[1]);
    else merged.push([...interval]);
  }
  const dx = road.to.x - road.from.x;
  const dz = road.to.z - road.from.z;
  const length = Math.hypot(dx, dz);
  const spans: BrVisibleRoadSpan[] = [];
  let cursor = 0;
  for (const [start, end] of [...merged, [1, 1] as [number, number]]) {
    if ((start - cursor) * length >= 1) {
      spans.push({
        sourceRoadId: road.id,
        startT: cursor,
        endT: start,
        from: { x: road.from.x + dx * cursor, z: road.from.z + dz * cursor },
        to: { x: road.from.x + dx * start, z: road.from.z + dz * start },
        width: road.width,
        color: road.color
      });
    }
    cursor = Math.max(cursor, end);
  }
  return spans;
}
