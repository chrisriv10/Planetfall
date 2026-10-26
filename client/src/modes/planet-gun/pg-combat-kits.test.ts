import { describe, expect, it } from "vitest";
import { createPgCombatKitStore, createPgKitDraft, pgDefaultCombatKits, pgReadCombatKits, PG_COMBAT_KITS_KEY, type PgKitStorage } from "./pg-combat-kits";

function memory(initial?: string): PgKitStorage & { values: Map<string, string> } {
  const values = new Map<string, string>(initial ? [[PG_COMBAT_KITS_KEY, initial]] : []);
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } };
}
describe("Combat Kit persistence", () => {
  it("defaults to five independent slots and persists names, weapons, modules, and selection", () => {
    const storage = memory(), store = createPgCombatKitStore(storage);
    expect(store.snapshot().kits.map(kit => kit.name)).toEqual(["Assault", "Mobile", "Precision", "Close Quarters", "Custom 5"]);
    expect(store.save(4, { primary: "prism", secondary: "orbit", primaryModules: ["precision-lens", "lightweight-frame"], secondaryModules: ["expanded-cell"], name: "  Beam team  " })).toMatchObject({ kitId: 4, name: "Beam team" });
    expect(createPgCombatKitStore(storage).snapshot()).toEqual(store.snapshot());
    expect([...storage.values.keys()]).toEqual([PG_COMBAT_KITS_KEY]);
    const read = store.selected(); read.name = "external mutation"; read.primaryModules!.push("expanded-cell"); expect(store.selected().name).toBe("Beam team"); expect(store.selected().primaryModules).toHaveLength(2);
  });
  it("repairs malformed JSON, invalid individual kits, selections, and future versions", () => {
    expect(createPgCombatKitStore(memory("{bad")).snapshot()).toEqual(pgDefaultCombatKits());
    const data = pgDefaultCombatKits(); data.kits[1] = { ...data.kits[1], primary: "evil" as never }; data.kits[2] = { ...data.kits[2], name: "Custom precision" };
    expect(pgReadCombatKits(data).kits[1]).toEqual(pgDefaultCombatKits().kits[1]);
    expect(pgReadCombatKits(data).kits[2].name).toBe("Custom precision");
    expect(pgReadCombatKits({ ...data, activeSlot: 99 }).activeSlot).toBe(0);
    expect(pgReadCombatKits({ ...data, version: 99 })).toEqual(pgDefaultCombatKits());
    expect(pgReadCombatKits({ version: 1, kits: null })).toEqual(pgDefaultCombatKits());
  });
  it("migrates legacy kits missing module lists and slot IDs", () => {
    const old = { version: 0, activeSlot: 1, kits: [{ primary: "pulse", secondary: "comet", name: "Legacy" }, { primary: "nova", secondary: "comet" }] };
    expect(pgReadCombatKits(old)).toMatchObject({ version: 1, activeSlot: 1, kits: [{ kitId: 0, name: "Legacy", primaryModules: [], secondaryModules: [] }, { kitId: 1, name: "Mobile" }, {}, {}, {}] });
  });
  it("rejects manipulated stats and incompatible modules without changing saved state", () => {
    const store = createPgCombatKitStore(memory()), before = store.snapshot();
    for (const raw of [{ ...store.selected(), damage: 999 }, { ...store.selected(), primaryModules: ["reflex-array", "precision-lens"] }, { ...store.selected(), secondaryModules: ["expanded-cell", "lightweight-frame"] }, { ...store.selected(), name: "x".repeat(25) }, { ...store.selected(), name: "\u0000" }]) expect(store.save(0, raw)).toBeNull();
    expect(store.snapshot()).toEqual(before);
  });
  it("keeps edits private across tab switches and discards drafts on reopen", () => {
    const store = createPgCombatKitStore(memory()), draft = createPgKitDraft(store);
    draft.update({ name: "Not saved", primary: "arc", primaryModules: ["gyro-stabilizer"] }); draft.select(2); draft.update({ name: "Another draft" }); draft.select(0);
    expect(draft.current().name).toBe("Not saved"); expect(store.selected().name).toBe("Assault"); expect(draft.dirty()).toBe(true);
    draft.reload(); expect(draft.current().name).toBe("Assault");
    draft.select(2); draft.update({ name: "Saved" }); draft.save(); expect(store.snapshot().activeSlot).toBe(2); expect(store.selected().name).toBe("Saved"); expect(draft.dirty()).toBe(false);
    draft.update({ name: "Unsaved" }); expect(draft.useSaved().name).toBe("Saved"); expect(draft.dirty()).toBe(true);
  });
  it("reset and the legacy dropdown update saved selection without altering other kits", () => {
    const store = createPgCombatKitStore(memory()); store.select(3); const before = store.snapshot(); store.selectPrimaryLegacy("helix");
    expect(store.selected()).toMatchObject({ primary: "helix", kitId: 3, name: "Close Quarters" }); expect(store.snapshot().kits[2]).toEqual(before.kits[2]);
    store.reset(); expect(store.snapshot()).toEqual(pgDefaultCombatKits());
  });
  it("handles blocked or full storage without losing session edits", () => {
    const store = createPgCombatKitStore({ getItem() { throw new Error("blocked"); }, setItem() { throw new Error("full"); } });
    expect(store.persistenceError()).toBe(true); store.save(1, { primary: "arc", secondary: "orbit", name: "Session" }); expect(store.selected().name).toBe("Session"); expect(store.persistenceError()).toBe(true);
  });
});
