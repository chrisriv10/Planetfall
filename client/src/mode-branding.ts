import { PG_MODES, type GameFamily, type PgModeId } from '@planetfall/shared';

interface Brand { title: string; caption: string; mode: string }
const familyBrands: Record<GameFamily, Brand> = {
  planetfall: { title: 'PLANETFALL', caption: 'CLASSIC', mode: 'classic' },
  'battle-royale': { title: 'PLANETROYALE', caption: '', mode: 'battle-royale' },
  'planet-run': { title: 'PLANETRUN', caption: '', mode: 'planet-run' },
  'planet-gun': { title: 'PLANETGUN', caption: PG_MODES.deathmatch.name.toUpperCase(), mode: 'deathmatch' },
};
const chaosBrand: Brand = { title: 'PLANETFALL', caption: 'CHAOS', mode: 'chaos' };
const gunBrands = Object.fromEntries(Object.entries(PG_MODES).map(([mode, value]) => [mode, {
  title: mode === 'deathmatch' ? 'PLANETGUN' : value.name.toUpperCase(),
  caption: mode === 'deathmatch' ? value.name.toUpperCase() : 'PLANETGUN', mode,
}])) as Record<PgModeId, Brand>;
const applied = new WeakMap<HTMLElement, { root: HTMLElement; family: GameFamily; brand: Brand; caption: HTMLElement }>();

/** Presentation only: call after selecting a family/mode or rendering a lobby. */
export function applyModeBranding(root: HTMLElement, heading: HTMLElement, family: GameFamily, mode?: string): void {
  const brand = family === 'planetfall' && mode === 'chaos' ? chaosBrand
    : family === 'planet-gun' && mode && Object.prototype.hasOwnProperty.call(gunBrands, mode)
      ? gunBrands[mode as PgModeId] : familyBrands[family];
  const previous = applied.get(heading);
  if (previous?.root === root && previous.family === family && previous.brand === brand
    && heading.textContent === brand.title && root.dataset.brandMode === brand.mode && root.dataset.family === family) return;

  root.dataset.family = family;
  root.dataset.brandMode = brand.mode;
  heading.classList.add('mode-brand-heading');
  if (heading.textContent !== brand.title) heading.textContent = brand.title;
  const host = heading.closest<HTMLElement>('.brand-header') ?? heading.parentElement;
  if (!host) return;
  host.classList.add('mode-brand-title-group');
  let caption = previous?.caption;
  if (!caption || caption.parentElement !== host) {
    caption = host.querySelector<HTMLElement>(':scope > .mode-brand-caption') ?? heading.ownerDocument.createElement('small');
    caption.className = 'mode-brand-caption';
    if (caption.parentElement !== host) host.append(caption);
  }
  if (caption.textContent !== brand.caption) caption.textContent = brand.caption;
  caption.hidden = !brand.caption;
  applied.set(heading, { root, family, brand, caption });
}
