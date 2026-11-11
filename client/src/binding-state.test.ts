import { describe, expect, it } from "vitest";
import { BindingState } from "./binding-state";
import { emptyBindingSettings, setBinding } from "./input-bindings";

describe("binding event lifecycle", () => {
  it("preserves taps that happen between frames and ignores repeat", () => {
    const state = new BindingState("planetfall");
    state.keyDown({ code: "Space" }); state.keyDown({ code: "Space", repeat: true }); state.keyUp({ code: "Space" });
    const frame = state.sample(); expect([...frame.pressed]).toEqual(["jump"]); expect([...frame.released]).toEqual(["jump"]); expect(frame.held.size).toBe(0);
    expect(state.sample().pressed.size).toBe(0);
  });
  it("releases the original action when rebound while held", () => {
    const state = new BindingState("planetfall"); state.keyDown({ code: "Space" }); state.sample();
    const changed = setBinding(emptyBindingSettings(), "planetfall", "jump", ["KeyJ"]);
    if (!changed.ok) throw Error("edit failed");
    state.setSettings(changed.settings);
    expect(state.held("jump")).toBe(true);
    state.keyUp({ code: "Space" }); expect([...state.sample().released]).toEqual(["jump"]);
    expect(state.keyDown({ code: "Space" })).toEqual([]);
    expect(state.keyDown({ code: "KeyJ" })).toEqual(["jump"]);
  });
  it("supports multiple physical bindings without releasing too soon", () => {
    const state = new BindingState("planetfall");
    state.keyDown({ code: "ShiftLeft" }); state.keyDown({ code: "ShiftRight" });
    expect([...state.sample().pressed]).toEqual(["sprint"]);
    state.keyUp({ code: "ShiftLeft" }); expect(state.sample().released.size).toBe(0); expect(state.held("sprint")).toBe(true);
    state.keyUp({ code: "ShiftRight" }); expect([...state.sample().released]).toEqual(["sprint"]);
  });
  it("clears held input on context changes and requires a physical release", () => {
    const state = new BindingState("planetfall"); state.keyDown({ code: "KeyQ" }); state.sample();
    state.setContext("planet-gun:planetsiege"); expect([...state.sample().released]).toEqual(["switchWeapon"]);
    expect(state.keyDown({ code: "KeyQ", repeat: true })).toEqual([]); state.keyUp({ code: "KeyQ" });
    expect(state.keyDown({ code: "KeyQ" })).toEqual(["ability1"]);
  });
  it("clears every held action through modal/capture/blur transitions", () => {
    const state = new BindingState("planetfall"); state.keyDown({ code: "KeyW" }); state.mouseDown(0); state.sample();
    state.setBlocked(true); expect([...state.sample().released].sort()).toEqual(["fire", "moveForward"]);
    expect(state.mouseDown(2)).toEqual([]); state.setBlocked(false);
    expect(state.keyDown({ code: "KeyW", repeat: true })).toEqual([]); state.keyUp({ code: "KeyW" }); state.keyDown({ code: "KeyW" });
    state.clear(); expect(state.sample().held.size).toBe(0); expect(state.sample().pressed.size).toBe(0);
  });
  it("releases even when keyup focus/modifiers no longer match gameplay", () => {
    const state = new BindingState("planetfall"); state.keyDown({ code: "KeyE" }); state.sample();
    state.keyUp({ code: "KeyE" }); expect([...state.sample().released]).toEqual(["interact"]);
  });
  it("accepts a new physical press when blur lost the old release", () => {
    const state = new BindingState("planetfall"); state.keyDown({ code: "KeyW" }); state.sample(); state.clear(); state.sample();
    expect(state.keyDown({ code: "KeyW", repeat: true })).toEqual([]);
    expect(state.keyDown({ code: "KeyW", repeat: false })).toEqual(["moveForward"]);
    expect(state.sample().pressed.has("moveForward")).toBe(true);
  });
  it("does not treat browser shortcuts or text input as gameplay", () => {
    const state = new BindingState("planetfall");
    state.keyDown({ code: "Space", target: { tagName: "INPUT" } as unknown as EventTarget });
    state.keyDown({ code: "KeyW", ctrlKey: true }); expect(state.sample().held.size).toBe(0);
  });
  it("pulses wheel actions for a frame and releases next frame", () => {
    const state = new BindingState("planetfall"); expect(state.wheel(0)).toEqual([]);
    state.wheel(1); let frame = state.sample(); expect(frame.held.has("nextTarget")).toBe(true); expect(frame.pressed.has("nextTarget")).toBe(true);
    frame = state.sample(); expect(frame.released.has("nextTarget")).toBe(true); expect(frame.held.has("nextTarget")).toBe(false);
    expect(state.sample().released.size).toBe(0);
  });
  it("consumes a synchronous menu action until release", () => {
    const state = new BindingState("planetfall"); state.keyDown({ code: "Escape" }); state.consume("pause");
    expect(state.sample().held.size).toBe(0); state.keyUp({ code: "Escape" }); expect(state.sample().released.size).toBe(0);
    state.keyDown({ code: "Escape" }); expect(state.sample().pressed.has("pause")).toBe(true);
  });
  it("handles bound mouse holds and release across a settings change", () => {
    const state = new BindingState("planetfall"); state.mouseDown(0); expect(state.sample().held.has("fire")).toBe(true);
    const changed = setBinding(emptyBindingSettings(), "planetfall", "fire", ["Mouse4"]); if (!changed.ok) throw Error("edit failed"); state.setSettings(changed.settings);
    state.mouseUp(0); expect(state.sample().released.has("fire")).toBe(true); state.mouseDown(4); expect(state.sample().pressed.has("fire")).toBe(true);
  });
  it("allows crouch-first movement and reload while captured and identifies synchronous default ownership", () => {
    const state = new BindingState("planet-gun"), policy = { capturedGameplay: true };
    state.keyDown({ code: "ControlLeft", ctrlKey: true }, policy);
    expect(state.keyDown({ code: "KeyW", ctrlKey: true }, policy)).toEqual(["moveForward"]);
    expect(state.keyDown({ code: "KeyR", ctrlKey: true }, policy)).toEqual(["reload"]);
    expect([...state.sample().held].sort()).toEqual(["crouch", "moveForward", "reload"]);
    expect(state.ownsKeyboardEvent({ code: "KeyW", ctrlKey: true }, policy)).toBe(true);
    expect(state.ownsKeyboardEvent({ code: "KeyW", ctrlKey: true, repeat: true }, policy)).toBe(true);
    expect(state.keyDown({ code: "KeyW", ctrlKey: true, repeat: true }, policy)).toEqual([]);
    state.setBlocked(true);
    expect(state.ownsKeyboardEvent({ code: "KeyW", ctrlKey: true }, policy)).toBe(false);
  });
  it.each([true, false])("releases captured Ctrl chords correctly, Control released first=%s", controlFirst => {
    const state = new BindingState("planet-gun"), policy = { capturedGameplay: true };
    state.keyDown({ code: "ControlLeft", ctrlKey: true }, policy); state.keyDown({ code: "KeyW", ctrlKey: true }, policy); state.keyDown({ code: "KeyR", ctrlKey: true }, policy); state.sample();
    if (controlFirst) {
      state.keyUp({ code: "ControlLeft" }); expect(state.held("moveForward")).toBe(true); expect(state.held("reload")).toBe(true);
    }
    state.keyUp({ code: "KeyW" }); state.keyUp({ code: "KeyR" });
    if (!controlFirst) { expect(state.held("crouch")).toBe(true); state.keyUp({ code: "ControlLeft" }); }
    const frame = state.sample(); expect([...frame.released].sort()).toEqual(["crouch", "moveForward", "reload"]); expect(frame.held.size).toBe(0);
  });
  it("keeps unlocked/UI Ctrl chords and browser navigation native", () => {
    const state = new BindingState("planet-gun"), policy = { capturedGameplay: true };
    for (const code of ["KeyW", "KeyR"]) {
      expect(state.keyDown({ code, ctrlKey: true })).toEqual([]);
      expect(state.ownsKeyboardEvent({ code, ctrlKey: true })).toBe(false);
      const event = { code, ctrlKey: true, target: { tagName: "TEXTAREA" } as unknown as EventTarget };
      expect(state.keyDown(event, policy)).toEqual([]); expect(state.ownsKeyboardEvent(event, policy)).toBe(false);
    }
    for (const event of [{ code: "Tab", ctrlKey: true }, { code: "Tab", shiftKey: true }, { code: "Tab", ctrlKey: true, shiftKey: true }, { code: "KeyW", metaKey: true }, { code: "KeyR", altKey: true }, { code: "KeyJ", ctrlKey: true }]) {
      expect(state.keyDown(event, policy)).toEqual([]); expect(state.ownsKeyboardEvent(event, policy)).toBe(false);
    }
    expect(state.sample().held.size).toBe(0);
  });
});
