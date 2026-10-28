import { PG_MODULES, PG_PRIMARY_WEAPONS, PG_SECONDARY_WEAPONS, pgWeaponProfile, type PgLoadout, type PgModuleId, type PgPrimaryWeaponId, type PgSecondaryWeaponId } from "@planetfall/shared";
import { createPgCombatKitStore, createPgKitDraft, type PgKitId, type PgKitStorage } from "./pg-combat-kits";
import { createPgKitPreview } from "./pg-kit-preview";
import { PG_KIT_SOCKETS, pgKitStatRows, pgSocketModules, type PgKitSocket } from "./pg-kit-presentation";
import "./pg-kit-editor.css";

export interface PgKitEditorOptions { onApply: (loadout: PgLoadout) => void; onClose?: () => void; onOpen?: () => void; storage?: PgKitStorage; }
let editorCount = 0;
export function createPgKitEditor(options: PgKitEditorOptions) {
  const store = createPgCombatKitStore(options.storage), draft = createPgKitDraft(store), prefix = `pg-kits-${++editorCount}`;
  const element = <K extends keyof HTMLElementTagNameMap>(tag: K, text = "", className = "") => { const node = document.createElement(tag); node.textContent = text; node.className = className; return node; };
  const root = element("div", "", "pg-kit-overlay pg-screen"); root.hidden = true;
  const panel = element("section", "", "pg-kit-panel mode-panel glass");
  panel.setAttribute("role", "dialog"); panel.setAttribute("aria-modal", "true"); panel.setAttribute("aria-labelledby", `${prefix}-title`); root.append(panel);
  const previewHost = element("div", "", "pg-kit-preview");
  previewHost.setAttribute("aria-label", "Selected weapon 3D preview. Drag to rotate.");
  let preview: ReturnType<typeof createPgKitPreview> | undefined;
  let context: "lobby" | "game" = "lobby", feedback = "", secondary = false, socket: PgKitSocket = "optic", returnFocus: HTMLElement | null = null;
  const button = (label: string, action: () => void, className = "button-secondary") => { const node = element("button", label, `button ${className}`); node.id = `${prefix}-action-${label.toLowerCase().replace(/[^a-z0-9]+/g,"-")}`; node.type = "button"; node.addEventListener("click", action); return node; };
  function close() { if (root.hidden) return; root.hidden = true; preview?.setVisible(false); options.onClose?.(); if (returnFocus?.isConnected) returnFocus.focus(); }
  function apply(loadout: PgLoadout) { options.onApply(loadout); feedback = context === "game" ? "Kit queued. Applies at your next spawn." : "Combat Kit selected for your next match."; }
  function render() {
    const focusId = document.activeElement instanceof HTMLElement && root.contains(document.activeElement) ? document.activeElement.id : "";
    const current = draft.current(), saved = store.snapshot(), weapon = secondary ? current.secondary : current.primary;
    const key = secondary ? "secondaryModules" : "primaryModules", modules = current[key] ?? [], limit = secondary ? 1 : 3;
    panel.replaceChildren();
    const header = element("div", "", "pg-kit-heading"), titles = element("div");
    titles.append(element("p", "PLANETFALL / PLANETGUN / ARMORY", "panel-kicker"));
    const title = element("h2", "Combat Kits"); title.id = `${prefix}-title`; titles.append(title);
    header.append(titles, button("Close", close, "button-quiet"));
    const note = element("p", context === "game" ? "Changes apply at your NEXT SPAWN. Your current weapons stay equipped." : "Your hardware. Your playstyle. All weapons and modules available to every pilot.", "pg-kit-note");
    const layout = element("div", "", "pg-kit-layout"), tabs = element("div", "", "pg-kit-tabs"); tabs.setAttribute("role", "tablist"); tabs.setAttribute("aria-label", "Combat Kit slots"); tabs.setAttribute("aria-orientation", "vertical");
    saved.kits.forEach((savedKit, index) => {
      const kit = draft.slot() === index ? current : savedKit;
      const tab = button("", () => { draft.select(index as PgKitId); feedback = ""; render(); document.getElementById(`${prefix}-tab-${index}`)?.focus(); }, "pg-kit-card");
      tab.id = `${prefix}-tab-${index}`; tab.setAttribute("role", "tab"); tab.tabIndex = draft.slot() === index ? 0 : -1; tab.setAttribute("aria-selected", String(draft.slot() === index)); tab.setAttribute("aria-controls", `${prefix}-draft`);
      tab.append(element("small", `0${index + 1} / ${saved.activeSlot === index ? "EQUIPPED" : "COMBAT KIT"}`, "pg-kit-card-index"), element("strong", kit.name ?? `Kit ${index + 1}`));
      const thumbnail = preview?.thumbnail(kit.primary, kit.primaryModules ?? []);
      if (thumbnail) { const img = element("img"); img.src = thumbnail; img.alt = ""; img.className = "pg-kit-thumbnail"; tab.append(img); }
      tab.append(element("span", pgWeaponProfile(kit.primary).name), element("small", (kit.primaryModules ?? []).map(id => PG_MODULES[id].name).join(" · ") || "Standard configuration"), element("small", `${pgWeaponProfile(kit.secondary).name} / ${(kit.secondaryModules ?? []).map(id => PG_MODULES[id].name).join(" · ") || "Standard"}`, "pg-kit-card-secondary"));
      tab.addEventListener("keydown", event => { const next = ["ArrowDown", "ArrowRight"].includes(event.key) ? (index + 1) % 5 : ["ArrowUp", "ArrowLeft"].includes(event.key) ? (index + 4) % 5 : event.key === "Home" ? 0 : event.key === "End" ? 4 : null; if (next === null) return; event.preventDefault(); draft.select(next as PgKitId); feedback = ""; render(); document.getElementById(`${prefix}-tab-${next}`)?.focus(); }); tabs.append(tab);
    });
    const form = element("div", "", "pg-kit-workbench"); form.id = `${prefix}-draft`; form.setAttribute("role", "tabpanel"); form.setAttribute("aria-labelledby", `${prefix}-tab-${draft.slot()}`);
    const nameRow = element("div", "", "pg-kit-name-row"), nameLabel = element("label", "KIT NAME"), name = element("input"); name.type = "text"; name.id = `${prefix}-name`; name.maxLength = 24; name.value = current.name ?? ""; nameLabel.htmlFor = name.id;
    name.addEventListener("input", () => { draft.update({ name: name.value }); feedback = ""; status.textContent = "Unsaved changes"; const label = tabs.querySelector(`#${prefix}-tab-${draft.slot()} strong`); if (label) label.textContent = name.value; }); nameRow.append(nameLabel, name);
    const weaponTabs = element("div", "", "pg-kit-weapon-tabs");
    for (const isSecondary of [false, true]) { const id = isSecondary ? current.secondary : current.primary; const toggle = button(`${isSecondary ? "02 / SECONDARY" : "01 / PRIMARY"} · ${pgWeaponProfile(id).name}`, () => { secondary = isSecondary; render(); }); toggle.setAttribute("aria-pressed", String(secondary === isSecondary)); weaponTabs.append(toggle); }
    const stage = element("section", "", "pg-kit-stage"), stageHeading = element("div", "", "pg-kit-stage-heading");
    stageHeading.append(element("p", secondary ? "SECONDARY WEAPON" : "PRIMARY WEAPON", "panel-kicker"), element("h3", pgWeaponProfile(weapon).name));
    const select = element("select"), weaponLabel = element("label", "Change weapon"); select.id = `${prefix}-${secondary ? "secondary" : "primary"}`; weaponLabel.htmlFor = select.id;
    for (const id of secondary ? PG_SECONDARY_WEAPONS : PG_PRIMARY_WEAPONS) { const option = element("option", pgWeaponProfile(id).name); option.value = id; select.append(option); } select.value = weapon;
    select.addEventListener("change", () => { draft.update(secondary ? { secondary: select.value as PgSecondaryWeaponId, secondaryModules: [] } : { primary: select.value as PgPrimaryWeaponId, primaryModules: [] }); feedback = ""; render(); document.getElementById(select.id)?.focus(); });
    stageHeading.append(weaponLabel, select); stage.append(stageHeading, previewHost, element("p", "DRAG TO INSPECT · LIVE MODULE PREVIEW", "pg-kit-inspect-hint"));
    const sockets = element("div", "", "pg-kit-sockets"); sockets.setAttribute("aria-label", "Module sockets");
    for (const category of PG_KIT_SOCKETS) { const installed = modules.find(id => PG_MODULES[id].category === category); const control = button("", () => { socket = category; render(); }, "pg-kit-socket"); control.id = `${prefix}-socket-${category}`; control.setAttribute("aria-pressed", String(socket === category)); control.append(element("small", category.toUpperCase()), element("strong", installed ? PG_MODULES[installed].name : "Standard"), element("span", installed ? "INSTALLED" : "AVAILABLE")); sockets.append(control); }
    stage.append(sockets);
    const details = element("aside", "", "pg-kit-details"); details.append(element("p", `${socket.toUpperCase()} / ${modules.length} OF ${limit} MODULES`, "panel-kicker"), element("h3", "Tune your weapon"));
    const installed = modules.find(id => PG_MODULES[id].category === socket);
    const standard = button("Standard · no module", () => { draft.update({ [key]: modules.filter(id => PG_MODULES[id].category !== socket) }); feedback = ""; render(); }, "pg-kit-module"); standard.setAttribute("aria-pressed", String(!installed)); details.append(standard);
    for (const id of pgSocketModules(weapon, socket)) {
      const module = PG_MODULES[id], selected = modules.includes(id);
      const control = button("", () => { draft.update({ [key]: [...modules.filter(other => PG_MODULES[other].category !== socket), id] }); feedback = ""; render(); }, "pg-kit-module");
      control.id = `${prefix}-${key}-${id}`; control.setAttribute("aria-pressed", String(selected)); control.disabled = !selected && !installed && modules.length >= limit;
      control.append(element("strong", module.name), element("small", module.description)); details.append(control);
    }
    if (modules.length >= limit && !installed) details.append(element("p", `All ${limit} module slots are in use. Choose an installed socket to remove or replace a module.`, "pg-kit-note"));
    const stats = element("table", "", "pg-kit-stats"); stats.append(element("caption", "EFFECTIVE STATS / VS. STANDARD"));
    for (const metric of pgKitStatRows(weapon, modules)) { const row = element("tr"), label = element("th", metric.name); label.scope = "row"; const delta = element("td", metric.deltaText); delta.dataset.benefit = metric.benefit; row.append(label, element("td", metric.value), delta); stats.append(row); } details.append(stats);
    const content = element("div", "", "pg-kit-content"); content.append(stage, details); form.append(nameRow, weaponTabs, content); layout.append(tabs, form);
    const status = element("p", feedback || (draft.dirty() ? "Unsaved changes" : "Previewing saved kit"), "pg-kit-status"); status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite");
    if (store.persistenceError()) status.textContent += " · Local storage unavailable; kits last for this session only.";
    const actions = element("div", "", "pg-kit-actions"); actions.append(button("Reset all kits", () => { store.reset(); draft.reload(); feedback = "Default kits restored. Select Save or Use Saved Kit to apply."; render(); }, "button-quiet"), button("Use Saved Kit", () => { apply(draft.useSaved()); render(); }), button("Save Kit & Select", () => { const valid = draft.save(); if (!valid) { feedback = "Enter a kit name of 1–24 characters and choose compatible modules."; render(); document.getElementById(name.id)?.focus(); return; } apply(valid); render(); }, "button-primary"));
    panel.append(header, note, layout, status, actions);
    preview?.setWeapon(weapon, modules); preview?.setVisible(!root.hidden);
    if (focusId) document.getElementById(focusId)?.focus();
  }
  root.addEventListener("keydown", event => {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); return; }
    if (event.key !== "Tab") return; event.stopPropagation();
    const focusable = [...panel.querySelectorAll<HTMLElement>("button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex='0']")].filter(node => node.tabIndex >= 0); const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
  return {
    root, close,
    open(next: "lobby" | "game" = "lobby") { returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null; context = next; draft.reload(); feedback = ""; root.hidden = false; if (!preview) preview = createPgKitPreview(previewHost); render(); options.onOpen?.(); panel.querySelector<HTMLElement>("button")?.focus(); },
    selected: store.selected,
    selectPrimaryLegacy(id: PgPrimaryWeaponId) { const kit = store.selectPrimaryLegacy(id); options.onApply(kit); if (!root.hidden) { draft.reload(); render(); } return kit; },
    refresh() { draft.reload(); if (!root.hidden) render(); },
    dispose() { close(); preview?.dispose(); preview = undefined; root.remove(); },
  };
}
