import type { Vec3 } from "../index.js";

export interface BrPoi {
  id: string;
  name: string;
  position: Vec3;
  color: string;
  lootPoints: Vec3[];
}

export interface BrMapBlock {
  id: string;
  position: Vec3;
  size: Vec3;
  color: string;
  kind: "building" | "wall" | "cover" | "platform" | "ramp";
}

export const BR_MAP = { id: "orbital-isle", name: "ORBITAL ISLE", radius: 450, diameter: 900 } as const;

const offsets = [[0,0], [7,5], [-8,4], [5,-8], [-6,-7]] as const;
const poi = (id: string, name: string, x: number, z: number, color: string): BrPoi => ({
  id, name, position: { x, y: 0, z }, color,
  lootPoints: offsets.map(([ox, oz], index) => ({ x: x + ox * (index ? 2.5 : 1), y: .55, z: z + oz * (index ? 2.5 : 1) }))
});

export const BR_POIS: readonly BrPoi[] = [
  poi("zero-point", "ZERO POINT", 0, 0, "#70f5ff"),
  poi("nova-plaza", "NOVA PLAZA", -155, -105, "#ff6bba"),
  poi("dockyard-7", "DOCKYARD 7", 170, -120, "#ffb347"),
  poi("helios-reactor", "HELIOS REACTOR", 220, 85, "#ffd84d"),
  poi("astra-academy", "ASTRA ACADEMY", -210, 90, "#a88cff"),
  poi("void-mall", "VOID MALL", -55, 210, "#c565ff"),
  poi("orbital-farms", "ORBITAL FARMS", 105, 225, "#63ef8b"),
  poi("crash-site", "CRASH SITE", -285, -165, "#ff795f"),
  poi("thruster-works", "THRUSTER WORKS", 300, -25, "#65b8ff")
];

export const BR_MAP_BLOCKS: readonly BrMapBlock[] = BR_POIS.flatMap((entry, poiIndex) => {
  const { x, z } = entry.position;
  const stairSide = poiIndex % 2 ? -1 : 1;
  const blocks: BrMapBlock[] = [
    { id: `${entry.id}-floor`, position: { x, y: .15, z }, size: { x: 26, y: .3, z: 20 }, color: "#17233f", kind: "platform" },
    { id: `${entry.id}-roof`, position: { x, y: 5.2, z }, size: { x: 26, y: .4, z: 20 }, color: entry.color, kind: "platform" },
    { id: `${entry.id}-wall-left`, position: { x: x - 12.6, y: 2.7, z }, size: { x: .8, y: 5.2, z: 20 }, color: entry.color, kind: "wall" },
    { id: `${entry.id}-wall-right`, position: { x: x + 12.6, y: 2.7, z }, size: { x: .8, y: 5.2, z: 20 }, color: entry.color, kind: "wall" },
    { id: `${entry.id}-wall-back`, position: { x, y: 2.7, z: z + 9.6 }, size: { x: 26, y: 5.2, z: .8 }, color: entry.color, kind: "wall" },
    { id: `${entry.id}-wall-front-left`, position: { x: x - 8.2, y: 2.7, z: z - 9.6 }, size: { x: 9.4, y: 5.2, z: .8 }, color: entry.color, kind: "wall" },
    { id: `${entry.id}-wall-front-right`, position: { x: x + 8.2, y: 2.7, z: z - 9.6 }, size: { x: 9.4, y: 5.2, z: .8 }, color: entry.color, kind: "wall" },
    { id: `${entry.id}-interior-cover`, position: { x: x + (poiIndex % 3 - 1) * 4, y: 1, z: z + 2 }, size: { x: 5, y: 2, z: 2.4 }, color: "#263657", kind: "cover" },
    { id: `${entry.id}-wing`, position: { x: x + 31, y: 3, z: z + (poiIndex % 2 ? 14 : -14) }, size: { x: 16, y: 6, z: 12 }, color: entry.color, kind: "building" },
    { id: `${entry.id}-cover-a`, position: { x: x - 28, y: 1.1, z: z + 20 }, size: { x: 7, y: 2.2, z: 3 }, color: "#263657", kind: "cover" },
    { id: `${entry.id}-cover-b`, position: { x: x + 8, y: 1.1, z: z - 30 }, size: { x: 4, y: 2.2, z: 8 }, color: "#263657", kind: "cover" }
  ];
  for (let step = 0; step < 11; step++) {
    const height = .46 * (step + 1);
    blocks.push({ id: `${entry.id}-roof-step-${step}`, position: { x: x + stairSide * (22 - step * 1.05), y: height / 2, z: z + 5.8 }, size: { x: 1.25, y: height, z: 4 }, color: "#334668", kind: "ramp" });
  }
  return blocks;
});

export const BR_TRAVERSAL = [
  { id: "lift-zero", kind: "grav-lift" as const, position: { x: 20, y: 0, z: 18 }, target: { x: 20, y: 24, z: 18 } },
  { id: "lift-nova", kind: "grav-lift" as const, position: { x: -140, y: 0, z: -105 }, target: { x: -140, y: 24, z: -105 } },
  { id: "jump-east", kind: "jump-pad" as const, position: { x: 120, y: 0, z: 20 }, target: { x: 210, y: 25, z: 85 } },
  { id: "jump-west", kind: "jump-pad" as const, position: { x: -110, y: 0, z: 20 }, target: { x: -205, y: 24, z: 90 } }
] as const;

export function isInsideBrIsland(position: Vec3, margin = 0): boolean {
  return Math.hypot(position.x, position.z) <= BR_MAP.radius + margin;
}

export function brShipPath(seed: number): { start: Vec3; end: Vec3 } {
  const angle = ((seed >>> 0) % 6283) / 1000;
  const lateral = (((seed * 1664525 + 1013904223) >>> 0) % 160) - 80;
  const dx = Math.cos(angle); const dz = Math.sin(angle);
  const px = -dz * lateral; const pz = dx * lateral;
  return {
    start: { x: px - dx * 560, y: 185, z: pz - dz * 560 },
    end: { x: px + dx * 560, y: 185, z: pz + dz * 560 }
  };
}
