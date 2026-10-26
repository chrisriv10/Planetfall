import { pgValidateLoadout, type PgLoadout, type PgPrimaryWeaponId } from "@planetfall/shared";

export const PG_COMBAT_KITS_KEY = "planetfall:combat-kits:v1";
export type PgKitId = 0 | 1 | 2 | 3 | 4;
export interface PgCombatKits { version: 1; activeSlot: PgKitId; kits: PgLoadout[]; }
export type PgKitStorage = Pick<Storage, "getItem" | "setItem">;
const names = ["Assault", "Mobile", "Precision", "Close Quarters", "Custom 5"];
const weapons: PgPrimaryWeaponId[] = ["pulse", "nova", "rail", "photon", "helix"];
const clone = <T>(value: T): T => structuredClone(value);
export function pgDefaultCombatKits(): PgCombatKits {
  return { version: 1, activeSlot: 0, kits: names.map((name, kitId) => ({ name, kitId: kitId as PgKitId, primary: weapons[kitId], secondary: "comet", primaryModules: [], secondaryModules: [] })) };
}
/** Repair individual invalid slots, while never accepting user-authored weapon stats. */
export function pgReadCombatKits(raw: unknown): PgCombatKits {
  const defaults = pgDefaultCombatKits();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return defaults;
  const value = raw as Record<string, unknown>;
  // Version zero was the unversioned kit-array prototype. Future formats fail closed.
  if (value.version !== 1 && value.version !== 0 && value.version !== undefined) return defaults;
  if (!Array.isArray(value.kits)) return defaults;
  const kits = defaults.kits.map((fallback, index) => {
    const candidate = value.kits && (value.kits as unknown[])[index];
    const valid = pgValidateLoadout(candidate);
    return valid ? { ...valid, kitId: index as PgKitId, name: valid.name || fallback.name } : fallback;
  });
  const activeSlot = Number.isInteger(value.activeSlot) && Number(value.activeSlot) >= 0 && Number(value.activeSlot) < 5 ? value.activeSlot as PgKitId : 0;
  return { version: 1, activeSlot, kits };
}
function browserStorage(): PgKitStorage | undefined { try { return globalThis.localStorage; } catch { return undefined; } }
export function createPgCombatKitStore(storage: PgKitStorage | undefined = browserStorage()) {
  let state = pgDefaultCombatKits(), persistenceError = false;
  try { const raw = storage?.getItem(PG_COMBAT_KITS_KEY); if (raw) { try { state = pgReadCombatKits(JSON.parse(raw)); } catch { state = pgDefaultCombatKits(); } } } catch { persistenceError = true; }
  const persist = () => { try { if (!storage) { persistenceError = true; return; } storage.setItem(PG_COMBAT_KITS_KEY, JSON.stringify(state)); persistenceError = false; } catch { persistenceError = true; } };
  const selected = () => clone(state.kits[state.activeSlot]);
  const select = (slot: PgKitId): PgLoadout => { if (!Number.isInteger(slot) || slot < 0 || slot > 4) throw new Error("Invalid Combat Kit slot"); state.activeSlot = slot; persist(); return selected(); };
  return {
    snapshot: () => clone(state), selected, select,
    persistenceError: () => persistenceError,
    save(slot: PgKitId, raw: unknown): PgLoadout | null {
      if (!Number.isInteger(slot) || slot < 0 || slot > 4) return null;
      const valid = pgValidateLoadout(raw); if (!valid) return null;
      state.kits[slot] = { ...valid, kitId: slot, name: valid.name || names[slot] };
      state.activeSlot = slot; persist(); return selected();
    },
    reset(): PgLoadout { state = pgDefaultCombatKits(); persist(); return selected(); },
    selectPrimaryLegacy(primary: PgPrimaryWeaponId): PgLoadout {
      const current = selected();
      const valid = pgValidateLoadout({ ...current, primary, primaryModules: [] });
      if (!valid) return current;
      state.kits[state.activeSlot] = valid; persist(); return selected();
    },
  };
}
export type PgCombatKitStore = ReturnType<typeof createPgCombatKitStore>;
/** Draft edits are private copies. Only save or select touches the saved selection. */
export function createPgKitDraft(store: PgCombatKitStore) {
  let drafts = store.snapshot().kits, slot = store.snapshot().activeSlot;
  return {
    reload() { const saved = store.snapshot(); drafts = saved.kits; slot = saved.activeSlot; },
    slot: () => slot,
    select(next: PgKitId) { slot = next; },
    current: () => clone(drafts[slot]),
    update(patch: Partial<PgLoadout>) { drafts[slot] = { ...drafts[slot], ...clone(patch), kitId: slot }; },
    save() { const saved = store.save(slot, drafts[slot]); if (saved) drafts[slot] = clone(saved); return saved; },
    useSaved() { return store.select(slot); },
    dirty() { return JSON.stringify(drafts[slot]) !== JSON.stringify(store.snapshot().kits[slot]); },
  };
}
