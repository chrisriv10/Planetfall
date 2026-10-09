import * as THREE from "three";

const PALETTES = [
  { id: "nexus", source: "#70f5ff", shell: "#174958" },
  { id: "nova", source: "#ff6bba", shell: "#512447" },
  { id: "dock", source: "#ffb347", shell: "#594033" },
  { id: "reactor", source: "#ffd84d", shell: "#514b23" },
  { id: "academy", source: "#a88cff", shell: "#38265d" },
  { id: "farm", source: "#63ef8b", shell: "#1e4b3b" },
  { id: "salvage", source: "#ff795f", shell: "#592e39" },
  { id: "industrial", source: "#65b8ff", shell: "#213c63" },
] as const;
const hues = PALETTES.map(p => new THREE.Color(p.source).getHSL({ h: 0, s: 0, l: 0 }).h);

export const BR_COLONY_DECK_COLOR = "#243747";

/** Quantize authored district colors into eight stable midnight-paint families.
 * Close variations share materials; shell/facade tints never create textures.
 */
export function brDistrictPalette(color: THREE.ColorRepresentation): {
  id: typeof PALETTES[number]["id"]; shell: THREE.Color; facade: THREE.Color;
} {
  const hue = new THREE.Color(color).getHSL({ h: 0, s: 0, l: 0 }).h;
  const distance = (h: number) => Math.min(Math.abs(h - hue), 1 - Math.abs(h - hue));
  let index = 0;
  for (let i = 1; i < hues.length; i++) if (distance(hues[i]) < distance(hues[index])) index = i;
  const palette = PALETTES[index], shell = new THREE.Color(palette.shell);
  return { id: palette.id, shell, facade: shell.clone().lerp(new THREE.Color(palette.source), .12) };
}
