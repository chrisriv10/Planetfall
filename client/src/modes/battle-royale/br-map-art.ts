import { BR_ISLAND_OUTLINE, BR_MAP, BR_MAP_BLOCKS, BR_ROADS, BR_STRUCTURES, BR_TERRAIN_PATCHES, BR_TRAVERSAL } from "@planetfall/shared";

// Share the same 2% margin and north-up coordinates as the tactical markers.
export const brMapPercent = (world: number): number => 50 + world / BR_MAP.radius * 48;
const number = (value: number): string => String(Math.round(value * 1000) / 1000);
const escape = (value: string): string => value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");

/** A cached top-down map of the actual world, rather than a decorative backdrop.
 * All geometry is read from the same authored data used by the world/physics. */
export function buildBrMapSvg(): string {
  const extent = BR_MAP.radius / .96;
  const outline = BR_ISLAND_OUTLINE.map(([x, z]) => `${x},${z}`).join(" ");
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-extent} ${-extent} ${extent * 2} ${extent * 2}">`,
    '<defs><pattern id="deck" width="44" height="44" patternUnits="userSpaceOnUse"><path d="M44 0H0V44" fill="none" stroke="#3f5766" stroke-width=".65"/></pattern>',
    `<clipPath id="island"><polygon points="${outline}"/></clipPath></defs>`,
    `<polygon points="${outline}" fill="#223642" stroke="#91bdc7" stroke-width="4"/>`,
    '<g clip-path="url(#island)">',
    `<rect x="${-extent}" y="${-extent}" width="${extent * 2}" height="${extent * 2}" fill="url(#deck)"/>`
  ];
  for (const patch of BR_TERRAIN_PATCHES) {
    parts.push(`<rect data-terrain="${escape(patch.id)}" x="${-patch.size.x / 2}" y="${-patch.size.z / 2}" width="${patch.size.x}" height="${patch.size.z}" transform="translate(${patch.position.x} ${patch.position.z}) rotate(${number(-patch.rotation * 180 / Math.PI)})" fill="${escape(patch.color)}" stroke="#66808b" stroke-width=".6"/>`);
  }
  for (const road of BR_ROADS) {
    const path = `M${road.from.x} ${road.from.z}L${road.to.x} ${road.to.z}`;
    parts.push(`<path data-road="${escape(road.id)}" d="${path}" fill="none" stroke="#6e8188" stroke-width="${road.width + 1.6}"/><path d="${path}" fill="none" stroke="#152935" stroke-width="${road.width}"/><path d="${path}" fill="none" stroke="#8a9a8b" stroke-width=".7" stroke-dasharray="5 6"/>`);
  }
  // Cover and connecting platforms remain legible between building footprints.
  // Structure walls/interior floors are intentionally represented by their roof.
  for (const block of BR_MAP_BLOCKS) {
    if (block.kind !== "cover" && block.kind !== "bridge") continue;
    parts.push(`<rect data-cover="${escape(block.id)}" x="${-block.size.x / 2}" y="${-block.size.z / 2}" width="${block.size.x}" height="${block.size.z}" transform="translate(${block.position.x} ${block.position.z}) rotate(${number(-(block.rotation?.y ?? 0) * 180 / Math.PI)})" fill="#8d9690" stroke="#16232d" stroke-width=".6"/>`);
  }
  for (const structure of [...BR_STRUCTURES].sort((a, b) => a.size.y - b.size.y)) {
    const { x, z } = structure.position, width = structure.size.x, depth = structure.size.z;
    parts.push(`<g data-structure="${escape(structure.id)}"><rect x="${x - width / 2 + 2}" y="${z - depth / 2 + 3}" width="${width}" height="${depth}" fill="#081725" opacity=".65"/><rect x="${x - width / 2}" y="${z - depth / 2}" width="${width}" height="${depth}" fill="${escape(structure.color)}" stroke="#bed0d2" stroke-width="1.2"/><rect x="${x - width / 2 + 2}" y="${z - depth / 2 + 2}" width="${Math.max(0, width - 4)}" height="${Math.max(0, depth - 4)}" fill="#203345" opacity=".35"/>`);
    if (structure.enterable) {
      const horizontal = structure.entrance === "north" || structure.entrance === "south";
      const doorX = x + (structure.entrance === "east" ? width / 2 : structure.entrance === "west" ? -width / 2 : 0);
      // Authored entrances use north=+Z; match the actual wall opening rather
      // than assuming the conventional map-screen north direction.
      const doorZ = z + (structure.entrance === "north" ? depth / 2 : structure.entrance === "south" ? -depth / 2 : 0);
      parts.push(`<path d="M${doorX - (horizontal ? 2 : 0)} ${doorZ - (horizontal ? 0 : 2)}h${horizontal ? 4 : 0}v${horizontal ? 0 : 4}" stroke="#92fff0" stroke-width="2.4"/>`);
    }
    parts.push("</g>");
  }
  for (const traversal of BR_TRAVERSAL) {
    parts.push(`<circle data-traversal="${escape(traversal.id)}" cx="${traversal.position.x}" cy="${traversal.position.z}" r="3.4" fill="#78efff" stroke="#113d52" stroke-width="1.1"/>`);
  }
  parts.push('</g><text x="0" y="-499" text-anchor="middle" fill="#d1e3eb" font-family="sans-serif" font-size="12" font-weight="bold">N</text></svg>');
  return parts.join("");
}

let mapUrl: string | undefined;
export function createBrMapArt(): HTMLImageElement {
  mapUrl ??= `data:image/svg+xml;charset=utf-8,${encodeURIComponent(buildBrMapSvg())}`;
  const image = document.createElement("img");
  image.className = "br-map-art";
  image.alt = "Orbital Isle terrain, roads, building footprints and entrances";
  image.draggable = false;
  image.src = mapUrl;
  Object.assign(image.style, { position: "absolute", inset: "0", width: "100%", height: "100%", pointerEvents: "none" });
  return image;
}

export function brMinimapArtPlacement(x: number, z: number, span: number): { width: number; left: number; top: number } {
  const width = BR_MAP.radius / span * 100 / .96;
  return { width, left: 50 - x / span * 50 - width / 2, top: 50 - z / span * 50 - width / 2 };
}

const miniArt = new WeakMap<HTMLElement, HTMLImageElement>();
/** Keep the real terrain centered on the same player/span as the HUD markers. */
export function updateBrMinimapArt(container: HTMLElement, x: number, z: number, span: number): void {
  let image = miniArt.get(container);
  if (!image || image.parentElement !== container) {
    image = createBrMapArt();
    image.alt = "Nearby terrain and buildings";
    image.style.maxWidth = "none";
    image.style.inset = "auto";
    container.prepend(image);
    miniArt.set(container, image);
  }
  const placement = brMinimapArtPlacement(x, z, span);
  image.style.width = image.style.height = `${placement.width}%`;
  image.style.left = `${placement.left}%`;
  image.style.top = `${placement.top}%`;
}
