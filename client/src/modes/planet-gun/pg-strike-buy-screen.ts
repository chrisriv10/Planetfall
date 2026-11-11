import { PG_STRIKE_PRICES, PG_WEAPONS, pgWeaponValid } from "@planetfall/shared";
import { brItemIconSvg, type BrItemArtId } from "../battle-royale/br-item-art";
import "./pg-strike-buy-screen.css";

export interface PgStrikeBuyItem {
  id: string;
  price: number;
  owned: boolean;
  equipped: boolean;
  available: boolean;
  reason: string;
}
export interface PgStrikeBuyView {
  credits: number;
  secondsLeft: number;
  items: readonly PgStrikeBuyItem[];
  pendingItem: string | null;
  reason: string;
}

const sections = {
  Sidearms: ["orbit", "comet"], Rifles: ["pulse", "helix", "prism"],
  SMGs: ["nova", "arc"], Shotguns: ["photon"], Precision: ["quasar", "rail"],
  Armor: ["armor"], Utility: ["smoke", "flash", "damage"],
};
const weaponArt: Record<string, BrItemArtId> = {
  pulse: "pulse-rifle", helix: "helix-burst-rifle", prism: "prism-beam",
  nova: "nova-smg", arc: "arc-blaster", photon: "photon-shotgun",
  quasar: "quasar-carbine", rail: "rail-laser", comet: "comet-hand-cannon",
};
const equipment: Record<string, [name: string, spec: string]> = {
  armor: ["Body Armor", "Refills armor to 50."],
  smoke: ["Smoke Grenade", "Obscures sight lines. Carry one."],
  flash: ["Flash Grenade", "Flashes opponents in its radius. Carry one."],
  damage: ["Damage Grenade", "Damages nearby opponents. Carry one."],
};
// Strike-exclusive equipment and the compact Orbit slide use the same side-profile grid as the shared armory art.
const localArt: Record<string, string> = {
  orbit: '<path d="m27 21 4-4h33v-3h4v5l7 2v8h-8l-2 4H48l-5 15-13-2 5-17h-8z"/><path fill="#4d687f" d="M30 21h36v5H30zm10 9h7l-5 13h-6z"/><path fill="none" d="M48 31v5h8l3-6M33 19l-2 5m8-5-2 5"/><path fill="#9ce8ff" d="M50 19h14v3H50z"/>',
  armor: '<path d="m30 12 10-5 4 6h9l4-6 10 5-3 10 6 9-5 14-17 6-17-6-5-14 7-9z"/><path fill="#627d8b" d="m34 22 14 5 14-5-3 13-11 6-11-6z"/><path fill="#86f2d6" d="m39 18 9 3 9-3-2 4-7 2-7-2z"/>',
  smoke: '<path d="M40 15h16l5 8v22l-4 4H38l-4-5V25zM41 8h15v7H41z"/><path fill="none" d="m55 10 10 4 3 14"/><path fill="#72bba7" d="M35 26h25v13H35z"/><path fill="none" d="M42 36q-4-3 1-6m5 6q-4-3 1-6m5 6q-4-3 1-6"/>',
  flash: '<path d="M40 16h16l3 5v24l-3 4H40l-4-4V22zM41 9h13v7H41z"/><path fill="none" d="m55 11 9 6v13"/><path fill="#f7d98a" d="M37 24h21v14H37z"/><path fill="#485969" d="m48 23-7 9h6l-2 7 9-12h-7z"/>',
  damage: '<path d="M42 9h14v8l7 7 3 12-6 11-13 3-13-6-3-12 5-11 6-4z"/><path fill="none" d="m55 11 9 5 3 11"/><path fill="#e98a6f" d="m34 31 12-4 15 1 2 7-15-1-14 4z"/><path fill="none" d="m43 18-4 9m15-9 4 7m-17 14 4 7m12-8-3 8"/>',
};
function artwork(id: string) {
  if (weaponArt[id]) return brItemIconSvg(weaponArt[id]);
  return `<svg viewBox="0 0 96 56" aria-hidden="true" focusable="false"><g fill="#d5e2e8" stroke="#142337" stroke-width="1.6" stroke-linejoin="round">${localArt[id]}</g></svg>`;
}

