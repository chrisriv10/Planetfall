import { describe, expect, it, vi } from "vitest";
import { BindingSettingsStore, type BindingStorage } from "./binding-settings";
import { createPlayerGuide, PLAYER_GUIDE_STORAGE_KEY } from "./player-guide";
import { GUIDE_FAMILIES, getPlayerGuideSection } from "./player-guide-content";

function setup(raw?: string) {
  const values = new Map<string, string>();
  if (raw) values.set(PLAYER_GUIDE_STORAGE_KEY, raw);
  const storage: BindingStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } };
  const bindings = new BindingSettingsStore(storage);
  return { storage, bindings, guide: createPlayerGuide({ storage, bindings }) };
}

describe("player guide lifecycle", () => {
  it("shows first guidance only at safe lobby/countdown transitions, without opening help", () => {
    const { guide } = setup();
    expect(guide.getState().hint).toBeNull();
    for (const phase of ["playing", "overtime", "drop", "race", "results", "paused", "menu"]) {
      guide.setContext({ family: "planetfall", phase });
      expect(guide.getState().hint).toBeNull();
    }
    guide.setContext({ family: "planetfall", phase: "lobby" });
    expect(guide.getState().hint?.id).toBe("first");
    expect(guide.getState().open).toBe(false);
    guide.setContext({ family: "planetfall", phase: "countdown" });
    expect(guide.getState().hint?.id).toBe("first");
    guide.dispose();
  });

  it("persists individual dismissals and completion separately for every family", () => {
    const { guide, storage, bindings } = setup();
    for (const family of GUIDE_FAMILIES) {
      guide.setContext({ family, phase: "lobby" });
      expect(guide.getState().hint?.id).toBe("first");
      guide.dismissHint();
      expect(guide.getState().hint?.id).toBe("controls");
      expect(guide.getState().completed[family]).toBe(false);
      const reloaded = createPlayerGuide({ storage, bindings });
      reloaded.setContext({ family, phase: "countdown" });
      expect(reloaded.getState().hint?.id).toBe("controls");
      reloaded.dispose();
      guide.dismissHint(); guide.dismissHint();
      expect(guide.getState().completed[family]).toBe(true);
      expect(guide.getState().hint).toBeNull();
    }
    guide.dispose();
    const reloaded = createPlayerGuide({ storage, bindings });
    for (const family of GUIDE_FAMILIES) {
      reloaded.setContext({ family, phase: "lobby" });
      expect(reloaded.getState().hint).toBeNull();
      expect(reloaded.getState().completed[family]).toBe(true);
    }
    reloaded.dispose();
  });

  it("supports skip, disable, reset and manual help even after guidance completion", () => {
    const { guide, storage, bindings } = setup();
    guide.setContext({ family: "planet-run", phase: "lobby" });
    guide.open(); guide.close();
    expect(guide.getState().completed["planet-run"]).toBe(false);
    guide.skipFamily();
    expect(guide.getState().completed["planet-run"]).toBe(true);
    guide.setContext({ family: "battle-royale", phase: "lobby" });
    expect(guide.getState().hint).not.toBeNull();
    guide.setEnabled(false);
    expect(guide.getState().hint).toBeNull();
    const reloaded = createPlayerGuide({ storage, bindings });
    expect(reloaded.getState().enabled).toBe(false);
    reloaded.open("planet-run");
    expect(reloaded.getState().open).toBe(true);
    expect(reloaded.getState().guide.title).toBe("PlanetRun");
    reloaded.reset("planet-run");
    expect(reloaded.getState().enabled).toBe(false);
    expect(reloaded.getState().completed["planet-run"]).toBe(false);
    reloaded.reset();
    expect(reloaded.getState().enabled).toBe(true);
    reloaded.dispose(); guide.dispose();
  });

  it("refreshes customized keyboard, unbound and controller labels without consuming input", () => {
    const { guide, bindings } = setup();
    const listener = vi.fn();
    guide.subscribe(listener);
    guide.setContext({ family: "planet-run", phase: "lobby", inputMethod: "keyboard" });
    expect(bindings.rebind("planet-run", "dive", ["KeyH"]).ok).toBe(true);
    expect(guide.getState().guide.controls.find(c => c.action === "Dive")?.label).toBe("H");
    expect(listener.mock.lastCall?.[0].guide.controls.find((c: { action: string }) => c.action === "Dive")?.label).toBe("H");
    bindings.rebind("planet-run", "jump", null);
    expect(guide.getState().guide.controls.find(c => c.action === "Jump")?.label).toBe("UNBOUND");
    guide.setContext({ family: "planet-run", phase: "playing", inputMethod: "gamepad" });
    expect(guide.getState().guide.controls.find(c => c.action === "Dive")?.label).toBe("X");
    expect(guide.getState().hint).toBeNull();
    // The controller works in a DOM-free test environment: no event interception,
    // pointer-lock calls, focus changes, timers, or simulation hooks are required.
    guide.dispose();
  });

  it("updates submode binding context and keeps manual tabs separate from current hints", () => {
    const { guide, bindings } = setup();
    bindings.rebind("planet-gun:planetzombies", "interact", ["Mouse4"]);
    guide.setContext({ family: "planet-gun", phase: "lobby", submode: "planetzombies" });
    expect(guide.getState().guide.controls.find(c => c.action === "Interact")?.label).toBe("MOUSE 5");
    expect(guide.getState().hint?.text).toContain("PlanetZombies");
    guide.open("planetfall");
    expect(guide.getState().guide.title).toBe("Planetfall");
    expect(guide.getState().hint).toBeNull();
    guide.close();
    expect(guide.getState().family).toBe("planet-gun");
    expect(guide.getState().hint?.text).toContain("PlanetZombies");
    guide.dispose();
  });

  it("handles corrupt, old, oversized or unavailable storage safely", () => {
    for (const raw of ["broken", "null", "[]", '{"version":0,"enabled":false}', "x".repeat(9000), '{"version":1,"completed":null,"dismissed":{"planetfall":"first"}}']) {
      const { guide } = setup(raw);
      guide.setContext({ family: "planetfall", phase: "lobby" });
      expect(guide.getState().enabled).toBe(true);
      expect(guide.getState().hint?.id).toBe("first");
      guide.dispose();
    }
    const failing = { getItem: () => { throw Error("unavailable"); }, setItem: () => { throw Error("full"); } };
    const guide = createPlayerGuide({ storage: failing });
    expect(() => { guide.setEnabled(false); guide.skipFamily(); guide.reset(); }).not.toThrow();
    expect(guide.getState().enabled).toBe(true);
    guide.dispose();
  });

  it("cleans up bindings and subscribers and isolates state snapshots", () => {
    const { guide, bindings } = setup();
    const first = vi.fn(), second = vi.fn();
    const unsubscribe = guide.subscribe(first);
    guide.subscribe(second);
    expect(first).toHaveBeenCalledTimes(1);
    const state = guide.getState();
    state.completed.planetfall = true; state.context.phase = "playing";
    expect(guide.getState().completed.planetfall).toBe(false);
    unsubscribe(); guide.open();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);
    guide.dispose(); guide.dispose();
    bindings.rebind("planet-run", "dive", ["KeyH"]);
    guide.open(); guide.setContext({ family: "planet-run", phase: "lobby" });
    expect(second).toHaveBeenCalledTimes(2);
    expect(guide.getState().open).toBe(false);
    expect(guide.getState().hint).toBeNull();
  });
});

describe("How to Play rules", () => {
  it("covers the actual family objectives and all five distinct PlanetGun rulesets", () => {
    const sections = GUIDE_FAMILIES.map(family => getPlayerGuideSection(family));
    for (const section of sections) {
      for (const field of [section.objective, section.win, section.first]) expect(field.length).toBeGreaterThan(20);
      expect(section.controls.length).toBeGreaterThanOrEqual(4);
      expect(section.mechanics.length).toBeGreaterThan(1);
      expect(section.mistakes.length).toBeGreaterThan(0);
    }
    expect(sections[0].win).toContain("integrity");
    expect(sections[1].win).toContain("team");
    expect(sections[2].win).toContain("qualifying");
    const modes = sections[3].submodes;
    expect(modes.map(m => m.id)).toEqual(["deathmatch", "planetstrike", "planetwatch", "planetsiege", "planetzombies"]);
    expect(modes[1].text).toContain("defuse");
    expect(modes[2].text).toContain("Relay");
    expect(modes[3].text).toContain("uplink");
    expect(modes[4].text).toContain("finite wave");
  });
});
