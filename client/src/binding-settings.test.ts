import { describe, expect, it } from "vitest";
import { BindingSettingsStore } from "./binding-settings";
import { BINDING_STORAGE_KEY, emptyBindingSettings, getBindingTokens } from "./input-bindings";

describe("shared persistent control profile", () => {
  it("loads defaults for existing users and persists edits across store instances", () => {
    const data = new Map<string, string>();
    const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
    const store = new BindingSettingsStore(storage);
    expect(store.get()).toEqual(emptyBindingSettings());
    expect(store.rebind("planetfall", "jump", ["KeyJ"]).ok).toBe(true);
    expect(data.has(BINDING_STORAGE_KEY)).toBe(true);
    expect(getBindingTokens(new BindingSettingsStore(storage).get(), "planetfall", "jump")).toEqual(["KeyJ"]);
  });
  it("does not persist or notify conflicting edits and permits contextual reset", () => {
    let saves = 0, notifications = 0;
    const store = new BindingSettingsStore({ getItem: () => null, setItem: () => { saves++; } });
    const unsubscribe = store.subscribe(() => { notifications++; });
    expect(store.rebind("planetfall", "jump", ["KeyE"]).ok).toBe(false);
    expect(saves).toBe(0); expect(notifications).toBe(0);
    store.rebind("planetfall", "jump", ["KeyJ"]); store.rebind("planet-run", "jump", ["KeyJ"]);
    store.resetContext("planetfall");
    expect(getBindingTokens(store.get(), "planetfall", "jump")).toEqual(["Space"]);
    expect(getBindingTokens(store.get(), "planet-run", "jump")).toEqual(["KeyJ"]);
    unsubscribe(); store.resetAll(); expect(notifications).toBe(3); expect(store.get()).toEqual(emptyBindingSettings());
  });
  it("isolates snapshots and subscriber payloads from accidental mutation", () => {
    const store = new BindingSettingsStore();
    store.rebind("planetfall", "jump", ["KeyJ"]);
    const snapshot = store.get(); snapshot.overrides.planetfall!.jump = ["KeyK"];
    store.subscribe(settings => { settings.overrides.planetfall!.jump = ["KeyL"]; });
    let second = "";
    store.subscribe(settings => { second = getBindingTokens(settings, "planetfall", "jump")[0]; });
    store.rebind("planetfall", "fire", ["Mouse4"]);
    expect(second).toBe("KeyJ"); expect(getBindingTokens(store.get(), "planetfall", "jump")).toEqual(["KeyJ"]);
  });
  it("recovers from corrupt storage and continues in session if storage is unavailable", () => {
    const broken = new BindingSettingsStore({ getItem: () => "broken", setItem: () => { throw Error("storage disabled"); } });
    expect(broken.get()).toEqual(emptyBindingSettings());
    expect(broken.rebind("planetfall", "jump", ["KeyJ"]).ok).toBe(true);
    expect(getBindingTokens(broken.get(), "planetfall", "jump")).toEqual(["KeyJ"]);
    expect(new BindingSettingsStore({ getItem: () => { throw Error("storage disabled"); }, setItem: () => {} }).get()).toEqual(emptyBindingSettings());
  });
});