export function createPgStrikeBuyScreen(doc: Document) {
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", label = "") => {
    const n = doc.createElement(tag);
    if (cls) n.className = `pg-buy-${cls}`;
    n.textContent = label;
    return n;
  };
  const root = el("section");
  root.className = "pg-strike-buy-screen";
  root.hidden = true;
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", "PlanetStrike armory");
  const head = el("header", "head"), heading = el("div"), credits = el("strong"), clock = el("strong");
  heading.append(el("small", "eyebrow", "PLANETSTRIKE  /  SUPPLY"), el("h2", "", "Field Armory"));
  const meter = (label: string, value: HTMLElement) => {
    const meter = el("div", "meter");
    meter.append(el("small", "eyebrow", label), value);
    return meter;
  };
  head.append(heading, meter("BUY PHASE", clock), meter("CREDITS", credits));
  const body = el("div", "body"), catalog = el("div", "catalog"), inspect = el("aside", "inspect");
  catalog.setAttribute("aria-label", "Equipment catalog");
  const category = el("small", "eyebrow"), title = el("h3"), preview = el("div", "preview"), specs = el("div", "specs");
  inspect.append(category, title, preview, specs);
  body.append(catalog, inspect);
  const foot = el("footer", "foot"), reason = el("span", "reason"), close = el("button", "close", "Close"), buy = el("button", "purchase", "Buy");
  close.type = buy.type = "button";
  reason.setAttribute("role", "status");
  foot.append(reason, close, buy);
  root.append(head, body, foot);

  const cards = new Map<string, {card: HTMLButtonElement; price: HTMLElement; status: HTMLElement; group: string}>();
  let view: PgStrikeBuyView | undefined, selected = "", shown = "", disposed = false;
  for (const [group, ids] of Object.entries(sections)) {
    const section = el("section", "group"), list = el("div", "grid");
    section.append(el("h3", "section-title", group), list);
    catalog.append(section);
    for (const id of ids) {
      if (!Object.hasOwn(PG_STRIKE_PRICES, id)) continue;
      const card = el("button", "card"), art = el("span", "card-art"), price = el("span", "price"), status = el("small", "status");
      card.type = "button";
      card.dataset.item = id;
      card.hidden = true;
      art.innerHTML = artwork(id);
      card.append(art, el("strong", "name", pgWeaponValid(id) ? PG_WEAPONS[id].name : equipment[id][0]), price, status);
      card.onclick = () => {
        selected = id;
        if (view) render(view);
        api.onSelect?.(id);
      };
      list.append(card);
      cards.set(id, {card, price, status, group});
    }
  }
  function render(next: PgStrikeBuyView) {
    if (disposed) return;
    view = next;
    credits.textContent = next.credits.toLocaleString("en-US");
    const seconds = Math.max(0, Math.ceil(next.secondsLeft));
    clock.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
    const offered = new Map(next.items.map(item => [item.id, item]));
    if (!offered.has(selected) || !cards.has(selected)) selected = next.items.find(item => cards.has(item.id))?.id ?? "";
    for (const [id, {card, price, status}] of cards) {
      const item = offered.get(id);
      card.hidden = !item;
      if (!item) continue;
      price.textContent = `${item.price.toLocaleString("en-US")} CR`;
      status.textContent = item.equipped ? "Equipped" : item.owned ? "Owned" : next.credits < item.price ? "Low credits" : item.available ? "Available" : "Unavailable";
      card.title = item.reason;
      card.setAttribute("aria-pressed", String(id === selected));
    }
    const item = offered.get(selected);
    if (selected !== shown || !item) {
      shown = selected;
      category.textContent = cards.get(selected)?.group.toUpperCase() ?? "INSPECTION";
      preview.innerHTML = item ? artwork(selected) : "";
      specs.replaceChildren();
      if (pgWeaponValid(selected)) {
        const w = PG_WEAPONS[selected];
        title.textContent = w.name;
        for (const [label, value] of [["Damage", w.pellets > 1 ? `${w.damage} × ${w.pellets}` : w.damage], ["Magazine", w.magazine], ["Range", `${w.range} m`], ["Reload", `${w.reloadMs / 1000} s`]]) {
          const row = el("div"); row.append(el("span", "", String(label)), el("strong", "", String(value))); specs.append(row);
        }
      } else {
        title.textContent = equipment[selected]?.[0] ?? "No equipment";
        specs.textContent = equipment[selected]?.[1] ?? "";
      }
    }
    buy.disabled = !item || !item.available || next.credits < item.price || next.pendingItem !== null || seconds === 0;
    buy.textContent = item ? `Buy · ${item.price.toLocaleString("en-US")} CR` : "Buy";
    const feedback = next.pendingItem ? "Purchase pending…" : next.reason || item?.reason ||
      (seconds === 0 ? "Buy phase ended." : item && next.credits < item.price ? "Insufficient credits." : item && !item.available ? "Item unavailable." : "");
    if (reason.textContent !== feedback) reason.textContent = feedback;
  }
  const api = {
    root, render,
    get selectedItem(){return selected;},
    onSelect: null as ((id:string)=>void)|null,
    onBuy: null as ((id: string) => void) | null,
    onClose: null as (() => void) | null,
    focus() { if (!disposed) (cards.get(selected)?.card ?? close).focus(); },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const {card} of cards.values()) card.onclick = null;
      cards.clear();
      buy.onclick = close.onclick = null;
      api.onBuy = api.onClose = api.onSelect = null;
      root.remove(); root.replaceChildren();
    },
  };
  buy.onclick = () => { if (!buy.disabled && selected) api.onBuy?.(selected); };
  close.onclick = () => api.onClose?.();
  return api;
}
