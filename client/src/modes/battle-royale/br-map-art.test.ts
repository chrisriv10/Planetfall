import { expect, it } from "vitest";
import { BR_MAP_BLOCKS, BR_ROADS, BR_STRUCTURES, BR_TERRAIN_PATCHES } from "@planetfall/shared";
import { brMapPercent, brMinimapArtPlacement, buildBrMapSvg } from "./br-map-art";

it("maps every actual building, terrain patch and road rather than a schematic background", () => {
  const svg = buildBrMapSvg();
  expect(svg.match(/data-structure=/g)).toHaveLength(BR_STRUCTURES.length);
  expect(svg.match(/data-terrain=/g)).toHaveLength(BR_TERRAIN_PATCHES.length);
  expect(svg.match(/data-road=/g)).toHaveLength(BR_ROADS.length);
  expect(svg).toContain('clip-path="url(#island)"');
  expect(svg).not.toContain("NaN");
});

it("places entrance marks on the actual authored door wall", () => {
  const svg = buildBrMapSvg();
  for (const structure of BR_STRUCTURES.filter(entry => entry.enterable)) {
    const left = BR_MAP_BLOCKS.find(block => block.id === `${structure.id}-door-left`)!;
    const right = BR_MAP_BLOCKS.find(block => block.id === `${structure.id}-door-right`)!;
    const horizontal = structure.entrance === "north" || structure.entrance === "south";
    const x = (left.position.x + right.position.x) / 2 - (horizontal ? 2 : 0);
    const z = (left.position.z + right.position.z) / 2 - (horizontal ? 0 : 2);
    const group = svg.split(`data-structure="${structure.id}"`)[1].split("</g>")[0];
    const marker = group.match(/<path d="M([^ ]+) ([^h]+)h/)!;
    expect(Number(marker[1])).toBeCloseTo(x);
    expect(Number(marker[2])).toBeCloseTo(z);
  }
});

it("keeps minimap terrain exactly aligned with the full-map and player-relative HUD coordinates", () => {
  for (const [x, z] of [[0, 0], [-330, 241], [410, -220]]) {
    const span = 110;
    const placement = brMinimapArtPlacement(x, z, span);
    expect(placement.left + brMapPercent(x) / 100 * placement.width).toBeCloseTo(50);
    expect(placement.top + brMapPercent(z) / 100 * placement.width).toBeCloseTo(50);
    expect(placement.left + brMapPercent(x + span) / 100 * placement.width).toBeCloseTo(100);
    expect(placement.top + brMapPercent(z - span) / 100 * placement.width).toBeCloseTo(0);
  }
});
