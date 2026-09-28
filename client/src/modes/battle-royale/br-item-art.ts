import { BR_HEALS, BR_WEAPONS, type BrAmmoType, type BrItemId } from "@planetfall/shared";

export type BrItemArtId = BrItemId | `ammo-${BrAmmoType}`;

// One original, hand-authored side-profile vocabulary for every UI surface.
// Neutral armor identifies the item; small accent insets identify its technology.
// Rarity belongs to the surrounding slot/card, never a recolored weapon blob.
const ART: Record<BrItemArtId, readonly [accent: string, shapes: string]> = {
  "pulse-rifle": ["#7cecff", '<path d="M10 23h13l7-5h28v5h24v9H54l-6 5H36l-4 11h-9l4-16H10z"/><path d="M35 18v-7h14v7M60 23v9M68 23v9"/><path fill="var(--art-dark)" d="M34 23h20v8H34z"/><path fill="var(--art-accent)" d="M61 26h17v3H61z"/>'],
  "nova-smg": ["#ff6fbd", '<path d="M18 19h40l8 7h12v8H48l-4 13H32l2-13H18z"/><path d="M31 19v-7h13v7M18 22H9v8h9"/><path fill="var(--art-dark)" d="M24 23h26v7H24z"/><path fill="var(--art-accent)" d="M57 26h17v3H57zM57 31h17v3H57z"/>'],
  "photon-shotgun": ["#ffbd58", '<path d="M9 24h19l6-6h28v3h22v15H51l-7 4h-9l-3 8h-9l3-14H9z"/><path fill="var(--art-dark)" d="M54 24h30v3H54zM54 31h30v3H54zM42 25h7v12h-7z"/><path fill="var(--art-accent)" d="M33 20h17v3H33z"/><path d="M33 18v-5h5v5"/>'],
  "rail-laser": ["#78baff", '<path d="M7 25h20l5-5h27l8 5h23v7H53l-8 5h-9l-4 10h-9l3-13H7z"/><path d="M36 19v-5h-7V8h29v6H44v5"/><path fill="var(--art-dark)" d="M33 10h20v2H33zM32 25h24v7H32z"/><path fill="var(--art-accent)" d="M58 23h26v3H58zM58 31h26v3H58z"/>'],
  "plasma-launcher": ["#e865ff", '<path d="M10 23h22v-5h24l9 4h19v17H60l-9-4H35l-4 13h-9l3-15H10z"/><circle cx="46" cy="27" r="13"/><circle fill="var(--art-dark)" cx="46" cy="27" r="9"/><circle fill="var(--art-accent)" cx="46" cy="27" r="4"/><path d="M74 23v15"/>'],
  "arc-blaster": ["#66efff", '<path d="M13 23h16l6-6h24v6h24v6H60v6h23v6H51l-8-5h-8l-4 12h-9l4-14H13z"/><path fill="var(--art-dark)" d="M32 23h19v9H32z"/><path fill="var(--art-accent)" d="m48 19 7 7-7 7-7-7zM65 24h15v3H65zM65 36h15v3H65z"/>'],
  "energy-saber": ["#75ffb2", '<path d="m13 43 18-11 6 8-18 11z"/><path d="m27 27 15 21 5-4-15-21z"/><path fill="var(--art-accent)" d="m37 29 39-23 5 1 1 5-40 26z"/><path fill="#effff8" stroke="none" d="m39 31 39-22 1 2-39 23z"/>'],
  "med-patch": ["#82e6ae", '<path d="m25 13 41 4 5 27-43-3z"/><path fill="var(--art-dark)" d="m30 17 31 3 4 19-32-3z"/><path fill="var(--art-accent)" d="M43 22h7v5h6v6h-6v5h-7v-5h-6v-6h6z"/><path d="m23 21-5 1 4 19 6-1"/>'],
  "med-kit": ["#82e6ae", '<path d="M22 18h52v30H22zM37 18V9h22v9"/><path fill="var(--art-dark)" d="M26 23h44v20H26z"/><path fill="var(--art-accent)" d="M44 25h8v5h6v7h-6v5h-8v-5h-6v-7h6z"/><path d="M22 30h6M68 30h6"/>'],
  "shield-cell": ["#63d8ff", '<path d="M39 8h18v6l5 4v28H34V18l5-4z"/><path fill="var(--art-dark)" d="M39 20h18v21H39z"/><path fill="var(--art-accent)" d="m48 22 7 3-2 9-5 5-5-5-2-9z"/><path d="M40 13h16"/>'],
  "shield-battery": ["#63d8ff", '<path d="M25 14h46v34H25zM35 8h26v6M20 23h5v17h-5M71 23h5v17h-5"/><path fill="var(--art-dark)" d="M31 20h34v22H31z"/><path fill="var(--art-accent)" d="m48 21 11 4-3 11-8 6-8-6-3-11z"/><path d="M28 17h40"/>'],
  "ammo-light": ["#7cecff", '<path d="m23 18 5-9 5 9v28H23zM42 18l5-9 5 9v28H42zM61 18l5-9 5 9v28H61z"/><path fill="var(--art-accent)" d="M23 34h10v5H23zM42 34h10v5H42zM61 34h10v5H61z"/>'],
  "ammo-heavy": ["#ffbd58", '<path d="m29 17 7-10 7 10v30H29zM53 17l7-10 7 10v30H53z"/><path fill="var(--art-dark)" d="M29 24h14v10H29zM53 24h14v10H53z"/><path fill="var(--art-accent)" d="M29 37h14v5H29zM53 37h14v5H53z"/>'],
  "ammo-plasma": ["#e865ff", '<path d="M29 13h38v34H29zM35 8h26v5"/><path fill="var(--art-dark)" d="M34 18h28v23H34z"/><path fill="var(--art-accent)" d="m48 19 9 11-9 10-9-10z"/><path d="M29 23h5M62 23h5"/>'],
};

export function brItemArtLabel(id: BrItemArtId): string {
  if (id.startsWith("ammo-")) return `${id.slice(5).toUpperCase()} CELLS`;
  return id in BR_WEAPONS ? BR_WEAPONS[id as keyof typeof BR_WEAPONS].name : BR_HEALS[id as keyof typeof BR_HEALS].name;
}

/** Safe static markup. Default decorative=true for slots/cards with a visible
 * item name; pass false for an icon-only control, then label the control too.
 * No document dependency, external assets, filters, IDs or duplicated SVG refs.
 * Size its wrapper; the shared 96x56 viewBox preserves consistent alignment. */
export function brItemIconSvg(id: BrItemArtId, decorative = true): string {
  const [accent, shapes] = ART[id];
  const accessibility = decorative ? 'aria-hidden="true"' : `role="img" aria-label="${brItemArtLabel(id)}"`;
  return `<svg class="br-item-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 56" width="96" height="56" preserveAspectRatio="xMidYMid meet" focusable="false" ${accessibility} style="--art-dark:#26374b;--art-accent:${accent}"><g fill="#d5e2e8" stroke="#142337" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">${shapes}</g></svg>`;
}
