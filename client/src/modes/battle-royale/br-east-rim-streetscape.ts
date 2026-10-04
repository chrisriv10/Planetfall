import { BR_TERRACES, type Vec3 } from "@planetfall/shared";
import type { GraphicsQuality } from "../../settings";
import type { BrDistrictPropPart } from "./br-authored-district-props";

export interface BrEastRimStreetGroup {
  id: string;
  center: Vec3;
  parts: BrDistrictPropPart[];
}
type Piece = readonly [finish: BrDistrictPropPart["finish"], x: number, y: number, z: number,
  width: number, height: number, depth: number, tier: 0 | 1 | 2, geometry?: "octahedron"];

// Explicit artist-authored positions. Heights are measured from the real East
// Rim deck, not the island. No road sampling, random scatter or candidate search.
const GROUPS: readonly { id: string; center: readonly [number, number]; parts: readonly Piece[] }[] = [
  { id: "arrival-rest", center: [392, 96], parts: [
    ["structuralDark",391.1,1.8,96,.1,3.6,.1,0],
    ["brushedMetal",391.35,3.6,96,.6,.12,.24,0],
    ["windowLit",391.38,3.532,96,.38,.018,.14,0],
    ["brushedMetal",392.3,.47,96.45,1.6,.08,.16,0],
    ["brushedMetal",392.3,.47,96.67,1.6,.08,.16,0],
    ["brushedMetal",392.3,.47,96.89,1.6,.08,.16,0],
    ["structuralDark",391.72,.215,96.67,.1,.43,.58,0],
    ["structuralDark",392.88,.215,96.67,.1,.43,.58,0],
    ["paintedMetal",392.4,.16,95.3,1.6,.28,.58,1],
    ["soil",392.4,.304,95.3,1.42,.018,.42,1],
    ["canopy",392,.48,95.3,.3,.22,.2,1,"octahedron"],
    ["canopy",392.75,.48,95.3,.3,.22,.2,2,"octahedron"],
  ] },
  { id: "relay-service", center: [416,97.5], parts: [
    ["structuralDark",415.2,1.8,97.4,.1,3.6,.1,0],
    ["brushedMetal",415.43,3.6,97.4,.56,.12,.24,0],
    ["windowLit",415.45,3.532,97.4,.36,.018,.14,0],
    ["paintedMetal",416.4,.16,97.4,1.1,.26,.64,1],
    ["brushedMetal",416.4,.306,97.4,.98,.025,.52,1],
    ["industrialOrange",416.4,.326,97.4,.5,.012,.07,2],
    ["structuralDark",416.9,.67,98,.1,1.3,.1,1],
    ["windowLit",416.9,1.34,98,.12,.055,.12,1],
  ] },
  { id: "shop-arrival", center: [426,111.2], parts: [
    ["structuralDark",426,1.8,111.2,.1,3.6,.1,0],
    ["brushedMetal",426,3.6,111.2,.52,.12,.24,0],
    ["windowLit",426,3.532,111.2,.34,.018,.14,0],
  ] },
  { id: "rim-observation-frame", center: [443,105], parts: [
    // An open service-frame silhouette, entirely beyond the road end. The
    // .18m columns and high crosshead frame space rather than imitate a wall,
    // rail, new building, walkable deck extension or collision boundary.
    ["brushedMetal",443,3,98,.18,6,.22,0],
    ["brushedMetal",443,3,112,.18,6,.22,0],
    ["structuralDark",443,6.05,105,.24,.2,14.24,0],
    ["windowLit",442.868,5.982,105,.018,.035,2.4,0],
    ["industrialOrange",442.865,5.45,98,.025,.44,.24,1],
    ["industrialOrange",442.865,5.45,112,.025,.44,.24,1],
    ["brushedMetal",443,5.79,102.3,.14,.34,.1,2],
    ["brushedMetal",443,5.79,107.7,.14,.34,.1,2],
    ["paintedMetal",443,.105,98,.42,.16,1.1,1],
    ["paintedMetal",443,.105,112,.42,.16,1.1,1],
  ] },
];

/** Fixed composition for the actual `sector-field` review camera, which looks
 * east along East Rim's raised street, NOT at the off-road sector-field pads.
 * Same box/octahedron/finish/surface contract as authored district props.
 * Globally batch with the shared registry; cameraCollision=false, no physics.
 * Low retains the three human-scale lamps, seat and distant structural frame;
 * medium adds low service fixtures; high adds tiny planting/attachment detail.
 * No GPU resources, lights, textures, animation or per-frame allocation. */
export function buildBrEastRimStreetscape(quality: GraphicsQuality): BrEastRimStreetGroup[] {
  const deck = BR_TERRACES.find(terrace => terrace.id === "east-rim-deck");
  if (!deck || !Number.isFinite(deck.height)) return [];
  const tier = quality === "high" ? 2 : quality === "medium" ? 1 : 0;
  return GROUPS.map(group => ({
    id: `east-rim-${group.id}`, center: {x:group.center[0],y:deck.height,z:group.center[1]},
    parts: group.parts.filter(piece => piece[7] <= tier).map(([finish,x,y,z,sx,sy,sz,,geometry]) => ({
      geometry: geometry ?? "box", finish, position: {x,y:deck.height+y,z},
      scale: {x:sx,y:sy,z:sz}, rotationY: 0, surface: false,
    })),
  }));
}
