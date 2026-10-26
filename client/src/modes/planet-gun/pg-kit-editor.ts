import { PG_MODULES, PG_PRIMARY_WEAPONS, PG_SECONDARY_WEAPONS, pgWeaponProfile, type PgLoadout, type PgModuleId, type PgPrimaryWeaponId, type PgSecondaryWeaponId, type PgWeaponId } from "@planetfall/shared";
import { createPgCombatKitStore, createPgKitDraft, type PgKitId, type PgKitStorage } from "./pg-combat-kits";
import "./pg-kit-editor.css";

export interface PgKitEditorOptions { onApply: (loadout: PgLoadout) => void; onClose?: () => void; onOpen?: () => void; storage?: PgKitStorage; }
let editorCount = 0;
export function createPgKitEditor(options: PgKitEditorOptions) {
  const store = createPgCombatKitStore(options.storage), draft = createPgKitDraft(store), prefix = `pg-kits-${++editorCount}`;
  const root = document.createElement("div"); root.className = "pg-kit-overlay pg-screen"; root.hidden = true;
  const panel = document.createElement("section"); panel.className = "pg-kit-panel mode-panel glass";
  panel.setAttribute("role", "dialog"); panel.setAttribute("aria-modal", "true"); panel.setAttribute("aria-labelledby", `${prefix}-title`);
  root.append(panel);
  let context: "lobby" | "game" = "lobby", feedback = "";
  const element = <K extends keyof HTMLElementTagNameMap>(tag: K, text = "", className = "") => { const node = document.createElement(tag); node.textContent = text; node.className = className; return node; };
  const button = (label: string, action: () => void, className = "button-secondary") => { const node = element("button", label, `button ${className}`); node.id=`${prefix}-action-${label.toLowerCase().replace(/[^a-z0-9]+/g,"-")}`; node.type = "button"; node.addEventListener("click", action); return node; };
  function close() { if (root.hidden) return; root.hidden = true; options.onClose?.(); }
  function apply(loadout: PgLoadout) { options.onApply(loadout); feedback = context === "game" ? "Kit queued. Applies at your next spawn." : "Combat Kit selected for your next match."; }
  function stats(weapon: PgWeaponId, modules: PgModuleId[]) {
    const base = pgWeaponProfile(weapon), effective = pgWeaponProfile(weapon, modules), table = element("table", "", "pg-kit-stats");
    const caption = element("caption", "Effective stats · change from unmodified weapon"); table.append(caption);
    const rows: [string, number, number, string][] = [["ADS", base.adsMs, effective.adsMs, " ms"], ["Sprint recovery", base.sprintDelayMs, effective.sprintDelayMs, " ms"], ["Magazine", base.magazine, effective.magazine, ""], ["Reload", base.reloadMs, effective.reloadMs, " ms"], ["ADS field of view", base.adsFov, effective.adsFov, "°"]];
    for (const [name, before, after, unit] of rows) { const row = element("tr"); const title = element("th", name); title.scope = "row"; const delta = after - before; row.append(title, element("td", `${Number(after.toFixed(1))}${unit}`), element("td", delta ? `${delta > 0 ? "+" : ""}${Number(delta.toFixed(1))}${unit}` : "—")); table.append(row); }
    const row = element("tr"); row.append(element("th", "Recoil"), element("td", `${effective.recoil.toFixed(4)} rad`), element("td", `${((effective.recoil / base.recoil - 1) * 100).toFixed(1)}%`)); table.append(row);
    return table;
  }
  function weaponSection(secondary: boolean) {
    const current = draft.current(), key = secondary ? "secondaryModules" : "primaryModules", weapon = secondary ? current.secondary : current.primary, modules = current[key] ?? [], limit = secondary ? 1 : 3;
    const section = element("section", "", "pg-kit-weapon"), heading = element("h3", secondary ? "03 / Secondary" : "02 / Primary");
    const select = element("select"), label = element("label", secondary ? "Secondary weapon" : "Primary weapon"); select.id = `${prefix}-${secondary ? "secondary" : "primary"}`; label.htmlFor = select.id;
    const weapons = secondary ? PG_SECONDARY_WEAPONS : PG_PRIMARY_WEAPONS;
    for (const id of weapons) { const option = element("option", pgWeaponProfile(id).name); option.value = id; select.append(option); }
    select.value = weapon; select.addEventListener("change", () => { draft.update(secondary ? { secondary: select.value as PgSecondaryWeaponId, secondaryModules: [] } : { primary: select.value as PgPrimaryWeaponId, primaryModules: [] }); feedback = ""; render(); document.getElementById(select.id)?.focus(); });
    section.append(heading, label, select);
    const fieldset = element("fieldset"), legend = element("legend", `Modules · ${modules.length}/${limit}`); fieldset.append(legend);
    for (const [id, module] of Object.entries(PG_MODULES) as [PgModuleId, typeof PG_MODULES[PgModuleId]][]) {
      const option = element("label", "", "pg-kit-module"), checkbox = element("input"); checkbox.type = "checkbox"; checkbox.checked = modules.includes(id); checkbox.id = `${prefix}-${key}-${id}`;
      checkbox.disabled = !checkbox.checked && (modules.length >= limit || !module.weapons.includes(weapon) || modules.some(other => PG_MODULES[other].category === module.category));
      checkbox.addEventListener("change", () => { draft.update({ [key]: checkbox.checked ? [...modules, id] : modules.filter(other => other !== id) }); feedback = ""; render(); document.getElementById(checkbox.id)?.focus(); });
      const copy = element("span"); copy.append(element("strong", module.name), element("small", `${module.category} · ${module.description}`)); option.append(checkbox, copy); fieldset.append(option);
    }
    section.append(fieldset, stats(weapon, modules)); return section;
  }
  function render() {
    const focusId = document.activeElement instanceof HTMLElement && root.contains(document.activeElement) ? document.activeElement.id : "";
    panel.replaceChildren();
    const header = element("div", "", "pg-kit-heading"); const titles = element("div"); titles.append(element("p", "PLANETFALL / PLANETGUN", "panel-kicker")); const title = element("h2", "Combat Kits"); title.id = `${prefix}-title`; titles.append(title); header.append(titles, button("Close", close, "button-quiet"));
    const note = element("p", context === "game" ? "Changes apply at your NEXT SPAWN. Your current weapons stay equipped." : "Build your kit before launch. Every weapon and module is available to all pilots.", "pg-kit-note");
    const tabs = element("div", "", "pg-kit-tabs"); tabs.setAttribute("role", "tablist"); tabs.setAttribute("aria-label", "Combat Kit slots");
    const saved = store.snapshot();
    saved.kits.forEach((kit, index) => { const tab = button(`${index + 1}. ${kit.name}${saved.activeSlot === index ? " · Selected" : ""}`, () => { draft.select(index as PgKitId); feedback = ""; render(); document.getElementById(`${prefix}-tab-${index}`)?.focus(); }); tab.id = `${prefix}-tab-${index}`; tab.setAttribute("role", "tab"); tab.tabIndex = draft.slot() === index ? 0 : -1; tab.setAttribute("aria-selected", String(draft.slot() === index)); tab.setAttribute("aria-controls", `${prefix}-draft`); tab.addEventListener("keydown", event => { const next = event.key === "ArrowRight" ? (index + 1) % 5 : event.key === "ArrowLeft" ? (index + 4) % 5 : event.key === "Home" ? 0 : event.key === "End" ? 4 : null; if (next === null) return; event.preventDefault(); draft.select(next as PgKitId); feedback = ""; render(); document.getElementById(`${prefix}-tab-${next}`)?.focus(); }); tabs.append(tab); });
    const form = element("div"); form.id = `${prefix}-draft`; form.setAttribute("role", "tabpanel"); form.setAttribute("aria-labelledby", `${prefix}-tab-${draft.slot()}`);
    const nameLabel = element("label", "01 / Kit name"), name = element("input"); name.type = "text"; name.id = `${prefix}-name`; name.maxLength = 24; name.value = draft.current().name ?? ""; nameLabel.htmlFor = name.id;
    name.addEventListener("input", () => { draft.update({ name: name.value }); feedback = ""; status.textContent = "Unsaved changes"; });
    const columns = element("div", "", "pg-kit-columns"); columns.append(weaponSection(false), weaponSection(true)); form.append(nameLabel, name, columns);
    const status = element("p", feedback || (draft.dirty() ? "Unsaved changes" : "Previewing saved kit"), "pg-kit-status"); status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite");
    if (store.persistenceError()) status.textContent += " · Local storage unavailable; kits last for this session only.";
    const actions = element("div", "", "pg-kit-actions");
    actions.append(button("Reset all kits", () => { store.reset(); draft.reload(); feedback = "Default kits restored. Select Save or Use Saved Kit to apply."; render(); }, "button-quiet"), button("Use Saved Kit", () => { apply(draft.useSaved()); render(); }), button("Save Kit & Select", () => { const valid = draft.save(); if (!valid) { feedback = "Enter a kit name of 1–24 characters and choose compatible modules."; render(); document.getElementById(name.id)?.focus(); return; } apply(valid); render(); }, "button-primary"));
    panel.append(header, note, tabs, form, status, actions); if (focusId) document.getElementById(focusId)?.focus();
  }
  root.addEventListener("keydown", event => {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); return; }
    if (event.key !== "Tab") return;
    event.stopPropagation();
    const focusable = [...panel.querySelectorAll<HTMLElement>("button:not(:disabled),input:not(:disabled),select:not(:disabled)")].filter(node => node.tabIndex >= 0); const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
  return {
    root, close,
    open(next: "lobby" | "game" = "lobby") { context = next; draft.reload(); feedback = ""; root.hidden = false; render(); options.onOpen?.(); panel.querySelector<HTMLElement>("button")?.focus(); },
    selected: store.selected,
    selectPrimaryLegacy(id: PgPrimaryWeaponId) { const kit = store.selectPrimaryLegacy(id); options.onApply(kit); if (!root.hidden) { draft.reload(); render(); } return kit; },
    refresh() { draft.reload(); if (!root.hidden) render(); },
  };
}
