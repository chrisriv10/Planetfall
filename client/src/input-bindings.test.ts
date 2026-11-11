import { describe, expect, it } from "vitest";
import { BINDING_CONTEXTS, bindingActions, bindingConflicts, bindingLabel, bindingTokenLabel, defaultBindingTokens, emptyBindingSettings, getBindingTokens, isBindingToken, keyboardBindingToken, mouseBindingToken, parseBindingSettings, resetBinding, resetContextBindings, serializeBindingSettings, setBinding, textInputOwnsBindings, wheelBindingToken, type BindingAction, type BindingContext, type BindingSettings } from "./input-bindings";

function edit(settings: BindingSettings, context: BindingContext, action: BindingAction, tokens: string[] | null): BindingSettings {
  const result = setBinding(settings, context, action, tokens);
  if (!result.ok) throw new Error(JSON.stringify(result));
  return result.settings;
}
describe("canonical contextual defaults", () => {
  it("keeps every default context conflict free", () => {
    for (const context of BINDING_CONTEXTS) for (const action of bindingActions(context)) expect(bindingConflicts(emptyBindingSettings(), context, action, defaultBindingTokens(context, action)), `${context}/${action}`).toEqual([]);
  });
  it.each(["planetfall", "battle-royale", "planet-run", "planet-gun", "planet-gun:planetstrike", "planet-gun:planetwatch", "planet-gun:planetsiege", "planet-gun:planetzombies"] as BindingContext[])("preserves WASD and Space in %s", context => {
    for (const [action, code] of Object.entries({ moveForward: "KeyW", moveBackward: "KeyS", moveLeft: "KeyA", moveRight: "KeyD", jump: "Space" })) expect(defaultBindingTokens(context, action as BindingAction)).toEqual([code]);
  });
  it("preserves the complete Classic map", () => {
    const expected = { interact: ["KeyE"], crouch: ["ControlLeft", "ControlRight"], sprint: ["ShiftLeft", "ShiftRight"], pause: ["Escape"], scoreboard: ["Tab"], emote: ["KeyV"], switchWeapon: ["KeyQ"], repair: ["KeyR"], fire: ["Mouse0"], aim: ["Mouse2"], ping: ["Mouse1"], inventory: ["KeyI"], map: ["KeyM"], nextTarget: ["WheelDown", "ArrowRight"], previousTarget: ["WheelUp", "ArrowLeft"], slot1: ["Digit1"], slot2: ["Digit2"], slot3: ["Digit3"], slot4: ["Digit4"], slot5: ["Digit5"] };
    for (const [action, tokens] of Object.entries(expected)) expect(defaultBindingTokens("planetfall", action as BindingAction)).toEqual(tokens);
  });
  it("maps Royale repair to reload and retains vehicle movement/interact", () => {
    expect(defaultBindingTokens("battle-royale", "reload")).toEqual(["KeyR"]);
    expect(bindingActions("battle-royale")).not.toContain("repair");
    expect(defaultBindingTokens("battle-royale", "interact")).toEqual(["KeyE"]);
  });
  it("preserves Run dive and spectator Q/E", () => {
    expect(defaultBindingTokens("planet-run", "dive")).toEqual(["ShiftLeft", "ShiftRight"]);
    expect(defaultBindingTokens("planet-run", "emote")).toEqual(["KeyV"]);
    expect(defaultBindingTokens("planet-run:spectator", "previousTarget")).toEqual(["KeyQ"]);
    expect(defaultBindingTokens("planet-run:spectator", "nextTarget")).toEqual(["KeyE"]);
  });
  it("preserves Gun combat, ability, menu and Siege keys without stealing Q/E/F/G", () => {
    for (const context of ["planet-gun:planetstrike", "planet-gun:planetwatch", "planet-gun:planetsiege", "planet-gun:planetzombies"] as const) {
      const expected = { fire: "Mouse0", aim: "Mouse2", reload: "KeyR", slot1: "Digit1", slot2: "Digit2", ability1: "KeyQ", interact: "KeyE", ability2: "KeyF", ultimate: "KeyG", buyMenu: "KeyB", reinforce: "KeyT" };
      for (const [action, token] of Object.entries(expected)) expect(defaultBindingTokens(context, action as BindingAction)).toEqual([token]);
    }
    expect(defaultBindingTokens("planet-gun:planetsiege", "crouch")).toEqual(["ControlLeft", "ControlRight"]);
    expect(defaultBindingTokens("planet-gun:planetstrike", "crouch")).toEqual(["ControlLeft", "ControlRight", "KeyC"]);
    for (const [action, token] of Object.entries({ leanLeft: "KeyZ", leanRight: "KeyC", drone: "KeyV", camera: "KeyX" })) expect(defaultBindingTokens("planet-gun:planetsiege", action as BindingAction)).toEqual([token]);
    expect(defaultBindingTokens("planet-gun:planetstrike", "drop")).toEqual(["KeyX"]);
  });
});
describe("binding edits and persistence", () => {
  it("allows sharing in distinct contexts but rejects same-context overlap", () => {
    const settings = edit(emptyBindingSettings(), "planet-run", "jump", ["KeyQ"]);
    expect(setBinding(settings, "planetfall", "fire", ["KeyQ"])).toMatchObject({ ok: false, reason: "conflict", conflicts: [{ action: "switchWeapon", token: "KeyQ" }] });
    expect(setBinding(settings, "planet-gun:planetsiege", "leanLeft", ["KeyQ"])).toMatchObject({ ok: false, reason: "conflict" });
    expect(setBinding(settings, "planetfall", "jump", ["KeyJ"])).toMatchObject({ ok: true });
  });
  it("supports mouse/wheel remapping and explicit unbound; edits are immutable", () => {
    const original = emptyBindingSettings();
    let settings = edit(original, "planetfall", "fire", null);
    settings = edit(settings, "planetfall", "jump", ["Mouse0", "Mouse4", "WheelUp"].slice(0, 2));
    expect(getBindingTokens(settings, "planetfall", "fire")).toEqual([]);
    expect(bindingLabel(settings, "planetfall", "fire")).toBe("UNBOUND");
    expect(original).toEqual(emptyBindingSettings());
    expect(parseBindingSettings(serializeBindingSettings(settings))).toEqual(settings);
  });
  it("restores an individual default or one context without losing other contexts", () => {
    let settings = edit(emptyBindingSettings(), "planetfall", "jump", ["KeyJ"]);
    settings = edit(settings, "planet-run", "jump", ["KeyK"]);
    const reset = resetBinding(settings, "planetfall", "jump");
    expect(reset.ok && getBindingTokens(reset.settings, "planetfall", "jump")).toEqual(["Space"]);
    expect(resetContextBindings(settings, "planetfall").overrides).toEqual({ "planet-run": { jump: ["KeyK"] } });
    settings = edit(settings, "planetfall", "fire", ["Space"]);
    expect(resetBinding(settings, "planetfall", "jump")).toMatchObject({ ok: false, reason: "conflict" });
  });
  it("validates final swaps independent of serialized entry order", () => {
    const value = { version: 1, overrides: { planetfall: { jump: ["KeyE"], interact: ["Space"] } } };
    expect(parseBindingSettings(value)).toEqual(value);
  });
  it.each([undefined, null, "broken", "x".repeat(32_769), { version: 2, overrides: {} }, { version: 1, overrides: [], extra: true }, { version: 1, overrides: { unknown: {} } }, { version: 1, overrides: { planetfall: { unknown: ["KeyJ"] } } }, { version: 1, overrides: { planetfall: { jump: ["KeyE"] } } }, { version: 1, overrides: { planetfall: { jump: ["Enter"] } } }, { version: 1, overrides: { planetfall: { jump: [] } } }, { version: 1, overrides: { planetfall: { jump: ["KeyJ", "KeyJ"] } } }, { version: 1, overrides: { planetfall: { jump: ["KeyJ", "KeyK", "KeyL", "KeyP"] } } }, { version: 1, overrides: { planetfall: { jump: ["Escape"] } } }, JSON.parse('{"version":1,"overrides":{"__proto__":{"jump":["KeyJ"]}}}')])("safely rejects malformed persisted value %#", value => {
    expect(parseBindingSettings(value)).toEqual(emptyBindingSettings());
  });
  it("does not assign unavailable actions to a context", () => {
    expect(setBinding(emptyBindingSettings(), "planet-run", "fire", ["KeyJ"])).toMatchObject({ ok: false, reason: "invalid" });
  });
});
describe("physical input normalization and labels", () => {
  it.each(["KeyJ", "Digit9", "ControlRight", "Mouse0", "Mouse4", "WheelUp", "WheelDown"])("accepts %s", token => expect(isBindingToken(token)).toBe(true));
  it.each(["Keyj", "Ctrl+KeyJ", "Mouse5", "WheelLeft", "Enter", "MetaLeft", "AltLeft", "F1", "F5", "F11", "F12", "", "__proto__"])("rejects %s", token => expect(isBindingToken(token)).toBe(false));
  it("normalizes mouse and wheel events and rejects invalid numbers", () => {
    expect(mouseBindingToken(2)).toBe("Mouse2"); expect(mouseBindingToken(5)).toBeNull(); expect(mouseBindingToken(1.5)).toBeNull();
    expect(wheelBindingToken(-1)).toBe("WheelUp"); expect(wheelBindingToken(1)).toBe("WheelDown"); expect(wheelBindingToken(0)).toBeNull(); expect(wheelBindingToken(NaN)).toBeNull();
  });
  it("protects modifier shortcuts, composing input and native text fields", () => {
    expect(keyboardBindingToken({ code: "KeyW", ctrlKey: true })).toBeNull();
    expect(keyboardBindingToken({ code: "KeyQ", altKey: true })).toBeNull();
    expect(keyboardBindingToken({ code: "KeyR", metaKey: true })).toBeNull();
    expect(keyboardBindingToken({ code: "ControlLeft", ctrlKey: true })).toBe("ControlLeft");
    expect(keyboardBindingToken({ code: "KeyE", isComposing: true })).toBeNull();
    for (const tagName of ["input", "TEXTAREA", "SELECT"]) {
      const target = { tagName } as unknown as EventTarget;
      expect(textInputOwnsBindings(target)).toBe(true);
      expect(keyboardBindingToken({ code: "Space", target })).toBeNull();
    }
    expect(textInputOwnsBindings({ isContentEditable: true } as unknown as EventTarget)).toBe(true);
    expect(textInputOwnsBindings({ closest: () => ({}) } as unknown as EventTarget)).toBe(true);
  });
  it("renders contextual current labels including secondary controls", () => {
    expect(bindingTokenLabel("Mouse2")).toBe("RMB");
    expect(bindingLabel(emptyBindingSettings(), "planet-gun:planetsiege", "leanRight")).toBe("C");
    expect(bindingLabel(edit(emptyBindingSettings(), "planetfall", "jump", ["KeyJ", "Mouse4"]), "planetfall", "jump")).toBe("J / MOUSE 5");
  });
  it("accepts bound Ctrl gameplay chords only under explicit capture ownership", () => {
    const policy = { capturedGameplay: true, boundTokens: ["KeyW", "KeyR", "Tab"] };
    expect(keyboardBindingToken({ code: "KeyW", ctrlKey: true }, policy)).toBe("KeyW");
    expect(keyboardBindingToken({ code: "KeyR", ctrlKey: true }, policy)).toBe("KeyR");
    expect(keyboardBindingToken({ code: "KeyJ", ctrlKey: true }, policy)).toBeNull();
    expect(keyboardBindingToken({ code: "KeyW", ctrlKey: true }, { capturedGameplay: true })).toBeNull();
    expect(keyboardBindingToken({ code: "KeyR", ctrlKey: true }, { ...policy, capturedGameplay: false })).toBeNull();
    expect(keyboardBindingToken({ code: "KeyW", ctrlKey: true, target: { tagName: "INPUT" } as unknown as EventTarget }, policy)).toBeNull();
    for (const event of [{ code: "Tab", ctrlKey: true }, { code: "Tab", shiftKey: true }, { code: "Tab", ctrlKey: true, shiftKey: true }, { code: "KeyW", metaKey: true }, { code: "KeyW", altKey: true }]) expect(keyboardBindingToken(event, policy)).toBeNull();
    expect(keyboardBindingToken({ code: "ControlRight", ctrlKey: true, altKey: true }, policy)).toBe("ControlRight");
  });
});
